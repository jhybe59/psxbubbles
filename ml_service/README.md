# PSX ML Service

Market move prediction microservice for the PSXBubbles platform.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   QuestDB   │────▶│  ML Service │────▶│   Node.js   │
│  (History)  │     │  (FastAPI)  │     │   (API)     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │    Redis    │
                    │ (Pub/Sub)   │
                    └─────────────┘
```

## Quick Start

### Development (Standalone)

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env

# Run the API
python main.py
```

### Docker (Recommended)

```bash
# From project root
docker compose -f docker-compose.dev.yml up ml-service
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness (model loaded) |
| `/predict` | POST | Single prediction |
| `/predict/batch` | POST | Batch predictions |
| `/features/compute` | POST | Compute features from bars |
| `/models` | GET | List available models |

## Training

```bash
# Train on all symbols, last 30 days
python train.py --days 30

# Train on specific symbols
python train.py --symbols LUCK ENGRO OGDC --days 30
```

## Data Schemas

### Input: BarData
```json
{
  "symbol": "LUCK",
  "timestamp": "2026-02-05T10:00:00Z",
  "open": 100.0,
  "high": 102.0,
  "low": 99.5,
  "close": 101.5,
  "volume": 50000
}
```

### Output: PredictionResponse
```json
{
  "symbol": "LUCK",
  "timestamp": "2026-02-05T10:00:00Z",
  "move_probability": 0.78,
  "direction": "up",
  "confidence": 0.78,
  "signal_strength": "strong",
  "recommended_action": "alert"
}
```

## Configuration

All settings via environment variables with `ML_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `ML_QUESTDB_HOST` | localhost | QuestDB host |
| `ML_REDIS_HOST` | localhost | Redis host |
| `ML_MODEL_NAME` | xgb_baseline_v1 | Active model |
| `ML_PREDICTION_THRESHOLD` | 0.6 | Alert threshold |
| `ML_MOVE_THRESHOLD_PCT` | 1.0 | Move definition (%) |
