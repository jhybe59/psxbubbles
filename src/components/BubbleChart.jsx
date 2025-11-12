
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
export default forwardRef(function BubbleChart({ data, width = 900, height = 600, single = false, radiusScale = null, selections = {}, aggregations = null, onSelectCoin = null, selectedIndex = null }, ref) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [size, setSize] = useState({ width, height });
  const simRef = useRef(null);
  const nodesRef = useRef(null);
  const circleSelRef = useRef(null);
  const labelSelRef = useRef(null);
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };

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

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!data || data.length === 0) return;

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const w = Math.max(100, size.width - margin.left - margin.right);
  const h = Math.max(100, size.height - margin.top - margin.bottom);

  // Compute a dynamic global size multiplier based on how many bubbles we will render.
  // When there are few bubbles we want them to scale up to fill empty space; when many
  // bubbles are present we keep sizes more conservative to avoid heavy overlap.
  function computeGlobalMultiplier(count) {
    // Scale bubbles based on density: modest boost for sparse views, mild shrink for very dense ones.
    if (count >= 200) return 0.9;
    if (count >= 140) return 0.95;
    if (count >= 100) return 1.0;
    if (count >= 60) return 1.07;
    if (count >= 30) return 1.14;
    return 1.24;
  }

    // defs: blur filter for glow and radial gradient for bubble shading
    const defs = svg.append('defs');
    defs
      .append('filter')
      .attr('id', 'glow')
      .append('feGaussianBlur')
      // stronger blur for a more pronounced neon halo
      .attr('stdDeviation', 22)
      .attr('result', 'coloredBlur');

    const grad = defs.append('radialGradient').attr('id', 'bubbleGrad').attr('cx', '35%').attr('cy', '30%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,0.10)');
    grad.append('stop').attr('offset', '60%').attr('stop-color', 'rgba(255,255,255,0.03)');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#0b1114');

  // simple app-level green/red gradients for quick fills
  const gGreen = defs.append('radialGradient').attr('id', 'grad-green').attr('cx', '30%').attr('cy', '30%');
  gGreen.append('stop').attr('offset', '0%').attr('stop-color', '#0bff6a').attr('stop-opacity', 0.95);
  gGreen.append('stop').attr('offset', '60%').attr('stop-color', '#0aa34a').attr('stop-opacity', 0.95);
  gGreen.append('stop').attr('offset', '100%').attr('stop-color', '#03150a').attr('stop-opacity', 0.95);

  const gRed = defs.append('radialGradient').attr('id', 'grad-red').attr('cx', '30%').attr('cy', '30%');
  gRed.append('stop').attr('offset', '0%').attr('stop-color', '#ff7b7b').attr('stop-opacity', 0.95);
  gRed.append('stop').attr('offset', '60%').attr('stop-color', '#c93b3b').attr('stop-opacity', 0.95);
  gRed.append('stop').attr('offset', '100%').attr('stop-color', '#160606').attr('stop-opacity', 0.95);

  // subtle inner shadow filter for depth
  // slightly stronger inner shadow to make the bubble feel deeper
  defs.append('filter').attr('id', 'inner-shadow').append('feDropShadow').attr('dx', 0).attr('dy', 8).attr('stdDeviation', 14).attr('flood-color', '#000').attr('flood-opacity', 0.45);

  // subtle drop shadow filter for depth
  defs.append('filter').attr('id', 'drop').append('feDropShadow').attr('dx', 0).attr('dy', 3).attr('stdDeviation', 4).attr('flood-color', '#000').attr('flood-opacity', 0.45);
  // small text shadow filter to improve contrast without heavy stroke
  // reduced blur and offset to avoid fuzzy glyphs at small sizes
  const textFilter = defs.append('filter').attr('id', 'textShadow');
  textFilter.append('feOffset').attr('dx', 0).attr('dy', 1).attr('result', 'off');
  textFilter.append('feGaussianBlur').attr('in', 'off').attr('stdDeviation', 0.6).attr('result', 'blur');
  const feMerge = textFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'blur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

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

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

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

    const localRadiusScale = d3.scaleSqrt().domain([0, Math.max(1, sizeMax)]).range([8, 92]);

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

    // If single mode is requested, pick the largest absolute percent-change coin and render it centered
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
        } catch (e) {
          // fall back to percent if any error
        }
        return Math.abs(b.price_change_percentage_24h || 0) > Math.abs(a.price_change_percentage_24h || 0) ? b : a;
      }, used[0] || null);
      if (!largest) return;
    // compute baseR using the active size metric (allow external radiusScale override)
    if (radiusScale) {
      // delegate to provided radiusScale (assumed to accept the chosen metric)
      const largestMetricVal = (selections && selections.size === 'Performance') ? Math.abs(largest.price_change_percentage_24h || 0) : (selections && selections.size === 'Volume' ? extractVolumeItem(largest) : extractMarketCapItem(largest));
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
      const base = pctForGrad >= 0 ? '#24c55e' : '#e24b4b';
      const mid = pctForGrad >= 0 ? '#6fe987' : '#ff9a9a';
      const dark = pctForGrad >= 0 ? '#0f4f2b' : '#6b2a2a';
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
      const ringColor = pct >= 0 ? '#23c55e' : '#ff4d4d';

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
    // reuse previous node positions/velocities when available to smooth transitions
    const prevMap = new Map((nodesRef.current || []).map((n) => [n.id, n]));
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
        baseR = Math.max(4, Math.round(localRadiusScale(volVal)));
      } else if (selections && selections.size === 'Market Cap') {
        const mcVal = extractMarketCapItem(d) || 0;
        baseR = Math.max(4, Math.round(localRadiusScale(mcVal)));
      } else {
        baseR = Math.max(4, Math.round(localRadiusScale(pctAbs)));
      }

      // PSX-aware sizing: compute how much of the allowed daily move this symbol used
      // Rules: if price <= 10 PKR then daily absolute cap = 1 PKR else cap = 10% of price
      // Compute normalized = delta / cap in [-1,1], map magnitude -> multiplier (1..MAX_INCREASE)
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
          baseR = Math.max(4, Math.round(baseR * factor));
        }
      } catch (e) {
        // if any error, fall back to baseR computed earlier
      }

      const r = baseR;
      const prev = prevMap.get(d.id);
      if (prev) {
        return { id: d.id, r, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy, data: d, overridePct: overridePct };
      }
      return { id: d.id, r, x: Math.random() * w, y: Math.random() * h, data: d, overridePct: overridePct };
    });

    // viewport-aware global radius scaling: compute an optimal scale so bubbles fit
    // in a grid derived from node count and viewport. This keeps all visuals the same
    // but ensures bubbles don't overlap or clip out of the view when there are many nodes.
    // Strategy:
    // 1. estimate a grid (cols/rows) to distribute nodes evenly (same logic used later)
    // 2. compute the cell size and the maximum allowed radius that fits comfortably
    // 3. compute a global scale to bring raw radii into that allowed maximum (only downscales significantly)
    const minDim = Math.min(w, h);
    const rawMaxR = d3.max(nodes, (n) => n.r) || 1;
    // estimate grid dimensions similar to anchor grid below
    try {
      const nn = Math.max(1, nodes.length);
      const aspect = w / Math.max(1, h);
      let estCols = Math.ceil(Math.sqrt(nn * aspect));
      let estRows = Math.ceil(nn / Math.max(1, estCols));
      if (estCols <= 0) estCols = 1;
      if (estRows <= 0) estRows = 1;
      const cellW = w / estCols;
      const cellH = h / estRows;

      // pick tuning based on node count: when there are few nodes, allow much larger fill and upscale
      let PACK_FACTOR = 0.86;
      let VIEWPORT_FRACTION = 0.34;
      let AREA_FILL_FACTOR = 0.64;
      let MAX_SCALE_UP = 2.0;
      if (nn <= 10) {
        PACK_FACTOR = 0.94; VIEWPORT_FRACTION = 0.66; AREA_FILL_FACTOR = 0.92; MAX_SCALE_UP = 6.0;
      } else if (nn <= 20) {
        PACK_FACTOR = 0.92; VIEWPORT_FRACTION = 0.52; AREA_FILL_FACTOR = 0.86; MAX_SCALE_UP = 4.0;
      } else if (nn <= 40) {
        PACK_FACTOR = 0.90; VIEWPORT_FRACTION = 0.44; AREA_FILL_FACTOR = 0.78; MAX_SCALE_UP = 3.2;
      } else if (nn <= 80) {
        PACK_FACTOR = 0.88; VIEWPORT_FRACTION = 0.38; AREA_FILL_FACTOR = 0.70; MAX_SCALE_UP = 2.7;
      }

      const maxAllowedRByCell = Math.max(6, Math.floor(Math.min(cellW, cellH) * 0.5 * PACK_FACTOR));
      const maxAllowedRByViewport = Math.max(8, Math.floor(minDim * VIEWPORT_FRACTION));
      const allowedMaxR = Math.max(6, Math.min(maxAllowedRByCell, maxAllowedRByViewport));

      const totalAvailableArea = Math.max(1, w * h * AREA_FILL_FACTOR);
      // Preserve relative sizes: compute scale s such that sum(pi*(r_i*s)^2) = totalAvailableArea
      // => s = sqrt(totalAvailableArea / (pi * sum(r_i^2)))
      const rawRadii = nodes.map((n) => Math.max(1, n.r || 1));
      const sumSquares = rawRadii.reduce((acc, r) => acc + r * r, 0) || 1;
      const desiredScaleByArea = Math.sqrt(totalAvailableArea / (Math.PI * sumSquares));

      const rawMaxRLocal = d3.max(rawRadii) || 1;
      const scaleMax = rawMaxRLocal > 0 ? allowedMaxR / rawMaxRLocal : 1;

      // clamps to keep sizes readable
      const MIN_SCALE = 0.28;

      let finalScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE_UP, desiredScaleByArea));
      finalScale = Math.min(finalScale, Math.max(scaleMax, MIN_SCALE));

      if (Math.abs(finalScale - 1) > 1e-4) {
        nodes.forEach((n) => {
          n.r = Math.max(4, Math.round(n.r * finalScale));
        });
      }
      // Apply a density-aware global size multiplier so bubbles fill space better when there
      // are few of them, and remain compact when the view is dense.
  const GLOBAL_MULT = computeGlobalMultiplier(nodes.length);
  if (Math.abs(GLOBAL_MULT - 1) > 1e-6) {
        nodes.forEach((n) => {
          n.r = Math.max(4, Math.round(n.r * GLOBAL_MULT));
        });
      }
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
    nodes.forEach((nd) => {
      defs
        .append('clipPath')
        .attr('id', `clip-${nd.id}`)
        .append('circle')
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

  // per-node radial gradient: AIA-style (green for up, red for down)
  const pct = pctForNode(nd);
  const rg = defs.append('radialGradient').attr('id', `grad-${nd.id}`).attr('cx', '45%').attr('cy', '35%').attr('r', '70%');
  if (pct >= 0) {
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

    // Build a grid of anchor points to spread bubbles evenly across the viewport.
    // We'll attach a gentle force toward each node's assigned anchor so bubbles
    // are distributed across the full area but still allowed to drift/collide.
    const n = nodes.length;
    const aspect = w / h;
    // pick rows/cols to approximate viewport aspect and node count
    let cols = Math.ceil(Math.sqrt(n * aspect));
    let rows = Math.ceil(n / cols);
    if (cols <= 0) cols = 1;
    if (rows <= 0) rows = 1;
    const cellW = w / cols;
    const cellH = h / rows;

    // create anchor positions in a grid, but pick a random point inside each cell
    // (jittered grid) to avoid visually regular lines while still covering the area
    const anchors = [];
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        // padding inside cell so anchors aren't placed exactly on cell edges
        const padX = Math.max(6, cellW * 0.08);
        const padY = Math.max(6, cellH * 0.08);
        const x = cc * cellW + padX + Math.random() * (cellW - padX * 2);
        const y = rr * cellH + padY + Math.random() * (cellH - padY * 2);
        anchors.push({ x, y });
      }
    }
    // shuffle anchors for slightly less regular mapping
    for (let i = anchors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [anchors[i], anchors[j]] = [anchors[j], anchors[i]];
    }

    nodes.forEach((nd, i) => {
      const a = anchors[i % anchors.length];
      // initialize near anchor for faster convergence
      nd.x = nd.x == null ? a.x + (Math.random() - 0.5) * cellW * 0.25 : nd.x;
      nd.y = nd.y == null ? a.y + (Math.random() - 0.5) * cellH * 0.25 : nd.y;
      nd.__anchor = a;
    });

    // custom gentle wander/noise so bubbles slowly drift
    const nodeCount = nodes.length;

    function wanderForce(strength = 0.22) {
      let nodesInternal;
      function force(alpha) {
        if (!nodesInternal) return;
        const t = Date.now() / 1000;
        for (const n of nodesInternal) {
          if (n.__phase == null) n.__phase = (Math.random() * 2 - 1) * Math.PI;
          const phase = n.__phase;
          const freq = 0.6 + Math.max(0, 0.5 - n.r / 120);
          const crowdScale = nodeCount <= 40 ? 1 : (nodeCount <= 120 ? 0.65 : 0.45);
          const tunedStrength = strength * crowdScale;
          const ax = Math.sin(t * freq + phase) * 0.12 * (0.4 + n.r / 120);
          const ay = Math.cos(t * (freq * 0.85) + phase * 0.7) * 0.08 * (0.4 + n.r / 120);
          n.vx = (n.vx || 0) + ax * tunedStrength * alpha;
          n.vy = (n.vy || 0) + ay * tunedStrength * alpha;
        }
      }
      force.initialize = (ns) => (nodesInternal = ns);
      return force;
    }

    // gentle attraction to anchor points (keeps nodes evenly distributed)
    function anchorX(strength = 0.18) {
      let nodesInternal;
      function force(alpha) {
        if (!nodesInternal) return;
        for (const n of nodesInternal) {
          const ax = (n.__anchor.x - n.x) * strength * alpha;
          n.vx = (n.vx || 0) + ax;
        }
      }
      force.initialize = (ns) => (nodesInternal = ns);
      return force;
    }

    function anchorY(strength = 0.18) {
      let nodesInternal;
      function force(alpha) {
        if (!nodesInternal) return;
        for (const n of nodesInternal) {
          const ay = (n.__anchor.y - n.y) * strength * alpha;
          n.vy = (n.vy || 0) + ay;
        }
      }
      force.initialize = (ns) => (nodesInternal = ns);
      return force;
    }

    const crowdCollisionBuffer = (d) => {
      const margin = Math.max(4, Math.min(18, d.r * 0.18));
      return d.r + margin;
    };
    const anchorStrength = nodeCount <= 40 ? 0.12 : (nodeCount <= 120 ? 0.085 : 0.06);
    const wanderStrength = nodeCount <= 40 ? 0.42 : (nodeCount <= 120 ? 0.32 : 0.24);
    const chargeStrength = nodeCount <= 60 ? -6 : (nodeCount <= 140 ? -4.5 : -3.5);

    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('collision', d3.forceCollide().radius(crowdCollisionBuffer).iterations(3))
      .force('anchorX', anchorX(anchorStrength))
      .force('anchorY', anchorY(anchorStrength))
      .force('wander', wanderForce(wanderStrength))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .velocityDecay(0.18)
      .alphaDecay(0.016)
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
  const circlesGroup = g.append('g').attr('class', 'circles-group');
  // disable pointer events on labelsGroup so clicks fall through to circles underneath
  const labelsGroup = g.append('g').attr('class', 'labels-group').attr('pointer-events', 'none').attr('shape-rendering', 'geometricPrecision');

  const circleNodes = circlesGroup.selectAll('g').data(nodes, (d) => d.id).enter().append('g').attr('class', 'node').attr('transform', (d) => `translate(${d.x},${d.y})`);
  const labelNodes = labelsGroup.selectAll('g').data(nodes, (d) => d.id).enter().append('g').attr('class', 'label-node').attr('transform', (d) => `translate(${d.x},${d.y})`);
  circleSelRef.current = circleNodes;
  labelSelRef.current = labelNodes;

  // If we created a simulation above, (re)start it now that DOM nodes exist.
  // Use a small alpha to gently nudge nodes rather than snapping them.
  if (simRef.current) {
    // small push then decay to near zero
    try {
      simRef.current.alpha(0.06).restart();
      window.setTimeout(() => {
        if (simRef.current) simRef.current.alphaTarget(0.001);
      }, 500);
    } catch (e) {
      // ignore
    }
  }

  // For each node create layered visuals in circlesGroup
      circleNodes.each(function (d) {
      const n = d3.select(this);
        const pct = (function getPctLocal(di) {
          if (di.overridePct != null) return di.overridePct;
          if (aggregations && selections && selections.size === 'Performance') {
            const v = aggregations.get(di.data && (di.data.symbol || di.data.id) || di.id);
            if (v != null) return v;
          }
          return di.data && (di.data.price_change_percentage_24h ?? 0);
        })(d);

      // invisible hit area so clicks anywhere inside the ring open the panel
      n.append('circle')
        .attr('class', 'hit-area')
        .attr('r', d.r)
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


        // multi-node: render only a stroked ring representing the coin
        // make ring edge color intensity depend on magnitude
    const mag = Math.min(Math.abs(pct), localMaxPct);
    const t = localMaxPct > 0 ? Math.min(1, mag / localMaxPct) : 0;
        // interpolate darker->brighter based on sign
        const posDark = '#053017'; const posBright = '#23c55e';
        const negDark = '#2a0b0b'; const negBright = '#ff6b6b';
        const edgeColor = pct >= 0 ? d3.interpolateRgb(posDark, posBright)(t) : d3.interpolateRgb(negDark, negBright)(t);
        const ringW = Math.max(2, Math.min(12, d.r * (0.06 + Math.min(0.18, Math.abs(pct) * 0.0025))));
        // subtle inner fill using the same edge color (opacity bucketed by magnitude)
        const fillOpacity = bucketFillOpacity(Math.abs(pct));
        n.append('circle')
          .attr('class', 'ring-fill')
          .attr('r', Math.max(0, d.r - Math.max(1, Math.round(ringW * 0.5))))
          .attr('fill', edgeColor)
          .style('opacity', fillOpacity)
          .style('pointer-events', 'none');

        n.append('circle')
          .attr('class', 'ring-only')
          .attr('r', d.r)
          .attr('fill', 'none')
          .attr('stroke', edgeColor)
          .attr('stroke-width', ringW)
          .style('opacity', 0.95);

      // (logos and labels are placed in labelsGroup so they remain constant size)
    });

      // render centered symbol and percent inside each ring (scaled to radius)
      labelNodes.each(function (d) {
        const ln = d3.select(this);
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
        const symSize = Math.max(8, Math.round(d.r * 0.36));
        const pctSize = Math.max(8, Math.round(d.r * 0.24));

  // small downward nudge so stack doesn't sit flush to the top edge of the bubble
  const nudge = Math.round(d.r * 0.08); // ~8% of radius
  const spacing = Math.max(3, Math.round(d.r * 0.06));
  // nudge the badge/logo slightly upwards relative to the stacked text and increase
  // the spacing between badge and symbol so there's visible breathing room
  const logoUp = Math.round(d.r * 0.06); // ~6% of radius upward for badge
  const badgeSpacing = spacing + Math.round(d.r * 0.04); // slightly larger gap above symbol

        // Determine whether text will fit inside the bubble. If not, prefer showing a logo
        const symbolText = d.data && (d.data.symbol ? d.data.symbol.toUpperCase() : (d.data.name || '')) || '';
        const approxCharWidthFactor = 0.62; // approximation: avg char width relative to font-size
        const approxTextWidth = symbolText.length * symSize * approxCharWidthFactor;
        const availableInnerWidth = Math.max(6, (d.r * 2) * 0.82);

        // thresholds
        const LOGO_ONLY_THRESHOLD = 16; // very small bubbles prefer logo

        // If the calculated text width won't fit inside the bubble and we have an image, render logo-only
        if ((d.r <= LOGO_ONLY_THRESHOLD || approxTextWidth > availableInnerWidth) && d.data && d.data.image) {
          // slightly reduce small inline/logo size so it doesn't hug the top edge
          const smallLogoSize = Math.max(6, Math.min(Math.round(d.r * 0.85), Math.round(availableInnerWidth)));
          const topY = -Math.round(smallLogoSize / 2) + nudge;
          try {
            defs
              .append('clipPath')
              .attr('id', `clip-logo-small-${d.id}`)
              .append('circle')
              .attr('r', Math.max(2, Math.round(smallLogoSize / 2)))
              .attr('cx', 0)
              .attr('cy', 0);
          } catch (e) {
            // ignore (defs might be removed on re-render)
          }
          ln.append('image')
            .attr('class', 'logo-small')
            .attr('href', d.data.image)
            .attr('width', smallLogoSize)
            .attr('height', smallLogoSize)
            .attr('x', -smallLogoSize / 2)
            .attr('y', topY)
            .attr('clip-path', `url(#clip-logo-small-${d.id})`)
            .style('pointer-events', 'none');
          return;
        }

        // skip labels for extremely tiny rings with no image
        if (d.r < 6) return;

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
          try {
            defs
              .append('clipPath')
              .attr('id', `clip-logo-badge-${d.id}`)
              .append('circle')
              .attr('r', Math.max(4, Math.round(badgeImgSize / 2)))
              .attr('cx', 0)
              .attr('cy', 0);
          } catch (e) {
            // ignore
          }
          const badge = ln.append('g').attr('class', 'logo-badge').attr('transform', `translate(0, ${badgeCenterY})`);
          badge.append('image')
            .attr('href', d.data.image)
            .attr('width', badgeImgSize)
            .attr('height', badgeImgSize)
            .attr('x', -badgeImgSize / 2)
            .attr('y', -badgeImgSize / 2)
            .attr('clip-path', `url(#clip-logo-badge-${d.id})`)
            .style('pointer-events', 'none');
        }

        // symbol: centered in stack
          const symbolCenterY = topY + (hasBadge ? badgeImgSize + badgeSpacing : 0) + Math.round(symSize / 2);
          const symEl = ln.append('text')
          .attr('class', 'symbol')
          .text(symbolText)
          .attr('text-anchor', 'middle')
          .attr('y', symbolCenterY)
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none')
          .style('fill', '#ffffff')
          .style('font-family', "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif")
          .style('font-weight', 700)
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
        let contentText = '';
        let contentColor = '#baf3c9';
        if (selections && selections.content === 'Price') {
          // prefer common price fields - fallback to 0
          const priceRaw = d.data && (d.data.price ?? d.data.current_price ?? d.data.last_price ?? 0);
          const priceNum = Number(priceRaw) || 0;
          // formatting: 2 decimals for >=1, more precision for small prices
          let fmt;
          if (priceNum === 0) fmt = '0';
          else if (Math.abs(priceNum) >= 1) fmt = priceNum.toFixed(2);
          else if (Math.abs(priceNum) >= 0.01) fmt = priceNum.toPrecision(3);
          else fmt = priceNum.toPrecision(4);
          // show price without a leading currency symbol (use PKR context)
          contentText = fmt;
          contentColor = '#ffffff';
  } else if (selections && selections.content === 'Price Change') {
          // show the absolute price change amount (in PKR) computed from percent and price
          const priceRaw = d.data && (d.data.price ?? d.data.current_price ?? d.data.last_price ?? 0);
          const priceNum = Number(priceRaw) || 0;
          const pctVal = Number(pct) || 0; // pct is percent (e.g., 2.5)
          const delta = (pctVal / 100) * priceNum;
          const absDelta = Math.abs(delta);
          let fmt;
          if (absDelta === 0) fmt = '0';
          else if (absDelta >= 1) fmt = delta.toFixed(2);
          else if (absDelta >= 0.01) fmt = delta.toPrecision(3);
          else fmt = delta.toPrecision(4);
          // include explicit + sign for positive moves
          contentText = `${delta >= 0 ? '+' : ''}${fmt}`;
          contentColor = delta >= 0 ? '#baf3c9' : '#ffb6b6';
        } else if (selections && selections.content === 'Volume') {
          // show formatted 24h volume or known volume fields
          const volRaw = d.data && (d.data.volume ?? d.data.total_volume ?? d.data['24h_volume'] ?? d.data.market_cap ?? 0);
          const volNum = Number(volRaw) || 0;
          contentText = formatLargeNumber(volNum);
          contentColor = '#ffffff';
        } else {
          contentText = `${pct >= 0 ? '+' : ''}${(pct || 0).toFixed(1)}%`;
          contentColor = pct >= 0 ? '#baf3c9' : '#ffb6b6';
        }

        const pctEl = ln.append('text')
          .attr('class', selections && selections.content === 'Price' ? 'price' : (selections && selections.content === 'Price Change' ? 'price-change' : 'pct'))
          .text(contentText)
          .attr('text-anchor', 'middle')
          .attr('y', pctCenterY)
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none')
          .style('fill', contentColor)
          .style('font-family', "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif")
          .style('font-size', `${pctSize}px`)
          .style('font-weight', 600);
        if (pctSize >= 14) pctEl.attr('filter', 'url(#textShadow)');
      });

    // entry animation: grow circles/labels from small to their computed sizes for a smooth transition
    try {
      // hit area
      circleNodes.selectAll('.hit-area').attr('r', 1).transition().duration(600).attr('r', (d) => d.r);

      // ring fill and ring-only radii
      circleNodes.selectAll('.ring-fill').attr('r', 1).transition().duration(600).attr('r', (d) => Math.max(0, d.r - Math.max(1, Math.round(Math.max(2, Math.min(12, d.r * 0.08)) * 0.5))));
      circleNodes
        .selectAll('.ring-only')
        .attr('r', 1)
        .attr('stroke-width', 1)
        .transition()
        .duration(600)
        .attr('r', (d) => d.r)
        .attr('stroke-width', (d) => Math.max(2, Math.min(12, d.r * 0.08)));

      // labels: fade/scale in by transitioning font-size (note: exact font sizes are computed when labels are rendered)
  labelNodes.selectAll('.symbol').style('font-size', '2px').transition().duration(600).style('font-size', (d) => `${Math.max(8, Math.round(d.r * 0.36))}px`);
  labelNodes.selectAll('.pct').style('font-size', '2px').transition().duration(600).style('font-size', (d) => `${Math.max(8, Math.round(d.r * 0.24))}px`);
    } catch (e) {
      // ignore animation errors
    }

    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'cb-tooltip')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background', '#fff')
      .style('padding', '8px')
      .style('border-radius', '6px')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.2)')
      .style('pointer-events', 'none')
      .style('z-index', 1000);

    // pointer interactions for groups (chained correctly)
    circleNodes
      .style('cursor', onSelectCoin ? 'pointer' : 'default')
      .on('mouseover', function (event, d) {
        // support older class names and the newer rim class
        d3.select(this).select('.rim, .ring, .ring-only').attr('stroke-width', Math.max(3, d.r * 0.12));
        const ttPct = (function(di) {
          if (di.overridePct != null) return di.overridePct;
          if (aggregations && selections && selections.size === 'Performance') {
            const v = aggregations.get(di.data && (di.data.symbol || di.data.id) || di.id);
            if (v != null) return v;
          }
          return di.data && (di.data.price_change_percentage_24h || 0);
        })(d);
        tooltip
          .style('display', 'block')
          .html(`<strong>${d.data.name} (${d.data.symbol.toUpperCase()})</strong><br/>${d.data.price}<br/>24h: ${ttPct.toFixed(2)}%`);
      })
      .on('mousemove', function (event) {
        const ttNode = tooltip.node();
        const pad = 10;
        let x = event.clientX + pad;
        let y = event.clientY + pad;
        if (ttNode) {
          const ttW = ttNode.offsetWidth || 150;
          const ttH = ttNode.offsetHeight || 60;
          x = Math.min(x, window.innerWidth - ttW - pad);
          y = Math.min(y, window.innerHeight - ttH - pad);
        }
        tooltip.style('left', x + 'px').style('top', y + 'px');
      })
      .on('mouseout', function (event, d) {
        d3.select(this).select('.rim, .ring, .ring-only').attr('stroke-width', Math.max(1, Math.min(8, d.r * 0.12)));
        tooltip.style('display', 'none');
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
      // keep nodes inside the drawing area (bounce at edges)
      nodes.forEach((d) => {
        // apply simple boundary constraints
        const minX = d.r;
        const maxX = w - d.r;
        const minY = d.r;
        const maxY = h - d.r;
        if (d.x < minX) {
          d.x = minX;
          if (d.vx) d.vx = Math.abs(d.vx) * 0.6;
        } else if (d.x > maxX) {
          d.x = maxX;
          if (d.vx) d.vx = -Math.abs(d.vx) * 0.6;
        }
        if (d.y < minY) {
          d.y = minY;
          if (d.vy) d.vy = Math.abs(d.vy) * 0.6;
        } else if (d.y > maxY) {
          d.y = maxY;
          if (d.vy) d.vy = -Math.abs(d.vy) * 0.6;
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
          const isPos = (d.data.price_change_percentage_24h || 0) >= 0;
          const color = isPos ? 'rgba(35,197,94,0.95)' : 'rgba(242,85,85,0.95)';
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
      tooltip.remove();
      svg.on('.zoom', null);
    };
  }, [data, size.width, size.height, single, radiusScale, selections, aggregations]);

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
          right: 12,
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
    </div>
  );
});
