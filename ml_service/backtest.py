"""
Backtest Engine
Evaluate models with realistic trading simulation.

Key metrics:
- Profit Factor
- Sharpe Ratio
- Max Drawdown
- Win Rate
- Average Win/Loss
- Equity Curve
"""
import numpy as np
import pandas as pd
from typing import Optional, Literal
from dataclasses import dataclass
import structlog

logger = structlog.get_logger()


@dataclass
class Trade:
    """Represents a single trade."""
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp
    entry_price: float
    exit_price: float
    direction: Literal['long', 'short']
    signal_prob: float
    pnl: float
    pnl_pct: float
    bars_held: int
    exit_reason: Literal['target', 'stop', 'time', 'signal']


@dataclass
class BacktestConfig:
    """Backtest configuration."""
    initial_capital: float = 100000.0
    position_size_pct: float = 10.0     # % of capital per trade
    max_positions: int = 5
    
    # Exits
    profit_target_pct: float = 1.0
    stop_loss_pct: float = 1.0
    max_hold_bars: int = 10
    
    # Entry
    min_signal_prob: float = 0.6
    
    # Costs
    commission_pct: float = 0.1         # 0.1% per trade
    slippage_pct: float = 0.05          # 0.05% slippage


class BacktestEngine:
    """
    Backtest trading strategy using model predictions.
    """
    
    def __init__(self, config: Optional[BacktestConfig] = None):
        self.config = config or BacktestConfig()
        self.trades: list[Trade] = []
        self.equity_curve: list[float] = []
    
    def run(
        self,
        df: pd.DataFrame,
        predictions: np.ndarray,
        directions: Optional[np.ndarray] = None
    ) -> dict:
        """
        Run backtest simulation.
        
        Args:
            df: OHLCV DataFrame with timestamp index
            predictions: Probability predictions (0-1)
            directions: Predicted direction (-1, 0, 1), optional
            
        Returns:
            Dict with backtest results
        """
        self.trades = []
        capital = self.config.initial_capital
        self.equity_curve = [capital]
        
        position = None  # Current position
        position_entry_bar = 0
        
        for i in range(len(df) - self.config.max_hold_bars):
            current_bar = df.iloc[i]
            current_time = df.index[i]
            prob = predictions[i]
            direction = directions[i] if directions is not None else 1
            
            # Check for exit if in position
            if position is not None:
                bars_held = i - position_entry_bar
                exit_bar = df.iloc[i]
                
                # Calculate current PnL
                if position['direction'] == 'long':
                    current_pnl_pct = (exit_bar['close'] - position['entry_price']) / position['entry_price'] * 100
                else:
                    current_pnl_pct = (position['entry_price'] - exit_bar['close']) / position['entry_price'] * 100
                
                # Check exit conditions
                exit_reason = None
                exit_price = exit_bar['close']
                
                # Target hit (using high/low)
                if position['direction'] == 'long':
                    target_price = position['entry_price'] * (1 + self.config.profit_target_pct / 100)
                    stop_price = position['entry_price'] * (1 - self.config.stop_loss_pct / 100)
                    if exit_bar['high'] >= target_price:
                        exit_reason = 'target'
                        exit_price = target_price
                    elif exit_bar['low'] <= stop_price:
                        exit_reason = 'stop'
                        exit_price = stop_price
                else:
                    target_price = position['entry_price'] * (1 - self.config.profit_target_pct / 100)
                    stop_price = position['entry_price'] * (1 + self.config.stop_loss_pct / 100)
                    if exit_bar['low'] <= target_price:
                        exit_reason = 'target'
                        exit_price = target_price
                    elif exit_bar['high'] >= stop_price:
                        exit_reason = 'stop'
                        exit_price = stop_price
                
                # Time exit
                if exit_reason is None and bars_held >= self.config.max_hold_bars:
                    exit_reason = 'time'
                
                # Execute exit
                if exit_reason:
                    if position['direction'] == 'long':
                        pnl_pct = (exit_price - position['entry_price']) / position['entry_price'] * 100
                    else:
                        pnl_pct = (position['entry_price'] - exit_price) / position['entry_price'] * 100
                    
                    # Apply costs
                    pnl_pct -= self.config.commission_pct * 2  # Entry + exit
                    pnl_pct -= self.config.slippage_pct * 2
                    
                    pnl = position['size'] * (pnl_pct / 100)
                    capital += pnl
                    
                    trade = Trade(
                        entry_time=position['entry_time'],
                        exit_time=current_time,
                        entry_price=position['entry_price'],
                        exit_price=exit_price,
                        direction=position['direction'],
                        signal_prob=position['signal_prob'],
                        pnl=pnl,
                        pnl_pct=pnl_pct,
                        bars_held=bars_held,
                        exit_reason=exit_reason
                    )
                    self.trades.append(trade)
                    position = None
            
            # Check for entry
            if position is None and prob >= self.config.min_signal_prob:
                position_size = capital * (self.config.position_size_pct / 100)
                entry_price = current_bar['close'] * (1 + self.config.slippage_pct / 100)
                
                position = {
                    'entry_time': current_time,
                    'entry_price': entry_price,
                    'direction': 'long' if direction >= 0 else 'short',
                    'size': position_size,
                    'signal_prob': prob
                }
                position_entry_bar = i
            
            self.equity_curve.append(capital)
        
        # Calculate metrics
        return self._calculate_metrics()
    
    def _calculate_metrics(self) -> dict:
        """Calculate backtest performance metrics."""
        if not self.trades:
            return {'error': 'No trades executed'}
        
        # Basic stats
        pnls = [t.pnl for t in self.trades]
        pnl_pcts = [t.pnl_pct for t in self.trades]
        
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        
        # Metrics
        metrics = {
            'total_trades': len(self.trades),
            'winning_trades': len(wins),
            'losing_trades': len(losses),
            'win_rate': len(wins) / len(self.trades) * 100 if self.trades else 0,
            
            'total_pnl': sum(pnls),
            'total_return_pct': (self.equity_curve[-1] / self.equity_curve[0] - 1) * 100,
            
            'avg_win': np.mean(wins) if wins else 0,
            'avg_loss': np.mean(losses) if losses else 0,
            'avg_win_pct': np.mean([t.pnl_pct for t in self.trades if t.pnl > 0]) if wins else 0,
            'avg_loss_pct': np.mean([t.pnl_pct for t in self.trades if t.pnl < 0]) if losses else 0,
            
            'max_win': max(pnls) if pnls else 0,
            'max_loss': min(pnls) if pnls else 0,
            
            'avg_bars_held': np.mean([t.bars_held for t in self.trades]),
        }
        
        # Profit Factor
        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 1
        metrics['profit_factor'] = gross_profit / gross_loss if gross_loss > 0 else 0
        
        # Sharpe Ratio (annualized, assuming daily returns)
        if len(pnl_pcts) > 1:
            daily_returns = np.array(pnl_pcts)
            metrics['sharpe_ratio'] = (np.mean(daily_returns) / np.std(daily_returns)) * np.sqrt(252) if np.std(daily_returns) > 0 else 0
        else:
            metrics['sharpe_ratio'] = 0
        
        # Max Drawdown
        peak = self.equity_curve[0]
        max_dd = 0
        for equity in self.equity_curve:
            if equity > peak:
                peak = equity
            dd = (peak - equity) / peak * 100
            if dd > max_dd:
                max_dd = dd
        metrics['max_drawdown_pct'] = max_dd
        
        # Exit reason breakdown
        exit_reasons = {}
        for t in self.trades:
            exit_reasons[t.exit_reason] = exit_reasons.get(t.exit_reason, 0) + 1
        metrics['exit_reasons'] = exit_reasons
        
        return metrics
    
    def get_equity_curve(self) -> pd.Series:
        """Return equity curve as Series."""
        return pd.Series(self.equity_curve)
    
    def get_trades_df(self) -> pd.DataFrame:
        """Return trades as DataFrame."""
        if not self.trades:
            return pd.DataFrame()
        
        return pd.DataFrame([
            {
                'entry_time': t.entry_time,
                'exit_time': t.exit_time,
                'entry_price': t.entry_price,
                'exit_price': t.exit_price,
                'direction': t.direction,
                'signal_prob': t.signal_prob,
                'pnl': t.pnl,
                'pnl_pct': t.pnl_pct,
                'bars_held': t.bars_held,
                'exit_reason': t.exit_reason
            }
            for t in self.trades
        ])


def run_backtest(
    df: pd.DataFrame,
    model,
    feature_cols: list,
    config: Optional[BacktestConfig] = None
) -> dict:
    """
    Convenience function to run backtest with a trained model.
    """
    # Compute features and get predictions
    X = df[feature_cols].values
    predictions = model.predict_proba(X)[:, 1]
    
    # Run backtest
    engine = BacktestEngine(config)
    results = engine.run(df, predictions)
    
    results['equity_curve'] = engine.get_equity_curve()
    results['trades'] = engine.get_trades_df()
    
    return results


# CLI
if __name__ == "__main__":
    print("Backtest engine ready. Use run_backtest() with your model and data.")
