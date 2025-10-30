import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import storage from '../lib/storage'
import './CsvPanel.css'

const HISTORY_KEY = 'csvHistory'

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}') } catch (e) { return {} }
}
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h || {})) }

function startOfDayUtc(year, month, day) {
  return Date.UTC(year, month - 1, day)
}

function formatDateKey(y, m, d) {
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function splitCsvLine(line) {
  const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return parts.map(p => {
    let v = p.trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return v;
  });
}

function toNum(s){
  if (s === undefined || s === null) return null;
  const cleaned = (''+s).replace(/[^0-9eE+\-.]/g, '');
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

export default function CsvPanel({ refreshCallback, currentInterval }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);
  const [navYear, setNavYear] = useState(new Date().getFullYear())
  const [navMonth, setNavMonth] = useState(new Date().getMonth() + 1)
  const [replaceAll, setReplaceAll] = useState(false)
  const [historyState, setHistoryState] = useState(() => getHistory())

  // prevent page scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => { document.body.classList.remove('modal-open') }
  }, [open])

  const parseCsv = useCallback((text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (!lines.length) return []
    const headers = splitCsvLine(lines[0]).map(h => h.replace(/\uFEFF/g, '').trim())
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i])
      if (cols.length <= 1) continue
      const obj = {}
      for (let j = 0; j < cols.length; j++) obj[headers[j]||j] = cols[j]
      rows.push(obj)
    }
    return rows
  }, [])

  const normalize = useCallback((row, dateTs) => {
    const symbol = row.Symbol || row.symbol || row.Ticker || row.ticker || row.SYMBOL
    const price = toNum(row.Close || row.close || row.Price || row.price || row.Last) || 0
    const vol = toNum(row.Volume || row.volume || row.Vol) || 0
    const pctRaw = row['Price Change % 1 day'] || row['1D%'] || row['1d%'] || row['%1d'] || row['Change%'] || row['Change'] || row['%'] || ''
    const pct = toNum(pctRaw) || 0
    return {
      symbol,
      price,
      volume: vol,
      daily_change_1d: pct,
      price_change_percentage_24h: pct,
      ts: dateTs || Date.now()
    }
  }, [])

  async function importFileForDate(file, y, m, d) {
    setBusy(true)
    setMessage('Parsing CSV...')
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      const dateTs = startOfDayUtc(y, m, d)
      const items = rows.map(r => normalize(r, dateTs)).filter(i => i.symbol)
      if (!items.length) {
        setMessage('No valid rows found in CSV')
        setBusy(false)
        return
      }
      if (replaceAll) await storage.clearSnapshots()
      await storage.saveSnapshots(items)
      const key = formatDateKey(y, m, d)
      const h = getHistory()
      h[key] = { status: 'uploaded', count: items.length, uploadedAt: Date.now() }
      saveHistory(h)
      setHistoryState(h)
      setMessage(`Saved ${items.length} snapshots for ${key}`)
      if (typeof refreshCallback === 'function') await refreshCallback(currentInterval)
    } catch (err) {
      console.error(err)
      setMessage('Import failed: ' + (err && err.message ? err.message : String(err)))
    }
    setBusy(false)
  }

  async function duplicateLatestToDate(y, m, d) {
    setBusy(true)
    setMessage('Duplicating latest snapshots...')
    try {
      const latest = await storage.getLatestAll()
      if (!latest || !latest.length) {
        setMessage('No snapshots found to duplicate')
        setBusy(false)
        return
      }
      const ts = startOfDayUtc(y, m, d)
      const items = latest.map(l => ({ symbol: l.symbol, price: l.price, volume: l.volume, daily_change_1d: l.daily_change_1d || l.raw && l.raw.daily_pct || 0, price_change_percentage_24h: l.price_change_percentage_24h || l.daily_change_1d || 0, ts }))
      await storage.saveSnapshots(items)
      const key = formatDateKey(y, m, d)
      const h = getHistory()
      h[key] = { status: 'forwarded', count: items.length, forwardedAt: Date.now() }
      saveHistory(h)
      setHistoryState(h)
      setMessage(`Duplicated ${items.length} snapshots to ${key}`)
      // do NOT auto-refresh so user can undo if duplication was accidental
    } catch (err) {
      console.error(err)
      setMessage('Duplicate failed: ' + (err && err.message ? err.message : String(err)))
    }
    setBusy(false)
  }

  async function undoLastForward() {
    if (!lastForwardedKey) {
      setMessage('No forwarded date to undo')
      return
    }
    try {
      const parts = lastForwardedKey.split('-')
      const y = parseInt(parts[0],10)
      const m = parseInt(parts[1],10)
      const d = parseInt(parts[2],10)
      const ts = startOfDayUtc(y, m, d)
      await storage.purgeSnapshotsAt(ts)
      const h = getHistory()
      delete h[lastForwardedKey]
      saveHistory(h)
      setHistoryState(h)
      setMessage(`Removed forwarded snapshots for ${lastForwardedKey}`)
      if (typeof refreshCallback === 'function') await refreshCallback(currentInterval)
    } catch (err) {
      console.error(err)
      setMessage('Undo failed: ' + (err && err.message ? err.message : String(err)))
    }
  }

  async function bulkImportFiles(files) {
    if (!files || !files.length) return
    setBusy(true)
    setMessage('Bulk import starting...')
    const results = []
    for (const f of Array.from(files)) {
      // try parse date from filename: YYYY-MM-DD or YYYYMMDD
      const name = f.name || ''
      let m = name.match(/(\d{4})[-_](\d{2})[-_](\d{2})/)
      if (!m) m = name.match(/(\d{4})(\d{2})(\d{2})/)
      if (!m) {
        results.push({ file: name, ok: false, reason: 'no-date-in-filename' })
        continue
      }
      const y = parseInt(m[1], 10)
      const mm = parseInt(m[2], 10)
      const dd = parseInt(m[3], 10)
      try {
        await importFileForDate(f, y, mm, dd)
        results.push({ file: name, ok: true })
      } catch (err) {
        results.push({ file: name, ok: false, reason: err && err.message ? err.message : String(err) })
      }
    }
    setMessage('Bulk import finished: ' + results.filter(r=>r.ok).length + '/' + results.length + ' imported')
    setBusy(false)
  }

  function markClosed(y, m, d) {
    const key = formatDateKey(y, m, d)
    const h = getHistory()
    h[key] = { status: 'closed', count: 0, markedAt: Date.now() }
    saveHistory(h)
    setHistoryState(h)
    setMessage(`${key} marked closed`)
  }

  function onDrop(e, y, m, d) {
    e.preventDefault()
    const f = e.dataTransfer.files && e.dataTransfer.files[0]
    if (f) importFileForDate(f, y, m, d)
  }

  const monthInfo = useMemo(() => {
    const y = navYear
    const m = navMonth
    const first = new Date(Date.UTC(y, m - 1, 1))
    const startDay = first.getUTCDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    return { year: y, month: m, startDay, daysInMonth }
  }, [navYear, navMonth])

  // last real uploaded date (only status === 'uploaded') - used to lock earlier dates
  const lastUploadedKey = useMemo(() => {
    const keys = Object.entries(historyState).filter(([k,v]) => v && v.status === 'uploaded').map(([k])=>k)
    if (!keys.length) return null
    keys.sort()
    return keys.pop()
  }, [historyState])

  // last forwarded date (status === 'forwarded') - used to offer an Undo
  const lastForwardedKey = useMemo(() => {
    const keys = Object.entries(historyState).filter(([k,v]) => v && v.status === 'forwarded').map(([k])=>k)
    if (!keys.length) return null
    keys.sort()
    return keys.pop()
  }, [historyState])

  const prevMonth = () => {
    const m = navMonth - 1
    if (m >= 1) setNavMonth(m)
    else { setNavMonth(12); setNavYear(navYear - 1) }
  }
  const nextMonth = () => {
    const m = navMonth + 1
    if (m <= 12) setNavMonth(m)
    else { setNavMonth(1); setNavYear(navYear + 1) }
  }

  return (
    <>
      <div className="csv-floating">
        <button className="csv-toggle" onClick={() => setOpen(true)} title="Open CSV control panel">CSV ▾</button>
      </div>
      {open && (
        <div className="csv-modal">
          <div className="csv-header">
            <strong>CSV Manager</strong>
            <div className="csv-controls">
              <label className="csv-replace"><input type="checkbox" checked={replaceAll} onChange={(e)=>setReplaceAll(e.target.checked)} /> Replace DB</label>
              <button className="btn" onClick={() => { setMessage(''); setHistoryState(getHistory()) }}>Refresh</button>
              <button className="btn btn-close" onClick={() => { setOpen(false); setMessage('') }}>Close</button>
            </div>
          </div>

          <div className="csv-body">
            <div className="csv-left">
              <div className="csv-month">
                <div className="csv-month-nav">
                  <button className="icon-btn" onClick={prevMonth}>&lt;</button>
                  <div className="csv-month-title">{monthInfo.year} - {String(monthInfo.month).padStart(2,'0')}</div>
                  <button className="icon-btn" onClick={nextMonth}>&gt;</button>
                </div>
                <div className="csv-month-sub">Drag CSV onto a date to import</div>
              </div>

              <div className="calendar-weekdays">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="weekday">{d}</div>)}
              </div>

              <div className="calendar-grid">
                {Array.from({length: monthInfo.startDay}).map((_, i) => <div key={'pad-'+i} className="calendar-pad" />)}
                {Array.from({length: monthInfo.daysInMonth}).map((_, idx) => {
                  const day = idx + 1
                  const key = formatDateKey(monthInfo.year, monthInfo.month, day)
                  const meta = historyState[key]
                  const disabled = lastUploadedKey ? (key <= lastUploadedKey) : false
                  const stateClass = meta && meta.status === 'uploaded' ? 'cell-uploaded' : (meta && meta.status === 'closed' ? 'cell-closed' : '')
                  return (
                    <div key={key} onDragOver={(e)=>{ if (!disabled) e.preventDefault() }} onDrop={(e)=>{ if (!disabled) onDrop(e, monthInfo.year, monthInfo.month, day) }} className={`calendar-cell ${stateClass} ${disabled ? 'cell-disabled' : ''}`}>
                      <div className="cell-top">
                        <div className="cell-day">{day}</div>
                        <div className="cell-badges">
                          {meta && meta.status === 'uploaded' && <span className="badge uploaded">{meta.count}</span>}
                          {meta && meta.status === 'closed' && <span className="badge closed">Closed</span>}
                        </div>
                      </div>
                      <div className="cell-actions">
                        <button className="btn btn-import" onClick={()=>{ if (!disabled) {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = '.csv,text/csv'
                          input.onchange = (ev) => { const f = ev.target.files && ev.target.files[0]; if (f) importFileForDate(f, monthInfo.year, monthInfo.month, day) }
                          input.click()
                        }}}>Import</button>
                        <button className="btn btn-close-day" onClick={()=>{ if (!disabled) markClosed(monthInfo.year, monthInfo.month, day) }}>Close Day</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="csv-right">
              <div className="history-title"><strong>History</strong></div>
              <div className="history-list">
                {Object.keys(historyState).length === 0 && <div className="history-empty">No uploads yet</div>}
                {Object.keys(historyState).sort().reverse().map(k => (
                  <div key={k} className="history-row">
                    <div className="history-key">{k}</div>
                    <div className="history-meta">{historyState[k].status}{historyState[k].count ? ' • ' + historyState[k].count : ''}</div>
                  </div>
                ))}
              </div>
              <div className="history-controls">
                <div className="history-actions">
                  <button className="btn" onClick={() => { setMessage(''); setHistoryState(getHistory()) }}>Reload</button>
                    <button className="btn" onClick={() => { const t = new Date(); duplicateLatestToDate(t.getUTCFullYear(), t.getUTCMonth()+1, t.getUTCDate()) }}>Duplicate latest → Today</button>
                    {lastForwardedKey && <button className="btn" onClick={() => undoLastForward()}>Undo last forward ({lastForwardedKey})</button>}
                </div>
                <div className="history-bulk">
                  <label className="bulk-label">Bulk import (filenames should include YYYY-MM-DD or YYYYMMDD):</label>
                  <input className="bulk-input" type="file" multiple accept=".csv,text/csv" onChange={(e)=>bulkImportFiles(e.target.files)} />
                </div>
              </div>
              <div className="history-msg">{message}</div>
            </div>
          </div>

          <div className="csv-footer">
            {busy ? <div className="busy">Working...</div> : <div className="hint">Tip: use calendar to upload CSVs for specific dates. Use Replace DB to wipe existing data before import.</div>}
          </div>
        </div>
      )}
    </>
  )
}
