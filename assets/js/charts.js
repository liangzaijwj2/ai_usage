/* ============================================================
   charts.js — 原生 SVG 图表（无第三方依赖）
   ============================================================ */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function svgEl(w, h) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('width', '100%');
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    s.style.display = 'block';
    return s;
  }

  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = (v || '').trim();
    return v || fallback;
  }

  // Catmull-Rom -> 三次贝塞尔，得到平滑曲线
  function smoothPath(pts, tension) {
    if (!pts.length) return '';
    var t = tension == null ? 0.32 : tension;
    var d = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) * t / 2;
      var c1y = p1[1] + (p2[1] - p0[1]) * t / 2;
      var c2x = p2[0] - (p3[0] - p1[0]) * t / 2;
      var c2y = p2[1] - (p3[1] - p1[1]) * t / 2;
      d += ' C' + c1x.toFixed(2) + ',' + c1y.toFixed(2) + ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2) +
        ' ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
    }
    return d;
  }

  function niceMax(v) {
    if (v <= 0) return 60;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 3 ? 3 : f <= 5 ? 5 : f <= 7.5 ? 7.5 : 10;
    return nice * exp;
  }

  /* ---------------- 面积折线图 ---------------- */
  function areaChart(host, opts) {
    var data = opts.data || [];
    host.innerHTML = '';
    if (!data.length) { host.appendChild(emptyNote()); return; }

    var W = 720, H = 264;
    var pad = { l: 52, r: 18, t: 20, b: 38 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    var maxV = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; })) * 1.12);
    var step = data.length > 1 ? iw / (data.length - 1) : 0;

    var pts = data.map(function (d, i) {
      return [pad.l + step * i, pad.t + ih - (d.value / maxV) * ih];
    });

    var svg = svgEl(W, H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opts.ariaLabel || '趋势图');

    var id = 'ac' + Math.random().toString(36).slice(2, 8);
    var defs = el('defs');
    var lg = el('linearGradient', { id: id + '-fill', x1: '0', y1: '0', x2: '0', y2: '1' });
    lg.appendChild(el('stop', { offset: '0%', 'stop-color': opts.color || cssVar('--brand', '#2b5cff'), 'stop-opacity': '0.34' }));
    lg.appendChild(el('stop', { offset: '100%', 'stop-color': opts.color || cssVar('--brand', '#2b5cff'), 'stop-opacity': '0' }));
    defs.appendChild(lg);
    var lg2 = el('linearGradient', { id: id + '-line', x1: '0', y1: '0', x2: '1', y2: '0' });
    lg2.appendChild(el('stop', { offset: '0%', 'stop-color': opts.color2 || cssVar('--brand', '#2b5cff') }));
    lg2.appendChild(el('stop', { offset: '100%', 'stop-color': opts.color || cssVar('--brand-2', '#00c6ff') }));
    defs.appendChild(lg2);
    svg.appendChild(defs);

    // 网格 + Y 轴刻度
    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var y = pad.t + (ih / ticks) * i;
      svg.appendChild(el('line', {
        x1: pad.l, y1: y, x2: W - pad.r, y2: y,
        stroke: cssVar('--line', '#e5e9f4'), 'stroke-width': 1,
        'stroke-dasharray': i === ticks ? 'none' : '3 5'
      }));
      var val = maxV - (maxV / ticks) * i;
      svg.appendChild(el('text', {
        x: pad.l - 10, y: y + 4, 'text-anchor': 'end',
        'font-size': 11, 'font-family': 'ui-monospace, monospace',
        fill: cssVar('--ink-3', '#7d869e')
      }, fmtNum(val)));
    }

    if (opts.unitY) {
      svg.appendChild(el('text', {
        x: pad.l - 10, y: pad.t - 6, 'text-anchor': 'end',
        'font-size': 10, 'font-family': 'ui-monospace, monospace',
        fill: cssVar('--ink-4', '#a7aec1')
      }, opts.unitY));
    }

    // 面积
    var line = smoothPath(pts);
    var area = line + ' L' + pts[pts.length - 1][0].toFixed(2) + ',' + (pad.t + ih) +
      ' L' + pts[0][0].toFixed(2) + ',' + (pad.t + ih) + ' Z';
    svg.appendChild(el('path', { d: area, fill: 'url(#' + id + '-fill)' }));
    svg.appendChild(el('path', {
      d: line, fill: 'none', stroke: 'url(#' + id + '-line)',
      'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));

    // 数据点
    var every = data.length > 14 ? Math.ceil(data.length / 12) : 1;
    pts.forEach(function (p, i) {
      var isLast = i === pts.length - 1;
      if (i % every !== 0 && !isLast) return;
      var g = el('g');
      g.appendChild(el('circle', { cx: p[0], cy: p[1], r: 10, fill: 'transparent' }));
      g.appendChild(el('circle', {
        cx: p[0], cy: p[1], r: isLast ? 4.5 : 3,
        fill: cssVar('--bg-elev', '#fff'),
        stroke: opts.color2 || cssVar('--brand', '#2b5cff'), 'stroke-width': 2
      }));
      var tt = el('title', {}, data[i].label + '：' + data[i].display);
      g.appendChild(tt);
      svg.appendChild(g);
    });

    // X 轴标签
    data.forEach(function (d, i) {
      if (data.length > 8 && i % Math.ceil(data.length / 7) !== 0 && i !== data.length - 1) return;
      svg.appendChild(el('text', {
        x: pad.l + step * i, y: H - 12, 'text-anchor': 'middle',
        'font-size': 11, 'font-family': 'ui-monospace, monospace',
        fill: cssVar('--ink-3', '#7d869e')
      }, d.label));
    });

    host.appendChild(svg);
  }

  function fmtNum(v) {
    if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
    return String(Math.round(v * 10) / 10);
  }

  /* ---------------- 环形图 ---------------- */
  function donut(host, opts) {
    var items = (opts.items || []).filter(function (i) { return i.value > 0; });
    host.innerHTML = '';
    var total = items.reduce(function (a, b) { return a + b.value; }, 0);
    if (!items.length || !total) { host.appendChild(emptyNote()); return; }

    var S = 220, cx = S / 2, cy = S / 2, r = 82, sw = 24;
    var svg = svgEl(S, S);
    svg.style.maxWidth = '240px';
    svg.style.margin = '0 auto';

    var CIRC = 2 * Math.PI * r;
    var offset = 0;
    var gap = items.length > 1 ? 2.5 : 0;

    svg.appendChild(el('circle', {
      cx: cx, cy: cy, r: r, fill: 'none',
      stroke: cssVar('--bg-soft', '#eef1f9'), 'stroke-width': sw
    }));

    items.forEach(function (it) {
      var frac = it.value / total;
      var len = Math.max(CIRC * frac - gap, 0.8);
      var c = el('circle', {
        cx: cx, cy: cy, r: r, fill: 'none',
        stroke: it.color || cssVar('--brand', '#2b5cff'),
        'stroke-width': sw,
        'stroke-dasharray': len.toFixed(2) + ' ' + (CIRC - len).toFixed(2),
        'stroke-dashoffset': (-offset).toFixed(2),
        'stroke-linecap': 'round',
        transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
      });
      c.appendChild(el('title', {}, it.name + '：' + Math.round(frac * 100) + '%'));
      svg.appendChild(c);
      offset += CIRC * frac;
    });

    if (opts.centerValue != null) {
      svg.appendChild(el('text', {
        x: cx, y: cy + 2, 'text-anchor': 'middle',
        'font-size': 30, 'font-weight': 600,
        'font-family': 'ui-monospace, monospace',
        fill: cssVar('--ink', '#0a0f1f')
      }, String(opts.centerValue)));
      svg.appendChild(el('text', {
        x: cx, y: cy + 24, 'text-anchor': 'middle',
        'font-size': 11.5, 'font-family': 'ui-monospace, monospace',
        fill: cssVar('--ink-3', '#7d869e'), 'letter-spacing': '0.08em'
      }, opts.centerLabel || ''));
    }
    host.appendChild(svg);
  }

  /* ---------------- 热力图 ---------------- */
  function heatmap(host, opts) {
    var daily = opts.daily || {};
    host.innerHTML = '';

    var weeks = opts.weeks || 22;
    var end = opts.end ? new Date(opts.end) : new Date();
    // 对齐到周六，便于按周分列
    var endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    var shift = 6 - endDay.getDay();
    var last = new Date(endDay.getTime() + shift * 86400000);

    var cell = 13, gap = 4, left = 30, top = 20;
    var W = left + weeks * (cell + gap) + 8;
    var H = top + 7 * (cell + gap) + 6;

    var svg = svgEl(W, H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '每日使用热力图');

    var values = Object.keys(daily).map(function (k) { return daily[k]; });
    var maxV = values.length ? Math.max.apply(null, values) : 1;

    function level(v) {
      if (!v) return 0;
      var q = v / maxV;
      if (q <= 0.2) return 1;
      if (q <= 0.45) return 2;
      if (q <= 0.75) return 3;
      return 4;
    }
    var ramp = ['--bg-soft', '--hm1', '--hm2', '--hm3', '--hm4'];
    var fallback = ['#eef1f9', '#c9d9ff', '#8fb0ff', '#4d7bff', '#1f47d6'];

    var monthLabels = [];
    for (var w = 0; w < weeks; w++) {
      for (var d = 0; d < 7; d++) {
        var dt = new Date(last.getTime() - ((weeks - 1 - w) * 7 + (6 - d)) * 86400000);
        var key = iso(dt);
        var v = daily[key] || 0;
        var x = left + w * (cell + gap);
        var y = top + d * (cell + gap);
        var rect = el('rect', {
          x: x, y: y, width: cell, height: cell, rx: 3,
          fill: cssVar(ramp[level(v)], fallback[level(v)]),
          opacity: v ? 1 : 0.75
        });
        rect.appendChild(el('title', {}, key + ' · ' + v + (opts.unit || ' 分钟')));
        svg.appendChild(rect);

        if (d === 0 && dt.getDate() <= 7) {
          monthLabels.push({ x: x, text: (dt.getMonth() + 1) + '月' });
        }
      }
    }

    monthLabels.forEach(function (m) {
      svg.appendChild(el('text', {
        x: m.x, y: 12, 'font-size': 10.5,
        'font-family': 'ui-monospace, monospace',
        fill: cssVar('--ink-3', '#7d869e')
      }, m.text));
    });

    ['一', '三', '五'].forEach(function (lbl, idx) {
      var d = [1, 3, 5][idx];
      svg.appendChild(el('text', {
        x: left - 8, y: top + d * (cell + gap) + cell - 2.5,
        'text-anchor': 'end', 'font-size': 10,
        'font-family': 'ui-monospace, monospace',
        fill: cssVar('--ink-4', '#a7aec1')
      }, lbl));
    });

    host.appendChild(svg);
  }

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function emptyNote(text) {
    var d = document.createElement('div');
    d.className = 'empty';
    d.textContent = text || '暂无数据';
    return d;
  }

  global.Charts = {
    areaChart: areaChart,
    donut: donut,
    heatmap: heatmap,
    emptyNote: emptyNote,
    esc: esc,
    iso: iso
  };
})(window);
