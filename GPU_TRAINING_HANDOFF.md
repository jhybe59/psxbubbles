# PSXBubbles Deep ML Training - GPU Handoff Prompt

## 🚨 INSTRUCTIONS FOR THE NEW AGENT

Copy-paste everything below this line as a prompt to the agent on the GPU PC. Make sure the psxbubbles-main project folder is available on that PC first.

---

## CONTEXT: What This Project Is

This is **PSXBubbles** — a real-time Pakistan Stock Exchange (PSX) trading signal system. It has:

1. **Frontend**: React bubble chart visualization of all 96 KSE-100 stocks
2. **API**: Express.js backend serving data and signals
3. **Worker**: Node.js ingestion worker that pulls live ticks from PSX via WebSocket
4. **QuestDB**: Time-series database storing tick data and minute bars
5. **Redis**: Pub/sub for real-time events
6. **ML Service**: Python FastAPI service that runs ML models for trading signals
7. **Grafana**: Monitoring dashboards

The ML service is the focus of this task. It lives in `ml_service/` directory.

---

## WHAT HAS BEEN DONE SO FAR

### 1. Data Pipeline (COMPLETED ✅)
- **8.7 million tick records** aggregated into **738,514 minute bars** in QuestDB's `minute_bars` table
- Data covers **96 PSX symbols** (all KSE-100 stocks)
- Each minute bar has: `timestamp`, `symbol`, `open`, `high`, `low`, `close`, `volume`
- Data is accessed via QuestDB's HTTP REST API at `http://questdb:9000/exec?query=SQL`

### 2. Feature Engineering (COMPLETED ✅)
- **50+ features** implemented in `ml_service/deep_train.py` → `AdvancedFeatureEngine` class
- Feature categories:
  - **Price Returns**: 1, 2, 3, 5, 10, 15, 20, 30 period returns
  - **Volatility**: 5/10/20 period rolling std, ATR-14, ATR ratio
  - **Volume**: Volume SMA 10/20, volume ratios, volume trend, VWAP deviation
  - **Momentum**: RSI-14, RSI oversold/overbought flags, MACD, MACD signal/histogram/crossover
  - **Trend**: SMA/EMA for periods 5/10/20/50, close-above-SMA flags, SMA 5/20 crossover
  - **Bollinger Bands**: BB position, BB squeeze
  - **Price Patterns**: Body %, bullish flag, gap up/down detection
  - **Regime**: 20-period trend, trend strength, choppiness index
- All features are combined into a 37-column feature vector per sample

### 3. Label Engineering (COMPLETED ✅)
- **LabelEngine** class creates binary labels: `1 = profitable opportunity, 0 = no opportunity`
- Logic: Looks 10 bars ahead, labels as 1 if:
  - Maximum potential gain > 0.5%
  - Maximum gain > maximum loss (positive risk/reward)
- **Positive rate: ~20.4%** (about 1 in 5 bars are labeled as profitable)

### 4. XGBoost + LightGBM Training (COMPLETED ✅)
- **XGBoost**: AUC 0.749 (74.9%) — trained with 500 trees, max_depth=6, lr=0.05
- **LightGBM**: AUC 0.749 (74.9%) — same hyperparameters
- **Ensemble** (average of both): AUC 0.749
- Training: 435,069 train samples, 108,768 validation samples (80/20 time-series split)
- **Models SAVED** at:
  - `ml_service/models/xgboost_deep_v1.pkl` (2.2 MB)
  - `ml_service/models/lightgbm_deep_v1.pkl` (1.8 MB)
  - `ml_service/models/scaler.pkl` (1.4 KB)

### 5. LSTM Training (FAILED ❌ — NEEDS GPU)
- LSTM architecture:
  - 3-layer LSTM with 128 hidden units
  - Dropout: 0.2 in LSTM, 0.3 in FC
  - FC head: 128→32→1 with ReLU and Sigmoid
  - Sequence length: 20 bars
- **100K samples** randomly sampled from 435K training set
- **99,980 sequences** created
- Training attempted with 100 epochs, but:
  - On CPU: Each epoch took ~14 minutes
  - Only reached epoch 20/100 in 5 hours
  - Loss barely improved: 0.503 → 0.502
  - **Training was canceled due to CPU being too slow**
- **THIS IS WHY YOU NEED GPU** — the same training should take ~15-30 minutes on CUDA

---

## WHAT YOU NEED TO DO

### Task 1: Fix LSTM for CUDA/GPU Training

The training script `ml_service/deep_train.py` currently trains on CPU. You need to:

1. **Enable CUDA in the training script**:
   - Move model to GPU: `model = model.cuda()` or `model.to('cuda')`
   - Move tensors to GPU: `X_train_t = X_train_t.cuda()`, etc.
   - Move batch data to GPU in training loop

