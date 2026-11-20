/* 中洲纪年 · 趣味探索、真知晶石漫游、至尊戒幽影界、西境红皮书图鉴、黑暗猜谜与吟游竖琴音景
 * 纯前端零外部依赖（SVG + Web Audio + LocalStorage），支持完整中英双语。
 */
(function () {
  "use strict";
  const EN = window.ME_LANG === "en";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const L = (zh, en) => (EN ? en : zh);

  const M = window.__ME;
  const D = window.ME, W = window.WORLD, CH = window.ME_CHARS || { CHARS: [] }, LIFE = window.ME_LIFE || {};
  const BATTLES = window.ME_BATTLES || [];
  if (!M || !D) return;

  /* ======================= 1. 吟游琴音与交互微音效 (Web Audio) ======================= */
  const Bard = (() => {
    let ctx = null, master = null, on = false, timer = 0, stepIdx = 0;
    // 各纪元音阶（Hz）：双树纪-利底亚仙音 / 第一纪元-爱奥利亚史诗 / 第二纪元-多利亚海风 / 第三纪元-夏尔五声田园 / 魔戒大战-低音号角五度 / 第四纪元-宁静大调
    const SCALES = {
      trees:  [261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 523.25, 659.25],
      fa:     [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 523.25],
      sa:     [246.94, 277.18, 293.66, 329.63, 369.99, 415.30, 440.00, 493.88, 587.33],
      ta:     [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25],
      hobbit: [293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 587.33],
      war:    [146.83, 174.61, 220.00, 261.63, 293.66, 329.63, 440.00],
      fo:     [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25],
    };
    const PAT = [0, 2, 4, 3, 5, 4, 2, 1, 0, 4, 6, 5, 3, 2, 4, 0];

    function ensure() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.24;
      master.connect(ctx.destination);
    }
    function pluck(freq, dur = 2.2, vol = 0.18, type = "triangle", delay = 0) {
      if (!on || !ctx) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = type;
      osc2.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      osc2.frequency.setValueAtTime(freq * 2, t0);
      flt.type = "lowpass";
      flt.frequency.setValueAtTime(freq * 4.2, t0);
      flt.frequency.exponentialRampToValueAtTime(Math.max(240, freq * 1.3), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const g2 = ctx.createGain();
      g2.gain.value = 0.22;
      osc.connect(flt);
      osc2.connect(g2).connect(flt);
      flt.connect(g).connect(master);
      osc.start(t0); osc2.start(t0);
      osc.stop(t0 + dur + 0.05); osc2.stop(t0 + dur + 0.05);
    }
    function tick() {
      if (!on) return;
      if (!document.body.classList.contains("in-battle")) {
        const era = document.body.dataset.era || "ta";
        const sc = SCALES[era] || SCALES.ta;
        const idx = PAT[stepIdx % PAT.length] % sc.length;
        const f = sc[idx];
        const isWar = era === "war";
        pluck(f, isWar ? 3.1 : 2.5, isWar ? 0.14 : 0.16, isWar ? "sawtooth" : "triangle");
        if (stepIdx % 4 === 0) pluck(sc[0] * 0.5, 3.8, 0.11, "sine", 0.02);
        if (stepIdx % 6 === 3 && !isWar) pluck(sc[(idx + 2) % sc.length] * 2, 1.9, 0.06, "sine", 0.22);
        stepIdx++;
      }
      const era = document.body.dataset.era || "ta";
      const gap = era === "war" ? 1350 : era === "trees" ? 1050 : 860;
      timer = setTimeout(tick, gap + Math.random() * 260);
    }
    function forcePluck(freq, dur = 1.6, vol = 0.12, type = "triangle", delay = 0) {
      try {
        ensure();
        if (ctx.state === "suspended") ctx.resume();
        const prev = on; on = true;
        pluck(freq, dur, vol, type, delay);
        on = prev;
      } catch (e) {}
    }
    function sfx(kind, force = false) {
      if (!on && !force) return;
      try {
        ensure();
        if (ctx.state === "suspended") ctx.resume();
      } catch (e) { return; }
      const p = force ? forcePluck : pluck;
      if (kind === "chime") {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => p(f, 1.4, 0.1, "sine", i * 0.07));
      } else if (kind === "palantir") {
        [392, 493.88, 587.33, 739.99, 987.77].forEach((f, i) => p(f, 1.9, 0.11, "sine", i * 0.08));
      } else if (kind === "wraith") {
        [146.83, 155.56, 220].forEach((f, i) => p(f, 2.8, 0.13, "sawtooth", i * 0.1));
      } else if (kind === "beacon") {
        [293.66, 440, 587.33].forEach((f, i) => p(f, 1.5, 0.11, "triangle", i * 0.06));
      } else if (kind === "doors") {
        [196, 293.66, 392, 493.88, 587.33, 783.99].forEach((f, i) => p(f, 2.4, 0.12, "sine", i * 0.09));
      } else if (kind === "tap") {
        p(587.33, 0.65, 0.08, "triangle");
      } else if (kind === "wrong") {
        p(196, 0.8, 0.12, "sawtooth"); p(185, 0.9, 0.12, "sawtooth", 0.12);
      }
    }
    function toggle() {
      on = !on;
      if (on) {
        ensure();
        if (ctx.state === "suspended") ctx.resume();
        sfx("chime");
        clearTimeout(timer);
        timer = setTimeout(tick, 500);
      } else {
        clearTimeout(timer);
      }
      const btn = $("#musicBtn");
      if (btn) btn.classList.toggle("on", on);
      return on;
    }
    return { toggle, sfx, get on() { return on; } };
  })();

  if ($("#musicBtn")) {
    $("#musicBtn").addEventListener("click", () => Bard.toggle());
  }

  /* ======================= 2. 西境红皮书探索记录与徽章系统 ======================= */
  const STORE_KEY = "me-redbook-v1";
  const state = { places: [], chars: [], moments: [], battles: [], riddlesWon: false, beaconsLit: false, doorsOpened: false };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (raw && typeof raw === "object") {
      ["places", "chars", "moments", "battles"].forEach((k) => { if (Array.isArray(raw[k])) state[k] = raw[k]; });
      state.riddlesWon = !!raw.riddlesWon;
      state.beaconsLit = !!raw.beaconsLit;
      state.doorsOpened = !!raw.doorsOpened;
    }
  } catch (e) {}

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    updateCodexBadge();
  }
  const TOTAL_PLACES = D.PLACES.length + (LIFE.LANDMARKS || []).length;
  const TOTAL_CHARS = (CH.CHARS || []).length;
  const TOTAL_MOMENTS = (M.MO || []).length;
  const TOTAL_BATTLES = BATTLES.length;

  function totalProgressPct() {
    const got = state.places.length + state.chars.length + state.moments.length + state.battles.length * 3 + (state.riddlesWon ? 5 : 0) + (state.beaconsLit ? 3 : 0) + (state.doorsOpened ? 3 : 0);
    const all = TOTAL_PLACES + TOTAL_CHARS + TOTAL_MOMENTS + TOTAL_BATTLES * 3 + 11;
    return Math.min(100, Math.round((got / Math.max(1, all)) * 100));
  }
  function updateCodexBadge() {
    const el = $("#codexPct");
    if (!el) return;
    const pct = totalProgressPct();
    el.textContent = pct > 0 ? `${pct}%` : "";
  }
  updateCodexBadge();

  window.addEventListener("me:visit", (e) => {
    const { type, id } = e.detail || {};
    if (!id) return;
    Bard.sfx("tap");
    const map = { place: "places", char: "chars", moment: "moments", battle: "battles" };
    const key = map[type];
    if (key && !state[key].includes(id)) {
      state[key].push(id);
      saveState();
    }
  });

  const SEALS = [
    { id: "wanderer", zh: "夏尔漫步者", en: "Shire-wanderer", descZh: "探访至少 6 处中洲城邦或地标", descEn: "Visit at least 6 places or landmarks", col: "#4a8c3f", ic: `<circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="27" cy="24" r="1.6" fill="currentColor"/><path d="M10,36Q24,18 38,36" fill="none" stroke="currentColor" stroke-width="1.6"/>`, ok: () => state.places.length >= 6 },
    { id: "cartographer", zh: "努门诺尔制图师", en: "Cartographer of Arda", descZh: "探访至少 25 处城邦或地标", descEn: "Explore at least 25 places across Arda", col: "#2f6e8e", ic: `<path d="M24,9L27,21L39,24L27,27L24,39L21,27L9,24L21,21Z" fill="currentColor"/><circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 2"/>`, ok: () => state.places.length >= 25 },
    { id: "elffriend", zh: "精灵之友", en: "Elf-friend", descZh: "结识至少 8 位中洲人物", descEn: "Meet at least 8 characters of Arda", col: "#3c68a8", ic: `<path d="M24,10L26.5,19.5L36,22L26.5,24.5L24,34L21.5,24.5L12,22L21.5,19.5Z" fill="currentColor"/><path d="M15,37Q24,31 33,37" fill="none" stroke="currentColor" stroke-width="1.6"/>`, ok: () => state.chars.length >= 8 },
    { id: "loremaster", zh: "幽谷博学者", en: "Lore-master of Imladris", descZh: "结识至少 25 位各纪元人物", descEn: "Read the chronicles of 25 characters", col: "#8c6224", ic: `<path d="M11,14Q18,11 24,15Q30,11 37,14V35Q30,32 24,36Q18,32 11,35ZM24,15V36" fill="none" stroke="currentColor" stroke-width="2"/>`, ok: () => state.chars.length >= 25 },
    { id: "witness", zh: "岁月见证人", en: "Witness of the Ages", descZh: "亲历至少 5 个关键历史时刻", descEn: "Witness at least 5 Key Moments", col: "#b07d1e", ic: `<circle cx="24" cy="24" r="11" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24,16L25.6,22.4L32,24L25.6,25.6L24,32L22.4,25.6L16,24L22.4,22.4Z" fill="currentColor"/>`, ok: () => state.moments.length >= 5 },
    { id: "captain", zh: "西方统帅", en: "Captain of the West", descZh: "参与至少 3 场重大战役推演", descEn: "Command in at least 3 Great Battles", col: "#9b2a1d", ic: `<path d="M13,35L35,13M28,13H35V20M35,35L13,13M20,13H13V20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, ok: () => state.battles.length >= 3 },
    { id: "warlord", zh: "六战功勋", en: "Marshal of All Six Wars", descZh: "体验全部 6 场中洲决定性战役", descEn: "Experience all 6 decisive battles", col: "#7a2218", ic: `<path d="M14,32L13,18L20,24L24,14L28,24L35,18L34,32Z" fill="currentColor"/><path d="M14,35H34" stroke="currentColor" stroke-width="2.2"/>`, ok: () => state.battles.length >= 6 },
    { id: "riddler", zh: "袋底洞猜谜王", en: "Riddle-master in the Dark", descZh: "在暗湖猜谜对决中战胜咕噜", descEn: "Outwit Gollum in Riddles in the Dark", col: "#c48a18", ic: `<circle cx="24" cy="26" r="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24,10L25.8,14.2L30,16L25.8,17.8L24,22L22.2,17.8L18,16L22.2,14.2Z" fill="currentColor"/>`, ok: () => state.riddlesWon },
    { id: "beacon", zh: "白山烽火官", en: "Warden of the Beacons", descZh: "点燃刚铎七座白山求援烽火台", descEn: "Light all seven Warning Beacons of Gondor", col: "#d65a18", ic: `<path d="M14,36L24,24L34,36Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M24,10C29,16 30,21 24,25C18,21 19,16 24,10Z" fill="currentColor"/>`, ok: () => state.beaconsLit },
    { id: "mellon", zh: "都林门客", en: "Friend of Durin", descZh: "在卡扎督姆西门说出精灵密语开启石门", descEn: "Speak 'Mellon' to open the Doors of Durin", col: "#4a78b0", ic: `<path d="M15,36V22A9,9 0 0,1 33,22V36" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M24,15L25.6,19.4L30,21L25.6,22.6L24,27L22.4,22.6L18,21L22.4,19.4Z" fill="currentColor"/>`, ok: () => state.doorsOpened },
  ];

  /* ======================= 3. 至尊戒编年卡与「幽影视界」(Unseen World) ======================= */
  let wraithOn = false;
  function currentRingBearer(t) {
    if (t < 2190) return { who: "sauron", zh: "尚未铸成（第二纪元约 1600 年铸于末日火山）", en: "Not yet forged (wrought by Sauron c. SA 1600)" };
    if (t < 4031) return { who: "sauron", zh: "索隆亲佩于手 · 统御魔多黑塔", en: "Wielded by Sauron upon his hand in Mordor" };
    if (t < 4033.5) return { who: "isildur", zh: "伊熙尔杜自索隆断指夺得，携之北上", en: "Cut from Sauron's hand and borne north by Isildur" };
    if (t < 6494) return { who: null, zh: "金鸢尾沼地伏击后，沉睡于大河安都因河底淤泥中", en: "Lost beneath the dark waters of the Gladden Fields" };
    if (t < 6972.5) return { who: "gollum", zh: "咕噜（斯米戈尔）将其藏于迷雾山脉地底暗湖近五百年", en: "Hidden by Gollum deep beneath the Misty Mountains for nearly 500 years" };
    if (t < 7032.7) return { who: "bilbo", zh: "比尔博·巴金斯在暗湖拾获，带回夏尔袋底洞", en: "Found in the dark by Bilbo Baggins and kept at Bag End" };
    if (t < 7050.195) return { who: "frodo", zh: "持戒人弗罗多·巴金斯正携戒踏上前往魔多的绝路", en: "Borne by Frodo Baggins on the quest to Mount Doom" };
    if (t < 7050.2) return { who: "sam", zh: "弗罗多在西力斯昂哥被俘，山姆暂时保管至尊戒", en: "Held briefly by Samwise Gamgee at Cirith Ungol" };
    if (t < 7050.232) return { who: "frodo", zh: "弗罗多与山姆正穿越戈埚洛斯焦土，逼近末日裂隙", en: "Carried by Frodo across Gorgoroth to the Sammath Naur" };
    return { who: "frodo", zh: "已在末日火山烈焰中彻底销毁，索隆永远败亡", en: "Unmade in the fires of Mount Doom; Sauron's realm is ended" };
  }

  function toggleWraith(force) {
    wraithOn = typeof force === "boolean" ? force : !wraithOn;
    document.body.classList.toggle("wraith-mode", wraithOn);
    const veil = $("#wraithVeil");
    if (veil) veil.hidden = !wraithOn;
    if (wraithOn) Bard.sfx("wraith");
    const btn = $("[data-toggle-wraith]");
    if (btn) btn.textContent = wraithOn ? L("◉ 摘下至尊戒 · 离开幽影界", "◉ Remove the Ring · Leave Unseen") : L("👁 戴上至尊戒 · 窥视幽影界", "👁 Slip on the Ring · Peer into Unseen");
  }
  if ($("#wraithOffBtn")) $("#wraithOffBtn").addEventListener("click", () => toggleWraith(false));

  function showRing() {
    const t = M.T;
    const rr = t >= M.RING[0].t && t < M.RING_END ? M.at(M.RING, t) : null;
    if (rr) {
      M.flyTo(rr.pos[0], rr.pos[1], t > 6900 ? 340 : 540, 1000);
      M.pulse(rr.pos[0], rr.pos[1], "k-ring");
    }
    const info = currentRingBearer(t);
    const bearer = info.who && M.CI[info.who];
    const heroArt = `<circle cx="0" cy="-12" r="14" fill="none" stroke="#3a1604" stroke-width="5"/><circle cx="0" cy="-12" r="14" fill="none" stroke="#f6cb52" stroke-width="3.6"/><circle cx="0" cy="-12" r="14" fill="none" stroke="#fffbe0" stroke-width=".9" stroke-dasharray="2.5 2"/>`;
    const banner = M.placeHeroSvg({ id: "orodruin", k: "dark" }, { dark: true, art: heroArt, badge: L("统御魔戒", "The Ruling Ring") });
    M.openCard(`${banner}
      <div class="pc-k">${L("至尊魔戒 · 当前归属", "The One Ring · Current Bearer")}</div>
      <h3>${L("至尊戒", "The One Ring")}</h3>
      <blockquote class="bio-q">${L("“至尊戒，驭众戒；至尊戒，寻众戒；魔戒至尊引众戒，禁锢众戒黑暗中。”", "“One Ring to rule them all, One Ring to find them, One Ring to bring them all and in the darkness bind them.”")}</blockquote>
      <p class="pc-d">${esc(EN ? info.en : info.zh)}</p>
      ${bearer ? `<button type="button" class="ring-bearer" data-c="${bearer.id}"><span class="rb-pt">${M.PT(bearer)}</span><div><small>${L("当前持戒者", "Current Ring-bearer")}</small><b>${esc(bearer.n)}</b><i>${esc(bearer.en || "")}</i></div></button>` : ""}
      <div class="pc-acts col">
        <button class="pc-act wraith" data-toggle-wraith="1">${wraithOn ? L("◉ 摘下至尊戒 · 离开幽影界", "◉ Remove the Ring · Leave Unseen") : L("👁 戴上至尊戒 · 窥视幽影界", "👁 Slip on the Ring · Peer into Unseen")}</button>
        <button class="pc-act" data-follow="frodo">▶ ${L("跟随弗罗多护戒之路", "Follow Frodo's Ring-quest")}</button>
      </div>`);
  }
  if ($("#ringKeyBtn")) {
    $("#ringKeyBtn").style.cursor = "pointer";
    $("#ringKeyBtn").addEventListener("click", () => {
      if (M.T < M.RING[0].t || M.T >= M.RING_END) M.setT(7049.75);
      showRing();
    });
  }

  /* ======================= 4. 地图动态奇观点击卡片 ======================= */
  const WONDER_META = {
    smaug:     { zh: "火龙史矛革盘踞孤山", en: "Smaug the Tremendous at Erebor", dZh: "中洲第三纪元最后一条大火龙。自北方枯萎荒原南下攻陷孤山与河谷城，在矮人聚敛的金山与阿肯宝石上盘卧了整整一百七十一年。", dEn: "Greatest dragon of the Third Age, who descended upon Erebor in flames and slumbered upon the Dwarves' golden hoard for 171 years.", c: "smaug", m: "black-arrow" },
    burning:   { zh: "长湖镇冲天大火", en: "The Burning of Lake-town", dZh: "盛怒的史矛革夜袭长湖镇，木桩水城化作火海。弓手巴德在烈焰倒塌的屋顶上拉满长弓，以祖传黑箭射穿恶龙左胸。", dEn: "Enraged by Bilbo's theft, Smaug set Esgaroth ablaze upon the Long Lake, where Bard the Bowman loosed the fatal Black Arrow.", c: "bard", m: "black-arrow" },
    eyebeam:   { zh: "巴拉督尔的无睑魔眼", en: "The Lidless Eye of Barad-dûr", dZh: "重返魔多的索隆在黑塔绝顶凝聚出的火焰巨眼，日夜越过暗影山脉搜寻至尊戒与持戒人的踪迹。", dEn: "From the topmost pinnacle of the Dark Tower, Sauron's sleepless Eye sweeps across Middle-earth seeking the One Ring.", c: "eye", m: "black-gate" },
    balrog:    { zh: "都林的克星 · 卡扎督姆炎魔", en: "Durin's Bane · Balrog of Moria", dZh: "第一纪元逃入迷雾山脉地底沉睡的魔苟斯迈雅火魔，因矮人深挖秘银而苏醒。灰袍甘道夫在卡扎督姆窄桥上持杖与它同坠深渊。", dEn: "Ancient demon of shadow and flame awakened beneath Khazad-dûm; fought by Gandalf upon the Bridge of Khazad-dûm and the Endless Stair.", c: "balrog", m: "bridge-of-khazad-dum" },
    deadarmy:  { zh: "埃瑞赫亡灵大军", en: "The Shadow Host of Oathbreakers", dZh: "曾背弃伊熙尔杜盟誓的白山幽魂。阿拉贡在埃瑞赫黑石前召其履约，亡灵如绿雾狂潮席卷佩拉基尔，一日之内肃清海盗舰队。", dEn: "Oathbreakers of the White Mountains summoned by Aragorn at the Stone of Erech to sweep the Corsair fleet at Pelargir.", c: "kingdead", m: "paths-of-the-dead" },
    shadow:    { zh: "黑森林与魔古尔的暗影迷雾", en: "Creeping Shadow of the Enemy", dZh: "索隆与戒灵盘踞之处弥漫出的腐化黑雾，令绿林腐败为幽暗密林，令月亮之塔沦为死城。", dEn: "Foul sorcerous gloom spreading from Dol Guldur and Minas Morgul, darkening Mirkwood and the Morgul Vale.", c: "witchking" },
    crebain:   { zh: "敦兰黑鸦群（克雷拜因）", en: "Crebain from Fangorn and Dunland", dZh: "替白袍萨鲁曼四处刺探情报的黑乌鸦群，曾如乌云般掠过冬青州上空搜寻护戒小队。", dEn: "Flocks of great black crows serving as spies for Saruman across Hollin and the Misty Mountains.", c: "saruman" },
    ents:      { zh: "最后一次树人进军", en: "The Last March of the Ents", dZh: "树须在德尔丁谷召开树人大会后，率领范贡森林的古老牧树人踏平艾森加德石墙，决开河道淹没萨鲁曼的锻炉。", dEn: "Roused at Entmoot, Treebeard led the Ents of Fangorn to tear down the walls of Isengard and drown Saruman's furnaces.", c: "treebeard", m: "ents-storm-isengard" },
    flood:     { zh: "艾森河决堤淹没欧散克", en: "The Flooding of Isengard", dZh: "树人们掘开艾森河大坝，滚滚洪流灌入艾森加德环谷，熄灭所有地底狼烟，将萨鲁曼困在孤塔之中。", dEn: "The waters of the River Isen diverted by the Ents into the ringed plain of Isengard, quenching its fiery pits.", c: "saruman", m: "saruman-staff-broken" },
    nazgul:    { zh: "插翼戒灵（堕落飞兽）", en: "Winged Nazgûl on Fell Beasts", dZh: "渡口丢马后，索隆赐予九戒灵长颈蝠翼的远古凶兽坐骑，盘旋高空散播令人绝望的尖啸。", dEn: "Mounted upon bat-winged Fell Beasts bred in dark places, the Nine Ringwraiths wheel above battlefields spreading terror.", c: "witchking", m: "eowyn-and-the-witch-king" },
    eagles:    { zh: "风王格怀希尔与迷雾山巨鹰", en: "Gwaihir the Windlord & Great Eagles", dZh: "至高王曼威的信使。在孤山五军之战、黑门决战与末日火山崩塌之际，屡次自云端俯冲救下绝境中的英雄。", dEn: "Noblest birds of Manwë led by Gwaihir the Windlord, arriving at Five Armies, the Morannon, and erupting Mount Doom.", m: "eagles-rescue" },
    ships:     { zh: "乌姆巴尔黑帆海盗船队", en: "Black Fleet of the Corsairs of Umbar", dZh: "南方乌姆巴尔海盗的快桨战舰，长期劫掠刚铎沿岸，最终在佩拉基尔被阿拉贡与亡灵大军截获反戈一击。", dEn: "Great galleys of the Corsairs of Umbar harrying the coasts of Gondor until captured by Aragorn at Pelargir.", m: "black-sails" },
    glaurung:  { zh: "恶龙之父格劳龙", en: "Glaurung · Father of Dragons", dZh: "魔苟斯培育的第一条黄金火龙，虽无双翼却拥有催眠惑心的邪眼。攻破纳国斯隆德，最终在泰格林峡谷被图林刺穿软腹。", dEn: "First of the Urulóki fire-drakes of Morgoth; sackers of Nargothrond, slain at Cabed-en-Aras by Túrin's black sword.", c: "glaurung", m: "turin-glaurung" },
    volcano:   { zh: "桑戈洛锥姆三火山峰", en: "Smoking Peaks of Thangorodrim", dZh: "魔苟斯在安格班大门上方堆起的世上最高火山群，浓烟遮蔽北方天日，直到愤怒之战中崩塌陆沉。", dEn: "Three gigantic volcanic towers raised by Morgoth above the gates of Angband, belching smoke across the North.", c: "morgoth", m: "fingolfin-duel" },
    whiteship: { zh: "灰港最后一艘精灵白船", en: "The Last White Ship from Mithlond", dZh: "第三纪元落幕之日，奇尔丹备好白船，载着三戒守护者埃尔隆德、凯兰崔尔、甘道夫与持戒人比尔博、弗罗多驶上笔直航道。", dEn: "Bearing the Keepers of the Three Rings and Ring-bearers Bilbo and Frodo out of Mithlond along the Straight Road into the West.", c: "frodo", m: "grey-havens" },
  };

  function showWonder(o) {
    const meta = WONDER_META[o.k] || { zh: o.n || "中洲奇观", en: "Wonder of Arda", dZh: "", dEn: "" };
    const isDk = /smaug|eyebeam|balrog|shadow|crebain|nazgul|ships|glaurung|volcano|burning/.test(o.k);
    const banner = M.placeHeroSvg({ id: o.k, k: isDk ? "dark" : "elf" }, { dark: isDk, art: (LIFE.ART || {})[o.k] || "", badge: L("时代奇观", "Timed Wonder") });
    M.openCard(`${banner}
      <div class="pc-k">${L("地图动态奇观", "Living Map Wonder")}</div>
      <h3>${esc(EN ? meta.en : meta.zh)}</h3>
      <p class="pc-d">${esc(EN ? meta.dEn : meta.dZh)}</p>
      <div class="pc-acts">
        <button class="pc-act" data-zoom-xy="${o.x},${o.y}">🔍 ${L("飞近细看", "Zoom Closer")}</button>
        ${meta.c ? `<button class="pc-act" data-c="${meta.c}">🧙 ${L("查看相关人物", "View Character")}</button>` : ""}
        ${meta.m ? `<button class="pc-act" data-mo="${meta.m}">✦ ${L("重温关键时刻", "Open Key Moment")}</button>` : ""}
      </div>`);
    M.pulse(o.x, o.y, isDk ? "k-dark" : "k-ring");
  }

  /* ======================= 5. 真知晶石 · 随机命运漫游 (Palantír) ======================= */
  function spinPalantir() {
    M.pause();
    Bard.sfx("palantir");
    const intro = $("#intro");
    if (intro && !intro.hidden) { intro.classList.add("gone"); setTimeout(() => (intro.hidden = true), 700); }
    $("#codex").hidden = true;

    // 优先抽取尚未探索过的精彩目标（关键时刻 / 著名城邦 / 秘境地标 / 战役）
    const pool = [];
    (M.MO || []).forEach((m) => pool.push({ w: state.moments.includes(m.id) ? 1 : 4, kind: "moment", item: m }));
    D.PLACES.filter((p) => !p.minor).forEach((p) => pool.push({ w: state.places.includes(p.id) ? 1 : 3, kind: "place", item: p }));
    (LIFE.LANDMARKS || []).forEach((lm) => pool.push({ w: state.places.includes(lm.id) ? 1 : 3.5, kind: "landmark", item: lm }));
    const totalW = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * totalW, pick = pool[0];
    for (const x of pool) { r -= x.w; if (r <= 0) { pick = x; break; } }

    const f = $("#eraFlash");
    if (pick.kind === "moment") {
      const m = pick.item;
      if (f) { f.textContent = `🔮 ${m.h}`; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }
      M.openMoment(m.id);
    } else if (pick.kind === "place") {
      const p = pick.item;
      M.closeMoment(false);
      const targetT = Math.max(-500, (p.from ?? 4500) + (p.to ? Math.min(80, (p.to - (p.from ?? 0)) * 0.4) : 120));
      M.setT(targetT, true);
      M.flyTo(p.x, p.y, 340, 1250);
      setTimeout(() => M.showPlace(p), 350);
      if (f) { f.textContent = `🔮 ${p.n}`; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }
    } else {
      const lm = pick.item;
      M.closeMoment(false);
      const targetT = Math.max(4035, (lm.from ?? 6975) + 0.05);
      M.setT(targetT, true);
      M.flyTo(lm.x, lm.y, 260, 1250);
      const hero = M.placeHeroSvg({ id: lm.id, k: "site", x: lm.x, y: lm.y }, { art: (LIFE.ART || {})[lm.k] || "", badge: L("真知晶石指引", "Palantír Vision") });
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("me:visit", { detail: { type: "place", id: lm.id } }));
        M.openCard(`${hero}<div class="pc-k">${L("地标 · 典故", "Landmark · Lore")}</div><h3>${esc(lm.n)}</h3><p class="pc-d">${esc(lm.d)}</p><div class="pc-acts"><button class="pc-act" data-zoom-xy="${lm.x},${lm.y}">🔍 ${L("飞近细看", "Zoom Closer")}</button></div>`);
        M.pulse(lm.x, lm.y, "k-ring");
      }, 350);
      if (f) { f.textContent = `🔮 ${lm.n}`; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }
    }
  }
  if ($("#palantirBtn")) $("#palantirBtn").addEventListener("click", spinPalantir);

  /* ======================= 6. 西境红皮书弹窗 &「黑暗中的猜谜」小游戏 ======================= */
  const RIDDLES = [
    {
      qZh: "生根不见土，高耸入云端；\n从不长枝叶，万年不知寒。",
      qEn: "What has roots as nobody sees,\nIs taller than trees,\nUp, up it goes, and yet never grows?",
      optsZh: ["孤山山脉", "梅隆巨树", "巴拉督尔黑塔", "大海波涛"],
      optsEn: ["A Mountain", "A Mallorn Tree", "A Watchtower", "An Ocean Wave"],
      ans: 0,
      golZh: "嘶——很简单是不是？山根埋在地底下，宝贝！",
      golEn: "Sss — easy one, wasn't it, precious? Mountains!"
    },
    {
      qZh: "无嗓却长啸，无翼却翱翔；\n无齿能噬咬，无嘴自吟唱。",
      qEn: "Voiceless it cries, wingless flutters,\nToothless bites, mouthless mutters.",
      optsZh: ["幽灵戒灵", "凛冽狂风", "奔流瀑布", "山谷回声"],
      optsEn: ["A Ringwraith", "The Wind", "A Waterfall", "A Mountain Echo"],
      ans: 1,
      golZh: "它猜中了！讨厌的巴金斯听见过山顶的风声！",
      golEn: "It guessed it! Nasty Baggins knows the wind!"
    },
    {
      qZh: "幽居无影处，凡眼莫能窥；\n填满深渊窟，烛亮即消退。",
      qEn: "It cannot be seen, cannot be felt,\nCannot be heard, cannot be smelt.\nIt lies behind stars and under hills, and empty holes it fills.",
      optsZh: ["迷雾", "睡梦", "黑暗", "冬雪"],
      optsEn: ["Mist", "Sleep", "Darkness", "Winter Frost"],
      ans: 2,
      golZh: "黑暗……我们最喜欢黑暗了，宝贝，没有刺眼的黄脸太阳！",
      golEn: "Darkness! Yes, precious, we loves the dark!"
    },
    {
      qZh: "无气却能活，冰冷如死石；\n从不觉口渴，披甲常饮水。",
      qEn: "Alive without breath, as cold as death;\nNever thirsty, ever drinking,\nAll in mail never clinking.",
      optsZh: ["秘银锁甲", "暗湖冷鱼", "石洞水滴", "矮人铁锤"],
      optsEn: ["Mithril Mail", "A Cold Fish", "Cave Icicles", "A Water-snake"],
      ans: 1,
      golZh: "鲜美多汁的鱼儿！冰凉甜美的暗湖鲜鱼，咕噜！",
      golEn: "Juicy sweet fishes in the icy pool, gollum, gollum!"
    },
    {
      qZh: "吞噬世间万物：鸟兽草木繁花；\n啃穿坚铁刚刃，磨平巨石高塔，\n击倒诸王霸业，令崇山崩塌。",
      qEn: "This thing all things devours:\nBirds, beasts, trees, flowers;\nGnaws iron, bites steel, slays king, ruins town,\nAnd beats high mountain down.",
      optsZh: ["末日烈火", "漫长光阴（时间）", "恶龙吐息", "无尽大海"],
      optsEn: ["Dragon-fire", "Time", "The Great Sea", "Shadow"],
      ans: 1,
      golZh: "时间……啊！讨厌的霍比特人走运蒙对了！轮到它最后一道！",
      golEn: "Time! Tricksy, lucky hobbitses! One last question!"
    },
    {
      qZh: "比尔博手伸进衣袋摸到一枚冰凉的圆环，脱口自语：\n「我的口袋里装着什么？」",
      qEn: "Bilbo's hand touched a cold little ring in his pocket:\n“What have I got in my pocket?”",
      optsZh: ["一根细绳", "鱼骨头", "什么也没有！", "一枚金戒指"],
      optsEn: ["A piece of string", "Fish-bones", "Nothing!", "A Golden Ring"],
      ans: 3,
      golZh: "不公平！这不算谜语，宝贝！嘶——我的生日礼物在哪儿？！",
      golEn: "Not fair! Not fair, precious! Where is my birthday-present?!"
    }
  ];

  let codexTab = "atlas";
  let rState = { idx: 0, score: 0, msg: "", picked: null, done: false };

  function resetRiddle() {
    rState = {
      idx: 0, score: 0, picked: null, done: false,
      msg: L("咕噜在黑水边亮起两盏惨白的大眼：「我们猜谜吧，宝贝！猜赢了就给你带路出山！」", "Gollum's pale eyes gleam by the subterranean water: “Let us play riddles, precious! If it wins, we shows it the way out!”")
    };
  }
  resetRiddle();

  function openCodex(tab) {
    if (tab) codexTab = tab;
    const box = $("#codex"); if (!box) return;
    const wasOpen = !box.hidden;
    M.closeMoment(false);
    if (M.hideToast) M.hideToast();
    renderCodex(true);
    box.classList.toggle("swapping", wasOpen);
    if (!wasOpen) { box.classList.add("on"); box.hidden = false; }
  }
  function closeCodex() {
    const box = $("#codex"); if (box) { box.hidden = true; box.classList.remove("on", "swapping"); box.innerHTML = ""; }
  }

  function renderCodex(force = false) {
    const box = $("#codex"); if (!box || (!force && box.hidden)) return;
    if (!force) box.classList.add("swapping");
    const pct = totalProgressPct();
    let body = "";
    if (codexTab === "atlas") {
      const bars = [
        [L("探访城邦与古迹", "Places & Landmarks"), state.places.length, TOTAL_PLACES, "#4a8c3f"],
        [L("结识各纪元人物", "Characters Met"), state.chars.length, TOTAL_CHARS, "#3c68a8"],
        [L("见证关键时刻", "Moments Witnessed"), state.moments.length, TOTAL_MOMENTS, "#c8962e"],
        [L("亲历重大战役", "Battles Fought"), state.battles.length, TOTAL_BATTLES, "#9b2a1d"],
      ];
      body = `
        <div class="cdx-sum">
          <div class="cdx-ring-pct"><b>${pct}%</b><small>${L("全境探索度", "Arda Explored")}</small></div>
          <div class="cdx-bars">
            ${bars.map(([lbl, a, b, col]) => `<div class="cdx-bar"><div class="cb-hd"><span>${esc(lbl)}</span><b>${a} / ${b}</b></div><div class="cb-tr"><i style="width:${Math.min(100, Math.round((a / Math.max(1, b)) * 100))}%;background:${col}"></i></div></div>`).join("")}
          </div>
        </div>
        <div class="cdx-cta">
          <button type="button" class="pri cdx-go-unseen">🔮 ${L("真知晶石 · 带我去一处未探索的奇观", "Palantír · Guide Me to an Unseen Wonder")}</button>
          <button type="button" data-cdx-beacons="1">🔥 ${L("点燃刚铎七座烽火", "Light the Seven Beacons")}</button>
        </div>
        <h4 class="cdx-sh">${L("中洲旅人火漆印章", "Collector's Wax Seals of Middle-earth")}</h4>
        <div class="cdx-seals">
          ${SEALS.map((s) => {
            const unlocked = s.ok();
            return `<div class="seal ${unlocked ? "on" : "off"}" style="--sc:${s.col}">
              <div class="seal-ic"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="${unlocked ? "none" : "3 3"}"/>${s.ic}</svg></div>
              <div class="seal-tx"><b>${esc(EN ? s.en : s.zh)}</b><small>${esc(EN ? s.descEn : s.descZh)}</small></div>
            </div>`;
          }).join("")}
        </div>
        <div class="cdx-keys">
          <b>⌨️ ${L("旅人秘籍与快捷键", "Cartographer's Shortcuts & Secrets")}</b>
          <div class="cdx-klist">
            <span><kbd>Space</kbd> ${L("播放/暂停", "Play/Pause")}</span>
            <span><kbd>←</kbd><kbd>→</kbd> ${L("逐个事件", "Prev/Next Event")}</span>
            <span><kbd>R</kbd> ${L("真知晶石漫游", "Palantír Roam")}</span>
            <span><kbd>W</kbd> ${L("至尊戒幽影界", "Wraith-sight")}</span>
            <span><kbd>B</kbd> ${L("点燃刚铎烽火", "Light Beacons")}</span>
            <span><kbd>/</kbd> ${L("快速搜索", "Quick Search")}</span>
          </div>
        </div>`;
    } else if (codexTab === "doors") {
      body = renderDoorsTab();
    } else {
      const bilbo = M.CI.bilbo, gollum = M.CI.gollum;
      const cur = RIDDLES[rState.idx];
      body = `
        <div class="rdl-stage">
          <div class="rdl-fighter">
            <div class="rf-pt">${bilbo ? M.PT(bilbo) : ""}</div>
            <b>${L("比尔博", "Bilbo")}</b>
          </div>
          <div class="rdl-vs">
            <div class="rdl-candles">${RIDDLES.map((_, i) => `<i class="${i < rState.idx ? "lit" : i === rState.idx && !rState.done ? "cur" : ""}">🕯️</i>`).join("")}</div>
            <div class="rdl-speech">${esc(rState.msg)}</div>
          </div>
          <div class="rdl-fighter gol">
            <div class="rf-pt">${gollum ? M.PT(gollum) : ""}</div>
            <b>${L("咕噜", "Gollum")}</b>
          </div>
        </div>
        ${rState.done ? `
          <div class="rdl-win">
            <h3>🏆 ${L("你赢得了暗湖猜谜对决！", "You Outwitted Gollum in the Dark!")}</h3>
            <p>${L(`共答对 ${rState.score} / ${RIDDLES.length} 道谜语，已解锁「袋底洞猜谜王」火漆印章！比尔博借着戒指隐身，跟着骂骂咧咧的咕噜逃出了迷雾山脉后门。`, `Solved ${rState.score} / ${RIDDLES.length} riddles and unlocked the Riddle-master Wax Seal! Slipping on the Ring, Bilbo followed Gollum to the back-door of the Misty Mountains.`)}</p>
            <div class="cdx-cta">
              <button type="button" class="pri" data-rdl-moment="1">✦ ${L("欣赏「黑暗中的猜谜」宽银幕插画", "Open 'Riddles in the Dark' Diorama")}</button>
              <button type="button" data-rdl-reset="1">↻ ${L("再玩一局", "Play Again")}</button>
            </div>
          </div>
        ` : `
          <div class="rdl-card">
            <div class="rdl-qno">${L(`第 ${rState.idx + 1} / ${RIDDLES.length} 谜`, `Riddle ${rState.idx + 1} of ${RIDDLES.length}`)}</div>
            <pre class="rdl-verse">${esc(EN ? cur.qEn : cur.qZh)}</pre>
            <div class="rdl-opts">
              ${(EN ? cur.optsEn : cur.optsZh).map((opt, oi) => {
                let cls = "";
                if (rState.picked != null) {
                  if (oi === cur.ans) cls = "ok";
                  else if (oi === rState.picked) cls = "bad";
                }
                return `<button type="button" class="rdl-opt ${cls}" data-ropt="${oi}" ${rState.picked != null ? "disabled" : ""}>${esc(opt)}</button>`;
              }).join("")}
            </div>
            ${rState.picked != null ? `<div class="rdl-next"><button type="button" class="pri" data-rdl-next="1">${rState.idx < RIDDLES.length - 1 ? L("下一道谜语 ▸", "Next Riddle ▸") : L("揭晓结局 ▸", "See Outcome ▸")}</button></div>` : ""}
          </div>
        `}`;
    }

    box.innerHTML = `
      <div class="mo-in cdx-in" role="dialog" aria-modal="true" aria-label="${L("西境红皮书", "Red Book of Westmarch")}">
        <button class="mo-x cdx-x" aria-label="${L("关闭", "Close")}">×</button>
        <div class="cdx-head">
          <div class="cdx-title">
            <span class="mo-k">✦ ${L("西境红皮书 · 巴金斯手札", "The Red Book of Westmarch")}</span>
            <h2>${L("旅人探索图鉴、暗湖猜谜与都林西门", "Explorer's Codex, Riddles & Doors of Durin")}</h2>
          </div>
          <div class="cdx-tabs">
            <button type="button" class="${codexTab === "atlas" ? "on" : ""}" data-ctab="atlas">🗺️ ${L("探索图鉴", "Explorer's Codex")}</button>
            <button type="button" class="${codexTab === "riddle" ? "on" : ""}" data-ctab="riddle">🕯️ ${L("黑暗中的猜谜", "Riddles in the Dark")}</button>
            <button type="button" class="${codexTab === "doors" ? "on" : ""}" data-ctab="doors">🚪 ${L("都林西门", "Doors of Durin")}</button>
          </div>
        </div>
        <div class="mo-body cdx-body">${body}</div>
      </div>`;
  }

  if ($("#codexBtn")) $("#codexBtn").addEventListener("click", () => openCodex("atlas"));
  if ($("#codex")) {
    $("#codex").addEventListener("click", (e) => {
      if (e.target.closest(".cdx-x") || e.target === e.currentTarget) return closeCodex();
      const tb = e.target.closest("[data-ctab]");
      if (tb) { codexTab = tb.dataset.ctab; Bard.sfx("tap"); return renderCodex(); }
      if (e.target.closest(".cdx-go-unseen")) return spinPalantir();
      const opt = e.target.closest("[data-ropt]");
      if (opt && rState.picked == null) {
        const oi = +opt.dataset.ropt, cur = RIDDLES[rState.idx];
        rState.picked = oi;
        if (oi === cur.ans) {
          rState.score++;
          rState.msg = EN ? cur.golEn : cur.golZh;
          Bard.sfx("chime");
        } else {
          const right = (EN ? cur.optsEn : cur.optsZh)[cur.ans];
          rState.msg = L(`咕噜得意地拍手嘶叫：「猜错啦，宝贝！谜底是【${right}】！」`, `Gollum hisses with glee: “Wrong, precious! The answer was ${right}!”`);
          Bard.sfx("wrong");
        }
        return renderCodex();
      }
      if (e.target.closest("[data-rdl-next]")) {
        if (rState.idx < RIDDLES.length - 1) {
          rState.idx++; rState.picked = null;
          rState.msg = L("咕噜凑得更近了，手指在岩石上焦躁地抓挠……", "Gollum creeps closer, his long fingers twitching against the wet stone…");
        } else {
          rState.done = true;
          if (rState.score >= 4 && !state.riddlesWon) { state.riddlesWon = true; saveState(); }
          Bard.sfx("palantir");
        }
        return renderCodex();
      }
      if (e.target.closest("[data-rdl-reset]")) { resetRiddle(); return renderCodex(); }
      if (e.target.closest("[data-rdl-moment]")) { closeCodex(); return M.openMoment("riddles-in-the-dark"); }
      if (e.target.closest("[data-cdx-beacons]")) { closeCodex(); return lightBeacons(); }
      const spell = e.target.closest("[data-door-spell]");
      if (spell) return tryDoorWord(spell.dataset.doorSpell);
      if (e.target.closest("[data-door-submit]")) {
        const inp = $("#doorInput");
        if (inp) return tryDoorWord(inp.value);
      }
      if (e.target.closest("[data-door-bridge]")) { closeCodex(); return M.openMoment("bridge-of-khazad-dum"); }
      if (e.target.closest("[data-door-reset]")) { dState.open = false; dState.shake = false; dState.msg = defaultDoorMsg(); return renderCodex(); }
    });
    $("#codex").addEventListener("keydown", (e) => {
      if (e.target.id === "doorInput" && e.key === "Enter") {
        e.preventDefault();
        tryDoorWord(e.target.value);
      }
    });
  }

  /* ======================= 6B. 卡扎督姆西门 · 伊希尔丁月光密语 (Doors of Durin) ======================= */
  function defaultDoorMsg() {
    return L(
      "甘道夫抚过冰冷的岩石，月光下浮现出凯勒布理鹏与纳尔维锻造的伊希尔丁银纹：「摩瑞亚之王都林之门：请说，朋友，然后进入。」",
      "Under the moonlight, silver ithildin lines wrought by Celebrimbor and Narvi glimmer upon the grey stone: “The Doors of Durin, Lord of Moria. Speak, friend, and enter.”"
    );
  }
  const dState = { open: false, shake: false, msg: defaultDoorMsg() };

  function tryDoorWord(raw) {
    const w = String(raw || "").trim().toLowerCase();
    if (!w) return;
    if (/^(mellon|friend|朋友|梅隆|麦隆)$/.test(w)) {
      dState.open = true;
      dState.shake = false;
      dState.msg = L(
        "✨ 「Mellon！」银色星纹骤然大放光明，两扇沉重的石门无声地向两侧缓缓洞开，露出了卡扎督姆深邃的石阶与黑柱大厅！已解锁「都林门客」火漆印章！",
        "✨ “Mellon!” The ithildin star-lines blaze white-silver, and the twin stone doors swing silently inward, revealing the pillared darkness of Khazad-dûm! Unlocked the 'Friend of Durin' Wax Seal!"
      );
      if (!state.doorsOpened) { state.doorsOpened = true; saveState(); }
      Bard.sfx("doors", true);
    } else if (w === "edro") {
      dState.open = false; dState.shake = true;
      dState.msg = L("甘道夫高举手杖念诵诺多精灵语开锁咒：「Annon edhellen, edro hi ammen!」银纹微闪，石门却纹丝不动。", "Gandalf lifts his staff: “Annon edhellen, edro hi ammen!” The silver lines flicker faintly, yet the stone doors stir not.");
      Bard.sfx("wrong", true);
    } else if (w === "nogothrim") {
      dState.open = false; dState.shake = true;
      dState.msg = L("「Fennas nogothrim, lasto beth lammen!」山壁回荡着低沉余音，可古老时代并不需要复杂的口令……再仔细读读铭文？", "“Fennas nogothrim, lasto beth lammen!” Echoes roll off the cliff, yet in happier days no secret cipher was needed… read the inscription literally!");
      Bard.sfx("wrong", true);
    } else {
      dState.open = false; dState.shake = true;
      dState.msg = L(`你在门前念出「${raw.trim()}」，冰冷的岩壁毫无反应。梅里提醒道：「“请说，朋友，然后进入”——会不会直接用精灵语说“朋友”？」`, `You speak “${raw.trim()}”, and the grey cliff remains shut. Merry ponders: “What if it simply means: say the Elvish word for ‘friend’?”`);
      Bard.sfx("wrong", true);
    }
    renderCodex();
  }

  function renderDoorsTab() {
    return `
      <div class="drs-wrap ${dState.open ? "is-open" : ""} ${dState.shake ? "is-shake" : ""}">
        <div class="drs-stage">
          <svg viewBox="0 0 520 270" class="drs-svg" aria-hidden="true">
            <defs>
              <radialGradient id="ithGlow" cx="50%" cy="52%" r="52%">
                <stop offset="0%" stop-color="#cbe6ff" stop-opacity="${dState.open ? ".45" : ".22"}"/>
                <stop offset="100%" stop-color="#0a1220" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="hallDeep" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#05080f"/>
                <stop offset="70%" stop-color="#141c2b"/>
                <stop offset="100%" stop-color="#2a1c14"/>
              </linearGradient>
            </defs>
            <rect width="520" height="270" rx="8" fill="#0d1420"/>
            <circle cx="260" cy="140" r="145" fill="url(#ithGlow)"/>
            <!-- 两侧埃瑞吉安冬青古树 -->
            <g stroke="#7aa8d6" stroke-opacity=".55" fill="none" stroke-linecap="round">
              <path d="M86,252 Q92,168 78,94 M88,184 Q56,154 44,118 M84,142 Q112,102 132,74" stroke-width="3.2"/>
              <path d="M434,252 Q428,168 442,94 M432,184 Q464,154 476,118 M436,142 Q408,102 388,74" stroke-width="3.2"/>
            </g>
            <!-- 门后卡扎督姆巨柱深渊（开门可见） -->
            <clipPath id="doorArchClip"><path d="M168,250 V126 A92,92 0 0,1 352,126 V250 Z"/></clipPath>
            <g clip-path="url(#doorArchClip)">
              <rect x="166" y="30" width="188" height="222" fill="url(#hallDeep)"/>
              ${[196, 226, 294, 324].map((x) => `<rect x="${x - 6}" y="46" width="12" height="196" fill="#1e293d" stroke="#5c789e" stroke-opacity=".3"/>`).join("")}
              <ellipse cx="260" cy="242" rx="68" ry="18" fill="#ff7424" opacity="${dState.open ? ".42" : "0"}"/>
              <path d="M222,250 L248,186 H272 L298,250 Z" fill="#2c3a52" opacity=".75"/>
            </g>
            <!-- 双扇伊希尔丁月光石门 -->
            <g clip-path="url(#doorArchClip)">
              <g class="drs-leaf left">
                <rect x="166" y="32" width="94" height="220" fill="#162131" stroke="#9ed0ff" stroke-width="1.5"/>
                <path d="M180,248 V130 A80,80 0 0,1 260,50" fill="none" stroke="#bfe2ff" stroke-width="1.6"/>
                <path d="M206,246 V176 Q206,148 238,136" fill="none" stroke="#9ec8f0" stroke-width="1.2"/>
              </g>
              <g class="drs-leaf right">
                <rect x="260" y="32" width="94" height="220" fill="#162131" stroke="#9ed0ff" stroke-width="1.5"/>
                <path d="M340,248 V130 A80,80 0 0,0 260,50" fill="none" stroke="#bfe2ff" stroke-width="1.6"/>
                <path d="M314,246 V176 Q314,148 282,136" fill="none" stroke="#9ec8f0" stroke-width="1.2"/>
              </g>
            </g>
            <!-- 外拱铭文与都林七星、铁锤铁砧、费艾诺八芒星（随门开启渐隐为拱顶银辉） -->
            <path d="M168,250 V126 A92,92 0 0,1 352,126 V250" fill="none" stroke="#d8eeff" stroke-width="2.6"/>
            <path d="M160,250 V126 A100,100 0 0,1 360,126 V250" fill="none" stroke="#7fb4e8" stroke-width="1" stroke-dasharray="4 4"/>
            <g class="drs-sigils" opacity="${dState.open ? ".2" : ".95"}" fill="none" stroke="#d8eeff" stroke-width="1.4">
              <path d="M244,116 L248,106 L254,112 L260,102 L266,112 L272,106 L276,116 Z"/>
              ${[-26, -18, -9, 0, 9, 18, 26].map((dx, i) => `<circle cx="${260 + dx}" cy="${94 - Math.cos(dx / 18) * 9}" r="${i === 3 ? 2.2 : 1.5}" fill="#ffffff" stroke="none"/>`).join("")}
              <path d="M248,144 H272 M260,132 V154 M252,154 H268"/>
              <polygon points="260,168 263,179 274,182 263,185 260,196 257,185 246,182 257,179" fill="#e6f4ff" stroke="none"/>
            </g>
            <text x="260" y="24" text-anchor="middle" fill="#bfe2ff" font-size="11.5" font-style="italic" letter-spacing="1.2">Ennyn Durin Aran Moria · pedo mellon a minno</text>
            <line x1="60" y1="250" x2="460" y2="250" stroke="#4f6d92" stroke-width="2"/>
          </svg>
        </div>
        <p class="drs-msg">${esc(dState.msg)}</p>
        ${dState.open ? `
          <div class="cdx-cta">
            <button type="button" class="pri" data-door-bridge="1">✦ ${L("走入长厅 · 查看「卡扎督姆之桥」", "Enter Khazad-dûm · Bridge Diorama")}</button>
            <button type="button" data-door-reset="1">↺ ${L("合上西门", "Close the Doors")}</button>
          </div>
        ` : `
          <div class="drs-spells">
            <button type="button" class="rdl-opt" data-door-spell="edro">🪄 Annon edhellen, edro hi ammen!</button>
            <button type="button" class="rdl-opt" data-door-spell="nogothrim">🔨 Fennas nogothrim, lasto beth lammen!</button>
            <button type="button" class="rdl-opt mellon-hint" data-door-spell="mellon">✨ Mellon（${L("辛达林语：朋友", "Sindarin: Friend")}）</button>
          </div>
          <div class="drs-inp">
            <input id="doorInput" type="text" placeholder="${L("或亲手输入精灵语密语（例如 Mellon / 朋友）…", "Or type the Elvish password (e.g. Mellon / Friend)…")}" autocomplete="off" />
            <button type="button" class="pri" data-door-submit="1">${L("吟诵密语", "Speak Word")}</button>
          </div>
        `}
      </div>`;
  }

  /* ======================= 6C. 点燃刚铎七座白山烽火台 (Beacons of Gondor) & 视角分享 ======================= */
  const BEACON_PEAKS = [
    [648, 546, "阿蒙丁", "Amon Dîn"],
    [626, 540, "埃兰纳赫", "Eilenach"],
    [604, 534, "纳多尔", "Nardol"],
    [588, 532, "埃瑞拉斯", "Erelas"],
    [570, 530, "明-林蒙", "Min-Rimmon"],
    [556, 530, "卡伦哈德", "Calenhad"],
    [544, 526, "哈利费理安", "Halifirien"],
  ];
  let beaconTimers = [];

  function lightBeacons() {
    M.pause();
    const intro = $("#intro");
    if (intro && !intro.hidden) intro.hidden = true;
    $("#codex").hidden = true;
    $("#card").hidden = true;
    if (M.T < 6000 || M.T > 7052) M.setT(7050.09, true);
    M.flyTo(598, 534, 210, 950);

    beaconTimers.forEach(clearTimeout);
    beaconTimers = [];
    $$(".bcn-blaze", M.svg).forEach((n) => n.remove());

    BEACON_PEAKS.forEach(([x, y, zh, en], i) => {
      beaconTimers.push(setTimeout(() => {
        if (!M.L?.fx) return;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "bcn-blaze");
        g.setAttribute("transform", `translate(${x},${y})`);
        g.innerHTML = `<g class="sc">
          <circle r="16" fill="#ff7a18" opacity=".32" class="bcn-halo"/>
          <path d="M0,-3 Q-3,-14 1,-24 Q4,-15 0,-3 Z" fill="#544842" opacity=".45"/>
          <path d="M-4.2,0 C-5,-8 -1,-14 0,-19 C1,-14 5,-8 4.2,0 Z" fill="#ff5a10"/>
          <path d="M-2.4,-0.5 C-2.8,-6 -0.6,-10 0,-14 C0.6,-10 2.8,-6 2.4,-0.5 Z" fill="#ffd866"/>
          <circle cy="-3" r="1.8" fill="#ffffff"/>
          <text y="-21" text-anchor="middle" class="bcn-lbl">${esc(EN ? en : zh)}</text>
        </g>`;
        M.L.fx.appendChild(g);
        M.pulse(x, y, "k-ring");
        if (window.__ME_25D?.onBeaconLit) window.__ME_25D.onBeaconLit(x, y, EN ? en : zh);
        Bard.sfx("beacon", true);
        setTimeout(() => g.remove(), 9500);

        if (i === BEACON_PEAKS.length - 1) {
          if (!state.beaconsLit) { state.beaconsLit = true; saveState(); }
          M.pulse(578, 508, "k-ring");
          const html = `<div class="ts-d">${L("刚铎求援 · 白色山脉七烽连天", "The Warning Beacons of Gondor")}</div>
            <b>🔥 ${L("烽火亮了！刚铎在呼救！", "The Beacons Are Lit! Gondor Calls for Aid!")}</b>
            <p>${L("从阿蒙丁到哈利费理安，七座雪峰火光冲天。希奥顿王在金殿前仰望火光：「洛汗必将应召！」", "From Amon Dîn to Halifirien, seven mountain-fires leap across the night. In Edoras King Théoden answers: “And Rohan will answer!”")}</p>
            <button class="go-b" data-b="pelennor">⚔ ${L("率洛汗铁骑驰援帕兰诺平原", "Ride to Battle of the Pelennor Fields")}</button>`;
          if (M.showToast) M.showToast(html, "ring", 7200);
        }
      }, 280 + i * 360));
    });
  }

  function shareCurrentView() {
    const hash = M.getShareHash ? M.getShareHash() : location.hash;
    try { history.replaceState(null, "", hash); } catch (e) {}
    const u = new URL(location.href);
    u.hash = hash;
    const urlStr = u.toString();
    const done = () => {
      Bard.sfx("chime", true);
      const html = `<div class="ts-d">${L("时空坐标永久链接", "Shareable Atlas Permalink")}</div>
        <b>🔗 ${L("已复制当前纪元与视角链接！", "Permalink Copied to Clipboard!")}</b>
        <p style="word-break:break-all;font-size:11.5px;opacity:.85">${esc(urlStr)}</p>`;
      if (M.showToast) M.showToast(html, "ring", 3600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(urlStr).then(done).catch(done);
    } else {
      done();
    }
  }
  if ($("#shareBtn")) $("#shareBtn").addEventListener("click", shareCurrentView);

  /* ======================= 7. 制图师坐标罗盘读数、海面点击涟漪与全局快捷键 ======================= */
  const coordsEl = $("#mapCoords");
  const BAG_END = [296, 252];
  if (M.svg && coordsEl) {
    let lastCoordAt = 0;
    M.svg.addEventListener("pointermove", (e) => {
      if (M.svg.classList.contains("moving") || e.buttons) return;
      const now = performance.now();
      if (now - lastCoordAt < 110) return;
      lastCoordAt = now;
      const ctm = M.svg.getScreenCTM();
      if (!ctm) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      let nearLbl = "", best = 155;
      (W.labels || []).forEach((lb) => {
        if (lb.g && (lb.g.classList.contains("off") || lb.g.closest(".gone,.veiled"))) return;
        const d = Math.hypot(lb.x - pt.x, lb.y - pt.y);
        if (d < best) { best = d; nearLbl = lb.n; }
      });
      const leagues = Math.round(Math.hypot(pt.x - BAG_END[0], pt.y - BAG_END[1]) / 1.25);
      coordsEl.textContent = (nearLbl ? nearLbl + " · " : "") + (EN ? `${leagues} leagues from Bag End` : `距袋底洞约 ${leagues} 里格`);
    });
    M.svg.addEventListener("pointerleave", () => { coordsEl.textContent = ""; });

    // 点击海面泛起古海图水纹
    M.svg.addEventListener("click", (e) => {
      if (e.target !== M.svg && !e.target.classList.contains("sea") && !e.target.classList.contains("sea-hatch")) return;
      const ctm = M.svg.getScreenCTM();
      if (!ctm || !M.L?.fx) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "pulse sea-rip");
      g.setAttribute("transform", `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
      g.innerHTML = `<g class="sc"><circle r="6"/><circle r="6" class="p2"/></g>`;
      M.L.fx.appendChild(g);
      setTimeout(() => g.remove(), 2400);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input,textarea")) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    if ($("#codex") && !$("#codex").hidden) {
      if (e.key === "Escape") closeCodex();
      return;
    }
    if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) {
      e.preventDefault();
      if (innerWidth <= 860) document.body.classList.add("panel-open");
      else document.body.classList.remove("panel-shut");
      const inp = $("#pSearch");
      if (inp) { inp.focus(); inp.select(); }
    } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && !e.altKey && $("#moment")?.hidden && !document.body.classList.contains("in-battle")) {
      e.preventDefault();
      spinPalantir();
    } else if (e.key.toLowerCase() === "w" && !e.metaKey && !e.ctrlKey && !e.altKey && $("#moment")?.hidden && !document.body.classList.contains("in-battle")) {
      toggleWraith();
    } else if (e.key.toLowerCase() === "b" && !e.metaKey && !e.ctrlKey && !e.altKey && $("#moment")?.hidden && !document.body.classList.contains("in-battle")) {
      lightBeacons();
    } else if (e.key === "?" && !e.metaKey && !e.ctrlKey && $("#moment")?.hidden && !document.body.classList.contains("in-battle")) {
      openCodex("atlas");
    }
  });

  Object.assign(M, { showRing, showWonder, toggleWraith, openCodex, spinPalantir, lightBeacons, shareCurrentView, Bard });
})();
