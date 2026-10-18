/* ============================================================
   admin.js — 后台管理
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = Charts.esc;
  var currentTab = 'profile';

  /* ---------------- 主题 ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = $('themeBtn');
    if (btn) btn.textContent = t === 'dark' ? '浅色' : '深色';
    try { localStorage.setItem('ai-footprint.theme', t); } catch (e) {}
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, isErr) {
    var host = $('toastHost');
    var el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 2400);
  }

  /* ---------------- Modal ---------------- */
  function openModal(opts) {
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    var bodyHtml = opts.body || '';
    mask.innerHTML =
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h3>' + esc(opts.title) + '</h3>' +
      '<button class="btn btn-ghost btn-sm" data-close style="margin-left:auto">关闭</button></div>' +
      '<form class="modal-body" id="modalForm">' + bodyHtml + '</form>' +
      '<div class="modal-foot">' +
      '<button class="btn" type="button" data-close>取消</button>' +
      '<button class="btn btn-primary" type="button" id="modalSubmit">' + esc(opts.submitLabel || '保存') + '</button>' +
      '</div></div>';

    document.body.appendChild(mask);
    document.body.style.overflow = 'hidden';

    function close() {
      mask.remove();
      document.body.style.overflow = '';
    }
    mask.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });

    var form = mask.querySelector('#modalForm');
    mask.querySelector('#modalSubmit').addEventListener('click', function () {
      var ok = opts.onSubmit(form, close);
      if (ok === false) return;
      close();
    });
    var first = form.querySelector('input,select,textarea');
    if (first) setTimeout(function () { first.focus(); }, 40);
    return { close: close, form: form };
  }

  function confirmDialog(title, text, onYes) {
    openModal({
      title: title,
      body: '<p style="font-size:13.5px;color:var(--ink-2)">' + esc(text) + '</p>',
      submitLabel: '确认删除',
      onSubmit: function () { onYes(); }
    });
  }

  /* ---------------- 字段构造 ---------------- */
  function field(label, inner, hint) {
    return '<div class="field"><label>' + esc(label) + '</label>' + inner +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</div>';
  }
  function input(name, value, opts) {
    opts = opts || {};
    return '<input class="input" name="' + name + '" value="' + esc(value == null ? '' : value) + '"' +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') +
      (opts.type ? ' type="' + opts.type + '"' : '') + '>';
  }
  function textarea(name, value, rows) {
    return '<textarea class="textarea" name="' + name + '" rows="' + (rows || 3) + '">' + esc(value || '') + '</textarea>';
  }
  function select(name, value, options) {
    return '<select class="select" name="' + name + '">' + options.map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (o.value === value ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('') + '</select>';
  }

  function tagInput(value) {
    return input('tags', (value || []).join(', '), { placeholder: '多个标签用逗号分隔' });
  }
  function parseTags(v) {
    return String(v || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* ---------------- 登录 ---------------- */
  function renderLogin() {
    $('gate').innerHTML =
      '<div class="login-card">' +
      '<h1>进入后台</h1>' +
      '<p class="sub">输入管理口令后可以编辑工具、记录与心得。</p>' +
      '<form id="loginForm">' +
      '<div class="field"><label>管理口令</label>' +
      '<input class="input" id="loginPw" type="password" autocomplete="current-password" placeholder="请输入口令"></div>' +
      '<div id="loginErr" class="hint" style="color:var(--danger);min-height:16px;margin-top:8px"></div>' +
      '<button class="btn btn-primary" type="submit">登录</button>' +
      '</form>' +
      '<div class="hint" style="margin-top:16px;text-align:center">' +
      '首次使用默认口令 <code style="font-family:var(--mono)">' + esc(Store.DEFAULT_PASSWORD) + '</code>，登录后请及时修改</div>' +
      '</div>';

    $('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pw = $('loginPw').value;
      var ok = await Store.login(pw);
      if (ok) {
        enterApp();
      } else {
        $('loginErr').textContent = '口令不正确';
        $('loginPw').value = '';
      }
    });
  }

  function enterApp() {
    $('gate').style.display = 'none';
    $('shell').style.display = '';
    renderTabs();
    renderTab(currentTab);
  }

  /* ---------------- Tabs ---------------- */
  var TABS = [
    { id: 'profile', label: '站点信息' },
    { id: 'tools', label: 'AI 工具' },
    { id: 'records', label: '使用记录' },
    { id: 'insights', label: '心得' },
    { id: 'data', label: '数据与安全' }
  ];

  function renderTabs() {
    $('tabs').innerHTML = TABS.map(function (t) {
      return '<button class="tab' + (currentTab === t.id ? ' on' : '') + '" data-tab="' + t.id + '">' + esc(t.label) + '</button>';
    }).join('');
    $('tabs').querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        currentTab = b.getAttribute('data-tab');
        renderTabs();
        renderTab(currentTab);
      });
    });
  }

  function renderTab(id) {
    var fn = { profile: tabProfile, tools: tabTools, records: tabRecords, insights: tabInsights, data: tabData }[id];
    if (fn) fn();
  }

  /* ---------------- 站点信息 ---------------- */
  function tabProfile() {
    var p = Store.profile();
    var links = (p.links || []).map(function (l) {
      return '<div class="row-card" data-link>' +
        '<div class="row-main">' +
        '<div class="form-grid">' +
        '<div class="field"><label>名称</label><input class="input" data-lk-label value="' + esc(l.label) + '"></div>' +
        '<div class="field"><label>链接</label><input class="input" data-lk-url value="' + esc(l.url) + '"></div>' +
        '</div></div>' +
        '<div class="row-actions"><button class="btn btn-sm btn-danger" data-lk-del>删除</button></div>' +
        '</div>';
    }).join('');

    $('panel').innerHTML =
      '<div class="panel">' +
      '<div class="panel-head"><div><div class="panel-title">站点信息</div>' +
      '<div class="panel-sub">显示在报告页首屏</div></div></div>' +
      '<div class="panel-body">' +
      '<form id="profileForm" class="stack">' +
      '<div class="form-grid">' +
      field('名字', input('name', p.name), '会显示在标题和页脚') +
      field('身份 / 标签', input('role', p.role), '例如：独立开发者 / AI 重度使用者') +
      '<div class="col-2">' + field('主标语', input('tagline', p.tagline), '首屏大字，建议 4–10 字') + '</div>' +
      '<div class="col-2">' + field('简介', textarea('bio', p.bio, 3)) + '</div>' +
      field('开始使用时间', input('since', p.since, { placeholder: '2023-03' })) +
      field('头像图片地址', input('avatar', p.avatar, { placeholder: '留空则显示名字首字母' })) +
      '</div>' +
      '<div style="margin-top:6px">' +
      '<div class="row-title" style="margin-bottom:10px">个人链接<div class="row-actions" style="margin-left:auto">' +
      '<button class="btn btn-sm" type="button" id="addLink">添加链接</button></div></div>' +
      '<div class="stack" id="linkList">' + (links || '<div class="empty">还没有添加链接</div>') + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn btn-primary" type="submit">保存站点信息</button></div>' +
      '</form></div></div>';

    $('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      Store.setProfile({
        name: f.name.value.trim(),
        role: f.role.value.trim(),
        tagline: f.tagline.value.trim(),
        bio: f.bio.value.trim(),
        since: f.since.value.trim(),
        avatar: f.avatar.value.trim(),
        links: collectLinks()
      });
      toast('站点信息已保存');
    });

    function collectLinks() {
      return Array.prototype.map.call($('linkList').querySelectorAll('[data-link]'), function (row) {
        return {
          label: row.querySelector('[data-lk-label]').value.trim(),
          url: row.querySelector('[data-lk-url]').value.trim()
        };
      }).filter(function (l) { return l.label && l.url; });
    }

    $('addLink').addEventListener('click', function () {
      var list = $('linkList');
      if (list.querySelector('.empty')) list.innerHTML = '';
      var row = document.createElement('div');
      row.className = 'row-card';
      row.setAttribute('data-link', '');
      row.innerHTML = '<div class="row-main"><div class="form-grid">' +
        '<div class="field"><label>名称</label><input class="input" data-lk-label></div>' +
        '<div class="field"><label>链接</label><input class="input" data-lk-url placeholder="https://"></div>' +
        '</div></div><div class="row-actions"><button class="btn btn-sm btn-danger" data-lk-del>删除</button></div>';
      list.appendChild(row);
    });

    $('panel').addEventListener('click', function (e) {
      var del = e.target.closest('[data-lk-del]');
      if (del) {
        var row = del.closest('[data-link]');
        row.remove();
        if (!$('linkList').children.length) $('linkList').innerHTML = '<div class="empty">还没有添加链接</div>';
      }
    });
  }

  /* ---------------- 工具 ---------------- */
  function tabTools() {
    var list = Store.tools().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    $('panel').innerHTML =
      '<div class="panel"><div class="panel-head">' +
      '<div><div class="panel-title">AI 工具</div><div class="panel-sub">共 ' + list.length + ' 个</div></div>' +
      '<div class="right"><button class="btn btn-primary btn-sm" id="addTool">新增工具</button></div>' +
      '</div><div class="panel-body"><div class="stack">' +
      (list.length ? list.map(function (t) {
        return '<div class="row-card">' +
          '<div class="tool-logo" style="--tc:' + esc(t.color || '#2b5cff') + '">' + esc(t.icon || '✦') + '</div>' +
          '<div class="row-main">' +
          '<div class="row-title">' + esc(t.name) +
          '<span class="chip">' + esc(t.category || '未分类') + '</span>' +
          (Number(t.cost) > 0 ? '<span class="chip brand">$' + Number(t.cost) + '/月</span>' : '<span class="chip">免费</span>') +
          '</div>' +
          '<div class="row-sub">' + esc(t.vendor || '—') + ' · 自 ' + esc(t.since || '—') + ' 起</div>' +
          (t.note ? '<div class="row-text">' + esc(t.note) + '</div>' : '') +
          '</div>' +
          '<div class="row-actions">' +
          '<button class="btn btn-sm" data-edit="' + esc(t.id) + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + esc(t.id) + '">删除</button>' +
          '</div></div>';
      }).join('') : '<div class="empty">还没有工具</div>') +
      '</div></div></div>';

    $('addTool').addEventListener('click', function () { toolModal(null); });
    $('panel').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]');
      var dl = e.target.closest('[data-del]');
      if (ed) toolModal(Store.tool(ed.getAttribute('data-edit')));
      if (dl) {
        var t = Store.tool(dl.getAttribute('data-del'));
        var n = Store.records().filter(function (r) { return r.toolId === t.id; }).length;
        confirmDialog('删除工具', '删除「' + t.name + '」' + (n ? '，同时会删掉关联的 ' + n + ' 条使用记录' : '') + '。此操作不可撤销。', function () {
          Store.deleteTool(t.id);
          toast('已删除');
          tabTools();
        });
      }
    });
  }

  function toolModal(tool) {
    var t = tool || { name: '', vendor: '', category: '编程开发', color: '#2b5cff', icon: '✦', cost: 0, since: '', note: '' };
    var cats = Store.categories().map(function (c) { return { value: c.name, label: c.name }; });

    openModal({
      title: tool ? '编辑工具' : '新增工具',
      submitLabel: '保存',
      body:
        '<div class="form-grid">' +
        field('名称', input('name', t.name, { placeholder: '豆包' })) +
        field('厂商', input('vendor', t.vendor, { placeholder: 'OpenAI' })) +
        field('用途分类', select('category', t.category, cats)) +
        field('图标', input('icon', t.icon, { placeholder: '一个 emoji，如 💬' })) +
        field('主题色', input('color', t.color, { type: 'color' })) +
        field('月费（美元）', input('cost', t.cost, { type: 'number' })) +
        field('开始使用', input('since', t.since, { placeholder: '2024-06' })) +
        '<div class="col-2">' + field('一句话点评', textarea('note', t.note, 2)) + '</div>' +
        '</div>',
      onSubmit: function (form) {
        var name = form.name.value.trim();
        if (!name) { toast('请填写工具名称', true); return false; }
        Store.upsertTool({
          id: tool ? tool.id : null,
          name: name,
          vendor: form.vendor.value.trim(),
          category: form.category.value,
          icon: form.icon.value.trim() || '✦',
          color: form.color.value,
          cost: Number(form.cost.value) || 0,
          since: form.since.value.trim(),
          note: form.note.value.trim()
        });
        toast('已保存');
        tabTools();
      }
    });
  }

  /* ---------------- 使用记录 ---------------- */
  function tabRecords() {
    var recs = Store.records().slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var totalMin = recs.reduce(function (a, r) { return a + (Number(r.minutes) || 0); }, 0);

    $('panel').innerHTML =
      '<div class="panel"><div class="panel-head">' +
      '<div><div class="panel-title">使用记录</div>' +
      '<div class="stat-line" style="margin-top:6px"><span>共 <b>' + recs.length + '</b> 条</span><span>合计 <b>' +
      (Math.round(totalMin / 6) / 10) + '</b> 小时</span></div></div>' +
      '<div class="right"><button class="btn btn-primary btn-sm" id="addRec">新增记录</button></div>' +
      '</div><div class="panel-body"><div class="stack">' +
      (recs.length ? recs.map(function (r) {
        var t = Store.tool(r.toolId);
        return '<div class="row-card">' +
          '<div class="row-main">' +
          '<div class="row-title">' + esc(r.task) +
          '<span class="chip">' + esc(t ? (t.icon + ' ' + t.name) : '已删除工具') + '</span>' +
          '<span class="chip">' + esc(r.date) + '</span>' +
          '<span class="chip brand">' + (Number(r.minutes) || 0) + ' 分钟</span>' +
          '</div>' +
          (r.outcome ? '<div class="row-text">→ ' + esc(r.outcome) + '</div>' : '') +
          ((r.tags || []).length ? '<div class="row-sub">' + (r.tags || []).map(function (x) { return '#' + esc(x); }).join(' ') + '</div>' : '') +
          '</div>' +
          '<div class="row-actions">' +
          '<button class="btn btn-sm" data-edit="' + esc(r.id) + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + esc(r.id) + '">删除</button>' +
          '</div></div>';
      }).join('') : '<div class="empty">还没有记录</div>') +
      '</div></div></div>';

    $('addRec').addEventListener('click', function () { recordModal(null); });
    $('panel').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]');
      var dl = e.target.closest('[data-del]');
      if (ed) recordModal(Store.records().filter(function (r) { return r.id === ed.getAttribute('data-edit'); })[0]);
      if (dl) {
        confirmDialog('删除记录', '删除这条使用记录？此操作不可撤销。', function () {
          Store.deleteRecord(dl.getAttribute('data-del'));
          toast('已删除');
          tabRecords();
        });
      }
    });
  }

  function recordModal(rec) {
    var tools = Store.tools();
    if (!tools.length) { toast('请先在「AI 工具」里添加至少一个工具', true); return; }
    var r = rec || { date: Charts.iso(new Date()), toolId: tools[0].id, task: '', minutes: 60, outcome: '', tags: [] };
    var today = Charts.iso(new Date());

    openModal({
      title: rec ? '编辑记录' : '新增记录',
      submitLabel: '保存',
      body:
        '<div class="form-grid">' +
        field('日期', input('date', r.date, { type: 'date' })) +
        field('工具', select('toolId', r.toolId, tools.map(function (t) { return { value: t.id, label: t.name }; }))) +
        '<div class="col-2">' + field('做了什么', input('task', r.task, { placeholder: '用一句话描述这次的任务' })) + '</div>' +
        field('耗时（分钟）', input('minutes', r.minutes, { type: 'number' })) +
        field('标签', tagInput(r.tags)) +
        '<div class="col-2">' + field('结果 / 收获', textarea('outcome', r.outcome, 2), '写清最后拿到了什么') + '</div>' +
        '</div>' +
        (r.date === today ? '' : '') +
        '',
      onSubmit: function (form) {
        var task = form.task.value.trim();
        if (!task) { toast('请填写任务描述', true); return false; }
        Store.upsertRecord({
          id: rec ? rec.id : null,
          date: form.date.value || today,
          toolId: form.toolId.value,
          task: task,
          minutes: Number(form.minutes.value) || 0,
          outcome: form.outcome.value.trim(),
          tags: parseTags(form.tags.value)
        });
        toast('已保存');
        tabRecords();
      }
    });
  }

  /* ---------------- 心得 ---------------- */
  function tabInsights() {
    var list = Store.insights().slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    $('panel').innerHTML =
      '<div class="panel"><div class="panel-head">' +
      '<div><div class="panel-title">心得</div><div class="panel-sub">共 ' + list.length + ' 条</div></div>' +
      '<div class="right"><button class="btn btn-primary btn-sm" id="addIns">新增心得</button></div>' +
      '</div><div class="panel-body"><div class="stack">' +
      (list.length ? list.map(function (i) {
        return '<div class="row-card">' +
          '<div class="row-main">' +
          '<div class="row-title">' + esc(i.title) + '<span class="chip">' + esc(i.date || '') + '</span></div>' +
          '<div class="row-text">' + esc(i.content) + '</div>' +
          ((i.tags || []).length ? '<div class="row-sub">' + (i.tags || []).map(function (x) { return '#' + esc(x); }).join(' ') + '</div>' : '') +
          '</div>' +
          '<div class="row-actions">' +
          '<button class="btn btn-sm" data-edit="' + esc(i.id) + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + esc(i.id) + '">删除</button>' +
          '</div></div>';
      }).join('') : '<div class="empty">还没有心得</div>') +
      '</div></div></div>';

    $('addIns').addEventListener('click', function () { insightModal(null); });
    $('panel').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]');
      var dl = e.target.closest('[data-del]');
      if (ed) insightModal(Store.insights().filter(function (x) { return x.id === ed.getAttribute('data-edit'); })[0]);
      if (dl) {
        confirmDialog('删除心得', '删除这条心得？此操作不可撤销。', function () {
          Store.deleteInsight(dl.getAttribute('data-del'));
          toast('已删除');
          tabInsights();
        });
      }
    });
  }

  function insightModal(ins) {
    var i = ins || { date: Charts.iso(new Date()), title: '', content: '', tags: [] };
    openModal({
      title: ins ? '编辑心得' : '新增心得',
      submitLabel: '保存',
      body:
        '<div class="form-grid">' +
        '<div class="col-2">' + field('标题', input('title', i.title, { placeholder: '一句话总结' })) + '</div>' +
        field('日期', input('date', i.date, { type: 'date' })) +
        field('标签', tagInput(i.tags)) +
        '<div class="col-2">' + field('正文', textarea('content', i.content, 4)) + '</div>' +
        '</div>',
      onSubmit: function (form) {
        var title = form.title.value.trim();
        if (!title) { toast('请填写标题', true); return false; }
        Store.upsertInsight({
          id: ins ? ins.id : null,
          date: form.date.value || Charts.iso(new Date()),
          title: title,
          content: form.content.value.trim(),
          tags: parseTags(form.tags.value)
        });
        toast('已保存');
        tabInsights();
      }
    });
  }

  /* ---------------- 数据与安全 ---------------- */
  function tabData() {
    var up = Store.updatedAt();
    var s = Store.summary();
    $('panel').innerHTML =
      '<div class="banner"><span>ⓘ</span><div><b>数据当前保存在本机浏览器中。</b>' +
      '你在后台做的修改会立刻保存在这台设备上。要让访客看到最新内容，请点击' +
      '「下载站点数据 (data.json)」，把文件放到项目根目录后重新发布即可。' +
      '开通云服务后可改为云端保存，多设备登录同一账号编辑。</div></div>' +

      '<div class="panel" style="margin-bottom:16px"><div class="panel-head">' +
      '<div><div class="panel-title">数据概览</div></div></div><div class="panel-body">' +
      '<div class="stat-line">' +
      '<span>工具 <b>' + Store.tools().length + '</b></span>' +
      '<span>记录 <b>' + s.recordCount + '</b></span>' +
      '<span>心得 <b>' + Store.insights().length + '</b></span>' +
      '<span>累计 <b>' + s.totalHours + '</b> 小时</span>' +
      '<span>最近保存 <b>' + (up ? new Date(up).toLocaleString('zh-CN') : '—') + '</b></span>' +
      '</div></div></div>' +

      '<div class="panel" style="margin-bottom:16px"><div class="panel-head">' +
      '<div><div class="panel-title">发布与备份</div>' +
      '<div class="panel-sub">data.json 是访客端实际读取的数据快照</div></div></div>' +
      '<div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" id="publishBtn">下载站点数据 (data.json)</button>' +
      '<button class="btn" id="exportBtn">导出备份（JSON）</button>' +
      '<button class="btn" id="importBtn">导入数据</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" style="display:none">' +
      '<button class="btn btn-danger" id="resetBtn">恢复为示例数据</button>' +
      '</div></div>' +

      '<div class="panel"><div class="panel-head">' +
      '<div><div class="panel-title">管理口令</div>' +
      '<div class="panel-sub">' + (Store.hasCustomPassword() ? '已修改过口令' : '当前仍在使用默认口令，建议尽快修改') + '</div></div></div>' +
      '<div class="panel-body">' +
      '<form id="pwForm" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">' +
      '<div class="field" style="flex:1;min-width:180px"><label>新口令</label>' +
      '<input class="input" type="password" name="pw1" autocomplete="new-password"></div>' +
      '<div class="field" style="flex:1;min-width:180px"><label>确认新口令</label>' +
      '<input class="input" type="password" name="pw2" autocomplete="new-password"></div>' +
      '<button class="btn btn-primary" type="submit">修改口令</button>' +
      '</form></div></div>';

    function download(name, text) {
      var blob = new Blob([text], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    $('publishBtn').addEventListener('click', function () {
      download('data.json', Store.exportJSON());
      toast('已下载 data.json，放到项目根目录后重新发布即可');
    });

    $('exportBtn').addEventListener('click', function () {
      download('ai-footprint-backup-' + Charts.iso(new Date()) + '.json', Store.exportJSON());
      toast('已导出备份');
    });

    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          Store.importJSON(String(reader.result));
          toast('导入成功');
          renderTab('data');
        } catch (err) {
          toast('导入失败：' + err.message, true);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('resetBtn').addEventListener('click', function () {
      confirmDialog('恢复示例数据', '当前所有工具、记录与心得都会被示例数据覆盖，且不可撤销。建议先导出备份。', function () {
        Store.resetToSample();
        toast('已恢复示例数据');
        renderTab('data');
      });
    });

    $('pwForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.pw1.value || f.pw1.value.length < 4) { toast('口令至少 4 位', true); return; }
      if (f.pw1.value !== f.pw2.value) { toast('两次输入不一致', true); return; }
      await Store.changePassword(f.pw1.value);
      toast('口令已修改');
      renderTab('data');
    });
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    await Store.init();
    var saved = null;
    try { saved = localStorage.getItem('ai-footprint.theme'); } catch (e) {}
    applyTheme(saved || Store.theme() || 'light');

    $('themeBtn').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    $('logoutBtn').addEventListener('click', function () {
      Store.logout();
      location.reload();
    });

    if (Store.isAuthed()) enterApp();
    else renderLogin();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
