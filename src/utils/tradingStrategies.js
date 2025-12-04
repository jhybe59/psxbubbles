/**
 * Pre-built Trading Strategies
 * Inspired by TradingView screener
 * Users can also create custom strategies manually
 */

export const TRADING_STRATEGIES = {
  // ===== MOMENTUM STRATEGIES =====
  'rsi-oversold': {
    id: 'rsi-oversold',
    name: 'RSI Oversold (Buy Signal)',
    description: 'RSI < 30 - Potential bounce opportunity',
    category: 'Momentum',
    icon: '📉',
    conditions: {
      rsi: {
        operator: 'below',
        value: 30
      }
    }
  },
  'rsi-overbought': {
    id: 'rsi-overbought',
    name: 'RSI Overbought (Sell Signal)',
    description: 'RSI > 70 - Potential reversal',
    category: 'Momentum',
    icon: '📈',
    conditions: {
      rsi: {
        operator: 'above',
        value: 70
      }
    }
  },
  'rsi-neutral': {
    id: 'rsi-neutral',
    name: 'RSI Neutral Zone',
    description: 'RSI between 40-60 - Neutral momentum',
    category: 'Momentum',
    icon: '➡️',
    conditions: {
      rsi: {
        min: 40,
        max: 60
      }
    }
  },

  // ===== TREND FOLLOWING STRATEGIES =====
  'golden-cross': {
    id: 'golden-cross',
    name: 'Golden Cross',
    description: 'SMA(50) > SMA(200) - Bullish trend',
    category: 'Trend',
    icon: '🌟',
    conditions: {
      sma_50: {
        operator: 'above',
        target: 'sma_200'
      }
    }
  },
  'death-cross': {
    id: 'death-cross',
    name: 'Death Cross',
    description: 'SMA(50) < SMA(200) - Bearish trend',
    category: 'Trend',
    icon: '💀',
    conditions: {
      sma_50: {
        operator: 'below',
        target: 'sma_200'
      }
    }
  },
  'price-above-sma20': {
    id: 'price-above-sma20',
    name: 'Price Above SMA(20)',
    description: 'Price > SMA(20) - Short-term uptrend',
    category: 'Trend',
    icon: '📊',
    conditions: {
      price: {
        operator: 'above',
        target: 'sma_20'
      }
    }
  },
  'price-below-sma20': {
    id: 'price-below-sma20',
    name: 'Price Below SMA(20)',
    description: 'Price < SMA(20) - Short-term downtrend',
    category: 'Trend',
    icon: '📉',
    conditions: {
      price: {
        operator: 'below',
        target: 'sma_20'
      }
    }
  },

  // ===== BREAKOUT STRATEGIES =====
  'bollinger-squeeze': {
    id: 'bollinger-squeeze',
    name: 'Bollinger Squeeze',
    description: 'Price near lower band - Low volatility, potential breakout',
    category: 'Breakout',
    icon: '🎯',
    conditions: {
      price: {
        operator: 'between',
        min: 'bb_lower',
        max: 'bb_lower * 1.02'
      }
    }
  },
  'bollinger-upper-touch': {
    id: 'bollinger-upper-touch',
    name: 'Bollinger Upper Touch',
    description: 'Price touching upper band - Potential reversal',
    category: 'Breakout',
    icon: '⬆️',
    conditions: {
      price: {
        operator: 'between',
        min: 'bb_upper * 0.98',
        max: 'bb_upper'
      }
    }
  },
  'volume-surge': {
    id: 'volume-surge',
    name: 'Volume Surge',
    description: 'Volume > 2x average volume - Strong interest',
    category: 'Breakout',
    icon: '📢',
    conditions: {
      volume: {
        operator: 'above',
        target: 'avg_volume * 2'
      }
    }
  },

  // ===== MACD STRATEGIES =====
  'macd-bullish': {
    id: 'macd-bullish',
    name: 'MACD Bullish',
    description: 'MACD > Signal line - Bullish momentum',
    category: 'Momentum',
    icon: '🟢',
    conditions: {
      macd: {
        operator: 'above',
        target: 'macd_signal'
      }
    }
  },
  'macd-bearish': {
    id: 'macd-bearish',
    name: 'MACD Bearish',
    description: 'MACD < Signal line - Bearish momentum',
    category: 'Momentum',
    icon: '🔴',
    conditions: {
      macd: {
        operator: 'below',
        target: 'macd_signal'
      }
    }
  },
  'macd-crossover-up': {
    id: 'macd-crossover-up',
    name: 'MACD Crossover Up',
    description: 'MACD crosses above signal - Buy signal',
    category: 'Momentum',
    icon: '⬆️',
    conditions: {
      macd: {
        operator: 'above',
        target: 'macd_signal'
      },
      macd_histogram: {
        operator: 'above',
        value: 0
      }
    }
  },

  // ===== COMBINED STRATEGIES =====
  'oversold-bounce': {
    id: 'oversold-bounce',
    name: 'Oversold Bounce',
    description: 'RSI < 30 AND Price > SMA(20) - Potential bounce',
    category: 'Combined',
    icon: '🎾',
    conditions: {
      rsi: {
        operator: 'below',
        value: 30
      },
      price: {
        operator: 'above',
        target: 'sma_20'
      }
    }
  },
  'strong-uptrend': {
    id: 'strong-uptrend',
    name: 'Strong Uptrend',
    description: 'Price > SMA(20) > SMA(50) > SMA(200) - Strong bullish trend',
    category: 'Trend',
    icon: '🚀',
    conditions: {
      price: {
        operator: 'above',
        target: 'sma_20'
      },
      sma_20: {
        operator: 'above',
        target: 'sma_50'
      },
      sma_50: {
        operator: 'above',
        target: 'sma_200'
      }
    }
  },
  'momentum-breakout': {
    id: 'momentum-breakout',
    name: 'Momentum Breakout',
    description: 'RSI > 50 AND MACD > Signal AND Volume > Avg - Strong momentum',
    category: 'Combined',
    icon: '💥',
    conditions: {
      rsi: {
        operator: 'above',
        value: 50
      },
      macd: {
        operator: 'above',
        target: 'macd_signal'
      },
      volume: {
        operator: 'above',
        target: 'avg_volume'
      }
    }
  },

  // ===== PRICE ACTION =====
  'high-volume-low-price': {
    id: 'high-volume-low-price',
    name: 'High Volume, Low Price',
    description: 'Volume > 1.5x avg AND Price < SMA(20) - Potential accumulation',
    category: 'Price Action',
    icon: '💰',
    conditions: {
      volume: {
        operator: 'above',
        target: 'avg_volume * 1.5'
      },
      price: {
        operator: 'below',
        target: 'sma_20'
      }
    }
  },
  'low-volume-high-price': {
    id: 'low-volume-high-price',
    name: 'Low Volume, High Price',
    description: 'Volume < 0.5x avg AND Price > SMA(20) - Potential distribution',
    category: 'Price Action',
    icon: '⚠️',
    conditions: {
      volume: {
        operator: 'below',
        target: 'avg_volume * 0.5'
      },
      price: {
        operator: 'above',
        target: 'sma_20'
      }
    }
  }
};

/**
 * Get strategies by category
 */
export function getStrategiesByCategory() {
  const categories = {};
  Object.values(TRADING_STRATEGIES).forEach(strategy => {
    if (!categories[strategy.category]) {
      categories[strategy.category] = [];
    }
    categories[strategy.category].push(strategy);
  });
  return categories;
}

/**
 * Get all strategy categories
 */
export function getStrategyCategories() {
  return [...new Set(Object.values(TRADING_STRATEGIES).map(s => s.category))];
}

