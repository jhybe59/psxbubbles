"""
Deep Learning Feature Engineering
Exact replica of the feature engineering logic used in deep_train.py.
Crucial for ensuring model inference inputs match training data.
"""
import numpy as np
import pandas as pd
from typing import List
import structlog

logger = structlog.get_logger()

class DeepFeatureEngine:
    """Same logic as AdvancedFeatureEngine in deep_train.py to ensure parity."""
    
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
        
        # Clean up
        df = df.replace([np.inf, -np.inf], np.nan)
        # Handle Nans forward fill then 0
        df = df.fillna(method='ffill').fillna(0)
        
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
