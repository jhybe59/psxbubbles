"""
Intelligence System
Main orchestrator for the multi-agent ML system.

Combines:
- Deep learning models (LSTM, Transformer, CNN)
- Multiple agents (Volume, Volatility, Momentum, Flow, Regime)
- Ensemble fusion
- Decision engine
"""
import pandas as pd
import numpy as np
from typing import Optional, Dict, List
from pathlib import Path
import structlog

# Deep models
from deep_models.lstm_model import LSTMModel
from deep_features import DeepFeatureEngine

# Third-party
import xgboost as xgb
import lightgbm as lgb
import pickle
import torch

# Agents
from agents import (
    VolumeAgent, VolatilityAgent, MomentumAgent,
    FlowAgent, RegimeAgent, AgentConfig
)

# Fusion
from fusion import (
    EnsembleEngine, DecisionEngine, RiskConfig
)

# Features
from advanced_features import AdvancedFeatureEngine

logger = structlog.get_logger()


class IntelligenceSystem:
    """
    Complete Market Intelligence System.
    
    Orchestrates:
    1. Feature computation
    2. Agent analysis
    3. Signal fusion
    4. Decision making
    """
    
    def __init__(
        self,
        model_dir: str = "./models",
        config: Optional[AgentConfig] = None,
        risk_config: Optional[RiskConfig] = None
    ):
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        # Feature engine
        self.feature_engine = AdvancedFeatureEngine()
        
        # Initialize agents
        self.agents = [
            VolumeAgent(config),
            VolatilityAgent(config),
            MomentumAgent(config),
            FlowAgent(config),
            RegimeAgent(config)
        ]
        
        # Ensemble
        self.ensemble = EnsembleEngine(self.agents)
        
        # Decision engine
        self.decision_engine = DecisionEngine(risk_config)
        
        # Deep models (loaded when available)
        self.lstm_model = None
        self.xgb_model = None
        self.lgbm_model = None
        self.scaler = None
        self.deep_feature_engine = DeepFeatureEngine()
        
        # State
        self.is_trained = False
        self.symbol_data: Dict[str, pd.DataFrame] = {}
    
    def train(self, df: pd.DataFrame) -> None:
        """
        Train all components on historical data.
        """
        logger.info("training_intelligence_system", rows=len(df))
        
        # Compute features
        df_features = self.feature_engine.compute_all_features(df, "training")
        
        # Train all agents
        self.ensemble.train_all_agents(df_features)
        
        # Train regime detector separately
        for agent in self.agents:
            if isinstance(agent, RegimeAgent):
                agent.train(df_features)
        
        self.is_trained = True
        logger.info("intelligence_system_trained")
    
    def analyze(
        self,
        symbol: str,
        df: pd.DataFrame,
        current_price: Optional[float] = None,
        current_position: float = 0
    ) -> dict:
        """
        Full analysis pipeline.
        
        Returns:
            Dict with signal, decision, and agent breakdown
        """
        if df.empty:
            return {'error': 'No data'}
        
        # Compute features
        df_features = self.feature_engine.compute_all_features(df, symbol)
        
        if df_features.empty:
            return {'error': 'Feature computation failed'}
        
        # Store for reference
        self.symbol_data[symbol] = df_features
        
        # Deep Learning Inference
        deep_signals = {}
        try:
            if self.scaler:
                 # 1. Compute Deep Features
                df_deep = self.deep_feature_engine.compute_features(df)
                feature_cols = self.deep_feature_engine.get_feature_columns()
                
                # Ensure we have enough data (30 for LSTM)
                if len(df_deep) >= 30:
                    # Scale
                    X_raw = df_deep[feature_cols].tail(30).values
                    X_scaled = self.scaler.transform(X_raw)
                    
                    # Latest row for XGB/LGBM
                    X_latest = X_scaled[-1].reshape(1, -1)
                    
                    # XGBoost
                    if self.xgb_model:
                        prob = self.xgb_model.predict_proba(X_latest)[0][1]
                        deep_signals['xgboost'] = prob
                        
                    # LightGBM
                    if self.lgbm_model:
                        prob = self.lgbm_model.predict_proba(X_latest)[0][1]
                        deep_signals['lightgbm'] = prob
                    
                    # LSTM
                    if self.lstm_model:
                        # Shape: (1, 30, features)
                        X_seq = torch.tensor(X_scaled, dtype=torch.float32).unsqueeze(0)
                        with torch.no_grad():
                            out = self.lstm_model(X_seq)
                            deep_signals['lstm'] = float(out['probability'].item())
                            
                    logger.info("deep_inference", symbol=symbol, signals=deep_signals)
                    
        except Exception as e:
            logger.warning("deep_inference_failed", symbol=symbol, error=str(e))

        # Get fused signal from agents (now including deep signals)
        fused_signal = self.ensemble.fuse_signals(df_features, deep_signals=deep_signals)
        
        # Get current ATR for stops
        atr = df_features['atr_14'].iloc[-1] if 'atr_14' in df_features.columns else 0
        
        # Make decision
        if current_price is None:
            current_price = df_features['close'].iloc[-1]
        
        decision = self.decision_engine.make_decision(
            signal=fused_signal,
            symbol=symbol,
            current_price=current_price,
            atr=atr,
            current_position=current_position
        )
        
        return {
            'symbol': symbol,
            'signal': fused_signal.to_dict(),
            'decision': decision.to_dict(),
            'current_price': current_price,
            'atr': float(atr),
            'volatility_20': float(df_features['volatility_20'].iloc[-1]) if 'volatility_20' in df_features.columns else 0.0,
            'features_computed': len(df_features.columns)
        }
    
    def quick_signal(self, symbol: str, df: pd.DataFrame) -> dict:
        """
        Quick signal without full decision logic.
        Good for scanning multiple symbols.
        """
        if df.empty:
            return {'symbol': symbol, 'signal': 0, 'confidence': 0, 'action': 'hold'}
        
        try:
            df_features = self.feature_engine.compute_all_features(df, symbol)
            fused = self.ensemble.fuse_signals(df_features)
            
            return {
                'symbol': symbol,
                'signal': fused.signal_strength,
                'confidence': fused.confidence,
                'direction': fused.direction,
                'regime': fused.regime,
                'action': fused.action
            }
        except Exception as e:
            logger.warning("quick_signal_failed", symbol=symbol, error=str(e))
            return {'symbol': symbol, 'signal': 0, 'confidence': 0, 'action': 'error'}
    
    def scan_symbols(self, data_dict: Dict[str, pd.DataFrame]) -> List[dict]:
        """
        Scan multiple symbols and return ranked signals.
        """
        results = []
        
        for symbol, df in data_dict.items():
            signal = self.quick_signal(symbol, df)
            results.append(signal)
        
        # Sort by absolute signal strength
        results.sort(key=lambda x: abs(x.get('signal', 0)) * x.get('confidence', 0), reverse=True)
        
        return results
    
    def get_agent_status(self) -> dict:
        """Get status of all agents."""
        return {
            agent.name: {
                'is_trained': agent.is_trained,
                'last_signal': agent.last_signal.to_dict() if agent.last_signal else None
            }
            for agent in self.agents
        }
    
    def save(self, name: str = "intelligence_system") -> Path:
        """Save system state."""
        import pickle
        
        path = self.model_dir / f"{name}.pkl"
        
        # Save agents and ensemble
        state = {
            'ensemble_weights': self.ensemble.weights,
            'is_trained': self.is_trained
        }
        
        # Save regime detector
        for agent in self.agents:
            if isinstance(agent, RegimeAgent) and agent.detector.fitted:
                agent.detector.save(str(self.model_dir / "regime_detector.pkl"))
        
        with open(path, 'wb') as f:
            pickle.dump(state, f)
        
        logger.info("intelligence_system_saved", path=str(path))
        return path
    
    def load(self, name: str = "intelligence_system") -> None:
        """Load system state."""
        import pickle
        
        path = self.model_dir / f"{name}.pkl"
        
        if path.exists():
            with open(path, 'rb') as f:
                state = pickle.load(f)
            
            self.ensemble.weights = state.get('ensemble_weights', self.ensemble.weights)
            self.is_trained = state.get('is_trained', False)
        
        # Load Deep Models
        try:
            # Scaler
            scaler_path = self.model_dir / "scaler.pkl"
            if scaler_path.exists():
                with open(scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                logger.info("scaler_loaded")
            
            # XGBoost
            xgb_path = self.model_dir / "xgboost_deep_v1.pkl"
            if xgb_path.exists():
                with open(xgb_path, 'rb') as f:
                    self.xgb_model = pickle.load(f)
                logger.info("xgboost_loaded")
                
            # LightGBM
            lgb_path = self.model_dir / "lightgbm_deep_v1.pkl"
            if lgb_path.exists():
                with open(lgb_path, 'rb') as f:
                    self.lgbm_model = pickle.load(f)
                logger.info("lightgbm_loaded")
            
            # LSTM
            lstm_path = self.model_dir / "lstm_deep_v1.pkl"
            
            if lstm_path.exists():
                try:
                    # Fix for pickle namespace issue (saved as __main__.LSTMModel)
                    import sys
                    if not hasattr(sys.modules['__main__'], 'LSTMModel'):
                        sys.modules['__main__'].LSTMModel = LSTMModel
                        
                    with open(lstm_path, 'rb') as f:
                        self.lstm_model = pickle.load(f)
                    
                    if hasattr(self.lstm_model, 'eval'):
                        self.lstm_model.eval()
                    
                    logger.info("lstm_loaded")
                except Exception as e_:
                    logger.error("lstm_load_failed", error=str(e_))
                
        except Exception as e:
            logger.error("model_load_failed", error=str(e))

        logger.info("intelligence_system_loaded")


# Singleton instance
intelligence_system = IntelligenceSystem()
