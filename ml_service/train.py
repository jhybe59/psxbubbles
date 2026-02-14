"""
Training Script
Fetches data, computes features, labels moves, and trains models.
"""
import os
import argparse
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.metrics import classification_report, roc_auc_score, precision_recall_curve
import structlog

from config import settings
from ingest import questdb
from features import feature_engine
from labeler import labeler
from models import XGBoostModel

logger = structlog.get_logger()


def prepare_dataset(
    symbols: list[str],
    start: datetime,
    end: datetime,
    table: str = "minute_bars"
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Prepare training dataset from multiple symbols.
    
    Returns:
        features_df: DataFrame of computed features
        labels_df: DataFrame of move labels
    """
    all_features = []
    all_labels = []
    
    for symbol in symbols:
        logger.info("processing_symbol", symbol=symbol)
        
        # Fetch bars
        df = questdb.fetch_bars(symbol, start, end, table)
        if df.empty:
            logger.warning("no_data", symbol=symbol)
            continue
        
        # Compute features
        df_with_features = feature_engine.compute_features(df, symbol)
        
        # Label moves
        df_labeled = labeler.label_moves(df_with_features, symbol)
        
        # Drop rows with NaN labels (future data not available)
        df_clean = df_labeled.dropna(subset=['move_occurred'])
        
        all_features.append(df_clean)
    
    if not all_features:
        raise ValueError("No data available for training")
    
    combined = pd.concat(all_features)
    logger.info("dataset_prepared", total_rows=len(combined))
    
    return combined


def train_model(
    df: pd.DataFrame,
    model_name: str = "xgb_baseline_v1",
    test_size: float = 0.2
) -> dict:
    """
    Train XGBoost model on prepared dataset.
    
    Returns:
        Dict with metrics and model info
    """
    feature_cols = feature_engine.get_feature_names()
    X = df[feature_cols].values
    y = df['move_occurred'].astype(int).values
    
    # Time-series aware split (don't shuffle)
    split_idx = int(len(X) * (1 - test_size))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    logger.info("data_split", 
                train=len(X_train), 
                test=len(X_test),
                pos_train=y_train.sum(),
                pos_test=y_test.sum())
    
    # Train model
    model = XGBoostModel()
    model.train(X_train, y_train, feature_names=feature_cols)
    
    # Evaluate
    y_pred_proba = model.predict(X_test)
    y_pred = (y_pred_proba >= settings.prediction_threshold).astype(int)
    
    # Metrics
    auc = roc_auc_score(y_test, y_pred_proba)
    report = classification_report(y_test, y_pred, output_dict=True)
    
    # Find optimal threshold
    precision, recall, thresholds = precision_recall_curve(y_test, y_pred_proba)
    f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
    optimal_idx = np.argmax(f1_scores)
    optimal_threshold = thresholds[optimal_idx] if optimal_idx < len(thresholds) else 0.5
    
    metrics = {
        'auc': auc,
        'accuracy': report['accuracy'],
        'precision': report['1']['precision'] if '1' in report else 0,
        'recall': report['1']['recall'] if '1' in report else 0,
        'f1': report['1']['f1-score'] if '1' in report else 0,
        'optimal_threshold': optimal_threshold,
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        'pos_rate': y.mean()
    }
    
    logger.info("training_complete", **metrics)
    
    # Save model
    model_path = os.path.join(settings.model_path, f"{model_name}.pkl")
    model.save(model_path)
    
    return metrics


def main():
    parser = argparse.ArgumentParser(description="Train ML model for move detection")
    parser.add_argument("--days", type=int, default=30, help="Days of historical data")
    parser.add_argument("--symbols", nargs="+", help="Symbols to train on (default: all)")
    parser.add_argument("--model-name", default="xgb_baseline_v1", help="Model name")
    args = parser.parse_args()
    
    # Date range
    end = datetime.now()
    start = end - timedelta(days=args.days)
    
    # Get symbols
    symbols = args.symbols or questdb.get_symbols()
    logger.info("starting_training", symbols=len(symbols), start=start, end=end)
    
    # Prepare and train
    df = prepare_dataset(symbols, start, end)
    metrics = train_model(df, model_name=args.model_name)
    
    print("\n" + "="*50)
    print("TRAINING COMPLETE")
    print("="*50)
    for k, v in metrics.items():
        print(f"{k}: {v:.4f}" if isinstance(v, float) else f"{k}: {v}")


if __name__ == "__main__":
    main()
