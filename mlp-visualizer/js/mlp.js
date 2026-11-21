/* ============================================================
 * mlp.js — 多层感知机（MLP）的纯 JavaScript 实现
 *
 * 完整包含：参数初始化、前向传播、二元交叉熵损失、
 *           反向传播（链式法则）、SGD / Momentum / Adam 优化器
 *
 * 无任何第三方依赖；既能在浏览器中运行，也能被 Node.js require。
 * 所有矩阵以「行数组」存储：W[l][i][j] 表示第 l 层
 * （l 从 0 开始，指从层 l 到层 l+1 的权重矩阵）中，
 * 目标神经元 i 与上一层第 j 个神经元之间的连接权重。
 * ============================================================ */
(function (global) {
  'use strict';

  /** 可复现的伪随机数生成器：mulberry32，保证同种子得到同一组初始参数 */
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 数值稳定的 sigmoid */
  function sigmoid(z) {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    const e = Math.exp(z);
    return e / (1 + e);
  }

  class MLP {
    /**
     * @param {object} options
     *   sizes      {number[]} 每层神经元数，例如 [2, 4, 4, 1]
     *   activation {string}   隐藏层激活函数：'tanh' | 'sigmoid' | 'relu'
     *   l2         {number}   L2 正则化强度
     *   optimizer  {string}   'sgd' | 'momentum' | 'adam'
     *   seed       {number}   随机种子
     */
    constructor(options) {
      const o = options || {};
      this.sizes = (o.sizes || [2, 4, 4, 1]).slice();
      this.sizes[this.sizes.length - 1] = 1;   // 本实验室固定为二分类输出层
      this.L = this.sizes.length - 1;          // 权重矩阵（连接）的数量
      this.activation = o.activation || 'tanh';
      this.l2 = o.l2 || 0;
      this.optimizer = o.optimizer || 'adam';
      this.seed = o.seed == null ? 42 : o.seed;
      this.initParams();
      this.resetOptimizer();
    }

    /* ---------- 参数初始化 ---------- */
    initParams() {
      const rng = makeRng(this.seed);
      const gauss = () => (rng() + rng() + rng() + rng() - 2) * 1.7320508; // 近似 N(0,1)
      this.W = [];
      this.b = [];
      for (let l = 0; l < this.L; l++) {
        const fanIn = this.sizes[l];
        const fanOut = this.sizes[l + 1];
        const W = [];
        for (let i = 0; i < fanOut; i++) {
          const row = new Float64Array(fanIn);
          for (let j = 0; j < fanIn; j++) {
            // tanh / sigmoid 用 Xavier，ReLU 用 He 初始化
            row[j] = this.activation === 'relu'
              ? gauss() * Math.sqrt(2 / fanIn)
              : (rng() * 2 - 1) * Math.sqrt(6 / (fanIn + fanOut));
          }
          W.push(row);
        }
        this.W.push(W);
        this.b.push(new Float64Array(fanOut)); // 偏置初始化为 0
      }
      this.acts = [];
      this.zs = [];
      this.lastGradNorm = 0;
      this.lastUpdateNorm = 0;
    }

    /** 生成与 W / b 形状一致的全零容器，用于存放优化器状态 */
    _zerosLike() {
      return {
        W: this.W.map(mat => mat.map(row => new Float64Array(row.length))),
        b: this.b.map(vec => new Float64Array(vec.length))
      };
    }

    resetOptimizer() {
      this.vel = this._zerosLike();   // Momentum 的速度
      this.m = this._zerosLike();     // Adam 的一阶矩
      this.v = this._zerosLike();     // Adam 的二阶矩
      this.t = 0;                     // Adam 时间步
    }

    setOptimizer(name) {
      this.optimizer = name;
      this.resetOptimizer();
    }

    /* ---------- 激活函数 ---------- */
    _act(z, isOutput) {
      if (isOutput) return sigmoid(z);
      switch (this.activation) {
        case 'relu': return z > 0 ? z : 0;
        case 'sigmoid': return sigmoid(z);
        default: return Math.tanh(z);
      }
    }

    _actDeriv(z, a, isOutput) {
      if (isOutput) return a * (1 - a);          // sigmoid'(z) = a(1-a)
      switch (this.activation) {
        case 'relu': return z > 0 ? 1 : 0;
        case 'sigmoid': return a * (1 - a);
        default: return 1 - a * a;               // tanh'(z) = 1 - a²
      }
    }

    /* ---------- 前向传播 ----------
     * z^(l+1) = W^(l) · a^(l) + b^(l)
     * a^(l+1) = σ(z^(l+1))（最后一层用 sigmoid 输出概率）
     */
    forward(x) {
      const acts = [Float64Array.from(x)];
      const zs = [null];
      let a = acts[0];
      for (let l = 0; l < this.L; l++) {
        const W = this.W[l], b = this.b[l];
        const z = new Float64Array(b.length);
        for (let i = 0; i < b.length; i++) {
          let s = b[i];
          for (let j = 0; j < a.length; j++) s += W[i][j] * a[j];
          z[i] = s;
        }
        const isOutput = l === this.L - 1;
        const next = new Float64Array(b.length);
        for (let i = 0; i < z.length; i++) next[i] = this._act(z[i], isOutput);
        zs.push(z);
        acts.push(next);
        a = next;
      }
      this.acts = acts;
      this.zs = zs;
      return a;
    }

    predictProba(x) { return this.forward(x)[0]; }

    /** 返回输入 x 在每一层的激活值（用于网络结构图可视化） */
    activationsFor(x) {
      this.forward(x);
      return this.acts.map(a => Array.from(a));
    }

    /* ---------- 损失与评估 ---------- */
    /** 全量评估：平均二元交叉熵 + L2 惩罚，以及分类准确率 */
    evaluate(X, y) {
      let loss = 0, correct = 0;
      const n = X.length;
      for (let k = 0; k < n; k++) {
        const p = this.predictProba(X[k]);
        const t = y[k];
        loss += -(t * Math.log(p + 1e-9) + (1 - t) * Math.log(1 - p + 1e-9));
        if ((p >= 0.5 ? 1 : 0) === t) correct++;
      }
      loss /= n;
      let reg = 0;
      for (let l = 0; l < this.L; l++)
        for (const row of this.W[l])
          for (let j = 0; j < row.length; j++) reg += row[j] * row[j];
      loss += 0.5 * this.l2 * reg;
      return { loss: loss, acc: correct / n };
    }

    /* ---------- 反向传播 + 一步参数更新 ---------- */
    /**
     * @param {Array} X  本批次输入，形如 [[x1,x2], ...]
     * @param {Array} y  本批次标签，0 / 1
     * @param {number} lr 学习率
     * @returns {{loss:number, acc:number, gradNorm:number, updateNorm:number}}
     */
    trainBatch(X, y, lr) {
      const n = X.length;
      const dW = this._zerosLike().W;
      const db = this._zerosLike().b;
      let batchLoss = 0, correct = 0;

      for (let k = 0; k < n; k++) {
        const a = this.forward(X[k]);       // 同时缓存 acts / zs
        const p = a[0], t = y[k];
        batchLoss += -(t * Math.log(p + 1e-9) + (1 - t) * Math.log(1 - p + 1e-9));
        if ((p >= 0.5 ? 1 : 0) === t) correct++;

        // 输出层：sigmoid + 二元交叉熵 组合后，δ^(L) = ŷ - y
        const deltas = new Array(this.L + 1);
        deltas[this.L] = new Float64Array([p - t]);

        for (let l = this.L - 1; l >= 0; l--) {
          const d = deltas[l + 1];          // δ^(l+1)
          const aPrev = this.acts[l];       // a^(l)
          for (let i = 0; i < d.length; i++) {
            db[l][i] += d[i];
            for (let j = 0; j < aPrev.length; j++) dW[l][i][j] += d[i] * aPrev[j];
          }
          if (l > 0) {
            // δ^(l) = (W^(l))ᵀ δ^(l+1) ⊙ σ'(z^(l))
            const z = this.zs[l];
            const Wl = this.W[l];
            const nd = new Float64Array(z.length);
            for (let j = 0; j < nd.length; j++) {
              let s = 0;
              for (let i = 0; i < d.length; i++) s += Wl[i][j] * d[i];
              nd[j] = s * this._actDeriv(z[j], this.acts[l][j], false);
            }
            deltas[l] = nd;
          }
        }
      }

      // 取批次平均，并加入 L2 正则项的梯度 λW
      let gradSq = 0, numel = 0;
      for (let l = 0; l < this.L; l++) {
        for (let i = 0; i < db[l].length; i++) {
          db[l][i] /= n;
          gradSq += db[l][i] * db[l][i]; numel++;
          for (let j = 0; j < dW[l][i].length; j++) {
            dW[l][i][j] = dW[l][i][j] / n + this.l2 * this.W[l][i][j];
            gradSq += dW[l][i][j] * dW[l][i][j]; numel++;
          }
        }
      }
      this.lastGradNorm = Math.sqrt(gradSq / Math.max(1, numel));

      // 用优化器更新参数
      this._applyGradients(dW, db, lr);

      return {
        loss: batchLoss / n,
        acc: correct / n,
        gradNorm: this.lastGradNorm,
        updateNorm: this.lastUpdateNorm
      };
    }

    _applyGradients(dW, db, lr) {
      let updateSum = 0, count = 0;
      const apply = (param, grad, state, l, i, j, isB) => {
        let delta;                        // 本次实际的参数改变量（param += delta）
        if (this.optimizer === 'adam') {
          const b1 = 0.9, b2 = 0.999, eps = 1e-8;
          const mArr = isB ? this.m.b[l] : this.m.W[l][i];
          const vArr = isB ? this.v.b[l] : this.v.W[l][i];
          mArr[j] = b1 * mArr[j] + (1 - b1) * grad;
          vArr[j] = b2 * vArr[j] + (1 - b2) * grad * grad;
          const mh = mArr[j] / (1 - Math.pow(b1, this.t));
          const vh = vArr[j] / (1 - Math.pow(b2, this.t));
          delta = -lr * mh / (Math.sqrt(vh) + eps);
        } else if (this.optimizer === 'momentum') {
          const vArr = isB ? this.vel.b[l] : this.vel.W[l][i];
          vArr[j] = 0.9 * vArr[j] - lr * grad;
          delta = vArr[j];
        } else {
          delta = -lr * grad;
        }
        param[j] += delta;
        updateSum += Math.abs(delta);
        count++;
      };

      if (this.optimizer === 'adam') this.t++;
      for (let l = 0; l < this.L; l++) {
        for (let i = 0; i < this.W[l].length; i++) {
          for (let j = 0; j < this.W[l][i].length; j++)
            apply(this.W[l][i], dW[l][i][j], null, l, i, j, false);
          apply(this.b[l], db[l][i], null, l, i, i, true);
        }
      }
      this.lastUpdateNorm = updateSum / Math.max(1, count);
    }

    /** 参数统计：参数总量、权重平均绝对值 */
    paramStats() {
      let count = 0, sum = 0, max = 0;
      for (let l = 0; l < this.L; l++) {
        for (const row of this.W[l])
          for (let j = 0; j < row.length; j++) {
            count++; sum += Math.abs(row[j]); max = Math.max(max, Math.abs(row[j]));
          }
        count += this.b[l].length;
      }
      return { count: count, meanAbsW: sum / Math.max(1, count), maxAbsW: max };
    }
  }

  global.MLP = MLP;
  global.makeRng = makeRng;
  if (typeof module !== 'undefined' && module.exports) module.exports = { MLP, makeRng };
})(typeof window !== 'undefined' ? window : globalThis);
