"""
Advanced Training Pipeline
Full training workflow with evaluation, feature importance, and model tuning.

Key capabilities:
1. Multiple model types (XGBoost, RandomForest, LightGBM)
2. Hyperparameter tuning (Optuna)
3. Feature importance (SHAP, permutation)
4. Comprehensive evaluation metrics
5. Cross-validation (time-series aware)
6. Model persistence
"""
import os
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal, Optional, Tuple, Dict, Any
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    classification_report, precision_recall_curve, roc_curve
)
from sklearn.model_selection import TimeSeriesSplit
import structlog

from config import settings
from dataset_builder import DatasetBuilder
from advanced_labeling import LabelConfig

logger = structlog.get_logger()


class ModelTrainer:
    """
    Advanced model training with evaluation and tuning.
    """
    
    def __init__(self, model_dir: str = "./models"):
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        self.model = None
        self.model_type = None
        self.training_history = {}
        self.feature_importance = {}
    
    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        model_type: Literal['xgboost', 'random_forest', 'lightgbm'] = 'xgboost',
        feature_names: Optional[list] = None,
        sample_weights: Optional[np.ndarray] = None,
        params: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Train a model with the given data.
        
        Returns:
            Dict with model, metrics, and feature importance
        """
        self.model_type = model_type
        self.feature_names = feature_names or [f"f{i}" for i in range(X_train.shape[1])]
        
        # Default parameters
        default_params = self._get_default_params(model_type)
        if params:
            default_params.update(params)
        
        logger.info("training_start",
                    model=model_type,
                    train_size=len(X_train),
                    val_size=len(X_val),
                    features=len(self.feature_names))
        
        # Create and train model
        if model_type == 'xgboost':
            self.model = self._train_xgboost(X_train, y_train, X_val, y_val, 
                                             default_params, sample_weights)
        elif model_type == 'random_forest':
            self.model = self._train_random_forest(X_train, y_train, 
                                                    default_params, sample_weights)
        elif model_type == 'lightgbm':
            self.model = self._train_lightgbm(X_train, y_train, X_val, y_val,
                                               default_params, sample_weights)
        
        # Evaluate on validation set
        val_metrics = self.evaluate(X_val, y_val)
        
        # Get feature importance
        self.feature_importance = self._get_feature_importance()
        
        logger.info("training_complete", **val_metrics)
        
        return {
            'model': self.model,
            'metrics': val_metrics,
            'feature_importance': self.feature_importance,
            'params': default_params
        }
    
    def _get_default_params(self, model_type: str) -> dict:
        """Get default hyperparameters."""
        if model_type == 'xgboost':
            return {
                'objective': 'binary:logistic',
                'eval_metric': 'auc',
                'max_depth': 6,
                'learning_rate': 0.05,
                'n_estimators': 200,
                'min_child_weight': 3,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'scale_pos_weight': 3,
                'random_state': 42,
                'early_stopping_rounds': 20,
                'verbosity': 0
            }
        elif model_type == 'random_forest':
            return {
                'n_estimators': 200,
                'max_depth': 10,
                'min_samples_split': 10,
                'min_samples_leaf': 5,
                'class_weight': 'balanced',
                'random_state': 42,
                'n_jobs': -1
            }
        elif model_type == 'lightgbm':
            return {
                'objective': 'binary',
                'metric': 'auc',
                'max_depth': 6,
                'learning_rate': 0.05,
                'n_estimators': 200,
                'num_leaves': 31,
                'min_child_samples': 20,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'class_weight': 'balanced',
                'random_state': 42,
                'verbosity': -1
            }
        return {}
    
    def _train_xgboost(self, X_train, y_train, X_val, y_val, params, sample_weights):
        """Train XGBoost model."""
        import xgboost as xgb
        
        early_stopping = params.pop('early_stopping_rounds', 20)
        
        model = xgb.XGBClassifier(**params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            sample_weight=sample_weights,
            verbose=False
        )
        
        return model
    
    def _train_random_forest(self, X_train, y_train, params, sample_weights):
        """Train Random Forest model."""
        model = RandomForestClassifier(**params)
        model.fit(X_train, y_train, sample_weight=sample_weights)
        return model
    
    def _train_lightgbm(self, X_train, y_train, X_val, y_val, params, sample_weights):
        """Train LightGBM model."""
        import lightgbm as lgb
        
        model = lgb.LGBMClassifier(**params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            sample_weight=sample_weights
        )
        
        return model
    
    def evaluate(
        self, 
        X: np.ndarray, 
        y: np.ndarray,
        threshold: float = 0.5
    ) -> Dict[str, float]:
        """
        Comprehensive model evaluation.
        
        Returns metrics dict.
        """
        y_pred_proba = self.model.predict_proba(X)[:, 1]
        y_pred = (y_pred_proba >= threshold).astype(int)
        
        # Core metrics
        metrics = {
            'accuracy': accuracy_score(y, y_pred),
            'precision': precision_score(y, y_pred, zero_division=0),
            'recall': recall_score(y, y_pred, zero_division=0),
            'f1': f1_score(y, y_pred, zero_division=0),
            'roc_auc': roc_auc_score(y, y_pred_proba) if len(np.unique(y)) > 1 else 0,
            'avg_precision': average_precision_score(y, y_pred_proba) if len(np.unique(y)) > 1 else 0,
        }
        
        # Confusion matrix
        tn, fp, fn, tp = confusion_matrix(y, y_pred).ravel()
        metrics['true_positives'] = int(tp)
        metrics['false_positives'] = int(fp)
        metrics['true_negatives'] = int(tn)
        metrics['false_negatives'] = int(fn)
        
        # Additional trading metrics
        if tp + fp > 0:
            metrics['win_rate'] = tp / (tp + fp)  # Of signals given, how many were correct
        else:
            metrics['win_rate'] = 0
        
        # Find optimal threshold
        precision_arr, recall_arr, thresholds = precision_recall_curve(y, y_pred_proba)
        f1_scores = 2 * (precision_arr * recall_arr) / (precision_arr + recall_arr + 1e-8)
        optimal_idx = np.argmax(f1_scores)
        metrics['optimal_threshold'] = float(thresholds[optimal_idx]) if optimal_idx < len(thresholds) else 0.5
        metrics['optimal_f1'] = float(f1_scores[optimal_idx])
        
        return metrics
    
    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from trained model."""
        if self.model is None:
            return {}
        
        try:
            if hasattr(self.model, 'feature_importances_'):
                importances = self.model.feature_importances_
                return dict(sorted(
                    zip(self.feature_names, importances),
                    key=lambda x: x[1],
                    reverse=True
                ))
        except Exception as e:
            logger.warning("feature_importance_error", error=str(e))
        
        return {}
    
    def compute_shap_importance(self, X_sample: np.ndarray) -> Dict[str, float]:
        """
        Compute SHAP values for feature importance.
        More accurate than built-in importance for tree models.
        """
        try:
            import shap
            
            # Use a sample for speed
            if len(X_sample) > 1000:
                idx = np.random.choice(len(X_sample), 1000, replace=False)
                X_sample = X_sample[idx]
            
            explainer = shap.TreeExplainer(self.model)
            shap_values = explainer.shap_values(X_sample)
            
            # For binary classification, shap_values might be a list
            if isinstance(shap_values, list):
                shap_values = shap_values[1]
            
            # Mean absolute SHAP value per feature
            mean_abs_shap = np.abs(shap_values).mean(axis=0)
            
            importance = dict(sorted(
                zip(self.feature_names, mean_abs_shap),
                key=lambda x: x[1],
                reverse=True
            ))
            
            logger.info("shap_computed", top_3=list(importance.keys())[:3])
            return importance
            
        except ImportError:
            logger.warning("shap_not_installed")
            return self.feature_importance
        except Exception as e:
            logger.warning("shap_error", error=str(e))
            return self.feature_importance
    
    def cross_validate(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_splits: int = 5,
        model_type: str = 'xgboost'
    ) -> Dict[str, Any]:
        """
        Time-series aware cross-validation.
        """
        tscv = TimeSeriesSplit(n_splits=n_splits)
        
        fold_metrics = []
        
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]
            
            result = self.train(
                X_train, y_train, X_val, y_val,
                model_type=model_type,
                feature_names=self.feature_names
            )
            
            fold_metrics.append(result['metrics'])
            logger.info(f"fold_{fold+1}_complete", 
                       auc=result['metrics']['roc_auc'],
                       f1=result['metrics']['f1'])
        
        # Aggregate metrics
        aggregated = {}
        for key in fold_metrics[0].keys():
            if isinstance(fold_metrics[0][key], (int, float)):
                values = [m[key] for m in fold_metrics]
                aggregated[f'{key}_mean'] = np.mean(values)
                aggregated[f'{key}_std'] = np.std(values)
        
        return {
            'fold_metrics': fold_metrics,
            'aggregated': aggregated
        }
    
    def save_model(self, name: str) -> Path:
        """Save model and metadata."""
        path = self.model_dir / f"{name}.pkl"
        
        data = {
            'model': self.model,
            'model_type': self.model_type,
            'feature_names': self.feature_names,
            'feature_importance': self.feature_importance,
            'saved_at': datetime.now().isoformat()
        }
        
        with open(path, 'wb') as f:
            pickle.dump(data, f)
        
        logger.info("model_saved", path=str(path))
        return path
    
    def load_model(self, path: str) -> None:
        """Load model from disk."""
        with open(path, 'rb') as f:
            data = pickle.load(f)
        
        self.model = data['model']
        self.model_type = data.get('model_type')
        self.feature_names = data.get('feature_names', [])
        self.feature_importance = data.get('feature_importance', {})
        
        logger.info("model_loaded", path=path)