2. **Use all training data for LSTM** (not just 100K sample):
   - The current code samples 100K from 435K to save memory
   - With a proper GPU, you can use all 435K samples
   - Increase `sample_size` in `train_lstm()` method

3. **Increase model capacity**:
   - Consider: hidden_size=256, num_layers=4
   - Add Attention mechanism for better sequence learning
   - Consider Bidirectional LSTM

4. **Run the training**:
```bash
# Make sure Docker is running with all services
docker compose up -d

# Install requests module (needed for QuestDB queries)
docker exec psxbubbles-main-ml-service-1 pip install requests

# Run deep training
docker exec psxbubbles-main-ml-service-1 python deep_train.py
```

### Task 2: Improve Training with More Data and Better Models (OPTIONAL)

If time permits:

1. **Walk-Forward Validation**: Instead of single 80/20 split, use TimeSeriesSplit with 5 folds
2. **Hyperparameter Tuning**: Use Optuna or GridSearch for XGBoost/LightGBM
3. **Transformer Model**: There's a `ml_service/deep_models/transformer_model.py` — consider training it too
4. **More Epochs for XGBoost/LightGBM**: Increase n_estimators from 500 to 1000-2000

### Task 3: Copy Models Back

After training completes, the models will be saved in:
```
ml_service/models/
├── xgboost_deep_v1.pkl
├── lightgbm_deep_v1.pkl
├── lstm_deep_v1.pkl        ← NEW (this is the main goal)
├── scaler.pkl
```

Copy these `.pkl` files back to the original PC's `ml_service/models/` directory.

---

## ARCHITECTURE OF deep_train.py

The training script (`ml_service/deep_train.py`, 652 lines) has this structure:

```
1. QuestDB Query Functions (lines 39-87)
   - query_questdb(sql) → pd.DataFrame
   - get_all_symbols() → List[str]
   - fetch_symbol_data(symbol) → pd.DataFrame
   - Connects to QuestDB at http://questdb:9000/exec

2. AdvancedFeatureEngine (lines 93-235)
   - compute_features(df) → df with 50+ columns
   - get_feature_columns() → list of 37 feature names

3. LabelEngine (lines 242-270)
   - create_labels(df) → df with 'label' column (binary)
   - Lookforward: 10 bars, min move: 0.5%

4. LSTMModel (lines 277-303)
   - 3-layer LSTM, hidden=128, dropout=0.2
   - FC: Linear(128,32) → ReLU → Dropout(0.3) → Linear(32,1) → Sigmoid

5. DeepTrainer (lines 310-608)
   - load_all_data() → fetches all 96 symbols from QuestDB
   - prepare_training_data() → compute features + labels for all symbols
   - train_xgboost() → XGBClassifier(n_estimators=500, max_depth=6)
   - train_lightgbm() → LGBMClassifier(same params)
   - train_lstm() → LSTM with 100 epochs, early stopping (patience=15)
   - train_all() → orchestrates everything, saves models

6. main() (lines 614-651)
   - Parses --symbols arg (default: all 96)
   - Runs DeepTrainer.train_all()
```

---

## DOCKER SETUP

### docker-compose.yml services:
- `questdb` — Port 9000 (HTTP), 9009 (ILP), 8812 (PGWire)
- `redis` — Port 6379
- `ml-service` — Port 8000 (FastAPI inference)
- `api` — Port 3000 (Express.js)
- `worker` — Background ingestion

### ML Service Dockerfile:
```dockerfile
FROM python:3.11-slim
# Installs: torch (CPU), xgboost, lightgbm, scikit-learn, transformers
# Plus: fastapi, uvicorn, redis, pandas, numpy, structlog, etc.
```

### For GPU Training, modify the Dockerfile:
```dockerfile
# Change FROM line for CUDA support:
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Or install PyTorch with CUDA:
RUN pip install torch --index-url https://download.pytorch.org/whl/cu121
```

### Environment Variables:
```
ML_QUESTDB_HOST=questdb    (default, inside Docker)
ML_QUESTDB_PORT=9000       (default)
```

If running training OUTSIDE Docker (directly on the GPU machine), change these:
```
ML_QUESTDB_HOST=localhost
ML_QUESTDB_PORT=9000
```

---

## KEY DATA STATS

| Metric | Value |
|--------|-------|
| Total Tick Records | ~8.7 million |
| Minute Bars | 738,514 |
| Symbols | 96 (KSE-100 stocks) |
| Features per Sample | 37 |
| Training Samples (after features) | 543,837 |
| Train/Val Split | 435,069 / 108,768 (80/20) |
| Positive Label Rate | 20.4% |
| XGBoost AUC | 0.749 |
| LightGBM AUC | 0.749 |
| Ensemble AUC | 0.749 |
| LSTM Status | NEEDS GPU TRAINING |

