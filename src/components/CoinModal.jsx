import React, { useEffect } from 'react';

function IconButton({ children, title, onClick }) {
  return (
    <button className="icon-btn small" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

export default function CoinModal({ coin, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!coin) return null;

  const pct = coin.price_change_percentage_24h || 0;
  const pctColor = pct >= 0 ? '#24c55e' : '#ff4d4d';

  return (
    <div className="overlay" style={{ zIndex: 2000 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="coin-modal" role="dialog" aria-modal="true">
        {/* top links + trade icons */}
        <div className="coin-links-row">
          <div className="links-left">
            {/* External links now point to PSX company pages when available */}
            <a href={`https://psxterminal.com/companies/${coin.symbol || coin.id}`} target="_blank" rel="noreferrer" className="link-icon">🔍</a>
            <a href={`https://psxterminal.com/companies/${coin.symbol || coin.id}`} target="_blank" rel="noreferrer" className="link-icon">🌐</a>
            <a href={`https://psxterminal.com/companies/${coin.symbol || coin.id}`} target="_blank" rel="noreferrer" className="link-icon">📈</a>
          </div>
          <div className="trade-icons">
            <IconButton title="Buy">⤴️</IconButton>
            <IconButton title="Swap">🔁</IconButton>
            <IconButton title="DEX">🪙</IconButton>
          </div>
        </div>

        <div className="coin-top">
          <div className="coin-left">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {coin.image && <img src={coin.image} alt="" className="coin-image" />}
              <div>
                <div className="coin-title">{coin.name} <span className="coin-symbol">{coin.symbol?.toUpperCase()}</span></div>
                <div className="coin-sub">Rank <span className="coin-rank">#{coin.market_cap_rank ?? '-'}</span></div>
              </div>
            </div>
          </div>

          <div className="coin-right">
            <div className="coin-price">${coin.price}</div>
            <div className="coin-pct" style={{ color: pctColor }}>{pct >= 0 ? '+' : ''}{pct.toFixed(4)}</div>
          </div>
        </div>

        <div className="coin-stats-row">
          <div className="stat">Market Cap<br/><strong>${coin.market_cap?.toLocaleString?.() ?? '-'}</strong></div>
          <div className="stat">24h Volume<br/><strong>${coin.volume?.toLocaleString?.() ?? '-'}</strong></div>
          <div className="stat">Circulating<br/><strong>—</strong></div>
        </div>

        <div className="chart-area">
          {/* colored gradient area + low-point marker mimic */}
          <div className="sparkline">
            <svg width="100%" height="100%" viewBox="0 0 600 140" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={pct >= 0 ? '#6fe987' : '#ff9a9a'} stopOpacity="0.36" />
                  <stop offset="100%" stopColor="#071014" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,60 C80,40 160,80 240,50 320,30 400,70 480,40 560,30 600,36 L600,140 L0,140 Z" fill="url(#areaGrad)" stroke={pct >= 0 ? '#23c55e' : '#ff4d4d'} strokeWidth="2" fillOpacity="0.9" />
              {/* low-point marker */}
              <circle cx="360" cy="70" r="5" fill="#ff6b6b" />
              <text x="360" y="86" fontSize="12" fill="#ff6b6b" textAnchor="middle">$0.01511</text>
            </svg>
          </div>

          <div className="timeframe-row">
            <div className="time-pill active">Hour<br/><span className="pill-pct">2.3%</span></div>
            <div className="time-pill">Day<br/><span className="pill-pct pos">13.7%</span></div>
            <div className="time-pill">Week<br/><span className="pill-pct pos">36%</span></div>
            <div className="time-pill">Month<br/><span className="pill-pct">-</span></div>
            <div className="time-pill">Year<br/><span className="pill-pct">-</span></div>
          </div>
        </div>

        <div className="modal-actions">
          <a className="link-btn" href={`https://psxterminal.com/companies/${coin.symbol || coin.id}`} target="_blank" rel="noreferrer">View on PSX</a>
          <button className="link-btn">Trade</button>
        </div>

        <button className="close-btn modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  );
}
