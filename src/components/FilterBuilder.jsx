import React, { useState, useEffect, useMemo } from 'react';

const FILTER_CATEGORIES = {
  marketData: {
    label: 'Market Data',
    icon: '📊',
    filters: [
      { id: 'price', label: 'Price', type: 'range', fields: ['min', 'max'] },
      { id: 'volume', label: 'Volume', type: 'range', fields: ['min', 'max'] },
      { id: 'changePct', label: 'Change %', type: 'range', fields: ['min', 'max'] },
      { id: 'value', label: 'Value/Turnover', type: 'range', fields: ['min', 'max'] },
      { id: 'dailyVolume', label: 'Daily Volume', type: 'range', fields: ['min', 'max'] }
    ]
  },
  technicals: {
    label: 'Technicals',
    icon: '📈',
    filters: [
      { id: 'priceChange1h', label: 'Price Change (1h)', type: 'range', fields: ['min', 'max'] },
      { id: 'priceChange24h', label: 'Price Change (24h)', type: 'range', fields: ['min', 'max'] },
      { id: 'momentum', label: 'Momentum', type: 'range', fields: ['min', 'max'] }
    ]
  },
  financials: {
    label: 'Financials',
    icon: '💰',
    filters: [
      { id: 'peRatio', label: 'P/E Ratio', type: 'range', fields: ['min', 'max'] },
      { id: 'marketCap', label: 'Market Cap', type: 'range', fields: ['min', 'max'] },
      { id: 'dividendYield', label: 'Dividend Yield', type: 'range', fields: ['min', 'max'] }
    ]
  },
  valuation: {
    label: 'Valuation',
    icon: '💎',
    filters: [
      { id: 'pbRatio', label: 'P/B Ratio', type: 'range', fields: ['min', 'max'] },
      { id: 'evEbitda', label: 'EV/EBITDA', type: 'range', fields: ['min', 'max'] }
    ]
  },
  growth: {
    label: 'Growth',
    icon: '🚀',
    filters: [
      { id: 'volumeGrowth', label: 'Volume Growth', type: 'range', fields: ['min', 'max'] },
      { id: 'priceGrowth', label: 'Price Growth', type: 'range', fields: ['min', 'max'] }
    ]
  }
};

// Condition options for manual setup (TradingView-style)
const CONDITION_OPTIONS = [
  { id: 'above', label: 'Above' },
  { id: 'aboveOrEqual', label: 'Above or equal' },
  { id: 'below', label: 'Below' },
  { id: 'belowOrEqual', label: 'Below or equal' },
  { id: 'crosses', label: 'Crosses' },
  { id: 'crossesUp', label: 'Crosses up' },
  { id: 'crossesDown', label: 'Crosses down' },
  { id: 'between', label: 'Between' },
  { id: 'outside', label: 'Outside' },
  { id: 'equal', label: 'Equal' },
  { id: 'abovePercent', label: '%↑ Above %' },
  { id: 'belowPercent', label: '%↓ Below %' }
];

// Preset ranges for Price metric (inspired by TradingView)
const PRICE_PRESETS = [
  { id: '100_plus', label: '100 and above', min: 100, max: null },
  { id: '10_100', label: '10 to 100', min: 10, max: 100 },
  { id: '10_below', label: '10 and below', min: null, max: 10 },
  { id: '5_below', label: '5 and below', min: null, max: 5 }
];

