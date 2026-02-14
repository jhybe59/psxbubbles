"""
Advanced Labeling Module
Implements proper ML labeling strategies for financial time series.

CRITICAL: Naive labeling (price up = 1) creates false learning!

Implemented approaches:
1. Triple Barrier Method (de Prado)
2. Fixed Horizon + ATR Threshold
3. Volatility-adjusted labeling
"""
import numpy as np
import pandas as pd
from typing import Literal, Optional, Tuple
from dataclasses import dataclass
import structlog

from config import settings

logger = structlog.get_logger()


@dataclass
class LabelConfig:
    """Configuration for labeling strategy."""
    # Thresholds
    profit_take_pct: float = 1.0       # Take profit threshold (%)
    stop_loss_pct: float = 1.0         # Stop loss threshold (%)
    max_holding_bars: int = 10         # Maximum bars to hold
    
    # ATR-based (volatility adjusted)
    use_atr: bool = True
    atr_profit_multiplier: float = 2.0
    atr_stop_multiplier: float = 2.0
    
    # Minimum move threshold
    min_move_pct: float = 0.3          # Ignore moves smaller than this


class TripleBarrierLabeler:
    """
    Triple Barrier Method (de Prado, Advances in Financial ML)
    
    Three barriers:
    1. Upper (profit-take): Price hits +threshold
    2. Lower (stop-loss): Price hits -threshold
    3. Time (max hold): Max holding period reached
    
    Label:
    - 1: Upper barrier hit first (profitable up move)
    - -1: Lower barrier hit first (profitable down move)
    - 0: Time barrier hit (no significant move)
    
    This prevents lookahead bias and properly captures trade outcomes.
    """
    
    def __init__(self, config: Optional[LabelConfig] = None):
        self.config = config or LabelConfig()
    
    def label(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply triple barrier labeling.
        
        Args:
            df: DataFrame with OHLCV + 'atr_14' column
            
        Returns:
            DataFrame with label columns added
        """
        df = df.copy()
        n = len(df)
        max_hold = self.config.max_holding_bars
        
        # Initialize label columns
        df['label'] = 0
        df['label_direction'] = 0
        df['label_magnitude'] = 0.0
        df['bars_to_touch'] = 0
        df['barrier_touched'] = 'time'
        
        for i in range(n - max_hold):
            entry_price = df['close'].iloc[i]
            
            # Calculate thresholds
            if self.config.use_atr and 'atr_14' in df.columns:
                atr = df['atr_14'].iloc[i]
                upper_thresh = entry_price + (atr * self.config.atr_profit_multiplier)
                lower_thresh = entry_price - (atr * self.config.atr_stop_multiplier)
            else:
                upper_thresh = entry_price * (1 + self.config.profit_take_pct / 100)
                lower_thresh = entry_price * (1 - self.config.stop_loss_pct / 100)
            
            # Check future bars
            for j in range(1, max_hold + 1):
                if i + j >= n:
                    break
                
                future_high = df['high'].iloc[i + j]
                future_low = df['low'].iloc[i + j]
                
                # Check upper barrier (bullish)
                if future_high >= upper_thresh:
                    df.iloc[i, df.columns.get_loc('label')] = 1
                    df.iloc[i, df.columns.get_loc('label_direction')] = 1
                    df.iloc[i, df.columns.get_loc('label_magnitude')] = (upper_thresh - entry_price) / entry_price * 100
                    df.iloc[i, df.columns.get_loc('bars_to_touch')] = j
                    df.iloc[i, df.columns.get_loc('barrier_touched')] = 'upper'
                    break
                
                # Check lower barrier (bearish)
                if future_low <= lower_thresh:
                    df.iloc[i, df.columns.get_loc('label')] = -1
                    df.iloc[i, df.columns.get_loc('label_direction')] = -1
                    df.iloc[i, df.columns.get_loc('label_magnitude')] = (entry_price - lower_thresh) / entry_price * 100
                    df.iloc[i, df.columns.get_loc('bars_to_touch')] = j
                    df.iloc[i, df.columns.get_loc('barrier_touched')] = 'lower'
                    break
        
        # Binary label for classification (did a significant move occur?)
        df['move_occurred'] = (df['label'] != 0).astype(int)
        
        # Log stats
        move_count = (df['label'] != 0).sum()
        up_count = (df['label'] == 1).sum()
        down_count = (df['label'] == -1).sum()
        
        logger.info("triple_barrier_labeled",
                    total=n,
                    moves=int(move_count),
                    up=int(up_count),
                    down=int(down_count),
                    move_rate=round(move_count/n*100, 2) if n > 0 else 0)
        
        return df


class FixedHorizonLabeler:
    """
    Fixed Horizon + Threshold Labeling
    
    Looks at price N bars ahead and labels based on return magnitude.
    Uses ATR to normalize for volatility.
    """
    
    def __init__(self, config: Optional[LabelConfig] = None):
        self.config = config or LabelConfig()
    
    def label(self, df: pd.DataFrame, horizon: int = 10) -> pd.DataFrame:
        """
        Apply fixed horizon labeling.
        
        Args:
            df: DataFrame with OHLCV + 'atr_14' column
            horizon: Number of bars to look ahead
            
        Returns:
            DataFrame with label columns
        """
        df = df.copy()
        
        # Future return
        df['future_return'] = df['close'].shift(-horizon) / df['close'] - 1
        df['future_return_pct'] = df['future_return'] * 100
        
        # Threshold (ATR-based or fixed)
        if self.config.use_atr and 'atr_14' in df.columns:
            df['threshold_pct'] = (df['atr_14'] / df['close'] * 100) * self.config.atr_profit_multiplier
        else:
            df['threshold_pct'] = self.config.profit_take_pct
        
        # Labels
        df['label'] = 0
        df.loc[df['future_return_pct'] >= df['threshold_pct'], 'label'] = 1
        df.loc[df['future_return_pct'] <= -df['threshold_pct'], 'label'] = -1
        
        df['label_direction'] = np.sign(df['future_return_pct'])
        df['label_magnitude'] = df['future_return_pct'].abs()
        df['move_occurred'] = (df['label'] != 0).astype(int)
        
        # Clean
        df = df.drop(columns=['threshold_pct'], errors='ignore')
        
        return df


class MetaLabeler:
    """
    Meta-Labeling (de Prado)
    
    Two-stage approach:
    1. Primary model predicts direction (up/down)
    2. Secondary model predicts probability of success
    
    This separates direction prediction from position sizing.
    """
    
    def __init__(self, primary_predictions: pd.Series):
        """
        Args:
            primary_predictions: Series of primary model predictions (-1, 0, 1)
        """
        self.primary_predictions = primary_predictions
    
    def label(self, df: pd.DataFrame, horizon: int = 10) -> pd.DataFrame:
        """
        Create meta-labels based on primary prediction correctness.
        
        Label = 1 if primary prediction direction was correct
        Label = 0 if primary prediction direction was wrong
        """
        df = df.copy()
        
        # Actual future direction
        df['future_return'] = df['close'].shift(-horizon) / df['close'] - 1
        df['actual_direction'] = np.sign(df['future_return'])
        
        # Primary prediction (aligned to index)
        df['primary_pred'] = self.primary_predictions
        
        # Meta-label: was the primary prediction correct?
        df['meta_label'] = (df['primary_pred'] == df['actual_direction']).astype(int)
        
        # Override: if primary predicted 0 (no trade), meta_label is NaN
        df.loc[df['primary_pred'] == 0, 'meta_label'] = np.nan
        
        return df


def create_training_labels(
    df: pd.DataFrame,
    method: Literal['triple_barrier', 'fixed_horizon'] = 'triple_barrier',
    config: Optional[LabelConfig] = None
) -> pd.DataFrame:
    """
    Convenience function to create training labels.
    
    Args:
        df: DataFrame with OHLCV data
        method: Labeling method to use
        config: Label configuration
        
    Returns:
        DataFrame with labels
    """
    if method == 'triple_barrier':
        labeler = TripleBarrierLabeler(config)
        return labeler.label(df)
    elif method == 'fixed_horizon':
        labeler = FixedHorizonLabeler(config)
        return labeler.label(df)
    else:
        raise ValueError(f"Unknown labeling method: {method}")


def analyze_label_distribution(df: pd.DataFrame) -> dict:
    """
    Analyze the distribution of labels.
    
    Returns statistics useful for understanding class imbalance.
    """
    if 'label' not in df.columns:
        return {}
    
    total = len(df)
    label_counts = df['label'].value_counts().to_dict()
    
    stats = {
        'total_samples': total,
        'label_counts': label_counts,
        'label_rates': {k: v/total*100 for k, v in label_counts.items()},
        'move_rate': (df['label'] != 0).mean() * 100 if 'label' in df.columns else 0,
        'up_rate': (df['label'] == 1).mean() * 100 if 'label' in df.columns else 0,
        'down_rate': (df['label'] == -1).mean() * 100 if 'label' in df.columns else 0,
    }
    
    if 'label_magnitude' in df.columns:
        moves = df[df['label'] != 0]
        if len(moves) > 0:
            stats['avg_magnitude'] = moves['label_magnitude'].mean()
            stats['median_magnitude'] = moves['label_magnitude'].median()
    
    if 'bars_to_touch' in df.columns:
        moves = df[df['label'] != 0]
        if len(moves) > 0:
            stats['avg_bars_to_move'] = moves['bars_to_touch'].mean()
    
    return stats


# Default config
default_label_config = LabelConfig(
    profit_take_pct=settings.move_threshold_pct,
    stop_loss_pct=settings.move_threshold_pct,
    max_holding_bars=settings.move_horizon_bars,
    use_atr=True,
    atr_profit_multiplier=settings.atr_multiplier,
    atr_stop_multiplier=settings.atr_multiplier
)
