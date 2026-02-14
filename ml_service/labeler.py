"""
Move Labeling Module
Identifies "significant moves" in historical data for training labels.
"""
import numpy as np
import pandas as pd
import structlog

from config import settings
from schemas import TrainingLabel

logger = structlog.get_logger()


class MoveLabeler:
    """Labels price moves using fixed threshold or ATR-based detection."""
    
    def __init__(
        self,
        threshold_pct: float = 1.0,
        horizon_bars: int = 10,
        atr_multiplier: float = 2.0,
        use_atr: bool = True
    ):
        self.threshold_pct = threshold_pct
        self.horizon_bars = horizon_bars
        self.atr_multiplier = atr_multiplier
        self.use_atr = use_atr
    
    def label_moves(self, df: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """
        Label each row with whether a significant move occurred in the next N bars.
        
        Args:
            df: DataFrame with 'close' and optionally 'atr_14' columns
            symbol: Symbol name
            
        Returns:
            DataFrame with 'move_occurred', 'move_direction', 'move_magnitude_pct' columns
        """
        df = df.copy()
        n = self.horizon_bars
        
        # Calculate forward returns
        df['future_high'] = df['high'].shift(-1).rolling(n).max().shift(-n+1)
        df['future_low'] = df['low'].shift(-1).rolling(n).min().shift(-n+1)
        df['future_close'] = df['close'].shift(-n)
        
        # Max move in either direction
        df['up_move_pct'] = (df['future_high'] - df['close']) / df['close'] * 100
        df['down_move_pct'] = (df['close'] - df['future_low']) / df['close'] * 100
        
        # Determine threshold
        if self.use_atr and 'atr_14' in df.columns:
            df['threshold'] = (df['atr_14'] / df['close'] * 100) * self.atr_multiplier
        else:
            df['threshold'] = self.threshold_pct
        
        # Label moves
        df['up_signal'] = df['up_move_pct'] >= df['threshold']
        df['down_signal'] = df['down_move_pct'] >= df['threshold']
        
        df['move_occurred'] = df['up_signal'] | df['down_signal']
        df['move_direction'] = np.where(
            df['up_signal'] & ~df['down_signal'], 'up',
            np.where(df['down_signal'] & ~df['up_signal'], 'down', 
                     np.where(df['up_signal'] & df['down_signal'], 
                              np.where(df['up_move_pct'] > df['down_move_pct'], 'up', 'down'),
                              None))
        )
        df['move_magnitude_pct'] = np.where(
            df['move_direction'] == 'up', df['up_move_pct'],
            np.where(df['move_direction'] == 'down', df['down_move_pct'], 0)
        )
        
        # Add symbol
        df['symbol'] = symbol
        
        # Clean up intermediate columns
        cols_to_drop = ['future_high', 'future_low', 'future_close', 
                        'up_move_pct', 'down_move_pct', 'threshold',
                        'up_signal', 'down_signal']
        df.drop(columns=[c for c in cols_to_drop if c in df.columns], inplace=True)
        
        # Stats
        move_count = df['move_occurred'].sum()
        total = len(df)
        logger.info("labeled_moves", 
                    symbol=symbol, 
                    moves=int(move_count), 
                    total=total,
                    pct=round(move_count/total*100, 2) if total > 0 else 0)
        
        return df
    
    def to_training_labels(self, df: pd.DataFrame) -> list[TrainingLabel]:
        """Convert labeled DataFrame to list of TrainingLabel schemas."""
        labels = []
        for idx, row in df.iterrows():
            if pd.notna(row.get('move_occurred')):
                labels.append(TrainingLabel(
                    symbol=row['symbol'],
                    timestamp=idx,
                    move_occurred=bool(row['move_occurred']),
                    move_direction=row.get('move_direction'),
                    move_magnitude_pct=row.get('move_magnitude_pct')
                ))
        return labels


# Convenience instance
labeler = MoveLabeler(
    threshold_pct=settings.move_threshold_pct,
    horizon_bars=settings.move_horizon_bars,
    atr_multiplier=settings.atr_multiplier
)
