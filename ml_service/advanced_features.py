"""
Advanced Feature Engineering
Comprehensive feature set for market move prediction.

Features organized by category:
1. Price Momentum & Returns
2. Volatility Measures
3. Volume Analysis
4. Technical Indicators
5. Microstructure Features
6. Order Flow / Imbalance
"""
import numpy as np
import pandas as pd
import pandas_ta as ta
from typing import Optional
import structlog

from config import settings

logger = structlog.get_logger()


class AdvancedFeatureEngine:
    """
    Comprehensive feature extraction for ML models.
    
    All features are normalized/standardized for model input.
    Features are designed to be predictive of future price moves.
    """
    
    def __init__(self, window: int = 20):
        self.window = window
        self._feature_names = None
    
    def compute_all_features(
        self, 
        df: pd.DataFrame, 
        symbol: str,
        include_microstructure: bool = False
    ) -> pd.DataFrame:
        """
        Compute comprehensive feature set.
        
        Args:
            df: DataFrame with OHLCV columns, indexed by timestamp
            symbol: Symbol name
            include_microstructure: Include order book features if available
            
        Returns:
            DataFrame with all computed features
        """
        df = df.copy()
        
        # ============ 1. PRICE MOMENTUM & RETURNS ============
        df = self._compute_returns(df)
        df = self._compute_momentum(df)
        
        # ============ 2. VOLATILITY MEASURES ============
        df = self._compute_volatility(df)
        
        # ============ 3. VOLUME ANALYSIS ============
        df = self._compute_volume_features(df)
        
        # ============ 4. TECHNICAL INDICATORS ============
        df = self._compute_technical_indicators(df)
        
        # ============ 5. MICROSTRUCTURE (if available) ============
        if include_microstructure and 'spread' in df.columns:
            df = self._compute_microstructure(df)
        
        # ============ 6. ORDER FLOW / IMBALANCE ============
        df = self._compute_order_flow(df)
        
        # ============ 7. TIME FEATURES ============
        df = self._compute_time_features(df)
        
        # Add symbol
        df['symbol'] = symbol
        
        # Debug: Trace data flow
        debug_compute = False
        if debug_compute:
            logger.info("feature_compute_start", symbol=symbol, input_rows=len(df))
        
        # Drop NaN rows
        df = df.dropna()
        
        logger.info("advanced_features_computed", 
                    symbol=symbol, 
                    rows=len(df),
                    features=len(self.get_feature_names()))
        
        return df
    
    def _compute_returns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Multi-horizon returns."""
        horizons = [1, 2, 3, 5, 10, 20]
        
        for h in horizons:
            df[f'return_{h}'] = df['close'].pct_change(h)
        
        # Log returns (more normal distribution)
        df['log_return_1'] = np.log(df['close'] / df['close'].shift(1))
        df['log_return_5'] = np.log(df['close'] / df['close'].shift(5))
        
        # Cumulative return over session
        df['cum_return'] = df['close'] / df['close'].iloc[0] - 1 if len(df) > 0 else 0
        
        return df
    
    def _compute_momentum(self, df: pd.DataFrame) -> pd.DataFrame:
        """Momentum and acceleration features."""
        # Simple momentum
        df['momentum_5'] = df['close'] - df['close'].shift(5)
        df['momentum_10'] = df['close'] - df['close'].shift(10)
        df['momentum_20'] = df['close'] - df['close'].shift(20)
        
        # Rate of change
        df['roc_5'] = ta.roc(df['close'], length=5)
        df['roc_10'] = ta.roc(df['close'], length=10)
        
        # Acceleration (momentum of momentum)
        df['acceleration'] = df['momentum_5'] - df['momentum_5'].shift(1)
        
        # Momentum ratio (short vs long)
        mom_20 = df['momentum_20'].replace(0, np.nan)
        df['momentum_ratio'] = df['momentum_5'] / mom_20
        
        return df
    
    def _compute_volatility(self, df: pd.DataFrame) -> pd.DataFrame:
        """Volatility measures."""
        # ATR (Average True Range)
        df['atr_7'] = ta.atr(df['high'], df['low'], df['close'], length=7)
        df['atr_14'] = ta.atr(df['high'], df['low'], df['close'], length=14)
        df['atr_20'] = ta.atr(df['high'], df['low'], df['close'], length=20)
        
        # Normalized ATR (ATR / Price)
        df['natr_14'] = df['atr_14'] / df['close'] * 100
        
        # Historical volatility (std of returns)
        df['volatility_5'] = df['return_1'].rolling(5).std()
        df['volatility_10'] = df['return_1'].rolling(10).std()
        df['volatility_20'] = df['return_1'].rolling(20).std()
        
        # Volatility ratio (current vs historical)
        vol_20 = df['volatility_20'].replace(0, np.nan)
        df['volatility_ratio'] = df['volatility_5'] / vol_20
        
        # Parkinson volatility (using High-Low)
        df['parkinson_vol'] = np.sqrt(
            np.log(df['high'] / df['low']) ** 2 / (4 * np.log(2))
        ).rolling(10).mean()
        
        # ATR expansion/contraction
        df['atr_expansion'] = df['atr_14'] / df['atr_14'].rolling(10).mean()
        
        return df
    
    def _compute_volume_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Volume analysis features."""
        # Volume moving averages
        df['volume_sma_5'] = df['volume'].rolling(5).mean()
        df['volume_sma_10'] = df['volume'].rolling(10).mean()
        df['volume_sma_20'] = df['volume'].rolling(20).mean()
        
        # Relative volume (RVOL)
        vol_sma_20 = df['volume_sma_20'].replace(0, np.nan)
        df['rvol'] = df['volume'] / vol_sma_20
        
        # Volume trend
        df['volume_trend'] = df['volume_sma_5'] / vol_sma_20
        
        # Volume delta (current vs previous)
        vol_shift = df['volume'].shift(1).replace(0, np.nan)
        df['volume_delta'] = (df['volume'] - df['volume'].shift(1)) / vol_shift
        
        # Volume weighted price features
        if 'vwap' in df.columns:
            df['vwap_deviation'] = (df['close'] - df['vwap']) / df['vwap']
        else:
            # Approximate VWAP
            df['vwap'] = (df['close'] * df['volume']).cumsum() / df['volume'].cumsum()
            df['vwap_deviation'] = (df['close'] - df['vwap']) / df['vwap']
        
        # Price-volume trend
        df['price_volume_trend'] = (df['return_1'] * df['volume']).rolling(10).sum()
        
        # On Balance Volume momentum
        obv = ta.obv(df['close'], df['volume'])
        if obv is not None:
            df['obv'] = obv
            df['obv_change'] = df['obv'].pct_change(5)
        
        return df
    
    def _compute_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standard technical indicators."""
        # RSI
        df['rsi_7'] = ta.rsi(df['close'], length=7)
        df['rsi_14'] = ta.rsi(df['close'], length=14)
        df['rsi_21'] = ta.rsi(df['close'], length=21)
        
        # RSI normalized to [-1, 1]
        df['rsi_14_norm'] = (df['rsi_14'] - 50) / 50
        
        # Stochastic RSI
        stochrsi = ta.stochrsi(df['close'], length=14)
        if stochrsi is not None and len(stochrsi.columns) >= 2:
            df['stochrsi_k'] = stochrsi.iloc[:, 0]
            df['stochrsi_d'] = stochrsi.iloc[:, 1]
        
        # MACD
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        if macd is not None:
            df['macd'] = macd.iloc[:, 0]
            df['macd_signal'] = macd.iloc[:, 1]
            df['macd_hist'] = macd.iloc[:, 2]
            # Normalized histogram
            macd_abs = df['macd'].abs().replace(0, np.nan)
            df['macd_hist_norm'] = df['macd_hist'] / macd_abs
        
        # Bollinger Bands
        bb = ta.bbands(df['close'], length=20, std=2)
        if bb is not None:
            lower = bb.iloc[:, 0]
            mid = bb.iloc[:, 1]
            upper = bb.iloc[:, 2]
            bandwidth = upper - lower
            df['bb_position'] = (df['close'] - lower) / bandwidth.replace(0, np.nan)
            df['bb_bandwidth'] = bandwidth / mid
            df['bb_squeeze'] = df['bb_bandwidth'] / df['bb_bandwidth'].rolling(20).mean()
        
        # Moving Average Crossovers
        df['sma_5'] = ta.sma(df['close'], length=5)
        df['sma_10'] = ta.sma(df['close'], length=10)
        df['sma_20'] = ta.sma(df['close'], length=20)
        df['ema_9'] = ta.ema(df['close'], length=9)
        df['ema_21'] = ta.ema(df['close'], length=21)
        
        # Price relative to MAs
        df['price_to_sma_20'] = (df['close'] - df['sma_20']) / df['sma_20']
        df['sma_5_to_20'] = (df['sma_5'] - df['sma_20']) / df['sma_20']
        
        # ADX (trend strength)
        adx = ta.adx(df['high'], df['low'], df['close'], length=14)
        if adx is not None:
            df['adx'] = adx.iloc[:, 0]
            df['di_plus'] = adx.iloc[:, 1]
            df['di_minus'] = adx.iloc[:, 2]
            df['di_diff'] = df['di_plus'] - df['di_minus']
        
        # CCI
        df['cci'] = ta.cci(df['high'], df['low'], df['close'], length=20)
        df['cci_norm'] = df['cci'] / 100  # Normalize
        
        # Williams %R
        df['willr'] = ta.willr(df['high'], df['low'], df['close'], length=14)
        
        return df
    
    def _compute_microstructure(self, df: pd.DataFrame) -> pd.DataFrame:
        """Microstructure features (if order book data available)."""
        if 'spread' in df.columns:
            df['spread_pct'] = df['spread'] / df['close'] * 100
            df['spread_ma'] = df['spread_pct'].rolling(10).mean()
            df['spread_expansion'] = df['spread_pct'] / df['spread_ma']
        
        if 'bid_volume' in df.columns and 'ask_volume' in df.columns:
            total_vol = (df['bid_volume'] + df['ask_volume']).replace(0, np.nan)
            df['book_imbalance'] = (df['bid_volume'] - df['ask_volume']) / total_vol
            df['book_imbalance_ma'] = df['book_imbalance'].rolling(10).mean()
        
        return df
    
    def _compute_order_flow(self, df: pd.DataFrame) -> pd.DataFrame:
        """Order flow and imbalance features."""
        # Tick imbalance (using price changes)
        df['price_direction'] = np.sign(df['close'] - df['close'].shift(1))
        df['tick_imbalance'] = df['price_direction'].rolling(10).sum() / 10
        
        # Volume-weighted tick imbalance
        df['vol_weighted_direction'] = df['price_direction'] * df['volume']
        vol_sum = df['volume'].rolling(10).sum().replace(0, np.nan)
        df['volume_imbalance'] = df['vol_weighted_direction'].rolling(10).sum() / vol_sum
        
        # Buy/Sell pressure estimation
        # Lee-Ready classification approximation using close position within bar
        rng = (df['high'] - df['low']).replace(0, np.nan)
        df['close_position'] = (df['close'] - df['low']) / rng
        df['close_position'] = df['close_position'].fillna(0.5) # Neutral if high==low
        
        df['estimated_buy_ratio'] = df['close_position']  # Higher close = more buying
        
        # Cumulative delta approximation
        df['bar_delta'] = (df['close_position'] - 0.5) * df['volume'] * 2
        df['cumulative_delta'] = df['bar_delta'].cumsum()
        df['delta_ma'] = df['bar_delta'].rolling(10).mean()
        
        return df
    
    def _compute_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Time-based features."""
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        
        # Time of day (normalized 0-1 within trading hours)
        df['hour'] = df.index.hour
        df['minute'] = df.index.minute
        df['time_of_day'] = (df['hour'] - 9) / 6  # Trading 9am-3pm
        df['time_of_day'] = df['time_of_day'].clip(0, 1)
        
        # Session periods
        df['is_open_15min'] = ((df['hour'] == 9) & (df['minute'] < 30)).astype(int)
        df['is_close_15min'] = ((df['hour'] == 14) | (df['hour'] == 15)).astype(int)
        
        return df
    
    def get_feature_names(self) -> list[str]:
        """Return list of feature column names for model input."""
        return [
            # Returns
            'return_1', 'return_2', 'return_3', 'return_5', 'return_10', 'return_20',
            'log_return_1', 'log_return_5',
            
            # Momentum
            'momentum_5', 'momentum_10', 'roc_5', 'roc_10', 
            'acceleration', 'momentum_ratio',
            
            # Volatility
            'atr_7', 'atr_14', 'natr_14',
            'volatility_5', 'volatility_10', 'volatility_20',
            'volatility_ratio', 'parkinson_vol', 'atr_expansion',
            
            # Volume
            'rvol', 'volume_trend', 'volume_delta',
            'vwap_deviation', 'price_volume_trend',
            
            # Technical
            'rsi_7', 'rsi_14', 'rsi_14_norm',
            'macd_hist', 'macd_hist_norm',
            'bb_position', 'bb_bandwidth', 'bb_squeeze',
            'price_to_sma_20', 'sma_5_to_20',
            'adx', 'di_diff', 'cci_norm', 'willr',
            
            # Order Flow
            'tick_imbalance', 'volume_imbalance',
            'estimated_buy_ratio', 'delta_ma',
            
            # Time
            'time_of_day', 'is_open_15min', 'is_close_15min'
        ]
    
    def get_feature_groups(self) -> dict[str, list[str]]:
        """Return features organized by category."""
        return {
            'returns': ['return_1', 'return_2', 'return_3', 'return_5', 'return_10', 'return_20', 
                       'log_return_1', 'log_return_5'],
            'momentum': ['momentum_5', 'momentum_10', 'roc_5', 'roc_10', 'acceleration', 'momentum_ratio'],
            'volatility': ['atr_7', 'atr_14', 'natr_14', 'volatility_5', 'volatility_10', 
                          'volatility_20', 'volatility_ratio', 'parkinson_vol', 'atr_expansion'],
            'volume': ['rvol', 'volume_trend', 'volume_delta', 'vwap_deviation', 'price_volume_trend'],
            'technical': ['rsi_7', 'rsi_14', 'rsi_14_norm', 'macd_hist', 'macd_hist_norm',
                         'bb_position', 'bb_bandwidth', 'bb_squeeze', 'price_to_sma_20', 
                         'sma_5_to_20', 'adx', 'di_diff', 'cci_norm', 'willr'],
            'order_flow': ['tick_imbalance', 'volume_imbalance', 'estimated_buy_ratio', 'delta_ma'],
            'time': ['time_of_day', 'is_open_15min', 'is_close_15min']
        }


# Global instance
advanced_features = AdvancedFeatureEngine(window=settings.feature_window)
