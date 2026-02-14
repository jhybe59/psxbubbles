"""
FastAPI Inference Service
HTTP and WebSocket endpoints for ML predictions.

Endpoints:
- POST /infer           - Single prediction
- POST /infer/batch     - Batch predictions
- GET  /health          - Health check
- GET  /models          - Model status
- GET  /regime          - Current regime
- GET  /stats           - Pipeline stats
- WS   /stream          - WebSocket streaming
"""
import asyncio
from datetime import datetime
from typing import Optional, List, Dict
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import structlog

from config import settings
from intelligence import IntelligenceSystem
from realtime import RealtimeInference
from signal_router import signal_router

logger = structlog.get_logger()

# Global instances
intelligence_system: Optional[IntelligenceSystem] = None
realtime_engine: Optional[RealtimeInference] = None
active_websockets: List[WebSocket] = []


# --- Request/Response Models ---

class InferRequest(BaseModel):
    """Single inference request."""
    symbol: str
    bars: List[dict]  # List of OHLCV bars
    current_position: float = 0


class BatchInferRequest(BaseModel):
    """Batch inference request."""
    requests: List[InferRequest]


class InferResponse(BaseModel):
    """Inference response."""
    symbol: str
    action: str
    signal_strength: float
    confidence: float
    direction: int
    regime: str
    position_size_pct: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    agents: Dict[str, float] = {}


class SymbolSubscribe(BaseModel):
    """Symbol subscription request."""
    symbols: List[str]


# --- Lifespan ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global intelligence_system, realtime_engine
    
    import traceback
    try:
        logger.info("ml_service_starting")
        
        # Initialize intelligence system
        intelligence_system = IntelligenceSystem()
        
        # Try to load existing models
        try:
            intelligence_system.load()
            logger.info("models_loaded")
        except Exception as e:
            logger.warning("no_saved_models", error=str(e))
        
        # Initialize realtime engine (but don't start yet)
        realtime_engine = RealtimeInference(
            redis_url=settings.redis_url,
            intelligence=intelligence_system
        )
        
        # Connect signal router
        await signal_router.connect()
        
        # Start realtime engine in background
        if not realtime_engine.running:
            # No default symbols - triggers wildcard subscription in realtime.py
            logger.info("starting_realtime_engine_wildcard")
            asyncio.create_task(realtime_engine.start())
            logger.info("realtime_engine_background_task_started")
        
        logger.info("ml_service_ready")
        
        yield
        
        # Cleanup
        logger.info("ml_service_stopping")
        
        if realtime_engine and realtime_engine.running:
            await realtime_engine.stop()
        
        await signal_router.close()
    except Exception:
        with open("startup_error.txt", "w") as f:
            f.write(traceback.format_exc())
        raise


# --- App ---

app = FastAPI(
    title="ML Inference Service",
    description="Real-time market intelligence API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health ---

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": intelligence_system.is_trained if intelligence_system else False,
        "realtime_running": realtime_engine.running if realtime_engine else False
    }


