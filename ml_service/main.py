"""
ML Service API
FastAPI server for real-time predictions.
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from schemas import (
    BarData, FeatureVector, PredictionResponse, 
    PredictionRequest, StreamMessage
)
from features import feature_engine
from models import model_registry, XGBoostModel
from ingest import RedisStreamClient, BarAggregator
import metrics

logger = structlog.get_logger()


# Global state
redis_client: Optional[RedisStreamClient] = None
bar_aggregator: Optional[BarAggregator] = None
stream_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    global redis_client, bar_aggregator
    
    # Startup
    logger.info("starting_ml_service", env=settings.environment)
    
    # Initialize Redis client
    redis_client = RedisStreamClient()
    try:
        await redis_client.connect()
    except Exception as e:
        logger.warning("redis_connection_failed", error=str(e))
    
    # Initialize bar aggregator
    bar_aggregator = BarAggregator(
        bar_type=settings.bar_type,
        interval=settings.bar_interval_seconds
    )
    
    # Load default model
    model = model_registry.get(settings.model_name)
    if model:
        logger.info("model_loaded", name=settings.model_name)
    else:
        logger.warning("no_model_loaded", name=settings.model_name)
    
    # Start stream processor
    stream_task = asyncio.create_task(stream_processor())
    logger.info("stream_processor_started_background")

    yield
    
    # Shutdown
    if stream_task:
        stream_task.cancel()
        try:
            await stream_task
        except asyncio.CancelledError:
            pass
            
    if redis_client:
        await redis_client.close()
    logger.info("ml_service_stopped")


app = FastAPI(
    title="PSX ML Service",
    description="Real-time market move prediction API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for Node.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ HEALTH ENDPOINTS ============

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.service_name,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/ready")
async def ready():
    """Readiness check - model loaded and dependencies available."""
    model = model_registry.get(settings.model_name)
    return {
        "ready": model is not None,
        "model_loaded": model is not None,
        "model_name": settings.model_name
    }


@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint."""
    from fastapi import Response
    return Response(
        content=metrics.get_metrics(), 
        media_type=metrics.get_content_type()
    )


# ============ PREDICTION ENDPOINTS ============

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Get prediction for a feature vector.
    
    Used by Node.js backend to get real-time signals.
    """
    model = model_registry.get(settings.model_name)
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        prediction = model.predict_single(request.features)
        return prediction
    except Exception as e:
        logger.error("prediction_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch", response_model=list[PredictionResponse])
async def predict_batch(requests: list[PredictionRequest]):
    """Batch predictions for multiple symbols."""
    model = model_registry.get(settings.model_name)
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    results = []
    for req in requests:
        try:
            pred = model.predict_single(req.features)
            results.append(pred)
        except Exception as e:
            logger.warning("batch_prediction_error", symbol=req.symbol, error=str(e))
    
    return results


# ============ FEATURES ENDPOINTS ============

@app.post("/features/compute")
async def compute_features(bars: list[BarData]):
    """
    Compute features from a list of bars.
    Useful for Node.js to offload feature computation.
    """
    import pandas as pd
    
    if not bars:
        raise HTTPException(status_code=400, detail="No bars provided")
    
    # Convert to DataFrame
    df = pd.DataFrame([b.model_dump() for b in bars])
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df.set_index('timestamp', inplace=True)
    
    symbol = bars[0].symbol
    
    # Compute features
    df_features = feature_engine.compute_features(df, symbol)
    vectors = feature_engine.to_feature_vectors(df_features)
    
    return {"features": [v.model_dump() for v in vectors]}


# ============ MODEL MANAGEMENT ============

@app.get("/models")
async def list_models():
    """List available models."""
    import os
    models = []
    if os.path.exists(settings.model_path):
        for f in os.listdir(settings.model_path):
            if f.endswith('.pkl'):
                models.append(f.replace('.pkl', ''))
    return {"models": models, "active": settings.model_name}


@app.post("/models/{name}/load")
async def load_model(name: str):
    """Load a specific model."""
    model = model_registry.get(name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model {name} not found")
    return {"status": "loaded", "name": name}


# ============ STREAMING (Background) ============

async def stream_processor():
    """Background task to process Redis stream and publish predictions."""
    if not redis_client:
        logger.warning("redis_not_connected")
        return
    
    model = model_registry.get(settings.model_name)
    if not model:
        logger.warning("no_model_for_streaming")
        return
    
    async for message in redis_client.subscribe("ticks:*"):
        try:
            if message.type == "tick":
                tick = message.data
                logger.info("tick_received", symbol=tick.symbol, price=tick.price) # DEBUG
                
                # 1. Aggregate to Bar
                bar = bar_aggregator.add_tick(tick)
                if bar:
                    # 2. Compute Features
                    # Convert single bar to DataFrame for feature engine
                    import pandas as pd
                    df = pd.DataFrame([bar.model_dump()])
                    df['timestamp'] = pd.to_datetime(df['timestamp'])
                    df.set_index('timestamp', inplace=True)
                    
                    # We need history for features, but for now we'll try compute with what we have
                    # In a real system, we'd maintain a buffer of recent bars
                    df_features = feature_engine.compute_features(df, bar.symbol)
                    
                    # 3. Predict
                    vectors = feature_engine.to_feature_vectors(df_features)
                    if vectors:
                        vector = vectors[-1]
                        prediction = model.predict_single(vector)
                        
                        # 4. Update Metrics
                        metrics.record_signal(
                            symbol=bar.symbol,
                            action=prediction.action,
                            regime=prediction.regime,
                            confidence=prediction.confidence,
                            strength=0.0 # TODO: Add strength to prediction response
                        )
                        metrics.MODEL_PREDICTIONS.labels(model=settings.model_name).inc()
                        
                        # 5. Publish Prediction (Optional, for other consumers)
                        # await redis_client.publish(f"preds:{bar.symbol}", prediction)
        except Exception as e:
            logger.error("stream_processing_error", error=str(e))


@app.post("/stream/start")
async def start_stream(background_tasks: BackgroundTasks):
    """Start background stream processing."""
    background_tasks.add_task(stream_processor)
    return {"status": "stream_started"}


# ============ MAIN ============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development"
    )
