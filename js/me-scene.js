/* 中洲纪年 · 关键时刻宽银幕场景画（大师插画升级版）
 * window.ME_SCENE(m, figs) → <svg viewBox="0 0 1200 520">…</svg>
 * 绘法：四层空气透视（天穹星象/云霭 → 远山剪影 → 受光中景建筑与水体倒影 → 暗部前景框景与体积光）
 *       并为标志性历史瞬间叠加专属叙事主体（三宝钻、天鹅港火海、白马洪流、史矛革焚城、巨鹰救主、白树开花等）。
 */
window.ME_SCENE = (function () {
  const W = 1200, H = 520;
  const BIG = { morgoth: 1.68, balrog: 1.52, smaug: 1.58, glaurung: 1.48, treebeard: 1.45, shelob: 1.38, sauron: 1.36, witchking: 1.18, eye: 1.35 };
  const MOOD = {
    fire:  { sky: ["#120402", "#481108", "#9e3412", "#eb7a28"], fog: "#ff9e42", mid: "#2d120c", far: "#4b1e14", land: "#160806", rim: "#ffb85c", p: "ember" },
    dark:  { sky: ["#06050a", "#171324", "#322946", "#584870"], fog: "#a892d4", mid: "#191524", far: "#2b243c", land: "#09070e", rim: "#c4b0ee", p: "dust" },
    light: { sky: ["#d8be78", "#f2df9e", "#fbf2cc", "#fffdf0"], fog: "#fff8d8", mid: "#7e6e48", far: "#a8986c", land: "#4e4329", rim: "#ffffff", p: "mote" },
    sea:   { sky: ["#071824", "#1b4256", "#4c7f90", "#b8dce0"], fog: "#dcf2f5", mid: "#163848", far: "#2b5868", land: "#0b1f29", rim: "#e8fbff", p: "spray" },
    storm: { sky: ["#090c12", "#1a202c", "#343d4e", "#606c80"], fog: "#adc0d8", mid: "#181e28", far: "#293240", land: "#0d1017", rim: "#d4e4f8", p: "rain" },
    dawn:  { sky: ["#18122b", "#4c2c4e", "#b0584c", "#f8b46a"], fog: "#ffd8a2", mid: "#2d1e34", far: "#58384c", land: "#18101e", rim: "#ffe4b0", p: "mote" },
    night: { sky: ["#02040c", "#09122b", "#16284c", "#2c4674"], fog: "#8caae2", mid: "#0d162c", far: "#1b2c4e", land: "#050812", rim: "#bcd4ff", p: "star" },
    gold:  { sky: ["#1e1404", "#583c10", "#aa7c28", "#f4ce72"], fog: "#ffe8a4", mid: "#3a280c", far: "#684a1a", land: "#1e1406", rim: "#fff2be", p: "mote" },
    blood: { sky: ["#100203", "#380908", "#781b10", "#c44422"], fog: "#ee6238", mid: "#240808", far: "#46120e", land: "#110303", rim: "#ff8c5a", p: "ember" },
    ice:   { sky: ["#6f8ca4", "#a4bed0", "#d6e5ee", "#f6fafc"], fog: "#ffffff", mid: "#5e7688", far: "#829cae", land: "#384a58", rim: "#ffffff", p: "snow" },
    ghost: { sky: ["#020807", "#081d18", "#123c32", "#286e5a"], fog: "#72f8cc", mid: "#0a221c", far: "#14382f", land: "#040d0b", rim: "#a8ffe4", p: "mote" },
  };

  /* —— 公共造型构件 —— */
  function clouds(c, y0 = 90, op = 0.16) {
    return `<g fill="${c.fog}" opacity="${op}">
      <path d="M-40,${y0 + 30} Q120,${y0 - 25} 310,${y0 + 15} T680,${y0 + 5} T1040,${y0 + 22} T1260,${y0} V${y0 + 65} H-40 Z"/>
      <path d="M80,${y0 + 65} Q280,${y0 + 20} 520,${y0 + 52} T960,${y0 + 38} T1240,${y0 + 60} V${y0 + 95} H80 Z" opacity=".65"/>
    </g>`;
  }
  function mtnRange(pts, fill, rimCol, op = 1) {
    let d = `M0,520 L0,${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i][0]},${pts[i][1]}`;
    d += ` L1200,520 Z`;
    let shade = "";
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [px, py] = pts[i], [nx, ny] = pts[i + 1];
      shade += `<path d="M${px},${py} L${nx},${ny} L${px + (nx - px) * 0.25},520 L${px - 18},520 Z" fill="#000" opacity=".22"/>`;
    }
    const ridge = `M${pts.map((p) => p.join(",")).join("L")}`;
    return `<g opacity="${op}"><path d="${d}" fill="${fill}"/>${shade}<path d="${ridge}" fill="none" stroke="${rimCol}" stroke-opacity=".28" stroke-width="1.3"/></g>`;
  }
  function col(x, w, h, f, rim, o = 1) {
    const hw = w / 2, y0 = 520 - h;
    return `<g opacity="${o}">
      <path d="M${x - hw - 9} 520L${x - hw} 494V${y0 + 20}L${x - hw - 12} ${y0}H${x + hw + 12}L${x + hw} ${y0 + 20}V494L${x + hw + 9} 520Z" fill="${f}"/>
      <path d="M${x - hw} ${y0 + 20}V494" stroke="${rim}" stroke-opacity=".28" stroke-width="1.6"/>
      <path d="M${x - hw * 0.42} ${y0 + 24}V490M${x} ${y0 + 24}V490M${x + hw * 0.42} ${y0 + 24}V490" stroke="#000" stroke-opacity=".34" stroke-width="2.4"/>
      <path d="M${x - hw - 10} ${y0 + 10}H${x + hw + 10}" stroke="${rim}" stroke-opacity=".22" stroke-width="1.2"/>
    </g>`;
  }
  function teeth(x, y, w, f, rim) {
    let s = "";
    for (let i = 0; i < w - 8; i += 20) {
      s += `<rect x="${x + i}" y="${y - 13}" width="12" height="14" fill="${f}"/><path d="M${x + i},${y - 13}h12" stroke="${rim}" stroke-opacity=".3" stroke-width="1"/>`;
    }
    return s;
  }
  function waves(y, c) {
    let s = `<rect y="${y - 4}" width="1200" height="${520 - y + 4}" fill="${c.mid}" opacity=".78"/>`;
    s += `<ellipse cx="600" cy="${y + 42}" rx="340" ry="52" fill="url(#gFog)" opacity=".38"/>`;
    for (let r = 0; r < 9; r++) {
      const yy = y + r * 15;
      s += `<path d="M0 ${yy}${Array.from({ length: 15 }, (_, i) => `Q${i * 86 + 43} ${yy - 6 - (r % 3) * 2.5} ${i * 86 + 86} ${yy}`).join("")}" stroke="${c.fog}" stroke-opacity="${(0.45 - r * 0.042).toFixed(2)}" fill="none" stroke-width="${1.2 + r * 0.22}"/>`;
    }
    return s;
  }
  function spears(c, banners = true) {
    let s = "";
    for (let i = 0; i < 64; i++) {
      const x = 14 + i * 18.5 + ((i * 37) % 9), h = 58 + ((i * 53) % 52), tilt = ((i * 19) % 7) - 3;
      s += `<path d="M${x} 446L${x + tilt} ${446 - h}" stroke="${c.land}" stroke-width="2.2"/><path d="M${x + tilt - 3} ${450 - h}L${x + tilt} ${434 - h}L${x + tilt + 3} ${450 - h}Z" fill="${c.rim}" opacity=".75"/>`;
      if (banners && i % 9 === 3) s += `<path d="M${x + tilt} ${444 - h}q20 5 38-2l-9 10l9 10q-18 5-38-2Z" fill="${c.fog}" opacity=".72"/>`;
    }
    return s;
  }
  function nobleTrees(dx, y, n, f, rim, o, mallorn = false) {
    let s = "";
    for (let i = 0; i < n; i++) {
      const x = dx + (i * 1240) / Math.max(1, n - 1), h = 155 + ((i * 71) % 110), w = 44 + ((i * 29) % 34);
      if (mallorn) {
        s += `<g opacity="${o}">
          <path d="M${x - 6},${y} Q${x - 3},${y - h * 0.5} ${x - 2},${y - h} H${x + 2} Q${x + 3},${y - h * 0.5} ${x + 7},${y} Z" fill="${f}"/>
          <path d="M${x - 1},${y - h * 0.55} Q${x - w * 0.45},${y - h * 0.72} ${x - w * 0.8},${y - h * 0.76} M${x + 1},${y - h * 0.62} Q${x + w * 0.45},${y - h * 0.78} ${x + w * 0.82},${y - h * 0.8}" stroke="${f}" stroke-width="4" fill="none"/>
          <ellipse cx="${x}" cy="${y - h}" rx="${w * 1.05}" ry="${w * 0.42}" fill="${f}"/>
          <ellipse cx="${x - w * 0.55}" cy="${y - h * 0.78}" rx="${w * 0.68}" ry="${w * 0.28}" fill="${f}"/>
          <ellipse cx="${x + w * 0.58}" cy="${y - h * 0.8}" rx="${w * 0.68}" ry="${w * 0.28}" fill="${f}"/>
          <ellipse cx="${x}" cy="${y - h - 4}" rx="${w * 0.82}" ry="${w * 0.2}" fill="${rim}" opacity=".18"/>
        </g>`;
      } else {
        s += `<g fill="${f}" opacity="${o}">
          <path d="M${x - 4.5},${y} L${x - 2},${y - h * 0.45} H${x + 2} L${x + 4.5},${y} Z"/>
          <path d="M${x},${y - h} L${x + w * 0.6},${y - h * 0.55} Q${x},${y - h * 0.48} ${x - w * 0.6},${y - h * 0.55} Z"/>
          <path d="M${x},${y - h * 0.8} L${x + w * 0.82},${y - h * 0.34} Q${x},${y - h * 0.26} ${x - w * 0.82},${y - h * 0.34} Z"/>
          <path d="M${x},${y - h * 0.56} L${x + w},${y - h * 0.12} Q${x},${y - h * 0.04} ${x - w},${y - h * 0.12} Z"/>
        </g>`;
      }
    }
    return s;
  }
  function flames(c) {
    let s = "";
    for (let i = 0; i < 22; i++) {
      const x = i * 58 + 10, h = 115 + ((i * 47) % 145);
      s += `<path d="M${x - 46} 472Q${x - 26} ${472 - h * 0.58} ${x + (i % 2 ? 8 : -8)} ${472 - h}Q${x + 28} ${472 - h * 0.55} ${x + 46} 472Z" fill="#ff${(50 + (i % 5) * 26).toString(16)}14" opacity=".62" class="sc-fl" style="animation-delay:${-i * 0.19}s"/>
            <path d="M${x - 22} 472Q${x - 10} ${472 - h * 0.42} ${x} ${472 - h * 0.74}Q${x + 12} ${472 - h * 0.42} ${x + 22} 472Z" fill="#ffe074" opacity=".42" class="sc-fl" style="animation-delay:${-i * 0.15}s"/>`;
    }
    return s;
  }
  function eagleSilhouette(x, y, sc = 1, rot = -8, col = "#2a1a0e", rim = "#ffe69c") {
    return `<g transform="translate(${x},${y}) scale(${sc}) rotate(${rot})">
      <path d="M0,0 C-18,-16 -52,-28 -92,-18 C-72,-8 -58,-2 -42,4 C-24,8 -10,6 0,4 C10,6 24,8 42,4 C58,-2 72,-8 92,-18 C52,-28 18,-16 0,0 Z" fill="${col}" stroke="${rim}" stroke-width="1.2" stroke-opacity=".65"/>
      <path d="M-8,3 L-18,22 L0,16 L18,22 L8,3 Z" fill="${col}"/>
      <path d="M0,-2 L4,-14 L12,-11 L5,-4 Z" fill="${rim}" opacity=".85"/>
    </g>`;
  }

  /* —— 基础十三类场景画 —— */
  const ART = {
    bridge: (c) => ({ gy: 332, x0: 380, x1: 820, s:
      `<path d="M0 175L180 88L420 148L620 68L840 138L1040 82L1200 155V0H0Z" fill="${c.mid}" opacity=".72"/>
       ${col(185, 48, 380, c.mid, c.rim, .55)}${col(1015, 48, 380, c.mid, c.rim, .55)}${col(345, 34, 320, c.far, c.rim, .38)}${col(855, 34, 320, c.far, c.rim, .38)}
       <ellipse cx="600" cy="520" rx="480" ry="250" fill="url(#gFog)" opacity=".95"/>
       <g transform="translate(120 195) scale(.8 .65)">${flames(c)}</g>
       <path d="M0 520V235L115 250L215 296L305 332L338 520Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".25"/>
       <path d="M1200 520V232L1085 254L985 296L895 332L862 520Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".25"/>
       <path d="M292 332Q600 296 908 332L908 348Q600 314 292 348Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".55" stroke-width="1.8"/>
       <path d="M318 520Q440 348 600 338Q760 348 882 520" fill="none" stroke="${c.land}" stroke-width="20" opacity=".82"/>
       ${col(68, 90, 430, c.land, c.rim)}${col(1132, 90, 430, c.land, c.rim)}` }),

    gate: (c) => ({ gy: 468, x0: 170, x1: 1030, s:
      `${clouds(c, 75, .14)}
       ${mtnRange([[0, 310], [170, 145], [320, 245], [510, 95], [680, 185], [865, 88], [1035, 225], [1200, 160]], c.far, c.rim, .52)}
       ${mtnRange([[0, 365], [235, 228], [430, 308], [770, 298], [975, 208], [1200, 345]], c.mid, c.rim, .78)}
       <rect x="240" y="288" width="720" height="182" fill="${c.land}" opacity=".92"/>${teeth(240, 288, 720, c.land, c.rim)}
       <path d="M402 470L418 145H518L530 470Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".22"/><path d="M670 470L682 145H782L798 470Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".22"/>
       <path d="M418 145L404 95L438 130L468 82L498 130L526 98L518 145Z" fill="${c.land}"/>
       <path d="M682 145L674 98L702 130L732 82L762 130L796 95L782 145Z" fill="${c.land}"/>
       <rect x="512" y="232" width="176" height="238" fill="${c.land}"/>${teeth(512, 232, 176, c.land, c.rim)}
       <path d="M536 470V316Q600 258 664 316V470Z" fill="#050306" stroke="${c.fog}" stroke-opacity=".5" stroke-width="2.6"/>
       <path d="M600 276V470M536 352H664M536 408H664" stroke="${c.mid}" stroke-width="3.2"/>
       <ellipse cx="600" cy="368" rx="56" ry="82" fill="url(#gFog)" opacity=".32"/>
       <rect x="0" y="468" width="1200" height="52" fill="${c.land}"/>` }),

    tower: (c) => ({ gy: 468, x0: 170, x1: 1030, s:
      `${clouds(c, 85, .18)}
       ${mtnRange([[0, 345], [210, 205], [410, 305], [650, 225], [895, 175], [1200, 325]], c.far, c.rim, .48)}
       <path d="M0 398Q300 338 600 368T1200 352V520H0Z" fill="${c.mid}" opacity=".76"/>
       <circle cx="600" cy="142" r="128" fill="url(#gFog)" opacity=".55"/>
       <path d="M536 470L554 286L542 274L562 136L538 64L585 98L600 28L615 98L662 64L638 136L658 274L646 286L664 470Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".35" stroke-width="1.4"/>
       <path d="M600 28V470L664 470L646 286L658 274L638 136L662 64L615 98Z" fill="#000" opacity=".32"/>
       <path d="M580 470V116M620 470V116" stroke="${c.rim}" stroke-opacity=".22" stroke-width="1.5"/>
       <ellipse cx="600" cy="76" rx="16" ry="7" fill="${c.fog}" opacity=".85"/>
       <rect x="0" y="468" width="1200" height="52" fill="${c.land}"/>` }),

    mountain: (c) => ({ gy: 468, x0: 150, x1: 1050, s:
      `${clouds(c, 70, .16)}
       ${mtnRange([[0, 375], [185, 240], [350, 315], [555, 172], [815, 285], [1025, 198], [1200, 335]], c.far, c.rim, .5)}
       <ellipse cx="578" cy="112" rx="165" ry="78" fill="${c.fog}" opacity=".38"/>
       <path d="M505 142Q440 52 320 12Q510 0 655 10Q790 36 648 145Z" fill="#180e0c" opacity=".68"/>
       <path d="M0 432L180 302L312 362L472 182L542 130L614 140L710 208L862 332L1015 276L1200 402V520H0Z" fill="${c.mid}"/>
       <path d="M578 134L614 140L710 208L862 332L760 520H560Z" fill="#000" opacity=".28"/>
       <path d="M542 130Q578 112 614 140" stroke="#ffb048" stroke-width="7.5" fill="none"/>
       <path d="M576 132Q558 225 512 312Q480 376 424 446" stroke="#ff641c" stroke-width="5" fill="none" opacity=".88"/>
       <path d="M576 132Q558 225 512 312" stroke="#fff09a" stroke-width="1.8" fill="none" opacity=".85"/>
       <path d="M592 140Q618 220 660 295" stroke="#ff822e" stroke-width="2.8" fill="none" opacity=".75"/>
       <rect x="0" y="468" width="1200" height="52" fill="${c.land}"/>` }),

    sea: (c) => ({ gy: 458, x0: 200, x1: 1000, s:
      `${clouds(c, 80, .2)}
       <circle cx="600" cy="232" r="105" fill="url(#gFog)" opacity=".55"/><circle cx="600" cy="232" r="48" fill="${c.fog}" opacity=".62"/>
       ${mtnRange([[0, 355], [160, 298], [340, 342], [520, 326], [780, 348], [995, 288], [1200, 355]], c.far, c.rim, .52)}
       ${waves(352, c)}
       <path d="M0 448Q200 424 420 452T820 446T1200 442V520H0Z" fill="${c.land}"/>` }),

    ship: (c) => ({ gy: 468, x0: 120, x1: 490, s:
      `${clouds(c, 75, .18)}
       <circle cx="880" cy="168" r="92" fill="url(#gFog)" opacity=".55"/><circle cx="880" cy="168" r="38" fill="#fffbe4" opacity=".68"/>
       ${waves(368, c)}
       <g transform="translate(800 330)">
         <ellipse cx="0" cy="72" rx="185" ry="14" fill="${c.fog}" opacity=".22"/>
         <path d="M-168 36Q-190 4-170-26Q-156-44-142-28Q-136-20-144-8Q-152 10-134 38Q0 82 146 34Q170 10 186-26Q196-6 174 28L140 68Q0 106-136 68Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".42" stroke-width="1.4"/>
         <path d="M-168-24Q-160-42-144-34Q-138-28-146-20" fill="#fff8dc"/>
         <path d="M-126 48Q0 82 128 46" stroke="${c.rim}" stroke-opacity=".45" stroke-width="2" fill="none"/>
         <path d="M0 42V-182" stroke="${c.land}" stroke-width="6.5"/>
         <path d="M6-172Q118-96 16 24Q-4-42 6-172Z" fill="#fbf7ec" opacity=".95"/>
         <path d="M-6-158Q-98-84-8 24Q4-38-6-158Z" fill="#e8dfc8" opacity=".84"/>
         <path d="M0-182L-78 22M0-182L84 22" stroke="${c.fog}" stroke-opacity=".35" stroke-width="1.2"/>
         <circle cx="0" cy="-192" r="22" fill="${c.fog}" opacity=".4"/><path d="M0-208L3-195L16-192L3-189L0-176L-3-189L-16-192L-3-195Z" fill="#ffffff"/>
       </g>
       <path d="M0 466Q280 434 580 466T1200 462V520H0Z" fill="${c.land}"/>` }),

    throne: (c) => ({ gy: 458, x0: 220, x1: 980, s:
      `<path d="M100 460V74Q350 4 600 74Q850 4 1100 74V460" fill="none" stroke="${c.mid}" stroke-width="22" opacity=".65"/>
       <path d="M340 0L480 460H720L860 0Z" fill="url(#gFog)" opacity=".28"/>
       ${[125, 285, 915, 1075].map((x) => col(x, 56, 465, c.mid, c.rim, .92)).join("")}
       <path d="M420 460L455 412H745L780 460Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".28"/>
       <path d="M468 412L492 376H708L732 412Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".32"/>
       <path d="M532 376V176L564 140L600 90L636 140L668 176V376Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".42" stroke-width="1.6"/>
       <circle cx="600" cy="162" r="22" fill="none" stroke="${c.rim}" stroke-opacity=".48" stroke-width="2"/>
       <path d="M600,144L604,158L618,162L604,166L600,180L596,166L582,162L596,158Z" fill="${c.fog}" opacity=".7"/>
       <rect x="0" y="458" width="1200" height="62" fill="${c.land}"/>` }),

    cave: (c) => ({ gy: 450, x0: 280, x1: 920, s:
      `<rect width="1200" height="520" fill="${c.mid}" opacity=".82"/>
       <path d="M135 520Q125 162 600 98Q1075 162 1065 520Z" fill="#030306" opacity=".78"/>
       <ellipse cx="600" cy="454" rx="360" ry="38" fill="${c.fog}" opacity=".22"/>
       <ellipse cx="600" cy="462" rx="230" ry="18" fill="${c.fog}" opacity=".35"/>
       <path d="M0 0H1200V96Q920 158 600 110T0 128Z" fill="${c.land}"/>
       <path d="M0 520V108L195 212L148 368L235 450H0ZM1200 520V108L1005 218L1052 365L965 450H1200Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".18"/>
       ${[210, 315, 430, 560, 690, 815, 945].map((x, i) => `<path d="M${x} ${92 + (i % 3) * 12}l${11 + (i % 2) * 6} ${68 + (i % 3) * 34}l${11 + (i % 2) * 6} -${68 + (i % 3) * 34}Z" fill="${c.land}"/>`).join("")}
       <rect x="0" y="450" width="1200" height="70" fill="${c.land}"/>` }),

    field: (c) => ({ gy: 450, x0: 140, x1: 1060, s:
      `${clouds(c, 88, .18)}
       ${mtnRange([[0, 318], [205, 238], [450, 302], [720, 222], [980, 292], [1200, 244]], c.far, c.rim, .45)}
       <path d="M0 364Q300 328 600 350T1200 338V520H0Z" fill="${c.mid}" opacity=".72"/>
       ${spears(c)}
       <path d="M0 450Q300 422 600 442T1200 432V520H0Z" fill="${c.land}"/>` }),

    forest: (c) => ({ gy: 458, x0: 230, x1: 970, s:
      `<g opacity=".22" fill="${c.fog}"><polygon points="260,0 410,460 525,460 330,0"/><polygon points="550,0 715,460 835,460 625,0"/><polygon points="815,0 975,460 1065,460 870,0"/></g>
       ${nobleTrees(10, 396, 22, c.far, c.rim, .48)}${nobleTrees(-18, 430, 15, c.mid, c.rim, .78)}${nobleTrees(-32, 462, 10, c.land, c.rim, 1)}
       <rect x="0" y="458" width="1200" height="62" fill="${c.land}"/>` }),

    fire: (c) => ({ gy: 460, x0: 200, x1: 1000, s:
      `${clouds(c, 68, .22)}
       ${mtnRange([[0, 348], [200, 224], [430, 308], [690, 194], [940, 286], [1200, 215]], c.mid, c.rim, .62)}
       ${flames(c)}
       <path d="M0 460L260 448L540 462L860 446L1200 460V520H0Z" fill="${c.land}"/>
       <path d="M160 476Q420 460 620 484T1060 470" stroke="#ff8824" stroke-width="3.2" fill="none" opacity=".75"/>` }),

    ring: (c) => ({ gy: 468, x0: 130, x1: 1070, s:
      `${mtnRange([[0, 370], [240, 275], [510, 348], [820, 265], [1200, 358]], c.mid, c.rim, .52)}
       <circle cx="600" cy="222" r="225" fill="url(#gFog)" opacity=".68"/>
       <circle cx="600" cy="222" r="130" fill="none" stroke="#3a1604" stroke-width="34" opacity=".65"/>
       <circle cx="600" cy="222" r="130" fill="none" stroke="#c88218" stroke-width="26" opacity=".92"/>
       <circle cx="600" cy="222" r="130" fill="none" stroke="#f7d266" stroke-width="17"/>
       <circle cx="600" cy="222" r="120" fill="none" stroke="#fff8c8" stroke-width="2.6" opacity=".88"/>
       <circle cx="600" cy="222" r="130" fill="none" stroke="#fffae4" stroke-width="2.6" stroke-dasharray="7 5 4 4 11 6 3 4 9 5" stroke-linecap="round" opacity=".92"/>
       <path d="M0 468Q600 424 1200 468V520H0Z" fill="${c.land}"/>` }),

    wall: (c) => ({ gy: 468, x0: 130, x1: 1070, s:
      `${clouds(c, 75, .18)}
       ${mtnRange([[0, 245], [190, 134], [390, 228], [640, 114], [910, 218], [1200, 155]], c.far, c.rim, .48)}
       <path d="M0 290L240 310L300 210L420 230L470 305H1200V520H0Z" fill="${c.mid}" opacity=".72"/>
       <rect x="232" y="182" width="160" height="288" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".28"/>${teeth(232, 182, 160, c.land, c.rim)}
       <path d="M294 182L302 92L312 70L322 92L330 182Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".3"/>
       <rect x="380" y="294" width="820" height="176" fill="${c.land}"/>${teeth(380, 294, 820, c.land, c.rim)}
       <path d="M390 334H1190" stroke="${c.rim}" stroke-opacity=".28" stroke-width="2"/>
       <path d="M558 470Q610 382 662 470Z" fill="#050508" opacity=".82"/>
       <rect x="0" y="468" width="1200" height="52" fill="${c.land}"/>` }),

    river: (c) => ({ gy: 468, x0: 140, x1: 1060, s:
      `${clouds(c, 80, .16)}
       ${mtnRange([[0, 318], [240, 214], [430, 302], [620, 198], [860, 292], [1060, 205], [1200, 262]], c.mid, c.rim, .58)}
       <path d="M456 228L470 146L490 120L506 150L514 228ZM686 228L696 146L716 120L734 150L742 228Z" fill="${c.land}" opacity=".85" stroke="${c.rim}" stroke-opacity=".25"/>
       <path d="M425 520Q530 412 585 348T615 262L646 262Q636 314 666 365T795 520Z" fill="${c.fog}" opacity=".46"/>
       <path d="M485 504Q565 420 605 352M548 512Q605 428 632 352" stroke="#ffffff" stroke-width="2.2" fill="none" opacity=".68"/>
       <path d="M0 468Q280 444 500 468L720 468Q920 444 1200 468V520H0Z" fill="${c.land}"/>` }),

    erech: (c) => ({ gy: 458, x0: 220, x1: 980, s:
      `${mtnRange([[0, 320], [170, 134], [360, 258], [600, 88], [840, 248], [1030, 126], [1200, 308]], c.mid, c.rim, .58)}
       <path d="M552 260L600 150L648 260Z" fill="#020605" stroke="${c.fog}" stroke-opacity=".45" stroke-width="1.6"/>
       <ellipse cx="600" cy="365" rx="410" ry="105" fill="url(#gFog)" opacity=".62"/>
       ${Array.from({ length: 36 }, (_, i) => { const x = 80 + i * 29 + (i % 3) * 5, h = 78 + (i % 5) * 16; return `<path d="M${x} 445L${x - 2} ${445 - h}" stroke="${c.fog}" stroke-opacity=".46" stroke-width="2"/><path d="M${x - 5} ${448 - h}L${x - 2} ${432 - h}L${x + 1} ${448 - h}Z" fill="${c.fog}" opacity=".68"/>`; }).join("")}
       <path d="M0 460Q320 418 600 406Q880 418 1200 460V520H0Z" fill="${c.land}"/>
       <ellipse cx="600" cy="376" rx="70" ry="64" fill="#040807" stroke="${c.fog}" stroke-opacity=".65" stroke-width="2.4"/>
       <ellipse cx="578" cy="354" rx="26" ry="15" fill="${c.fog}" opacity=".24" transform="rotate(-25 578 354)"/>` }),
  };

  /* —— 标志性关键时刻专属叙事主体（叠加/定制） —— */
  const HERO_SCENE = {
    "feanor-oath": (c) => ({ gy: 462, x0: 280, x1: 920, s:
      `${clouds(c, 70, .2)}
       <path d="M0 390L240 240L520 310L600 180L680 310L960 240L1200 390V520H0Z" fill="${c.mid}" opacity=".68"/>
       <!-- 提力安白塔明登·埃尔达丽爱瓦 -->
       <path d="M578 320V82L600 34L622 82V320Z" fill="#f7f2e2" opacity=".88"/>
       <circle cx="600" cy="48" r="34" fill="url(#gFog)" opacity=".85"/><circle cx="600" cy="48" r="8" fill="#ffffff"/>
       <!-- 高阶火把广场与三颗精灵宝钻 -->
       ${[-120, 0, 120].map((dx, i) => `<g transform="translate(${600 + dx},${158 - (i === 1 ? 22 : 0)})"><circle r="32" fill="#fffbe0" opacity=".28"/><circle r="14" fill="#fff8c8" opacity=".55"/><path d="M0,-18L4,-4L18,0L4,4L0,18L-4,4L-18,0L-4,-4Z" fill="#ffffff"/></g>`).join("")}
       <g opacity=".75">${flames(c)}</g>
       <path d="M260 462L360 392H840L940 462Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".4"/>
       <path d="M320 426H880M345 408H855" stroke="${c.rim}" stroke-opacity=".28" stroke-width="1.5"/>
       <rect x="0" y="462" width="1200" height="58" fill="${c.land}"/>` }),

    "kinslaying-losgar": (c) => ({ gy: 468, x0: 140, x1: 520, s:
      `${ART.ship(c).s}
       <g transform="translate(560,0) scale(.58,1)">${flames(c)}</g>
       <ellipse cx="810" cy="340" rx="220" ry="90" fill="#ff5a14" opacity=".32"/>` }),

    "fingon-maedhros": (c) => ({ gy: 468, x0: 260, x1: 780, s:
      `${ART.mountain(c).s}
       ${eagleSilhouette(820, 148, 1.35, -14, c.land, c.rim)}
       ${eagleSilhouette(960, 96, 0.72, -8, c.mid, c.rim)}` }),

    "downfall-numenor": (c) => ({ gy: 462, x0: 220, x1: 980, s:
      `${clouds(c, 55, .28)}
       <!-- 撕裂天穹的闪电与陆沉巨浪 -->
       <path d="M360,0 L330,95 L372,108 L318,235 M840,0 L875,85 L830,105 L888,245" stroke="#eef6ff" stroke-width="3" fill="none" opacity=".82"/>
       <path d="M490 360 A110 85 0 0 1 710 360 Z" fill="#d8ae48" opacity=".55"/>
       <path d="M0 280 C180 120 390 135 510 330 C390 250 240 270 160 380 Z M1200 260 C1010 105 800 125 690 330 C810 245 960 265 1040 380 Z" fill="${c.mid}" stroke="${c.fog}" stroke-opacity=".55" stroke-width="2"/>
       ${waves(355, c)}
       <path d="M0 460Q300 432 600 464T1200 456V520H0Z" fill="${c.land}"/>` }),

    "black-arrow": (c) => ({ gy: 462, x0: 180, x1: 620, s:
      `${clouds(c, 60, .24)}
       <!-- 史矛革盘旋火海长湖镇 -->
       <g transform="translate(815,152) rotate(12) scale(1.45)">
         <path d="M-120,-18 C-75,-78 -15,-92 22,-32 C68,-98 135,-80 155,-12 C105,-22 65,-8 32,12 C12,24 -12,24 -32,12 C-68,-8 -95,-16 -120,-18 Z" fill="#220704" stroke="#ff9a36" stroke-width="1.4" stroke-opacity=".75"/>
         <path d="M-95,12 Q-35,-6 18,4 L48,-6 L34,8 L52,14 L18,16 Q-35,24 -95,12 Z" fill="#360b06"/>
         <path d="M52,10 Q105,22 155,62 Q98,46 48,20 Z" fill="#ff9428" opacity=".85"/>
       </g>
       ${waves(378, c)}
       <g transform="translate(480,-12) scale(.62,1)">${flames(c)}</g>
       ${[620, 740, 860, 980].map((x, i) => `<g fill="${c.land}"><path d="M${x - 36},465 V385 L${x},${345 - (i % 2) * 18} L${x + 36},385 V465 Z"/><path d="M${x - 28},465 V495 M${x},465 V495 M${x + 28},465 V495" stroke="${c.land}" stroke-width="5"/></g>`).join("")}
       <path d="M0 462L380 454L520 468H0V520H1200V482L620 476Z" fill="${c.land}"/>` }),

    "ford-of-bruinen": (c) => ({ gy: 466, x0: 180, x1: 1020, s:
      `${ART.river(c).s}
       <!-- 白马浪头 -->
       ${[440, 525, 610, 695, 775].map((x, i) => `<g transform="translate(${x},${388 + (i % 2) * 18}) scale(${0.9 + (i % 2) * 0.2})">
         <path d="M-36,28 Q-28,-8 -6,-22 L6,-34 L12,-20 L26,-16 L16,-4 Q8,6 14,28 Z" fill="#f4fbff" opacity=".88"/>
         <path d="M-24,26 Q-18,0 0,-16" stroke="#9ad0ea" stroke-width="2.2" fill="none"/>
       </g>`).join("")}` }),

    "council-of-elrond": (c) => ({ gy: 464, x0: 180, x1: 1020, s:
      `${mtnRange([[0, 300], [180, 155], [390, 245], [600, 145], [820, 240], [1020, 150], [1200, 290]], c.far, c.rim, .42)}
       <path d="M210,165 Q225,280 218,464 M985,158 Q970,280 978,464" stroke="#ffffff" stroke-width="6" fill="none" opacity=".62"/>
       ${nobleTrees(40, 458, 9, c.mid, c.rim, .65, true)}
       ${[130, 310, 890, 1070].map((x) => col(x, 42, 430, c.land, c.rim, .9)).join("")}
       <path d="M90,95 Q350,20 600,90 Q850,20 1110,95" fill="none" stroke="${c.land}" stroke-width="14"/>
       <!-- 石台与魔戒 -->
       <path d="M566,464 L574,408 H626 L634,464 Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".45"/>
       <circle cx="600" cy="392" r="28" fill="url(#gFog)" opacity=".85"/>
       <circle cx="600" cy="394" r="9" fill="none" stroke="#f5c84c" stroke-width="3.4"/>
       <rect x="0" y="464" width="1200" height="56" fill="${c.land}"/>` }),

    "galadriel-mirror": (c) => ({ gy: 462, x0: 250, x1: 950, s:
      `<g opacity=".24" fill="${c.fog}"><polygon points="320,0 480,462 580,462 390,0"/><polygon points="880,0 620,462 720,462 810,0"/></g>
       ${nobleTrees(0, 445, 11, c.mid, c.rim, .72, true)}
       ${nobleTrees(-30, 464, 6, c.land, c.rim, .96, true)}
       <!-- 凯兰崔尔的水镜银盆 -->
       <ellipse cx="600" cy="410" rx="68" ry="26" fill="url(#gFog)" opacity=".85"/>
       <path d="M582,462 L588,422 H612 L618,462 Z" fill="${c.land}" stroke="${c.rim}" stroke-opacity=".5"/>
       <path d="M558,414 Q600,432 642,414 Z" fill="#dce8f4" stroke="#ffffff" stroke-width="1.5"/>
       <path d="M600,348 L603,362 L617,365 L603,368 L600,382 L597,368 L583,365 L597,362 Z" fill="#ffffff"/>
       <rect x="0" y="462" width="1200" height="58" fill="${c.land}"/>` }),

    "ride-of-the-rohirrim": (c) => ({ gy: 454, x0: 140, x1: 940, s:
      `${clouds(c, 82, .22)}
       <circle cx="960" cy="245" r="145" fill="url(#gFog)" opacity=".78"/><circle cx="960" cy="245" r="56" fill="#fff6cc" opacity=".75"/>
       ${mtnRange([[0, 325], [220, 238], [480, 305], [760, 245], [960, 168], [1200, 268]], c.far, c.rim, .52)}
       <!-- 远方受围的白城米那斯提力斯剪影 -->
       <g transform="translate(985,346) scale(1.18)" fill="${c.mid}" stroke="${c.rim}" stroke-opacity=".35">
         <path d="M-75,0 H75 L62,-18 H-62 Z M-56,-18 H56 L44,-36 H-44 Z M-38,-36 H38 L26,-54 H-26 Z M-18,-54 H18 L10,-72 H-10 Z"/>
         <path d="M-5,-72 V-106 L0,-118 L5,-106 V-72 Z"/><path d="M0,-92 L38,4 L0,6 Z" fill="${c.land}"/>
       </g>
       <path d="M0 368Q300 332 600 354T1200 344V520H0Z" fill="${c.mid}" opacity=".76"/>
       ${spears(c)}
       <path d="M0 454Q300 426 600 444T1200 436V520H0Z" fill="${c.land}"/>` }),

    "eagles-rescue": (c) => ({ gy: 464, x0: 220, x1: 980, s:
      `${ART.mountain(c).s}
       <g opacity=".65">${flames(c)}</g>
       ${eagleSilhouette(360, 145, 1.42, 10, "#241408", "#ffe89e")}
       ${eagleSilhouette(600, 96, 1.65, -4, "#1c0e06", "#fff2be")}
       ${eagleSilhouette(855, 158, 1.28, -14, "#241408", "#ffe89e")}` }),

    "coronation": (c) => ({ gy: 460, x0: 220, x1: 980, s:
      `${ART.throne(c).s}
       <!-- 盛开的刚铎白树与七星 -->
       <g transform="translate(600,368)">
         <circle cy="-95" r="78" fill="url(#gFog)" opacity=".55"/>
         <path d="M-4,0 Q-2,-45 0,-85 M0,-52 Q-28,-74 -52,-82 M0,-62 Q28,-82 52,-88 M0,-74 Q-18,-98 -32,-112 M0,-76 Q18,-100 34,-114" stroke="#f8f4e8" stroke-width="3.2" fill="none" stroke-linecap="round"/>
         ${[[-54, -84], [-34, -114], [0, -124], [36, -116], [54, -88], [-22, -92], [22, -94]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#ffffff" opacity=".92"/><path d="M${x},${y - 16}l1.8,4.2l4.2,1.8l-4.2,1.8l-1.8,4.2l-1.8,-4.2l-4.2,-1.8l4.2,-1.8z" fill="#fffbe0"/>`).join("")}
       </g>` }),
  };

  function particles(kind, c) {
    let s = ""; const N = { ember: 46, dust: 28, mote: 36, spray: 32, rain: 78, star: 85, snow: 68 }[kind] || 0;
    for (let i = 0; i < N; i++) {
      const x = (i * 263) % W, y = (i * 151) % H, d = ((i * 7) % 10) / 2, du = 4 + ((i * 13) % 7);
      if (kind === "star") {
        const sy = (y * 0.62) | 0, r = 0.6 + (i % 3) * 0.55;
        s += i % 9 === 0
          ? `<path d="M${x},${sy - 5}L${x + 1.2},${sy - 1.2}L${x + 5},${sy}L${x + 1.2},${sy + 1.2}L${x},${sy + 5}L${x - 1.2},${sy + 1.2}L${x - 5},${sy}L${x - 1.2},${sy - 1.2}Z" fill="#fffbe8" class="sc-tw" style="animation-delay:-${d}s"/>`
          : `<circle cx="${x}" cy="${sy}" r="${r}" fill="#fff" class="sc-tw" style="animation-delay:-${d}s"/>`;
      }
      else if (kind === "rain") s += `<path d="M${x} ${y}l-11 28" stroke="#c8d6e8" stroke-opacity=".38" class="sc-rain" style="animation-delay:-${d / 5}s;animation-duration:${0.48 + (i % 4) * 0.1}s"/>`;
      else s += `<circle cx="${x}" cy="${y}" r="${kind === "snow" ? 2.3 : kind === "ember" ? 1.9 : 1.5}" fill="${kind === "ember" ? "#ffb454" : kind === "snow" ? "#fff" : c.fog}" class="sc-p sc-${kind}" style="animation-delay:-${d}s;animation-duration:${du}s" opacity=".85"/>`;
    }
    return s;
  }

  return function (m, figs) {
    const c = MOOD[m.mood] || MOOD.dark;
    const builder = HERO_SCENE[m.id] || ART[m.art] || ART.field;
    const a = builder(c);
    const u = "sc" + Math.random().toString(36).slice(2, 7);
    const n = figs.length, sc = n > 2 ? 2.45 : 3.05;
    const gap = n > 1 ? Math.min(255, (a.x1 - a.x0) / (n - 1)) : 0, cx0 = (a.x0 + a.x1) / 2 - (gap * (n - 1)) / 2;
    const fig = figs.map((id, i) => {
      const x = n > 1 ? cx0 + i * gap : (a.x0 + a.x1) / 2, flip = n > 1 && i >= n / 2 ? -1 : 1, k = BIG[id] || 1;
      return `<g class="sc-fig" style="animation-delay:${0.45 + i * 0.22}s">
        <ellipse cx="${x}" cy="${a.gy + 4}" rx="${24 * sc}" ry="${5.5 * sc}" fill="#000" opacity=".46"/>
        <ellipse cx="${x}" cy="${a.gy - 42 * sc * k}" rx="${18 * sc * k}" ry="${26 * sc * k}" fill="${c.fog}" opacity=".12"/>
        <g filter="url(#${u}rim)"><use href="#chb-${id}" transform="translate(${x} ${a.gy}) scale(${sc * k * flip} ${sc * k})"/></g>
      </g>`;
    }).join("");
    const s = a.s.replace(/url\(#gFog\)/g, `url(#${u}f)`);
    const fg = `<path d="M0 520V365L52 408L94 462L162 494L255 520ZM1200 520V358L1142 404L1098 458L1028 492L940 520Z" fill="#040203" opacity=".76"/>` +
      `<path d="M${a.x0 - 50} ${a.gy}Q600 ${a.gy - 7} ${a.x1 + 50} ${a.gy}" stroke="${c.rim}" stroke-opacity=".35" stroke-width="2.2" fill="none"/>`;
    const rays = `<g opacity=".18" fill="${c.fog}"><polygon points="600,-50 320,${a.gy} 435,${a.gy}"/><polygon points="600,-50 548,${a.gy} 652,${a.gy}"/><polygon points="600,-50 765,${a.gy} 880,${a.gy}"/></g>`;
    return `<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
      <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.sky[0]}"/><stop offset=".38" stop-color="${c.sky[1]}"/>
        <stop offset=".74" stop-color="${c.sky[2]}"/><stop offset="1" stop-color="${c.sky[3]}"/>
      </linearGradient>
      <radialGradient id="${u}f"><stop offset="0" stop-color="${c.fog}" stop-opacity=".95"/><stop offset=".55" stop-color="${c.fog}" stop-opacity=".35"/><stop offset="1" stop-color="${c.fog}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${u}v" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></radialGradient>
      <filter id="${u}rim" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="-1.5" stdDeviation="1.8" flood-color="${c.rim}" flood-opacity=".55"/>
      </filter></defs>
      <rect width="${W}" height="${H}" fill="url(#${u}s)"/>
      <ellipse cx="600" cy="${a.gy - 70}" rx="560" ry="235" fill="url(#${u}f)" opacity=".46" class="sc-glow"/>${rays}
      <g class="sc-far">${particles(c.p === "rain" || c.p === "star" ? c.p : "", c)}</g>
      <g class="sc-mid">${s}</g>${fig}
      <g class="sc-near">${fg}${c.p !== "rain" && c.p !== "star" ? particles(c.p, c) : ""}</g>
      <rect width="${W}" height="${H}" fill="url(#${u}v)"/>
      <!-- 托尔金泥金藏书票双线画框与四角星芒 -->
      <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="4" fill="none" stroke="${c.rim}" stroke-opacity=".34" stroke-width="1.3"/>
      <rect x="15" y="15" width="${W - 30}" height="${H - 30}" rx="2" fill="none" stroke="${c.rim}" stroke-opacity=".16" stroke-width=".8"/>
      <g fill="${c.rim}" opacity=".62">
        <path d="M18,12L19.5,16.5L24,18L19.5,19.5L18,24L16.5,19.5L12,18L16.5,16.5Z"/>
        <path d="M${W - 18},12L${W - 16.5},16.5L${W - 12},18L${W - 16.5},19.5L${W - 18},24L${W - 19.5},19.5L${W - 24},18L${W - 19.5},16.5Z"/>
        <path d="M18,${H - 24}L19.5,${H - 19.5}L24,${H - 18}L19.5,${H - 16.5}L18,${H - 12}L16.5,${H - 16.5}L12,${H - 18}L16.5,${H - 19.5}Z"/>
        <path d="M${W - 18},${H - 24}L${W - 16.5},${H - 19.5}L${W - 12},${H - 18}L${W - 16.5},${H - 16.5}L${W - 18},${H - 12}L${W - 19.5},${H - 16.5}L${W - 24},${H - 18}L${W - 19.5},${H - 19.5}Z"/>
      </g></svg>`;
  };
})();
