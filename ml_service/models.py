"""
Model Definitions
Supports XGBoost baseline and PyTorch deep models.
"""
import os
import pickle
from abc import ABC, abstractmethod
from typing import Optional
import numpy as np
import pandas as pd
import structlog

from config import settings
from schemas import PredictionResponse, FeatureVector

logger = structlog.get_logger()


class BaseModel(ABC):
    """Abstract base class for all models."""
    
    @abstractmethod
    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        """Train the model."""
        pass
    
    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return probability predictions."""
        pass
    
    @abstractmethod
    def save(self, path: str) -> None:
        """Save model to disk."""
        pass
    
    @abstractmethod
    def load(self, path: str) -> None:
        """Load model from disk."""
        pass


class XGBoostModel(BaseModel):
    """XGBoost gradient boosting classifier."""
    
    def __init__(self, **params):
        try:
            import xgboost as xgb
            self.xgb = xgb
        except ImportError:
            logger.error("xgboost not installed")
            raise
        
        default_params = {
            'objective': 'binary:logistic',
            'eval_metric': 'auc',
            'max_depth': 6,
            'learning_rate': 0.1,
            'n_estimators': 100,
            'scale_pos_weight': 5,  # Handle class imbalance
            'random_state': 42
        }
        default_params.update(params)
        self.model = self.xgb.XGBClassifier(**default_params)
        self.feature_names: Optional[list[str]] = None
    
    def train(self, X: np.ndarray, y: np.ndarray, feature_names: Optional[list[str]] = None) -> None:
        """Train the XGBoost classifier."""
        self.feature_names = feature_names
        self.model.fit(X, y)
        logger.info("model_trained", model="xgboost", samples=len(y))
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return probability of positive class (move occurring)."""
        return self.model.predict_proba(X)[:, 1]
    
    def predict_single(self, features: FeatureVector) -> PredictionResponse:
        """Predict for a single feature vector."""
        from features import feature_engine
        
        # Convert to array
        feature_dict = features.model_dump()
        X = np.array([[feature_dict[name] for name in feature_engine.get_feature_names()]])
        
        prob = self.predict(X)[0]
        
        # Determine direction (simplified - would need direction model in practice)
        direction = "up" if feature_dict['return_1'] > 0 else "down" if feature_dict['return_1'] < 0 else "neutral"
        
        # Signal strength
        if prob >= 0.8:
            strength = "strong"
        elif prob >= 0.6:
            strength = "moderate"
        else:
            strength = "weak"
        
        # Feature importance (if available)
        top_features = {}
        if hasattr(self.model, 'feature_importances_') and self.feature_names:
            importances = self.model.feature_importances_
            sorted_idx = np.argsort(importances)[::-1][:3]
            for idx in sorted_idx:
                top_features[self.feature_names[idx]] = float(importances[idx])
        
        return PredictionResponse(
            symbol=features.symbol,
            timestamp=features.timestamp,
            move_probability=float(prob),
            direction=direction,
            confidence=float(prob),
            signal_strength=strength,
            top_features=top_features,
            recommended_action="alert" if prob >= settings.prediction_threshold else "hold"
        )
    
    def save(self, path: str) -> None:
        """Save model to disk."""
        os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump({'model': self.model, 'feature_names': self.feature_names}, f)
        logger.info("model_saved", path=path)
    
    def load(self, path: str) -> None:
        """Load model from disk."""
        with open(path, 'rb') as f:
            data = pickle.load(f)
            self.model = data['model']
            self.feature_names = data.get('feature_names')
        logger.info("model_loaded", path=path)


class ModelRegistry:
    """Registry for loading and caching models."""
    
    def __init__(self):
        self._models: dict[str, BaseModel] = {}
    
    def get(self, name: str) -> Optional[BaseModel]:
        """Get a loaded model by name."""
        if name not in self._models:
            path = os.path.join(settings.model_path, f"{name}.pkl")
            if os.path.exists(path):
                model = XGBoostModel()
                model.load(path)
                self._models[name] = model
            else:
                logger.warning("model_not_found", name=name, path=path)
                return None
        return self._models[name]
    
    def register(self, name: str, model: BaseModel) -> None:
        """Register a model."""
        self._models[name] = model


# Global registry
model_registry = ModelRegistry()
