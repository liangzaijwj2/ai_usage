/* ============================================================
   site.js — 访客端报告页
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = Charts.esc;

  var state = {
    toolFilter: 'all',
    keyword: ''
  };

  /* ---------------- 主题 ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = $('themeBtn');
    if (btn) btn.innerHTML = t === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2M12 19.4v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.6 12h2M19.4 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.9 6.9 0 0 0 11.1 11.1z"/></svg>';
    try { localStorage.setItem('ai-footprint.theme', t); } catch (e) {}
  }

  /* ---------------- 工具函数 ---------------- */
  function hours(m) { return Math.round(m / 6) / 10; }

  function fmtDate(d) {
    var p = String(d).split('-');
    return p[1] + '/' + p[2];
  }

  function monthLabel(m) {
    var p = m.split('-');
    return p[0] + '年' + Number(p[1]) + '月';
  }

  function initials(name) {
    if (!name) return 'AI';
    var s = String(name).trim();
    if (/^[\x00-\x7F]+$/.test(s)) {
      var parts = s.split(/[\s._-]+/).filter(Boolean);
      return (parts.length > 1 ? parts[0][0] + parts[1][0] : s.slice(0, 2)).toUpperCase();
    }
    return s.slice(0, 2);
  }

  function relTime(dateStr) {
    var today = new Date();
    var t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var d = new Date(dateStr);
    var diff = Math.round((t0 - d) / 86400000);
    if (diff <= 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff < 30) return diff + ' 天前';
    if (diff < 365) return Math.round(diff / 30) + ' 个月前';
    return Math.round(diff / 365) + ' 年前';
  }

  /* ---------------- 渲染 ---------------- */

  function renderHero() {
    var p = Store.profile();
    var av = $('avatar');
    if (p.avatar) {
      av.innerHTML = '<img src="' + esc(p.avatar) + '" alt="">';
    } else {
      av.textContent = initials(p.name);
    }
    $('heroName').textContent = p.name || '未命名';
    $('heroRole').textContent = [p.role, p.since ? '自 ' + p.since + ' 起' : ''].filter(Boolean).join(' · ');
    $('heroTagline').textContent = p.tagline || '';
    $('heroBio').textContent = p.bio || '';

    document.title = (p.name || '我') + ' 的 AI 使用足迹报告';

    var actions = $('heroActions');
    actions.innerHTML = '';
    (p.links || []).forEach(function (l) {
      if (!l || !l.url) return;
      var a = document.createElement('a');
      a.className = 'btn btn-sm';
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = l.label || l.url;
      actions.appendChild(a);
    });
  }

  function renderKpis() {
    var s = Store.summary();
    var delta = Store.recentDelta();
    var catCount = Store.byCategory().length;

    var cards = [
      {
        label: '覆盖工具',
        value: s.toolCount,
        unit: '/ ' + Store.tools().length,
        foot: '横跨 <b>' + catCount + '</b> 个类别'
      },
      {
        label: '累计时长',
        value: s.totalHours,
        unit: '小时',
        foot: '记录期内日均 <b>' + s.avgPerDay + '</b> 分钟'
      },
      {
        label: '使用记录',
        value: s.recordCount,
        unit: '条',
        foot: '活跃 <b>' + s.activeDays + '</b> 天'
      },
      {
        label: '最近 30 天',
        value: delta ? hours(delta.current) : 0,
        unit: '小时',
        foot: delta
          ? '环比 <b class="' + (delta.pct < 0 ? 'down' : '') + '">' + (delta.pct >= 0 ? '+' : '') + delta.pct + '%</b>'
          : '样本不足'
      }
    ];

    var host = $('kpis');
    host.innerHTML = cards.map(function (c) {
      return '<div class="kpi">' +
        '<div class="kpi-label">' + esc(c.label) + '</div>' +
        '<div class="kpi-value">' + esc(c.value) + '<small>' + esc(c.unit) + '</small></div>' +
        '<div class="kpi-foot">' + c.foot + '</div>' +
        '</div>';
    }).join('');
  }

  function renderTrend() {
    var monthly = Store.monthly();
    var data = monthly.map(function (m) {
      return {
        label: Number(m.month.slice(5)) + '月',
        value: m.minutes,
        display: m.hours + ' 小时'
      };
    });
    Charts.areaChart($('trendChart'), { data: data, unitY: '分钟', ariaLabel: '每月使用时长趋势' });

    Charts.heatmap($('heatmapHost'), { daily: Store.daily(), weeks: 22, unit: ' 分钟' });
  }

  function renderCategory() {
    var items = Store.byCategory().map(function (c) {
      return { name: c.name, value: c.minutes, color: c.color };
    });
    var total = items.reduce(function (a, b) { return a + b.value; }, 0);
    Charts.donut($('donutHost'), {
      items: items,
      centerValue: hours(total),
      centerLabel: '小时'
    });

    $('donutLegend').innerHTML = items.map(function (c) {
      var pct = total ? Math.round((c.value / total) * 100) : 0;
      return '<div class="legend-row">' +
        '<span class="legend-key" style="background:' + esc(c.color) + '"></span>' +
        '<span>' + esc(c.name) + '</span>' +
        '<span class="legend-val">' + pct + '%</span>' +
        '</div>';
    }).join('') || '<div class="empty">暂无分类数据</div>';
  }

  function renderTools() {
    var stats = Store.toolStats().filter(function (s) { return s.count > 0; });
    var max = stats.length ? stats[0].minutes : 1;

    $('toolGrid').innerHTML = stats.map(function (s) {
      var t = s.tool;
      var pct = Math.max(3, Math.round((s.minutes / max) * 100));
      return '<article class="tool-card" style="--tc:' + esc(t.color || '#2b5cff') + '">' +
        '<div class="tool-top">' +
        '<div class="tool-logo">' + esc(t.icon || '✦') + '</div>' +
        '<div style="min-width:0">' +
        '<div class="tool-name">' + esc(t.name) + '</div>' +
        '<div class="tool-vendor">' + esc(t.vendor || '') + '</div>' +
        '</div>' +
        '<div class="tool-hours">' + s.hours + '<small> h</small></div>' +
        '</div>' +
        '<div class="tool-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="tool-foot">' +
        '<span>' + s.count + ' 次记录</span>' +
        '<span>·</span>' +
        '<span>' + (s.last ? relTime(s.last) : '—') + '</span>' +
        '</div>' +
        (t.note ? '<div class="tool-note">' + esc(t.note) + '</div>' : '') +
        '</article>';
    }).join('') || '<div class="empty">还没有工具记录</div>';
  }

  function renderSide() {
    var stats = Store.toolStats().filter(function (s) { return s.count > 0; });
    var recent = stats.slice().sort(function (a, b) {
      return (b.last || '').localeCompare(a.last || '');
    }).slice(0, 4);

    $('sideRecent').innerHTML = recent.map(function (s) {
      return '<div class="side-item">' +
        '<span class="side-dot" style="background:' + esc(s.tool.color || '#2b5cff') + ';color:' + esc(s.tool.color || '#2b5cff') + '"></span>' +
        '<span class="side-item-label">' + esc(s.tool.name) + '</span>' +
        '<span class="side-item-value">' + relTime(s.last) + '</span>' +
        '</div>';
    }).join('') || '<div class="side-item"><span class="side-item-label">暂无</span></div>';

    var paid = Store.tools().filter(function (t) { return Number(t.cost) > 0; });
    var cost = paid.reduce(function (a, t) { return a + Number(t.cost || 0); }, 0);
    $('sideCost').innerHTML =
      '<div class="kpi-value" style="font-size:26px">$' + cost + '<small>/ 月</small></div>' +
      '<div class="kpi-foot">' + paid.length + ' 个付费订阅 · 共 ' + Store.tools().length + ' 个在用工具</div>';

    var tags = Store.tagCloud().slice(0, 8);
    $('sideTags').innerHTML = tags.map(function (t) {
      return '<span class="chip">' + esc(t.tag) + ' <span style="color:var(--ink-4)">' + t.count + '</span></span>';
    }).join('') || '<span class="chip">暂无标签</span>';
  }

  function renderFilters() {
    var used = {};
    Store.records().forEach(function (r) { used[r.toolId] = 1; });
    var list = Store.tools().filter(function (t) { return used[t.id]; });

    var host = $('toolFilters');
    var html = '<button class="filter-btn' + (state.toolFilter === 'all' ? ' on' : '') + '" data-tool="all">全部工具</button>';
    html += list.map(function (t) {
      return '<button class="filter-btn' + (state.toolFilter === t.id ? ' on' : '') + '" data-tool="' + esc(t.id) + '">' +
        esc(t.name) + '</button>';
    }).join('');
    host.innerHTML = html;

    host.querySelectorAll('.filter-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.toolFilter = b.getAttribute('data-tool');
        renderFilters();
        renderTimeline();
      });
    });
  }

  function renderTimeline() {
    var recs = Store.records().slice();

    if (state.toolFilter !== 'all') {
      recs = recs.filter(function (r) { return r.toolId === state.toolFilter; });
    }
    if (state.keyword) {
      var kw = state.keyword.toLowerCase();
      recs = recs.filter(function (r) {
        var t = Store.tool(r.toolId);
        return (r.task + ' ' + (r.outcome || '') + ' ' + (r.tags || []).join(' ') + ' ' + (t ? t.name : ''))
          .toLowerCase().indexOf(kw) >= 0;
      });
    }

    recs.sort(function (a, b) { return b.date.localeCompare(a.date); });

    if (!recs.length) {
      $('timeline').innerHTML = '<div class="empty">没有符合条件的记录</div>';
      $('timelineCount').textContent = '0 条';
      return;
    }

    $('timelineCount').textContent = recs.length + ' 条 · 共 ' +
      hours(recs.reduce(function (a, r) { return a + (Number(r.minutes) || 0); }, 0)) + ' 小时';

    var groups = {};
    var order = [];
    recs.forEach(function (r) {
      var m = r.date.slice(0, 7);
      if (!groups[m]) { groups[m] = []; order.push(m); }
      groups[m].push(r);
    });

    var html = order.map(function (m) {
      var items = groups[m];
      var mins = items.reduce(function (a, r) { return a + (Number(r.minutes) || 0); }, 0);
      return '<div class="tl-month">' +
        '<div class="tl-month-head">' +
        '<span class="tl-month-name">' + esc(monthLabel(m)) + '</span>' +
        '<span class="tl-month-line"></span>' +
        '<span class="tl-month-sum">' + items.length + ' 条 · ' + hours(mins) + ' h</span>' +
        '</div>' +
        items.map(function (r, idx) {
          var t = Store.tool(r.toolId);
          var color = t ? t.color : '#2b5cff';
          var isLast = idx === items.length - 1;
          return '<div class="rec" style="--tc:' + esc(color) + '">' +
            '<div class="rec-date">' + esc(fmtDate(r.date)) + '</div>' +
            '<div class="rec-rail">' +
            '<span class="rec-node"></span>' +
            (isLast ? '' : '<span class="rec-line"></span>') +
            '</div>' +
            '<div>' +
            '<div class="rec-task">' + esc(r.task) + '</div>' +
            '<div class="rec-meta">' +
            '<span class="chip" style="border-color:' + esc(color) + '33;background:' + esc(color) + '14;color:' + esc(color) + '">' +
            esc(t ? t.icon + ' ' + t.name : '未知工具') + '</span>' +
            (r.tags || []).map(function (tg) { return '<span class="chip">#' + esc(tg) + '</span>'; }).join('') +
            '</div>' +
            (r.outcome ? '<div class="rec-outcome">→ ' + esc(r.outcome) + '</div>' : '') +
            '</div>' +
            '<div class="rec-dur">' + (Number(r.minutes) || 0) + ' 分钟</div>' +
            '</div>';
        }).join('') +
        '</div>';
    }).join('');

    $('timeline').innerHTML = html;
  }

  function renderInsights() {
    var list = Store.insights().slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
    $('insightGrid').innerHTML = list.map(function (i) {
      return '<article class="insight">' +
        '<h3>' + esc(i.title) + '</h3>' +
        '<p>' + esc(i.content) + '</p>' +
        '<div class="insight-foot">' +
        '<span>' + esc(i.date || '') + '</span>' +
        (i.tags || []).map(function (t) { return '<span class="chip">#' + esc(t) + '</span>'; }).join('') +
        '</div>' +
        '</article>';
    }).join('') || '<div class="empty">还没有写心得</div>';
  }

  function renderFoot() {
    var p = Store.profile();
    var up = Store.updatedAt();
    $('footMeta').innerHTML =
      '<span>数据由 <code>' + esc(p.name || '我') + '</code> 维护</span>' +
      (up ? '<span>· 最近更新 ' + esc(new Date(up).toLocaleDateString('zh-CN')) + '</span>' : '');
  }

  /* ---------------- 交互 ---------------- */
  function bindUI() {
    $('themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    var nav = $('nav');
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 8);
      var secs = ['overview', 'tools', 'timeline', 'insights'];
      var y = window.scrollY + 120;
      var current = null;
      secs.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.offsetTop <= y) current = id;
      });
      document.querySelectorAll('.nav-links a').forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + current);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var search = $('recSearch');
    search.addEventListener('input', function () {
      state.keyword = search.value.trim();
      renderTimeline();
    });

    $('printBtn').addEventListener('click', function () { window.print(); });
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    await Store.init();
    var saved = null;
    try { saved = localStorage.getItem('ai-footprint.theme'); } catch (e) {}
    var pref = saved || Store.theme() || 'light';
    if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) pref = 'dark';
    applyTheme(pref);

    renderHero();
    renderKpis();
    renderTrend();
    renderCategory();
    renderTools();
    renderSide();
    renderFilters();
    renderTimeline();
    renderInsights();
    renderFoot();
    bindUI();
  }

  document.addEventListener('DOMContentLoaded', boot);

  // 后台改完内容后回到这里能立刻看到最新数据
  window.addEventListener('focus', function () {
    if (document.visibilityState === 'visible' && Store.state()) {
      renderKpis(); renderTrend(); renderCategory(); renderTools(); renderSide(); renderTimeline();
    }
  });
})();