def run_full_training(
    symbols: Optional[list] = None,
    days: int = 30,
    model_type: str = 'xgboost',
    labeling_method: str = 'triple_barrier'
) -> dict:
    """
    Run full training pipeline.
    
    Returns training results dict.
    """
    # Build dataset
    builder = DatasetBuilder()
    
    end = datetime.now()
    start = end - timedelta(days=days)
    
    if symbols is None:
        symbols = builder.exporter.get_available_symbols()
    
    logger.info("building_dataset", symbols=len(symbols), days=days)
    
    features_df, labels_df, metadata = builder.build_dataset(
        symbols=symbols,
        start=start,
        end=end,
        labeling_method=labeling_method
    )
    
    # Prepare for training
    data = builder.prepare_for_training(
        features_df, labels_df,
        target_col='move_occurred',
        test_size=0.2,
        val_size=0.1,
        scale_features=True,
        handle_imbalance=True
    )
    
    # Train model
    trainer = ModelTrainer()
    result = trainer.train(
        data['X_train'], data['y_train'],
        data['X_val'], data['y_val'],
        model_type=model_type,
        feature_names=data['feature_names'],
        sample_weights=data['sample_weights']
    )
    
    # Evaluate on test set
    test_metrics = trainer.evaluate(data['X_test'], data['y_test'])
    result['test_metrics'] = test_metrics
    
    # SHAP importance (on validation sample)
    shap_importance = trainer.compute_shap_importance(data['X_val'])
    result['shap_importance'] = shap_importance
    
    # Save model
    model_name = f"{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    model_path = trainer.save_model(model_name)
    result['model_path'] = str(model_path)
    
    # Also save as the "current" model
    trainer.save_model(settings.model_name)
    
    return result


# CLI
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Train ML model")
    parser.add_argument("--symbols", nargs="+", help="Symbols (default: all)")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--model", choices=['xgboost', 'random_forest', 'lightgbm'], 
                       default='xgboost')
    parser.add_argument("--labeling", choices=['triple_barrier', 'fixed_horizon'],
                       default='triple_barrier')
    args = parser.parse_args()
    
    result = run_full_training(
        symbols=args.symbols,
        days=args.days,
        model_type=args.model,
        labeling_method=args.labeling
    )
    
    print("\n" + "="*70)
    print("TRAINING COMPLETE")
    print("="*70)
    
    print("\nValidation Metrics:")
    for k, v in result['metrics'].items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")
        else:
            print(f"  {k}: {v}")
    
    print("\nTest Metrics:")
    for k, v in result['test_metrics'].items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")
        else:
            print(f"  {k}: {v}")
    
    print("\nTop 10 Features (SHAP):")
    for i, (feat, imp) in enumerate(list(result['shap_importance'].items())[:10]):
        print(f"  {i+1}. {feat}: {imp:.4f}")
    
    print(f"\nModel saved to: {result['model_path']}")
