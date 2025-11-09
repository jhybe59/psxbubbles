import React from 'react';

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return Number(value).toFixed(0);
};

const SignBadge = ({ value }) => {
  if (value == null) return <span className="badge neutral">0</span>;
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`badge ${value > 0 ? 'pos' : value < 0 ? 'neg' : 'neutral'}`}>
      {`${sign}${value.toFixed(2)}%`}
    </span>
  );
};

const moversList = (rows) => {
  if (!rows || !rows.length) {
    return <div className="muted">No data</div>;
  }
  return rows.map((row) => (
    <div key={row.symbol} className="mover-row">
      <span className="symbol">{row.symbol}</span>
      <SignBadge value={row.intervalPct} />
    </div>
  ));
};

export default function MarketSummary({ stats, indices, loading, onRetry }) {
  const asOf = stats?.asOf ? new Date(stats.asOf).toLocaleTimeString() : null;
  return (
    <section className="market-summary">
      <header>
        <div>
          <h2>Market Summary</h2>
          <div className="subtitle">
            {stats?.interval === 'Day' ? 'End of Day' : '5-minute view'}
            {asOf ? ` • ${asOf}` : ''}
          </div>
        </div>
        <div className="actions">
          <button onClick={onRetry} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      <div className="grid">
        <div className="card">
          <div className="label">Advancers</div>
          <div className="value pos">{formatNumber(stats?.advancers)}</div>
        </div>
        <div className="card">
          <div className="label">Decliners</div>
          <div className="value neg">{formatNumber(stats?.decliners)}</div>
        </div>
        <div className="card">
          <div className="label">Unchanged</div>
          <div className="value neutral">{formatNumber(stats?.unchanged)}</div>
        </div>
        <div className="card">
          <div className="label">Volume</div>
          <div className="value">{formatNumber(stats?.volumeTotal)}</div>
        </div>
        <div className="card">
          <div className="label">Turnover</div>
          <div className="value">{formatNumber(stats?.turnoverTotal)}</div>
        </div>
      </div>

      <div className="movers">
        <div className="movers-section">
          <div className="section-title">Top Gainers</div>
          {moversList(stats?.topGainers)}
        </div>
        <div className="movers-section">
          <div className="section-title">Top Losers</div>
          {moversList(stats?.topLosers)}
        </div>
        <div className="movers-section">
          <div className="section-title">Indices</div>
          {indices?.indices?.length ? (
            indices.indices.map((ix) => (
              <div key={ix.code} className="mover-row">
                <span className="symbol">{ix.code}</span>
                <SignBadge value={ix.latest?.changePct} />
              </div>
            ))
          ) : (
            <div className="muted">No data</div>
          )}
        </div>
      </div>
    </section>
  );
}


