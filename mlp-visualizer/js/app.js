/* ============================================================
 * app.js — 界面状态、交互与训练循环
 * ============================================================ */
(function () {
  'use strict';

  const REPO_URL = 'https://github.com/liangzaijwj2/ai_usage/tree/main/mlp-visualizer';
  const DEMO_URL = 'https://liangzaijwj2.github.io/ai_usage/mlp-visualizer/';
  const $ = id => document.getElementById(id);

  const DEFAULTS = {
    dataset: 'xor', count: 240, noise: 0.06, layers: '4,4',
    activation: 'tanh', optimizer: 'adam', lr: 0.03, l2: 0,
    batch: 32, speed: 4, seed: 42
  };

  const state = {
    dataset: DEFAULTS.dataset,
    count: DEFAULTS.count,
    noise: DEFAULTS.noise,
    layers: DEFAULTS.layers,
    activation: DEFAULTS.activation,
    optimizer: DEFAULTS.optimizer,
    lr: DEFAULTS.lr,
    l2: DEFAULTS.l2,
    batch: DEFAULTS.batch,
    speed: DEFAULTS.speed,
    seed: DEFAULTS.seed,
    dataSeed: 20261121,
    running: true,
    step: 0,
    frame: 0,
    history: [],
    custom: [],           // {x, y, label}
    hover: null,
    tab: 'weights'
  };

  let mlp = null;
  let data = { X: [], y: [] };
  let trainRng = makeRng(12345);
  let lastEval = null;

  /* ---------------- 初始化 ---------------- */
  function init() {
    $('ghLink').href = REPO_URL;
    $('demoLink').href = DEMO_URL;
    const sel = $('dataset');
    Datasets.LIST.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.name;
      sel.appendChild(opt);
    });
    sel.value = state.dataset;
    bindUI();
    regenerateData();
    resetNetwork();
    Viz.weightTable($('weightTable'), mlp);
    drawAll();
    updateMetrics(null);
    setRunning(true);
    requestAnimationFrame(loop);
  }

  /* ---------------- 数据 ---------------- */
  function customToData() {
    return {
      X: state.custom.map(p => [p.x, p.y]),
      y: state.custom.map(p => p.label)
    };
  }

  function regenerateData() {
    if (state.dataset === 'custom') {
      data = customToData();
    } else {
      data = Datasets.generate(state.dataset, state.count, state.noise, makeRng(state.dataSeed));
    }
    state.history = [];
    state.step = 0;
  }

  /* ---------------- 网络 ---------------- */
  function parseSizes() {
    let hidden = $('layers').value.split(/[,，\s]+/)
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 12)
      .slice(0, 3);
    if (!hidden.length) hidden = [4];
    return [2].concat(hidden, [1]);
  }

  function resetNetwork() {
    const sizes = parseSizes();
    mlp = new MLP({
      sizes: sizes,
      activation: state.activation,
      optimizer: state.optimizer,
      l2: state.l2,
      seed: state.seed
    });
    trainRng = makeRng(6789 + state.seed);
    state.history = [];
    state.step = 0;
    state.frame = 0;
    $('archLabel').textContent = '[' + sizes.join(', ') + ']';
    syncChips();
  }

  function syncChips() {
    document.querySelectorAll('#archChips button').forEach(b => {
      b.classList.toggle('active', b.dataset.arch === $('layers').value.trim());
    });
  }

  /* ---------------- 训练 ---------------- */
  function stepOnce() {
    const n = data.X.length;
    if (!n) return;
    let bx, by;
    const bs = state.batch;
    if (bs === 0 || bs >= n) {
      bx = data.X; by = data.y;
    } else {
      bx = []; by = [];
      for (let i = 0; i < bs; i++) {
        const k = Math.floor(trainRng() * n);
        bx.push(data.X[k]); by.push(data.y[k]);
      }
    }
    mlp.trainBatch(bx, by, state.lr);
    state.step++;
  }

  function sampleMetrics() {
    if (!data.X.length) return null;
    const ev = mlp.evaluate(data.X, data.y);
    state.history.push({ step: state.step, loss: ev.loss, acc: ev.acc });
    if (state.history.length > 600) state.history.shift();
    return ev;
  }

  function loop() {
    if (state.running && data.X.length) {
      for (let i = 0; i < state.speed; i++) stepOnce();
      lastEval = sampleMetrics();
      state.frame++;
      drawAll();
      updateMetrics(lastEval);
      if (state.tab === 'weights' && state.frame % 4 === 0) Viz.weightTable($('weightTable'), mlp);
      if (state.tab === 'fields' && state.frame % 6 === 0) Viz.drawNeuronFields($('fields'), mlp);
    }
    requestAnimationFrame(loop);
  }

  function setRunning(on) {
    state.running = on;
    const btn = $('toggle');
    btn.textContent = on ? '⏸ 暂停训练' : '▶ 开始训练';
    btn.classList.toggle('paused', !on);
  }

  /* ---------------- 绘制 ---------------- */
  function drawAll() {
    const acts = mlp.activationsFor(state.hover || [0, 0]);
    Viz.drawBoundary($('boundary'), mlp, data, { hover: state.hover });
    Viz.drawCurve($('curve'), state.history);
    Viz.drawNetwork($('network'), mlp, acts);
  }

  function updateMetrics(ev) {
    const n = Math.max(1, data.X.length);
    const effBatch = (state.batch === 0 || state.batch >= n) ? n : state.batch;
    $('mEpoch').textContent = (state.step * effBatch / n).toFixed(1);
    $('mStep').textContent = state.step.toLocaleString();
    $('mLoss').textContent = ev ? ev.loss.toFixed(4) : '—';
    $('mAcc').textContent = ev ? (ev.acc * 100).toFixed(1) + '%' : '—';
    $('mGrad').textContent = state.step ? mlp.lastGradNorm.toFixed(4) : '—';
    $('mDelta').textContent = state.step ? mlp.lastUpdateNorm.toFixed(5) : '—';
    $('mParams').textContent = mlp.paramStats().count;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindUI() {
    $('dataset').addEventListener('change', e => {
      state.dataset = e.target.value;
      regenerateData(); drawAll();
    });
    $('count').addEventListener('input', e => {
      state.count = +e.target.value; $('countVal').textContent = state.count;
    });
    $('count').addEventListener('change', () => { regenerateData(); drawAll(); });
    $('noise').addEventListener('input', e => {
      state.noise = +e.target.value; $('noiseVal').textContent = state.noise.toFixed(2);
    });
    $('noise').addEventListener('change', () => { regenerateData(); drawAll(); });
    $('regenData').addEventListener('click', () => {
      state.dataSeed++; regenerateData(); drawAll();
    });
    $('clearCustom').addEventListener('click', () => {
      state.custom = [];
      if (state.dataset === 'custom') { regenerateData(); drawAll(); }
    });

    $('layers').addEventListener('change', () => { resetNetwork(); drawAll(); Viz.weightTable($('weightTable'), mlp); });
    $('layers').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    document.querySelectorAll('#archChips button').forEach(b => {
      b.addEventListener('click', () => {
        $('layers').value = b.dataset.arch;
        resetNetwork(); drawAll(); Viz.weightTable($('weightTable'), mlp);
      });
    });
    $('activation').addEventListener('change', e => {
      state.activation = e.target.value; resetNetwork(); drawAll(); Viz.weightTable($('weightTable'), mlp);
    });
    $('seed').addEventListener('change', e => {
      state.seed = Math.max(1, Math.min(99999, +e.target.value || 42));
      $('seedVal').textContent = state.seed;
      resetNetwork(); drawAll(); Viz.weightTable($('weightTable'), mlp);
    });

    $('optimizer').addEventListener('change', e => {
      state.optimizer = e.target.value; mlp.setOptimizer(state.optimizer);
    });
    $('lr').addEventListener('input', e => {
      state.lr = +e.target.value; $('lrVal').textContent = state.lr.toFixed(3);
    });
    $('l2').addEventListener('input', e => {
      state.l2 = +e.target.value; mlp.l2 = state.l2;
      $('l2Val').textContent = state.l2.toFixed(4);
    });
    $('batch').addEventListener('change', e => { state.batch = +e.target.value; });
    $('speed').addEventListener('input', e => {
      state.speed = +e.target.value; $('speedVal').textContent = state.speed;
    });

    $('toggle').addEventListener('click', () => setRunning(!state.running));
    $('stepBtn').addEventListener('click', () => {
      setRunning(false);
      if (!data.X.length) return;
      stepOnce();
      lastEval = sampleMetrics();
      drawAll(); updateMetrics(lastEval);
      Viz.weightTable($('weightTable'), mlp);
      if (state.tab === 'fields') Viz.drawNeuronFields($('fields'), mlp);
    });
    $('resetNet').addEventListener('click', () => {
      resetNetwork(); drawAll(); updateMetrics(null); Viz.weightTable($('weightTable'), mlp);
    });
    $('resetAll').addEventListener('click', () => {
      Object.keys(DEFAULTS).forEach(k => { state[k] = DEFAULTS[k]; });
      $('dataset').value = DEFAULTS.dataset;
      $('count').value = DEFAULTS.count; $('countVal').textContent = DEFAULTS.count;
      $('noise').value = DEFAULTS.noise; $('noiseVal').textContent = DEFAULTS.noise.toFixed(2);
      $('layers').value = DEFAULTS.layers;
      $('activation').value = DEFAULTS.activation;
      $('optimizer').value = DEFAULTS.optimizer;
      $('lr').value = DEFAULTS.lr; $('lrVal').textContent = DEFAULTS.lr.toFixed(3);
      $('l2').value = DEFAULTS.l2; $('l2Val').textContent = DEFAULTS.l2.toFixed(4);
      $('batch').value = String(DEFAULTS.batch);
      $('speed').value = DEFAULTS.speed; $('speedVal').textContent = DEFAULTS.speed;
      $('seed').value = DEFAULTS.seed; $('seedVal').textContent = DEFAULTS.seed;
      state.dataSeed = 20261121;
      state.custom = [];
      regenerateData(); resetNetwork(); drawAll(); updateMetrics(null);
      Viz.weightTable($('weightTable'), mlp);
      setRunning(true);
    });

    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.code === 'Space') { e.preventDefault(); setRunning(!state.running); }
    });

    // 决策边界画布：探针 + 自定义打点
    const bc = $('boundary');
    bc.addEventListener('mousemove', e => {
      const r = bc.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, Viz.fromPx(e.clientX - r.left, r.width)));
      const y = Math.max(-1, Math.min(1, Viz.fromPy(e.clientY - r.top, r.height)));
      state.hover = [x, y];
      const p = mlp.predictProba(state.hover);
      $('probeInfo').textContent = `探针 x = (${x.toFixed(2)}, ${y.toFixed(2)})，ŷ = P(y=1) = ${p.toFixed(3)} → 右侧网络图显示该输入下每层激活值`;
      if (!state.running) drawAll();
    });
    bc.addEventListener('mouseleave', () => {
      state.hover = null;
      $('probeInfo').textContent = '鼠标移入画布：查看该点的网络激活 →';
      if (!state.running) drawAll();
    });
    bc.addEventListener('contextmenu', e => e.preventDefault());
    bc.addEventListener('mousedown', e => {
      if (state.dataset !== 'custom') return;
      const r = bc.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, Viz.fromPx(e.clientX - r.left, r.width)));
      const y = Math.max(-1, Math.min(1, Viz.fromPy(e.clientY - r.top, r.height)));
      const label = (e.shiftKey || e.button === 2) ? 1 : 0;
      state.custom.push({ x, y, label });
      data = customToData();
      drawAll();
    });

    // Tab 切换
    document.querySelectorAll('#tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.tab = btn.dataset.tab;
        document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b === btn));
        ['weights', 'fields', 'theory'].forEach(t => {
          $('tab-' + t).classList.toggle('hidden', t !== state.tab);
        });
        if (state.tab === 'fields') Viz.drawNeuronFields($('fields'), mlp);
        if (state.tab === 'weights') Viz.weightTable($('weightTable'), mlp);
      });
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        drawAll();
        if (state.tab === 'fields') Viz.drawNeuronFields($('fields'), mlp);
      }, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
