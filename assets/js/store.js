/* ============================================================
   store.js — 数据层
   统一的数据读写接口。当前实现基于浏览器本地存储；
   所有读写都收敛到 Store.* ，方便后续替换为云端数据源。
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'ai-footprint.v1';
  var SESSION = 'ai-footprint.admin.session';
  var DEFAULT_PASSWORD = 'ai2026';

  /* ---------------- 种子数据 ---------------- */

  var SEED_PROFILE = {
    name: 'Guang',
    role: '独立开发者 / AI 重度使用者',
    tagline: '把 AI 当作第二双手',
    bio: '这是我 2026 年的 AI 使用足迹：只用四个工具——DeepSeek 负责推理与核对，豆包负责内容与表达，千问负责读长文和整理文档，WorkBuddy 负责把想法落成能跑的东西。这里记录用了什么、花在什么事上、哪些做法真的省下了时间，数据由我自己维护。',
    since: '2025-03',
    avatar: '',
    links: []
  };

  var SEED_TOOLS = [
    { id: 't-deepseek', name: 'DeepSeek', vendor: '深度求索', category: '推理与对话', color: '#4d6bfe', icon: '🐋', cost: 0, since: '2025-03', note: '算口径、核对逻辑、推演边界条件的第一站，推理链条摆得清楚，便于逐条反驳。' },
    { id: 't-doubao', name: '豆包', vendor: '字节跳动', category: '内容创作', color: '#1ec8b0', icon: '🫘', cost: 0, since: '2025-07', note: '写文案、起标题、整理纪要，中文语感顺，出稿快，改起来也不用反复交代背景。' },
    { id: 't-qwen', name: '千问', vendor: '阿里云', category: '研究与办公', color: '#7c5cff', icon: '🧠', cost: 0, since: '2025-11', note: '长文档、PDF 表格、多版本比对交给它，能落到具体段落，引用可回溯。' },
    { id: 't-workbuddy', name: 'WorkBuddy', vendor: 'WorkBuddy', category: '工程与执行', color: '#ff7a45', icon: '🛠️', cost: 0, since: '2026-10', note: '从搭骨架到发布上线，把想法直接落成能跑的东西；本页的数据也是用它做的。' }
  ];

  var SEED_CATEGORIES = [
    { name: '推理与对话', color: '#4d6bfe' },
    { name: '内容创作', color: '#1ec8b0' },
    { name: '研究与办公', color: '#7c5cff' },
    { name: '工程与执行', color: '#ff7a45' }
  ];

  var RAW_RECORDS = [
    /* DeepSeek —— 推理、核对、推演 */
    ['2026-06-08', 't-deepseek', '拆解一段缓存穿透的复现路径', 55, '定位到空值未回写，补上兜底逻辑', ['排查']],
    ['2026-06-17', 't-deepseek', '交叉验算季度成本模型', 40, '发现一处汇率口径错位', ['数据']],
    ['2026-07-02', 't-deepseek', '对比三种任务队列方案的取舍', 50, '输出一张决策对照表', ['方案']],
    ['2026-07-21', 't-deepseek', '推导令牌桶限流的边界条件', 35, '补齐了突发流量下的退化说明', ['学习']],
    ['2026-08-05', 't-deepseek', '把一段模糊需求拆成可验收条目', 45, '需求条目从 6 条细化到 19 条', ['需求']],
    ['2026-08-19', 't-deepseek', '复核 SQL 执行计划的索引选择', 30, '去掉一个多余索引，查询快了一半', ['数据']],
    ['2026-09-03', 't-deepseek', '推演多租户鉴权的最坏路径', 60, '找到两处越权缺口', ['安全']],
    ['2026-09-12', 't-deepseek', '讨论任务失败后的重试策略', 50, '定了指数退避加幂等键', ['架构']],
    ['2026-09-25', 't-deepseek', '让模型逐字符解释一段正则', 25, '修掉一个贪婪匹配的坑', ['学习']],
    ['2026-10-09', 't-deepseek', '核对月度用量统计的口径差异', 40, '统一为按自然日切分', ['数据']],
    ['2026-10-13', 't-deepseek', '拆解一份竞品的功能矩阵', 55, '输出 4×9 的功能对比表', ['调研']],
    ['2026-10-16', 't-deepseek', '复盘一次线上抖动的时间线', 45, '定位到连接池被打满的触发点', ['排查']],

    /* 豆包 —— 写作、文案、整理 */
    ['2026-07-06', 't-doubao', '起草产品更新说明的中文初稿', 30, '结构可用，措辞改了两遍', ['写作']],
    ['2026-07-15', 't-doubao', '把 20 分钟访谈录音整理成稿', 45, '转写与分段一次完成', ['整理']],
    ['2026-07-29', 't-doubao', '写 5 版不同风格的口播文案', 35, '选了节奏最舒服的第 3 版', ['文案']],
    ['2026-08-11', 't-doubao', '生成一组公众号封面的构图草图', 40, '定了第三版的留白比例', ['设计']],
    ['2026-08-24', 't-doubao', '把技术长文改写成通俗版本', 50, '阅读完成率明显提升', ['写作']],
    ['2026-09-02', 't-doubao', '为活动页写 3 组标题 A/B 方案', 25, '上线后 B 组点击高 18%', ['文案']],
    ['2026-09-16', 't-doubao', '整理会议纪要并提取待办', 30, '抽出 7 条带负责人的待办', ['整理']],
    ['2026-09-29', 't-doubao', '写一版 90 秒的产品口播脚本', 35, '剪完成片直接可用', ['文案']],
    ['2026-10-08', 't-doubao', '给新功能起 12 个候选名字', 20, '留下 3 个进入评审', ['命名']],
    ['2026-10-12', 't-doubao', '把用户反馈聚类成 6 个主题', 40, '发现一个高频但被漏掉的痛点', ['调研']],
    ['2026-10-15', 't-doubao', '写周报要点版，压到 300 字', 25, '直接发给了团队', ['写作']],

    /* 千问 —— 长文档、表格、比对 */
    ['2026-06-11', 't-qwen', '读一份 60 页行业报告，列出关键数据', 60, '摘出 12 个可引用的数字', ['阅读']],
    ['2026-06-24', 't-qwen', '把 PDF 里的表格转成结构化数据', 35, '省掉半天手工录入', ['数据']],
    ['2026-07-09', 't-qwen', '查国内大模型 API 的计价差异', 45, '拿到 5 家官方价格页', ['调研']],
    ['2026-07-23', 't-qwen', '整理一份访谈逐字稿', 40, '自动分了发言人和议题', ['整理']],
    ['2026-08-07', 't-qwen', '把合同条款做成中英对照', 50, '术语统一后直接归档', ['文档']],
    ['2026-08-20', 't-qwen', '拆解竞品定价页的结构', 30, '画出三档定价对照图', ['调研']],
    ['2026-09-05', 't-qwen', '做会议实时记录与摘要', 45, '会后 5 分钟拿到纪要', ['整理']],
    ['2026-09-18', 't-qwen', '校验报表里的同比与环比', 35, '揪出一处基数用错', ['数据']],
    ['2026-10-03', 't-qwen', '整理需求池里的 40 条反馈', 55, '合并去重后剩 26 条', ['整理']],
    ['2026-10-07', 't-qwen', '读 30 页技术规范，输出速查表', 40, '一页纸覆盖 80% 场景', ['阅读']],
    ['2026-10-11', 't-qwen', '把流程图描述转成文字说明', 25, '补进文档的流程章节', ['文档']],
    ['2026-10-14', 't-qwen', '比对两份版本的差异', 30, '找出 9 处实质改动', ['文档']],

    /* WorkBuddy —— 仅 2026 年 10 月 */
    ['2026-10-01', 't-workbuddy', '让 WorkBuddy 搭出静态站点的目录骨架', 40, '一次跑通，省掉脚手架搭建', ['建站']],
    ['2026-10-02', 't-workbuddy', '写访客页的设计系统与样式变量', 65, '浅深两套主题共用一套变量', ['前端']],
    ['2026-10-03', 't-workbuddy', '实现自绘 SVG 折线图', 55, '不引第三方库也够用', ['前端']],
    ['2026-10-05', 't-workbuddy', '实现环形图与热力图的绘制逻辑', 50, '三张图零依赖上线', ['前端']],
    ['2026-10-06', 't-workbuddy', '写后台登录与口令校验模块', 45, '带盐哈希后本地校验通过', ['后台']],
    ['2026-10-07', 't-workbuddy', '做工具与记录的增删改查表单', 70, '全流程实测通过', ['后台']],
    ['2026-10-08', 't-workbuddy', '加数据导入导出与一键恢复', 35, 'JSON 往返无损', ['后台']],
    ['2026-10-09', 't-workbuddy', '跑 Node 脚本验证数据层', 30, '全部记录读写无异常', ['测试']],
    ['2026-10-10', 't-workbuddy', '用浏览器自动化截图核对渲染', 40, '修掉三处间距问题', ['测试']],
    ['2026-10-11', 't-workbuddy', '调深色模式的对比度', 35, '正文对比度到 7:1 以上', ['设计']],
    ['2026-10-12', 't-workbuddy', '做移动端断点与卡片自适应', 45, '小屏不再横向溢出', ['前端']],
    ['2026-10-14', 't-workbuddy', '把数据层改成可切换云端的接口', 60, '换实现不用改页面', ['架构']],
    ['2026-10-15', 't-workbuddy', '发布上线并核对线上资源', 25, '页面与数据快照都可访问', ['发布']],
    ['2026-10-17', 't-workbuddy', '把示例数据换成四个工具的真实足迹', 35, '报告口径统一到 10 月', ['数据']]
  ];

  var SEED_INSIGHTS = [
    {
      id: 'i-1',
      date: '2026-10-16',
      title: '同一件事，交给对的工具',
      content: '推理算账找 DeepSeek，写字配图找豆包，读长文和整理文档交给千问，真要落成能跑的东西才开 WorkBuddy。工具少一点，切换成本就低一点。',
      tags: ['方法']
    },
    {
      id: 'i-2',
      date: '2026-10-06',
      title: '长文档先问结构，再问细节',
      content: '上来就让它总结，得到的是正确但没用的废话。先问目录和立场，再挑两章深读——读 60 页和读 10 页花的时间差不多。',
      tags: ['阅读']
    },
    {
      id: 'i-3',
      date: '2026-09-27',
      title: '三版方案，胜过一版最优解',
      content: '直接问"最优解"，拿到的通常是最大公约数。让它一次给三个差异明显的方向，我再挑一个往下做，结果好得多。',
      tags: ['方法']
    },
    {
      id: 'i-4',
      date: '2026-09-15',
      title: '代码要跑起来才算完成',
      content: '没真正运行过的生成代码，八成有边界问题。让它跑通、让它报错、让它自己修，这一步省不掉。',
      tags: ['编程']
    },
    {
      id: 'i-5',
      date: '2026-08-26',
      title: '输出必须能追溯来源',
      content: '凡是转述的数据，都要能找到原始出处；找不到的，我就当它不存在。这一条挡掉过好几次错误引用。',
      tags: ['原则']
    },
    {
      id: 'i-6',
      date: '2026-08-02',
      title: '把重复的动作沉淀成流程',
      content: '第二遍写脚本，第三遍沉淀成流程。AI 最值得投入的地方不是"帮我做一次"，而是"帮我把这件事做完就不再需要我"。',
      tags: ['工程化']
    },
    {
      id: 'i-7',
      date: '2026-07-19',
      title: '留一点不用 AI 的时间',
      content: '通勤和散步时自己想清楚问题，回来再让它执行。想清楚这件事，暂时还没有工具能代劳。',
      tags: ['原则']
    }
  ];

  function seedState() {
    var tools = SEED_TOOLS.map(function (t) { return Object.assign({}, t); });
    return {
      version: 1,
      profile: Object.assign({}, SEED_PROFILE),
      tools: tools,
      categories: SEED_CATEGORIES.map(function (c) { return Object.assign({}, c); }),
      records: RAW_RECORDS.map(function (r, i) {
        return {
          id: 'r-' + (i + 1),
          date: r[0],
          toolId: r[1],
          task: r[2],
          minutes: r[3],
          outcome: r[4],
          tags: r[5] || []
        };
      }),
      insights: SEED_INSIGHTS.map(function (x) { return Object.assign({}, x, { tags: (x.tags || []).slice() }); }),
      settings: { theme: 'light', updatedAt: new Date().toISOString() }
    };
  }

  /* ---------------- 底层读写 ---------------- */

  var state = null;
  var auth = { salt: null, hash: null, fallback: false };
  var AUTH_KEY = 'ai-footprint.admin.auth';

  function readJSON(key, dflt) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : dflt;
    } catch (e) { return dflt; }
  }

  function writeJSON(key, val) {
    try { global.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  function uid(prefix) {
    return (prefix || 'x') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* ---------------- 口令 ---------------- */

  async function digest(text) {
    if (global.crypto && global.crypto.subtle && global.crypto.subtle.digest) {
      try {
        var buf = await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      } catch (e) { /* fallthrough */ }
    }
    // 非安全上下文兜底（如 file://）
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return 'weak-' + (h >>> 0).toString(16);
  }

  async function ensureAuth() {
    var saved = readJSON(AUTH_KEY, null);
    if (saved && saved.salt && saved.hash) {
      auth = saved;
      return;
    }
    var salt = Math.random().toString(36).slice(2, 12);
    auth = { salt: salt, hash: await digest(salt + '::' + DEFAULT_PASSWORD), default: true };
    writeJSON(AUTH_KEY, auth);
  }

  function isValidState(s) {
    return s && Array.isArray(s.tools) && s.tools.length >= 0 &&
      Array.isArray(s.records) && typeof s.profile === 'object';
  }

  function normalizeState(s) {
    s.categories = Array.isArray(s.categories) && s.categories.length ? s.categories : SEED_CATEGORIES.slice();
    s.insights = Array.isArray(s.insights) ? s.insights : [];
    s.profile = Object.assign({}, SEED_PROFILE, s.profile || {});
    s.settings = Object.assign({ theme: 'light' }, s.settings || {});
    s.version = 1;
    return s;
  }

  function stateTime(s) {
    try { return Date.parse(s && s.settings && s.settings.updatedAt) || 0; } catch (e) { return 0; }
  }

  /* ---------------- 初始化 ---------------- */

  var Store = {
    DEFAULT_PASSWORD: DEFAULT_PASSWORD,

    init: async function () {
      await ensureAuth();

      // 数据来源优先级：本地较新的编辑 > 随站点发布的 data.json > 示例数据
      var local = readJSON(KEY, null);
      if (!isValidState(local)) local = null;

      var remote = null;
      try {
        var res = await fetch('data.json', { cache: 'no-store' });
        if (res.ok) {
          var parsed = await res.json();
          if (isValidState(parsed)) remote = parsed;
        }
      } catch (e) { /* 静态托管下无此文件属正常情况 */ }

      var chosen = null;
      if (local) chosen = local;
      if (remote && (!chosen || stateTime(remote) > stateTime(chosen))) chosen = remote;

      if (chosen) {
        state = normalizeState(chosen);
        if (chosen === remote || !local) writeJSON(KEY, state);
      } else {
        state = seedState();
        writeJSON(KEY, state);
      }
      return state;
    },

    /* --- 全局 --- */
    state: function () { return state; },
    save: function () {
      state.settings = state.settings || {};
      state.settings.updatedAt = new Date().toISOString();
      return writeJSON(KEY, state);
    },
    updatedAt: function () { return (state.settings && state.settings.updatedAt) || null; },

    /* --- 基本信息 --- */
    profile: function () { return state.profile; },
    setProfile: function (patch) {
      Object.assign(state.profile, patch);
      return this.save();
    },

    /* --- 分类 --- */
    categories: function () { return state.categories; },
    categoryColor: function (name) {
      var hit = (state.categories || []).filter(function (c) { return c.name === name; })[0];
      return (hit && hit.color) || '#2b5cff';
    },

    /* --- 工具 --- */
    tools: function () { return state.tools; },
    tool: function (id) { return state.tools.filter(function (t) { return t.id === id; })[0] || null; },
    upsertTool: function (tool) {
      if (!tool.id) {
        tool.id = uid('t');
        state.tools.push(tool);
      } else {
        var i = state.tools.findIndex(function (t) { return t.id === tool.id; });
        if (i >= 0) state.tools[i] = Object.assign({}, state.tools[i], tool);
        else state.tools.push(tool);
      }
      this.save();
      return tool;
    },
    deleteTool: function (id) {
      state.tools = state.tools.filter(function (t) { return t.id !== id; });
      state.records = state.records.filter(function (r) { return r.toolId !== id; });
      this.save();
    },

    /* --- 使用记录 --- */
    records: function () { return state.records; },
    upsertRecord: function (rec) {
      if (!rec.id) {
        rec.id = uid('r');
        state.records.push(rec);
      } else {
        var i = state.records.findIndex(function (r) { return r.id === rec.id; });
        if (i >= 0) state.records[i] = Object.assign({}, state.records[i], rec);
        else state.records.push(rec);
      }
      this.save();
      return rec;
    },
    deleteRecord: function (id) {
      state.records = state.records.filter(function (r) { return r.id !== id; });
      this.save();
    },

    /* --- 心得 --- */
    insights: function () { return state.insights; },
    upsertInsight: function (ins) {
      if (!ins.id) {
        ins.id = uid('i');
        state.insights.push(ins);
      } else {
        var i = state.insights.findIndex(function (x) { return x.id === ins.id; });
        if (i >= 0) state.insights[i] = Object.assign({}, state.insights[i], ins);
        else state.insights.push(ins);
      }
      this.save();
      return ins;
    },
    deleteInsight: function (id) {
      state.insights = state.insights.filter(function (x) { return x.id !== id; });
      this.save();
    },

    /* --- 导入导出 / 重置 --- */
    exportJSON: function () { return JSON.stringify(state, null, 2); },
    importJSON: function (text) {
      var next = JSON.parse(text);
      if (!next || !Array.isArray(next.tools) || !Array.isArray(next.records)) {
        throw new Error('数据格式不正确：缺少 tools 或 records');
      }
      next.categories = next.categories && next.categories.length ? next.categories : SEED_CATEGORIES.slice();
      next.insights = next.insights || [];
      next.profile = Object.assign({}, SEED_PROFILE, next.profile || {});
      next.settings = Object.assign({ theme: 'light' }, next.settings || {});
      next.version = 1;
      state = next;
      this.save();
      return state;
    },
    resetToSample: function () {
      state = seedState();
      this.save();
      return state;
    },

    /* --- 管理员登录 --- */
    hasCustomPassword: function () { return !auth.default; },
    login: async function (password) {
      var h = await digest(auth.salt + '::' + String(password || ''));
      if (h === auth.hash) {
        try { global.sessionStorage.setItem(SESSION, '1'); } catch (e) {}
        return true;
      }
      return false;
    },
    logout: function () { try { global.sessionStorage.removeItem(SESSION); } catch (e) {} },
    isAuthed: function () {
      try { return global.sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; }
    },
    changePassword: async function (nextPassword) {
      var salt = Math.random().toString(36).slice(2, 12);
      auth = { salt: salt, hash: await digest(salt + '::' + String(nextPassword)) };
      writeJSON(AUTH_KEY, auth);
    },

    /* --- 主题 --- */
    theme: function () { return (state.settings && state.settings.theme) || 'light'; },
    setTheme: function (t) {
      state.settings = state.settings || {};
      state.settings.theme = t;
      this.save();
    },

    /* ---------------- 统计 ---------------- */

    summary: function () {
      var recs = state.records;
      var totalMin = recs.reduce(function (a, r) { return a + (Number(r.minutes) || 0); }, 0);
      var days = {};
      recs.forEach(function (r) { days[r.date] = (days[r.date] || 0) + (Number(r.minutes) || 0); });
      var dayKeys = Object.keys(days).sort();

      // 最长连续记录天数
      var best = 0, cur = 0, prev = null;
      dayKeys.forEach(function (d) {
        if (prev) {
          var gap = (new Date(d) - new Date(prev)) / 86400000;
          cur = gap === 1 ? cur + 1 : 1;
        } else { cur = 1; }
        if (cur > best) best = cur;
        prev = d;
      });

      var from = dayKeys[0] || null;
      var to = dayKeys[dayKeys.length - 1] || null;
      var span = from && to ? Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1) : 1;

      return {
        totalMinutes: totalMin,
        totalHours: Math.round(totalMin / 6) / 10,
        toolCount: Object.keys(recs.reduce(function (a, r) { a[r.toolId] = 1; return a; }, {})).length,
        recordCount: recs.length,
        activeDays: dayKeys.length,
        longuestStreak: best,
        avgPerActiveDay: dayKeys.length ? Math.round(totalMin / dayKeys.length) : 0,
        avgPerDay: Math.round(totalMin / span),
        rangeFrom: from,
        rangeTo: to,
        rangeDays: span
      };
    },

    // 每个工具的聚合
    toolStats: function () {
      var map = {};
      state.records.forEach(function (r) {
        var s = map[r.toolId] || (map[r.toolId] = { toolId: r.toolId, minutes: 0, count: 0, last: null, tags: {} });
        s.minutes += Number(r.minutes) || 0;
        s.count += 1;
        if (!s.last || r.date > s.last) s.last = r.date;
        (r.tags || []).forEach(function (t) { s.tags[t] = (s.tags[t] || 0) + 1; });
      });
      return state.tools.map(function (t) {
        var s = map[t.id] || { minutes: 0, count: 0, last: null, tags: {} };
        return {
          tool: t,
          minutes: s.minutes,
          hours: Math.round(s.minutes / 6) / 10,
          count: s.count,
          last: s.last,
          topTags: Object.keys(s.tags).sort(function (a, b) { return s.tags[b] - s.tags[a]; }).slice(0, 3)
        };
      }).sort(function (a, b) { return b.minutes - a.minutes; });
    },

    // 按月聚合
    monthly: function () {
      var map = {};
      state.records.forEach(function (r) {
        var m = r.date.slice(0, 7);
        map[m] = (map[m] || 0) + (Number(r.minutes) || 0);
      });
      return Object.keys(map).sort().map(function (m) {
        return { month: m, minutes: map[m], hours: Math.round(map[m] / 6) / 10 };
      });
    },

    // 按天聚合（用于热力/趋势）
    daily: function () {
      var map = {};
      state.records.forEach(function (r) {
        map[r.date] = (map[r.date] || 0) + (Number(r.minutes) || 0);
      });
      return map;
    },

    // 按分类聚合
    byCategory: function () {
      var ts = this.toolStats();
      var map = {};
      ts.forEach(function (s) {
        var c = s.tool.category || '其他';
        map[c] = (map[c] || 0) + s.minutes;
      });
      return this.categories().map(function (c) {
        return { name: c.name, color: c.color, minutes: map[c.name] || 0 };
      }).filter(function (c) { return c.minutes > 0; })
        .sort(function (a, b) { return b.minutes - a.minutes; });
    },

    // 标签聚合
    tagCloud: function () {
      var map = {};
      state.records.forEach(function (r) {
        (r.tags || []).forEach(function (t) { map[t] = (map[t] || 0) + 1; });
      });
      return Object.keys(map).map(function (k) { return { tag: k, count: map[k] }; })
        .sort(function (a, b) { return b.count - a.count; });
    },

    // 相邻区间对比（最近 30 天 vs 前 30 天）
    recentDelta: function () {
      var byDay = this.daily();
      var keys = Object.keys(byDay).sort();
      if (!keys.length) return null;
      var last = new Date(keys[keys.length - 1]);
      var a = 0, b = 0;
      Object.keys(byDay).forEach(function (d) {
        var diff = (last - new Date(d)) / 86400000;
        if (diff < 30) a += byDay[d];
        else if (diff < 60) b += byDay[d];
      });
      if (!b) return null;
      return { current: a, previous: b, pct: Math.round(((a - b) / b) * 100) };
    }
  };

  global.Store = Store;
})(window);
