/* 中洲纪年 · HD-2D 2.5D 立体沙盘引擎（零外部依赖 WebGL2 + 2D 纸模立牌层）
 * - 复用 window.WORLD 几何与脊状多重分形高度场生成真实 3D 起伏地形与海岸悬崖
 * - 贝烈瑞安德 / 努门诺尔随纪元时间在 3D 海面中真实升降沉没，阿门洲隐入薄雾
 * - 实时动态海面波光与海岸浪花、分纪元光照与大气远景雾、3D 树林立牌、贴地旅程光带、飘云与末日火山余烬
 * - 前景 HD-2D 纸模立牌层完整保留现有手绘城堡、Q 版人物、至尊戒、关键时刻与交互点击
 */
(function () {
  const M = window.__ME;
  if (!M || !window.WORLD) return;

  const W = M.W, D = M.D, DECO = M.DECO || {};
  const [BX, BY, BW, BH] = W.box; // [-1320, -120, 2320, 900]
  const GW = 464, GH = 180;       // 5 地图单位/格，83,520 顶点
  const DEG = Math.PI / 180;
  const FOVY = 38 * DEG;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * (3 - 2 * t);
  const smoothstep = (e0, e1, x) => sm(clamp((x - e0) / (e1 - e0), 0, 1));

  /* ==================== 噪声与数学工具 ==================== */
  const H32 = (i, j) => {
    let n = (i * 374761393 + j * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = H32(xi, yi), b = H32(xi + 1, yi), c = H32(xi, yi + 1), d = H32(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  function fbm(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1;
    for (let o = 0; o < oct; o++) { s += noise2(x * f + o * 13.7, y * f - o * 7.3) * a; a *= 0.5; f *= 2.02; }
    return s;
  }
  function ridged(x, y, oct = 4) {
    let s = 0, amp = 0.55, f = 1, w = 1;
    for (let o = 0; o < oct; o++) {
      let n = 1 - Math.abs(noise2(x * f + o * 17.3, y * f - o * 9.1) * 2 - 1);
      n *= n * w; w = Math.min(1, n * 1.6);
      s += n * amp; amp *= 0.5; f *= 2.03;
    }
    return s;
  }
  function densePoly(pts, closed = false, segs = 5) {
    const n = pts.length;
    if (n < 3) return pts;
    const out = [];
    const cnt = closed ? n : n - 1;
    const at = (i) => closed ? pts[(i + n * 4) % n] : pts[clamp(i, 0, n - 1)];
    for (let i = 0; i < cnt; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const l01 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const l12 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
      const l23 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) || 1;
      // 限幅 Hermite 切线，彻底消除长直边（如北缘 y=-120）的 Catmull-Rom 过冲凸角
      let m1x = 0.5 * (p2[0] - p0[0]), m1y = 0.5 * (p2[1] - p0[1]);
      let m2x = 0.5 * (p3[0] - p1[0]), m2y = 0.5 * (p3[1] - p1[1]);
      const lim1 = Math.min(l01, l12) * 0.72, len1 = Math.hypot(m1x, m1y) || 1;
      if (len1 > lim1) { m1x *= lim1 / len1; m1y *= lim1 / len1; }
      const lim2 = Math.min(l12, l23) * 0.72, len2 = Math.hypot(m2x, m2y) || 1;
      if (len2 > lim2) { m2x *= lim2 / len2; m2y *= lim2 / len2; }
      for (let k = 0; k < segs; k++) {
        const t = k / segs, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        out.push([
          h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x,
          h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  function numenorStar() {
    const N = W.numenor, star = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? N.r * 0.42 : N.r;
      star.push([N.cx + Math.cos(a) * r, N.cy + Math.sin(a) * r]);
    }
    return star;
  }
  function segDist(px, py, P) {
    let best = 1e9, bu = 0, bs = 1, acc = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const ax = P[i][0], ay = P[i][1], bx = P[i + 1][0], by = P[i + 1][1];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
      const ex = ax + dx * t - px, ey = ay + dy * t - py, d = ex * ex + ey * ey;
      if (d < best) { best = d; bu = acc + t * L; bs = (dx * (py - ay) - dy * (px - ax)) > 0 ? 1 : -1; }
      acc += L;
    }
    const dd = Math.sqrt(best);
    return [dd, bu, dd * bs];
  }
  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ==================== 4x4 矩阵（列主序） ==================== */
  function mat4Perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }
  function mat4LookAt(eye, target, up) {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1
    ]);
  }
  function mat4Mul(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }
  function mat4Inv(m) {
    const out = new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
  function unprojectRay(invMvp, ndcX, ndcY) {
    const xf = (x, y, z) => {
      const w = invMvp[3] * x + invMvp[7] * y + invMvp[11] * z + invMvp[15] || 1;
      return [
        (invMvp[0] * x + invMvp[4] * y + invMvp[8] * z + invMvp[12]) / w,
        (invMvp[1] * x + invMvp[5] * y + invMvp[9] * z + invMvp[13]) / w,
        (invMvp[2] * x + invMvp[6] * y + invMvp[10] * z + invMvp[14]) / w
      ];
    };
    const p0 = xf(ndcX, ndcY, -1), p1 = xf(ndcX, ndcY, 1);
    const dy = p1[1] - p0[1];
    if (Math.abs(dy) < 1e-5) return null;
    // 沿视线在 Y=68..0 区间做 14 步高度场求交，让鼠标指在山峰/峡谷上时缩放精准锚定到真实 3D 表面
    const tHi = (68.0 - p0[1]) / dy, tLo = (0.0 - p0[1]) / dy;
    const t0 = Math.max(0, Math.min(tHi, tLo)), t1 = Math.max(t0, Math.max(tHi, tLo));
    let prevT = t0, prevDiff = 999;
    for (let s = 0; s <= 14; s++) {
      const t = lerp(t0, t1, s / 14);
      const rx = p0[0] + (p1[0] - p0[0]) * t;
      const ry = p0[1] + dy * t;
      const rz = p0[2] + (p1[2] - p0[2]) * t;
      const h = Math.max(0, sampleH(rx, rz, true));
      const diff = ry - h;
      if (diff <= 0) {
        const frac = prevDiff > 0 ? prevDiff / (prevDiff - diff) : 0;
        const th = lerp(prevT, t, clamp(frac, 0, 1));
        return [p0[0] + (p1[0] - p0[0]) * th, p0[2] + (p1[2] - p0[2]) * th];
      }
      prevT = t; prevDiff = diff;
    }
    const tg = (2.5 - p0[1]) / dy;
    if (tg < 0) return null;
    return [p0[0] + (p1[0] - p0[0]) * tg, p0[2] + (p1[2] - p0[2]) * tg];
  }

  /* ==================== 高度场与地理数据构建 ==================== */
  let HField = null, RegionField = null, LakeField = null, RockField = null, MtnField = null;
  let ShorePerm = null, ShoreBel = null, ShoreNu = null;
  let belSink = 1, nuSink = 1, amanVeil = 1;
  let belSinkTgt = 1, nuSinkTgt = 1, amanVeilTgt = 1;

  function drawSmoothPoly(ctx, pts, scaleX, scaleY, offX, offY) {
    const dp = densePoly(pts, true, 5);
    ctx.beginPath();
    for (let i = 0; i < dp.length; i++) {
      const x = (dp[i][0] - offX) * scaleX, y = (dp[i][1] - offY) * scaleY;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function buildHeightfield() {
    const N = GW * GH;
    HField = new Float32Array(N);
    RegionField = new Uint8Array(N); // 0=ME, 1=Bel, 2=Nu, 3=Aman, 4=Ocean
    LakeField = new Uint8Array(N);
    RockField = new Uint8Array(N);   // 0=norm, 1=dark, 2=fire, 3=aman/snow
    MtnField = new Float32Array(N);

    // 1. 用离屏 Canvas 分通道光栅化陆地掩膜（R=中洲, G=贝烈瑞安德, B=努门诺尔），避免抗锯齿边缘串台
    const mc = document.createElement("canvas");
    mc.width = GW; mc.height = GH;
    const g = mc.getContext("2d", { willReadFrequently: true });
    const sx = (GW - 1) / BW, sy = (GH - 1) / BH;
    const fillMask = (ctx, poly, col) => { drawSmoothPoly(ctx, poly, sx, sy, BX, BY); ctx.fillStyle = col; ctx.fill(); };

    g.fillStyle = "#000000"; g.fillRect(0, 0, GW, GH);
    g.globalCompositeOperation = "lighter";
    fillMask(g, W.land.me, "rgb(255,0,0)");
    fillMask(g, W.land.beleriand, "rgb(0,255,0)");
    fillMask(g, W.land.balar, "rgb(0,255,0)");
    fillMask(g, W.land.ice, "rgb(0,255,0)");
    fillMask(g, numenorStar(), "rgb(0,0,255)");
    const img1 = g.getImageData(0, 0, GW, GH).data;

    // 第二趟：R=阿门洲, G=湖泊, B=河流
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#000000"; g.fillRect(0, 0, GW, GH);
    g.globalCompositeOperation = "lighter";
    fillMask(g, W.land.aman, "rgb(255,0,0)");
    fillMask(g, W.land.eressea, "rgb(255,0,0)");
    W.lakes.forEach((lk) => fillMask(g, lk.pts, "rgb(0,255,0)"));
    g.strokeStyle = "rgb(0,0,180)";
    g.lineCap = "round"; g.lineJoin = "round";
    W.rivers.forEach((rv) => {
      const sp = densePoly(rv.pts, false, 4);
      g.lineWidth = Math.max(1.2, rv.w * 0.72);
      g.beginPath();
      sp.forEach((p, i) => {
        const x = (p[0] - BX) * sx, y = (p[1] - BY) * sy;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.stroke();
    });
    const img2 = g.getImageData(0, 0, GW, GH).data;

    // 2. 双趟 Chamfer 距离变换（区分永久陆地 / 贝烈瑞安德 / 努门诺尔近岸距离 + 湖岸缓坡距离）
    const dLand = new Float32Array(N);
    const dSeaPerm = new Float32Array(N);
    const dSeaBel = new Float32Array(N);
    const dSeaNu = new Float32Array(N);
    const dLake = new Float32Array(N);
    const INF = 1e5;
    for (let i = 0; i < N; i++) {
      const o4 = i * 4;
      let reg = 4;
      if (img1[o4] > 128) reg = 0;
      else if (img1[o4 + 1] > 128) reg = 1;
      else if (img1[o4 + 2] > 128) reg = 2;
      else if (img2[o4] > 128) reg = 3;
      RegionField[i] = reg;
      LakeField[i] = img2[o4 + 1] > 110 ? 1 : 0;
      const isLand = reg !== 4;
      dLand[i] = isLand ? INF : 0;
      dSeaPerm[i] = (reg === 0 || reg === 3) ? 0 : INF;
      dSeaBel[i] = reg === 1 ? 0 : INF;
      dSeaNu[i] = reg === 2 ? 0 : INF;
      dLake[i] = LakeField[i] ? 0 : INF;
    }
    const pass = (arr) => {
      for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
          const o = j * GW + i;
          let v = arr[o];
          if (i > 0) v = Math.min(v, arr[o - 1] + 1);
          if (j > 0) v = Math.min(v, arr[o - GW] + 1);
          if (i > 0 && j > 0) v = Math.min(v, arr[o - GW - 1] + 1.414);
          if (i < GW - 1 && j > 0) v = Math.min(v, arr[o - GW + 1] + 1.414);
          arr[o] = v;
        }
      }
      for (let j = GH - 1; j >= 0; j--) {
        for (let i = GW - 1; i >= 0; i--) {
          const o = j * GW + i;
          let v = arr[o];
          if (i < GW - 1) v = Math.min(v, arr[o + 1] + 1);
          if (j < GH - 1) v = Math.min(v, arr[o + GW] + 1);
          if (i < GW - 1 && j < GH - 1) v = Math.min(v, arr[o + GW + 1] + 1.414);
          if (i > 0 && j < GH - 1) v = Math.min(v, arr[o + GW - 1] + 1.414);
          arr[o] = v;
        }
      }
    };
    pass(dLand);
    pass(dSeaPerm);
    pass(dSeaBel);
    pass(dSeaNu);
    pass(dLake);
    ShorePerm = dSeaPerm;
    ShoreBel = dSeaBel;
    ShoreNu = dSeaNu;

    // 3. 基础大陆台地 + 海岸悬崖 + 丘陵起伏 + 自然缓坡湖盆/河谷
    for (let j = 0; j < GH; j++) {
      const wz = BY + (j / (GH - 1)) * BH;
      for (let i = 0; i < GW; i++) {
        const wx = BX + (i / (GW - 1)) * BW;
        const o = j * GW + i;
        const reg = RegionField[o];
        const riverB = img2[o * 4 + 2] / 255;
        if (reg === 4) {
          // 海底统一下沉到水下，避免沉没大陆边缘露出海底台阶
          const sd = Math.min(dSeaPerm[o], dSeaBel[o], dSeaNu[o]);
          HField[o] = -clamp(1.2 + Math.pow(sd * 0.45, 0.85) * 1.4, 1.2, 11.5);
        } else {
          // 陆地：陡峭厚实的微缩沙盘海岸悬崖 + 柔和起伏地形
          const ld = dLand[o];
          const cliff = smoothstep(0.0, 2.0, ld) * 3.6 + 0.85;
          const hills = fbm(wx * 0.0085, wz * 0.0085, 4) * 4.8 * smoothstep(0.8, 6.0, ld);
          let h = cliff + hills;
          // 魔多黑高原抬升
          if (wx > 725 && wx < 955 && wz > 485 && wz < 660) {
            const md = smoothstep(0, 25, Math.min(wx - 725, 955 - wx, wz - 485, 660 - wz));
            h += md * 3.4;
            if (md > 0.35) RockField[o] = 1;
          }
          // 湖泊自然缓坡谷盆（不再是陡直黑坑）
          if (LakeField[o]) {
            h = -1.6;
          } else if (dLake[o] < 3.4) {
            const lf = smoothstep(0.2, 3.4, dLake[o]);
            h = lerp(0.55, h, lf);
          } else if (riverB > 0.18 && ld > 1.4) {
            h -= riverB * 1.35;
          }
          // 极北佛罗茨威斯 / 冰峡标记冰雪质感
          if (wz < -45 && reg !== 2) RockField[o] = 3;
          if (reg === 3) RockField[o] = 3;
          HField[o] = h;
        }
      }
    }

    // 3b. 真实 3D 丘陵岗地（古冢岗、风云丘陵、北/南岗、伊顿荒原、埃敏穆伊、铁丘陵等）
    (DECO.HILLS || []).forEach((hl) => {
      const xs = hl.pts.map((p) => p[0]), ys = hl.pts.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5;
      const rx = Math.max(14, (x1 - x0) * 0.62), ry = Math.max(14, (y1 - y0) * 0.62);
      const i0 = clamp(Math.floor(((cx - rx * 1.2) - BX) * sx), 0, GW - 1);
      const i1 = clamp(Math.ceil(((cx + rx * 1.2) - BX) * sx), 0, GW - 1);
      const j0 = clamp(Math.floor(((cy - ry * 1.2) - BY) * sy), 0, GH - 1);
      const j1 = clamp(Math.ceil(((cy + ry * 1.2) - BY) * sy), 0, GH - 1);
      const amp = hl.rock ? 8.5 : 5.4;
      for (let j = j0; j <= j1; j++) {
        const wz = BY + (j / (GH - 1)) * BH;
        for (let i = i0; i <= i1; i++) {
          const o = j * GW + i;
          if (RegionField[o] === 4 || LakeField[o] || dLand[o] < 1.2) continue;
          const wx = BX + (i / (GW - 1)) * BW;
          const dn = Math.hypot((wx - cx) / rx, (wz - cy) / ry);
          if (dn >= 1.1) continue;
          const env = sm(1 - dn / 1.1);
          const bumps = hl.rock ? ridged(wx * 0.055, wz * 0.055, 3) : fbm(wx * 0.045, wz * 0.045, 3);
          const addH = amp * env * (0.45 + 0.75 * bumps);
          HField[o] += addH;
          if (hl.rock && addH > 2.2) MtnField[o] = Math.max(MtnField[o], clamp(addH / 16, 0, 0.6));
        }
      }
    });

    // 4. 3D 脊状多重分形山脉
    W.mountains.forEach((m) => {
      const P = densePoly(m.pts, false, 4);
      const mh = m.h;
      const R = mh * 2.85;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      P.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      const i0 = clamp(Math.floor(((x0 - R * 1.35) - BX) * sx), 0, GW - 1);
      const i1 = clamp(Math.ceil(((x1 + R * 1.35) - BX) * sx), 0, GW - 1);
      const j0 = clamp(Math.floor(((y0 - R * 1.35) - BY) * sy), 0, GH - 1);
      const j1 = clamp(Math.ceil(((y1 + R * 1.35) - BY) * sy), 0, GH - 1);
      const f0 = 1 / (mh * 0.62);
      const amp = mh * 2.35;
      const rk = m.dark ? 1 : m.aman ? 3 : 0;

      for (let j = j0; j <= j1; j++) {
        const wz = BY + (j / (GH - 1)) * BH;
        for (let i = i0; i <= i1; i++) {
          const o = j * GW + i;
          if (RegionField[o] === 4 || LakeField[o]) continue;
          const coastFade = smoothstep(0.6, 2.4, dLand[o]);
          if (coastFade < 0.02) continue;
          const wx = BX + (i / (GW - 1)) * BW;
          const [d, u, v] = segDist(wx, wz, P);
          const rr = R * (0.68 + 0.36 * noise2(wx * f0 * 0.35 + 11, wz * f0 * 0.35 - 7));
          if (d >= rr) continue;
          const b = sm(1 - d / rr);
          const spine = Math.pow(Math.max(0, 1 - d / (rr * 0.82)), 1.55);
          const r = 0.62 * ridged(u * f0 * 1.3 + 0.55 * noise2(v * f0, u * f0 * 0.4), v * f0 * 0.55, 4) +
                    0.38 * ridged(wx * f0 * 1.5 + 5, wz * f0 * 1.5 - 3, 3);
          const addH = amp * coastFade * (b * (0.18 + 0.82 * r) * (0.5 + 0.5 * spine) + spine * 0.45);
          if (addH > 0.2) {
            HField[o] += addH;
            const normM = clamp(addH / 34, 0, 1);
            if (normM > MtnField[o]) { MtnField[o] = normM; if (rk) RockField[o] = rk; }
          }
        }
      }
    });

    // 5. 标志性孤峰（孤山、末日火山、卡拉兹拉斯、泰尼魁提尔、梅涅尔塔玛）
    W.peaks.forEach((pk) => {
      const ph = pk.h;
      const R = ph * 2.05;
      const i0 = clamp(Math.floor(((pk.x - R * 1.2) - BX) * sx), 0, GW - 1);
      const i1 = clamp(Math.ceil(((pk.x + R * 1.2) - BX) * sx), 0, GW - 1);
      const j0 = clamp(Math.floor(((pk.y - R * 1.2) - BY) * sy), 0, GH - 1);
      const j1 = clamp(Math.ceil(((pk.y + R * 1.2) - BY) * sy), 0, GH - 1);
      const f0 = 1 / (ph * 0.52);
      const amp = pk.fire ? ph * 1.95 : pk.aman ? ph * 2.0 : ph * 1.85;
      for (let j = j0; j <= j1; j++) {
        const wz = BY + (j / (GH - 1)) * BH;
        for (let i = i0; i <= i1; i++) {
          const o = j * GW + i;
          if (RegionField[o] === 4) continue;
          const wx = BX + (i / (GW - 1)) * BW;
          const d = Math.hypot(wx - pk.x, wz - pk.y);
          if (d >= R) continue;
          const u = 1 - d / R;
          const r = ridged(wx * f0, wz * f0, 4);
          let addH = amp * Math.pow(sm(u), 1.35) * (0.72 + 0.36 * r);
          // 末日火山顶部的凹陷熔岩火山口！
          if (pk.fire && d < ph * 0.36) {
            const crater = smoothstep(ph * 0.36, 0, d);
            addH -= crater * ph * 0.42;
          }
          HField[o] = Math.max(HField[o], 4.0 + addH);
          MtnField[o] = Math.max(MtnField[o], clamp(addH / 32, 0, 1));
          if (pk.fire && d < ph * 0.95) RockField[o] = 2;
          else if (pk.aman || pk.snow) RockField[o] = 3;
        }
      }
    });
  }

  function sampleH(wx, wz, withEraSink = true) {
    if (!HField) return 3.2;
    const fx = clamp(((wx - BX) / BW) * (GW - 1), 0, GW - 1.001);
    const fz = clamp(((wz - BY) / BH) * (GH - 1), 0, GH - 1.001);
    const i0 = fx | 0, j0 = fz | 0, tx = fx - i0, tz = fz - j0;
    const o = j0 * GW + i0;
    const h00 = HField[o], h10 = HField[o + 1], h01 = HField[o + GW], h11 = HField[o + GW + 1];
    let h = (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
    if (withEraSink) {
      const reg = RegionField[o];
      if (reg === 1) h = lerp(h, -11.5, belSink);
      else if (reg === 2) h = lerp(h, -11.5, nuSink);
    }
    return h;
  }

  /* ==================== 高清手绘反照率贴图 + 疆域贴图 ==================== */
  function createAlbedoCanvas() {
    const TW = 2320, TH = 900;
    const cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    const g = cv.getContext("2d");

    // 塞尔达旷野之息 / 王国之泪风手绘配色（温润柔和、层次分明，不过曝）
    const PAL = {
      sea: "#185d8e", land: "#679c44", bel: "#5c904a", nu: "#6fa24e", aman: "#92b872",
      coast: "#6a583a", snow: "#d8e6f0", ash: "#554c50", lava: "#382426", sand: "#c8ac64",
      dry: "#9c9c50", dirt: "#9d8256", forest: "#346a38", goldForest: "#cca034",
      river: "#2d8ebc", lake: "#247eb0", road: "#c4ad76"
    };

    const sx = TW / BW, sy = TH / BH;
    const polyPath = (pts) => drawSmoothPoly(g, pts, sx, sy, BX, BY);

    g.fillStyle = PAL.sea;
    g.fillRect(0, 0, TW, TH);

    const drawContinent = (pts, baseCol, clipFn) => {
      g.save();
      polyPath(pts);
      g.fillStyle = baseCol;
      g.fill();
      g.clip();
      // 柔和海拉鲁手绘水彩晕染（清新明快草地明暗过渡）
      let sd = 17;
      const rn = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
      for (let i = 0; i < 160; i++) {
        const x = rn() * TW, y = rn() * TH, r = 55 + rn() * 140;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        const warm = rn() > 0.45;
        rg.addColorStop(0, warm ? "rgba(218,242,126,0.14)" : "rgba(44,108,74,0.10)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (clipFn) clipFn();
      g.restore();
      // 暖白沙滩浅缘 + 柔和海岸线
      g.save();
      polyPath(pts);
      g.strokeStyle = "rgba(246,232,188,0.68)";
      g.lineWidth = 7.0;
      g.stroke();
      g.strokeStyle = "rgba(116,96,64,0.62)";
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
    };

    const BIOMES = [
      { t: "snow", clip: "me", pts: [[40, -140], [1040, -140], [1040, 30], [930, 46], [820, 40], [700, 58], [600, 44], [500, 60], [420, 40], [320, 62], [220, 70], [120, 58], [40, 64]] },
      { t: "snow", clip: "bel", pts: [[-720, -140], [260, -140], [260, -76], [60, -70], [-120, -64], [-400, -72], [-720, -60]] },
      { t: "ash", clip: "bel", pts: [[-360, -140], [-170, -140], [-160, -40], [-230, -20], [-330, -26], [-370, -60]] },
      { t: "lava", clip: "me", pts: [[728, 506], [800, 492], [870, 470], [936, 492], [944, 560], [930, 640], [860, 652], [780, 640], [738, 618], [728, 562]] },
      { t: "ash", clip: "me", pts: [[700, 470], [740, 466], [780, 470], [790, 494], [740, 506], [704, 498]] },
      { t: "sand", clip: "me", pts: [[580, 668], [700, 660], [820, 648], [1040, 630], [1040, 820], [540, 820], [560, 740]] },
      { t: "dry", clip: "me", pts: [[900, 300], [1040, 290], [1040, 480], [960, 480], [910, 440]] },
      { t: "dry", clip: "me", pts: [[636, 388], [700, 384], [716, 420], [690, 440], [640, 430]] },
      { t: "dirt", clip: "me", pts: [[440, 380], [500, 384], [508, 430], [470, 446], [436, 420]] },
      { t: "dry", clip: "me", pts: [[440, 60], [560, 70], [600, 110], [520, 130], [430, 110]] }
    ];
    const paintBiomes = (clipKey) => {
      BIOMES.filter((b) => b.clip === clipKey).forEach((b) => {
        g.save();
        g.filter = "blur(10px)";
        polyPath(b.pts);
        g.fillStyle = PAL[b.t] || PAL.dry;
        g.globalAlpha = b.t === "lava" ? 0.92 : 0.78;
        g.fill();
        g.restore();
      });
      // 沼泽暗湿斑块
      (DECO.MARSH || []).filter((m) => (clipKey === "bel" ? m.fa : !m.fa)).forEach((m) => {
        g.save(); g.filter = "blur(4px)";
        polyPath(m.pts);
        g.fillStyle = m.dead ? "rgba(44,54,36,0.75)" : "rgba(58,80,52,0.55)";
        g.fill(); g.restore();
      });
      // 夏尔翠绿田园光晕 + 霍比特金色麦田/绿圃拼布农田
      if (clipKey === "me") {
        const rg = g.createRadialGradient((314 - BX) * sx, (254 - BY) * sy, 10, (314 - BX) * sx, (254 - BY) * sy, 86);
        rg.addColorStop(0, "rgba(116,174,64,0.62)"); rg.addColorStop(0.65, "rgba(148,186,74,0.28)"); rg.addColorStop(1, "rgba(116,174,64,0)");
        g.fillStyle = rg; g.fillRect(0, 0, TW, TH);
        const F = DECO.FIELDS;
        if (F) {
          let fs = 5;
          const fr = () => ((fs = (fs * 16807) % 2147483647) - 1) / 2147483646;
          const fcols = ["rgba(196,192,76,0.68)", "rgba(112,158,64,0.66)", "rgba(218,182,88,0.64)", "rgba(92,140,56,0.62)"];
          for (let i = 0; i < F.n; i++) {
            const a = fr() * 6.283, r = Math.sqrt(fr());
            const fx = (F.cx + Math.cos(a) * r * F.rx - BX) * sx, fy = (F.cy + Math.sin(a) * r * F.ry - BY) * sy;
            const fw = (2.8 + fr() * 3.4) * sx, fh = (2.0 + fr() * 2.5) * sy;
            g.save(); g.translate(fx, fy); g.rotate((fr() - 0.5) * 0.85);
            g.fillStyle = fcols[i % fcols.length];
            g.fillRect(-fw / 2, -fh / 2, fw, fh);
            g.strokeStyle = "rgba(62,92,38,0.42)";
            g.lineWidth = 0.7;
            g.strokeRect(-fw / 2, -fh / 2, fw, fh);
            g.restore();
          }
        }
        // 洛汗金绿草原 + 刚铎河谷丰饶绿地
        const rr = g.createRadialGradient((575 - BX) * sx, (485 - BY) * sy, 10, (575 - BX) * sx, (485 - BY) * sy, 105);
        rr.addColorStop(0, "rgba(184,172,78,0.38)"); rr.addColorStop(1, "rgba(184,172,78,0)");
        g.fillStyle = rr; g.fillRect(0, 0, TW, TH);
        const gn = g.createRadialGradient((645 - BX) * sx, (595 - BY) * sy, 8, (645 - BX) * sx, (595 - BY) * sy, 85);
        gn.addColorStop(0, "rgba(116,154,84,0.34)"); gn.addColorStop(1, "rgba(116,154,84,0)");
        g.fillStyle = gn; g.fillRect(0, 0, TW, TH);
      }
    };

    drawContinent(W.land.aman, PAL.aman);
    drawContinent(W.land.eressea, PAL.aman);
    drawContinent(numenorStar(), PAL.nu);
    drawContinent(W.land.beleriand, PAL.bel, () => paintBiomes("bel"));
    drawContinent(W.land.balar, PAL.bel);
    drawContinent(W.land.ice, "#d2dfe8");
    drawContinent(W.land.me, PAL.land, () => paintBiomes("me"));

    // 森林地表阴影底色（衬托 3D 树木立牌）
    W.forests.forEach((f) => {
      g.save();
      g.filter = "blur(6px)";
      polyPath(f.pts);
      g.fillStyle = f.gold ? PAL.goldForest : PAL.forest;
      g.globalAlpha = f.gold ? 0.65 : 0.72;
      g.fill();
      g.restore();
    });

    // 湖泊
    W.lakes.forEach((lk) => {
      g.save();
      polyPath(lk.pts);
      g.fillStyle = PAL.lake;
      g.fill();
      g.strokeStyle = "rgba(220,236,244,0.45)";
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
    });

    // 河流（从源头渐宽到入海口 + 柔和水岸亮边）
    g.lineCap = "round"; g.lineJoin = "round";
    W.rivers.forEach((rv) => {
      const sp = densePoly(rv.pts, false, 4);
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const a = Math.floor((i * (sp.length - 1)) / segs);
        const b = Math.floor(((i + 1) * (sp.length - 1)) / segs);
        if (b <= a) continue;
        const w = rv.w * (0.48 + 0.75 * ((i + 1) / segs));
        g.beginPath();
        for (let k = a; k <= b; k++) {
          const x = (sp[k][0] - BX) * sx, y = (sp[k][1] - BY) * sy;
          if (k === a) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = "rgba(38,54,48,0.35)"; g.lineWidth = w + 2.2; g.stroke();
        g.strokeStyle = PAL.river; g.lineWidth = w; g.stroke();
        g.strokeStyle = "rgba(186,226,244,0.42)"; g.lineWidth = Math.max(0.6, w * 0.35); g.stroke();
      }
    });

    // 道路
    (DECO.ROADS || []).forEach((rd) => {
      const sp = densePoly(rd.pts, false, 4);
      g.save();
      g.beginPath();
      sp.forEach((p, i) => {
        const x = (p[0] - BX) * sx, y = (p[1] - BY) * sy;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.strokeStyle = "rgba(42,30,16,0.34)"; g.lineWidth = 3.2; g.stroke();
      g.strokeStyle = PAL.road; g.lineWidth = 1.6; g.setLineDash([5, 3]); g.stroke();
      g.restore();
    });

    // 末日火山熔岩裂谷细节
    {
      const cx = (790 - BX) * sx, cy = (566 - BY) * sy;
      const rg = g.createRadialGradient(cx, cy, 2, cx, cy, 48);
      rg.addColorStop(0, "rgba(255,112,24,0.95)");
      rg.addColorStop(0.28, "rgba(210,64,18,0.55)");
      rg.addColorStop(0.65, "rgba(72,22,12,0.28)");
      rg.addColorStop(1, "rgba(40,12,8,0)");
      g.fillStyle = rg;
      g.fillRect(cx - 52, cy - 52, 104, 104);
    }

    return cv;
  }

  /* ==================== 3D 森林树木精灵图集（塞尔达 / 吉卜力赛璐珞清新笔触，4 种树型） ==================== */
  function createTreeAtlasCanvas() {
    const cv = document.createElement("canvas");
    cv.width = 512; cv.height = 128;
    const g = cv.getContext("2d");

    // 赛璐珞清新树叶簇：暖阳嫩绿高光 + 翠绿中调 + 清冷青蓝暗部（绝不脏灰）
    const leafDab = (cx, cy, r, cols, seed0) => {
      let s = seed0;
      const rn = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      for (let i = 0; i < 20; i++) {
        const a = rn() * 6.283, d = Math.sqrt(rn()) * r * 0.76;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.82;
        const rr = r * (0.30 + rn() * 0.34);
        const shade = (x - cx) * 0.45 + (y - cy) * 0.72;
        const col = shade < -r * 0.12 ? cols[2] : shade > r * 0.16 ? cols[0] : cols[1];
        g.fillStyle = col;
        g.beginPath(); g.ellipse(x, y, rr, rr * (0.74 + rn() * 0.24), rn() * 3.14, 0, 6.29); g.fill();
      }
    };

    // 0: 海拉鲁翠绿针叶松（黑森林 / 北境）
    const drawPine = (ox) => {
      const sh = g.createRadialGradient(ox + 66, 118, 2, ox + 66, 118, 28);
      sh.addColorStop(0, "rgba(24,52,74,0.34)"); sh.addColorStop(1, "rgba(24,52,74,0)");
      g.fillStyle = sh; g.fillRect(ox + 32, 106, 68, 22);
      g.fillStyle = "#6c4c34"; g.fillRect(ox + 60, 92, 8, 26);
      const tiers = [[102, 36, 40], [80, 30, 36], [60, 23, 32], [42, 15, 26]];
      tiers.forEach(([by, hw, h], ti) => {
        g.fillStyle = ti < 2 ? "#215a4a" : "#2a6e54";
        g.beginPath(); g.moveTo(ox + 64, by - h); g.lineTo(ox + 64 + hw, by); g.quadraticCurveTo(ox + 64, by + 4, ox + 64 - hw, by); g.closePath(); g.fill();
        g.fillStyle = ti < 2 ? "#429258" : "#62b462";
        g.beginPath(); g.moveTo(ox + 64, by - h); g.lineTo(ox + 64 + hw * 0.1, by + 1); g.lineTo(ox + 64 - hw * 0.9, by - 1); g.closePath(); g.fill();
        leafDab(ox + 64 - hw * 0.22, by - h * 0.36, hw * 0.44, ["#22584a", "#3d8652", "#7cc864"], 101 + ti * 37);
      });
    };
    // 1: 旷野苍翠古橡树（范贡 / 多瑞亚斯 / 老林）
    const drawOak = (ox) => {
      const sh = g.createRadialGradient(ox + 66, 118, 2, ox + 66, 118, 32);
      sh.addColorStop(0, "rgba(24,52,74,0.34)"); sh.addColorStop(1, "rgba(24,52,74,0)");
      g.fillStyle = sh; g.fillRect(ox + 28, 106, 76, 22);
      g.fillStyle = "#76543a";
      g.beginPath(); g.moveTo(ox + 57, 118); g.quadraticCurveTo(ox + 61, 96, ox + 60, 72); g.lineTo(ox + 68, 72); g.quadraticCurveTo(ox + 67, 96, ox + 73, 118); g.fill();
      const oakCols = ["#245b48", "#448c4c", "#7bc04e"];
      leafDab(ox + 45, 72, 23, oakCols, 211);
      leafDab(ox + 83, 73, 22, oakCols, 241);
      leafDab(ox + 64, 54, 28, oakCols, 271);
      leafDab(ox + 54, 42, 19, ["#387e4a", "#64ac52", "#a6d866"], 307);
    };
    // 2: 金辉梅隆树（罗斯洛立安 · 塞尔达空岛秋金树冠！）
    const drawMallorn = (ox) => {
      const sh = g.createRadialGradient(ox + 66, 118, 2, ox + 66, 118, 34);
      sh.addColorStop(0, "rgba(62,48,26,0.28)"); sh.addColorStop(1, "rgba(62,48,26,0)");
      g.fillStyle = sh; g.fillRect(ox + 28, 106, 76, 22);
      g.fillStyle = "#dcd8ca";
      g.beginPath(); g.moveTo(ox + 58, 118); g.quadraticCurveTo(ox + 61, 90, ox + 61, 62); g.lineTo(ox + 67, 62); g.quadraticCurveTo(ox + 67, 90, ox + 71, 118); g.fill();
      const goldCols = ["#c47c24", "#f0b636", "#fff08c"];
      leafDab(ox + 42, 66, 22, goldCols, 401);
      leafDab(ox + 86, 67, 22, goldCols, 431);
      leafDab(ox + 64, 48, 29, goldCols, 461);
      leafDab(ox + 56, 36, 18, ["#e4a430", "#ffda62", "#fff9be"], 491);
    };
    // 3: 鲜明嫩绿林丛（伊希利恩 / 夏尔 / 切特林）
    const drawBush = (ox) => {
      const sh = g.createRadialGradient(ox + 66, 118, 2, ox + 66, 118, 30);
      sh.addColorStop(0, "rgba(24,52,74,0.30)"); sh.addColorStop(1, "rgba(24,52,74,0)");
      g.fillStyle = sh; g.fillRect(ox + 32, 106, 68, 22);
      g.fillStyle = "#7c583c"; g.fillRect(ox + 60, 86, 8, 32);
      const bushCols = ["#2a684c", "#509c4e", "#84c452"];
      leafDab(ox + 48, 76, 19, bushCols, 521);
      leafDab(ox + 80, 77, 19, bushCols, 557);
      leafDab(ox + 64, 58, 25, bushCols, 587);
      leafDab(ox + 56, 48, 17, ["#428e4c", "#74b854", "#aedc68"], 617);
    };
    drawPine(0); drawOak(128); drawMallorn(256); drawBush(384);
    return cv;
  }

  /* ==================== 3D 飘云与柔光粒子贴图 ==================== */
  function createSoftSpriteCanvas() {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 128;
    const g = cv.getContext("2d");
    // 左半: 柔雾飘云
    [[64, 66, 44, 28], [40, 72, 28, 20], [90, 72, 30, 20], [64, 52, 32, 22]].forEach(([x, y, rx, ry]) => {
      const rg = g.createRadialGradient(x, y, 2, x, y, rx);
      rg.addColorStop(0, "rgba(255,252,244,0.42)");
      rg.addColorStop(0.6, "rgba(244,240,230,0.18)");
      rg.addColorStop(1, "rgba(244,240,230,0)");
      g.save(); g.translate(x, y); g.scale(1, ry / rx);
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rx, 0, 6.29); g.fill();
      g.restore();
    });
    // 右半: 圆形辉光粒子（余烬 / 双圣树光）
    const rg2 = g.createRadialGradient(192, 64, 2, 192, 64, 56);
    rg2.addColorStop(0, "rgba(255,255,255,1)");
    rg2.addColorStop(0.28, "rgba(255,232,168,0.75)");
    rg2.addColorStop(0.65, "rgba(255,148,52,0.22)");
    rg2.addColorStop(1, "rgba(255,100,20,0)");
    g.fillStyle = rg2;
    g.fillRect(128, 0, 128, 128);
    return cv;
  }

  /* ==================== 塞尔达旷野之息 / 王国之泪风 · 分纪元大气与光照（均衡曝光不过曝） ==================== */
  const ERA_ATMOS = {
    trees: {
      skyTop: [0.18, 0.42, 0.70], skyHor: [0.76, 0.83, 0.82], fog: [0.72, 0.80, 0.79],
      sunDir: [-0.70, 0.56, -0.42], sunCol: [0.94, 0.89, 0.76], ambCol: [0.36, 0.47, 0.62],
      waterDeep: [0.07, 0.31, 0.56], waterShal: [0.15, 0.62, 0.68], mordorGlow: 0.08
    },
    fa: {
      skyTop: [0.16, 0.38, 0.68], skyHor: [0.68, 0.79, 0.87], fog: [0.64, 0.76, 0.84],
      sunDir: [-0.58, 0.62, -0.52], sunCol: [0.91, 0.90, 0.85], ambCol: [0.35, 0.46, 0.64],
      waterDeep: [0.06, 0.28, 0.54], waterShal: [0.14, 0.58, 0.66], mordorGlow: 0.16
    },
    sa: {
      skyTop: [0.14, 0.42, 0.72], skyHor: [0.72, 0.82, 0.86], fog: [0.68, 0.79, 0.84],
      sunDir: [-0.62, 0.64, -0.45], sunCol: [0.95, 0.89, 0.78], ambCol: [0.36, 0.48, 0.66],
      waterDeep: [0.07, 0.31, 0.58], waterShal: [0.14, 0.64, 0.70], mordorGlow: 0.35
    },
    ta: {
      // 海拉鲁温润午后：清朗蔚蓝天穹 + 柔和空气透视 + 暖金日光 + 通透晴蓝阴影
      skyTop: [0.15, 0.42, 0.72], skyHor: [0.70, 0.81, 0.85], fog: [0.66, 0.78, 0.83],
      sunDir: [-0.60, 0.62, -0.50], sunCol: [0.94, 0.88, 0.76], ambCol: [0.36, 0.47, 0.64],
      waterDeep: [0.07, 0.30, 0.56], waterShal: [0.14, 0.61, 0.67], mordorGlow: 0.52
    },
    hobbit: {
      skyTop: [0.16, 0.40, 0.68], skyHor: [0.72, 0.79, 0.80], fog: [0.68, 0.76, 0.78],
      sunDir: [-0.62, 0.58, -0.50], sunCol: [0.95, 0.86, 0.72], ambCol: [0.36, 0.45, 0.62],
      waterDeep: [0.07, 0.29, 0.54], waterShal: [0.14, 0.58, 0.65], mordorGlow: 0.68
    },
    war: {
      // 塞尔达黄昏/灾厄风：青紫天顶 + 暖金霞光雾 + 死亡火山赤橙火光 + 通透冷蓝暗部
      skyTop: [0.18, 0.30, 0.52], skyHor: [0.74, 0.68, 0.63], fog: [0.66, 0.66, 0.68],
      sunDir: [-0.66, 0.54, -0.52], sunCol: [0.96, 0.82, 0.67], ambCol: [0.35, 0.42, 0.58],
      waterDeep: [0.06, 0.25, 0.48], waterShal: [0.14, 0.54, 0.62], mordorGlow: 1.20
    },
    fo: {
      skyTop: [0.18, 0.46, 0.76], skyHor: [0.74, 0.84, 0.88], fog: [0.70, 0.81, 0.86],
      sunDir: [-0.56, 0.66, -0.48], sunCol: [0.94, 0.90, 0.80], ambCol: [0.38, 0.49, 0.66],
      waterDeep: [0.07, 0.33, 0.60], waterShal: [0.16, 0.64, 0.70], mordorGlow: 0.05
    }
  };
  function curAtmos() {
    const era = M.eraOf(M.T);
    const id = (era && era.id) || "ta";
    return ERA_ATMOS[id] || ERA_ATMOS.ta;
  }

  /* ==================== WebGL 着色器源码 ==================== */
  const VS_SKY = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.9999, 1.0); }
  `;
  const FS_SKY = `
    precision mediump float;
    varying vec2 vUv;
    uniform vec3 uSkyTop;
    uniform vec3 uSkyHor;
    uniform float uPitch;
    void main() {
      float h = clamp((vUv.y - 0.15) / 0.85, 0.0, 1.0);
      vec3 col = mix(uSkyHor, uSkyTop, pow(h, 0.78));
      float glow = smoothstep(0.55, 0.0, abs(vUv.y - 0.28)) * 0.12;
      col += vec3(1.0, 0.92, 0.76) * glow;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const VS_TERRAIN = `
    precision highp float;
    attribute vec3 aPos;
    attribute vec3 aNorm;
    attribute vec4 aInfo; // x: regionId(0..4), y: rockKind(0..3), z: mtnAmt(0..1), w: lakeMask
    uniform mat4 uMvp;
    uniform vec3 uEye;
    uniform float uBelSink;
    uniform float uNuSink;
    varying vec3 vWorld;
    varying vec3 vNorm;
    varying vec4 vInfo;
    varying vec2 vUv;
    varying float vCamDist;
    void main() {
      vec3 pos = aPos;
      float reg = aInfo.x;
      if (reg > 0.5 && reg < 1.5) pos.y = mix(pos.y, -11.5, uBelSink);
      else if (reg > 1.5 && reg < 2.5) pos.y = mix(pos.y, -11.5, uNuSink);
      vWorld = pos;
      vNorm = aNorm;
      vInfo = aInfo;
      vUv = vec2((aPos.x - ${BX.toFixed(1)}) / ${BW.toFixed(1)}, (aPos.z - ${BY.toFixed(1)}) / ${BH.toFixed(1)});
      vCamDist = length(uEye - pos);
      gl_Position = uMvp * vec4(pos, 1.0);
    }
  `;
  const FS_TERRAIN = `
    precision highp float;
    varying vec3 vWorld;
    varying vec3 vNorm;
    varying vec4 vInfo;
    varying vec2 vUv;
    varying float vCamDist;
    uniform sampler2D uAlbedo;
    uniform sampler2D uRealm;
    uniform sampler2D uElevTex;
    uniform vec3 uSunDir;
    uniform vec3 uSunCol;
    uniform vec3 uAmbCol;
    uniform vec3 uFogCol;
    uniform float uFogStart;
    uniform float uFogEnd;
    uniform float uTime;
    uniform float uBelSink;
    uniform float uNuSink;
    uniform float uMordorGlow;
    uniform float uAmanVeil;
    uniform vec3 uEye;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float sampleElev(vec2 xz) {
      vec2 uv = vec2((xz.x - ${BX.toFixed(1)}) / ${BW.toFixed(1)}, (xz.y - ${BY.toFixed(1)}) / ${BH.toFixed(1)});
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
      vec4 e = texture2D(uElevTex, uv);
      return max(e.r, max(e.g * (1.0 - uBelSink), e.b * (1.0 - uNuSink))) * 74.0;
    }

    void main() {
      vec3 N = normalize(vNorm);
      vec3 V = normalize(uEye - vWorld);
      vec3 L = normalize(uSunDir);
      vec3 base = texture2D(uAlbedo, vUv).rgb;
      vec4 rm = texture2D(uRealm, vUv);
      base = mix(base, rm.rgb, rm.a * 0.36);

      float h = vWorld.y;
      float slope = clamp(1.0 - N.y, 0.0, 1.0);
      float rockKind = vInfo.y;
      float mtnAmt = vInfo.z;
      float detail = vnoise(vWorld.xz * 0.18) * 0.55 + vnoise(vWorld.xz * 0.48) * 0.30 + vnoise(vWorld.xz * 1.15) * 0.15;

      // 山坡与峭壁微法线雕刻（让 3D 山体呈现手绘岩石棱角质感）
      if (slope > 0.14 || mtnAmt > 0.08) {
        float d1 = vnoise(vWorld.xz * 0.36 + vec2(0.8, 0.0)) - vnoise(vWorld.xz * 0.36 - vec2(0.8, 0.0));
        float d2 = vnoise(vWorld.xz * 0.36 + vec2(0.0, 0.8)) - vnoise(vWorld.xz * 0.36 - vec2(0.0, 0.8));
        float crag = clamp(slope * 0.52 + mtnAmt * 0.35, 0.0, 0.55);
        N = normalize(N + vec3(d1, 0.0, d2) * crag);
      }

      // 塞尔达式暖砂岩 / 双子山岩壁层理
      vec3 rockCol = vec3(0.62, 0.54, 0.44);
      if (rockKind > 0.5 && rockKind < 1.5) rockCol = vec3(0.28, 0.22, 0.26);      // 魔多/安格班暗紫黑曜岩
      else if (rockKind > 1.5 && rockKind < 2.5) rockCol = vec3(0.38, 0.21, 0.18); // 死亡火山/末日火山赤岩
      else if (rockKind > 2.5) rockCol = vec3(0.70, 0.76, 0.84);                   // 海布拉冰雪岩壁

      float rockMix = clamp(smoothstep(0.18, 0.48, slope) * 0.90 + mtnAmt * 0.52, 0.0, 1.0);
      // 塞尔达标志性阶梯岩层纹理
      float terrace = 0.88 + 0.16 * smoothstep(-0.3, 0.4, sin(h * 1.45 + detail * 2.2));
      rockCol *= (0.86 + 0.24 * detail) * terrace;

      // 海拉鲁清新草地风浪光泽 + 柔和手绘色块（微风吹拂的青翠草浪）
      float meadow = vnoise(vWorld.xz * 0.04) * 0.6 + vnoise(vWorld.xz * 0.12) * 0.4;
      float windWave = smoothstep(0.38, 0.94, sin(vWorld.x * 0.065 + vWorld.z * 0.035 - uTime * 1.65 + meadow * 3.0) * 0.5 + 0.5);
      vec3 paintedBase = base * (0.91 + 0.14 * meadow) + vec3(0.024, 0.034, 0.008) * windWave * (1.0 - rockMix) * smoothstep(2.0, 6.0, h);
      vec3 col = mix(paintedBase, rockCol, rockMix);

      // 海岸暖砂岩悬崖层理
      if (h > -0.8 && h < 4.6 && slope > 0.22 && mtnAmt < 0.15) {
        float strata = 0.86 + 0.22 * smoothstep(-0.2, 0.3, sin(h * 4.2 + detail * 1.8));
        col = mix(col, vec3(0.70, 0.58, 0.42) * strata, smoothstep(0.22, 0.52, slope) * 0.76);
      }

      // 高海拔冰雪峰顶（带塞尔达冷青雪影过渡，柔和不刺眼）
      if (rockKind < 0.5 || rockKind > 2.5) {
        float snowLine = rockKind > 2.5 ? 11.0 : 17.5;
        float snow = smoothstep(snowLine, snowLine + 9.0, h + (detail - 0.5) * 3.8) * smoothstep(0.74, 0.24, slope);
        col = mix(col, vec3(0.84, 0.89, 0.94), snow * 0.92);
      }

      // 6 步高度场光线步进软阴影 + 漂浮流动的塞尔达云影！
      float sunVis = 1.0;
      if (h > 0.2 && dot(N, L) > 0.0) {
        vec2 sDir = L.xz / max(0.25, L.y);
        float sh = 0.0;
        for (int s = 1; s <= 6; s++) {
          float dist = float(s) * (5.5 + float(s) * 2.1);
          float rayH = h + dist * 0.88 + 0.8;
          float occ = sampleElev(vWorld.xz + sDir * dist * 0.88) - rayH;
          sh = max(sh, clamp(occ / (6.5 + dist * 0.14), 0.0, 1.0));
        }
        sunVis = 1.0 - sh * 0.54;
      }
      // 飘动云影（让广袤的绿色海拉鲁/中洲平原呼吸起来！）
      float cloudSh = smoothstep(0.56, 0.76, vnoise(vWorld.xz * 0.0065 - vec2(uTime * 0.032, uTime * 0.014)));
      sunVis *= (1.0 - cloudSh * 0.24);

      // 塞尔达三阶柔和赛璐珞阶梯光照：晴朗暖金亮部 + 通透青蓝暗部 + 柔和轮廓光
      float ndl = max(dot(N, L), 0.0);
      float band1 = smoothstep(0.10, 0.26, ndl);
      float band2 = smoothstep(0.52, 0.70, ndl);
      float cel = (0.12 + 0.52 * band1 + 0.36 * band2) * sunVis;
      float hemi = N.y * 0.5 + 0.5;
      float ao = clamp(0.74 + 0.24 * smoothstep(0.8, 12.0, h) + 0.10 * N.y, 0.66, 1.02);
      vec3 shadowTint = uAmbCol * mix(vec3(0.72, 0.84, 1.08), vec3(0.92, 0.98, 1.08), hemi);
      vec3 lit = col * (shadowTint * (1.0 - cel * 0.42) + uSunCol * cel * 0.82) * ao;

      // 标志性塞尔达暖金轮廓逆光（柔和克制，避免雪山过曝）
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.8) * smoothstep(2.0, 22.0, h) * (0.40 + 0.60 * sunVis);
      lit += mix(uSunCol, vec3(0.98, 0.94, 0.82), 0.45) * rim * 0.18;

      // 柔和高光压缩（防止强光与雪顶溢出刺眼）
      lit = lit / (vec3(1.0) + max(lit - vec3(0.78), vec3(0.0)) * 0.75);

      // 末日火山（Orodruin 790,566）动态熔岩火光与火山口发光
      float dDoom = length(vWorld.xz - vec2(790.0, 566.0));
      float pulse = 0.86 + 0.14 * sin(uTime * 2.6 + dDoom * 0.15);
      if (dDoom < 130.0) {
        float crater = smoothstep(16.0, 2.5, dDoom) * smoothstep(20.0, 34.0, h);
        float lavaCrack = smoothstep(38.0, 8.0, dDoom) * smoothstep(0.56, 0.82, detail) * 0.55;
        float glowRange = smoothstep(125.0, 12.0, dDoom) * uMordorGlow * 0.42;
        lit += vec3(1.4, 0.42, 0.08) * (crater * 1.45 + lavaCrack * 0.75) * pulse * max(0.35, uMordorGlow);
        lit += vec3(0.95, 0.26, 0.06) * glowRange * pulse * (0.4 + 0.6 * max(0.0, dot(N, normalize(vec3(790.0, 55.0, 566.0) - vWorld))));
      }

      // 水下海底微染海蓝色（透过浅水可见陆架）
      if (h < 0.0) {
        lit = mix(lit, vec3(0.06, 0.18, 0.26), smoothstep(0.0, -7.5, h));
      }

      // 阿门洲移出世界之圈后的圣洁薄雾
      if (vInfo.x > 2.5 && vInfo.x < 3.5 && uAmanVeil > 0.01) {
        lit = mix(lit, vec3(0.84, 0.88, 0.92), uAmanVeil * 0.56);
      }

      // 远景大气雾（HD-2D 纵深感灵魂）
      float fogF = smoothstep(uFogStart, uFogEnd, vCamDist);
      lit = mix(lit, uFogCol, fogF * 0.88);
      gl_FragColor = vec4(lit, 1.0);
    }
  `;

  const VS_WATER = `
    precision highp float;
    attribute vec3 aPos;
    uniform mat4 uMvp;
    varying vec3 vWorld;
    void main() {
      vWorld = aPos;
      gl_Position = uMvp * vec4(aPos, 1.0);
    }
  `;
  const FS_WATER = `
    precision highp float;
    varying vec3 vWorld;
    uniform sampler2D uHeightTex;
    uniform vec3 uEye;
    uniform vec3 uSunDir;
    uniform vec3 uSunCol;
    uniform vec3 uFogCol;
    uniform vec3 uWaterDeep;
    uniform vec3 uWaterShal;
    uniform float uFogStart;
    uniform float uFogEnd;
    uniform float uTime;
    uniform float uBelSink;
    uniform float uNuSink;

    float wave(vec2 p, float t) {
      float w = sin(p.x * 0.13 + t * 1.15 + sin(p.y * 0.08 - t * 0.6)) * 0.5;
      w += sin(p.y * 0.16 - t * 0.95 + cos(p.x * 0.10 + t * 0.5)) * 0.35;
      w += sin((p.x + p.y) * 0.22 + t * 1.4) * 0.15;
      return w;
    }

    void main() {
      float camDist = length(uEye - vWorld);
      vec2 uv = vec2((vWorld.x - ${BX.toFixed(1)}) / ${BW.toFixed(1)}, (vWorld.z - ${BY.toFixed(1)}) / ${BH.toFixed(1)});
      float shore = 0.0;
      float isLake = 0.0;
      if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
        vec4 ht = texture2D(uHeightTex, uv);
        shore = max(ht.r, max(ht.g * (1.0 - uBelSink), ht.b * (1.0 - uNuSink)));
        isLake = ht.a;
      }

      // 动态波纹法线
      vec2 p = vWorld.xz;
      float e = 1.1;
      float w0 = wave(p, uTime);
      float wx = wave(p + vec2(e, 0.0), uTime) - w0;
      float wz = wave(p + vec2(0.0, e), uTime) - w0;
      vec3 N = normalize(vec3(-wx * 0.18, 1.0, -wz * 0.18));
      vec3 V = normalize(uEye - vWorld);
      vec3 L = normalize(uSunDir);
      vec3 H = normalize(L + V);

      // 塞尔达赛璐珞清澈海面：两阶碧蓝深浅过渡 + 清脆日光星点反光 + 卡通白色岸浪环
      float shallow = clamp(pow(shore, 1.05) + isLake * 0.62, 0.0, 1.0);
      float celDepth = mix(shallow, smoothstep(0.18, 0.55, shallow) * 0.5 + smoothstep(0.55, 0.85, shallow) * 0.5, 0.42);
      vec3 wCol = mix(uWaterDeep, uWaterShal, celDepth);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      wCol = mix(wCol, uFogCol * 0.98, fres * 0.36);
      // 塞尔达风清脆波光高光点（克制不刺眼）
      float spec = smoothstep(0.88, 0.96, pow(max(dot(N, H), 0.0), 34.0));
      wCol += vec3(0.96, 0.95, 0.88) * spec * 0.36;
      // 柔和的风格化海浪纹带
      wCol += vec3(0.035, 0.085, 0.10) * smoothstep(0.25, 0.75, w0 * 0.5 + 0.5);

      // 塞尔达风双层清脆白色拍岸浪环（随大陆沉没实时消散）
      if (isLake < 0.5 && shore > 0.38) {
        float foamWave = sin((1.0 - shore) * 34.0 - uTime * 2.6 + w0 * 1.8) * 0.5 + 0.5;
        float shoreLine = smoothstep(0.80, 0.94, shore);
        float outerRing = smoothstep(0.50, 0.82, shore) * smoothstep(0.68, 0.84, foamWave) * 0.58;
        float foam = clamp(shoreLine * 0.84 + outerRing, 0.0, 0.86);
        wCol = mix(wCol, vec3(0.90, 0.94, 0.96), foam);
      }

      float alpha = isLake > 0.5 ? 0.82 : clamp(0.86 + (1.0 - shallow) * 0.12, 0.0, 0.98);
      float fogF = smoothstep(uFogStart, uFogEnd, camDist);
      wCol = mix(wCol, uFogCol, fogF * 0.86);
      gl_FragColor = vec4(wCol, alpha);
    }
  `;

  const VS_TREES = `
    precision highp float;
    attribute vec3 aBase;   // x, y, z 树根世界坐标
    attribute vec2 aCorner; // (-0.5..0.5, 0..1)
    attribute vec4 aMeta;   // x: width, y: height, z: variant(0..3), w: region(0=ME,1=Bel) + seed*0.01
    uniform mat4 uMvp;
    uniform vec3 uCamRight;
    uniform vec3 uEye;
    uniform float uTime;
    uniform float uBelSink;
    varying vec2 vUv;
    varying float vCamDist;
    varying float vShade;
    void main() {
      vec3 base = aBase;
      float isBel = step(0.5, floor(aMeta.w));
      float sink = isBel * uBelSink;
      base.y = mix(base.y, -26.0, sink);
      float scH = max(0.0, 1.0 - sink * 1.15);
      float seed = fract(aMeta.w) * 100.0;
      float sway = sin(uTime * 1.45 + seed) * aCorner.y * 0.65;
      vec3 pos = base + uCamRight * (aCorner.x * aMeta.x * scH + sway) + vec3(0.0, aCorner.y * aMeta.y * scH, 0.0);
      float vIdx = aMeta.z;
      vUv = vec2((vIdx + (aCorner.x + 0.5)) * 0.25, 1.0 - aCorner.y);
      vCamDist = length(uEye - pos);
      vShade = 0.84 + 0.24 * aCorner.y + 0.08 * sin(seed);
      gl_Position = uMvp * vec4(pos, 1.0);
    }
  `;
  const FS_TREES = `
    precision highp float;
    varying vec2 vUv;
    varying float vCamDist;
    varying float vShade;
    uniform sampler2D uAtlas;
    uniform vec3 uSunCol;
    uniform vec3 uAmbCol;
    uniform vec3 uFogCol;
    uniform float uFogStart;
    uniform float uFogEnd;
    void main() {
      vec4 t = texture2D(uAtlas, vUv);
      if (t.a < 0.35) discard;
      vec3 celLight = uAmbCol * 0.50 + uSunCol * (0.48 + 0.22 * vShade);
      vec3 col = t.rgb * celLight;
      float fogF = smoothstep(uFogStart, uFogEnd, vCamDist);
      col = mix(col, uFogCol, fogF * 0.82);
      gl_FragColor = vec4(col, t.a);
    }
  `;

  const VS_TRAIL = `
    precision highp float;
    attribute vec3 aPos;
    attribute vec4 aCol;
    attribute float aDist;
    uniform mat4 uMvp;
    varying vec4 vCol;
    varying float vDist;
    void main() {
      vCol = aCol;
      vDist = aDist;
      gl_Position = uMvp * vec4(aPos, 1.0);
    }
  `;
  const FS_TRAIL = `
    precision mediump float;
    varying vec4 vCol;
    varying float vDist;
    uniform float uTime;
    void main() {
      float dash = smoothstep(0.16, 0.34, fract(vDist * 0.085 - uTime * 0.45));
      float a = vCol.a * (0.28 + 0.72 * dash);
      if (a < 0.05) discard;
      vec3 c = mix(vCol.rgb, vec3(1.0, 0.94, 0.78), 0.22 * dash);
      gl_FragColor = vec4(c, a);
    }
  `;

  const VS_FX = `
    precision highp float;
    attribute vec3 aPos;
    attribute vec2 aCorner;
    attribute vec4 aMeta; // x: size, y: kind(0=cloud,1=ember,2=glow), z: alpha, w: phase
    attribute vec3 aCol;
    uniform mat4 uMvp;
    uniform vec3 uCamRight;
    uniform vec3 uCamUp;
    uniform float uTime;
    uniform float uCloudAlpha;
    uniform float uEmberBoost;
    uniform float uTreesGlow;
    varying vec2 vUv;
    varying vec4 vCol;
    void main() {
      vec3 p = aPos;
      float kind = aMeta.y;
      float sz = aMeta.x;
      float al = aMeta.z;
      float ph = aMeta.w;
      vec3 pos;
      if (kind < 0.5) {
        // 飘动平铺云霭
        p.x = mod(p.x - ${BX.toFixed(1)} + uTime * (2.6 + fract(ph) * 2.4), ${BW.toFixed(1)}) + ${BX.toFixed(1)};
        pos = p + vec3(aCorner.x * sz * 2.1, 0.0, aCorner.y * sz * 1.15);
        al *= uCloudAlpha;
        vUv = vec2((aCorner.x + 0.5) * 0.5, aCorner.y + 0.5);
      } else if (kind < 1.5) {
        // 末日火山上升火星余烬
        float cycle = fract(uTime * 0.24 + ph);
        p.y += cycle * 44.0;
        p.x += sin(uTime * 1.6 + ph * 18.0) * (2.5 + cycle * 9.0);
        p.z += cos(uTime * 1.3 + ph * 14.0) * (2.5 + cycle * 9.0);
        al *= sin(cycle * 3.14159) * uEmberBoost;
        sz *= (1.0 - cycle * 0.55);
        pos = p + (uCamRight * aCorner.x + uCamUp * aCorner.y) * sz;
        vUv = vec2(0.5 + (aCorner.x + 0.5) * 0.5, aCorner.y + 0.5);
      } else if (kind < 2.5) {
        // 末日火山口柔和火光
        float pulse = 0.85 + 0.15 * sin(uTime * 2.2 + ph);
        pos = p + (uCamRight * aCorner.x + uCamUp * aCorner.y) * sz * pulse;
        vUv = vec2(0.5 + (aCorner.x + 0.5) * 0.5, aCorner.y + 0.5);
      } else {
        // 双圣树圣光（双树熄灭后随纪元黯淡消散）
        float pulse = 0.86 + 0.14 * sin(uTime * 1.9 + ph);
        al *= uTreesGlow;
        pos = p + (uCamRight * aCorner.x + uCamUp * aCorner.y) * sz * pulse;
        vUv = vec2(0.5 + (aCorner.x + 0.5) * 0.5, aCorner.y + 0.5);
      }
      vCol = vec4(aCol, al);
      gl_Position = uMvp * vec4(pos, 1.0);
    }
  `;
  const FS_FX = `
    precision mediump float;
    varying vec2 vUv;
    varying vec4 vCol;
    uniform sampler2D uTex;
    void main() {
      vec4 t = texture2D(uTex, vUv);
      float a = t.a * vCol.a;
      if (a < 0.01) discard;
      gl_FragColor = vec4(t.rgb * vCol.rgb, a);
    }
  `;

  /* ==================== WebGL 编译与缓冲区辅助 ==================== */
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function mkProg(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function mkTex(gl, src, clampEdge = true) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = clampEdge ? gl.CLAMP_TO_EDGE : gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return t;
  }

  /* ==================== 2.5D 引擎主状态 ==================== */
  const stageEl = document.getElementById("stage25d");
  const canvas = document.getElementById("gl25d");
  const bbLayer = document.getElementById("bb25d");
  const toggleBtn = document.getElementById("mode25dBtn");
  const compassEl = document.querySelector(".compass");
  if (!stageEl || !canvas || !bbLayer || !toggleBtn) return;

  let active = false, inited = false, rafId = 0;
  let gl = null, isWebGL2 = false;
  let progs = {}, bufs = {}, texs = {};
  let terrainIdxCount = 0, treeVertCount = 0, fxVertCount = 0, trailVertCount = 0;
  let realmCanvas = null, realmCtx = null, lastRealmKey = "";
  let viewW = 1, viewH = 1, dpr = 1;

  // 3D 轨道相机（平滑惯性阻尼）
  const c3 = {
    tx: 480, tz: 360, dist: 520, pitch: 42 * DEG, yaw: 0,
    tTx: 480, tTz: 360, tDist: 520, tPitch: 42 * DEG, tYaw: 0
  };
  let flyAnim = null;
  let lastFrameT = 0, elapsed = 0;
  let lastMvp = null, lastInvMvp = null;
  let bbNeedsSort = true, lastBbCamKey = "";

  // 立牌节点缓存
  const BB = { places: [], journeys: [], residents: [], moments: [], labels: [], landmarks: [], wonders: [], sea: [], beacons: [], ring: null };

  function distFromCamW(w) {
    const asp = Math.max(0.5, viewW / Math.max(1, viewH));
    return clamp(w / (2 * Math.tan(FOVY / 2) * asp), 130, 1900);
  }
  function camWFromDist(d) {
    const asp = Math.max(0.5, viewW / Math.max(1, viewH));
    return clamp(d * 2 * Math.tan(FOVY / 2) * asp, 180, BW);
  }

  /* ==================== 构建 WebGL 场景资产 ==================== */
  function buildTerrainBuffers() {
    const N = GW * GH;
    const verts = new Float32Array(N * 10); // pos3 + norm3 + info4
    const hTex = new Uint8Array(N * 4);
    const eTex = new Uint8Array(N * 4);     // R=中洲/阿门洲高度, G=贝烈瑞安德高度, B=努门诺尔高度
    const dx = BW / (GW - 1), dz = BH / (GH - 1);

    for (let j = 0; j < GH; j++) {
      const wz = BY + j * dz;
      for (let i = 0; i < GW; i++) {
        const wx = BX + i * dx;
        const o = j * GW + i;
        const h = HField[o];
        const hL = HField[j * GW + Math.max(0, i - 1)];
        const hR = HField[j * GW + Math.min(GW - 1, i + 1)];
        const hU = HField[Math.max(0, j - 1) * GW + i];
        const hD = HField[Math.min(GH - 1, j + 1) * GW + i];
        let nx = (hL - hR) / (2 * dx), ny = 1.0, nz = (hU - hD) / (2 * dz);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        const v = o * 10;
        verts[v + 0] = wx; verts[v + 1] = h; verts[v + 2] = wz;
        verts[v + 3] = nx; verts[v + 4] = ny; verts[v + 5] = nz;
        verts[v + 6] = RegionField[o];
        verts[v + 7] = RockField[o];
        verts[v + 8] = MtnField[o];
        verts[v + 9] = LakeField[o];

        const t = o * 4;
        // R=永久陆地近岸度, G=贝烈瑞安德近岸度, B=努门诺尔近岸度, A=湖泊掩膜
        hTex[t + 0] = clamp(Math.round(Math.exp(-ShorePerm[o] * 0.22) * 255), 0, 255);
        hTex[t + 1] = clamp(Math.round(Math.exp(-ShoreBel[o] * 0.22) * 255), 0, 255);
        hTex[t + 2] = clamp(Math.round(Math.exp(-ShoreNu[o] * 0.22) * 255), 0, 255);
        hTex[t + 3] = LakeField[o] ? 255 : 0;

        const reg = RegionField[o];
        const eh = clamp(Math.round((Math.max(0, h) / 74) * 255), 0, 255);
        eTex[t + 0] = (reg === 0 || reg === 3) ? eh : 0;
        eTex[t + 1] = reg === 1 ? eh : 0;
        eTex[t + 2] = reg === 2 ? eh : 0;
        eTex[t + 3] = 255;
      }
    }

    const idx = new Uint32Array((GW - 1) * (GH - 1) * 6);
    let p = 0;
    for (let j = 0; j < GH - 1; j++) {
      for (let i = 0; i < GW - 1; i++) {
        const a = j * GW + i, b = a + 1, c = a + GW, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }
    terrainIdxCount = idx.length;

    bufs.tVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.tVbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    bufs.tIbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.tIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    const mkDataTex = (data) => {
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return tx;
    };
    texs.height = mkDataTex(hTex);
    texs.elev = mkDataTex(eTex);
  }

  function buildWaterAndSkyBuffers() {
    bufs.skyVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.skyVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    // 延展到远方地平线的海面网格
    const x0 = BX - 1600, x1 = BX + BW + 1600, z0 = BY - 1400, z1 = BY + BH + 1400;
    bufs.waterVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.waterVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      x0, 0, z0, x0, 0, z1, x1, 0, z0,
      x1, 0, z0, x0, 0, z1, x1, 0, z1
    ]), gl.STATIC_DRAW);
  }

  function buildTreeBuffers() {
    const items = [];
    let sd = 733;
    const rn = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
    W.forests.forEach((f) => {
      const xs = f.pts.map((p) => p[0]), ys = f.pts.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const area = (x1 - x0) * (y1 - y0);
      const target = clamp(Math.round(area * f.d * 1.15), 14, 240);
      const variant = f.gold ? 2 : (f.id === "mirkwood" || f.id === "dorthonion") ? 0 : (f.id === "fangorn" || f.id === "doriath" || f.id === "oldforest") ? 1 : 3;
      let count = 0;
      for (let k = 0; k < target * 4 && count < target; k++) {
        const x = lerp(x0, x1, rn()), z = lerp(y0, y1, rn());
        if (!inPoly(x, z, f.pts)) continue;
        const h = sampleH(x, z, false);
        if (h < 1.2 || h > 21) continue;
        const sz = (f.gold ? 9.8 : variant === 0 ? 9.2 : 9.4) * (0.76 + rn() * 0.44);
        items.push([x, h - 0.85, z, sz * 0.94, sz * 1.05, variant, (f.fa ? 1 : 0) + rn() * 0.95]);
        count++;
      }
    });

    // 每棵树 2 个三角形 (6 顶点)，每顶点 9 float: base3 + corner2 + meta4
    const data = new Float32Array(items.length * 6 * 9);
    const quad = [[-0.5, 0], [0.5, 0], [-0.5, 1], [-0.5, 1], [0.5, 0], [0.5, 1]];
    let p = 0;
    for (let i = 0; i < items.length; i++) {
      const [x, y, z, w, h, v, m] = items[i];
      for (let q = 0; q < 6; q++) {
        data[p++] = x; data[p++] = y; data[p++] = z;
        data[p++] = quad[q][0]; data[p++] = quad[q][1];
        data[p++] = w; data[p++] = h; data[p++] = v; data[p++] = m;
      }
    }
    treeVertCount = items.length * 6;
    bufs.treeVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.treeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  function buildFxBuffers() {
    // 飘云 (34) + 末日火山火星余烬 (44) + 末日火山口常驻火光 (1) + 双圣树光晕 (2)
    const fx = [];
    let sd = 2026;
    const rn = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 38; i++) {
      fx.push({
        pos: [lerp(BX, BX + BW, rn()), lerp(60, 82, rn()), lerp(BY + 40, BY + BH - 40, rn())],
        sz: lerp(46, 98, rn()), kind: 0, alpha: lerp(0.36, 0.62, rn()), phase: rn(),
        col: [1.0, 0.99, 0.97]
      });
    }
    const doomH = sampleH(790, 566, false);
    for (let i = 0; i < 44; i++) {
      fx.push({
        pos: [790 + (rn() - 0.5) * 14, doomH + 2, 566 + (rn() - 0.5) * 14],
        sz: lerp(4.5, 10.5, rn()), kind: 1, alpha: lerp(0.55, 0.95, rn()), phase: rn(),
        col: [1.0, lerp(0.32, 0.72, rn()), 0.12]
      });
    }
    fx.push({ pos: [790, doomH + 6, 566], sz: 42, kind: 2, alpha: 0.65, phase: 0.2, col: [1.0, 0.45, 0.12] });
    const tt = D.PLACES.find((p) => p.id === "twotrees");
    if (tt) {
      const th = sampleH(tt.x, tt.y, false);
      fx.push({ pos: [tt.x - 10, th + 12, tt.y], sz: 62, kind: 3, alpha: 0.48, phase: 0.1, col: [0.84, 0.93, 1.0] });
      fx.push({ pos: [tt.x + 10, th + 12, tt.y], sz: 62, kind: 3, alpha: 0.48, phase: 1.7, col: [1.0, 0.86, 0.44] });
    }

    const quad = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]];
    const data = new Float32Array(fx.length * 6 * 12); // pos3 + corner2 + meta4 + col3
    let p = 0;
    fx.forEach((f) => {
      for (let q = 0; q < 6; q++) {
        data[p++] = f.pos[0]; data[p++] = f.pos[1]; data[p++] = f.pos[2];
        data[p++] = quad[q][0]; data[p++] = quad[q][1];
        data[p++] = f.sz; data[p++] = f.kind; data[p++] = f.alpha; data[p++] = f.phase;
        data[p++] = f.col[0]; data[p++] = f.col[1]; data[p++] = f.col[2];
      }
    });
    fxVertCount = fx.length * 6;
    bufs.fxVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.fxVbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  function hexToRgb01(hex) {
    const h = (hex || "#e2b444").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16) || 0xe2b444;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function rebuildRealmTex(t) {
    const key = D.REALMS.map((r) => (t >= r.from && t < r.to ? "1" : "0")).join("");
    if (key === lastRealmKey) return;
    lastRealmKey = key;
    if (!realmCanvas) {
      realmCanvas = document.createElement("canvas");
      realmCanvas.width = 580; realmCanvas.height = 225;
      realmCtx = realmCanvas.getContext("2d");
    }
    const g = realmCtx, cw0 = realmCanvas.width, ch0 = realmCanvas.height;
    const sx = cw0 / BW, sy = ch0 / BH;
    g.clearRect(0, 0, cw0, ch0);
    const COLS = { elf: [75, 132, 173], man: [178, 72, 58], dwarf: [154, 114, 58], dark: [42, 16, 12], rohan: [95, 148, 58] };
    D.REALMS.forEach((r) => {
      if (!(t >= r.from && t < r.to)) return;
      const c = COLS[r.c] || COLS.man;
      const cx = (r.x - BX) * sx, cy = (r.y - BY) * sy;
      const rr = Math.max(4, (r.r || 60) * sx);
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.55)`);
      rg.addColorStop(0.7, `rgba(${c[0]},${c[1]},${c[2]},0.22)`);
      rg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.fillStyle = rg;
      g.beginPath(); g.arc(cx, cy, rr, 0, 6.29); g.fill();
    });
    gl.bindTexture(gl.TEXTURE_2D, texs.realm);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, realmCanvas);
  }

  function rebuildTrails(t) {
    const verts = [];
    M.JR.forEach((j) => {
      const r = M.at(j.P, t);
      if (!r) return;
      const start = j.P[0].t, end = j.P[j.P.length - 1].t, dur = Math.max(0.02, end - start);
      const span = j.mig ? 30 : dur < 1 ? 0.14 : dur < 15 ? 4 : 35;
      if (t > end + span) return;
      const [cr, cg, cb] = hexToRgb01(j.c);
      const isDone = r.done && t > end + (j.army ? 0.2 : 0.01);
      const alpha = j.mig ? (isDone ? 0.22 : 0.42) : (isDone ? 0.42 : 0.92);
      const halfW = j.mig ? 3.2 : j.army ? 2.1 : 1.45;

      // 采样当前已走过折线并贴合 3D 地形高度
      const pts = [];
      pts.push([j.P[0].x, j.P[0].y, false]);
      for (let i = 1; i < j.P.length; i++) {
        const a = j.P[i - 1], b = j.P[i];
        if (t >= b.t) {
          pts.push([b.x, b.y, !!b.gap]);
        } else {
          const k = (t - a.t) / Math.max(1e-9, b.t - a.t);
          if (!b.gap) pts.push([lerp(a.x, b.x, k), lerp(a.y, b.y, k), false]);
          break;
        }
      }
      let distAcc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if (b[2]) continue; // gap 跳跃段不连线
        const segL = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (segL < 0.2) continue;
        const steps = Math.max(1, Math.ceil(segL / 9));
        const nx = -(b[1] - a[1]) / segL * halfW;
        const nz = (b[0] - a[0]) / segL * halfW;
        for (let s = 0; s < steps; s++) {
          const k0 = s / steps, k1 = (s + 1) / steps;
          const x0 = lerp(a[0], b[0], k0), z0 = lerp(a[1], b[1], k0);
          const x1 = lerp(a[0], b[0], k1), z1 = lerp(a[1], b[1], k1);
          const y0 = Math.max(0.8, sampleH(x0, z0, true)) + 2.2;
          const y1 = Math.max(0.8, sampleH(x1, z1, true)) + 2.2;
          const d0 = distAcc, d1 = distAcc + segL / steps;
          distAcc = d1;
          const pushV = (x, y, z, d) => { verts.push(x, y, z, cr, cg, cb, alpha, d); };
          pushV(x0 - nx, y0, z0 - nz, d0); pushV(x0 + nx, y0, z0 + nz, d0); pushV(x1 - nx, y1, z1 - nz, d1);
          pushV(x1 - nx, y1, z1 - nz, d1); pushV(x0 + nx, y0, z0 + nz, d0); pushV(x1 + nx, y1, z1 + nz, d1);
        }
      }
    });
    trailVertCount = verts.length / 8;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.trailVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
  }

  /* ==================== HD-2D 纸模立牌层构建 ==================== */
  function buildBillboards() {
    bbLayer.innerHTML = "";
    BB.places = []; BB.journeys = []; BB.residents = []; BB.moments = []; BB.labels = [];

    // 1. 地点城堡立牌（复用 ME_ICON 原画；双圣树使用专属金银双树微缩立牌；核心地标加大展示）
    const PEAK_ONLY = new Set(["orodruin"]);
    const HERO_PLACES = new Set([
      "twotrees", "hobbiton", "rivendell", "lorien", "minastirith", "baraddur",
      "isengard", "erebor", "edoras", "helmsdeep", "moria", "gondolin",
      "armenelos", "angband", "mithlond", "tirion"
    ]);
    const twoTreesSvg = () => `
      <g class="mdl">
        <ellipse cx="0" cy="4.6" rx="22" ry="6.2" fill="rgba(22,16,8,.42)"/>
        <path d="M-21,4.4 C-14,-4.5 14,-4.5 21,4.4 A21,5.6 0 0 1 -21,4.4 Z" fill="#4f9442" stroke="rgba(26,18,8,.5)" stroke-width=".35"/>
        <path d="M-14,3.4 C-8,-2 8,-2 14,3.4" fill="#6ab450" opacity=".65"/>
        <!-- 维尔玛远景金顶神殿 -->
        <rect x="-4.5" y="-5.5" width="9" height="4.8" rx=".8" fill="#efe6d2" stroke="rgba(40,28,12,.45)" stroke-width=".3"/>
        <path d="M-3.5,-5.5 A3.5,3.2 0 0 1 3.5,-5.5 Z" fill="#f0c858" stroke="rgba(80,54,12,.45)" stroke-width=".3"/>
        <path d="M0,-8.7 V-11.2" stroke="#f6d870" stroke-width=".6"/>
        <!-- 金银圣光双晕 -->
        <circle class="tt-aura" cx="-10.5" cy="-16.5" r="14.5" fill="#ffd868" opacity=".32"/>
        <circle class="tt-aura" cx="10.5" cy="-16.5" r="14.5" fill="#cfe8ff" opacity=".32"/>
        <!-- 左：金树劳瑞林 (Laurelin) -->
        <path d="M-12.6,3.2 C-11.8,-3 -11.4,-8 -10.8,-14.5 L-9.4,-14.5 C-9.8,-8 -9.4,-3 -8.2,3.2 Z" fill="#9a6b24" stroke="#4c3008" stroke-width=".35"/>
        <path d="M-10.4,-9 L-16.5,-15 M-10.0,-10.5 L-5.2,-16.5" stroke="#8c5e1c" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="-15.5" cy="-15.2" r="5.6" fill="#e6a828" stroke="#6a460c" stroke-width=".3"/>
        <circle cx="-6.2" cy="-15.4" r="5.4" fill="#f2bd34" stroke="#6a460c" stroke-width=".3"/>
        <circle cx="-10.8" cy="-20.2" r="7.4" fill="#ffd84e" stroke="#7a5410" stroke-width=".32"/>
        <circle cx="-12.2" cy="-21.6" r="4.2" fill="#fff4a8" opacity=".88"/>
        <circle class="tt-aura" cx="-16" cy="-8.5" r=".9" fill="#ffe880"/><circle class="tt-aura" cx="-6.5" cy="-9" r=".8" fill="#fff2a4"/>
        <!-- 右：银树泰尔佩瑞安 (Telperion) -->
        <path d="M8.4,3.2 C9.4,-3 9.8,-8 9.4,-14.5 L10.8,-14.5 C11.4,-8 11.8,-3 12.6,3.2 Z" fill="#a8b6c6" stroke="#485666" stroke-width=".35"/>
        <path d="M10.2,-9 L5.2,-15.5 M10.6,-10.5 L16.5,-15.2" stroke="#96a6b8" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="6.2" cy="-15.2" r="5.4" fill="#b4d2ec" stroke="#4a6278" stroke-width=".3"/>
        <circle cx="15.5" cy="-15.4" r="5.6" fill="#cae2f6" stroke="#4a6278" stroke-width=".3"/>
        <circle cx="10.8" cy="-20.2" r="7.4" fill="#e8f4ff" stroke="#587088" stroke-width=".32"/>
        <circle cx="9.6" cy="-21.6" r="4.2" fill="#ffffff" opacity=".92"/>
        <circle class="tt-aura" cx="6.5" cy="-8.8" r=".85" fill="#e4f4ff"/><circle class="tt-aura" cx="15.8" cy="-8.4" r=".9" fill="#ffffff"/>
      </g>`;

    D.PLACES.forEach((p) => {
      const el = document.createElement("div");
      const peakOnly = PEAK_ONLY.has(p.id);
      const isTwoTrees = p.id === "twotrees";
      const isHero = HERO_PLACES.has(p.id);
      const iconHtml = peakOnly ? "" : isTwoTrees ? twoTreesSvg() : (window.ME_ICON ? window.ME_ICON(p) : `<circle r="4" fill="#d8b878" stroke="#3a2a1a"/>`);
      const isMdl = !peakOnly && (isTwoTrees || /class="[^"]*\bmdl\b/.test(iconHtml));
      el.className = `bb-item bb-pl k-${p.k}${p.minor ? " minor" : ""}${isMdl ? " mdlp" : ""}${peakOnly ? " bb-peak-only" : ""}${isTwoTrees ? " bb-twotrees" : ""}`;
      el.style.display = "none";
      if (peakOnly) {
        el.innerHTML = `<div class="bb-wrap"><span class="bb-lb">${p.n}</span></div>`;
      } else {
        const isShire = p.id === "hobbiton";
        const vb = isTwoTrees ? "-28 -34 56 44" : isShire ? "-24 -29 50 38" : isMdl ? "-32 -40 64 52" : "-20 -26 40 36";
        const sw = isTwoTrees ? 72 : isShire ? 72 : isHero ? 60 : isMdl ? (p.minor ? 38 : 50) : (p.minor ? 26 : 34);
        const sh = isTwoTrees ? 58 : isShire ? 56 : isHero ? 50 : isMdl ? (p.minor ? 32 : 42) : (p.minor ? 23 : 30);
        el.innerHTML = `<div class="bb-wrap"><span class="bb-sh"></span><svg class="bb-svg" width="${sw}" height="${sh}" viewBox="${vb}">${iconHtml}</svg><span class="bb-lb">${p.n}</span></div>`;
      }
      el.addEventListener("click", (ev) => { ev.stopPropagation(); M.showPlace(p); });
      bbLayer.appendChild(el);
      BB.places.push({
        p, el, lb: el.querySelector(".bb-lb"),
        isMdl, peakOnly, isTwoTrees, isHero, pri: p.minor ? 4 : isHero ? 0 : 1,
        vis: false, shown: false, dc: false
      });
    });

    // 2. 旅程 Q 版小人/军队/舟船立牌
    M.JR.forEach((j) => {
      const el = document.createElement("div");
      el.className = "bb-item bb-jmk" + (j.army ? " army" : "");
      el.style.display = "none";
      el.innerHTML = `<div class="bb-wrap"><span class="bb-sh"></span><svg class="bb-svg" width="84" height="58" viewBox="-46 -50 92 64"><g class="bb-jcl"></g></svg><span class="bb-jname" style="color:${j.c}">${j.n}</span></div>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); M.showJourney(j); });
      bbLayer.appendChild(el);
      BB.journeys.push({ j, el, cl: el.querySelector(".bb-jcl"), lb: el.querySelector(".bb-jname"), lastKey: "", shown: false });
    });

    // 3. 常驻 Q 版人物立牌
    M.RES.forEach((r) => {
      const el = document.createElement("div");
      el.className = "bb-item bb-res";
      el.style.display = "none";
      const useId = r.c.homeLook && r.g.innerHTML.includes(r.c.homeLook) ? r.c.homeLook : r.c.id;
      el.innerHTML = `<div class="bb-wrap"><span class="bb-sh"></span><svg class="bb-svg" width="26" height="36" viewBox="-16 -36 32 42"><use href="#chb-${useId}" transform="scale(.72)"/></svg><span class="bb-res-n">${r.c.n}</span></div>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); M.showChar(r.c.id); });
      bbLayer.appendChild(el);
      BB.residents.push({ r, el, ox: 0, oz: 0, shown: false });
    });

    // 4. 至尊戒浮空立牌
    {
      const el = document.createElement("div");
      el.className = "bb-item bb-ring";
      el.style.display = "none";
      el.innerHTML = `<div class="bb-wrap"><span class="bb-sh"></span><svg class="bb-svg" width="38" height="38" viewBox="-20 -20 40 40"><circle r="15" fill="rgba(255,212,84,0.28)"/><circle r="9.5" fill="none" stroke="rgba(255,220,104,0.75)" stroke-width="1.2" stroke-dasharray="2.5 2.5"/><circle r="6" fill="none" stroke="#361c06" stroke-width="3.6"/><circle r="6" fill="none" stroke="#f5c644" stroke-width="2.2"/><circle r="6" fill="none" stroke="#fff8d6" stroke-width=".8" stroke-dasharray="2 2"/></svg><span class="bb-lb">${M.tr("至尊戒")}</span></div>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); if (M.showRing) M.showRing(); });
      bbLayer.appendChild(el);
      BB.ring = { el, x: 0, z: 0, vis: false, shown: false };
    }

    // 5. 关键时刻 ✦ 标记
    M.MO.forEach((m) => {
      const el = document.createElement("div");
      el.className = "bb-item bb-mo";
      el.style.display = "none";
      el.title = "✦ " + m.h;
      el.innerHTML = `<div class="bb-wrap"><svg class="bb-svg" width="30" height="30" viewBox="-16 -16 32 32"><circle r="13" fill="none" stroke="#f6d26a" stroke-width="1.2" opacity=".55"/><path d="M0-11L2.6-2.6L11 0L2.6 2.6L0 11L-2.6 2.6L-11 0L-2.6-2.6Z" fill="#f6d26a" stroke="#6a4a10" stroke-width=".85"/><circle r="2.2" fill="#fff8d8"/></svg></div>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); M.openMoment(m.id); });
      bbLayer.appendChild(el);
      const xy = Array.isArray(m.at) ? m.at : (M.P[m.at] ? [M.P[m.at].x, M.P[m.at].y] : [0, 0]);
      BB.moments.push({ m, el, x: xy[0], z: xy[1], shown: false });
    });

    // 6. 区域 / 海洋地理标签
    W.labels.forEach((lb) => {
      const el = document.createElement("div");
      el.className = "bb-item bb-lbl" + (lb.sea ? " sea" : "");
      el.style.display = "none";
      const fs = clamp(lb.s * 0.9, 10, 20);
      el.innerHTML = `<div class="bb-lbl-box"><div class="bb-lbl-zh" style="font-size:${fs.toFixed(1)}px">${lb.n}</div>${lb.en ? `<div class="bb-lbl-en" style="font-size:${(fs * 0.46).toFixed(1)}px">${lb.en}</div>` : ""}</div>`;
      bbLayer.appendChild(el);
      BB.labels.push({ lb, el, fs, shown: false });
    });

    // 7. 经典地标立牌（完整保留阿刚那斯、卡拉兹拉斯、涝洛斯、塔丘等经典地标）
    const LIFE = window.ME_LIFE || {};
    const LART = LIFE.ART || {};
    BB.landmarks = [];
    (LIFE.LANDMARKS || []).forEach((m) => {
      const art = LART[m.k];
      if (!art) return;
      const el = document.createElement("div");
      el.className = "bb-item bb-lm";
      el.style.display = "none";
      el.innerHTML = `<div class="bb-wrap"><span class="bb-sh"></span><svg class="bb-svg" width="30" height="28" viewBox="-16 -22 32 30">${art}</svg><span class="bb-lb">${m.n}</span></div>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); M.showLandmark(m); });
      bbLayer.appendChild(el);
      BB.landmarks.push({ m, el, lb: el.querySelector(".bb-lb"), shown: false, dc: false });
    });

    // 8. 年代奇观（史矛革盘旋、炎魔、树人进军、巨鹰、戒灵、西渡白船等）
    BB.wonders = [];
    (LIFE.WONDERS || []).forEach((o) => {
      const art = LART[o.k];
      if (!art || o.k === "volcano" || o.k === "eyebeam") return; // 末日火山已有 3D 熔岩+火星粒子
      const el = document.createElement("div");
      el.className = "bb-item bb-won";
      el.style.display = "none";
      el.title = o.n || "";
      el.innerHTML = `<div class="bb-wrap"><svg class="bb-svg" width="44" height="44" viewBox="-26 -26 52 52">${art}</svg></div>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); if (M.showWonder) M.showWonder(o); });
      bbLayer.appendChild(el);
      BB.wonders.push({ o, el, shown: false });
    });

    // 9. 海上舟船与鲸群（随 3D 海浪轻柔起伏）
    BB.sea = [];
    const SART = M.SEA_ART || {};
    (DECO.SEA || []).forEach((o, idx) => {
      const art = SART[o.k];
      if (!art || o.k === "whirl") return;
      const el = document.createElement("div");
      el.className = "bb-item bb-sea";
      el.style.display = "none";
      const flip = o.flip ? -1 : 1;
      el.innerHTML = `<div class="bb-wrap"><svg class="bb-svg" width="40" height="30" viewBox="-26 -24 52 34"><g transform="scale(${flip},1)">${art}</g></svg></div>`;
      bbLayer.appendChild(el);
      BB.sea.push({ o, el, phase: idx * 1.17, shown: false });
    });

    // 10. 刚铎白色山脉烽火台动态容器
    BB.beacons = [];
  }

  function spawnBeacon3D(x, z, label) {
    const el = document.createElement("div");
    el.className = "bb-item bb-bcn";
    el.style.display = "none";
    el.innerHTML = `<div class="bb-wrap"><svg class="bb-svg" width="30" height="38" viewBox="-16 -32 32 36">
      <circle cy="-6" r="13" fill="rgba(255,134,36,0.28)"/>
      <path d="M0,-10 Q-3,-20 1,-29 Q4,-20 0,-10 Z" fill="rgba(72,62,56,0.42)"/>
      <path d="M-3.4,1 C-4,-6 -0.8,-12 0,-17 C0.8,-12 4,-6 3.4,1 Z" fill="#ff6a18"/>
      <path d="M-1.8,0.5 C-2,-4 -0.4,-8 0,-11.5 C0.4,-8 2,-4 1.8,0.5 Z" fill="#ffe68a"/>
      <circle cy="-2" r="1.4" fill="#fffdf0"/>
    </svg><span class="bb-lb">${label}</span></div>`;
    bbLayer.appendChild(el);
    const it = { x, z, el, lb: el.querySelector(".bb-lb"), born: performance.now(), shown: false };
    BB.beacons.push(it);
    bbNeedsSort = true;
    setTimeout(() => {
      el.remove();
      const idx = BB.beacons.indexOf(it);
      if (idx >= 0) BB.beacons.splice(idx, 1);
    }, 9500);
  }

  function syncStateAtTime(t) {
    belSinkTgt = t >= 587.5 ? 1 : 0;
    nuSinkTgt = (t < 622 || t >= 3909.3) ? 1 : 0;
    amanVeilTgt = t >= 3909.3 ? 1 : 0;

    // 地点状态（显隐、废墟、暗影、双圣树枯荣）
    const treesDead = t >= -40;
    BB.places.forEach((it) => {
      const p = it.p;
      it.vis = M.visible(p, t);
      if (!it.vis) return;
      const isRuin = p.ruin != null && t >= p.ruin && !(p.rebuilt && t >= p.rebuilt);
      const isDk = p.darkAt != null && t >= p.darkAt && !(p.lightAt && t >= p.lightAt);
      if (it._ruin !== isRuin) { it.el.classList.toggle("ruin", isRuin); it.lb.textContent = p.n + (isRuin ? M.tr("（废墟）") : ""); it._ruin = isRuin; }
      if (it._dk !== isDk) { it.el.classList.toggle("dk", isDk); it._dk = isDk; }
      if (it.isTwoTrees && it._tdead !== treesDead) {
        it.el.classList.toggle("trees-dead", treesDead);
        it._tdead = treesDead;
      }
    });

    // 旅程立牌同步
    BB.journeys.forEach((it) => {
      const j = it.j;
      it.vis = !!j.vis && !!j.curPos;
      if (!it.vis) return;
      it.x = j.curPos[0]; it.z = j.curPos[1];
      if (it.lastKey !== j.key && j.cl) {
        it.cl.innerHTML = j.cl.innerHTML;
        it.lastKey = j.key;
      }
      if (j._lb && it._lb !== j._lb) { it.lb.textContent = j._lb; it._lb = j._lb; }
      it.el.classList.toggle("army", !!j._army);
    });

    // 塞尔达旷野之息风柔和立牌色温：与均衡曝光的 3D 地形自然融合，不泛白刺眼
    const eraId = (M.eraOf(t) && M.eraOf(t).id) || "ta";
    const TONES = {
      trees: "saturate(1.04) brightness(.98) contrast(1.02)",
      fa: "saturate(.98) brightness(.95) contrast(1.02)",
      sa: "saturate(1.04) brightness(.97) contrast(1.02)",
      ta: "saturate(1.02) brightness(.96) contrast(1.02)",
      hobbit: "saturate(1.00) brightness(.95) contrast(1.03)",
      war: "sepia(.08) saturate(.98) brightness(.92) contrast(1.05)",
      fo: "saturate(1.05) brightness(.98) contrast(1.02)"
    };
    bbLayer.style.setProperty("--bb-tone", TONES[eraId] || TONES.ta);

    // 常驻人物排布在城堡侧旁，避免压住城名注记
    const groups = {};
    BB.residents.forEach((it) => {
      it.vis = !!it.r.vis;
      if (it.vis) (groups[it.r.key] ||= []).push(it);
    });
    Object.values(groups).forEach((list) => list.forEach((it, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      it.ox = side * (14 + tier * 10);
      it.oz = 2 + (tier % 2) * 5;
    }));

    // 至尊戒
    const rr = t >= M.RING[0].t && t < M.RING_END ? M.at(M.RING, t) : null;
    if (BB.ring) {
      BB.ring.vis = !!rr;
      if (rr) { BB.ring.x = rr.pos[0]; BB.ring.z = rr.pos[1]; }
    }

    // 关键时刻
    BB.moments.forEach((it) => {
      it.vis = !it.m._off;
    });

    // 区域名
    BB.labels.forEach((it) => {
      const lb = it.lb;
      const off = !!((lb.from != null && t < lb.from) || (lb.ta && t < 591) || (lb.fa && belSinkTgt > 0.5) || (lb.aman && amanVeilTgt > 0.5));
      it.vis = !off;
    });

    // 地标 / 奇观 / 海船按年代显隐
    BB.landmarks.forEach((it) => {
      const m = it.m;
      it.vis = (m.from == null || t >= m.from) && (m.to == null || t < m.to);
    });
    BB.wonders.forEach((it) => {
      const o = it.o;
      it.vis = (o.from == null || t >= o.from) && (o.to == null || t < o.to);
    });
    BB.sea.forEach((it) => {
      const o = it.o;
      it.vis = (o.from == null || t >= o.from) && (o.to == null || t < o.to);
    });

    if (inited) {
      rebuildRealmTex(t);
      rebuildTrails(t);
    }
    bbNeedsSort = true;
  }

  /* ==================== 投影更新 HD-2D 纸模立牌层（带 3D 山体遮挡、DOM 写入缓存与静止跳帧） ==================== */
  function occFactor(wx, wy, wz, eye) {
    if (!eye) return 1.0;
    const dx = eye[0] - wx, dy = eye[1] - (wy + 7.5), dz = eye[2] - wz;
    const steps = [0.07, 0.15, 0.26, 0.40, 0.56];
    let maxBlock = 0;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const ry = wy + 7.5 + dy * s;
      if (ry > 70) break;
      const th = sampleH(wx + dx * s, wz + dz * s, true);
      if (th > ry + 2.5) maxBlock = Math.max(maxBlock, clamp((th - (ry + 2.5)) / 10.0, 0, 1));
    }
    return 1.0 - maxBlock * 0.78;
  }

  function updateBillboards(mvp, eye) {
    if (!mvp) return;
    const vw = viewW, vh = viewH;
    const camKey = `${c3.tx.toFixed(2)}|${c3.tz.toFixed(2)}|${c3.dist.toFixed(2)}|${c3.pitch.toFixed(4)}|${c3.yaw.toFixed(4)}|${belSink.toFixed(2)}|${nuSink.toFixed(2)}|${vw}x${vh}`;
    const camChanged = bbNeedsSort || camKey !== lastBbCamKey;
    lastBbCamKey = camKey;
    bbNeedsSort = false;

    const proj = (wx, wy, wz) => {
      const cw0 = mvp[3] * wx + mvp[7] * wy + mvp[11] * wz + mvp[15];
      if (cw0 <= 12) return null;
      const cx0 = (mvp[0] * wx + mvp[4] * wy + mvp[8] * wz + mvp[12]) / cw0;
      const cy0 = (mvp[1] * wx + mvp[5] * wy + mvp[9] * wz + mvp[13]) / cw0;
      if (cx0 < -1.18 || cx0 > 1.18 || cy0 < -1.25 || cy0 > 1.25) return null;
      return { sx: (cx0 * 0.5 + 0.5) * vw, sy: (0.5 - cy0 * 0.5) * vh, d: cw0 };
    };
    const hideItem = (it) => { if (it.shown) { it.el.style.display = "none"; it.shown = false; } };
    const showAt = (it, pr, sc, op, zOff = 0) => {
      if (!it.shown) { it.el.style.display = ""; it.shown = true; it._sx = -9999; }
      const sx = Math.round(pr.sx * 10) / 10, sy = Math.round(pr.sy * 10) / 10, s3 = Math.round(sc * 1000) / 1000;
      if (Math.abs((it._sx ?? -9999) - sx) > 0.15 || Math.abs((it._sy ?? -9999) - sy) > 0.15 || Math.abs((it._sc ?? 0) - s3) > 0.002) {
        it.el.style.transform = `translate3d(${sx}px,${sy}px,0) scale(${s3})`;
        it._sx = sx; it._sy = sy; it._sc = s3;
      }
      const zi = Math.max(1, Math.round(9000 - pr.d * 3 + zOff));
      if (it._zi !== zi) { it.el.style.zIndex = String(zi); it._zi = zi; }
      const op2 = Math.round(op * 50) / 50;
      if (it._op !== op2) { it.el.style.opacity = op2.toFixed(2); it._op = op2; }
    };

    const fogStart = c3.dist * 1.45, fogEnd = c3.dist * 3.1 + 780;
    const fogOp = (d) => clamp(1.0 - smoothstep(fogStart, fogEnd, d) * 0.72, 0.25, 1.0);
    const pScale = (d, base, lo, hi) => clamp((base / Math.max(80, d)), lo, hi);

    // 动态浮动元素（至尊戒、关键时刻、海船、烽火）：始终 60 FPS 更新
    if (BB.ring) {
      if (!BB.ring.vis) hideItem(BB.ring);
      else {
        const y = Math.max(0.8, sampleH(BB.ring.x, BB.ring.z, true)) + 16.5 + Math.sin(elapsed * 2.5) * 1.4;
        const pr = proj(BB.ring.x, y, BB.ring.z);
        if (!pr) hideItem(BB.ring);
        else showAt(BB.ring, pr, pScale(pr.d, 500, 0.60, 1.18), 1.0, 260);
      }
    }
    BB.moments.forEach((it) => {
      if (!it.vis) return hideItem(it);
      const y = Math.max(0.6, sampleH(it.x, it.z, true)) + 9.0 + Math.sin(elapsed * 2.0 + it.x) * 1.2;
      const pr = proj(it.x, y, it.z);
      if (!pr) return hideItem(it);
      showAt(it, pr, pScale(pr.d, 520, 0.6, 1.25), fogOp(pr.d), 240);
    });
    BB.sea.forEach((it) => {
      if (!it.vis || c3.dist > 1150) return hideItem(it);
      const h0 = sampleH(it.o.x, it.o.y, true);
      if (h0 > 0.2) return hideItem(it);
      const y = 0.6 + Math.sin(elapsed * 1.6 + it.phase) * 0.55;
      const pr = proj(it.o.x, y, it.o.y);
      if (!pr) return hideItem(it);
      showAt(it, pr, pScale(pr.d, 520, 0.45, 1.15) * (it.o.s || 1), fogOp(pr.d) * 0.92, -20);
    });
    const bcnPlaced = [];
    BB.beacons.forEach((it) => {
      const y = Math.max(4.0, sampleH(it.x, it.z, true)) + 2.0;
      const pr = proj(it.x, y, it.z);
      if (!pr) return hideItem(it);
      const sc = pScale(pr.d, 490, 0.68, 1.32);
      showAt(it, pr, sc, 1.0, 280);
      if (it.lb) {
        const bx = { l: pr.sx - 26, r: pr.sx + 26, t: pr.sy - 8, b: pr.sy + 12 };
        const ov = bcnPlaced.some((q) => bx.l < q.r && bx.r > q.l && bx.t < q.b && bx.b > q.t);
        if (it._dc !== ov) { it.lb.classList.toggle("dc", ov); it._dc = ov; }
        if (!ov) bcnPlaced.push(bx);
      }
    });

    // 静止帧跳过静态立牌重投影与避让，节省 >95% JS 开销
    if (!camChanged) return;

    const farMode = c3.dist > 880;
    const nearMode = c3.dist < 760;
    const placed = [];
    const hits = (r) => placed.some((q) => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t);

    if (BB.ring && BB.ring.shown) {
      placed.push({ l: BB.ring._sx - 24, r: BB.ring._sx + 24, t: BB.ring._sy - 28, b: BB.ring._sy + 12 });
    }

    // 1. 旅程小人（最高层级，确保永远醒目）
    BB.journeys.forEach((it) => {
      if (!it.vis) return hideItem(it);
      const y = Math.max(0.6, sampleH(it.x, it.z, true)) + 1.0;
      const pr = proj(it.x, y, it.z);
      if (!pr) return hideItem(it);
      const sc = pScale(pr.d, 500, 0.56, 1.32);
      const occ = occFactor(it.x, y, it.z, eye);
      showAt(it, pr, sc, fogOp(pr.d) * (0.45 + 0.55 * occ), 220);
      placed.push({ l: pr.sx - 26 * sc, r: pr.sx + 26 * sc, t: pr.sy - 32 * sc, b: pr.sy + 12 * sc });
    });

    // 2. 年代奇观（史矛革、炎魔、树人、戒灵、巨鹰等）
    BB.wonders.forEach((it) => {
      if (!it.vis || c3.dist > 1100) return hideItem(it);
      const h = sampleH(it.o.x, it.o.y, true);
      const y = Math.max(1.5, h) + (it.o.k === "smaug" || it.o.k === "eagles" || it.o.k === "nazgul" ? 14 : 3);
      const pr = proj(it.o.x, y, it.o.y);
      if (!pr) return hideItem(it);
      const occ = occFactor(it.o.x, y, it.o.y, eye);
      showAt(it, pr, pScale(pr.d, 500, 0.55, 1.25), fogOp(pr.d) * occ, 200);
    });

    // 3. 地点建筑立牌（主城优先，真实山体遮挡 + 屏幕坐标标签避让）
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < BB.places.length; i++) {
        const it = BB.places[i];
        const isMinor = !!it.p.minor;
        if ((pass === 0 && isMinor) || (pass === 1 && !isMinor)) continue;
        if (!it.vis || (isMinor && farMode)) { hideItem(it); continue; }
        const h = sampleH(it.p.x, it.p.y, true);
        if (h < -1.5) { hideItem(it); continue; }
        const wy = Math.max(0.5, h) + (it.peakOnly ? 6.5 : 0.4);
        const pr = proj(it.p.x, wy, it.p.y);
        if (!pr) { hideItem(it); continue; }
        const occ = (it.peakOnly || it.isTwoTrees) ? 1.0 : occFactor(it.p.x, wy, it.p.y, eye);
        const sc = it.isTwoTrees ? pScale(pr.d, 640, 0.78, 1.48) : pScale(pr.d, 500, 0.52, 1.34);
        showAt(it, pr, sc, fogOp(pr.d) * occ, it.isTwoTrees ? 160 : isMinor ? 40 : 100);
        const lw = (it.p.n.length * 10.5 + 10) * sc;
        const box = { l: pr.sx - lw * 0.5, r: pr.sx + lw * 0.5, t: pr.sy - 6 * sc, b: pr.sy + 14 * sc };
        const dc = occ < 0.45 || hits(box);
        if (it.dc !== dc) { it.lb.classList.toggle("dc", dc); it.dc = dc; }
        if (!dc) placed.push(box);
      }
    }

    // 4. 经典地标立牌（中近景展现，真实山体遮挡）
    BB.landmarks.forEach((it) => {
      if (!it.vis || !nearMode) return hideItem(it);
      const h = sampleH(it.m.x, it.m.y, true);
      if (h < -1.2) return hideItem(it);
      const wy = Math.max(0.5, h) + 0.6;
      const pr = proj(it.m.x, wy, it.m.y);
      if (!pr) return hideItem(it);
      const occ = occFactor(it.m.x, wy, it.m.y, eye);
      if (occ < 0.35) return hideItem(it);
      const sc = pScale(pr.d, 470, 0.50, 1.20);
      showAt(it, pr, sc, fogOp(pr.d) * occ, 60);
      const lw = (it.m.n.length * 9.5 + 10) * sc;
      const box = { l: pr.sx - lw * 0.5, r: pr.sx + lw * 0.5, t: pr.sy - 5 * sc, b: pr.sy + 12 * sc };
      const dc = hits(box);
      if (it.dc !== dc) { it.lb.classList.toggle("dc", dc); it.dc = dc; }
      if (!dc) placed.push(box);
    });

    // 5. 常驻 Q 版人物立牌
    BB.residents.forEach((it) => {
      if (!it.vis || c3.dist > 1050) return hideItem(it);
      const wx = it.r.x + it.ox, wz = it.r.y + it.oz;
      const h = sampleH(wx, wz, true);
      if (h < -1.0) return hideItem(it);
      const wy = Math.max(0.5, h) + 0.5;
      const pr = proj(wx, wy, wz);
      if (!pr) return hideItem(it);
      const occ = occFactor(wx, wy, wz, eye);
      if (occ < 0.35) return hideItem(it);
      const sc = pScale(pr.d, 480, 0.50, 1.28);
      showAt(it, pr, sc, fogOp(pr.d) * occ, 140);
    });

    // 6. 区域名与海域标签
    BB.labels.forEach((it) => {
      if (!it.vis) return hideItem(it);
      const lb = it.lb;
      const y = lb.sea ? 1.5 : Math.max(3.5, sampleH(lb.x, lb.y, true)) + 6.0;
      const pr = proj(lb.x, y, lb.y);
      if (!pr) return hideItem(it);
      const sc = pScale(pr.d, 620, 0.62, 1.25);
      const lw = lb.n.length * it.fs * 1.15 * sc;
      const box = { l: pr.sx - lw * 0.5, r: pr.sx + lw * 0.5, t: pr.sy - 14 * sc, b: pr.sy + 14 * sc };
      if (hits(box)) return hideItem(it);
      placed.push(box);
      showAt(it, pr, sc, fogOp(pr.d) * 0.88, -60);
    });
  }

  /* ==================== 主 WebGL 渲染循环（60 FPS） ==================== */
  function resizeGL() {
    const r = stageEl.getBoundingClientRect();
    viewW = Math.max(1, r.width);
    viewH = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(viewW * dpr), ph = Math.round(viewH * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
    }
    if (gl) gl.viewport(0, 0, pw, ph);
  }

  function renderFrame(now) {
    if (!active) { rafId = 0; return; }
    rafId = requestAnimationFrame(renderFrame);
    const dt = clamp((now - (lastFrameT || now)) / 1000, 0.004, 0.05);
    lastFrameT = now;
    elapsed += dt;

    // 1. 相机平滑飞行或惯性阻尼
    if (flyAnim) {
      const k = sm(clamp((now - flyAnim.t0) / flyAnim.ms, 0, 1));
      c3.tx = c3.tTx = lerp(flyAnim.s.tx, flyAnim.e.tx, k);
      c3.tz = c3.tTz = lerp(flyAnim.s.tz, flyAnim.e.tz, k);
      c3.dist = c3.tDist = Math.exp(lerp(Math.log(flyAnim.s.dist), Math.log(flyAnim.e.dist), k));
      c3.pitch = c3.tPitch = lerp(flyAnim.s.pitch, flyAnim.e.pitch, k);
      c3.yaw = c3.tYaw = lerp(flyAnim.s.yaw, flyAnim.e.yaw, k);
      if (k >= 1) flyAnim = null;
    } else {
      const a = 1 - Math.exp(-dt * 17);
      c3.tx = lerp(c3.tx, c3.tTx, a);
      c3.tz = lerp(c3.tz, c3.tTz, a);
      c3.dist = Math.exp(lerp(Math.log(c3.dist), Math.log(c3.tDist), a));
      c3.pitch = lerp(c3.pitch, c3.tPitch, a);
      c3.yaw = lerp(c3.yaw, c3.tYaw, a);
    }

    // 2. 纪元大陆升降与阿门洲迷雾过渡
    const sinkA = 1 - Math.exp(-dt * 4.5);
    belSink = lerp(belSink, belSinkTgt, sinkA);
    nuSink = lerp(nuSink, nuSinkTgt, sinkA);
    amanVeil = lerp(amanVeil, amanVeilTgt, sinkA);

    // 同步 2D cam & 比例尺 & 小地图 & 罗盘
    const w2d = camWFromDist(c3.dist), h2d = (w2d * viewH) / Math.max(1, viewW);
    M.cam.w = w2d; M.cam.x = c3.tx - w2d * 0.5; M.cam.y = c3.tz - h2d * 0.5;
    M.syncMiniAndBar(w2d / Math.max(1, viewW), h2d, false);
    if (compassEl) compassEl.style.setProperty("--yaw", `${(-c3.yaw / DEG).toFixed(1)}deg`);

    // 3. 计算视图与透视矩阵
    const cp = Math.cos(c3.pitch), sp = Math.sin(c3.pitch);
    const cy = Math.cos(c3.yaw), sy = Math.sin(c3.yaw);
    const eye = [c3.tx + sy * cp * c3.dist, sp * c3.dist, c3.tz + cy * cp * c3.dist];
    const target = [c3.tx, 2.0, c3.tz];
    const projM = mat4Perspective(FOVY, viewW / Math.max(1, viewH), 8.0, 5200.0);
    const viewM = mat4LookAt(eye, target, [0, 1, 0]);
    const mvp = mat4Mul(projM, viewM);
    lastMvp = mvp;
    lastInvMvp = mat4Inv(mvp);

    const camRight = [viewM[0], viewM[4], viewM[8]];
    const camUp = [viewM[1], viewM[5], viewM[9]];
    const atm = curAtmos();
    const fogStart = c3.dist * 1.45, fogEnd = c3.dist * 3.25 + 920.0;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Pass 1: 天空大气背景
    {
      const P = progs.sky;
      gl.useProgram(P.p);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.skyVbo);
      gl.enableVertexAttribArray(P.aPos);
      gl.vertexAttribPointer(P.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3fv(P.uSkyTop, atm.skyTop);
      gl.uniform3fv(P.uSkyHor, atm.skyHor);
      gl.uniform1f(P.uPitch, c3.pitch);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
    }

    // Pass 2: 3D 起伏地形网格
    {
      const P = progs.terrain;
      gl.useProgram(P.p);
      gl.disable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.tVbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.tIbo);
      const stride = 40;
      gl.enableVertexAttribArray(P.aPos); gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(P.aNorm); gl.vertexAttribPointer(P.aNorm, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(P.aInfo); gl.vertexAttribPointer(P.aInfo, 4, gl.FLOAT, false, stride, 24);
      gl.uniformMatrix4fv(P.uMvp, false, mvp);
      gl.uniform3fv(P.uEye, eye);
      gl.uniform3fv(P.uSunDir, atm.sunDir);
      gl.uniform3fv(P.uSunCol, atm.sunCol);
      gl.uniform3fv(P.uAmbCol, atm.ambCol);
      gl.uniform3fv(P.uFogCol, atm.fog);
      gl.uniform1f(P.uFogStart, fogStart);
      gl.uniform1f(P.uFogEnd, fogEnd);
      gl.uniform1f(P.uTime, elapsed);
      gl.uniform1f(P.uBelSink, belSink);
      gl.uniform1f(P.uNuSink, nuSink);
      gl.uniform1f(P.uAmanVeil, amanVeil);
      gl.uniform1f(P.uMordorGlow, atm.mordorGlow);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs.albedo); gl.uniform1i(P.uAlbedo, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texs.realm); gl.uniform1i(P.uRealm, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texs.elev); gl.uniform1i(P.uElevTex, 2);
      gl.drawElements(gl.TRIANGLES, terrainIdxCount, gl.UNSIGNED_INT, 0);
      gl.disableVertexAttribArray(P.aNorm);
      gl.disableVertexAttribArray(P.aInfo);
    }

    // Pass 3: 动态 3D 海洋与海岸拍岸浪花
    {
      const P = progs.water;
      gl.useProgram(P.p);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.waterVbo);
      gl.enableVertexAttribArray(P.aPos); gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(P.uMvp, false, mvp);
      gl.uniform3fv(P.uEye, eye);
      gl.uniform3fv(P.uSunDir, atm.sunDir);
      gl.uniform3fv(P.uSunCol, atm.sunCol);
      gl.uniform3fv(P.uFogCol, atm.fog);
      gl.uniform3fv(P.uWaterDeep, atm.waterDeep);
      gl.uniform3fv(P.uWaterShal, atm.waterShal);
      gl.uniform1f(P.uFogStart, fogStart);
      gl.uniform1f(P.uFogEnd, fogEnd);
      gl.uniform1f(P.uTime, elapsed);
      gl.uniform1f(P.uBelSink, belSink);
      gl.uniform1f(P.uNuSink, nuSink);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs.height); gl.uniform1i(P.uHeightTex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
    }

    // Pass 4: 3D 森林立牌群（真实深度遮挡 + 微风摇曳）
    if (treeVertCount > 0) {
      const P = progs.trees;
      gl.useProgram(P.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.treeVbo);
      const stride = 36;
      gl.enableVertexAttribArray(P.aBase); gl.vertexAttribPointer(P.aBase, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(P.aCorner); gl.vertexAttribPointer(P.aCorner, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(P.aMeta); gl.vertexAttribPointer(P.aMeta, 4, gl.FLOAT, false, stride, 20);
      gl.uniformMatrix4fv(P.uMvp, false, mvp);
      gl.uniform3fv(P.uCamRight, camRight);
      gl.uniform3fv(P.uEye, eye);
      gl.uniform3fv(P.uSunCol, atm.sunCol);
      gl.uniform3fv(P.uAmbCol, atm.ambCol);
      gl.uniform3fv(P.uFogCol, atm.fog);
      gl.uniform1f(P.uFogStart, fogStart);
      gl.uniform1f(P.uFogEnd, fogEnd);
      gl.uniform1f(P.uTime, elapsed);
      gl.uniform1f(P.uBelSink, belSink);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs.trees); gl.uniform1i(P.uAtlas, 0);
      gl.drawArrays(gl.TRIANGLES, 0, treeVertCount);
      gl.disableVertexAttribArray(P.aCorner);
      gl.disableVertexAttribArray(P.aMeta);
    }

    // Pass 5: 贴地 3D 旅程流光路径
    if (trailVertCount > 0) {
      const P = progs.trail;
      gl.useProgram(P.p);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.trailVbo);
      const stride = 32;
      gl.enableVertexAttribArray(P.aPos); gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(P.aCol); gl.vertexAttribPointer(P.aCol, 4, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(P.aDist); gl.vertexAttribPointer(P.aDist, 1, gl.FLOAT, false, stride, 28);
      gl.uniformMatrix4fv(P.uMvp, false, mvp);
      gl.uniform1f(P.uTime, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, trailVertCount);
      gl.disableVertexAttribArray(P.aCol);
      gl.disableVertexAttribArray(P.aDist);
      gl.depthMask(true);
    }

    // Pass 6: 3D 飘云雾霭 & 末日火山上升余烬
    if (fxVertCount > 0) {
      const P = progs.fx;
      gl.useProgram(P.p);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.fxVbo);
      const stride = 48;
      gl.enableVertexAttribArray(P.aPos); gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(P.aCorner); gl.vertexAttribPointer(P.aCorner, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(P.aMeta); gl.vertexAttribPointer(P.aMeta, 4, gl.FLOAT, false, stride, 20);
      gl.enableVertexAttribArray(P.aCol); gl.vertexAttribPointer(P.aCol, 3, gl.FLOAT, false, stride, 36);
      gl.uniformMatrix4fv(P.uMvp, false, mvp);
      gl.uniform3fv(P.uCamRight, camRight);
      gl.uniform3fv(P.uCamUp, camUp);
      gl.uniform1f(P.uTime, elapsed);
      gl.uniform1f(P.uCloudAlpha, smoothstep(230, 520, c3.dist));
      gl.uniform1f(P.uEmberBoost, clamp(atm.mordorGlow * 1.15, 0.28, 1.45));
      gl.uniform1f(P.uTreesGlow, M.T < -40 ? 1.0 : 0.06);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs.fx); gl.uniform1i(P.uTex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, fxVertCount);
      gl.disableVertexAttribArray(P.aCorner);
      gl.disableVertexAttribArray(P.aMeta);
      gl.disableVertexAttribArray(P.aCol);
      gl.depthMask(true);
    }

    // Pass 7: 前景 HD-2D 纸模立牌层（60 FPS 精确投影 + 3D 山体遮挡）
    updateBillboards(mvp, eye);
  }

  /* ==================== 初始化 WebGL 上下文与全部着色器 ==================== */
  function initGL(silent = false) {
    if (inited) return true;
    gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });
    isWebGL2 = !!gl;
    if (!gl) {
      gl = canvas.getContext("webgl", { antialias: true, alpha: false });
      if (!gl || !gl.getExtension("OES_element_index_uint")) {
        if (!silent) alert(M.tr("当前浏览器不支持 WebGL 3D 沙盘渲染。"));
        return false;
      }
    }

    buildHeightfield();
    buildTerrainBuffers();
    buildWaterAndSkyBuffers();
    buildTreeBuffers();
    buildFxBuffers();
    bufs.trailVbo = gl.createBuffer();

    texs.albedo = mkTex(gl, createAlbedoCanvas(), true);
    texs.trees = mkTex(gl, createTreeAtlasCanvas(), true);
    texs.fx = mkTex(gl, createSoftSpriteCanvas(), true);
    texs.realm = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texs.realm);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    const bindLoc = (p, attrs, unifs) => {
      const o = { p };
      attrs.forEach((k) => (o[k] = gl.getAttribLocation(p, k)));
      unifs.forEach((k) => (o[k] = gl.getUniformLocation(p, k)));
      return o;
    };
    progs.sky = bindLoc(mkProg(gl, VS_SKY, FS_SKY), ["aPos"], ["uSkyTop", "uSkyHor", "uPitch"]);
    progs.terrain = bindLoc(mkProg(gl, VS_TERRAIN, FS_TERRAIN), ["aPos", "aNorm", "aInfo"], [
      "uMvp", "uEye", "uSunDir", "uSunCol", "uAmbCol", "uFogCol", "uFogStart", "uFogEnd", "uTime",
      "uBelSink", "uNuSink", "uAmanVeil", "uMordorGlow", "uAlbedo", "uRealm", "uElevTex"
    ]);
    progs.water = bindLoc(mkProg(gl, VS_WATER, FS_WATER), ["aPos"], [
      "uMvp", "uEye", "uSunDir", "uSunCol", "uFogCol", "uWaterDeep", "uWaterShal",
      "uFogStart", "uFogEnd", "uTime", "uBelSink", "uNuSink", "uHeightTex"
    ]);
    progs.trees = bindLoc(mkProg(gl, VS_TREES, FS_TREES), ["aBase", "aCorner", "aMeta"], [
      "uMvp", "uCamRight", "uEye", "uSunCol", "uAmbCol", "uFogCol", "uFogStart", "uFogEnd", "uTime", "uBelSink", "uAtlas"
    ]);
    progs.trail = bindLoc(mkProg(gl, VS_TRAIL, FS_TRAIL), ["aPos", "aCol", "aDist"], ["uMvp", "uTime"]);
    progs.fx = bindLoc(mkProg(gl, VS_FX, FS_FX), ["aPos", "aCorner", "aMeta", "aCol"], [
      "uMvp", "uCamRight", "uCamUp", "uTime", "uCloudAlpha", "uEmberBoost", "uTreesGlow", "uTex"
    ]);

    gl.clearColor(0.08, 0.14, 0.22, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    buildBillboards();
    bind25DControls();
    inited = true;
    return true;
  }

  /* ==================== 交互控制（平移 / 光标锚定缩放 / 旋转倾角） ==================== */
  function clampTarget() {
    c3.tTx = clamp(c3.tTx, BX - 60, BX + BW + 60);
    c3.tTz = clamp(c3.tTz, BY - 60, BY + BH + 60);
    c3.tDist = clamp(c3.tDist, 130, 1900);
    c3.tPitch = clamp(c3.tPitch, 22 * DEG, 78 * DEG);
  }

  function bind25DControls() {
    let dragMode = null, lastX = 0, lastY = 0, downX = 0, downY = 0, dragMoved = false;
    const pts = new Map();
    let pinchD0 = 0;

    stageEl.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      flyAnim = null;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      canvas.setPointerCapture?.(e.pointerId);
      if (pts.size === 1) {
        dragMode = (e.button === 2 || e.shiftKey || e.altKey) ? "orbit" : "pan";
        lastX = downX = e.clientX; lastY = downY = e.clientY;
        dragMoved = false;
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinchD0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        dragMode = "pinch";
        dragMoved = true;
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (dragMode === "pinch" && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d1 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        c3.tDist *= pinchD0 / d1;
        pinchD0 = d1;
        clampTarget();
        return;
      }
      if (!dragMoved && Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5) dragMoved = true;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (dragMode === "orbit") {
        c3.tYaw -= dx * 0.0062;
        c3.tPitch = clamp(c3.tPitch + dy * 0.0052, 22 * DEG, 78 * DEG);
      } else if (dragMode === "pan") {
        // 沿相机偏航角对齐地平面 1:1 拖拽
        const scale = (c3.dist * 2 * Math.tan(FOVY / 2)) / Math.max(1, viewH);
        const cy = Math.cos(c3.yaw), sy = Math.sin(c3.yaw);
        const py = dy / Math.max(0.38, Math.sin(c3.pitch));
        c3.tTx -= (dx * cy + py * sy) * scale;
        c3.tTz -= (-dx * sy + py * cy) * scale;
        clampTarget();
      }
    });
    const up = (e) => {
      const wasClick = e.type === "pointerup" && dragMode === "pan" && !dragMoved;
      pts.delete(e.pointerId);
      if (!pts.size) { dragMode = null; dragMoved = false; }
      if (wasClick) {
        const card = document.getElementById("card");
        if (card && !card.hidden) card.hidden = true;
      }
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    // 滚轮 / 触控板光标锚定平滑缩放（区分触控板 1:1 跟手与有级滚轮平滑滑行）
    let lastWheelAt = 0, isTrackpad = false;
    stageEl.addEventListener("wheel", (e) => {
      e.preventDefault();
      flyAnim = null;
      const raw = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 240 : e.deltaY;
      if (!raw) return;
      const now = performance.now(), gap = now - lastWheelAt;
      lastWheelAt = now;
      if (e.ctrlKey || (e.deltaMode === 0 && (Math.abs(raw) < 42 || (gap < 28 && isTrackpad)))) isTrackpad = true;
      else if (e.deltaMode !== 0 || (gap > 60 && Math.abs(raw) >= 48)) isTrackpad = false;

      const dy = clamp(raw, -150, 150);
      const factor = Math.exp(dy * (e.ctrlKey ? 0.0052 : isTrackpad ? 0.0022 : 0.00148));
      const newDist = clamp(c3.tDist * factor, 130, 1900);
      const ratio = newDist / c3.tDist;
      if (lastInvMvp && Math.abs(ratio - 1) > 1e-4) {
        const r = canvas.getBoundingClientRect();
        const ndcX = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
        const ndcY = 1 - ((e.clientY - r.top) / Math.max(1, r.height)) * 2;
        const hit = unprojectRay(lastInvMvp, ndcX, ndcY);
        if (hit) {
          c3.tTx = hit[0] + (c3.tTx - hit[0]) * ratio;
          c3.tTz = hit[1] + (c3.tTz - hit[1]) * ratio;
        }
      }
      c3.tDist = newDist;
      clampTarget();
      if (isTrackpad) {
        c3.dist = lerp(c3.dist, c3.tDist, 0.72);
        c3.tx = lerp(c3.tx, c3.tTx, 0.72);
        c3.tz = lerp(c3.tz, c3.tTz, 0.72);
      }
    }, { passive: false });

    // HUD 视角微调按钮
    stageEl.querySelector(".hud-25d")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cam25]");
      if (!btn) return;
      flyAnim = null;
      const a = btn.dataset.cam25;
      if (a === "tiltUp") c3.tPitch = clamp(c3.tPitch + 10 * DEG, 22 * DEG, 78 * DEG);
      else if (a === "tiltDn") c3.tPitch = clamp(c3.tPitch - 10 * DEG, 22 * DEG, 78 * DEG);
      else if (a === "rotL") c3.tYaw -= 22 * DEG;
      else if (a === "rotR") c3.tYaw += 22 * DEG;
      else if (a === "reset") { c3.tYaw = 0; c3.tPitch = 42 * DEG; }
    });

    // 点击罗盘回正北向
    if (compassEl) {
      compassEl.addEventListener("click", () => {
        if (!active) return;
        flyAnim = null;
        c3.tYaw = 0;
      });
    }

    // 键盘 Q/E 旋转视角
    document.addEventListener("keydown", (e) => {
      if (!active || e.target.closest("input,textarea")) return;
      if (e.key === "q" || e.key === "Q") { flyAnim = null; c3.tYaw -= 14 * DEG; }
      else if (e.key === "e" || e.key === "E") { flyAnim = null; c3.tYaw += 14 * DEG; }
    });

    window.addEventListener("resize", () => { if (active) resizeGL(); });
  }

  /* ==================== 开关与外部 API ==================== */
  function enter(instant = false) {
    if (active) return;
    if (!initGL(instant)) return;
    active = true;
    document.body.classList.add("mode-25d");
    stageEl.hidden = false;
    toggleBtn.classList.add("on");
    toggleBtn.setAttribute("aria-pressed", "true");
    resizeGL();

    // 从当前 2D 镜头无缝对接；默认启动直达 42° 黄金倾角，手动切换时以优雅俯仰动画落入
    M.updateSvgSize();
    const h2d = (M.cam.w * Math.max(1, M.ch)) / Math.max(1, M.cw);
    const cx = M.cam.x + M.cam.w * 0.5, cz = M.cam.y + h2d * 0.5;
    const d = distFromCamW(M.cam.w);
    c3.tx = c3.tTx = cx;
    c3.tz = c3.tTz = cz;
    c3.dist = c3.tDist = d;
    c3.yaw = c3.tYaw = 0;
    c3.pitch = (instant ? 42 : 68) * DEG;
    c3.tPitch = 42 * DEG;
    flyAnim = null;

    syncStateAtTime(M.T);
    belSink = belSinkTgt; nuSink = nuSinkTgt; amanVeil = amanVeilTgt;
    lastFrameT = performance.now();
    if (!rafId) rafId = requestAnimationFrame(renderFrame);
  }

  function exit() {
    if (!active) return;
    active = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    document.body.classList.remove("mode-25d");
    stageEl.hidden = true;
    toggleBtn.classList.remove("on");
    toggleBtn.setAttribute("aria-pressed", "false");
    if (compassEl) compassEl.style.removeProperty("--yaw");
    M.updateSvgSize();
    M.applyCam(true);
  }

  function toggle() { active ? exit() : enter(); }

  toggleBtn.addEventListener("click", toggle);

  window.__ME_25D = {
    get active() { return active; },
    enter, exit, toggle,
    setCamera(opts = {}) {
      flyAnim = null;
      if (opts.tx != null) c3.tx = c3.tTx = opts.tx;
      if (opts.tz != null) c3.tz = c3.tTz = opts.tz;
      if (opts.dist != null) c3.dist = c3.tDist = clamp(opts.dist, 130, 1900);
      if (opts.pitchDeg != null) c3.pitch = c3.tPitch = clamp(opts.pitchDeg * DEG, 22 * DEG, 78 * DEG);
      if (opts.yawDeg != null) c3.yaw = c3.tYaw = opts.yawDeg * DEG;
    },
    get camera() { return { tx: c3.tx, tz: c3.tz, dist: c3.dist, pitchDeg: +(c3.pitch / DEG).toFixed(1), yawDeg: +(c3.yaw / DEG).toFixed(1) }; },
    onUpdateMap(t) { if (inited) syncStateAtTime(t); },
    onBeaconLit(x, z, label) { if (inited && active) spawnBeacon3D(x, z, label); },
    syncFromCam(cx, cz, w) {
      if (!active || flyAnim) return;
      c3.tTx = cx; c3.tTz = cz; c3.tDist = distFromCamW(w);
      clampTarget();
    },
    flyTo(x, y, w, ms = 1200) {
      if (!active) return;
      const d = distFromCamW(w);
      if (ms <= 0) {
        flyAnim = null;
        c3.tx = c3.tTx = x; c3.tz = c3.tTz = y; c3.dist = c3.tDist = d;
        return;
      }
      flyAnim = {
        t0: performance.now(), ms: Math.max(180, ms),
        s: { tx: c3.tx, tz: c3.tz, dist: c3.dist, pitch: c3.pitch, yaw: c3.yaw },
        e: { tx: x, tz: y, dist: d, pitch: c3.tPitch, yaw: c3.tYaw }
      };
    },
    zoomBtn(f) {
      if (!active) return;
      flyAnim = null;
      c3.tDist = clamp(c3.tDist * f, 130, 1900);
    }
  };

  // 默认以 2.5D 手绘立体沙盘模式启动（仅当链接显式指定 #d=2 或浏览器不支持 WebGL 时回退 2D）
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("d") !== "2") {
    enter(true);
  }
})();
