"""
Dataset Builder
Creates ML-ready datasets from raw bar data.

Pipeline:
1. Fetch bars from QuestDB
2. Compute features
3. Create labels
4. Handle class imbalance
5. Split train/val/test (time-aware)
6. Export to various formats
"""
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import structlog

from config import settings
from export import DataExporter
from advanced_features import AdvancedFeatureEngine
from advanced_labeling import (
    TripleBarrierLabeler, FixedHorizonLabeler, 
    LabelConfig, create_training_labels, analyze_label_distribution
)

logger = structlog.get_logger()


class DatasetBuilder:
    """
    Builds ML datasets with proper feature engineering and labeling.
    """
    
    def __init__(self, output_dir: str = "./datasets"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.exporter = DataExporter()
        self.feature_engine = AdvancedFeatureEngine()
        self.scaler = StandardScaler()
        
        # Track dataset metadata
        self.metadata = {}
    
    def build_dataset(
        self,
        symbols: list[str],
        start: datetime,
        end: datetime,
        labeling_method: Literal['triple_barrier', 'fixed_horizon'] = 'triple_barrier',
        label_config: Optional[LabelConfig] = None,
        table: str = "minute_bars"
    ) -> Tuple[pd.DataFrame, pd.DataFrame, dict]:
        """
        Build complete dataset.
        
        Args:
            symbols: Symbols to include
            start: Start datetime
            end: End datetime
            labeling_method: How to label moves
            label_config: Labeling configuration
            table: Source table
            
        Returns:
            (features_df, labels_df, metadata)
        """
        all_data = []
        
        for symbol in symbols:
            logger.info("processing_symbol", symbol=symbol)
            
            # Fetch bars
            df = self.exporter.export_bars(symbol, start, end, table, format="dataframe")
            if df is None or df.empty:
                logger.warning("no_data", symbol=symbol)
                continue
            
            # Ensure timestamp index
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df.set_index('timestamp', inplace=True)
            
            # Compute features
            df_features = self.feature_engine.compute_all_features(df, symbol)
            
            # Create labels
            df_labeled = create_training_labels(
                df_features, 
                method=labeling_method,
                config=label_config
            )
            
            # Drop rows with NaN labels
            df_clean = df_labeled.dropna(subset=['label', 'move_occurred'])
            
            if len(df_clean) > 0:
                all_data.append(df_clean)
        
        if not all_data:
            raise ValueError("No data available for dataset building")
        
        # Combine all symbols
        combined = pd.concat(all_data)
        combined = combined.sort_index()
        
        # Separate features and labels
        feature_cols = self.feature_engine.get_feature_names()
        available_features = [f for f in feature_cols if f in combined.columns]
        
        features_df = combined[available_features].copy()
        labels_df = combined[['symbol', 'label', 'label_direction', 
                              'label_magnitude', 'move_occurred']].copy()
        
        # Analyze label distribution
        label_stats = analyze_label_distribution(combined)
        
        # Metadata
        self.metadata = {
            'symbols': symbols,
            'start': str(start),
            'end': str(end),
            'total_samples': len(combined),
            'features': available_features,
            'labeling_method': labeling_method,
            'label_stats': label_stats,
            'created_at': datetime.now().isoformat()
        }
        
        logger.info("dataset_built",
                    samples=len(combined),
                    features=len(available_features),
                    move_rate=label_stats.get('move_rate', 0))
        
        return features_df, labels_df, self.metadata
    
    def prepare_for_training(
        self,
        features_df: pd.DataFrame,
        labels_df: pd.DataFrame,
        target_col: str = 'move_occurred',
        test_size: float = 0.2,
        val_size: float = 0.1,
        scale_features: bool = True,
        handle_imbalance: bool = True
    ) -> dict:
        """
        Prepare data for model training.
        
        Uses time-aware splits (no shuffling) to prevent lookahead bias.
        
        Returns:
            Dict with X_train, X_val, X_test, y_train, y_val, y_test
        """
        X = features_df.values
        y = labels_df[target_col].values
        
        n = len(X)
        test_idx = int(n * (1 - test_size))
        val_idx = int(test_idx * (1 - val_size / (1 - test_size)))
        
        # Time-aware split (chronological)
        X_train = X[:val_idx]
        y_train = y[:val_idx]
        
        X_val = X[val_idx:test_idx]
        y_val = y[val_idx:test_idx]
        
        X_test = X[test_idx:]
        y_test = y[test_idx:]
        
        logger.info("data_split",
                    train=len(X_train),
                    val=len(X_val),
                    test=len(X_test))
        
        # Scale features
        if scale_features:
            X_train = self.scaler.fit_transform(X_train)
            X_val = self.scaler.transform(X_val)
            X_test = self.scaler.transform(X_test)
        
        # Handle class imbalance (compute sample weights)
        sample_weights = None
        if handle_imbalance:
            pos_count = y_train.sum()
            neg_count = len(y_train) - pos_count
            if pos_count > 0 and neg_count > 0:
                pos_weight = neg_count / pos_count
                sample_weights = np.where(y_train == 1, pos_weight, 1.0)
                logger.info("class_weights", 
                           pos_weight=round(pos_weight, 2),
                           pos_count=int(pos_count),
                           neg_count=int(neg_count))
        
        return {
            'X_train': X_train,
            'X_val': X_val,
            'X_test': X_test,
            'y_train': y_train,
            'y_val': y_val,
            'y_test': y_test,
            'sample_weights': sample_weights,
            'feature_names': features_df.columns.tolist(),
            'scaler': self.scaler if scale_features else None
        }
    
    def save_dataset(
        self,
        features_df: pd.DataFrame,
        labels_df: pd.DataFrame,
        name: str = "dataset",
        format: Literal['parquet', 'csv', 'pickle'] = 'parquet'
    ) -> Path:
        """Save dataset to disk."""
        combined = pd.concat([features_df, labels_df], axis=1)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{timestamp}"
        
        if format == 'parquet':
            path = self.output_dir / f"{filename}.parquet"
            combined.to_parquet(path)
        elif format == 'csv':
            path = self.output_dir / f"{filename}.csv"
            combined.to_csv(path)
        else:
            path = self.output_dir / f"{filename}.pkl"
            combined.to_pickle(path)
        
        # Save metadata
        import json
        meta_path = self.output_dir / f"{filename}_meta.json"
        with open(meta_path, 'w') as f:
            json.dump(self.metadata, f, indent=2, default=str)
        
        logger.info("dataset_saved", path=str(path), meta=str(meta_path))
        return path
    
    def load_dataset(self, path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Load dataset from disk."""
        path = Path(path)
        
        if path.suffix == '.parquet':
            df = pd.read_parquet(path)
        elif path.suffix == '.csv':
            df = pd.read_csv(path, index_col=0, parse_dates=True)
        else:
            df = pd.read_pickle(path)
        
        # Separate features and labels
        label_cols = ['symbol', 'label', 'label_direction', 'label_magnitude', 'move_occurred']
        label_cols_present = [c for c in label_cols if c in df.columns]
        feature_cols = [c for c in df.columns if c not in label_cols]
        
        features_df = df[feature_cols]
        labels_df = df[label_cols_present] if label_cols_present else pd.DataFrame()
        
        return features_df, labels_df


# CLI
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Build ML dataset")
    parser.add_argument("--symbols", nargs="+", help="Symbols (default: all)")
    parser.add_argument("--days", type=int, default=30, help="Days of history")
    parser.add_argument("--method", choices=['triple_barrier', 'fixed_horizon'], 
                       default='triple_barrier')
    parser.add_argument("--output", default="./datasets")
    args = parser.parse_args()
    
    builder = DatasetBuilder(output_dir=args.output)
    
    end = datetime.now()
    start = end - timedelta(days=args.days)
    
    # Get symbols
    symbols = args.symbols or builder.exporter.get_available_symbols()
    
    # Build dataset
    features_df, labels_df, metadata = builder.build_dataset(
        symbols=symbols,
        start=start,
        end=end,
        labeling_method=args.method
    )
    
    # Print stats
    print("\n" + "="*60)
    print("DATASET STATISTICS")
    print("="*60)
    print(f"Total samples: {metadata['total_samples']}")
    print(f"Features: {len(metadata['features'])}")
    print(f"Labeling: {metadata['labeling_method']}")
    print(f"\nLabel Distribution:")
    for k, v in metadata['label_stats'].items():
        if isinstance(v, float):
            print(f"  {k}: {v:.2f}")
        else:
            print(f"  {k}: {v}")
    
    # Save
    path = builder.save_dataset(features_df, labels_df)
    print(f"\nDataset saved to: {path}")
