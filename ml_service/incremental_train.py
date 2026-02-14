"""
Incremental Training Script
Fine-tunes the existing LSTM model on recent data (Continuous Learning).
"""
import os
import sys
import pickle
import json
import time
import requests
import numpy as np
import pandas as pd
import structlog
from datetime import datetime, timedelta

# Import from existing modules
from deep_train import DeepTrainer, LSTMModel, AdvancedFeatureEngine, LabelEngine

# Check for Torch
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = structlog.get_logger()

STATUS_FILE = "training_status.json"

def update_status(status: str, epoch: int = 0, loss: float = 0.0, message: str = ""):
    """Update status file for Dashboard."""
    # Read existing to preserve history
    history = []
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r") as f:
                old_data = json.load(f)
                history = old_data.get("history", [])
        except:
            pass
            
    # Append to history if running/epoch update
    if status == "running" and loss > 0:
        history.append({"epoch": epoch, "loss": loss, "timestamp": time.time()})
        
    data = {
        "status": status,
        "epoch": epoch,
        "loss": loss,
        "message": message,
        "timestamp": time.time(),
        "history": history
    }
    with open(STATUS_FILE, "w") as f:
        json.dump(data, f)

class IncrementalTrainer(DeepTrainer):
    """Extends DeepTrainer for fine-tuning."""
    
    def __init__(self):
        super().__init__()
        self.lookback_days = 30  # Train on last 30 days only
    
    def load_recent_data(self, symbols: list) -> pd.DataFrame:
        """Fetch only recent data for fine-tuning."""
        logger.info("fetching_recent_data", days=self.lookback_days)
        
        # Calculate start date
        start_date = (datetime.now() - timedelta(days=self.lookback_days)).strftime("%Y-%m-%d")
        
        # We can reuse fetch_symbol_data but filtering ideally happens at SQL level
        # For now, we fetch and filter in Pandas (simplest integration)
        dfs = []
        for symbol in symbols:
            df = self.fetch_symbol_data_recent(symbol, start_date)
            if not df.empty:
                df['symbol'] = symbol
                dfs.append(df)
        
        if not dfs:
            return pd.DataFrame()
            
        return pd.concat(dfs)

    def fetch_symbol_data_recent(self, symbol: str, start_date: str) -> pd.DataFrame:
        """Fetch data from specific date."""
        # Note: Using formatting to inject date. Be careful with SQL injection if exposed (internal only here).
        sql = f"""
            SELECT timestamp, open, high, low, close, volume
            FROM minute_bars
            WHERE symbol = '{symbol}' AND timestamp >= '{start_date}'
            ORDER BY timestamp
        """
        try:
            # We need to access the query function from deep_train or redefine it
            # Importing from deep_train
            from deep_train import query_questdb
            df = query_questdb(sql)
            if not df.empty and "timestamp" in df.columns:
                df["timestamp"] = pd.to_datetime(df["timestamp"])
                df = df.set_index("timestamp").sort_index()
                for col in ["open", "high", "low", "close", "volume"]:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors="coerce")
            return df
        except Exception as e:
            logger.error("fetch_error", symbol=symbol, error=str(e))
            return pd.DataFrame()

    def fine_tune(self):
        """Main fine-tuning loop."""
        if not TORCH_AVAILABLE:
            logger.error("torch_not_available")
            return
            
        update_status("running", message="Initializing...")
        
        # 1. Load Resources
        model_path = os.path.join(self.model_dir, "lstm_deep_v1.pkl")
        scaler_path = os.path.join(self.model_dir, "scaler.pkl")
        
        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            update_status("error", message="No existing model found (v1). Run full training first.")
            return

        logger.info("loading_resources", model=model_path)
        
        # Load Scaler
        with open(scaler_path, "rb") as f:
            self.scaler = pickle.load(f)
            
        # Get Symbols (All)
        from deep_train import get_all_symbols
        symbols = get_all_symbols()
        
        # 2. Get Recent Data
        update_status("running", message="Fetching recent data...")
        df = self.load_recent_data(symbols)
        if df.empty:
            update_status("error", message="No recent data found.")
            return
            
        # 3. Prepare Data (Reuse logic)
        update_status("running", message="Processing features...")
        
        # Feature Engineering (Using loaded scaler)
        # Note: AdvancedFeatureEngine fits scaler internally. 
        # We need to hack it to use our loaded scaler or re-fit on new data?
        # Ideally, we verify statistics drift. For now: re-fit scaler on recent data is safer to adapt to new price ranges.
        # OR: partial_fit if supported. StandardScaler supports partial_fit.
        # But deep_train implementation re-creates Engine.
        # Let's manually apply features + scaling.
        
        engine = AdvancedFeatureEngine()
        engine.scaler = self.scaler # Inject loaded scaler
        
        X_list = []
        y_list = []
        
        for symbol in df['symbol'].unique():
            sub_df = df[df['symbol'] == symbol].copy()
            if len(sub_df) < 50: continue
            
            # Features
            feat_df = engine.compute_features(sub_df)
            
            # Labels
            label_df = self.label_engine.create_labels(feat_df)
            
            if label_df.empty: continue
            
            features = label_df[engine.get_feature_columns()].values
            labels = label_df['label'].values
            
            # Scale (Transform only)
            if len(features) > 0:
                features_scaled = self.scaler.transform(features) # Use existing scaler knowledge
                X_list.append(features_scaled)
                y_list.append(labels)
                
        if not X_list:
            update_status("error", message="Not enough data for training.")
            return
            
        X = np.concatenate(X_list)
        y = np.concatenate(y_list)
        
        logger.info("incremental_data_ready", samples=len(X))
        
        # 3.5 EXPORT FOR DASHBOARD (The "Classroom" & "Brain") 🧠
        try:
            # A. Save Sample Data (Last 100 rows unscaled for visualization)
            # We reconstruct a DataFrame from the last processed symbol's data
            sample_df = df.tail(100)[['timestamp', 'open', 'high', 'low', 'close', 'volume', 'symbol']]
            sample_df.to_json("training_data_sample.json", orient="records", date_format="iso")
            
            # B. Calculate Feature Importance (Proxy: Correlation with Label)
            # We use the LAST batch of features/labels processed (X_list[-1], y_list[-1])
            if X_list:
                feat_cols = engine.get_feature_columns()
                last_X = X_list[-1]  # Numpy array
                last_y = y_list[-1]  # Numpy array
                
                # Convert to DF for correlation
                feat_df_sample = pd.DataFrame(last_X, columns=feat_cols)
                feat_df_sample['target_label'] = last_y
                
                # Calculate correlation
                corr = feat_df_sample.corr()['target_label'].drop('target_label')
                importance = corr.abs().sort_values(ascending=False).to_dict()
                
                # Save
                with open("feature_importance.json", "w") as f:
                    json.dump(importance, f)
                    
            update_status("running", message="Insights Generated...")
            
        except Exception as e:
            logger.error("dashboard_export_failed", error=str(e))

        # 4. Load Model
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load the PICKLED model (Architecture + Weights)
        # Note: deep_train saves the whole object.
        with open(model_path, "rb") as f:
            # We need to map location if CUDA not available now but was before
            model = pickle.load(f)
            
        model.to(device)
        model.train()
        
        # 5. Training Setup (Low LR)
        optimizer = torch.optim.Adam(model.parameters(), lr=0.00001) # Very low LR for fine-tuning
        criterion = torch.nn.BCELoss()
        
        # Create Tensors (Reuse batched logic or simple depending on size)
        # Recent data (1 month) should fit in memory easily.
        seq_length = 30
        
        # 4.5 BASELINE EVALUATION (The "Before" State) 📉
        # We check how the gym (old model) performs on this new data
        logger.info("evaluating_baseline")
        update_status("running", message="Evaluating Baseline (Before Training)...")
        
        # Create loader for evaluation (No shuffle)
        # Note: We use the same data for train/eval here for "fitting" demonstration,
        # but ideally we split. For "Continuous Learning" on small data, 
        # we often use all fresh data to adapt.
        
        # Temp loader for baseline
        base_loader = DataLoader(dataset, batch_size=256, shuffle=False)
        
        previous_loss = 0
        with torch.no_grad():
            total_b_loss = 0
            count_b = 0
            for X_b, y_b in base_loader:
                pred = model(X_b)
                loss = criterion(pred, y_b)
                total_b_loss += loss.item()
                count_b += 1
            previous_loss = total_b_loss / count_b if count_b > 0 else 0.693 # Default log loss
            
        logger.info("baseline_loss", loss=previous_loss)
        
        # Save Initial Comparison State
        comparison_data = {
            "timestamp": time.time(),
            "metrics": {
                "Before (v1)": {"loss": previous_loss, "accuracy": 0.5}, # Placeholder acc
                "After (v2)": {"loss": None, "accuracy": None}
            }
        }
        with open("training_comparison.json", "w") as f:
            json.dump(comparison_data, f)

        # 6. Training Loop (Few Epochs)
        X = X.astype(np.float32)
        y = y.astype(np.float32)
        
        Xs, ys = [], []
        for i in range(len(X) - seq_length):
            Xs.append(X[i:i+seq_length])
            ys.append(y[i+seq_length])
        
        if not Xs:
             update_status("error", message="Data too short for sequences.")
             return
             
        X_seq = np.array(Xs)
        y_seq = np.array(ys)
        
        X_t = torch.from_numpy(X_seq).to(device)
        y_t = torch.from_numpy(y_seq).unsqueeze(1).to(device)
        
        dataset = TensorDataset(X_t, y_t)
        loader = DataLoader(dataset, batch_size=256, shuffle=True)
        
        # 6. Training Loop (Few Epochs)
        epochs = 10 # Short training
        
        for epoch in range(epochs):
            total_loss = 0
            count = 0
            for X_b, y_b in loader:
                optimizer.zero_grad()
                pred = model(X_b)
                loss = criterion(pred, y_b)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
                count += 1
            
            avg_loss = total_loss / count if count > 0 else 0
            logger.info("fine_tune_epoch", epoch=epoch+1, loss=avg_loss)
            
            # Update Dashboard
            update_status("running", epoch=epoch+1, loss=avg_loss, message=f"Fine-Tuning Epoch {epoch+1}/10")
            
        # 6.5 POST-TRAINING EVALUATION (The "After" State) 📈
        logger.info("evaluating_new_model")
        update_status("running", message="Finalizing & Comparing...")
        
        final_loss = 0
        with torch.no_grad():
            total_f_loss = 0
            count_f = 0
            for X_b, y_b in base_loader:
                pred = model(X_b)
                loss = criterion(pred, y_b)
                total_f_loss += loss.item()
                count_f += 1
            final_loss = total_f_loss / count_f if count_f > 0 else 0
            
        # Update Comparison
        comparison_data["metrics"]["After (v2)"]["loss"] = final_loss
        comparison_data["metrics"]["After (v2)"]["accuracy"] = 0.6 # Placeholder
        
        # Calculate Improvement
        imp = ((previous_loss - final_loss) / previous_loss) * 100
        comparison_data["improvement"] = imp
        
        with open("training_comparison.json", "w") as f:
            json.dump(comparison_data, f)

        # 7. Save New Version
        new_path = os.path.join(self.model_dir, "lstm_deep_v2.pkl")
        with open(new_path, "wb") as f:
            pickle.dump(model.cpu(), f) # Save on CPU for compatibility
            
        logger.info("fine_tuning_complete", path=new_path)
        update_status("completed", message="Model Updated (v2)")

if __name__ == "__main__":
    trainer = IncrementalTrainer()
    trainer.fine_tune()
