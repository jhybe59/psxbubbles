# Tasks

- [/] Analyze Breakouts in Data
    - [ ] Locate and inspect the data (QuestDB or CSV)
    - [ ] Create a script to process the data and identify "breakouts" (sudden price increases) on 50-tick intervals
    - [ ] Generate a report or list of identified breakouts
    - [ ] Analyze pre-breakout conditions for these identified instances

- [x] **Breakout Analysis & Screener Debugging**
    - [x] Analyze 50-tick breakouts (Script: `analyze-breakouts-50ticks.mjs`, Output: `breakouts_50t.csv`)
    - [x] Relax screener thresholds (Tightness < 5%, VolPulse > 1.5x)
    - [x] Implement "Flash Wake-up" (Dead Stock: Vol > 50x overrides tightness)
    - [x] Implement "Sustained Signal" (5 min Memory)
    - [x] Verify detection rate (Improved to 61.8%)
    - [x] Restart Server to apply changes

- [x] **Fix Missing Tooltip Data**
    - [x] Debug Backend (Fix dayStart logic in bubbles.mjs)
    - [x] Fix Tick-Interal Data (Add lead_metrics to tick-bubbles.mjs)
    - [x] Fix Frontend Mapping (Pass lead_metrics in useOHLCV.js)
    - [x] Polish Live Engine UI (Relocated to Interval Alerts column to fix overlay)

- [x] **Continuous Learning Strategy (MLOps)**
    - [x] Design `incremental_train.py` for weekly fine-tuning
    - [x] Create automation plan (Cron/Task Scheduler)
    - [x] Document lifecycle and maintenance procedures

- [ ] **Advanced Training Dashboard (Redesign)**
    - [ ] **Data Visualization:** Show "What did the model see?" (Input Sequences)
    - [ ] **Learning Metrics:** Real-time Loss/Accuracy curves (Live updating)
    - [ ] **Model Insights:** Feature Importance (Permutation Importance) & Attention Weights (if applicable)
    - [ ] **Validation:** "Test on these specific dates" feature

- [x] **Debug Grafana/Dashboard Stagnation**
    - [x] Identify which dashboard (Streamlit vs Grafana)- [x] Set up Grafana 
    - [x] Set up QuestDB (partitioned by DAY)
    - [x] Create async writer (fire-and-forget)
    - [x] Verify data ingestion
- [x] **Grafana Wiring & Visualization**
    - [x] Provision QuestDB Datasource (PostgreSQL)
    - [x] Create ML Monitoring Dashboard (JSON Model)
        - [x] Panel: Live Tick Flow (Sanity Check)
        - [x] Panel: ML Confidence Over Time
        - [x] Panel: Signal Distribution
        - [x] Panel: Total Predictions (Watchdog) - *Replaces Latency panel due to schema*
    - [x] Verify Dashboard in Grafana (Provisioning Logs Confirmed)
    - [x] **Implement Stream Logic:** Add threaded `QuestDBWriter` to `realtime.py`
    - [x] Verify metrics incrementing in Grafana
- [x] **Real Market Adapter**
    - [x] Stop `feature_pusher.cjs` simulator
    - [x] Verify `worker` service connection to PSX Feed
    - [x] Confirm `ticks.raw.*` publishing format matches `ml-service` expectation

- [x] Integrate Deep Learning Models
    - [x] Update `IntelligenceSystem` to load `lstm`, `xgboost`, `lightgbm`
    - [x] Create `DeepFeatureEngine` for feature parity
    - [x] Implement inference logic in `analyze` method
    - [x] Fuse deep learning signals in `EnsembleEngine`
    - [x] Verify `deep_inference` logs in `ml-service`
        - [x] Debug LSTM loading (namespace shim, legacy structure)l loading and inference
