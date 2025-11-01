import React, { useState, useEffect } from 'react'

// marks: array of { value: number, label: string, open?: boolean }
function formatLabel(v) {
  if (v == null || Number.isNaN(v)) return '-'
  if (typeof v === 'string') return v
  if (v === Number.POSITIVE_INFINITY) return '∞'
  if (v >= 100) return `₨${Math.round(v)}`
  return `₨${Number(v).toFixed(2)}`
}

export default function PriceRange({ marks = [{ value: 0, label: '0' }], value = [0, 0], onChange }) {
  // underlying sliders work on indices 0..marks.length-1
  const maxIndex = Math.max(0, (marks && marks.length ? marks.length - 1 : 0))
  const clampIndex = (i) => Math.max(0, Math.min(maxIndex, i))

  // convert incoming value (numeric pair) into indices if possible
  function valueToIndices(valPair) {
    if (!marks || !marks.length) return [0, 0]
    const [vmin, vmax] = valPair || [marks[0].value, marks[maxIndex].value]
    // find nearest index for each (open-ended max maps to last)
    const idxMin = marks.reduce((best, m, i) => Math.abs((m.value || 0) - vmin) < Math.abs((marks[best].value || 0) - vmin) ? i : best, 0)
    const idxMax = (vmax === Number.POSITIVE_INFINITY) ? maxIndex : marks.reduce((best, m, i) => Math.abs((m.value || 0) - vmax) < Math.abs((marks[best].value || 0) - vmax) ? i : best, 0)
    return [clampIndex(Math.min(idxMin, idxMax)), clampIndex(Math.max(idxMin, idxMax))]
  }

  const [minIdx, setMinIdx] = useState(() => valueToIndices(value)[0])
  const [maxIdx, setMaxIdx] = useState(() => valueToIndices(value)[1])

  // which thumb is currently active (dragging/focused): 'min' | 'max' | null
  const [activeThumb, setActiveThumb] = useState(null)

  // show editable text fields for left/right values; keep them as strings while typing
  const [leftText, setLeftText] = useState(() => (marks[minIdx] ? String(marks[minIdx].value) : ''))
  const [rightText, setRightText] = useState(() => (marks[maxIdx] ? (marks[maxIdx].open ? '∞' : String(marks[maxIdx].value)) : ''))

  useEffect(() => {
    const [i0, i1] = valueToIndices(value)
    setMinIdx(i0)
    setMaxIdx(i1)
    setLeftText(marks[i0] ? String(marks[i0].value) : '')
    setRightText(marks[i1] ? (marks[i1].open ? '∞' : String(marks[i1].value)) : '')
  }, [value, marks])

  // clear active state on global up events (mouse / touch)
  useEffect(() => {
    function onUp() { setActiveThumb(null) }
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  function commitChange(i0, i1) {
    const a = marks[i0] && marks[i0].value != null ? marks[i0].value : 0
    const bMark = marks[i1]
    const b = bMark && bMark.open ? Number.POSITIVE_INFINITY : (bMark && bMark.value != null ? bMark.value : a)
    onChange && onChange([a, b])
    // sync textual displays
    setLeftText(String(a))
    setRightText(b === Number.POSITIVE_INFINITY ? '∞' : String(b))
  }

  function handleMinIdx(e) {
    const i = clampIndex(Math.min(Number(e.target.value), maxIdx))
    setMinIdx(i)
    commitChange(i, maxIdx)
  }

  function handleMaxIdx(e) {
    const i = clampIndex(Math.max(Number(e.target.value), minIdx))
    setMaxIdx(i)
    commitChange(minIdx, i)
  }

  // when user types a numeric value in the left/right input, map to nearest mark
  function handleLeftTextChange(e) {
    setLeftText(e.target.value)
    const v = Number(e.target.value)
    if (!Number.isNaN(v)) {
      // map to nearest index
      const idx = marks.reduce((best, m, i) => Math.abs((m.value || 0) - v) < Math.abs((marks[best].value || 0) - v) ? i : best, 0)
      const iClamped = clampIndex(Math.min(idx, maxIdx))
      setMinIdx(iClamped)
      commitChange(iClamped, maxIdx)
    }
  }

  function handleRightTextChange(e) {
    setRightText(e.target.value)
    const s = e.target.value.trim()
    if (s === '∞' || s === 'inf' || s.toLowerCase() === 'infinity') {
      const last = maxIndex
      setMaxIdx(last)
      commitChange(minIdx, last)
      return
    }
    const v = Number(s)
    if (!Number.isNaN(v)) {
      const idx = marks.reduce((best, m, i) => Math.abs((m.value || 0) - v) < Math.abs((marks[best].value || 0) - v) ? i : best, 0)
      const iClamped = clampIndex(Math.max(idx, minIdx))
      setMaxIdx(iClamped)
      commitChange(minIdx, iClamped)
    }
  }

  // clickable ticks behavior
  function onTickClick(i) {
    const mid = (minIdx + maxIdx) / 2
    if (i <= Math.floor(mid)) {
      const newMin = clampIndex(i)
      setMinIdx(newMin)
      commitChange(newMin, maxIdx)
    } else {
      const newMax = clampIndex(i)
      setMaxIdx(newMax)
      commitChange(minIdx, newMax)
    }
  }

  // compute CSS custom properties for active track fill
  const leftPct = (minIdx / Math.max(1, marks.length - 1)) * 100
  const rightPct = (maxIdx / Math.max(1, marks.length - 1)) * 100

  return (
    <div className="price-filter">
      {/* row that contains left input, slider, and right input */}
      <div className="range-row">
        <input className="price-input left" value={leftText} onChange={handleLeftTextChange} />

        <div className="range-wrap" style={{ ['--left' /* style var name */]: `${leftPct}%`, ['--right' /* style var name */]: `${100 - rightPct}%` }}>
          {/* tick labels inside the range-wrap so they align exactly with the track */}
          <div className="price-labels">
            {marks.map((m, i) => {
              const left = (i / Math.max(1, marks.length - 1)) * 100
              return (
                <div key={i} className="tick" style={{ left: `${left}%` }} title={String(m.value)} onClick={() => onTickClick(i)}>
                  <div className="tick-label">{m.label}</div>
                  <div className="tick-line" aria-hidden />
                </div>
              )
            })}
          </div>

          <input
            className={`range range-min ${activeThumb === 'min' ? 'active' : ''}`}
            type="range"
            min={0}
            max={maxIdx}
            step={1}
            value={minIdx}
            onChange={handleMinIdx}
            onMouseDown={() => setActiveThumb('min')}
            onTouchStart={() => setActiveThumb('min')}
            onFocus={() => setActiveThumb('min')}
            onBlur={() => setActiveThumb(null)}
          />
          <input
            className={`range range-max ${activeThumb === 'max' ? 'active' : ''}`}
            type="range"
            min={minIdx}
            max={maxIndex}
            step={1}
            value={maxIdx}
            onChange={handleMaxIdx}
            onMouseDown={() => setActiveThumb('max')}
            onTouchStart={() => setActiveThumb('max')}
            onFocus={() => setActiveThumb('max')}
            onBlur={() => setActiveThumb(null)}
          />
          <div className="range-track" aria-hidden />
        </div>

        <input className="price-input right" value={rightText} onChange={handleRightTextChange} />
      </div>
    </div>
  )
}

