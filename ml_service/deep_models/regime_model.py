"""
Regime Detection Model
Unsupervised learning for market state identification.

Market States:
- Accumulation
- Manipulation
- Expansion
- Distribution
- Chop
- Trend
- Mean Reversion
- Breakout
"""
import numpy as np
import pandas as pd
from typing import Optional, Tuple, List
from sklearn.mixture import GaussianMixture
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import structlog

logger = structlog.get_logger()


class RegimeDetector:
    """
    Unsupervised market regime detection.
    
    Combines multiple approaches:
    1. Gaussian Mixture Model on volatility/trend features
    2. Hidden Markov Model for state transitions
    3. Volatility regime clustering
    """
    
    REGIME_NAMES = [
        'accumulation',
        'manipulation',
        'expansion', 
        'distribution',
        'chop',
        'trend',
        'mean_reversion',
        'breakout'
    ]
    
    def __init__(self, n_regimes: int = 8):
        self.n_regimes = n_regimes
        self.gmm = GaussianMixture(
            n_components=n_regimes,
            covariance_type='full',
            n_init=5,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.fitted = False
        
        # Volatility regime model (simpler, 3-state)
        self.vol_model = KMeans(n_clusters=3, random_state=42, n_init=10)
        
        # Feature names for regime detection
        self.regime_features = [
            'volatility_20',
            'atr_expansion',
            'volume_trend',
            'momentum_ratio',
            'rsi_14_norm',
            'bb_squeeze',
            'adx'
        ]
    
    def extract_regime_features(self, df: pd.DataFrame) -> np.ndarray:
        """Extract features relevant for regime detection."""
        available = [f for f in self.regime_features if f in df.columns]
        
        if len(available) < 3:
            logger.warning("insufficient_regime_features", available=available)
            # Use basic features
            basic_features = ['return_1', 'volatility_5', 'volume_delta']
            available = [f for f in basic_features if f in df.columns]
        
        return df[available].fillna(0).values
    
    def fit(self, df: pd.DataFrame) -> 'RegimeDetector':
        """Fit regime model on historical data."""
        X = self.extract_regime_features(df)
        X_scaled = self.scaler.fit_transform(X)
        
        self.gmm.fit(X_scaled)
        
        # Fit volatility model on just volatility
        if 'volatility_20' in df.columns:
            vol_data = df['volatility_20'].fillna(df['volatility_20'].median()).values.reshape(-1, 1)
            self.vol_model.fit(vol_data)
        
        self.fitted = True
        logger.info("regime_model_fitted", samples=len(df), n_regimes=self.n_regimes)
        
        return self
    
    def predict(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict market regime.
        
        Returns:
            (regime_labels, regime_probabilities)
        """
        if not self.fitted:
            raise ValueError("Model not fitted. Call fit() first.")
        
        X = self.extract_regime_features(df)
        X_scaled = self.scaler.transform(X)
        
        labels = self.gmm.predict(X_scaled)
        probs = self.gmm.predict_proba(X_scaled)
        
        return labels, probs
    
    def predict_single(self, features: np.ndarray) -> dict:
        """Predict regime for single sample."""
        if not self.fitted:
            raise ValueError("Model not fitted")
        
        X = features.reshape(1, -1)
        X_scaled = self.scaler.transform(X)
        
        label = self.gmm.predict(X_scaled)[0]
        probs = self.gmm.predict_proba(X_scaled)[0]
        
        return {
            'regime': int(label),
            'regime_name': self.REGIME_NAMES[label % len(self.REGIME_NAMES)],
            'regime_probs': probs.tolist(),
            'confidence': float(probs.max())
        }
    
    def get_volatility_regime(self, df: pd.DataFrame) -> np.ndarray:
        """Get simple volatility regime (low/medium/high)."""
        if 'volatility_20' not in df.columns:
            return np.zeros(len(df))
        
        vol_data = df['volatility_20'].fillna(df['volatility_20'].median()).values.reshape(-1, 1)
        return self.vol_model.predict(vol_data)
    
    def get_transition_matrix(self, labels: np.ndarray) -> np.ndarray:
        """Compute regime transition probabilities."""
        n = self.n_regimes
        transitions = np.zeros((n, n))
        
        for i in range(len(labels) - 1):
            current = labels[i]
            next_state = labels[i + 1]
            transitions[current, next_state] += 1
        
        # Normalize rows
        row_sums = transitions.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1
        transitions = transitions / row_sums
        
        return transitions
    
    def save(self, path: str):
        """Save models."""
        import pickle
        with open(path, 'wb') as f:
            pickle.dump({
                'gmm': self.gmm,
                'scaler': self.scaler,
                'vol_model': self.vol_model,
                'fitted': self.fitted,
                'n_regimes': self.n_regimes,
                'regime_features': self.regime_features
            }, f)
        logger.info("regime_model_saved", path=path)
    
    def load(self, path: str):
        """Load models."""
        import pickle
        with open(path, 'rb') as f:
            data = pickle.load(f)
        
        self.gmm = data['gmm']
        self.scaler = data['scaler']
        self.vol_model = data['vol_model']
        self.fitted = data['fitted']
        self.n_regimes = data['n_regimes']
        self.regime_features = data['regime_features']
        
        logger.info("regime_model_loaded", path=path)


class HMMRegimeDetector:
    """
    Hidden Markov Model for regime detection.
    Captures state transition dynamics.
    """
    
    def __init__(self, n_states: int = 5):
        self.n_states = n_states
        self.model = None
        self.scaler = StandardScaler()
        self.fitted = False
    
    def fit(self, df: pd.DataFrame) -> 'HMMRegimeDetector':
        """Fit HMM on volatility and returns data."""
        try:
            from hmmlearn import hmm
            
            # Features for HMM
            features = ['return_1', 'volatility_5']
            available = [f for f in features if f in df.columns]
            
            if len(available) < 1:
                logger.warning("hmm_no_features")
                return self
            
            X = df[available].fillna(0).values
            X_scaled = self.scaler.fit_transform(X)
            
            self.model = hmm.GaussianHMM(
                n_components=self.n_states,
                covariance_type='full',
                n_iter=100,
                random_state=42
            )
            self.model.fit(X_scaled)
            self.fitted = True
            
            logger.info("hmm_fitted", n_states=self.n_states)
            
        except ImportError:
            logger.warning("hmmlearn_not_installed")
        
        return self
    
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """Predict hidden states."""
        if not self.fitted or self.model is None:
            return np.zeros(len(df))
        
        features = ['return_1', 'volatility_5']
        available = [f for f in features if f in df.columns]
        
        X = df[available].fillna(0).values
        X_scaled = self.scaler.transform(X)
        
        return self.model.predict(X_scaled)


# Singleton instance
regime_detector = RegimeDetector()