export default function FilterBuilder({
  open,
  onClose,
  initialFilter = null,
  onSave,
  coins = []
}) {
  const [filterName, setFilterName] = useState('');
  const [activeCategory, setActiveCategory] = useState('marketData');
  const [conditions, setConditions] = useState({});
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [menuCategoryKey, setMenuCategoryKey] = useState(null); // for dropdown inner navigation
  const [activeMetricMenu, setActiveMetricMenu] = useState(null); // which chip's menu is open
  const [priceSearch, setPriceSearch] = useState('');
  const [manualMetricId, setManualMetricId] = useState(null);
  const [manualOperator, setManualOperator] = useState('above'); // above | below

  // Live preview of symbols that match current conditions
  const previewMatches = useMemo(() => {
    if (!coins || !coins.length) return [];
    const hasAnyConditions = Object.keys(conditions).length > 0;
    if (!hasAnyConditions) {
      // Show a small sample when nothing is configured yet
      return coins.slice(0, 50);
    }

    const resolveValue = (coin, field, interval) => {
      // Basic fields
      if (field === 'price') return Number(coin.price || coin.close || 0);
      if (field === 'volume') return Number(coin.volume || 0);
      if (field === 'changePct') return Number(coin.price_change_percentage_24h || coin.interval_pct || 0);
      if (field === 'value') return Number(coin.value || coin.daily_value || 0);
      if (field === 'dailyVolume') return Number(coin.daily_volume || coin.volume || 0);

      // OHLC fields - try to get from raw data if available
      // Note: We currently don't have multi-interval data in the 'coin' object directly for all intervals.
      // We will try to use what's available in 'raw' or fallback to main properties.
      if (field === 'open') return Number(coin.raw?.open || coin.open || coin.price || 0); // Fallback to price if open missing (approx)
      if (field === 'high') return Number(coin.raw?.high || coin.high || coin.price || 0);
      if (field === 'low') return Number(coin.raw?.low || coin.low || coin.price || 0);

      return 0;
    };

    const compare = (sourceVal, operator, targetVal) => {
      if (sourceVal == null || targetVal == null) return false;

      switch (operator) {
        case 'above': return sourceVal > targetVal;
        case 'aboveOrEqual': return sourceVal >= targetVal;
        case 'below': return sourceVal < targetVal;
        case 'belowOrEqual': return sourceVal <= targetVal;
        case 'equal': return Math.abs(sourceVal - targetVal) < 0.000001; // Float equality
        // For crosses, we'd need previous state, which we don't have in this simple filter. 
        // Treating as simple comparison for now or false.
        case 'crosses': return false;
        case 'crossesUp': return sourceVal > targetVal; // Approx
        case 'crossesDown': return sourceVal < targetVal; // Approx
        default: return false;
      }
    };

    const passes = (coin) => {
      const c = conditions;

      for (const [key, cond] of Object.entries(c)) {
        if (!cond) continue;

        // Determine source value based on filter key
        let sourceVal = 0;
        if (key === 'price') sourceVal = resolveValue(coin, 'price');
        else if (key === 'volume') sourceVal = resolveValue(coin, 'volume');
        else if (key === 'changePct') sourceVal = resolveValue(coin, 'changePct');
        else if (key === 'value') sourceVal = resolveValue(coin, 'value');
        else if (key === 'dailyVolume') sourceVal = resolveValue(coin, 'dailyVolume');
        // ... add other keys as needed

        // Handle Range (Min/Max)
        if (cond.min != null && sourceVal < cond.min) return false;
        if (cond.max != null && sourceVal > cond.max) return false;

        // Handle Advanced Operator/Target
        if (cond.operator && cond.target) {
          // If target is 'value', we use min/max which is already handled above (or we could handle specific single value here)
          if (cond.target !== 'value') {
            const targetVal = resolveValue(coin, cond.target, cond.interval);
            if (!compare(sourceVal, cond.operator, targetVal)) return false;
          }
        }
      }
      return true;
    };

    return coins.filter(passes).slice(0, 100);
  }, [coins, conditions]);

  useEffect(() => {
    if (open) {
      if (initialFilter) {
        setFilterName(initialFilter.name || '');
        setConditions(initialFilter.conditions || {});
      } else {
        setFilterName('');
        setConditions({});
      }
    }
  }, [open, initialFilter]);

  const updateCondition = (filterId, value) => {
    setConditions(prev => ({
      ...prev,
      [filterId]: value
    }));
  };

  const removeCondition = (filterId) => {
    setConditions(prev => {
      const next = { ...prev };
      delete next[filterId];
      return next;
    });
  };

  const handleSave = () => {
    if (!filterName.trim()) {
      alert('Please enter a filter name');
      return;
    }

    // Check if at least one condition is set
    const hasConditions = Object.keys(conditions).some(key => {
      const condition = conditions[key];
      if (condition === null || condition === undefined || condition === '') return false;
      if (typeof condition === 'object') {
        return condition.min !== null && condition.min !== undefined && condition.min !== '' ||
          condition.max !== null && condition.max !== undefined && condition.max !== '';
      }
      return true;
    });

    if (!hasConditions) {
      alert('Please add at least one filter condition');
      return;
    }

    const filter = {
      id: initialFilter?.id || Date.now().toString(),
      name: filterName.trim(),
      conditions,
      createdAt: initialFilter?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(filter);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          style={{
            background: '#1a2332',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            zIndex: 2001
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Title as editable input – click to rename */}
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder={initialFilter ? 'Filter name' : 'Create new filter'}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#eaeaea',
                  fontSize: '20px',
                  fontWeight: 600,
                  padding: 0,
                  margin: 0
                }}
              />
              <div style={{ fontSize: '12px', color: '#9fb8b0' }}>
                Active conditions:{' '}
                <span style={{ color: '#7ff0a0', fontWeight: 600 }}>
                  {Object.keys(conditions).length}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9fb8b0',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Chips row + \"+ Add filter\" button (like TV top bar) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8
              }}
            >
              {Object.keys(conditions).length > 0 &&
                Object.entries(conditions).map(([id]) => {
                  const def =
                    Object.values(FILTER_CATEGORIES)
                      .flatMap((cat) => cat.filters)
                      .find((f) => f.id === id);
                  if (!def) return null;
                  const cond = conditions[id] || {};

                  // Visual summary for chip (e.g. "Price > 100", "Price · Open · 5m")
                  let valueSummary = '';
                  if (def.type === 'range') {
                    // Prefer operator-based display when available
                    if (cond.operator && (cond.min != null || cond.max != null)) {
                      const op = cond.operator;
                      const isAboveGroup =
                        op === 'above' ||
                        op === 'aboveOrEqual' ||
                        op === 'crossesUp' ||
                        op === 'outside' ||
                        op === 'abovePercent';
                      const isBelowGroup =
                        op === 'below' ||
                        op === 'belowOrEqual' ||
                        op === 'crossesDown' ||
                        op === 'belowPercent';
                      const isEqualGroup = op === 'equal';

                      let symbol = '';
                      if (isEqualGroup) {
                        symbol = '=';
                      } else if (isAboveGroup) {
                        symbol = op === 'aboveOrEqual' ? '≥' : '>';
                      } else if (isBelowGroup) {
                        symbol = op === 'belowOrEqual' ? '≤' : '<';
                      } else if (op === 'between') {
                        symbol = '↔';
                      } else if (op === 'outside') {
                        symbol = '⇵';
                      } else if (op === 'crosses' || op === 'crossesUp' || op === 'crossesDown') {
                        symbol = '×';
                      } else if (op === 'abovePercent') {
                        symbol = '%↑';
                      } else if (op === 'belowPercent') {
                        symbol = '%↓';
                      }

                      const value =
                        isBelowGroup || op === 'belowPercent'
                          ? cond.max ?? cond.min
                          : cond.min ?? cond.max;

                      if (value != null) {
                        valueSummary = symbol ? `${symbol} ${value}` : String(value);
                      }
                    } else if (cond.min != null && cond.max != null) {
                      valueSummary = `${cond.min} – ${cond.max}`;
                    } else if (cond.min != null) {
                      valueSummary = `${cond.min}+`;
                    } else if (cond.max != null) {
                      valueSummary = `≤ ${cond.max}`;
                    }
                  }

                  // Append target / interval info if present
                  const metaParts = [];
                  if (cond.target && cond.target !== 'value') {
                    const targetLabelMap = {
                      open: 'Open',
                      high: 'High',
                      low: 'Low',
                      bbands: 'Bollinger Bands',
                      donchian: 'Donchian Channels',
                      ema: 'EMA',
                      hma: 'HMA',
                      keltner: 'Keltner Channels',
                      psar: 'Parabolic SAR',
                      sma: 'SMA',
                      vwap: 'VWAP',
                      vwma: 'VWMA'
                    };
                    const tLabel = targetLabelMap[cond.target] || cond.target;
                    let intervalText = '';
                    if (cond.interval) {
                      const intervalLabelMap = {
                        '1m': '1m',
                        '5m': '5m',
                        '15m': '15m',
                        '30m': '30m',
                        '1h': '1h',
                        '1d': '1D',
                        '1w': '1W',
                        '1mo': '1M'
                      };
                      intervalText = intervalLabelMap[cond.interval] || cond.interval;
                    }
                    // For OHLC + interval mode, button should read like "Price > Open 5m"
                    // i.e. show operator symbol + target + interval, but no numeric threshold.
                    if (cond.target === 'open' || cond.target === 'high' || cond.target === 'low') {
                      let opSymbol = '';
                      if (cond.operator) {
                        const op = cond.operator;
                        const isAboveGroup =
                          op === 'above' ||
                          op === 'aboveOrEqual' ||
                          op === 'crossesUp' ||
                          op === 'outside' ||
                          op === 'abovePercent';
                        const isBelowGroup =
                          op === 'below' ||
                          op === 'belowOrEqual' ||
                          op === 'crossesDown' ||
                          op === 'belowPercent';
                        const isEqualGroup = op === 'equal';

                        if (isEqualGroup) {
                          opSymbol = '=';
                        } else if (isAboveGroup) {
                          opSymbol = op === 'aboveOrEqual' ? '≥' : '>';
                        } else if (isBelowGroup) {
                          opSymbol = op === 'belowOrEqual' ? '≤' : '<';
                        } else if (op === 'between') {
                          opSymbol = '↔';
                        } else if (op === 'outside') {
                          opSymbol = '⇵';
                        } else if (op === 'crosses' || op === 'crossesUp' || op === 'crossesDown') {
                          opSymbol = '×';
                        } else if (op === 'abovePercent') {
                          opSymbol = '%↑';
                        } else if (op === 'belowPercent') {
                          opSymbol = '%↓';
                        }
                      }

                      const base = intervalText ? `${tLabel} ${intervalText}` : tLabel;
                      metaParts.push(opSymbol ? `${opSymbol} ${base}` : base);
                    } else {
                      if (valueSummary) {
                        metaParts.push(valueSummary);
                      }
                      metaParts.push(intervalText ? `${tLabel} · ${intervalText}` : tLabel);
                    }
                  } else if (valueSummary) {
                    metaParts.push(valueSummary);
                  }
                  const metaLabel = metaParts.join(' · ');

                  return (
                    <div key={id} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMetricMenu((current) => (current === id ? null : id))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(8,16,28,0.9)',
                          color: '#eaeaea',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        <span>
                          {def.label}
                          {metaLabel && (
                            <span style={{ color: '#9fb8b0', marginLeft: 6 }}>
                              {metaLabel}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: 12, color: '#9fb8b0' }}>▾</span>
                      </button>
                      {activeMetricMenu === id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '110%',
                            left: 0,
                            minWidth: 220,
                            maxHeight: '60vh',
                            overflowY: 'auto',
                            background: '#121926',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.16)',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                            padding: '8px 10px',
                            zIndex: 60
                          }}
                        >
                          {/* Header */}
                          <div
                            style={{
                              marginBottom: 8,
                              color: '#eaeaea',
                              fontSize: 13,
                              fontWeight: 500
                            }}
                          >
                            {def.label}
                          </div>

                          {/* Price: presets list + manual setup like TradingView */}
                          {def.id === 'price' && manualMetricId !== id ? (
                            <>
                              <input
                                type="text"
                                placeholder="Search"
                                value={priceSearch}
                                onChange={(e) => setPriceSearch(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  marginBottom: 6,
                                  borderRadius: 6,
                                  border: '1px solid rgba(255,255,255,0.16)',
                                  background: 'rgba(5,10,20,0.95)',
                                  color: '#eaeaea',
                                  fontSize: 12
                                }}
                              />
                              <div
                                style={{
                                  maxHeight: 220,
                                  overflowY: 'auto',
                                  marginBottom: 6
                                }}
                              >
                                {PRICE_PRESETS.filter((preset) =>
                                  preset.label
                                    .toLowerCase()
                                    .includes(priceSearch.toLowerCase())
                                ).map((preset) => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() =>
                                      updateCondition(id, {
                                        ...cond,
                                        min: preset.min,
                                        max: preset.max
                                      })
                                    }
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      border: 'none',
                                      borderRadius: 4,
                                      background: 'transparent',
                                      color: '#eaeaea',
                                      fontSize: 12,
                                      textAlign: 'left',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualMetricId(id);
                                  // Default operator for manual mode is "above"
                                  setManualOperator(cond.operator || 'above');
                                  // Ensure condition also gets an operator so chip can render symbol
                                  if (!cond.operator) {
                                    updateCondition(id, {
                                      ...cond,
                                      operator: 'above'
                                    });
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: 4,
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#eaeaea',
                                  fontSize: 12,
                                  textAlign: 'left',
                                  marginTop: 2,
                                  marginBottom: 8,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                  }}
                                >
                                  {/* Left icon to show this is an advanced / deeper menu item */}
                                  <span style={{ fontSize: 14 }}>⚙️</span>
                                  <span>Manual setup…</span>
                                </span>
                                {/* Right chevron to suggest there is a next screen */}
                                <span style={{ fontSize: 12, color: '#9fb8b0' }}>›</span>
                              </button>
                            </>
                          ) : def.id === 'price' && manualMetricId === id ? (
                            <>
                              {/* Manual setup header with back arrow */}
                              <button
                                type="button"
                                onClick={() => setManualMetricId(null)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginBottom: 6,
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#eaeaea',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontSize: 13,
                                  fontWeight: 500
                                }}
                              >
                                <span style={{ fontSize: 16 }}>‹</span>
                                <span>Manual setup</span>
                              </button>
                              {/* Operator select (keep native dropdown so list is clearly visible) */}
                              <select
                                value={manualOperator}
                                onChange={(e) => {
                                  const op = e.target.value;
                                  setManualOperator(op);
                                  const baseVal =
                                    cond.min != null ? cond.min : cond.max != null ? cond.max : null;
                                  if (baseVal == null) return;

                                  const isAboveGroup =
                                    op === 'above' ||
                                    op === 'aboveOrEqual' ||
                                    op === 'crossesUp' ||
                                    op === 'outside' ||
                                    op === 'abovePercent';
                                  const isBelowGroup =
                                    op === 'below' ||
                                    op === 'belowOrEqual' ||
                                    op === 'crossesDown' ||
                                    op === 'belowPercent';
                                  const isEqualGroup = op === 'equal';

                                  if (isEqualGroup) {
                                    updateCondition(id, {
                                      ...cond,
                                      operator: op,
                                      min: baseVal,
                                      max: baseVal
                                    });
                                  } else if (isAboveGroup) {
                                    updateCondition(id, {
                                      ...cond,
                                      operator: op,
                                      min: baseVal,
                                      max: null
                                    });
                                  } else if (isBelowGroup) {
                                    updateCondition(id, {
                                      ...cond,
                                      operator: op,
                                      min: null,
                                      max: baseVal
                                    });
                                  } else {
                                    updateCondition(id, {
                                      ...cond,
                                      operator: op
                                    });
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(255,255,255,0.16)',
                                  background: 'rgba(5,10,20,0.95)',
                                  color: '#eaeaea',
                                  fontSize: 12,
                                  marginBottom: 8
                                }}
                              >
                                <optgroup label="CONDITION">
                                  <option value="above">＞ Above</option>
                                  <option value="aboveOrEqual">≥ Above or equal</option>
                                  <option value="below">＜ Below</option>
                                  <option value="belowOrEqual">≤ Below or equal</option>
                                  <option value="crosses">× Crosses</option>
                                  <option value="crossesUp">↗ Crosses up</option>
                                  <option value="crossesDown">↘ Crosses down</option>
                                  <option value="between">↔ Between</option>
                                  <option value="outside">⇵ Outside</option>
                                  <option value="equal">＝ Equal</option>
                                  <option value="abovePercent">%↑ Above %</option>
                                  <option value="belowPercent">%↓ Below %</option>
                                </optgroup>
                              </select>
                              {/* TARGET dropdown – categories live inside the dropdown list */}
                              <select
                                value={cond.target || 'value'}
                                onChange={(e) => {
                                  const nextTarget = e.target.value;
                                  // If switching into OHLC target, clear old numeric threshold/operator
                                  let nextCond = {
                                    ...cond,
                                    target: nextTarget
                                  };
                                  if (nextTarget === 'open' || nextTarget === 'high' || nextTarget === 'low') {
                                    nextCond = {
                                      ...nextCond,
                                      operator: manualOperator,
                                      min: null,
                                      max: null
                                    };
                                  }
                                  updateCondition(id, nextCond);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(255,255,255,0.16)',
                                  background: 'rgba(5,10,20,0.95)',
                                  color: '#eaeaea',
                                  fontSize: 11,
                                  marginBottom: 8
                                }}
                              >
                                <optgroup label="TARGET">
                                  <option value="value">Value</option>
                                </optgroup>
                                <optgroup label="PRICE">
                                  <option value="open">Open</option>
                                  <option value="high">High</option>
                                  <option value="low">Low</option>
                                </optgroup>
                                <optgroup label="INDICATORS">
                                  <option value="bbands">Bollinger Bands</option>
                                  <option value="donchian">Donchian Channels</option>
                                  <option value="ema">Exponential Moving Average</option>
                                  <option value="hma">Hull Moving Average</option>
                                  <option value="keltner">Keltner Channels</option>
                                  <option value="psar">Parabolic SAR</option>
                                  <option value="sma">Simple Moving Average</option>
                                  <option value="vwap">Volume Weighted Average Price</option>
                                  <option value="vwma">Volume Weighted Moving Average</option>
                                </optgroup>
                              </select>
                              {/* Value / Interval input */}
                              {cond.target === 'open' ||
                                cond.target === 'high' ||
                                cond.target === 'low' ? (
                                // For OHLC targets, show INTERVAL dropdown instead of raw number
                                <select
                                  value={cond.interval || '1m'}
                                  onChange={(e) =>
                                    updateCondition(id, {
                                      ...cond,
                                      interval: e.target.value
                                    })
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    background: 'rgba(5,10,20,0.95)',
                                    color: '#eaeaea',
                                    fontSize: 12
                                  }}
                                >
                                  <optgroup label="INTERVAL">
                                    <option value="1m">1 minute</option>
                                    <option value="5m">5 minutes</option>
                                    <option value="15m">15 minutes</option>
                                    <option value="30m">30 minutes</option>
                                    <option value="1h">1 hour</option>
                                    <option value="1d">1 day</option>
                                    <option value="1w">1 week</option>
                                    <option value="1mo">1 month</option>
                                  </optgroup>
                                </select>
                              ) : (
                                // Default: numeric value input
                                <input
                                  type="number"
                                  value={
                                    manualOperator === 'equal'
                                      ? cond.min ?? cond.max ?? ''
                                      : manualOperator === 'above' ||
                                        manualOperator === 'aboveOrEqual' ||
                                        manualOperator === 'crossesUp' ||
                                        manualOperator === 'outside' ||
                                        manualOperator === 'abovePercent'
                                        ? cond.min ?? ''
                                        : manualOperator === 'below' ||
                                          manualOperator === 'belowOrEqual' ||
                                          manualOperator === 'crossesDown' ||
                                          manualOperator === 'belowPercent'
                                          ? cond.max ?? ''
                                          : ''
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : null;
                                    const isAboveGroup =
                                      manualOperator === 'above' ||
                                      manualOperator === 'aboveOrEqual' ||
                                      manualOperator === 'crossesUp' ||
                                      manualOperator === 'outside' ||
                                      manualOperator === 'abovePercent';
                                    const isBelowGroup =
                                      manualOperator === 'below' ||
                                      manualOperator === 'belowOrEqual' ||
                                      manualOperator === 'crossesDown' ||
                                      manualOperator === 'belowPercent';
                                    const isEqualGroup = manualOperator === 'equal';

                                    if (isEqualGroup) {
                                      updateCondition(id, {
                                        ...cond,
                                        operator: manualOperator,
                                        min: val,
                                        max: val
                                      });
                                    } else if (isAboveGroup) {
                                      updateCondition(id, {
                                        ...cond,
                                        operator: manualOperator,
                                        min: val,
                                        max: null
                                      });
                                    } else if (isBelowGroup) {
                                      updateCondition(id, {
                                        ...cond,
                                        operator: manualOperator,
                                        min: null,
                                        max: val
                                      });
                                    } else {
                                      // Fallback for other operators – treat like "above"
                                      updateCondition(id, {
                                        ...cond,
                                        operator: manualOperator,
                                        min: val,
                                        max: null
                                      });
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    background: 'rgba(5,10,20,0.95)',
                                    color: '#eaeaea',
                                    fontSize: 12
                                  }}
                                />
                              )}
                            </>
                          ) : (
                            def.type === 'range' && (
                              <>
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 6,
                                    marginBottom: 10
                                  }}
                                >
                                  <div style={{ fontSize: 11, color: '#9fb8b0' }}>From</div>
                                  <input
                                    type="number"
                                    value={cond.min ?? ''}
                                    onChange={(e) =>
                                      updateCondition(id, {
                                        ...cond,
                                        min: e.target.value ? Number(e.target.value) : null
                                      })
                                    }
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(255,255,255,0.16)',
                                      borderRadius: 6,
                                      color: '#eaeaea',
                                      fontSize: 12
                                    }}
                                  />
                                  <div style={{ fontSize: 11, color: '#9fb8b0' }}>To</div>
                                  <input
                                    type="number"
                                    value={cond.max ?? ''}
                                    onChange={(e) =>
                                      updateCondition(id, {
                                        ...cond,
                                        max: e.target.value ? Number(e.target.value) : null
                                      })
                                    }
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(255,255,255,0.16)',
                                      borderRadius: 6,
                                      color: '#eaeaea',
                                      fontSize: 12
                                    }}
                                  />
                                </div>
                              </>
                            )
                          )}

                          {/* Footer buttons */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginTop: 6
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                removeCondition(id);
                                setActiveMetricMenu(null);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid rgba(255,155,155,0.5)',
                                background: 'rgba(255,155,155,0.12)',
                                color: '#ff9b9b',
                                fontSize: 11,
                                cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveMetricMenu(null)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid rgba(61,220,132,0.6)',
                                background: 'rgba(61,220,132,0.16)',
                                color: '#7ff0a0',
                                fontSize: 11,
                                cursor: 'pointer'
                              }}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setCategoryMenuOpen((open) => !open)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: '#eaeaea',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>＋</span>
                  <span>Add filter</span>
                </button>
                {categoryMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '110%',
                      left: 0,
                      width: '260px',
                      background: '#121926',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
                      padding: '8px 8px 10px',
                      zIndex: 50
                    }}
                  >
                    {/* Two-level dropdown: categories list -> metrics list for that category */}
                    {!menuCategoryKey && (
                      <>
                        {/* Search input (visual only for now) */}
                        <input
                          type="text"
                          placeholder="Type filter name"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            marginBottom: '6px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.16)',
                            background: 'rgba(5,10,20,0.95)',
                            color: '#eaeaea',
                            fontSize: '13px'
                          }}
                        />
                        <div
                          style={{
                            maxHeight: '260px',
                            overflowY: 'auto'
                          }}
                        >
                          {Object.entries(FILTER_CATEGORIES).map(([key, category]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setMenuCategoryKey(key);
                                setActiveCategory(key);
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background:
                                  activeCategory === key
                                    ? 'rgba(61, 220, 132, 0.16)'
                                    : 'transparent',
                                color: activeCategory === key ? '#7ff0a0' : '#eaeaea',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                textAlign: 'left'
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{category.icon}</span>
                                <span>{category.label}</span>
                              </span>
                              <span style={{ color: '#6e8092', fontSize: 12 }}>›</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {menuCategoryKey && (
                      <>
                        {/* Header with back arrow + category name */}
                        <button
                          type="button"
                          onClick={() => setMenuCategoryKey(null)}
                          style={{
                            width: '100%',
                            padding: '6px 4px 8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#eaeaea',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ fontSize: 16 }}>‹</span>
                          <span style={{ fontWeight: 600 }}>
                            {FILTER_CATEGORIES[menuCategoryKey].label}
                          </span>
                        </button>
                        <div
                          style={{
                            marginTop: 4,
                            maxHeight: '260px',
                            overflowY: 'auto',
                            paddingTop: 4,
                            borderTop: '1px solid rgba(255,255,255,0.16)'
                          }}
                        >
                          {FILTER_CATEGORIES[menuCategoryKey].filters.map((filter) => (
                            <button
                              key={filter.id}
                              type="button"
                              onClick={() => {
                                // selecting a metric: ensure a condition object exists
                                setConditions((prev) => ({
                                  ...prev,
                                  [filter.id]:
                                    prev[filter.id] !== undefined
                                      ? prev[filter.id]
                                      : { min: null, max: null }
                                }));
                                setActiveCategory(menuCategoryKey);
                                setCategoryMenuOpen(false);
                                setMenuCategoryKey(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'transparent',
                                color: '#eaeaea',
                                fontSize: '13px',
                                textAlign: 'left',
                                cursor: 'pointer'
                              }}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Preview of matching symbols (global, under chips row) */}
            <div
              style={{
                marginTop: '16px'
              }}
            >
              <div style={{ marginBottom: '4px', color: '#9fb8b0', fontSize: '12px' }}>
                Preview ({previewMatches.length} symbols)
              </div>
              <div
                style={{
                  borderRadius: '8px',
                  background: 'rgba(5, 10, 20, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr)',
                    padding: '6px 10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: '#9fb8b0',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  <span>Symbol</span>
                  <span>Name</span>
                  <span style={{ textAlign: 'right' }}>Price</span>
                  <span style={{ textAlign: 'right' }}>Change %</span>
                </div>
                {previewMatches.map((coin, idx) => {
                  const pct = Number(coin.price_change_percentage_24h || coin.interval_pct || 0);
                  const pctColor =
                    pct > 0 ? '#6be49c' : pct < 0 ? '#ff9b9b' : '#9fb8b0';

                  return (
                    <div
                      key={coin.id || coin.symbol || idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr)',
                        padding: '6px 10px',
                        alignItems: 'center',
                        fontSize: '12px',
                        background: idx % 2 === 0
                          ? 'rgba(255, 255, 255, 0.01)'
                          : 'transparent'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#eaeaea' }}>{coin.symbol || coin.id}</span>
                      <span style={{ color: '#9fb8b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {coin.name || coin.symbol || coin.id}
                      </span>
                      <span style={{ textAlign: 'right', color: '#eaeaea' }}>
                        {coin.price != null ? Number(coin.price).toFixed(2) : '-'}
                      </span>
                      <span style={{ textAlign: 'right', color: pctColor }}>
                        {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
                {previewMatches.length === 0 && (
                  <div
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#6e8092',
                      fontSize: '12px'
                    }}
                  >
                    No symbols match the current filter.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#eaeaea',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                background: 'rgba(61, 220, 132, 0.2)',
                border: '1px solid rgba(61, 220, 132, 0.3)',
                borderRadius: '8px',
                color: '#7ff0a0',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Save Filter
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

