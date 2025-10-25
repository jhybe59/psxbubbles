
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
export default forwardRef(function BubbleChart({ data, width = 900, height = 600, single = false, radiusScale = null, selections = {}, aggregations = null, onSelectCoin = null }, ref) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
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
  const textFilter = defs.append('filter').attr('id', 'textShadow');
  textFilter.append('feOffset').attr('dx', 0).attr('dy', 2).attr('result', 'off');
  textFilter.append('feGaussianBlur').attr('in', 'off').attr('stdDeviation', 1).attr('result', 'blur');
  const feMerge = textFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'blur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // If a percent-based radiusScale is provided use it; otherwise fall back to market cap
  const inferredMax = d3.max(data, (d) => Math.abs(d.price_change_percentage_24h || 0)) || 1;

    // reduce number of rendered nodes in dense views to improve legibility and perf
    const maxNodes = 140; // was 200
    const used = data.slice(0, maxNodes);

  // Demo: pick two random coins to artificially show large positive moves so user can see size scaling
    try {
      const demoCount = 2;
      const picks = new Set();
      while (picks.size < Math.min(demoCount, used.length)) {
        picks.add(Math.floor(Math.random() * used.length));
      }
      const arr = Array.from(picks);
      if (arr.length > 0) used[arr[0]].__overrideDemo = 30;
      if (arr.length > 1) used[arr[1]].__overrideDemo = 48;
    } catch (e) {
      // ignore randomness errors
    }

    // compute a local max absolute pct (including any demo overrides) so sizing maps correctly
    const localMaxPct = d3.max(used, (d) => {
      const demo = d.__overrideDemo != null ? d.__overrideDemo : (d.price_change_percentage_24h || 0);
      // if aggregations provided and size selection is Performance, prefer aggregation for magnitude
      if (aggregations && selections && selections.size === 'Performance') {
        const agg = aggregations.get(d.symbol || d.id || (d.name && d.name.toUpperCase()));
        return Math.abs(agg != null ? agg : demo);
      }
      return Math.abs(demo);
    }) || 1;
    // local radius scale: map 0..localMaxPct -> reasonable radius range (8..90) to make rings visually distinct
    const localRadiusScale = d3.scaleSqrt().domain([0, localMaxPct]).range([8, 92]);

    // If single mode is requested, pick the largest absolute percent-change coin and render it centered
    if (single) {
      const largest = used.reduce((a, b) => (Math.abs(b.price_change_percentage_24h || 0) > Math.abs(a.price_change_percentage_24h || 0) ? b : a), used[0] || null);
      if (!largest) return;
      const baseR = radiusScale ? radiusScale(Math.abs(largest.price_change_percentage_24h || 0)) : Math.max(12, Math.round(d3.scaleSqrt().domain([0, inferredMax]).range([12, 160])(largest.market_cap)));
      // ensure the single bubble is visually prominent by scaling up relative to viewport
      const displayR = Math.min(Math.max(baseR, Math.min(w, h) * 0.18), Math.min(w, h) / 2 - 16);
      const singleNode = { id: largest.id, r: baseR, x: w / 2, y: h / 2, data: largest, displayR };

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
      const fillOpacitySingle = pct >= 0 ? 0.06 : 0.09;
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
      const r = Math.max(4, Math.round(localRadiusScale(pctAbs)));
      const prev = prevMap.get(d.id);
      if (prev) {
        return { id: d.id, r, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy, data: d, overridePct: overridePct };
      }
      return { id: d.id, r, x: Math.random() * w, y: Math.random() * h, data: d, overridePct: overridePct };
    });

    // viewport-aware global radius scaling: ensure the largest ring fits within a target fraction
    // of the viewport so visuals match the example scale. targetFraction is fraction of min(w,h)
    const targetFraction = 0.26; // increase to ~26% so largest rings appear larger
    const minDim = Math.min(w, h);
    const rawMaxR = d3.max(nodes, (n) => n.r) || 1;
    const desiredMaxR = Math.max(8, Math.floor(minDim * targetFraction));
    // compute a global scale factor to apply to all radii
    // allow small upscale up to 1.25 to make visuals more prominent
    const rawScale = rawMaxR > 0 ? desiredMaxR / rawMaxR : 1;
    const globalRScale = Math.max(0.6, Math.min(1.25, rawScale));
    if (Math.abs(globalRScale - 1) > 0.0001) {
      nodes.forEach((n) => {
        n.r = Math.max(4, Math.round(n.r * globalRScale));
      });
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
  const pct = pctFor(nd);
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
    function wanderForce(strength = 0.22) {
      let nodesInternal;
      function force(alpha) {
        if (!nodesInternal) return;
        const t = Date.now() / 1000;
        for (const n of nodesInternal) {
          if (n.__phase == null) n.__phase = (Math.random() * 2 - 1) * Math.PI;
          const phase = n.__phase;
          const freq = 0.6 + Math.max(0, 0.5 - n.r / 120);
          const ax = Math.sin(t * freq + phase) * 0.12 * (0.4 + n.r / 120);
          const ay = Math.cos(t * (freq * 0.85) + phase * 0.7) * 0.08 * (0.4 + n.r / 120);
          n.vx = (n.vx || 0) + ax * strength * alpha;
          n.vy = (n.vy || 0) + ay * strength * alpha;
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

    // gentler strengths to avoid large jumps on data refresh
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-6))
      .force('collision', d3.forceCollide().radius((d) => d.r + Math.max(1, d.r * 0.06)).iterations(2))
      .force('anchorX', anchorX(0.08))
      .force('anchorY', anchorY(0.08))
      .force('wander', wanderForce(0.5))
      .velocityDecay(0.14)
      .alphaDecay(0.02)
      .on('tick', ticked);

    simRef.current = simulation;
    nodesRef.current = nodes;

  // Create two layers: circlesGroup (scales with zoom) and labelsGroup (keeps constant size)
  const circlesGroup = g.append('g').attr('class', 'circles-group');
  // disable pointer events on labelsGroup so clicks fall through to circles underneath
  const labelsGroup = g.append('g').attr('class', 'labels-group').attr('pointer-events', 'none');

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
        // subtle inner fill using the same edge color (very low opacity)
        const fillOpacity = pct >= 0 ? 0.06 : 0.09;
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
        // sizes scale with radius
        const symSize = Math.max(8, Math.min(48, d.r * 0.32));
        const pctSize = Math.max(8, Math.min(18, d.r * 0.18));

        // if very small, try to render a tiny logo centered inside the ring (if image available)
        const LOGO_ONLY_THRESHOLD = 16;
        if (d.r <= LOGO_ONLY_THRESHOLD && d.data && d.data.image) {
          const smallLogoSize = Math.max(6, Math.min(20, d.r * 0.9));
          ln.append('image')
            .attr('class', 'logo-small')
            .attr('href', d.data.image)
            .attr('width', smallLogoSize)
            .attr('height', smallLogoSize)
            .attr('x', -smallLogoSize / 2)
            .attr('y', -smallLogoSize / 2)
            .attr('clip-path', `url(#clip-${d.id})`)
            .style('pointer-events', 'none');
          return;
        }

        // skip labels for extremely tiny rings with no image
        if (d.r < 6) return;

  // symbol: centered slightly above center for better optical balance
        const symbolY = Math.round(-symSize * 0.12);
        ln.append('text')
          .attr('class', 'symbol')
          .text(d.data.symbol ? d.data.symbol.toUpperCase() : (d.data.name || ''))
          .attr('text-anchor', 'middle')
          .attr('y', symbolY)
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none')
          .style('fill', '#ffffff')
          .style('font-weight', 800)
          .style('font-size', `${symSize}px`)
          .attr('filter', 'url(#textShadow)');

        // percent below the symbol
        const pctY = Math.round(symbolY + symSize * 0.9 + 6);
        ln.append('text')
          .attr('class', 'pct')
          .text(`${pct >= 0 ? '+' : ''}${(pct || 0).toFixed(1)}%`)
          .attr('text-anchor', 'middle')
          .attr('y', pctY)
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none')
          .style('fill', pct >= 0 ? '#baf3c9' : '#ffb6b6')
          .style('font-size', `${pctSize}px`)
          .style('font-weight', 700)
          .attr('filter', 'url(#textShadow)');

        // for larger rings, if image exists, render a small badge above the symbol
  if (d.r >= LOGO_ONLY_THRESHOLD && d.data && d.data.image) {
          const logoSize = Math.max(12, Math.min(40, d.r * 0.28));
          const logoY = -d.r * 0.6;
          const badge = ln.append('g').attr('class', 'logo-badge').attr('transform', `translate(0, ${logoY})`);
          badge.append('circle').attr('r', Math.max(8, logoSize / 2)).attr('fill', 'rgba(0,0,0,0.72)');
          badge.append('image')
            .attr('href', d.data.image)
            .attr('width', Math.max(10, logoSize * 0.7))
            .attr('height', Math.max(10, logoSize * 0.7))
            .attr('x', -Math.max(10, logoSize * 0.7) / 2)
            .attr('y', -Math.max(10, logoSize * 0.7) / 2)
            .attr('clip-path', `url(#clip-${d.id})`)
            .style('pointer-events', 'none');
        }
      });

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
          .html(`<strong>${d.data.name} (${d.data.symbol.toUpperCase()})</strong><br/>$${d.data.price}<br/>24h: ${ttPct.toFixed(2)}%`);
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
  }, [data, size.width, size.height, single, radiusScale]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet" />
    </div>
  );
});
