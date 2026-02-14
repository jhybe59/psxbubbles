"""
Deep Training Pipeline
Comprehensive multi-model training on all 96 symbols with advanced features.
This is REAL training that takes time and produces production-ready models.
"""
import os
import sys
import argparse
import pickle
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import classification_report, roc_auc_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import lightgbm as lgb
import structlog

# Try to import torch for LSTM
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = structlog.get_logger()

# QuestDB Configuration
QUESTDB_HOST = os.getenv("ML_QUESTDB_HOST", "questdb")
QUESTDB_PORT = int(os.getenv("ML_QUESTDB_PORT", 9000))
QUESTDB_URL = f"http://{QUESTDB_HOST}:{QUESTDB_PORT}/exec"


# ============================================================
# DIRECT QUESTDB QUERIES
# ============================================================

def query_questdb(sql: str) -> pd.DataFrame:
    """Execute SQL query against QuestDB and return DataFrame."""
    try:
        response = requests.get(QUESTDB_URL, params={"query": sql}, timeout=60)
        data = response.json()
        
        if "error" in data:
            raise ValueError(f"QuestDB error: {data['error']}")
        
        if "columns" not in data or "dataset" not in data:
            return pd.DataFrame()
        
        columns = [col["name"] for col in data["columns"]]
        df = pd.DataFrame(data["dataset"], columns=columns)
        return df
    except Exception as e:
        logger.warning("questdb_query_failed", error=str(e))
        return pd.DataFrame()


def get_all_symbols() -> List[str]:
    """Get all unique symbols from minute_bars table."""
    df = query_questdb("SELECT DISTINCT symbol FROM minute_bars")
    if df.empty:
        return []
    return df["symbol"].tolist()