---

## ALL 96 SYMBOLS

The symbols are in the QuestDB `minute_bars` table. They are all KSE-100 stocks like:
OGDC, PPL, HBL, UBL, MCB, LUCK, ENGRO, PSO, FFC, HUBC, MARI, SYS, TRG, AVN, MEBL, etc.

You can get the full list by running:
```sql
SELECT DISTINCT symbol FROM minute_bars
```

---

## CURRENT MODEL RESULTS (Before GPU Training)

### XGBoost (n_estimators=500, max_depth=6, lr=0.05):
```
Epoch   0: AUC 0.709
Epoch 100: AUC 0.748
Epoch 200: AUC 0.750
Epoch 300: AUC 0.750
Epoch 400: AUC 0.749
Epoch 499: AUC 0.749
```

### LightGBM (n_estimators=500, max_depth=6, lr=0.05):
```
Final AUC: 0.749
```

### LSTM (CPU, only 20/100 epochs completed):
```
Epoch 10: Loss 0.503
Epoch 20: Loss 0.502
(Canceled — too slow on CPU)
```

---

## WHAT TO CHANGE FOR GPU TRAINING

### In deep_train.py, modify train_lstm() method:

```python
def train_lstm(self, X_train, y_train, X_val, y_val, seq_length: int = 20):
    if not TORCH_AVAILABLE:
        return None
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info("lstm_device", device=str(device))
    
    # USE ALL DATA with GPU (not just 100K sample)
    sample_size = len(X_train)  # Use all data with GPU
    
    # ... create sequences ...
    
    # Move to GPU
    X_train_t = torch.FloatTensor(X_train_seq).to(device)
    y_train_t = torch.FloatTensor(y_train_seq).unsqueeze(1).to(device)
    
    # Bigger model for GPU
    model = LSTMModel(input_size=X_train.shape[1], hidden_size=256, num_layers=4).to(device)
    
    # In training loop, move batches to GPU:
    for X_batch, y_batch in train_loader:
        X_batch = X_batch.to(device)
        y_batch = y_batch.to(device)
        # ... rest same ...
```

### Also consider adding to requirements.txt for GPU:
```
torch>=2.1.0  # Remove the --index-url for CPU, install CUDA version separately
```

---

## AFTER TRAINING IS COMPLETE

### Models to copy back:
1. `ml_service/models/xgboost_deep_v1.pkl`
2. `ml_service/models/lightgbm_deep_v1.pkl`
3. `ml_service/models/lstm_deep_v1.pkl` ← **THIS IS THE MAIN GOAL**
4. `ml_service/models/scaler.pkl`

### Then on the original PC:
1. Copy models to `ml_service/models/`
2. Restart Docker: `docker compose restart ml-service`
3. The inference service (`ml_service/inference.py`) needs to load these models
4. Check Grafana dashboards for signal accuracy

---

## TROUBLESHOOTING

### If QuestDB has no data:
The `minute_bars` table data might not be on the GPU PC. You have two options:
a. Run the full stack on the GPU PC with Docker to pull live data
b. **Export data as CSV** from the original PC and import it:
```bash
# On original PC - export from QuestDB
curl "http://localhost:9000/exec?query=SELECT * FROM minute_bars" > minute_bars.json

# Or use CSV export
curl "http://localhost:9000/exp?query=SELECT * FROM minute_bars" > minute_bars.csv
```

### If Docker is not available on GPU PC:
Run training directly with Python:
```bash
cd ml_service
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cu121  # For CUDA
pip install requests

# Set QuestDB host (if running on different machine)
export ML_QUESTDB_HOST=<IP_OF_ORIGINAL_PC>
export ML_QUESTDB_PORT=9000

python deep_train.py
```

### If models won't load after training:
Check that the `inference.py` or `intelligence.py` has model loading logic. The current service might need explicit model loading code. Look for `pickle.load` or model registry patterns.

---

## SUMMARY

| What | Status |
|------|--------|
| Data aggregation | ✅ Done (738K minute bars) |
| Feature engineering | ✅ Done (37 features) |
| Label engineering | ✅ Done (20.4% positive) |
| XGBoost | ✅ Trained (AUC 0.749) |
| LightGBM | ✅ Trained (AUC 0.749) |
| LSTM | ❌ Needs GPU (failed on CPU) |
| Model integration | ⏳ Pending (after LSTM trained) |
| Grafana dashboards | ⏳ Pending |

**THE PRIMARY GOAL: Train the LSTM model on GPU and save it as `lstm_deep_v1.pkl`**
