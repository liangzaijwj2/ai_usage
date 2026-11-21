/* ============================================================
 * datasets.js — 二维二分类玩具数据集生成器
 * 坐标统一映射到 [-1, 1] × [-1, 1]，标签为 0 / 1。
 * 用于直观观察 MLP 如何拟合不同的决策边界。
 * ============================================================ */
(function (global) {
  'use strict';

  const LIST = [
    { id: 'xor', name: '异或 XOR（非线性可分）' },
    { id: 'circle', name: '同心圆 Circle' },
    { id: 'moons', name: '双月 Moons' },
    { id: 'spiral', name: '双螺旋 Spiral' },
    { id: 'linear', name: '线性可分 Linear' },
    { id: 'custom', name: '自定义（点击画布添加）' }
  ];

  function gaussian(rng) {
    const u = Math.max(1e-9, rng());
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function clamp(v) { return Math.max(-1, Math.min(1, v)); }

  /**
   * @param {string} name  数据集 id
   * @param {number} count 样本总数（两类大致各半）
   * @param {number} noise 高斯噪声标准差
   * @param {function} rng 随机数函数
   * @returns {{X: number[][], y: number[]}}
   */
  function generate(name, count, noise, rng) {
    const X = [], y = [];
    const half = Math.ceil(count / 2);
    const push = (x1, x2, label) => {
      X.push([clamp(x1 + gaussian(rng) * noise), clamp(x2 + gaussian(rng) * noise)]);
      y.push(label);
    };

    if (name === 'xor') {
      const centers = [[-0.55, -0.55, 1], [0.55, 0.55, 1], [-0.55, 0.55, 0], [0.55, -0.55, 0]];
      for (let k = 0; k < count; k++) {
        const c = centers[k % 4];
        push(c[0], c[1], c[2]);
      }
    } else if (name === 'circle') {
      for (let k = 0; k < count; k++) {
        const label = k < half ? 1 : 0;
        const r = label ? 0.12 + rng() * 0.30 : 0.58 + rng() * 0.36;
        const t = rng() * Math.PI * 2;
        push(r * Math.cos(t), r * Math.sin(t), label);
      }
    } else if (name === 'moons') {
      for (let k = 0; k < count; k++) {
        const label = k < half ? 0 : 1;
        const t = rng() * Math.PI;
        let x1, x2;
        if (label === 0) { x1 = Math.cos(t); x2 = Math.sin(t); }
        else { x1 = 1 - Math.cos(t); x2 = 0.5 - Math.sin(t); }
        push((x1 - 0.5) * 1.35, (x2 - 0.25) * 1.45, label);
      }
    } else if (name === 'spiral') {
      for (let k = 0; k < count; k++) {
        const label = k < half ? 0 : 1;
        const t = (k % half) / half * 3.4 * Math.PI + 0.35;
        const r = 0.08 + t * 0.088;
        const angle = t + (label ? Math.PI : 0);
        push(r * Math.cos(angle) * 0.92, r * Math.sin(angle) * 0.92, label);
      }
    } else if (name === 'linear') {
      for (let k = 0; k < count; k++) {
        const x1 = rng() * 2 - 1, x2 = rng() * 2 - 1;
        push(x1, x2, (0.8 * x1 - 0.55 * x2 + 0.05 > 0) ? 1 : 0);
      }
    } else {
      // custom：由界面点击产生，这里返回空集
      return { X: [], y: [] };
    }
    return { X: X, y: y };
  }

  global.Datasets = { LIST: LIST, generate: generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = { LIST, generate };
})(typeof window !== 'undefined' ? window : globalThis);