@app.get("/ready")
async def ready():
    """Readiness check."""
    if not intelligence_system:
        raise HTTPException(503, "Intelligence system not initialized")
    return {"status": "ready"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    from starlette.responses import Response
    from metrics import (
        get_metrics, get_content_type,
        GATES_PASSED, AUTOMATION_ALLOWED, PROFIT_FACTOR,
        WIN_RATE, DISCIPLINE_SCORE, CUMULATIVE_PNL,
        MAX_DRAWDOWN, PAPER_TRADING_DAYS, REDIS_QUEUE_SIZE
    )
    
    # Update Redis queue size
    try:
        if realtime_engine and realtime_engine.redis:
            # Check length of the list we are pushing to (if using list) or stream
            # The dashboard expects 'redis_stream_length', which likely maps to this
            size = await realtime_engine.redis.llen("ml:inference_queue")
            REDIS_QUEUE_SIZE.set(size)
    except Exception:
        pass
    
    # Update Phase 7.5 metrics
    if PHASE75_ENABLED:
        try:
            # Gate status
            report = gate_validator.check_all()
            GATES_PASSED.set(report.gates_passed)
            AUTOMATION_ALLOWED.set(1 if report.automation_allowed else 0)
            
            # Paper trading stats
            cumulative = paper_trader.get_cumulative_stats()
            CUMULATIVE_PNL.set(cumulative.total_pnl * 100)
            MAX_DRAWDOWN.set(-cumulative.max_drawdown * 100)
            PAPER_TRADING_DAYS.set(cumulative.total_days)
            
            # Profit metrics
            PROFIT_FACTOR.set(profit_validator.get_profit_factor())
            WIN_RATE.set(profit_validator.get_win_rate())
            
            # Discipline
            DISCIPLINE_SCORE.set(regime_auditor.get_discipline_score())
        except Exception as e:
            pass  # Don't fail metrics on error
    
    return Response(content=get_metrics(), media_type=get_content_type())


# --- Inference ---

@app.post("/infer", response_model=InferResponse)
async def infer(request: InferRequest):
    """Single symbol inference."""
    if not intelligence_system:
        raise HTTPException(503, "System not ready")
    
    try:
        # Convert bars to DataFrame
        df = pd.DataFrame(request.bars)
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
        
        # Run analysis
        result = intelligence_system.analyze(
            symbol=request.symbol,
            df=df,
            current_position=request.current_position
        )
        
        if 'error' in result:
            raise HTTPException(400, result['error'])
        
        signal = result.get('signal', {})
        decision = result.get('decision', {})
        
        return InferResponse(
            symbol=request.symbol,
            action=decision.get('action', 'hold'),
            signal_strength=signal.get('signal_strength', 0),
            confidence=signal.get('confidence', 0),
            direction=signal.get('direction', 0),
            regime=signal.get('regime', 'unknown'),
            position_size_pct=decision.get('position_size_pct'),
            stop_loss=decision.get('stop_loss'),
            take_profit=decision.get('take_profit'),
            agents={
                name: s.get('signal_strength', 0)
                for name, s in signal.get('agent_signals', {}).items()
            }
        )
        
    except Exception as e:
        logger.error("inference_error", error=str(e))
        raise HTTPException(500, str(e))


@app.post("/infer/batch")
async def infer_batch(request: BatchInferRequest):
    """Batch inference for multiple symbols."""
    results = []
    
    for req in request.requests:
        try:
            result = await infer(req)
            results.append(result.dict())
        except HTTPException as e:
            results.append({"symbol": req.symbol, "error": e.detail})
    
    return {"results": results}


# --- Models ---

@app.get("/models")
async def get_models():
    """Get model status."""
    if not intelligence_system:
        return {"status": "not_initialized"}
    
    return {
        "is_trained": intelligence_system.is_trained,
        "agents": intelligence_system.get_agent_status()
    }


@app.get("/regime")
async def get_regime():
    """Get current market regime assessment."""
    if not intelligence_system:
        return {"regime": "unknown"}
    
    # Get regime from last analyzed symbol
    for symbol, df in intelligence_system.symbol_data.items():
        if not df.empty:
            try:
                from agents import RegimeAgent
                for agent in intelligence_system.agents:
                    if isinstance(agent, RegimeAgent):
                        signal = agent.analyze(df)
                        return {
                            "regime": signal.regime,
                            "confidence": signal.confidence,
                            "symbol": symbol
                        }
            except:
                pass
    
    return {"regime": "unknown", "confidence": 0}


# --- Stats ---

@app.get("/stats")
async def get_stats():
    """Get pipeline statistics."""
    stats = {}
    
    if realtime_engine:
        stats['realtime'] = realtime_engine.get_stats()
    
    if intelligence_system:
        stats['agents'] = intelligence_system.get_agent_status()
    
    stats['router'] = signal_router.get_stats()
    
    return stats


# --- Phase 7.5: Trust Dashboard APIs ---

# Import Phase 7.5 modules
try:
    from paper_trader import paper_trader
    from gate_validator import gate_validator, get_gate_summary
    from regime_auditor import regime_auditor
    from profit_validator import profit_validator
    PHASE75_ENABLED = True
except ImportError:
    PHASE75_ENABLED = False


@app.get("/trust-metrics")
async def get_trust_metrics():
    """Get trust dashboard metrics."""
    if not PHASE75_ENABLED:
        return {"error": "Phase 7.5 not enabled"}
    
    # Get paper trading stats
    cumulative = paper_trader.get_cumulative_stats()
    daily = paper_trader.get_daily_report()
    
    # Get gate status
    gate_status = gate_validator.get_status_summary()
    
    # Get profit metrics
    pf = profit_validator.get_profit_factor()
    win_rate = profit_validator.get_win_rate()
    
    return {
        "daily": {
            "date": daily.date.isoformat(),
            "signals": daily.total_signals,
            "trades": daily.total_trades,
            "win_rate": round(daily.win_rate, 3),
            "net_pnl": round(daily.net_pnl * 100, 2),
            "violations": daily.violations
        },
        "cumulative": {
            "days": cumulative.total_days,
            "total_pnl": round(cumulative.total_pnl * 100, 2),
            "max_drawdown": round(cumulative.max_drawdown * 100, 2),
            "overall_win_rate": round(cumulative.overall_win_rate, 3)
        },
        "quality": {
            "profit_factor": round(pf, 2),
            "win_rate": round(win_rate, 3),
            "expectancy": round(profit_validator.get_expectancy() * 100, 2)
        },
        "gates": gate_status,
        "automation_allowed": gate_status['automation_allowed']
    }


@app.get("/gates")
async def get_gates():
    """Get validation gate status."""
    if not PHASE75_ENABLED:
        return {"error": "Phase 7.5 not enabled"}
    
    report = gate_validator.check_all()
    return report.to_dict()


@app.post("/gates/approve")
async def approve_human_gate(reason: str = "Manual approval"):
    """Grant human approval for Trust Gate."""
    if not PHASE75_ENABLED:
        return {"error": "Phase 7.5 not enabled"}
    
    gate_validator.grant_approval(reason)
    return {"status": "approved", "reason": reason}


@app.post("/gates/revoke")
async def revoke_human_gate(reason: str = "Manual revocation"):
    """Revoke human approval."""
    if not PHASE75_ENABLED:
        return {"error": "Phase 7.5 not enabled"}
    
    gate_validator.revoke_approval(reason)
    return {"status": "revoked", "reason": reason}


@app.get("/paper-trades")
async def get_paper_trades():
    """Get paper trading status."""
    if not PHASE75_ENABLED:
        return {"error": "Phase 7.5 not enabled"}
    
    return {
        "open_trades": [t.to_dict() for t in paper_trader.get_open_trades()],
        "recent_closed": [t.to_dict() for t in paper_trader.get_recent_closed(10)],
        "regime_stats": paper_trader.get_regime_stats()
    }


@app.get("/eod-report")
async def get_eod_report():
    """Get end-of-day report."""
    if not PHASE75_ENABLED:
        return {"error": "Phase 7.5 not enabled"}
    
    return {
        "report": paper_trader.generate_eod_report(),
        "daily_metrics": paper_trader.get_daily_report().to_dict(),
        "cumulative": paper_trader.get_cumulative_stats().__dict__,
        "discipline": regime_auditor.generate_audit_report().to_dict()
    }


@app.get("/audit")
async def get_audit_report():
    """Get regime discipline audit."""
    if not PHASE75_ENABLED:
        return {"error": "Phase 7.5 not enabled"}
    
    return {
        "report": regime_auditor.generate_audit_report().to_dict(),
        "verifications": regime_auditor.run_all_verifications(),
        "recent_violations": [v.to_dict() for v in regime_auditor.get_recent_violations(5)]
    }


# --- Realtime Control ---

@app.post("/realtime/start")
async def start_realtime(request: SymbolSubscribe):
    """Start realtime inference for symbols."""
    if not realtime_engine:
        raise HTTPException(503, "Realtime engine not initialized")
    
    if realtime_engine.running:
        # Just add symbols
        for symbol in request.symbols:
            realtime_engine.add_symbol(symbol)
        return {"status": "symbols_added", "symbols": request.symbols}
    
    # Start engine
    for symbol in request.symbols:
        realtime_engine.add_symbol(symbol)
    
    # Run in background
    asyncio.create_task(realtime_engine.start())
    
    return {"status": "starting", "symbols": request.symbols}


@app.post("/realtime/stop")
async def stop_realtime():
    """Stop realtime inference."""
    if realtime_engine and realtime_engine.running:
        await realtime_engine.stop()
        return {"status": "stopped"}
    return {"status": "not_running"}


# --- WebSocket ---

@app.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    """WebSocket for streaming signals."""
    await websocket.accept()
    active_websockets.append(websocket)
    
    logger.info("websocket_connected")
    
    try:
        while True:
            # Receive messages (for subscription changes)
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0
                )
                
                if data.get('type') == 'subscribe':
                    symbols = data.get('symbols', [])
                    if realtime_engine:
                        for symbol in symbols:
                            realtime_engine.add_symbol(symbol)
                    await websocket.send_json({
                        'type': 'subscribed',
                        'symbols': symbols
                    })
                
                elif data.get('type') == 'ping':
                    await websocket.send_json({'type': 'pong'})
                    
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({
                    'type': 'heartbeat',
                    'timestamp': datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        logger.info("websocket_disconnected")
    finally:
        active_websockets.remove(websocket)


async def broadcast_signal(signal: dict):
    """Broadcast signal to all connected WebSockets."""
    for ws in active_websockets:
        try:
            await ws.send_json(signal)
        except:
            pass


# --- Entry point for development ---

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "inference:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