def fetch_symbol_data(symbol: str) -> pd.DataFrame:
    """Fetch all OHLCV data for a symbol."""
    sql = f"""
        SELECT timestamp, open, high, low, close, volume
        FROM minute_bars
        WHERE symbol = '{symbol}'
        ORDER BY timestamp
    """
    df = query_questdb(sql)
    if not df.empty and "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.set_index("timestamp").sort_index()
        # Convert columns to float
        for col in ["open", "high", "low", "close", "volume"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

# ============================================================
# ADVANCED FEATURE ENGINEERING
# ============================================================

class AdvancedFeatureEngine:
    """Deep feature engineering for trading signals."""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_names = []
    
    def compute_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute 50+ features for deep learning."""
        df = df.copy()
        
        # ============ PRICE RETURNS ============
        for period in [1, 2, 3, 5, 10, 15, 20, 30]:
            df[f'return_{period}'] = df['close'].pct_change(period)
        
        # ============ VOLATILITY ============
        df['volatility_5'] = df['return_1'].rolling(5).std()
        df['volatility_10'] = df['return_1'].rolling(10).std()
        df['volatility_20'] = df['return_1'].rolling(20).std()
        
        # True Range
        df['tr'] = np.maximum(
            df['high'] - df['low'],
            np.maximum(
                abs(df['high'] - df['close'].shift(1)),
                abs(df['low'] - df['close'].shift(1))
            )
        )
        df['atr_14'] = df['tr'].rolling(14).mean()
        df['atr_ratio'] = df['tr'] / df['atr_14']
        
        # ============ VOLUME FEATURES ============
        df['volume_sma_10'] = df['volume'].rolling(10).mean()
        df['volume_sma_20'] = df['volume'].rolling(20).mean()
        df['volume_ratio_10'] = df['volume'] / df['volume_sma_10'].replace(0, np.nan)
        df['volume_ratio_20'] = df['volume'] / df['volume_sma_20'].replace(0, np.nan)
        
        # Volume trend
        df['volume_change'] = df['volume'].pct_change()
        df['volume_trend'] = df['volume'].rolling(5).mean() / df['volume'].rolling(20).mean()
        
        # VWAP
        df['vwap'] = (df['close'] * df['volume']).cumsum() / df['volume'].cumsum()
        df['vwap_deviation'] = (df['close'] - df['vwap']) / df['vwap']
        
        # ============ MOMENTUM INDICATORS ============
        # RSI
        delta = df['close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        df['rsi_14'] = 100 - (100 / (1 + rs))
        df['rsi_oversold'] = (df['rsi_14'] < 30).astype(int)
        df['rsi_overbought'] = (df['rsi_14'] > 70).astype(int)
        
        # MACD
        ema12 = df['close'].ewm(span=12, adjust=False).mean()
        ema26 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = ema12 - ema26
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_hist'] = df['macd'] - df['macd_signal']
        df['macd_crossover'] = (
            (df['macd'] > df['macd_signal']) & 
            (df['macd'].shift(1) <= df['macd_signal'].shift(1))
        ).astype(int)
        
        # ============ TREND INDICATORS ============
        # Moving averages
        for period in [5, 10, 20, 50]:
            df[f'sma_{period}'] = df['close'].rolling(period).mean()
            df[f'ema_{period}'] = df['close'].ewm(span=period, adjust=False).mean()
            df[f'close_above_sma_{period}'] = (df['close'] > df[f'sma_{period}']).astype(int)
        
        # MA crossovers
        df['sma_5_20_cross'] = (
            (df['sma_5'] > df['sma_20']) & 
            (df['sma_5'].shift(1) <= df['sma_20'].shift(1))
        ).astype(int)
        
        # ============ BOLLINGER BANDS ============
        sma20 = df['close'].rolling(20).mean()
        std20 = df['close'].rolling(20).std()
        df['bb_upper'] = sma20 + (std20 * 2)
        df['bb_lower'] = sma20 - (std20 * 2)
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower']).replace(0, np.nan)
        df['bb_squeeze'] = (df['bb_upper'] - df['bb_lower']) / sma20
        
        # ============ PRICE PATTERNS ============
        # Candle patterns
        df['body'] = df['close'] - df['open']
        df['body_pct'] = df['body'] / df['open']
        df['upper_shadow'] = df['high'] - np.maximum(df['open'], df['close'])
        df['lower_shadow'] = np.minimum(df['open'], df['close']) - df['low']
        df['is_bullish'] = (df['close'] > df['open']).astype(int)
        
        # Gap detection
        df['gap_up'] = (df['open'] > df['high'].shift(1)).astype(int)
        df['gap_down'] = (df['open'] < df['low'].shift(1)).astype(int)
        
        # ============ REGIME FEATURES ============
        # Trend strength
        df['trend_20'] = (df['close'] - df['close'].shift(20)) / df['close'].shift(20)
        df['trend_strength'] = abs(df['trend_20']) / df['volatility_20'].replace(0, np.nan)
        
        # Choppiness
        high_20 = df['high'].rolling(20).max()
        low_20 = df['low'].rolling(20).min()
        atr_sum = df['atr_14'].rolling(20).sum()
        df['choppiness'] = 100 * np.log10(atr_sum / (high_20 - low_20).replace(0, np.nan)) / np.log10(20)
        
        # ============ TIME FEATURES ============
        if 'timestamp' in df.columns:
            df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
            df['minute'] = pd.to_datetime(df['timestamp']).dt.minute
            df['day_of_week'] = pd.to_datetime(df['timestamp']).dt.dayofweek
        
        # Clean up
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna()
        
        return df
    
    def get_feature_columns(self) -> List[str]:
        """Return list of feature columns for model input."""
        return [
            # Returns
            'return_1', 'return_2', 'return_3', 'return_5', 'return_10', 'return_15', 'return_20', 'return_30',
            # Volatility
            'volatility_5', 'volatility_10', 'volatility_20', 'atr_14', 'atr_ratio',
            # Volume
            'volume_ratio_10', 'volume_ratio_20', 'volume_change', 'volume_trend', 'vwap_deviation',
            # Momentum
            'rsi_14', 'rsi_oversold', 'rsi_overbought', 'macd', 'macd_signal', 'macd_hist', 'macd_crossover',
            # Trend
            'close_above_sma_5', 'close_above_sma_10', 'close_above_sma_20', 'close_above_sma_50',
            'sma_5_20_cross',
            # Bollinger
            'bb_position', 'bb_squeeze',
            # Patterns
            'body_pct', 'is_bullish', 'gap_up', 'gap_down',
            # Regime
            'trend_20', 'trend_strength', 'choppiness'
        ]


# ============================================================
# LABEL ENGINEERING
# ============================================================

class LabelEngine:
    """Create training labels for profitable moves."""
    
    def __init__(self, min_move_pct: float = 0.5, lookforward: int = 10):
        self.min_move_pct = min_move_pct  # 0.5% minimum move
        self.lookforward = lookforward     # bars to look ahead
    
    def create_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create binary labels: 1 = profitable opportunity, 0 = no opportunity."""
        df = df.copy()
        
        # Calculate future max gain
        df['future_max'] = df['high'].rolling(self.lookforward).max().shift(-self.lookforward)
        df['future_min'] = df['low'].rolling(self.lookforward).min().shift(-self.lookforward)
        
        # Max potential gain from current close
        df['max_gain'] = (df['future_max'] - df['close']) / df['close'] * 100
        df['max_loss'] = (df['close'] - df['future_min']) / df['close'] * 100
        
        # Label: 1 if gain > min_move AND gain > loss (risk/reward positive)
        df['label'] = (
            (df['max_gain'] > self.min_move_pct) & 
            (df['max_gain'] > df['max_loss'])
        ).astype(int)
        
        # Drop rows without labels (last N rows)
        df = df.dropna(subset=['label'])
        
        return df


# ============================================================
# LSTM MODEL
# ============================================================

class LSTMModel(nn.Module):
    """LSTM for time series prediction."""
    
    def __init__(self, input_size: int, hidden_size: int = 64, num_layers: int = 2):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        # Use only the last hidden state
        out = self.fc(lstm_out[:, -1, :])
        return out


# ============================================================
# DEEP TRAINER
# ============================================================

class DeepTrainer:
    """Multi-model training pipeline."""
    
    def __init__(self, model_dir: str = "./models"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        self.feature_engine = AdvancedFeatureEngine()
        self.label_engine = LabelEngine()
        self.scaler = StandardScaler()
        self.models = {}
        self.metrics = {}
    
    def load_all_data(self, symbols: List[str], table: str = "minute_bars") -> pd.DataFrame:
        """Load data for all symbols."""
        all_data = []
        
        for i, symbol in enumerate(symbols):
            try:
                df = fetch_symbol_data(symbol)
                if df is not None and len(df) > 100:  # Need enough data
                    df['symbol'] = symbol
                    all_data.append(df)
                    if (i + 1) % 10 == 0:
                        logger.info("loaded_symbols", count=i+1, total=len(symbols))
            except Exception as e:
                logger.warning("symbol_load_failed", symbol=symbol, error=str(e))
        
        if not all_data:
            raise ValueError("No data loaded for any symbol")
        
        combined = pd.concat(all_data)
        logger.info("data_loaded", total_rows=len(combined), symbols=len(all_data))
        return combined
    
    def prepare_training_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Compute features and labels."""
        logger.info("computing_features", rows=len(df))
        
        # Process each symbol separately then combine
        all_features = []
        all_labels = []
        
        symbols = df['symbol'].unique()
        for symbol in symbols:
            symbol_df = df[df['symbol'] == symbol].copy()
            
            # Compute features
            featured = self.feature_engine.compute_features(symbol_df)
            if len(featured) < 50:
                continue
            
            # Create labels
            labeled = self.label_engine.create_labels(featured)
            if len(labeled) < 50:
                continue
            
            # Get feature columns
            feature_cols = self.feature_engine.get_feature_columns()
            available_cols = [c for c in feature_cols if c in labeled.columns]
            
            X = labeled[available_cols].values
            y = labeled['label'].values
            
            all_features.append(X)
            all_labels.append(y)
        
        if not all_features:
            raise ValueError("No valid training data after feature computation")
        
        X = np.vstack(all_features)
        y = np.concatenate(all_labels)
        
        # Scale features
        X = self.scaler.fit_transform(X)
        
        logger.info("training_data_ready", samples=len(y), positive_rate=y.mean())
        return X, y
    
    def train_xgboost(self, X_train, y_train, X_val, y_val) -> xgb.XGBClassifier:
        """Train XGBoost model with proper tuning."""
        logger.info("training_xgboost")
        
        model = xgb.XGBClassifier(
            n_estimators=500,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
            use_label_encoder=False,
            eval_metric='auc'
        )
        
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=100
        )
        
        return model
    
    def train_lightgbm(self, X_train, y_train, X_val, y_val) -> lgb.LGBMClassifier:
        """Train LightGBM model."""
        logger.info("training_lightgbm")
        
        model = lgb.LGBMClassifier(
            n_estimators=500,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
            verbose=-1
        )
        
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)]
        )
        
        return model
    
    def train_lstm(self, X_train, y_train, X_val, y_val, seq_length: int = 30):
        """Train LSTM model using GPU if available."""
        if not TORCH_AVAILABLE:
            logger.warning("pytorch_not_available", msg="Skipping LSTM")
            return None
        
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info("training_lstm_deep", train_samples=len(X_train), epochs=100, device=str(device))
        
        # INCREASE SAMPLE SIZE for GPU (or use all data if memory allows)
        max_samples = 435000 if torch.cuda.is_available() else 100000
        sample_size = min(max_samples, len(X_train))
        
        if sample_size < len(X_train):
            indices = np.random.choice(len(X_train), sample_size, replace=False)
            X_sample = X_train[indices]
            y_sample = y_train[indices]
            logger.info("lstm_data_sampled", original=len(X_train), sampled=sample_size)
        else:
            X_sample = X_train
            y_sample = y_train
            logger.info("lstm_using_all_data", count=len(X_train))
        
        # Memory Optimization: Convert to float32 EARLY to save 50% RAM
        X_sample = X_sample.astype(np.float32)
        y_sample = y_sample.astype(np.float32)

        # Create sequences in batches (memory efficient)
        def create_sequences_batched(X, y, seq_len, batch_size=20000):
            """Create sequences in batches to avoid memory overflow."""
            all_Xs = []
            all_ys = []
            n_samples = len(X) - seq_len
            
            for start in range(0, n_samples, batch_size):
                end = min(start + batch_size, n_samples)
                batch_X = []
                batch_y = []
                for i in range(start, end):
                    batch_X.append(X[i:i+seq_len])
                    batch_y.append(y[i+seq_len])
                all_Xs.append(np.array(batch_X))
                all_ys.append(np.array(batch_y))
            
            return np.vstack(all_Xs), np.concatenate(all_ys)
        
        X_train_seq, y_train_seq = create_sequences_batched(X_sample, y_sample, seq_length)
        logger.info("lstm_sequences_created", sequences=len(X_train_seq))
        
        # Convert to tensors efficiently (zero copy if possible)
        import gc
        # from_numpy shares memory with float32 array
        X_train_t = torch.from_numpy(X_train_seq).to(device)
        y_train_t = torch.from_numpy(y_train_seq).unsqueeze(1).to(device)
        
        # Free CPU memory explicitly
        del X_train_seq
        del y_train_seq
        del X_sample
        del y_sample
        gc.collect()
        
        train_data = TensorDataset(X_train_t, y_train_t)
        train_loader = DataLoader(train_data, batch_size=256, shuffle=True)
        
        # Bigger model for GPU training (512 hidden, 4 layers)
        hidden_size = 512 if torch.cuda.is_available() else 128
        num_layers = 4 if torch.cuda.is_available() else 3
        
        model = LSTMModel(input_size=X_train.shape[1], hidden_size=hidden_size, num_layers=num_layers).to(device)
        criterion = nn.BCELoss()
        
        # Lower learning rate (0.0001) for fine-grained convergence
        optimizer = torch.optim.Adam(model.parameters(), lr=0.0001, weight_decay=1e-5)
        # Slower decay to allow longer training
        scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=30, gamma=0.8)
        
        # Training loop
        epochs = 100
        best_loss = float('inf')
        patience = 40  # Increased patience for deep learning
        no_improve = 0
        
        for epoch in range(epochs):
            model.train()
            total_loss = 0
            n_batches = 0
            
            for X_batch, y_batch in train_loader:
                # Data is already on device
                optimizer.zero_grad()
                y_pred = model(X_batch)
                loss = criterion(y_pred, y_batch)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                total_loss += loss.item()
                n_batches += 1
            
            scheduler.step()
            avg_loss = total_loss / n_batches
            
            if (epoch + 1) % 5 == 0:
                logger.info("lstm_epoch", epoch=epoch+1, loss=avg_loss, lr=scheduler.get_last_lr()[0])
            
            # Early stopping
            if avg_loss < best_loss:
                best_loss = avg_loss
                no_improve = 0
            else:
                no_improve += 1
            
            if no_improve >= patience:
                logger.info("lstm_early_stop", epoch=epoch+1, best_loss=best_loss)
                break
        
        logger.info("lstm_training_complete", final_loss=best_loss)
        return model.cpu()
    
    def train_all(self, symbols: List[str]) -> Dict:
        """Full training pipeline."""
        logger.info("starting_deep_training", symbols=len(symbols))
        
        # Load data
        df = self.load_all_data(symbols)
        
        # Prepare features and labels
        X, y = self.prepare_training_data(df)
        
        # Time-series split (80% train, 20% validation)
        split_idx = int(len(X) * 0.8)
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        logger.info("data_split", train=len(X_train), val=len(X_val))
        
        # Train models
        results = {}
        
        # XGBoost
        xgb_model = self.train_xgboost(X_train, y_train, X_val, y_val)
        xgb_pred = xgb_model.predict_proba(X_val)[:, 1]
        xgb_auc = roc_auc_score(y_val, xgb_pred)
        results['xgboost'] = {'auc': xgb_auc, 'model': xgb_model}
        logger.info("xgboost_complete", auc=xgb_auc)
        
        # LightGBM
        lgb_model = self.train_lightgbm(X_train, y_train, X_val, y_val)
        lgb_pred = lgb_model.predict_proba(X_val)[:, 1]
        lgb_auc = roc_auc_score(y_val, lgb_pred)
        results['lightgbm'] = {'auc': lgb_auc, 'model': lgb_model}
        logger.info("lightgbm_complete", auc=lgb_auc)
        
        # LSTM (wrapped in try/except - PyTorch can fail)
        try:
            # INCREASED SEQUENCE LENGTH TO 30
            lstm_model = self.train_lstm(X_train, y_train, X_val, y_val, seq_length=30)
            if lstm_model:
                results['lstm'] = {'model': lstm_model}
        except Exception as e:
            logger.warning("lstm_training_failed", error=str(e))
        
        # Ensemble predictions (average of XGB and LGB)
        ensemble_pred = (xgb_pred + lgb_pred) / 2
        ensemble_auc = roc_auc_score(y_val, ensemble_pred)
        results['ensemble'] = {'auc': ensemble_auc}
        logger.info("ensemble_complete", auc=ensemble_auc)
        
        # Save models
        self._save_models(results)
        
        # Final metrics
        final_metrics = {
            'xgboost_auc': xgb_auc,
            'lightgbm_auc': lgb_auc,
            'ensemble_auc': ensemble_auc,
            'train_samples': len(X_train),
            'val_samples': len(X_val),
            'positive_rate': y.mean(),
            'symbols': len(symbols)
        }
        
        return final_metrics
    
    def _save_models(self, results: Dict):
        """Save all trained models."""
        for name, data in results.items():
            if 'model' in data:
                path = os.path.join(self.model_dir, f"{name}_deep_v1.pkl")
                with open(path, 'wb') as f:
                    pickle.dump(data['model'], f)
                logger.info("model_saved", name=name, path=path)
        
        # Save scaler
        scaler_path = os.path.join(self.model_dir, "scaler.pkl")
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Deep ML Training Pipeline")
    parser.add_argument("--symbols", nargs="+", help="Specific symbols (default: all)")
    args = parser.parse_args()
    
    # Get symbols
    if args.symbols:
        symbols = args.symbols
    else:
        symbols = get_all_symbols()
    
    logger.info("deep_training_start", symbols=len(symbols))
    print(f"\n{'='*60}")
    print("DEEP ML TRAINING PIPELINE")
    print(f"{'='*60}")
    print(f"Symbols: {len(symbols)}")
    print(f"Models: XGBoost, LightGBM, LSTM, Ensemble")
    print(f"{'='*60}\n")
    
    # Train
    trainer = DeepTrainer()
    metrics = trainer.train_all(symbols)
    
    # Print results
    print(f"\n{'='*60}")
    print("TRAINING COMPLETE")
    print(f"{'='*60}")
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"{k}: {v:.4f}")
        else:
            print(f"{k}: {v}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
