"""
Feature Engineering Module
Computes technical indicators and microstructure features.
"""
import numpy as np
import pandas as pd
import pandas_ta as ta
import structlog

from schemas import FeatureVector, BarData
from config import settings

logger = structlog.get_logger()


class FeatureEngine:
    """Computes features from OHLCV data."""
    
    def __init__(self, window: int = 20):
        self.window = window
    
    def compute_features(self, df: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """
        Compute all features for a DataFrame of bars.
        
        Args:
            df: DataFrame with OHLCV columns, indexed by timestamp
            symbol: Symbol name
            
        Returns:
            DataFrame with feature columns added
        """
        df = df.copy()
        
        # ====== RETURNS ======
        df['return_1'] = df['close'].pct_change(1)
        df['return_5'] = df['close'].pct_change(5)
        df['return_10'] = df['close'].pct_change(10)
        
        # ====== VOLATILITY ======
        df['atr_14'] = ta.atr(df['high'], df['low'], df['close'], length=14)
        df['volatility_20'] = df['return_1'].rolling(20).std()
        
        # ====== VOLUME ======
        df['volume_sma_20'] = df['volume'].rolling(20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma_20'].replace(0, np.nan)
        
        # VWAP (requires cumulative within day - simplified here)
        df['vwap'] = (df['close'] * df['volume']).cumsum() / df['volume'].cumsum()
        df['vwap_deviation'] = (df['close'] - df['vwap']) / df['vwap']
        
        # ====== TECHNICAL INDICATORS ======
        df['rsi_14'] = ta.rsi(df['close'], length=14)
        
        # MACD
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        if macd is not None and 'MACDh_12_26_9' in macd.columns:
            df['macd_signal'] = macd['MACDh_12_26_9']  # Histogram = MACD - Signal
        else:
            df['macd_signal'] = 0.0
        
        # Bollinger Bands position
        bb = ta.bbands(df['close'], length=20, std=2)
        if bb is not None and len(bb.columns) >= 3:
            # Find lower and upper columns dynamically
            lower_col = [c for c in bb.columns if 'BBL' in c]
            upper_col = [c for c in bb.columns if 'BBU' in c]
            if lower_col and upper_col:
                lower = bb[lower_col[0]]
                upper = bb[upper_col[0]]
                df['bb_position'] = (df['close'] - lower) / (upper - lower).replace(0, np.nan)
            else:
                df['bb_position'] = 0.5
        else:
            df['bb_position'] = 0.5
        
        # ====== CLEAN UP ======
        df['symbol'] = symbol
        df = df.dropna()
        
        logger.info("features_computed", symbol=symbol, rows=len(df))
        return df
    
    def to_feature_vectors(self, df: pd.DataFrame) -> list[FeatureVector]:
        """Convert DataFrame to list of FeatureVector schemas."""
        vectors = []
        for idx, row in df.iterrows():
            vectors.append(FeatureVector(
                symbol=row['symbol'],
                timestamp=idx,
                return_1=row['return_1'],
                return_5=row['return_5'],
                return_10=row['return_10'],
                atr_14=row['atr_14'],
                volatility_20=row['volatility_20'],
                volume_ratio=row['volume_ratio'],
                vwap_deviation=row['vwap_deviation'],
                rsi_14=row['rsi_14'],
                macd_signal=row['macd_signal'],
                bb_position=row['bb_position']
            ))
        return vectors
    
    def get_feature_names(self) -> list[str]:
        """Return ordered list of feature column names for model input."""
        return [
            'return_1', 'return_5', 'return_10',
            'atr_14', 'volatility_20',
            'volume_ratio', 'vwap_deviation',
            'rsi_14', 'macd_signal', 'bb_position'
        ]


# Convenience instance
feature_engine = FeatureEngine(window=settings.feature_window)
