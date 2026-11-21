/* ============================================================
 * viz.js — Canvas 2D 可视化
 *  · 决策边界热力图 + 训练样本
 *  · 损失 / 准确率曲线
 *  · 网络结构与实时权重、激活值
 *  · 隐藏层神经元的「响应场」
 *  · 权重矩阵数值表
 * ============================================================ */
(function (global) {
  'use strict';

  const C0 = [37, 99, 235];    // 类别 0 / 正权重：蓝
  const C1 = [234, 88, 12];    // 类别 1 / 负权重：橙
  const MID = [248, 250, 252]; // 概率 0.5 附近的底色
  const EDGE = [71, 85, 105];  // 决策边界线
  const INK = '#1e293b', MUTED = '#94a3b8';
  const HEAT_RES = 100;        // 热力图内部采样分辨率

  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = heatCanvas.height = HEAT_RES;
  const heatCtx = heatCanvas.getContext('2d');

  /** 按设备像素比适配画布，返回 CSS 像素坐标系下的 ctx 与尺寸 */
  function fit(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const toPx = (x, w) => (x + 1) / 2 * w;
  const toPy = (y, h) => (1 - y) / 2 * h;
  const fromPx = (px, w) => px / w * 2 - 1;
  const fromPy = (py, h) => 1 - py / h * 2;

  /* ---------------- 决策边界 ---------------- */
  function boundaryColor(p, out, idx) {
    const t = Math.pow(Math.min(1, Math.abs(p - 0.5) * 2), 0.8); // 置信度
    const base = p >= 0.5 ? C1 : C0;
    const k = 0.10 + 0.78 * t;
    out[idx] = MID[0] + (base[0] - MID[0]) * k;
    out[idx + 1] = MID[1] + (base[1] - MID[1]) * k;
    out[idx + 2] = MID[2] + (base[2] - MID[2]) * k;
    out[idx + 3] = 255;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {MLP} mlp
   * @param {{X:number[][], y:number[]}} data
   * @param {{hover?:number[], probe?:boolean}} opts
   */
  function drawBoundary(canvas, mlp, data, opts) {
    const o = opts || {};
    const { ctx, w, h } = fit(canvas);
    // 第一遍：采样整个输入平面的预测概率
    const probs = new Float32Array(HEAT_RES * HEAT_RES);
    for (let py = 0; py < HEAT_RES; py++) {
      const y = fromPy((py + 0.5) / HEAT_RES * h, h);
      for (let px = 0; px < HEAT_RES; px++) {
        const x = fromPx((px + 0.5) / HEAT_RES * w, w);
        probs[py * HEAT_RES + px] = mlp.predictProba([x, y]);
      }
    }
    // 第二遍：上色；只有真正跨越 0.5 的位置才画等高线
    // （不能用「|p-0.5| 很小」判断，训练初期全平面 p≈0.5 会被整片涂黑）
    const img = heatCtx.createImageData(HEAT_RES, HEAT_RES);
    const buf = img.data;
    for (let py = 0; py < HEAT_RES; py++) {
      for (let px = 0; px < HEAT_RES; px++) {
        const k = py * HEAT_RES + px;
        const p = probs[k];
        boundaryColor(p, buf, k * 4);
        const side = p >= 0.5;
        const right = px + 1 < HEAT_RES ? probs[k + 1] >= 0.5 : side;
        const down = py + 1 < HEAT_RES ? probs[k + HEAT_RES] >= 0.5 : side;
        if (right !== side || down !== side) {
          buf[k * 4] = EDGE[0]; buf[k * 4 + 1] = EDGE[1]; buf[k * 4 + 2] = EDGE[2];
        }
      }
    }
    heatCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(heatCanvas, 0, 0, w, h);

    // 坐标网格与刻度
    ctx.strokeStyle = 'rgba(100,116,139,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(71,85,105,0.75)';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('-1', 4, 12);
    ctx.fillText('1', w - 12, 12);
    ctx.fillText('x', w - 12, h / 2 - 5);
    ctx.fillText('y', w / 2 + 5, 12);
    ctx.fillText('P(y=1)', 6, h - 6);

    // 训练样本点
    for (let k = 0; k < data.X.length; k++) {
      const x = data.X[k][0], y = data.X[k][1];
      const px = toPx(x, w), py = toPy(y, h);
      const label = data.y[k];
      const correct = (mlp.predictProba([x, y]) >= 0.5 ? 1 : 0) === label;
      if (!correct) {
        ctx.beginPath();
        ctx.arc(px, py, 8.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(15,23,42,0.85)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(label === 1 ? C1 : C0, 0.95);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // 鼠标探针
    if (o.hover) {
      const px = toPx(o.hover[0], w), py = toPy(o.hover[1], h);
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py);
      ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14);
      ctx.strokeStyle = 'rgba(15,23,42,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* ---------------- 损失 / 准确率曲线 ---------------- */
  function drawCurve(canvas, history) {
    const { ctx, w, h } = fit(canvas);
    const pad = { l: 40, r: 12, t: 14, b: 24 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#eef2f7';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + ch * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    }
    ctx.fillStyle = MUTED;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('1.0', 6, pad.t + 4);
    ctx.fillText('0.5', 6, pad.t + ch / 2 + 4);
    ctx.fillText('0.0', 6, pad.t + ch + 4);

    if (history.length < 2) {
      ctx.fillStyle = MUTED;
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('点击「开始训练」后显示曲线', pad.l + 12, pad.t + ch / 2);
      return;
    }
    const n = history.length;
    const maxLoss = Math.max(0.8, ...history.map(d => d.loss));
    const X = i => pad.l + cw * i / (n - 1);
    const Yloss = v => pad.t + ch * (1 - Math.min(1, v / maxLoss));
    const Yacc = v => pad.t + ch * (1 - v);

    // loss（蓝）
    ctx.beginPath();
    history.forEach((d, i) => i ? ctx.lineTo(X(i), Yloss(d.loss)) : ctx.moveTo(X(i), Yloss(d.loss)));
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.stroke();
    // accuracy（绿）
    ctx.beginPath();
    history.forEach((d, i) => i ? ctx.lineTo(X(i), Yacc(d.acc)) : ctx.moveTo(X(i), Yacc(d.acc)));
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('loss 轴上限 ' + maxLoss.toFixed(2), w - pad.r, pad.t + 10);
    ctx.textAlign = 'left';
    // 图例放在底部，避免和曲线起点重叠
    ctx.fillStyle = '#2563eb'; ctx.fillRect(w / 2 - 56, h - 15, 9, 9);
    ctx.fillStyle = MUTED; ctx.fillText('loss', w / 2 - 43, h - 6);
    ctx.fillStyle = '#16a34a'; ctx.fillRect(w / 2 + 6, h - 15, 9, 9);
    ctx.fillStyle = MUTED; ctx.fillText('acc', w / 2 + 19, h - 6);
    ctx.fillText('step ' + history[0].step, pad.l, h - 6);
    ctx.fillText('step ' + history[n - 1].step, w - 74, h - 6);
  }

  /* ---------------- 网络结构图 ---------------- */
  function drawNetwork(canvas, mlp, activations) {
    const { ctx, w, h } = fit(canvas);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const sizes = mlp.sizes;
    const L = sizes.length;
    const padX = 42, padY = 30;
    const maxN = Math.max(...sizes);
    const gap = Math.min(44, (h - padY * 2) / Math.max(1, maxN - 1));
    const radius = Math.min(15, Math.max(9, gap * 0.34));
    const pos = [];
    for (let l = 0; l < L; l++) {
      const n = sizes[l];
      const x = L === 1 ? w / 2 : padX + (w - padX * 2) * l / (L - 1);
      const arr = [];
      for (let i = 0; i < n; i++) arr.push([x, h / 2 + (i - (n - 1) / 2) * gap]);
      pos.push(arr);
    }

    // 连线：颜色表示权重正负，粗细与透明度表示权重大小
    for (let l = 0; l < mlp.L; l++) {
      for (let i = 0; i < mlp.W[l].length; i++) {
        for (let j = 0; j < mlp.W[l][i].length; j++) {
          const val = mlp.W[l][i][j];
          const a = 0.12 + Math.min(0.7, Math.abs(val) / 2.2);
          ctx.beginPath();
          ctx.moveTo(pos[l][j][0] + radius, pos[l][j][1]);
          ctx.lineTo(pos[l + 1][i][0] - radius, pos[l + 1][i][1]);
          ctx.strokeStyle = rgba(val >= 0 ? C0 : C1, a);
          ctx.lineWidth = 0.6 + Math.min(4.2, Math.abs(val) * 1.15);
          ctx.stroke();
        }
      }
    }

    // 节点
    for (let l = 0; l < L; l++) {
      for (let i = 0; i < sizes[l]; i++) {
        const [x, y] = pos[l][i];
        const val = activations ? activations[l][i] : mlp.b[l - 1] ? mlp.b[l - 1][i] : 0;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = val >= 0 ? rgba(C0, 0.10 + Math.min(0.55, Math.abs(val) * 0.45))
                                : rgba(C1, 0.10 + Math.min(0.55, Math.abs(val) * 0.45));
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = val >= 0 ? rgba(C0, 0.85) : rgba(C1, 0.85);
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.abs(val) >= 10 ? val.toFixed(0) : val.toFixed(1), x, y);
      }
      ctx.fillStyle = MUTED;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const name = l === 0 ? '输入 x' : (l === L - 1 ? '输出 ŷ' : '隐藏层 ' + l);
      ctx.fillText(name, pos[l][0][0], 14);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = MUTED;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('蓝 = 正权重 / 橙 = 负权重；线越粗 |w| 越大', 8, h - 6);
    ctx.fillText('节点内：' + (activations ? '当前输入下激活值' : '偏置 b'), 8, h - 19);
  }

  /* ---------------- 隐藏神经元响应场 ---------------- */
  /** 每个小图展示一个隐藏神经元在整个输入平面上的激活强度 */
  function drawNeuronFields(canvas, mlp) {
    const units = mlp.L >= 2 ? mlp.sizes[mlp.L - 1] : 0;
    const cols = Math.min(4, Math.max(1, units));
    const rows = Math.max(1, Math.ceil(units / cols));
    const rect = canvas.getBoundingClientRect();
    const cell = Math.min(110, Math.max(64, (rect.width || 400) / cols - 12));
    return drawFields(canvas, mlp, units, cols, rows, cell);
  }

  function drawFields(canvas, mlp, units, cols, rows, cell) {
    const res = 32;
    const needH = rows * (cell + 20) + 10;
    canvas.style.height = needH + 'px';
    const { ctx, w, h } = fit(canvas);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    if (!units) {
      ctx.fillStyle = MUTED; ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('当前网络没有隐藏层，添加一个隐藏层即可查看响应场。', 12, 24);
      return;
    }
    const actualCell = Math.min(cell, (w - 8) / cols - 8);
    const imgs = [];
    for (let u = 0; u < units; u++) {
      const c = document.createElement('canvas');
      c.width = c.height = res;
      imgs.push({ c, ctx: c.getContext('2d'), img: c.getContext('2d').createImageData(res, res) });
    }
    for (let py = 0; py < res; py++) {
      const y = 1 - (py + 0.5) / res * 2;
      for (let px = 0; px < res; px++) {
        const x = (px + 0.5) / res * 2 - 1;
        const acts = mlp.activationsFor([x, y]);
        const last = acts[acts.length - 2]; // 最后一个隐藏层
        for (let u = 0; u < units; u++) {
          const v = Math.max(-1, Math.min(1, last[u]));
          const k = Math.min(1, Math.abs(v));
          const base = v >= 0 ? C0 : C1;
          const buf = imgs[u].img.data, idx = (py * res + px) * 4;
          buf[idx] = MID[0] + (base[0] - MID[0]) * k;
          buf[idx + 1] = MID[1] + (base[1] - MID[1]) * k;
          buf[idx + 2] = MID[2] + (base[2] - MID[2]) * k;
          buf[idx + 3] = 255;
        }
      }
    }
    ctx.font = '10px ui-monospace, monospace';
    for (let u = 0; u < units; u++) {
      imgs[u].ctx.putImageData(imgs[u].img, 0, 0);
      const col = u % cols, row = Math.floor(u / cols);
      const x = 8 + col * (actualCell + 8);
      const y = 16 + row * (actualCell + 20);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(imgs[u].c, x, y, actualCell, actualCell);
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, actualCell - 1, actualCell - 1);
      ctx.fillStyle = INK;
      ctx.fillText('h' + (u + 1), x + 2, y - 4);
    }
  }

  /* ---------------- 权重矩阵数值表 ---------------- */
  function weightTable(container, mlp) {
    let html = '';
    for (let l = 0; l < mlp.L; l++) {
      const fanIn = mlp.sizes[l], fanOut = mlp.sizes[l + 1];
      html += `<div class="wt-layer"><div class="wt-title">W<sup>(${l + 1})</sup> · ${fanOut} × ${fanIn}
        <span>行 = 后层神经元，列 = 前层神经元</span></div><table><thead><tr><th></th>`;
      for (let j = 0; j < fanIn; j++)
        html += `<th>${l === 0 ? (j === 0 ? 'x₁' : (j === 1 ? 'x₂' : 'x' + j)) : 'a' + j}</th>`;
      html += '<th>b</th></tr></thead><tbody>';
      for (let i = 0; i < fanOut; i++) {
        html += `<tr><th>${i + 1}</th>`;
        for (let j = 0; j < fanIn; j++) {
          const v = mlp.W[l][i][j];
          html += `<td class="${v >= 0 ? 'pos' : 'neg'}">${v.toFixed(3)}</td>`;
        }
        html += `<td class="${mlp.b[l][i] >= 0 ? 'pos' : 'neg'}">${mlp.b[l][i].toFixed(3)}</td></tr>`;
      }
      html += '</tbody></table></div>';
    }
    container.innerHTML = html;
  }

  global.Viz = { fit, drawBoundary, drawCurve, drawNetwork, drawNeuronFields, weightTable, fromPx, fromPy };
})(typeof window !== 'undefined' ? window : globalThis);
