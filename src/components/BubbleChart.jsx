
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as d3 from 'd3';
import BubbleTooltip from './BubbleTooltip';
import { updatePrices, getHistory, getTrend, updatePreviousValues } from '../lib/priceHistoryStore';

export default forwardRef(function BubbleChart({ data, width = 900, height = 600, single = false, radiusScale = null, selections = {}, aggregations = null, onSelectCoin = null, selectedIndex = null, currentInterval = null }, ref) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [size, setSize] = useState({ width, height });
  const simRef = useRef(null);
  const nodesRef = useRef(null);
  const circleSelRef = useRef(null);
  const labelSelRef = useRef(null);
  const prevIntervalRef = useRef(null);
  const prevDataRef = useRef(null);
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };

  // Tooltip state
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef(null);

  // expose fitToView to parent via ref (must be top-level Hook)
  useImperativeHandle(ref, () => ({
    fitToView: () => {
      try {
        const w = Math.max(100, size.width - margin.left - margin.right);
        const h = Math.max(100, size.height - margin.top - margin.bottom);
        const nodes = nodesRef.current || [];
        if (!nodes.length) return;
        const xs = nodes.map((n) => n.x);
        const ys = nodes.map((n) => n.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const padding = 20;
        const boxW = maxX - minX || 1;
        const boxH = maxY - minY || 1;
        const targetW = w - padding * 2;
        const targetH = h - padding * 2;
        const scale = Math.min(targetW / boxW, targetH / boxH, 1);

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        nodes.forEach((n) => {
          n.x = (n.x - cx) * scale + w / 2;
          n.y = (n.y - cy) * scale + h / 2;
        });

        if (circleSelRef.current) circleSelRef.current.attr('transform', (d) => `translate(${d.x},${d.y})`);
        if (labelSelRef.current) labelSelRef.current.attr('transform', (d) => `translate(${d.x},${d.y})`);

        if (simRef.current) {
          simRef.current.alpha(0.3).restart();
          setTimeout(() => {
            simRef.current.alpha(0.001);
          }, 400);
        }
      } catch {
        // ignore
      }
    }
  }));

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    let roTimer = null;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (roTimer) clearTimeout(roTimer);
        roTimer = setTimeout(() => {
          setSize({ width: Math.max(100, Math.floor(rect.width)), height: Math.max(100, Math.floor(rect.height)) });
        }, 120);
      }
    });
    obs.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width && rect.height) setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    return () => obs.disconnect();
  }, []);

  // Update price history store whenever data changes (for tooltip sparklines)
  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      updatePrices(data);
    }
  }, [data]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const intervalChanged = prevIntervalRef.current !== currentInterval && prevIntervalRef.current !== null;
    prevIntervalRef.current = currentInterval;

    // If interval changed, do hard refresh
    if (intervalChanged) {
      svg.selectAll('*').remove();
      nodesRef.current = null;
      circleSelRef.current = null;
      labelSelRef.current = null;
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
    }

    if (!data || data.length === 0) {
      // Clear visualization when data is empty (e.g., filter returned 0 results)
      svg.selectAll('*').remove();
      nodesRef.current = null;
      circleSelRef.current = null;
      labelSelRef.current = null;
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
      setVisibleCount(0);
      return;
    }

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const w = Math.max(100, size.width - margin.left - margin.right);
    const h = Math.max(100, size.height - margin.top - margin.bottom);

    // Compute a dynamic global size multiplier based on how many bubbles we will render.
    // When there are few bubbles we want them to scale up to fill empty space; when many
    // bubbles are present we keep sizes more conservative to avoid heavy overlap.
    function computeGlobalMultiplier(count) {
      // Scale bubbles based on density: modest boost for sparse views, mild shrink for very dense ones.
      if (count >= 200) return 1.0;
      if (count >= 140) return 1.05;
      if (count >= 100) return 1.12;
      if (count >= 60) return 1.20;
      if (count >= 30) return 1.30;
      return 1.45;
    }

    // defs: blur filter for glow and radial gradient for bubble shading
    // Check if defs already exists (for smooth updates), otherwise create
    let defs = svg.select('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
      // Only create base filters/gradients if they don't exist
      defs
        .append('filter')
        .attr('id', 'glow')
        .append('feGaussianBlur')
        .attr('stdDeviation', 22)
        .attr('result', 'coloredBlur');

      const grad = defs.append('radialGradient').attr('id', 'bubbleGrad').attr('cx', '35%').attr('cy', '30%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,0.10)');
      grad.append('stop').attr('offset', '60%').attr('stop-color', 'rgba(255,255,255,0.03)');
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#0b1114');

      const gGreen = defs.append('radialGradient').attr('id', 'grad-green').attr('cx', '30%').attr('cy', '30%');
      gGreen.append('stop').attr('offset', '0%').attr('stop-color', '#0bff6a').attr('stop-opacity', 0.95);
      gGreen.append('stop').attr('offset', '60%').attr('stop-color', '#0aa34a').attr('stop-opacity', 0.95);
      gGreen.append('stop').attr('offset', '100%').attr('stop-color', '#03150a').attr('stop-opacity', 0.95);

      const gRed = defs.append('radialGradient').attr('id', 'grad-red').attr('cx', '30%').attr('cy', '30%');
      gRed.append('stop').attr('offset', '0%').attr('stop-color', '#ff7b7b').attr('stop-opacity', 0.95);
      gRed.append('stop').attr('offset', '60%').attr('stop-color', '#c93b3b').attr('stop-opacity', 0.95);
      gRed.append('stop').attr('offset', '100%').attr('stop-color', '#160606').attr('stop-opacity', 0.95);

      // blue gradient for neutral/no change (0.0%) - softer tone to match green/red theme
      const gBlue = defs.append('radialGradient').attr('id', 'grad-blue').attr('cx', '30%').attr('cy', '30%');
      gBlue.append('stop').attr('offset', '0%').attr('stop-color', '#e0f2ff').attr('stop-opacity', 0.95);
      gBlue.append('stop').attr('offset', '60%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.95);
      gBlue.append('stop').attr('offset', '100%').attr('stop-color', '#041321').attr('stop-opacity', 0.95);

      defs.append('filter').attr('id', 'inner-shadow').append('feDropShadow').attr('dx', 0).attr('dy', 8).attr('stdDeviation', 14).attr('flood-color', '#000').attr('flood-opacity', 0.45);
      defs.append('filter').attr('id', 'drop').append('feDropShadow').attr('dx', 0).attr('dy', 3).attr('stdDeviation', 4).attr('flood-color', '#000').attr('flood-opacity', 0.45);

      const textFilter = defs.append('filter').attr('id', 'textShadow');
      textFilter.append('feOffset').attr('dx', 0).attr('dy', 1).attr('result', 'off');
      textFilter.append('feGaussianBlur').attr('in', 'off').attr('stdDeviation', 0.6).attr('result', 'blur');
      const feMerge = textFilter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'blur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    }

    // helper: check if percentage change is neutral/no change (exact 0.0% only)
    function isNeutralChange(pct) {
      const v = Number(pct || 0);
      // UI mein hum 1 decimal dikha rahe hain, is liye 1-decimal rounded value check karein
      // Sirf exact 0.0% ko blue banana hai, 0.01% ya 0.1% ko nahi
      return Number(v.toFixed(1)) === 0;
    }

    // helper: bucketed fill opacity based on absolute percent change (0..%)
    // Buckets: 0-0.99% -> 0.09, 1-1.99% -> 0.12, 2-2.99% -> 0.16, 3-3.99% -> 0.20, 4-4.99% -> 0.24,
    // 5-6.99% -> 0.28, 7-9.99% -> 0.32, >=10% -> 0.36
    function bucketFillOpacity(absPct) {
      if (absPct < 1) return 0.09;
      if (absPct < 2) return 0.12;
      if (absPct < 3) return 0.16;
      if (absPct < 4) return 0.20;
      if (absPct < 5) return 0.24;
      if (absPct < 7) return 0.28;
      if (absPct < 10) return 0.32;
      return 0.36;
    }

    // Main group - ensure we perform robust selection to avoid duplicate groups (artifacts)
    // Try to select by class first
    let g = svg.select('g.main-bubble-group');

    // If not found by class, check if ANY group exists and adopt it (legacy support/cleanup)
    if (g.empty()) {
      const legacyG = svg.select('g');
      if (!legacyG.empty()) {
        g = legacyG.classed('main-bubble-group', true);
      } else {
        g = svg.append('g').attr('class', 'main-bubble-group');
      }
    }

    // Always update transform to match current margins/size
    g.attr('transform', `translate(${margin.left},${margin.top})`);

    // Safety cleanup: Remove any other top-level 'g' elements that might have accumulated as ghosts
    svg.selectAll(function () { return this.childNodes; })
      .filter(function () {
        // Remove if it's a 'g' element but NOT our current main group
        return this.tagName === 'g' && this !== g.node();
      })
      .remove();

    // Determine inferred maxima used for sizing based on the active size selection.
    // If a custom radiusScale prop is provided prefer it; otherwise we'll build
    // a d3.scaleSqrt for the chosen metric (Performance -> percent, Volume -> volume, Market Cap -> market_cap).
    const inferredMaxPct = d3.max(data, (d) => Math.abs(d.price_change_percentage_24h || 0)) || 1;
    const inferredMaxVol = d3.max(data, (d) => {
      if (!d) return 0;
      if (d.volume != null) return Number(String(d.volume).replace(/,/g, '')) || 0;
      if (d.total_volume != null) return Number(String(d.total_volume).replace(/,/g, '')) || 0;
      if (d['24h_volume'] != null) return Number(String(d['24h_volume']).replace(/,/g, '')) || 0;
      if (d.v != null) return Number(String(d.v).replace(/,/g, '')) || 0;
      if (d.data) {
        if (d.data.volume != null) return Number(String(d.data.volume).replace(/,/g, '')) || 0;
        if (d.data.total_volume != null) return Number(String(d.data.total_volume).replace(/,/g, '')) || 0;
        if (d.data['24h_volume'] != null) return Number(String(d.data['24h_volume']).replace(/,/g, '')) || 0;
      }
      return 0;
    }) || 1;
    const inferredMaxMc = d3.max(data, (d) => {
      if (!d) return 0;
      if (d.market_cap != null) return Number(d.market_cap) || 0;
      if (d.data && d.data.market_cap != null) return Number(d.data.market_cap) || 0;
      if (d.marketCap != null) return Number(d.marketCap) || 0;
      return 0;
    }) || 1;

    // reduce number of rendered nodes in dense views to improve legibility and perf
    // If a specific index is selected we want to render all its members so user can see progress.
    const maxNodes = (selectedIndex != null) ? data.length : 140; // when index selected, render full list
    const used = data.slice(0, maxNodes);

    // Demo overrides removed: sizing will now be driven only by real data / provided aggregations.

    // Build a sizing scale according to current selections.size. This scale converts
    // the chosen metric into a visual radius. Range tuned to previous defaults.
    let sizeMetric = 'Performance';
    if (selections && selections.size) sizeMetric = selections.size;

    // Debug logging
    console.log('[BubbleChart] Size metric:', sizeMetric);
    if (sizeMetric === 'Volatility') {
      const sampleVolatility = used.slice(0, 5).map(d => ({
        symbol: d.symbol || d.id,
        volatility: d.volatility,
        dataVolatility: d.data?.volatility
      }));
      console.log('[BubbleChart] Sample volatility values:', sampleVolatility);
    }

    let sizeMax = 1;
    if (sizeMetric === 'Performance') {
      // percent-based sizing (absolute percent)
      sizeMax = d3.max(used, (d) => {
        const demo = d.__overrideDemo != null ? d.__overrideDemo : (d.price_change_percentage_24h || 0);
        if (aggregations && selections && selections.size === 'Performance') {
          const agg = aggregations.get(d.symbol || d.id || (d.name && d.name.toUpperCase()));
          return Math.abs(agg != null ? agg : demo);
        }
        return Math.abs(demo);
      }) || inferredMaxPct || 1;
    } else if (sizeMetric === 'Volume') {
      // volume-based sizing
      sizeMax = d3.max(used, (d) => {
        if (!d) return 0;
        if (d.volume != null) return Number(String(d.volume).replace(/,/g, '')) || 0;
        if (d.total_volume != null) return Number(String(d.total_volume).replace(/,/g, '')) || 0;
        if (d['24h_volume'] != null) return Number(String(d['24h_volume']).replace(/,/g, '')) || 0;
        if (d.v != null) return Number(String(d.v).replace(/,/g, '')) || 0;
        if (d.data) {
          if (d.data.volume != null) return Number(String(d.data.volume).replace(/,/g, '')) || 0;
          if (d.data.total_volume != null) return Number(String(d.data.total_volume).replace(/,/g, '')) || 0;
          if (d.data['24h_volume'] != null) return Number(String(d.data['24h_volume']).replace(/,/g, '')) || 0;
        }
        return 0;
      }) || inferredMaxVol || 1;
    } else if (sizeMetric === 'Volatility') {
      // Volatility-based sizing
      sizeMax = d3.max(used, (d) => {
        if (!d) return 0;
        if (d.volatility != null) return Number(d.volatility) || 0;
        if (d.data && d.data.volatility != null) return Number(d.data.volatility) || 0;
        return 0;
      }) || 10; // Default max volatility if none found
    } else if (sizeMetric === 'Relative Volume') {
      // Relative Volume-based sizing
      sizeMax = d3.max(used, (d) => {
        if (!d) return 0;
        if (d.relative_volume != null) return Number(d.relative_volume) || 0;
        if (d.data && d.data.relative_volume != null) return Number(d.data.relative_volume) || 0;
        return 0;
      }) || 5; // Default max relative volume if none found (5x average)
    } else {
      // Market Cap
      sizeMax = d3.max(used, (d) => {
        if (!d) return 0;
        if (d.market_cap != null) return Number(d.market_cap) || 0;
        if (d.data && d.data.market_cap != null) return Number(d.data.market_cap) || 0;
        if (d.marketCap != null) return Number(d.marketCap) || 0;
        return 0;
      }) || inferredMaxMc || 1;
    }

    const localRadiusScale = d3.scaleSqrt().domain([0, Math.max(1, sizeMax)]).range([16, 140]);

    // localMaxPct: used for color interpolation and magnitude-based visuals (based on percent change)
    const localMaxPct = d3.max(used, (d) => {
      const demo = d.__overrideDemo != null ? d.__overrideDemo : (d.price_change_percentage_24h || 0);
      if (aggregations && selections && selections.size === 'Performance') {
        const agg = aggregations.get(d.symbol || d.id || (d.name && d.name.toUpperCase()));
        return Math.abs(agg != null ? agg : demo);
      }
      return Math.abs(demo);
    }) || inferredMaxPct || 1;

    // small helpers to safely extract numeric metrics from a node/data object
    function extractVolumeItem(x) {
      if (!x) return 0;
      const candidate = x.volume ?? x.total_volume ?? x['24h_volume'] ?? x.v ?? (x.data ? (x.data.volume ?? x.data.total_volume ?? x.data['24h_volume']) : undefined);
      const cleaned = String(candidate ?? 0).replace(/,/g, '');
      return Number(cleaned) || 0;
    }
    function extractMarketCapItem(x) {
      if (!x) return 0;
      const candidate = x.market_cap ?? (x.data ? x.data.market_cap : undefined) ?? x.marketCap ?? 0;
      return Number(candidate) || 0;
    }

    // If single mode is requested, pick the largest according to current sizing metric
    if (single) {
      // pick the largest according to current sizing metric
      const largest = used.reduce((a, b) => {
        try {
          if (selections && selections.size === 'Volume') {
            const va = extractVolumeItem(a);
            const vb = extractVolumeItem(b);
            return vb > va ? b : a;
          }
          if (selections && selections.size === 'Market Cap') {
            const ma = extractMarketCapItem(a);
            const mb = extractMarketCapItem(b);
            return mb > ma ? b : a;
          }
          if (selections && selections.size === 'Volatility') {
            const va = (a.volatility != null ? a.volatility : (a.data && a.data.volatility)) || 0;
            const vb = (b.volatility != null ? b.volatility : (b.data && b.data.volatility)) || 0;
            return vb > va ? b : a;
          }
          if (selections && selections.size === 'Relative Volume') {
            const va = (a.relative_volume != null ? a.relative_volume : (a.data && a.data.relative_volume)) || 0;
            const vb = (b.relative_volume != null ? b.relative_volume : (b.data && b.data.relative_volume)) || 0;
            return vb > va ? b : a;
          }
        } catch (e) {
          // fall back to percent if any error
        }
        return Math.abs(b.price_change_percentage_24h || 0) > Math.abs(a.price_change_percentage_24h || 0) ? b : a;
      }, used[0] || null);
      if (!largest) return;
      // compute baseR using the active size metric (allow external radiusScale override)
      if (radiusScale) {
        // delegate to provided radiusScale (assumed to accept the chosen metric)
        let largestMetricVal;
        if (selections && selections.size === 'Performance') {
          largestMetricVal = Math.abs(largest.price_change_percentage_24h || 0);
        } else if (selections && selections.size === 'Volume') {
          largestMetricVal = extractVolumeItem(largest);
        } else if (selections && selections.size === 'Volatility') {
          largestMetricVal = (largest.volatility != null ? largest.volatility : (largest.data && largest.data.volatility)) || 0;
        } else if (selections && selections.size === 'Relative Volume') {
          largestMetricVal = (largest.relative_volume != null ? largest.relative_volume : (largest.data && largest.data.relative_volume)) || 0;
        } else {
          largestMetricVal = extractMarketCapItem(largest);
        }
        // radiusScale expected to map raw metric -> radius
        var baseR = Math.max(12, Math.round(radiusScale(largestMetricVal)));
      } else {
        // use our computed localRadiusScale
        if (selections && selections.size === 'Volume') {
          const lv = extractVolumeItem(largest) || 1;
          var baseR = Math.max(12, Math.round(d3.scaleSqrt().domain([0, Math.max(1, lv || sizeMax)]).range([12, 160])(lv)));
        } else if (selections && selections.size === 'Market Cap') {
          const lm = extractMarketCapItem(largest) || 1;
          var baseR = Math.max(12, Math.round(d3.scaleSqrt().domain([0, Math.max(1, lm || sizeMax)]).range([12, 160])(lm)));
        } else if (selections && selections.size === 'Volatility') {
          const lv = (largest.volatility != null ? largest.volatility : (largest.data && largest.data.volatility)) || 1;
          var baseR = Math.max(12, Math.round(d3.scaleSqrt().domain([0, Math.max(1, lv || sizeMax)]).range([12, 160])(lv)));
        } else if (selections && selections.size === 'Relative Volume') {
          const lrv = (largest.relative_volume != null ? largest.relative_volume : (largest.data && largest.data.relative_volume)) || 1;
          var baseR = Math.max(12, Math.round(d3.scaleSqrt().domain([0, Math.max(1, lrv || sizeMax)]).range([12, 160])(lrv)));
        } else {
          var baseR = Math.max(12, Math.round(d3.scaleSqrt().domain([0, inferredMaxPct]).range([12, 160])(Math.abs(largest.price_change_percentage_24h || 0))));
        }
      }
      // ensure the single bubble is visually prominent by scaling up relative to viewport
      let displayR = Math.min(Math.max(baseR, Math.min(w, h) * 0.18), Math.min(w, h) / 2 - 16);
      // compute multiplier based on number of used nodes so single-mode scales sensibly
      const singleMult = computeGlobalMultiplier(used.length);
      // apply multiplier so single-mode bubble grows with others
      displayR = Math.round(displayR * singleMult);
      const singleNode = { id: largest.id, r: Math.round(baseR * singleMult), x: w / 2, y: h / 2, data: largest, displayR };

      // create a radial gradient for this node (richer, glass-like)
      const pctForGrad = singleNode.data.price_change_percentage_24h ?? 0;
      let base, mid, dark;
      if (isNeutralChange(pctForGrad)) {
        base = '#3b82f6'; mid = '#93c5fd'; dark = '#041321';
      } else if (pctForGrad >= 0) {
        base = '#24c55e'; mid = '#6fe987'; dark = '#0f4f2b';
      } else {
        base = '#e24b4b'; mid = '#ff9a9a'; dark = '#6b2a2a';
      }
      const rg = defs.append('radialGradient').attr('id', `grad-${singleNode.id}`).attr('cx', '30%').attr('cy', '25%');
      rg.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.38);
      rg.append('stop').attr('offset', '28%').attr('stop-color', mid).attr('stop-opacity', 0.42);
      rg.append('stop').attr('offset', '70%').attr('stop-color', base).attr('stop-opacity', 0.36);
      rg.append('stop').attr('offset', '100%').attr('stop-color', dark).attr('stop-opacity', 0.72);

      // inner shadow gradient to give depth (overlay multiply)
      const inner = defs.append('radialGradient').attr('id', `inner-${singleNode.id}`).attr('cx', '50%').attr('cy', '60%');
      inner.append('stop').attr('offset', '45%').attr('stop-color', 'rgba(0,0,0,0)').attr('stop-opacity', 0);
      inner.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.26)').attr('stop-opacity', 0.9);

      // clip for the logo so it sits nicely inside the circle
      defs
        .append('clipPath')
        .attr('id', `clip-${singleNode.id}`)
        .append('circle')
        .attr('r', Math.max(2, singleNode.displayR - 8))
        .attr('cx', 0)
        .attr('cy', 0);

      // create groups
      const circlesGroup = g.append('g').attr('class', 'circles-group');
      const labelsGroup = g.append('g').attr('class', 'labels-group');

      const n = circlesGroup.append('g').attr('class', 'node').attr('transform', `translate(${singleNode.x},${singleNode.y})`);

      // same layered visuals as before but tuned for glass look
      const pct = singleNode.data.price_change_percentage_24h ?? 0;
      const ringColor = isNeutralChange(pct) ? '#3b82f6' : (pct >= 0 ? '#23c55e' : '#ff4d4d');

      // single-mode: render only a stroked ring (no fill or labels)
      // subtle fill matching the rim color (very low opacity)
      const fillOpacitySingle = bucketFillOpacity(Math.abs(pct));
      n.append('circle')
        .attr('class', 'ring-fill')
        .attr('r', Math.max(0, singleNode.displayR - Math.max(2, Math.round(singleNode.displayR * 0.06))))
        .attr('fill', ringColor)
        .style('opacity', fillOpacitySingle)
        .style('pointer-events', 'none');

      n.append('circle')
        .attr('class', 'ring-only')
        .attr('r', singleNode.displayR)
        .attr('fill', 'none')
        .attr('stroke', ringColor)
        .attr('stroke-width', Math.max(4, singleNode.displayR * 0.12))
        .style('opacity', 0.95);

      svg.attr('width', size.width).attr('height', size.height).attr('viewBox', `0 0 ${size.width} ${size.height}`);
      return () => {
        svg.on('.zoom', null);
      };
    }

    // build nodes for multi-node rendering (radius + initial positions)
    // Don't reuse previous positions to prevent clustering - force fresh distribution
    // const prevMap = new Map((nodesRef.current || []).map((n) => [n.id, n]));
    const nodes = used.map((d) => {
      // respect demo override (for visualization) if present
      const overridePct = d.__overrideDemo;
      // base sample percent (from data)
      let samplePct = overridePct != null ? overridePct : (d.price_change_percentage_24h || 0);
      // if aggregations provided and size selection is Performance, use aggregation value when available
      if (aggregations && selections && selections.size === 'Performance') {
        const agg = aggregations.get(d.symbol || d.id || (d.name && d.name.toUpperCase()));
        if (agg != null) samplePct = agg;
      }
      const pctAbs = Math.abs(samplePct);
      // Use localRadiusScale to size rings based on the post-override distribution so demo movers look big
      // base radius depends on active size metric. For Performance use pctAbs,
      // for Volume use the node's volume, otherwise use market_cap.
      let baseR;
      if (selections && selections.size === 'Volume') {
        const volVal = extractVolumeItem(d) || 0;
        baseR = Math.max(8, Math.round(localRadiusScale(volVal)));
      } else if (selections && selections.size === 'Market Cap') {
        const mcVal = extractMarketCapItem(d) || 0;
        baseR = Math.max(8, Math.round(localRadiusScale(mcVal)));
      } else if (selections && selections.size === 'Volatility') {
        const volVal = (d.volatility != null ? d.volatility : (d.data && d.data.volatility)) || 0;
        baseR = Math.max(8, Math.round(localRadiusScale(volVal)));
      } else if (selections && selections.size === 'Relative Volume') {
        const relVolVal = (d.relative_volume != null ? d.relative_volume : (d.data && d.data.relative_volume)) || 0;
        baseR = Math.max(8, Math.round(localRadiusScale(relVolVal)));
      } else {
        baseR = Math.max(8, Math.round(localRadiusScale(pctAbs)));
      }

      // PSX-aware sizing: compute how much of the allowed daily move this symbol used
      // Rules: if price <= 10 PKR then daily absolute cap = 1 PKR else cap = 10% of price
      // Compute normalized = delta / cap in [-1,1], map magnitude -> multiplier (1..MAX_INCREASE)
      // IMPORTANT: Only apply this multiplier when sizing by Performance, not for Volume/Market Cap/Volatility
      if (selections && selections.size === 'Performance') {
        try {
          const P = (d.data && Number(d.data.price)) || 0;
          const pctVal = Number(samplePct) || 0; // percent (e.g., 5 means 5%)
          // absolute change in PKR
          const delta = (pctVal / 100) * P;
          const cap = P > 0 ? (P <= 10 ? 1 : 0.1 * P) : null;
          if (cap && isFinite(cap) && cap > 0) {
            const normalized = Math.max(-1, Math.min(1, delta / cap));
            const magnitude = Math.abs(normalized);
            // parameters (tweakable)
            const MAX_INCREASE = 2.2; // fully-performing bubble scales up to ~2.2x
            const ALPHA = 0.6; // curve exponent (sqrt-like emphasis)
            const factor = 1 + (MAX_INCREASE - 1) * Math.pow(magnitude, ALPHA);
            baseR = Math.max(8, Math.round(baseR * factor));
          }
        } catch (e) {
          // if any error, fall back to baseR computed earlier
        }
      }

      const r = baseR;
      // Force fresh random positioning - will be overridden by anchor grid anyway
      return { id: d.id, r, x: null, y: null, vx: 0, vy: 0, data: d, overridePct: overridePct };
    });

    // viewport-aware global radius scaling: compute an optimal scale so bubbles fit
    // in the available area. This keeps all visuals the same but ensures bubbles
    // don't overlap or clip out of the view when there are many nodes.
    const minDim = Math.min(w, h);
    const rawMaxR = d3.max(nodes, (n) => n.r) || 1;

    try {
      // Calculate total available area
      const totalArea = w * h;
      // Target fill ratio: ~60% of the screen filled with bubbles
      const TARGET_FILL_RATIO = 0.60;
      const targetArea = totalArea * TARGET_FILL_RATIO;

      // Calculate current total area of all bubbles (sum of pi*r^2)
      const currentArea = nodes.reduce((acc, n) => acc + Math.PI * Math.pow(n.r, 2), 0);

      // Calculate scaling factor to match target area
      // scale = sqrt(targetArea / currentArea)
      const scaleFactor = Math.sqrt(targetArea / currentArea);

      // Apply scale to all nodes
      nodes.forEach(n => {
        n.r = n.r * scaleFactor;
      });

    } catch (e) {
      // keep original radii on error
    }

    // helper to derive percent for a node (considers overrides and aggregations)
    function pctForNode(node) {
      if (node.overridePct != null) return node.overridePct;
      if (aggregations && selections && selections.size === 'Performance') {
        const v = aggregations.get(node.data && (node.data.symbol || node.data.id) || node.id);
        if (v != null) return v;
      }
      return node.data && (node.data.price_change_percentage_24h ?? 0);
    }

    // create per-node clipPaths and radial gradients for nicer bubble shading
    // Check if they exist before creating (for smooth updates)
    nodes.forEach((nd) => {
      let clipPath = defs.select(`#clip-${nd.id}`);
      if (clipPath.empty()) {
        clipPath = defs
          .append('clipPath')
          .attr('id', `clip-${nd.id}`);
      }
      let clipCircle = clipPath.select('circle');
      if (clipCircle.empty()) {
        clipCircle = clipPath.append('circle');
      }
      clipCircle
        .attr('r', Math.max(2, nd.r - 4))
        .attr('cx', 0)
        .attr('cy', 0);

      // helper to derive percent for a node (considers overrides and aggregations)
      function pctFor(node) {
        if (node.overridePct != null) return node.overridePct;
        if (aggregations && selections && selections.size === 'Performance') {
          const v = aggregations.get(node.data && (node.data.symbol || node.data.id) || node.id);
          if (v != null) return v;
        }
        return node.data && (node.data.price_change_percentage_24h ?? 0);
      }

      // per-node radial gradient: AIA-style (green for up, blue for neutral, red for down)
      const pct = pctForNode(nd);
      const rg = defs.append('radialGradient').attr('id', `grad-${nd.id}`).attr('cx', '45%').attr('cy', '35%').attr('r', '70%');
      if (isNeutralChange(pct)) {
        // blue colors for neutral/no change bubbles - softer tone to match green/red
        rg.append('stop').attr('offset', '0%').attr('stop-color', '#e0f2ff').attr('stop-opacity', 0.9);
        rg.append('stop').attr('offset', '45%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.86);
        rg.append('stop').attr('offset', '100%').attr('stop-color', '#041321').attr('stop-opacity', 0.95);
      } else if (pct >= 0) {
        // neon-forward greens for up bubbles
        rg.append('stop').attr('offset', '0%').attr('stop-color', '#dfffee').attr('stop-opacity', 0.9);
        rg.append('stop').attr('offset', '45%').attr('stop-color', '#13d36b').attr('stop-opacity', 0.86);
        rg.append('stop').attr('offset', '100%').attr('stop-color', '#01220a').attr('stop-opacity', 0.95);
      } else {
        // warm reds for down bubbles
        rg.append('stop').attr('offset', '0%').attr('stop-color', '#ffecec').attr('stop-opacity', 0.9);
        rg.append('stop').attr('offset', '45%').attr('stop-color', '#ff6060').attr('stop-opacity', 0.86);
        rg.append('stop').attr('offset', '100%').attr('stop-color', '#200707').attr('stop-opacity', 0.95);
      }

      // shine gradient for small highlight near top-left
      const shine = defs.append('radialGradient').attr('id', `shine-${nd.id}`).attr('cx', '35%').attr('cy', '22%');
      // small "mag" factor to subtly vary the shine based on percent magnitude
      const mag = Math.min(1, Math.abs(pct) / 10);
      shine.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.6 * (0.45 + mag * 0.6));
      shine.append('stop').attr('offset', '35%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.12);
      shine.append('stop').attr('offset', '100%').attr('stop-color', '#ffffff').attr('stop-opacity', 0);
    });

    // Initial positioning: Random distribution across entire viewport
    // Responsive to viewport size - bubbles spread randomly everywhere, not grid-based
    // For smooth updates, preserve existing positions
    const existingNodesMap = intervalChanged ? null : (nodesRef.current ? new Map(nodesRef.current.map(n => [n.id, n])) : null);
    const padding = 20; // Padding from edges to account for bubble radius
    nodes.forEach((nd, i) => {
      // If smooth update and node exists, preserve position
      if (existingNodesMap && existingNodesMap.has(nd.id)) {
        const existing = existingNodesMap.get(nd.id);
        nd.x = existing.x;
        nd.y = existing.y;
        nd.vx = existing.vx || 0;
        nd.vy = existing.vy || 0;
        nd.__baseX = existing.__baseX;
        nd.__baseY = existing.__baseY;
        nd.__phase = existing.__phase;
      } else {
        // Calculate safe bounds for random positioning (accounting for bubble radius)
        const maxX = Math.max(nd.r + padding, w - nd.r - padding);
        const minX = nd.r + padding;
        const maxY = Math.max(nd.r + padding, h - nd.r - padding);
        const minY = nd.r + padding;

        // Random position across full viewport (responsive to w and h)
        nd.x = minX + Math.random() * Math.max(1, maxX - minX);
        nd.y = minY + Math.random() * Math.max(1, maxY - minY);
        nd.vx = 0;
        nd.vy = 0;
        // Store base position for floating effect
        nd.__baseX = nd.x;
        nd.__baseY = nd.y;
      }
    });

    // Very subtle floating force - like bubbles floating gently in air
    // Bubbles float around their base position, staying in their space
    function wanderForce(strength = 0.06) {
      let nodesInternal;
      function force(alpha) {
        if (!nodesInternal) return;
        const t = Date.now() / 2500; // Slower time for calmer, more subtle movement
        for (const n of nodesInternal) {
          if (n.__phase == null) {
            n.__phase = Math.random() * Math.PI * 2;
            // Ensure base position is stored
            if (n.__baseX == null) n.__baseX = n.x;
            if (n.__baseY == null) n.__baseY = n.y;
          }
          const phase = n.__phase;
          const freq = 0.04; // Very slow frequency for gentle drift (hawa mein float jaisa)

          // Subtle circular motion around base position
          const offsetX = Math.sin(t * freq + phase) * strength * 12;
          const offsetY = Math.cos(t * (freq * 0.75) + phase + 1) * strength * 12;

          // Elastic pull back towards base position (keeps bubbles in their space)
          const pullX = (n.__baseX - n.x) * 0.015;
          const pullY = (n.__baseY - n.y) * 0.015;

          n.vx += (offsetX + pullX) * alpha;
          n.vy += (offsetY + pullY) * alpha;
        }
      }
      force.initialize = (ns) => {
        nodesInternal = ns;
        // Store base positions when initialized
        ns.forEach(n => {
          if (n.__baseX == null) n.__baseX = n.x;
          if (n.__baseY == null) n.__baseY = n.y;
        });
      };
      return force;
    }

    const simulation = d3.forceSimulation(nodes)
      // Charge: Moderate repulsion to prevent clustering
      .force('charge', d3.forceManyBody().strength(d => -Math.pow(d.r, 1.8) * 0.18))
      // Collision: Strong collision to prevent overlap - bubbles stay in their space
      .force('collision', d3.forceCollide().radius(d => d.r + 8).iterations(5).strength(0.85))
      // NO center force - let bubbles stay randomly distributed across viewport
      // Very subtle wander for floating effect (hawa mein float jaisa)
      .force('wander', wanderForce(0.06))
      .velocityDecay(0.55) // Higher friction - bubbles settle but still float gently
      .alphaDecay(0.018) // Let simulation settle naturally
      .alphaTarget(0.001) // Low energy target for calm floating
      .on('tick', ticked);

    simRef.current = simulation;
    nodesRef.current = nodes;

    // update visible count initially based on node positions inside the viewport area
    try {
      const initiallyVisible = nodes.reduce((acc, d) => {
        if (d.x - d.r >= 0 && d.x + d.r <= w && d.y - d.r >= 0 && d.y + d.r <= h) return acc + 1;
        return acc;
      }, 0);
      setVisibleCount(initiallyVisible);
    } catch (e) {
      // ignore
    }

    // Create two layers: circlesGroup (scales with zoom) and labelsGroup (keeps constant size)
    // Check if groups already exist (smooth update) or create new (hard refresh)
    let circlesGroup = g.select('.circles-group');
    let labelsGroup = g.select('.labels-group');
    const isSmoothUpdate = !circlesGroup.empty() && !intervalChanged;

    if (circlesGroup.empty()) {
      circlesGroup = g.append('g').attr('class', 'circles-group');
    }
    if (labelsGroup.empty()) {
      labelsGroup = g.append('g').attr('class', 'labels-group').attr('pointer-events', 'none').attr('shape-rendering', 'geometricPrecision');
    }

    // Use D3 update/enter/exit pattern for smooth updates
    const circleUpdate = circlesGroup.selectAll('g.node').data(nodes, (d) => d.id);
    const circleExit = circleUpdate.exit();
    const circleEnter = circleUpdate.enter().append('g').attr('class', 'node');
    const circleNodes = circleUpdate.merge(circleEnter);

    const labelUpdate = labelsGroup.selectAll('g.label-node').data(nodes, (d) => d.id);
    const labelExit = labelUpdate.exit();
    const labelEnter = labelUpdate.enter().append('g').attr('class', 'label-node');
    const labelNodes = labelUpdate.merge(labelEnter)
      .style('clip-path', (d) => `url(#clip-${d.id})`);

    // Handle exit: fade out and remove
    if (!intervalChanged) {
      circleExit.transition().duration(400).style('opacity', 0).remove();
      labelExit.transition().duration(400).style('opacity', 0).remove();
    } else {
      circleExit.remove();
      labelExit.remove();
    }

    // Handle enter: set initial transform and opacity
    circleEnter.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`).style('opacity', intervalChanged ? 1 : 0);
    labelEnter.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`).style('opacity', intervalChanged ? 1 : 0);

    circleSelRef.current = circleNodes;
    labelSelRef.current = labelNodes;

    // If we created a simulation above, (re)start it now that DOM nodes exist.
    // For smooth updates, use lower energy to avoid disrupting existing positions
    if (simRef.current) {
      try {
        if (intervalChanged) {
          // Hard refresh: start with moderate energy
          simRef.current.alpha(0.5).restart();
          window.setTimeout(() => {
            if (simRef.current) {
              simRef.current.alphaTarget(0.001);
              setTimeout(() => {
                if (simRef.current) {
                  simRef.current.alpha(0.001);
                }
              }, 2500);
            }
          }, 2000);
        } else {
          // Smooth update: use very low energy to gently adjust positions
          simRef.current.nodes(nodes);
          simRef.current.alpha(0.1).restart();
          window.setTimeout(() => {
            if (simRef.current) {
              simRef.current.alphaTarget(0.001);
            }
          }, 500);
        }
      } catch (e) {
        // ignore
      }
    }

    // For each node create layered visuals in circlesGroup
    // Handle both new nodes (enter) and existing nodes (update) with smooth transitions
    circleNodes.each(function (d) {
      const n = d3.select(this);
      // Check if this is a new node by seeing if hit-area already exists
      const isNewNode = n.select('.hit-area').empty();
      const pct = (function getPctLocal(di) {
        if (di.overridePct != null) return di.overridePct;
        if (aggregations && selections && selections.size === 'Performance') {
          const v = aggregations.get(di.data && (di.data.symbol || di.data.id) || di.id);
          if (v != null) return v;
        }
        return di.data && (di.data.price_change_percentage_24h ?? 0);
      })(d);

      // invisible hit area so clicks anywhere inside the ring open the panel
      let hitArea = n.select('.hit-area');
      if (hitArea.empty()) {
        hitArea = n.append('circle')
          .attr('class', 'hit-area')
          .attr('r', isNewNode ? 1 : d.r)
          .attr('fill', 'transparent')
          .style('pointer-events', 'all')
          .style('cursor', onSelectCoin ? 'pointer' : 'default')
          .on('click', function (event) {
            try {
              if (onSelectCoin) onSelectCoin(d.data);
            } catch (e) {
              // ignore
            }
          });
      }
      // Smooth transition for hit area radius
      hitArea.transition().duration(isSmoothUpdate && !isNewNode ? 600 : 0).attr('r', d.r);

      // multi-node: render only a stroked ring representing the coin
      // make ring edge color intensity depend on magnitude
      const mag = Math.min(Math.abs(pct), localMaxPct);
      const t = localMaxPct > 0 ? Math.min(1, mag / localMaxPct) : 0;
      // interpolate darker->brighter based on sign (blue for neutral, green for positive, red for negative)
      const posDark = '#053017'; const posBright = '#23c55e';
      const negDark = '#2a0b0b'; const negBright = '#ff6b6b';
      const neutDark = '#041321'; const neutBright = '#3b82f6';

      let edgeColor;
      if (isNeutralChange(pct)) {
        // blue for neutral/no change
        edgeColor = d3.interpolateRgb(neutDark, neutBright)(0.5);
      } else {
        edgeColor = pct >= 0 ? d3.interpolateRgb(posDark, posBright)(t) : d3.interpolateRgb(negDark, negBright)(t);
      }
      const ringW = Math.max(2, Math.min(12, d.r * (0.06 + Math.min(0.18, Math.abs(pct) * 0.0025))));
      // subtle inner fill using the same edge color (opacity bucketed by magnitude)
      const fillOpacity = bucketFillOpacity(Math.abs(pct));

      let ringFill = n.select('.ring-fill');
      if (ringFill.empty()) {
        ringFill = n.append('circle')
          .attr('class', 'ring-fill')
          .attr('r', isNewNode ? 1 : Math.max(0, d.r - Math.max(1, Math.round(ringW * 0.5))))
          .attr('fill', edgeColor)
          .style('opacity', isNewNode ? 0 : fillOpacity)
          .style('pointer-events', 'none');
      }
      // Smooth transition for ring fill
      ringFill.transition()
        .duration(isSmoothUpdate && !isNewNode ? 600 : 0)
        .attr('r', Math.max(0, d.r - Math.max(1, Math.round(ringW * 0.5))))
        .attr('fill', edgeColor)
        .style('opacity', fillOpacity);

      let ringOnly = n.select('.ring-only');
      if (ringOnly.empty()) {
        ringOnly = n.append('circle')
          .attr('class', 'ring-only')
          .attr('r', isNewNode ? 1 : d.r)
          .attr('fill', 'none')
          .attr('stroke', edgeColor)
          .attr('stroke-width', isNewNode ? 1 : ringW)
          .style('opacity', isNewNode ? 0 : 0.95);
      }
      // Smooth transition for ring
      ringOnly.transition()
        .duration(isSmoothUpdate && !isNewNode ? 600 : 0)
        .attr('r', d.r)
        .attr('stroke', edgeColor)
        .attr('stroke-width', ringW)
        .style('opacity', 0.95);

      // (logos and labels are placed in labelsGroup so they remain constant size)
    });

    // render centered symbol and percent inside each ring (scaled to radius)
    // Handle both new labels (enter) and existing labels (update) with smooth transitions
    labelNodes.each(function (d) {
      const ln = d3.select(this);
      // Check if this is a new label by seeing if symbol text already exists
      const isNewLabel = ln.select('.symbol').empty();
      const pct = (function getPctLocal(di) {
        if (di.overridePct != null) return di.overridePct;
        if (aggregations && selections && selections.size === 'Performance') {
          const v = aggregations.get(di.data && (di.data.symbol || di.data.id) || di.id);
          if (v != null) return v;
        }
        return di.data && (di.data.price_change_percentage_24h ?? 0);
      })(d);

      // sizes scale proportionally with the computed radius so text/logo feel uniform
      // across different bubble sizes. Use sensible minimums to keep tiny bubbles readable.
      // DYNAMIC: Reduce symbol size if text is long to prevent overflow
      const symbolText = d.data && (d.data.symbol ? d.data.symbol.toUpperCase() : (d.data.name || '')) || '';
      const textLen = symbolText.length;

      // Base symbol size
      let symSize = Math.max(8, Math.round(d.r * 0.36));

      // Safety check: reduce font size for long symbols to ensure they fit
      // Assuming avg char aspect ratio ~0.6
      const availableW = d.r * 1.6; // ~80% of diameter
      if (textLen > 0) {
        const estWidth = textLen * symSize * 0.65;
        if (estWidth > availableW) {
          symSize = Math.max(7, Math.floor(availableW / (textLen * 0.65)));
        }
      }

      const pctSize = Math.max(8, Math.round(d.r * 0.24));

      // small downward nudge so stack doesn't sit flush to the top edge of the bubble
      const nudge = Math.round(d.r * 0.08); // ~8% of radius
      const spacing = Math.max(3, Math.round(d.r * 0.06));
      // nudge the badge/logo slightly upwards relative to the stacked text and increase
      // the spacing between badge and symbol so there's visible breathing room
      const logoUp = Math.round(d.r * 0.06); // ~6% of radius upward for badge
      const badgeSpacing = spacing + Math.round(d.r * 0.04); // slightly larger gap above symbol

      // Determine whether text will fit inside the bubble. If not, prefer showing a logo
      const approxCharWidthFactor = 0.70;
      const approxTextWidth = symbolText.length * symSize * approxCharWidthFactor;
      const availableInnerWidth = Math.max(6, (d.r * 2) * 0.85);

      // thresholds
      const LOGO_ONLY_THRESHOLD = 24; // reduced to 24px to show data in more bubbles

      // If the calculated text width won't fit inside the bubble and we have an image, render logo-only
      // BUT: If bubble is very large (e.g. > 50px), try to show text anyway by scaling down further if needed
      const isLargeBubble = d.r > 50;

      if (!isLargeBubble && (d.r <= LOGO_ONLY_THRESHOLD || approxTextWidth > availableInnerWidth) && d.data && d.data.image) {
        // Remove any existing text/labels first
        ln.selectAll('.symbol, .pct, .price, .price-change, .logo-badge').remove();

        // Dynamic logo size based on bubble radius - bigger bubbles get bigger logos
        const smallLogoSize = Math.max(6, Math.min(Math.round(d.r * 0.85), Math.round(availableInnerWidth)));
        const topY = -Math.round(smallLogoSize / 2) + nudge;
        const clipRadius = Math.max(2, Math.round(smallLogoSize / 2));

        // Check if clipPath exists, create if not, always update radius
        let clipPath = defs.select(`#clip-logo-small-${d.id}`);
        if (clipPath.empty()) {
          try {
            clipPath = defs
              .append('clipPath')
              .attr('id', `clip-logo-small-${d.id}`);
            clipPath.append('circle')
              .attr('cx', 0)
              .attr('cy', 0);
          } catch (e) {
            // ignore
          }
        }
        // Always update clipPath circle radius to match current logo size
        clipPath.select('circle')
          .attr('r', clipRadius)
          .attr('cx', 0)
          .attr('cy', 0);

        // Check if logo exists, update or create
        let logoImg = ln.select('.logo-small');
        if (logoImg.empty()) {
          logoImg = ln.append('image').attr('class', 'logo-small');
        }
        // Smooth transition for logo size updates
        // Ensure logo is always circular by using preserveAspectRatio and clip-path
        logoImg
          .attr('href', d.data.image)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .transition()
          .duration(isSmoothUpdate && !isNewLabel ? 600 : 0)
          .attr('width', smallLogoSize)
          .attr('height', smallLogoSize)
          .attr('x', -smallLogoSize / 2)
          .attr('y', topY)
          .style('clip-path', `url(#clip-logo-small-${d.id})`)
          .style('pointer-events', 'none');
        return;
      }

      // Remove logo-small if switching to text mode
      ln.select('.logo-small').remove();

      // skip labels for extremely tiny rings with no image
      if (d.r < 10) return;

      // Build a stacked layout (optional badge image on top, symbol, then percent)
      const hasBadge = d.data && d.data.image && d.r >= LOGO_ONLY_THRESHOLD;
      // compute badge size slightly smaller than before for better spacing
      const badgeImgSize = hasBadge ? Math.max(10, Math.min(Math.round(d.r * 0.6), Math.round((d.r * 2) * 0.6))) : 0;

      // total stack height (sum of center-aligned elements), using badgeSpacing between badge and symbol
      const totalHeight = (hasBadge ? badgeImgSize : 0) + (hasBadge ? badgeSpacing : 0) + symSize + spacing + pctSize;
      const topY = -Math.round(totalHeight / 2) + nudge;

      // if badge exists, place it at the top of the stack
      if (hasBadge) {
        // move badge slightly upward so it doesn't hug the top edge and adds visual balance
        const badgeCenterY = topY + Math.round(badgeImgSize / 2) - logoUp;

        // Dynamic badge size based on bubble radius - bigger bubbles get bigger badges
        const badgeClipRadius = Math.max(4, Math.round(badgeImgSize / 2));

        // Check if clipPath exists, create if not, always update radius
        let badgeClipPath = defs.select(`#clip-logo-badge-${d.id}`);
        if (badgeClipPath.empty()) {
          try {
            badgeClipPath = defs
              .append('clipPath')
              .attr('id', `clip-logo-badge-${d.id}`);
            badgeClipPath.append('circle')
              .attr('cx', 0)
              .attr('cy', 0);
          } catch (e) {
            // ignore
          }
        }
        // Always update clipPath circle radius to match current badge size
        badgeClipPath.select('circle')
          .attr('r', badgeClipRadius)
          .attr('cx', 0)
          .attr('cy', 0);

        // Check if badge exists, update or create
        let badge = ln.select('.logo-badge');
        if (badge.empty()) {
          badge = ln.append('g').attr('class', 'logo-badge');
        }
        badge.attr('transform', `translate(0, ${badgeCenterY})`);

        // Check if image exists in badge, update or create
        let badgeImg = badge.select('image');
        if (badgeImg.empty()) {
          badgeImg = badge.append('image');
        }
        // Smooth transition for badge size updates
        // Ensure badge is always circular by using preserveAspectRatio and clip-path
        badgeImg
          .attr('href', d.data.image)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .transition()
          .duration(isSmoothUpdate && !isNewLabel ? 600 : 0)
          .attr('width', badgeImgSize)
          .attr('height', badgeImgSize)
          .attr('x', -badgeImgSize / 2)
          .attr('y', -badgeImgSize / 2)
          .style('clip-path', `url(#clip-logo-badge-${d.id})`)
          .style('pointer-events', 'none');
      } else {
        // Remove badge if it exists but shouldn't
        ln.select('.logo-badge').remove();
      }

      // symbol: centered in stack
      const symbolCenterY = topY + (hasBadge ? badgeImgSize + badgeSpacing : 0) + Math.round(symSize / 2);
      let symEl = ln.select('.symbol');
      if (symEl.empty()) {
        symEl = ln.append('text')
          .attr('class', 'symbol')
          .attr('text-anchor', 'middle')
          .attr('y', symbolCenterY)
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none')
          .style('fill', '#ffffff')
          .style('font-family', "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif")
          .style('font-weight', 700)
          .style('font-size', isNewLabel ? '2px' : `${symSize}px`);
      }
      symEl
        .text(symbolText)
        .attr('y', symbolCenterY)
        .transition()
        .duration(isSmoothUpdate && !isNewLabel ? 600 : (isNewLabel ? 600 : 0))
        .style('font-size', `${symSize}px`);
      // apply subtle text shadow only for larger labels to avoid fuzziness on very small text
      if (symSize >= 14) symEl.attr('filter', 'url(#textShadow)');

      // percent below the symbol
      const pctCenterY = topY + (hasBadge ? badgeImgSize + badgeSpacing : 0) + symSize + spacing + Math.round(pctSize / 2);
      // helper to format large integer-like numbers into K/M/B (for volume)
      function formatLargeNumber(n) {
        const num = Number(n) || 0;
        const abs = Math.abs(num);
        if (abs >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
        if (abs >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
        if (abs >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
        // small numbers: show up to 2 decimals if not integer
        return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.00$/, '');
      }

      // Determine what to render in the lower stack: percent, price, or absolute price change or volume
      // MULTI-METRIC SUPPORT: Normalize selections.content to array
      const contentSelections = Array.isArray(selections?.content)
        ? selections.content
        : [selections?.content || 'Performance'];

      // Dynamic content fitting based on bubble radius
      // Very small (r < 30): symbol only, no metrics
      // Small (r < 45): 1 metric
      // Medium (r < 65): 2 metrics
      // Large (r >= 65): up to 3 metrics
      let maxMetrics = 0;
      if (d.r >= 65) maxMetrics = 3;
      else if (d.r >= 45) maxMetrics = 2;
      else if (d.r >= 30) maxMetrics = 1;
      else maxMetrics = 0;

      const metricsToShow = contentSelections.slice(0, Math.min(contentSelections.length, maxMetrics));

      // Helper to get metric value and info
      function getMetricInfo(metricType) {
        let text = '';
        let color = '#baf3c9';
        let value = 0;
        let metricKey = 'pct'; // for trend lookup

        if (metricType === 'Price') {
          const priceRaw = d.data && (d.data.price ?? d.data.current_price ?? d.data.last_price ?? 0);
          const priceNum = Number(priceRaw) || 0;
          value = priceNum;
          metricKey = 'price';
          let fmt;
          if (priceNum === 0) fmt = '0';
          else if (Math.abs(priceNum) >= 1) fmt = priceNum.toFixed(2);
          else if (Math.abs(priceNum) >= 0.01) fmt = priceNum.toPrecision(3);
          else fmt = priceNum.toPrecision(4);
          text = fmt;
          color = '#ffffff';
        } else if (metricType === 'Price Change') {
          const priceRaw = d.data && (d.data.price ?? d.data.current_price ?? d.data.last_price ?? 0);
          const priceNum = Number(priceRaw) || 0;
          const pctVal = Number(pct) || 0;
          const delta = (pctVal / 100) * priceNum;
          value = delta;
          metricKey = 'priceChange';
          const absDelta = Math.abs(delta);
          let fmt;
          if (absDelta === 0) fmt = '0';
          else if (absDelta >= 1) fmt = delta.toFixed(2);
          else if (absDelta >= 0.01) fmt = delta.toPrecision(3);
          else fmt = delta.toPrecision(4);
          const isDeltaNeutral = isNeutralChange(pct);
          text = `${isDeltaNeutral ? '' : (delta >= 0 ? '+' : '')}${fmt}`;
          color = isDeltaNeutral ? '#93c5fd' : (delta >= 0 ? '#baf3c9' : '#ffb6b6');
        } else if (metricType === 'Volume') {
          const volRaw = d.data && (d.data.volume ?? d.data.total_volume ?? d.data['24h_volume'] ?? d.data.market_cap ?? 0);
          const volNum = Number(volRaw) || 0;
          value = volNum;
          metricKey = 'volume';
          text = formatLargeNumber(volNum);
          color = '#ffffff';
        } else if (metricType === 'Volatility') {
          const volVal = (d.data && d.data.volatility != null) ? d.data.volatility : (d.volatility != null ? d.volatility : 0);
          value = volVal;
          metricKey = 'volatility';
          text = `${volVal.toFixed(2)}%`;
          color = '#f59e0b';
        } else if (metricType === 'Relative Volume') {
          const relVolVal = (d.data && d.data.relative_volume != null) ? d.data.relative_volume : (d.relative_volume != null ? d.relative_volume : 0);
          value = relVolVal;
          metricKey = 'rvol';
          text = `${relVolVal.toFixed(2)}x`;
          color = '#06b6d4';
        } else {
          // Performance (default)
          value = pct || 0;
          metricKey = 'pct';
          text = `${isNeutralChange(pct) ? '' : (pct >= 0 ? '+' : '')}${(pct || 0).toFixed(1)}%`;
          color = isNeutralChange(pct) ? '#93c5fd' : (pct >= 0 ? '#baf3c9' : '#ffb6b6');
        }

        return { text, color, value, metricKey };
      }

      // Helper to get trend arrow and color
      function getTrendArrow(symbol, metricKey, currentValue) {
        const trend = getTrend(symbol, metricKey, currentValue);
        if (trend === 'up') return { arrow: '▲', color: '#4ade80' };
        if (trend === 'down') return { arrow: '▼', color: '#f87171' };
        return { arrow: '═', color: '#94a3b8' };
      }

      // Remove old content elements and create new ones for multi-metric
      ln.selectAll('.pct, .price, .price-change, .metric-line').remove();

      // Render each metric as a separate line, stacked vertically
      const metricLineHeight = Math.round(pctSize * 1.3);
      const symbol = d.data?.symbol || d.id || '';

      metricsToShow.forEach((metricType, idx) => {
        const info = getMetricInfo(metricType);
        const trendInfo = getTrendArrow(symbol, info.metricKey, info.value);

        // Calculate Y position for this metric line
        const metricY = pctCenterY + (idx * metricLineHeight);

        // Create container for metric text + arrow
        const metricText = `${info.text}${trendInfo.arrow}`;

        const metricEl = ln.append('text')
          .attr('class', 'metric-line')
          .attr('text-anchor', 'middle')
          .attr('y', metricY)
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none')
          .style('font-family', "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif")
          .style('font-weight', 600)
          .style('font-size', isNewLabel ? '2px' : `${pctSize}px`);

        // Add value text
        const valueSpan = metricEl.append('tspan')
          .text(info.text)
          .style('fill', info.color);

        // Add trend arrow with its own color (smaller font)
        metricEl.append('tspan')
          .text(trendInfo.arrow)
          .style('fill', trendInfo.color)
          .style('font-size', '0.7em');

        // Animate if needed
        metricEl
          .transition()
          .duration(isSmoothUpdate && !isNewLabel ? 600 : (isNewLabel ? 600 : 0))
          .style('font-size', `${pctSize}px`);

        if (pctSize >= 14) metricEl.attr('filter', 'url(#textShadow)');

        // Also update previous values for trend tracking (on first metric only to avoid duplicates)
        if (idx === 0 && d.data) {
          updatePreviousValues(d.data);
        }
      });
    });

    // entry animation: grow circles/labels from small to their computed sizes for a smooth transition
    // Only animate new nodes (enter selection), not updates
    try {
      if (intervalChanged || circleEnter.size() > 0) {
        // Animate new nodes only
        circleEnter.selectAll('.hit-area')
          .transition()
          .duration(600)
          .attr('r', (d) => d.r);

        circleEnter.selectAll('.ring-fill')
          .transition()
          .duration(600)
          .attr('r', (d) => {
            const pct = (d.data && d.data.price_change_percentage_24h) || 0;
            const ringW = Math.max(2, Math.min(12, d.r * (0.06 + Math.min(0.18, Math.abs(pct) * 0.0025))));
            return Math.max(0, d.r - Math.max(1, Math.round(ringW * 0.5)));
          });

        circleEnter.selectAll('.ring-only')
          .transition()
          .duration(600)
          .attr('r', (d) => d.r)
          .attr('stroke-width', (d) => {
            const pct = (d.data && d.data.price_change_percentage_24h) || 0;
            return Math.max(2, Math.min(12, d.r * (0.06 + Math.min(0.18, Math.abs(pct) * 0.0025))));
          })
          .style('opacity', 0.95);

        // Fade in new nodes
        circleEnter.transition().duration(600).style('opacity', 1);
        labelEnter.transition().duration(600).style('opacity', 1);

        // labels: fade/scale in by transitioning font-size
        labelEnter.selectAll('.symbol')
          .transition()
          .duration(600)
          .style('font-size', (d) => `${Math.max(8, Math.round(d.r * 0.36))}px`);
        labelEnter.selectAll('.pct, .price, .price-change')
          .transition()
          .duration(600)
          .style('font-size', (d) => `${Math.max(8, Math.round(d.r * 0.24))}px`);
      }
    } catch (e) {
      // ignore animation errors
    }

    // Tooltip is now handled via React state (setTooltipData, setTooltipPos)
    // No D3 tooltip element needed - we render BubbleTooltip component in JSX

    // pointer interactions for groups (chained correctly)
    circleNodes
      .style('cursor', onSelectCoin ? 'pointer' : 'default')
      .on('mouseover', function (event, d) {
        // support older class names and the newer rim class
        d3.select(this).select('.rim, .ring, .ring-only').attr('stroke-width', Math.max(3, d.r * 0.12));

        // Get percentage change
        const ttPct = (function (di) {
          if (di.overridePct != null) return di.overridePct;
          if (aggregations && selections && selections.size === 'Performance') {
            const v = aggregations.get(di.data && (di.data.symbol || di.data.id) || di.id);
            if (v != null) return v;
          }
          return di.data && (di.data.price_change_percentage_24h || 0);
        })(d);

        // Get price history for sparkline
        const symbol = d.data?.symbol?.toUpperCase();
        const history = symbol ? getHistory(symbol) : null;

        // Set tooltip data with Day vs Interval comparison
        // ttPct is the interval percentage (for current selected interval)
        const dayPct = d.data?.daily_change_1d ?? ttPct;
        const intPct = ttPct;

        // Calculate price changes
        const priceVal = d.data?.price || 0;
        const dayPriceChange = priceVal * (dayPct / 100);
        const intervalPriceChange = priceVal * (intPct / 100);

        // Get volumes - interval vol from current data, day vol from raw or estimate
        const intervalVol = d.data?.volume || history?.volume || 0;
        const dayVol = d.data?.day_volume || d.data?.raw?.day_volume || d.data?.raw?.total_volume || d.data?.volume || intervalVol;

        setTooltipData({
          symbol: symbol || d.data?.name || '',
          name: d.data?.name,
          price: d.data?.price,
          // Day data
          dayPctChange: dayPct,
          dayPriceChange: dayPriceChange,
          dayVolume: dayVol,
          // Interval data
          intervalPctChange: intPct,
          intervalPriceChange: intervalPriceChange,
          intervalVolume: intervalVol,
          currentInterval: currentInterval || 'Day',
          // Legacy fallbacks
          pctChange: ttPct,
          volume: intervalVol,
          // Other data
          prices: history?.prices || [],
          rvol: d.data?.relative_volume || history?.rvol,
          volatility: d.data?.volatility || history?.volatility,
          lastUpdate: history?.lastUpdate || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      })
      .on('mousemove', function (event) {
        const pad = 16;
        const ttW = 320; // approximate tooltip width (with some buffer)
        const ttH = 460; // approximate max tooltip height
        
        // Default: placement to bottom-right of cursor
        let x = event.clientX + pad;
        let y = event.clientY + pad;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // X Positioning: prevent horizontal overflow
        if (x + ttW > winW - pad) {
          // If slightly off screen, shift left
          x = winW - ttW - pad;
          // If cursor is now covering tooltip (tooltip shifted under cursor), move to left side of cursor
          if (x < event.clientX && x + ttW > event.clientX) {
             x = event.clientX - ttW - pad;
          }
        }
        
        // Y Positioning: prevent vertical overflow (FLIP UP behavior)
        if (y + ttH > winH - pad) {
           // Flip to top of cursor
           y = event.clientY - ttH - pad;
           
           // If flipping up goes off top, clamp to top (and let it overlap cursor if really needed, better than invisible)
           // But better yet: shift it just enough to fit if possible
           if (y < pad) {
             // If fitting above is impossible, simpler clamp logic (revert to bottom-aligned but pushed up)
             // But usually flipping is best. Let's clamp the top.
             y = Math.max(pad, y);
             
             // If clamped top still means bottom is cut off (screen too small), force top-align to viewport 
             // ensuring header is visible
             if (y + ttH > winH) {
                // This is a small screen case. 
                // We prioritizing seeing the top of the tooltip.
                y = Math.max(pad, winH - ttH - pad);
             }
           }
        }
        
        setTooltipPos({ x, y });
      })
      .on('mouseout', function (event, d) {
        d3.select(this).select('.rim, .ring, .ring-only').attr('stroke-width', Math.max(1, Math.min(8, d.r * 0.12)));
        setTooltipData(null);
      })
      .on('click', function (event, d) {
        try {
          if (onSelectCoin) onSelectCoin(d.data);
        } catch (e) {
          // ignore
        }
      });

    // (fitToView is exposed via top-level useImperativeHandle)

    svg.attr('width', size.width).attr('height', size.height).attr('viewBox', `0 0 ${size.width} ${size.height}`);

    // tick handler to update DOM positions and dynamic visuals
    function ticked() {
      // Soft boundaries: Keep bubbles within viewport with gentle damping
      // No harsh bouncing - bubbles smoothly stay within bounds
      const padding = 10;
      nodes.forEach((d) => {
        const r = d.r;

        // X bounds - soft boundary with gentle push back
        if (d.x < r + padding) {
          const overshoot = (r + padding) - d.x;
          d.x = r + padding;
          d.vx *= 0.35; // Dampen velocity instead of reversing
          d.vx += overshoot * 0.12; // Gentle push inward
          // Update base position if too far out
          if (d.__baseX != null && d.__baseX < r + padding) {
            d.__baseX = r + padding + (d.r * 0.3);
          }
        } else if (d.x > w - r - padding) {
          const overshoot = d.x - (w - r - padding);
          d.x = w - r - padding;
          d.vx *= 0.35;
          d.vx -= overshoot * 0.12;
          if (d.__baseX != null && d.__baseX > w - r - padding) {
            d.__baseX = w - r - padding - (d.r * 0.3);
          }
        }

        // Y bounds - soft boundary with gentle push back
        if (d.y < r + padding) {
          const overshoot = (r + padding) - d.y;
          d.y = r + padding;
          d.vy *= 0.35;
          d.vy += overshoot * 0.12;
          if (d.__baseY != null && d.__baseY < r + padding) {
            d.__baseY = r + padding + (d.r * 0.3);
          }
        } else if (d.y > h - r - padding) {
          const overshoot = d.y - (h - r - padding);
          d.y = h - r - padding;
          d.vy *= 0.35;
          d.vy -= overshoot * 0.12;
          if (d.__baseY != null && d.__baseY > h - r - padding) {
            d.__baseY = h - r - padding - (d.r * 0.3);
          }
        }
      });

      // update DOM groups
      circleNodes.attr('transform', (d) => `translate(${d.x},${d.y})`);
      labelNodes.attr('transform', (d) => `translate(${d.x},${d.y})`);

      // dynamic glow based on local speed
      const glowScale = d3.scaleLinear().domain([0, 8]).range([1, 20]).clamp(true);
      circleNodes.each(function (d) {
        try {
          const speed = Math.hypot(d.vx || 0, d.vy || 0);
          const blur = glowScale(speed);
          const pctGlow = (d.data.price_change_percentage_24h || 0);
          let color;
          if (isNeutralChange(pctGlow)) {
            color = 'rgba(59,130,246,0.95)'; // blue for neutral - softer tone
          } else {
            const isPos = pctGlow >= 0;
            color = isPos ? 'rgba(35,197,94,0.95)' : 'rgba(242,85,85,0.95)';
          }
          const g = d3.select(this);
          g.select('.glow').style('filter', `drop-shadow(0 0 ${blur}px ${color})`).style('opacity', Math.min(0.95, 0.35 + blur / 40));
          const baseRing = Math.max(1, Math.min(6, d.r * (0.03 + Math.min(0.12, Math.abs(d.data.price_change_percentage_24h || 0) * 0.0015))));
          const rimW = Math.max(1, baseRing + blur * 0.06);
          g.select('.rim').attr('stroke-width', rimW);
        } catch (e) {
          // ignore
        }
      });
    }

    return () => {
      if (simRef.current) simRef.current.stop();
      // Tooltip is managed by React state, no D3 element to remove
      svg.on('.zoom', null);
    };
  }, [data, size.width, size.height, single, radiusScale, selections, aggregations, currentInterval]);

  // Periodically sample node positions to update the visible count without rerendering on every tick.
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        const nodes = nodesRef.current || [];
        if (!nodes.length) {
          setVisibleCount(0);
          return;
        }
        const w = Math.max(100, size.width - margin.left - margin.right);
        const h = Math.max(100, size.height - margin.top - margin.bottom);
        let cnt = 0;
        for (const d of nodes) {
          if (d.x - d.r >= 0 && d.x + d.r <= w && d.y - d.r >= 0 && d.y + d.r <= h) cnt += 1;
        }
        setVisibleCount(cnt);
      } catch (e) {
        // ignore
      }
    }, 300);
    return () => clearInterval(iv);
  }, [size.width, size.height, data]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet" />
      {/* Non-intrusive dialog showing number of bubbles currently visible in the viewport */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          zIndex: 1000,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        {visibleCount} bubble{visibleCount === 1 ? '' : 's'} in view
      </div>

      {/* Premium Tooltip with sparkline and price history */}
      {tooltipData && (
        <BubbleTooltip
          ref={tooltipRef}
          symbol={tooltipData.symbol}
          name={tooltipData.name}
          price={tooltipData.price}
          // Day data
          dayPctChange={tooltipData.dayPctChange}
          dayPriceChange={tooltipData.dayPriceChange}
          dayVolume={tooltipData.dayVolume}
          // Interval data
          intervalPctChange={tooltipData.intervalPctChange}
          intervalPriceChange={tooltipData.intervalPriceChange}
          intervalVolume={tooltipData.intervalVolume}
          currentInterval={tooltipData.currentInterval}
          // Legacy fallbacks
          pctChange={tooltipData.pctChange}
          volume={tooltipData.volume}
          // Other data
          prices={tooltipData.prices}
          rvol={tooltipData.rvol}
          volatility={tooltipData.volatility}
          lastUpdate={tooltipData.lastUpdate}
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y
          }}
        />
      )}
    </div>
  );
});
