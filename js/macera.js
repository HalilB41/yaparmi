// ============================================================
// macera.js — "Berkay: The Game": 4 bölümlük platform oyunu (macera.html).
// Kahraman: images/karakter.webp. Bosslar için images/yuz-<ad>.webp varsa yüz olarak kullanılır, yoksa emoji.
// Bölüm haritaları js/macera-seviye.js'te. Süreler localStorage + Firestore macera_skor (sıralama).
// Sabit adımlı fizik (1/120 sn), 40 px kareler, 960×560 iç çözünürlük.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SEV = window.MACERA_SEVIYELER || [];
  const T = 40, VW = 960, VH = 560;
  const G = 2300, ZIPLA = 900, KOS = 270, KOS_OTO = 330, MAX_DUS = 1100;
  const cv = $("mcTuval"), ctx = cv.getContext("2d");
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = VW * DPR; cv.height = VH * DPR; ctx.scale(DPR, DPR);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const sureYaz = (ms) => { const s = ms / 1000; return Math.floor(s / 60) + ":" + (s % 60).toFixed(2).padStart(5, "0"); };

  // ---------- görseller ----------
  const resim = (src) => { const i = new Image(); i.src = src; return i; };
  const KAHRAMAN = resim("/images/karakter.webp");
  const yuzler = {};
  function yuzYukle(ad) {
    if (!ad || yuzler[ad] !== undefined) return;
    yuzler[ad] = null;
    const i = new Image(); i.onload = () => (yuzler[ad] = i); i.src = `/images/yuz-${ad}.webp`;
  }

  // ---------- ses: efektler + bölüm müzikleri (WebAudio, dosya yok) ----------
  // Tarayıcılar sesi ancak bir dokunuş/tuş anında açtırır: sesAc() her tıklamada ve tuşta çağrılır.
  let ses = null, ana = null, muzikKazanc = null, sessiz = false;
  try { sessiz = localStorage.getItem("macera_sessiz") === "1"; } catch { /* yok */ }
  function sesAc() {
    try {
      if (!ses) {
        ses = new (window.AudioContext || window.webkitAudioContext)();
        ana = ses.createGain(); ana.gain.value = sessiz ? 0 : 1; ana.connect(ses.destination);
        muzikKazanc = ses.createGain(); muzikKazanc.gain.value = 0.55; muzikKazanc.connect(ana);
      }
      if (ses.state === "suspended") ses.resume();
    } catch { /* ses yok */ }
  }
  ["pointerdown", "keydown", "touchstart"].forEach((o) => addEventListener(o, sesAc, { passive: true }));
  function sesDurumu(kapali) { sessiz = kapali; try { localStorage.setItem("macera_sessiz", kapali ? "1" : "0"); } catch { /* yok */ } if (ana) ana.gain.value = kapali ? 0 : 1; $("mcSes").textContent = kapali ? "🔇" : "🔊"; }
  function bip(f1, f2, sure, tip = "square", hacim = 0.12, gecikme = 0) {
    if (!ses || sessiz) return;
    const o = ses.createOscillator(), g = ses.createGain(), t = ses.currentTime + gecikme;
    o.type = tip; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + sure);
    g.gain.setValueAtTime(hacim, t); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g).connect(ana); o.start(t); o.stop(t + sure + 0.02);
  }
  let gurultuTampon = null;
  function gurultu(sure, hacim, filtre = 3000, gecikme = 0, hedef) {
    if (!ses) return;
    if (!gurultuTampon) { gurultuTampon = ses.createBuffer(1, ses.sampleRate * 0.5, ses.sampleRate); const v = gurultuTampon.getChannelData(0); for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1; }
    const k = ses.createBufferSource(), f = ses.createBiquadFilter(), g = ses.createGain(), t = ses.currentTime + gecikme;
    k.buffer = gurultuTampon; f.type = "highpass"; f.frequency.value = filtre;
    g.gain.setValueAtTime(hacim, t); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    k.connect(f).connect(g).connect(hedef || ana); k.start(t); k.stop(t + sure + 0.02);
  }
  const SES = {
    zipla: () => bip(260, 620, 0.13, "square", 0.1),
    burger: () => { bip(988, 988, 0.06, "square", 0.08); bip(1319, 1319, 0.12, "square", 0.08, 0.06); },
    ez: () => { bip(180, 60, 0.18, "square", 0.14); gurultu(0.12, 0.2, 800); },
    ol: () => { bip(440, 70, 0.7, "sawtooth", 0.14); gurultu(0.4, 0.2, 300); },
    boss: () => { bip(110, 40, 0.45, "sawtooth", 0.18); gurultu(0.3, 0.25, 200); },
    vurus: () => { bip(90, 30, 0.25, "square", 0.2); gurultu(0.25, 0.3, 400); },
    firlat: () => gurultu(0.12, 0.08, 2000),
    kontrol: () => { bip(660, 660, 0.08, "triangle", 0.14); bip(990, 990, 0.16, "triangle", 0.14, 0.09); },
    bitti: () => [523, 659, 784, 1047].forEach((f, i) => bip(f, f, i === 3 ? 0.5 : 0.14, "square", 0.1, i * 0.13)),
  };

  // Müzik: 16'lık adımlar, melodi (kare dalga) + bas (üçgen) + davul (gürültü). Notalar MIDI numarası, 0 = sus.
  const M = (s) => s.trim().split(/\s+/).map((x) => (x === "." ? 0 : Number(x)));
  const MUZIK = {
    depo: { bpm: 118, melodi: M("69 . 72 . 76 . 74 72 . 69 . 67 . 69 . 69 . 72 . 76 . 79 . 77 . 76 . 74 . 72 ."), bas: M("45 . . 45 . . 45 . 41 . . 41 . . 43 . 45 . . 45 . . 45 . 41 . . 41 43 . 43 .") },
    yol: { bpm: 150, melodi: M("76 . 79 81 . 79 76 . 74 . 76 . 79 . . . 76 . 79 81 . 84 83 . 81 . 79 . 76 . . ."), bas: M("40 . 52 . 40 . 52 . 45 . 57 . 45 . 57 . 43 . 55 . 43 . 55 . 47 . 59 . 47 . 59 .") },
    sinav: { bpm: 132, melodi: M("72 . 74 . 76 . 72 . 79 . . 77 76 . 74 . 72 . 74 . 76 . 77 . 76 74 72 . 71 . 72 ."), bas: M("48 . . 48 . 48 . . 43 . . 43 . 43 . . 45 . . 45 . 45 . . 43 . . 43 . 47 . .") },
    kutuphane: { bpm: 104, melodi: M("62 . . 65 . . 69 . 68 . . 65 . . 62 . 61 . . 64 . . 68 . 67 . . 64 . . 61 ."), bas: M("38 . . . 38 . . . 37 . . . 37 . . . 36 . . . 36 . . . 37 . . . 37 . 37 .") },
    gece: { bpm: 112, melodi: M("64 . 67 . 71 . 69 67 . 64 . 62 . 64 . . . 67 . 71 . 74 . 72 71 . 69 . 67 . 69 ."), bas: M("40 . . 40 . 47 . . 45 . . 45 . 52 . . 43 . . 43 . 50 . . 42 . . 42 . 47 . .") },
    borsa: { bpm: 126, melodi: M("74 . 77 . 81 . 79 77 74 . 72 . 74 . . . 81 . 79 . 77 . 76 . 74 . 77 . 76 . 74 ."), bas: M("38 . 50 . 38 . 50 . 41 . 53 . 41 . 53 . 43 . 55 . 43 . 55 . 45 . 57 . 45 . 57 .") },
    mutfak: { bpm: 138, melodi: M("72 74 76 . 79 . 76 . 77 . 76 74 72 . . . 74 76 77 . 81 . 77 . 79 . 77 76 74 . . ."), bas: M("48 . 55 . 48 . 55 . 53 . 60 . 53 . 60 . 50 . 57 . 50 . 57 . 55 . 62 . 55 . 62 .") },
    neon: { bpm: 150, melodi: M("69 . 76 . 69 . 77 76 . 74 . 72 . 74 . 76 69 . 76 . 69 . 79 77 . 76 . 74 . 72 . 71 ."), bas: M("45 45 . 45 45 . 45 . 41 41 . 41 41 . 41 . 43 43 . 43 43 . 43 . 40 40 . 40 40 . 40 .") },
    final: { bpm: 160, melodi: M("62 65 69 74 72 69 65 62 61 64 69 73 72 69 64 61 60 64 67 72 71 67 64 60 62 65 69 74 76 77 76 74"), bas: M("38 . 38 . 38 . 38 . 37 . 37 . 37 . 37 . 36 . 36 . 36 . 36 . 38 . 38 . 41 . 43 .") },
    boss: { bpm: 168, melodi: M("69 72 76 72 69 72 76 81 68 71 76 71 68 71 76 80 67 70 74 70 67 70 74 79 68 71 74 77 76 74 71 68"), bas: M("45 . 45 . 45 . 45 . 44 . 44 . 44 . 44 . 43 . 43 . 43 . 43 . 40 . 40 . 40 . 40 .") },
    zafer: { bpm: 140, melodi: M("72 . 76 . 79 . 84 . . . 83 . 84 . . . 79 . 84 . 88 . . . 86 . 84 . . . . ."), bas: M("48 . . . 55 . . . 48 . . . 55 . . . 53 . . . 55 . . . 48 . . . . . . .") },
  };
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let muzik = null, muzikZaman = null;
  function muzikCal(ad) {
    if (muzik && muzik.ad === ad) return;
    muzikDur();
    const m = MUZIK[ad]; if (!m) return;
    muzik = { ad, m, adim: 0, sonraki: 0 };
    const tik = () => {
      if (!ses || !muzik || ses.state !== "running") return;
      const adimSn = 60 / m.bpm / 4;
      if (muzik.sonraki < ses.currentTime) muzik.sonraki = ses.currentTime + 0.05;
      while (muzik.sonraki < ses.currentTime + 0.25) {
        const i = muzik.adim % m.melodi.length, t = muzik.sonraki;
        const n = m.melodi[i], b = m.bas[i % m.bas.length];
        if (n) nota(n, t, adimSn * 0.9, "square", 0.045);
        if (b) nota(b, t, adimSn * 1.8, "triangle", 0.12);
        if (i % 4 === 0) davul(t, 0.22, 120); else if (i % 2 === 0) gurultu(0.04, 0.03, 7000, t - ses.currentTime, muzikKazanc);
        if (i % 8 === 4) gurultu(0.12, 0.09, 1500, t - ses.currentTime, muzikKazanc);
        muzik.adim++; muzik.sonraki += adimSn;
        if (ad === "zafer" && muzik.adim >= m.melodi.length) { const s = muzik; setTimeout(() => { if (muzik === s) muzikDur(); }, 600); break; }
      }
    };
    muzikZaman = setInterval(tik, 60); tik();
  }
  function nota(n, t, sure, tip, hacim) {
    const o = ses.createOscillator(), g = ses.createGain();
    o.type = tip; o.frequency.setValueAtTime(midiHz(n), t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(hacim, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g).connect(muzikKazanc); o.start(t); o.stop(t + sure + 0.02);
  }
  function davul(t, hacim, f) {
    const o = ses.createOscillator(), g = ses.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(hacim, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(muzikKazanc); o.start(t); o.stop(t + 0.17);
  }
  function muzikDur() { clearInterval(muzikZaman); muzikZaman = null; muzik = null; }

  // ---------- giriş ----------
  const tus = { sol: false, sag: false, zipla: false, at: false };
  let ziplaBasildi = false, atBasildi = false;
  const TUSLAR = { ArrowLeft: "sol", KeyA: "sol", ArrowRight: "sag", KeyD: "sag", ArrowUp: "zipla", KeyW: "zipla", Space: "zipla", KeyZ: "at", KeyX: "at" };
  addEventListener("keydown", (e) => {
    if (!oyunAcik()) return;
    const k = TUSLAR[e.code];
    if (k) { e.preventDefault(); if (k === "zipla" && !tus.zipla) ziplaBasildi = true; if (k === "at" && !tus.at) atBasildi = true; tus[k] = true; }
    if (e.code === "Escape" || e.code === "KeyP") duraklat();
    if ((e.code === "Enter" || e.code === "Space") && ekran) { e.preventDefault(); ekranTamam(); }
  });
  addEventListener("keyup", (e) => { const k = TUSLAR[e.code]; if (k) tus[k] = false; });
  document.querySelectorAll("[data-mc-tus]").forEach((b) => {
    const k = b.dataset.mcTus;
    const bas = (e) => { e.preventDefault(); if (k === "zipla" && !tus.zipla) ziplaBasildi = true; if (k === "at") atBasildi = true; tus[k] = true; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch { /* yok */ } if (ekran && k === "zipla") ekranTamam(); };
    const birak = (e) => { e.preventDefault(); tus[k] = false; b.classList.remove("on"); };
    b.addEventListener("pointerdown", bas); b.addEventListener("pointerup", birak); b.addEventListener("pointercancel", birak); b.addEventListener("lostpointercapture", () => { tus[k] = false; b.classList.remove("on"); });
  });
  addEventListener("blur", () => { tus.sol = tus.sag = tus.zipla = tus.at = false; });

  // ---------- durum ----------
  let S = null; // aktif bölüm durumu
  let ekran = null; // "giris" | "bitti" | "durdu" | null
  let calisiyor = false, sonZaman = 0, birikim = 0;
  const oyunAcik = () => !$("mcOyun").hidden;

  function bolumKur(no) {
    const sv = SEV[no];
    const satir = sv.harita, W = satir[0].length;
    const k = satir.map((r) => r.split(""));
    const s = {
      no, sv, W, H: satir.length, k, oto: !!sv.otomatik, tema: sv.tema,
      dusman: [], mermi: [], parca: [], kitapci: [], burger: [], kontrol: [], bitis: null, platform: [],
      boss: null, arena: null, kamera: 0, sure: 0, olum: 0, toplanan: 0, atilan: 0, ekstra: 0, cephane: [], cephaneSaat: 0, atisBekle: 0, bizim: [], basla: null, sallanma: 0, bitti: false, olu: 0, mesaj: null,
    };
    let arenaBas = null, arenaDuvar = null;
    for (let r = 0; r < s.H; r++) for (let c = 0; c < W; c++) {
      const ch = k[r][c], x = c * T, y = r * T;
      if ("PeucoCkBFAm".includes(ch)) k[r][c] = ".";
      if (ch === "P") s.basla = { x: x + 6, y: y + T - 50 };
      else if (ch === "e") s.dusman.push({ tip: "yuru", x: x + 4, y: y + 8, w: 32, h: 32, vx: -70, vy: 0, canli: true });
      else if (ch === "u") s.dusman.push({ tip: "uc", x: x + 2, y, w: 36, h: 28, ox: x, oy: y, t: Math.random() * 6, canli: true });
      else if (ch === "c") s.dusman.push({ tip: "araba", x, y: y + 6, w: 64, h: 34, vx: 0, canli: true });
      else if (ch === "o") s.burger.push({ x: x + 8, y: y + 8, w: 24, h: 24, al: false });
      else if (ch === "C") s.kontrol.push({ x: x + 10, y: y - 40, w: 20, h: 80, aktif: false });
      else if (ch === "k") s.kitapci.push({ x: x + 20, zaman: 1 + Math.random() * 2 });
      else if (ch === "m") s.platform.push({ x, y, w: 3 * T, h: 14, ox: x, t: 0, dx: 0 });
      else if (ch === "F") s.bitis = { x: x, y: y - 80, w: 40, h: 120 };
      else if (ch === "A") arenaBas = c;
      else if (ch === "B") s.bossBas = { x, y: y - 50 };
    }
    if (arenaBas != null) {
      for (let c = arenaBas + 1; c < W; c++) if (k[5][c] === "=" && k[0][c] === "=") { arenaDuvar = c; break; }
      s.arena = { bas: arenaBas * T, son: arenaDuvar * T, duvarC: arenaDuvar, aktif: false, bitti: false };
    }
    s.kontrolNokta = { ...s.basla };
    s.burgerToplam = s.burger.length;
    s.p = oyuncuYeni(s.basla);
    if (sv.boss) yuzYukle(sv.boss.yuz);
    if (sv.boss && sv.boss.tip === "polis") s.polis = { x: s.basla.x - 460, y: 12 * T - 44, w: 80, h: 44, emoji: sv.boss.emoji || "🚓", ad: sv.boss.ad, olum: sv.boss.olum || "Yakalandın" };
    s.ilkDusman = s.dusman.map((d) => ({ ...d }));
    return s;
  }
  function oyuncuYeni(b) { return { x: b.x, y: b.y, w: 28, h: 50, vx: 0, vy: 0, yer: false, yon: 1, coyote: 0, tampon: 0, ezilme: 0, adim: 0 }; }

  // ---------- kare sorguları ----------
  const kare = (c, r) => (r < 0 || r >= S.H || c < 0 || c >= S.W ? (r >= S.H ? "." : c < 0 || c >= S.W ? "#" : ".") : S.k[r][c]);
  const kati = (ch) => ch === "#" || ch === "=";
  function katiVar(x, y, w, h) {
    const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.01) / T), r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.01) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (kati(kare(c, r))) return { c, r };
    // boss arenası aktifken sol görünmez duvar
    if (S.arena && S.arena.aktif && !S.arena.bitti && x < S.arena.bas) return { c: Math.floor(S.arena.bas / T) - 1, r: r0 };
    return null;
  }
  const kesisir = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // nesneyi (oyuncu / düşman) kare dünyasında hareket ettir
  function hareket(o, dt, tekYon) {
    o.x += o.vx * dt;
    let h = katiVar(o.x, o.y, o.w, o.h);
    if (h) {
      if (o.vx > 0) o.x = h.c * T - o.w; else if (o.vx < 0) o.x = (h.c + 1) * T;
      o.duvar = true; o.vx = 0;
    } else o.duvar = false;
    const altOnce = o.y + o.h;
    o.y += o.vy * dt;
    o.yer = false;
    h = katiVar(o.x, o.y, o.w, o.h);
    if (h) {
      if (o.vy > 0) { o.y = h.r * T - o.h; o.yer = true; } else if (o.vy < 0) { o.y = (h.r + 1) * T; }
      o.vy = 0;
    } else if (tekYon && o.vy >= 0) {
      // alttan geçilen platform: sadece yukarıdan inerken tut
      const c0 = Math.floor(o.x / T), c1 = Math.floor((o.x + o.w - 0.01) / T), r = Math.floor((o.y + o.h) / T);
      for (let c = c0; c <= c1; c++) if (kare(c, r) === "-" && altOnce <= r * T + 1) { o.y = r * T - o.h; o.vy = 0; o.yer = true; break; }
    }
  }

  // ---------- güncelleme ----------
  function guncelle(dt) {
    const s = S, p = s.p;
    if (s.bitti) return;
    if (s.olu > 0) { s.olu -= dt; parcaGuncelle(dt); if (s.olu <= 0) yenidenDog(); return; }
    if (S.p.koruma > 0) S.p.koruma -= dt;
    s.sure += dt * 1000;
    // yatay
    const hedef = s.oto ? KOS_OTO : ((tus.sag ? 1 : 0) - (tus.sol ? 1 : 0)) * KOS;
    const ivme = p.yer ? 2600 : 1700;
    if (p.vx < hedef) p.vx = Math.min(hedef, p.vx + ivme * dt); else if (p.vx > hedef) p.vx = Math.max(hedef, p.vx - ivme * dt);
    if (hedef > 0) p.yon = 1; else if (hedef < 0) p.yon = -1;
    // zıplama (coyote + tampon + değişken yükseklik)
    p.coyote = p.yer ? 0.1 : p.coyote - dt;
    p.tampon = ziplaBasildi ? 0.12 : p.tampon - dt; ziplaBasildi = false;
    if (p.tampon > 0 && p.coyote > 0) { p.vy = -ZIPLA; p.tampon = 0; p.coyote = 0; SES.zipla(); }
    if (!tus.zipla && p.vy < -320) p.vy = -320;
    p.vy = Math.min(MAX_DUS, p.vy + G * dt);
    for (const m of s.platform) { m.t += dt; const nx = m.ox + Math.sin(m.t * 1.1) * 3 * T; m.dx = nx - m.x; m.x = nx; }
    if (p.uzerinde) { p.x += p.uzerinde.dx; if (katiVar(p.x, p.y, p.w, p.h)) p.x -= p.uzerinde.dx; }
    const yerdeydi = p.yer, altOnce = p.y + p.h;
    hareket(p, dt, true);
    p.uzerinde = null;
    if (p.vy >= 0) for (const m of s.platform) {
      if (p.x + p.w > m.x + 2 && p.x < m.x + m.w - 2 && altOnce <= m.y + 2 && p.y + p.h >= m.y) { p.y = m.y - p.h; p.vy = 0; p.yer = true; p.uzerinde = m; break; }
    }
    if (!yerdeydi && p.yer) p.ezilme = 0.12;
    p.ezilme = Math.max(0, p.ezilme - dt);
    if (p.yer && Math.abs(p.vx) > 20) p.adim += dt * Math.abs(p.vx) / 40;
    // düşme / diken
    if (p.y > s.H * T + 60) return ol("Boşluğa düştün");
    const c0 = Math.floor((p.x + 8) / T), c1 = Math.floor((p.x + p.w - 9) / T), r0 = Math.floor((p.y + p.h * 0.5) / T), r1 = Math.floor((p.y + p.h - 1) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (kare(c, r) === "^" && p.y + p.h > r * T + T * 0.45) return ol("Dikene bastın");
    // burger, kontrol noktası, bitiş
    for (const b of s.burger) if (!b.al && kesisir(p, b)) { b.al = true; s.toplanan++; SES.burger(); parcaPatla(b.x + 12, b.y + 12, "#f5b82e", 8); }
    for (const k of s.kontrol) if (!k.aktif && kesisir(p, k)) { s.kontrol.forEach((x) => { if (x.x <= k.x) x.aktif = true; }); s.kontrolNokta = { x: k.x - 4, y: k.y + 80 - 50 }; SES.kontrol(); s.mesaj = { yazi: "✔ Kontrol noktası", t: 1.4 }; }
    if (s.bitis && kesisir(p, s.bitis) && (!s.arena || s.arena.bitti)) return bitir();
    // düşmanlar
    for (const d of s.dusman) {
      if (!d.canli) continue;
      if (Math.abs(d.x - p.x) > VW * 1.3) continue; // ekrandan uzaktakiler uyusun
      if (d.tip === "yuru") {
        d.vy = Math.min(MAX_DUS, d.vy + G * dt);
        const onceVx = d.vx;
        hareket(d, dt, true);
        if (d.duvar) d.vx = -onceVx;
        else if (d.yer) { // uçurum kenarında dön
          const onC = Math.floor((d.vx > 0 ? d.x + d.w + 2 : d.x - 2) / T), altR = Math.floor((d.y + d.h + 2) / T);
          const k = kare(onC, altR);
          if (!kati(k) && k !== "-") d.vx = -d.vx;
        }
        if (d.y > s.H * T) d.canli = false;
      } else if (d.tip === "uc") {
        d.t += dt; d.x = d.ox + Math.sin(d.t * 0.9) * 90; d.y = d.oy + Math.sin(d.t * 2.2) * 26;
      } else if (d.tip === "araba") {
        if (d.x - p.x < VW * 0.9) d.vx = -150;
        d.x += d.vx * dt;
      }
      if (kesisir(p, d)) {
        const ustten = p.vy > 0 && p.y + p.h - d.y < 22;
        if (ustten) {
          p.vy = -560; p.y = d.y - p.h;
          if (d.tip !== "araba") { d.canli = false; SES.ez(); parcaPatla(d.x + d.w / 2, d.y + d.h / 2, "#a855f7", 14); s.sallanma = 0.12; }
          else bip(500, 700, 0.08, "square", 0.1);
        } else if (!(p.koruma > 0)) return ol(d.tip === "araba" ? "Arabaya çarptın" : "Yakalandın");
      }
    }
    // tavandan kitap
    for (const k of s.kitapci) {
      if (Math.abs(k.x - p.x) > VW * 0.8) continue;
      k.zaman -= dt;
      if (k.zaman <= 0) { k.zaman = 1.6 + Math.random() * 1.2; s.mermi.push({ x: k.x - 14 + (Math.random() - 0.5) * 60, y: -30, w: 28, h: 28, vx: 0, vy: 60, emoji: s.sv.yagmur || "📚", yercekim: 0.55, don: (Math.random() - 0.5) * 6, aci: 0 }); }
    }
    // boss
    if (s.arena && !s.arena.aktif && !s.arena.bitti && p.x > s.arena.bas + T * 2) bossBaslat();
    if (s.boss) bossGuncelle(dt);
    if (s.polis) polisGuncelle(dt);
    // boss savaşında arenaya bol burger yağar
    if (s.boss && !s.boss.olu) {
      s.cephaneSaat -= dt;
      if (s.cephaneSaat <= 0 && s.cephane.length < 6) {
        s.cephaneSaat = 1.1;
        const a0 = s.arena.bas + T, a1 = s.arena.son - T * 2;
        s.cephane.push({ x: a0 + Math.random() * (a1 - a0), y: 4, w: 26, h: 26, vx: 0, vy: 0, t: 0, deger: s.sv.bossBurger || 2 });
      }
      for (const c of s.cephane) {
        c.t += dt;
        if (!c.yer) { c.vy = Math.min(500, c.vy + G * 0.35 * dt); hareket(c, dt, true); }
        if (kesisir(p, c)) { c.al = true; s.ekstra += c.deger; SES.burger(); parcaPatla(c.x + 13, c.y + 13, "#f5b82e", 8); }
        if (c.t > 14 || c.y > s.H * T) c.al = true;
      }
      s.cephane = s.cephane.filter((c) => !c.al);
    } else if (s.cephane.length) s.cephane = [];
    // Z: toplanan burgerleri düz fırlat
    s.atisBekle = Math.max(0, s.atisBekle - dt);
    if (atBasildi) {
      atBasildi = false;
      if ((s.toplanan + s.ekstra - s.atilan) > 0 && s.atisBekle <= 0) {
        s.atilan++; s.atisBekle = 0.28;
        s.bizim.push({ x: p.x + p.w / 2 - 13 + p.yon * 12, y: p.y + 12, w: 26, h: 26, vx: p.yon * (s.sv.atisHiz || 720), t: 0, aci: 0, jet: !!s.sv.atisHiz });
        bip(700, 300, 0.07, "triangle", 0.12);
      } else if ((s.toplanan + s.ekstra - s.atilan) <= 0 && s.atisBekle <= 0) { s.atisBekle = 0.5; s.mesaj = { yazi: `Hiç ${s.sv.topla || "🍔"} kalmadı, topla!`, t: 1.2 }; }
    }
    for (const m of s.bizim) {
      m.t += dt; m.x += m.vx * dt; m.aci += dt * 14;
      if (m.t > 1.3 || katiVar(m.x + 5, m.y + 5, m.w - 10, m.h - 10)) { m.bitti = true; parcaPatla(m.x + 13, m.y + 13, "#f5b82e", 6); continue; }
      for (const d of s.dusman) if (d.canli && d.tip !== "araba" && kesisir(m, d)) { d.canli = false; m.bitti = true; SES.ez(); parcaPatla(d.x + d.w / 2, d.y + d.h / 2, "#a855f7", 14); break; }
      const b = s.boss;
      if (!m.bitti && b && !b.olu && kesisir(m, b)) { m.bitti = true; parcaPatla(m.x + 13, m.y + 13, "#f5b82e", 10); if (b.dokunulmaz <= 0) bossHasar(b, 0.5); }
    }
    s.bizim = s.bizim.filter((m) => !m.bitti);
    // mermiler
    for (const m of s.mermi) {
      m.vy = Math.min(MAX_DUS, m.vy + G * (m.yercekim || 1) * dt); m.x += m.vx * dt; m.y += m.vy * dt; m.aci += (m.don || 0) * dt;
      if (katiVar(m.x + 4, m.y + 4, m.w - 8, m.h - 8) || m.y > s.H * T) { m.bitti = true; parcaPatla(m.x + m.w / 2, m.y + m.h / 2, "#94a3b8", 6); continue; }
      if (!(p.koruma > 0) && kesisir({ x: p.x + 4, y: p.y + 6, w: p.w - 8, h: p.h - 8 }, m)) return ol(m.olum || "Vuruldun");
    }
    s.mermi = s.mermi.filter((m) => !m.bitti);
    parcaGuncelle(dt);
    // kamera
    let hedefK = p.x + p.w / 2 - VW * (s.oto ? 0.3 : 0.42) + (s.oto ? 0 : p.yon * 40);
    let min = 0, max = s.W * T - VW;
    if (s.arena && s.arena.aktif && !s.arena.bitti) { min = s.arena.bas; max = Math.max(min, (s.arena.son + T) - VW); }
    hedefK = Math.max(min, Math.min(max, hedefK));
    s.kamera += (hedefK - s.kamera) * Math.min(1, dt * 8);
    s.sallanma = Math.max(0, s.sallanma - dt);
    if (s.mesaj) { s.mesaj.t -= dt; if (s.mesaj.t <= 0) s.mesaj = null; }
  }

  // ---------- boss ----------
  function bossBaslat() {
    const s = S, b = s.sv.boss;
    s.arena.aktif = true;
    // Zorluk: her boss kendi ayarını seviye dosyasından alır (yoksa varsayılan)
    const z = Object.assign({ yuru: 120, atisAra: 1.7, ziplama: 0.5, ofke: 0.25, ciftAtis: true, ucus: 0.85, isabet: 1, ezmePayi: 28, ilkAtis: 1.4 }, b.zorluk || {});
    z.atisAra *= 1.3; z.isabet *= 0.8; z.yuru *= 0.85; z.ofke *= 0.6; z.ezmePayi += 8; // genel kolaylık
    s.ekstraBoss = s.ekstra; s.ekstra += 5; s.cephane = []; s.cephaneSaat = 0.6; // girişte 5 burger hediye
    s.boss = { ...b, z, x: s.bossBas.x, y: s.bossBas.y, w: 64, h: 90, vx: 0, vy: 0, kalan: b.can, atis: z.ilkAtis, hedefX: s.bossBas.x, dokunulmaz: 0, yer: false, olu: false, yon: -1 };
    s.atilanBoss = s.atilan;
    s.mesaj = { yazi: `⚠️ ${b.ad}! Z ile ${s.sv.topla || "🍔"} fırlat`, t: 2.5 };
    SES.boss(); muzikCal("boss");
  }
  function bossGuncelle(dt) {
    const s = S, b = s.boss, p = s.p;
    if (b.olu) { b.y += 300 * dt; b.aci = (b.aci || 0) + dt * 4; return; }
    // "6 saat mola": belli aralıklarla uyur, uyurken yürümez ve atmaz
    if (b.z.uyku) {
      b.uykuSaat = (b.uykuSaat == null ? b.z.uyku.her : b.uykuSaat) - dt;
      if (b.uykuSaat <= -b.z.uyku.sure) b.uykuSaat = b.z.uyku.her;
      b.uyuyor = b.uykuSaat < 0;
    }
    const hiz = b.hizli ? 1.35 : 1;
    const z = b.z, ofke = 1 + (b.can - b.kalan) * z.ofke; // vuruldukça hızlanır
    b.dokunulmaz = Math.max(0, b.dokunulmaz - dt);
    // yürü: rastgele hedefe
    if (Math.abs(b.x - b.hedefX) < 10) b.hedefX = s.arena.bas + T * 2 + Math.random() * (s.arena.son - s.arena.bas - T * 5);
    b.vx = b.uyuyor ? 0 : Math.sign(b.hedefX - b.x) * z.yuru * hiz * ofke;
    b.yon = p.x < b.x ? -1 : 1;
    b.vy = Math.min(MAX_DUS, b.vy + G * dt);
    hareket(b, dt, true);
    if (b.yer && !b.uyuyor && Math.random() < dt * z.ziplama * ofke) b.vy = -760;
    // fırlat
    if (!b.uyuyor) b.atis -= dt * hiz * ofke;
    if (b.atis <= 0) {
      b.atis = z.atisAra;
      // isabet < 1: mermi oyuncunun biraz önüne/arkasına düşer (kaçması kolay)
      const sapma = (1 - z.isabet) * (Math.random() < 0.5 ? -1 : 1) * 120;
      const dx = p.x + p.w / 2 + sapma - (b.x + b.w / 2), ucus = z.ucus;
      const adet = z.ciftAtis && b.kalan <= Math.ceil(b.can / 2) ? 2 : 1;
      for (let i = 0; i < adet; i++) {
        s.mermi.push({ x: b.x + b.w / 2 - 14, y: b.y + 10, w: 28, h: 28, vx: (dx / ucus) * (i ? 0.7 : 1), vy: -G * ucus / 2 + (p.y - b.y) / ucus * 0.5, emoji: b.mermi, don: 8, aci: 0, yazi: b.yazilar ? b.yazilar[Math.floor(Math.random() * b.yazilar.length)] : b.yazi, olum: `${b.ad} vurdu` });
      }
      SES.firlat();
    }
    // temas
    if (kesisir(p, b) && b.dokunulmaz <= 0) {
      if (p.vy > 0 && p.y + p.h - b.y < z.ezmePayi) {
        p.vy = -650; p.y = b.y - p.h;
        bossHasar(b, 1);
      } else if (b.dokunulmaz <= 0 && !(p.koruma > 0)) return ol(`${b.ad} yakaladı`);
    }
  }
  // ezme 1 can, burger yarım can götürür
  function bossHasar(b, miktar) {
    const s = S;
    b.kalan = Math.max(0, Math.round((b.kalan - miktar) * 2) / 2); b.dokunulmaz = miktar >= 1 ? 1.1 : 0.35; s.sallanma = miktar >= 1 ? 0.25 : 0.1; SES.vurus();
    parcaPatla(b.x + b.w / 2, b.y + 20, "#ef4444", miktar >= 1 ? 18 : 9);
    if (b.kalan <= 0) {
      b.olu = true; s.arena.bitti = true;
      for (let r = 0; r < 12; r++) S.k[r][s.arena.duvarC] = ".";
      s.mesaj = { yazi: `🏆 ${b.ad} yenildi! Çıkışa koş →`, t: 3 };
      s.mermi = []; s.bizim = [];
      SES.bitti(); muzikCal(s.sv.muzik || s.tema);
    }
  }
  function polisGuncelle(dt) {
    const s = S, po = s.polis, p = s.p;
    const hedefHiz = KOS_OTO * 0.94;
    po.x += hedefHiz * dt;
    // çok geride kaldıysa yetiş (hep kovalıyormuş gibi)
    if (p.x - po.x > 620) po.x = p.x - 620;
    po.siren = (po.siren || 0) + dt;
    if (po.x + po.w > p.x + 6) return ol(po.olum);
  }

  // ---------- ölüm / bitiş ----------
  function ol(neden) {
    const s = S, p = s.p;
    if (s.olu > 0 || s.bitti) return;
    s.olum++; s.olu = 0.9; s.sonNeden = neden;
    SES.ol(); s.sallanma = 0.3;
    parcaPatla(p.x + p.w / 2, p.y + p.h / 2, "#f97316", 24);
  }
  function yenidenDog() {
    const s = S;
    s.p = oyuncuYeni(s.kontrolNokta);
    s.p.koruma = 1.6; // doğar doğmaz tekrar ölmesin
    // doğma noktasına yakın düşmanları ilk yerlerine geri koy, ilk yerleri de yakınsa uzağa it
    s.dusman.forEach((d, i) => {
      if (d.tip === "araba" || !d.canli) return;
      if (Math.abs(d.x - s.p.x) < 6 * T) { const o = s.ilkDusman[i]; d.x = o.x; d.y = o.y; d.vy = 0; if (Math.abs(d.x - s.p.x) < 4 * T) d.canli = false; }
    });
    s.mermi = []; s.bizim = [];
    if (s.boss && !s.arena.bitti) { s.atilan = s.atilanBoss || 0; s.ekstra = s.ekstraBoss || 0; s.cephane = []; s.boss = null; s.arena.aktif = false; muzikCal(s.sv.muzik || s.tema); }
    if (s.polis) s.polis.x = s.p.x - 460;
    // arabalar geri gelsin (motor bölümünde öldükten sonra yol boş kalmasın)
    s.dusman.forEach((d, i) => { if (d.tip === "araba") { const o = s.ilkDusman[i]; d.x = o.x; d.vx = 0; } });
  }
  function bitir() {
    const s = S;
    s.bitti = true; muzikCal("zafer");
    const sure = Math.round(s.sure), bolum = s.no + 1;
    let enIyi = null;
    try {
      const kayit = JSON.parse(localStorage.getItem("macera_kayit") || "{}");
      const eski = kayit[bolum];
      enIyi = !eski || sure < eski.sure;
      if (enIyi) kayit[bolum] = { sure, olum: s.olum, burger: s.toplanan };
      kayit.acik = Math.max(kayit.acik || 1, bolum + 1);
      localStorage.setItem("macera_kayit", JSON.stringify(kayit));
    } catch { /* yok */ }
    skorGonder(bolum, sure, s.olum, s.toplanan);
    ekranGoster("bitti", { sure, enIyi });
  }

  // ---------- parçacık ----------
  function parcaPatla(x, y, renk, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260; S.parca.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: 0.6 + Math.random() * 0.4, renk }); } }
  function parcaGuncelle(dt) { for (const q of S.parca) { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.t -= dt; } S.parca = S.parca.filter((q) => q.t > 0); }

  // ---------- çizim ----------
  const TEMA = {
    depo: { gok: ["#1e2433", "#3b4458"], zemin: "#5b4a3a", zeminUst: "#8b6f4e", koli: "#c8955a", koliCizgi: "#8a5f2f", plat: "#9ca3af", silu: "#2a3142" },
    yol: { gok: ["#ff9a5a", "#ffd29a"], zemin: "#3f3f46", zeminUst: "#71717a", koli: "#c8955a", koliCizgi: "#8a5f2f", plat: "#a1a1aa", silu: "#7c4a52" },
    sinav: { gok: ["#7dd3fc", "#e0f2fe"], zemin: "#4d7c0f", zeminUst: "#84cc16", koli: "#f97316", koliCizgi: "#fff", plat: "#e5e7eb", silu: "#93c5fd" },
    kutuphane: { gok: ["#2e1a47", "#4c2a6e"], zemin: "#5b3a29", zeminUst: "#92613f", koli: "#7c3f1d", koliCizgi: "#3b1d0d", plat: "#b08968", silu: "#3a2357" },
    gece: { gok: ["#0b1026", "#1e2a5a"], zemin: "#27272a", zeminUst: "#52525b", koli: "#b45309", koliCizgi: "#78350f", plat: "#94a3b8", silu: "#111827" },
    borsa: { gok: ["#020617", "#0f2a1d"], zemin: "#1e293b", zeminUst: "#334155", koli: "#475569", koliCizgi: "#94a3b8", plat: "#64748b", silu: "#14532d" },
    otobus: { gok: ["#fb923c", "#fde68a"], zemin: "#44403c", zeminUst: "#78716c", koli: "#ca8a04", koliCizgi: "#713f12", plat: "#d6d3d1", silu: "#9a3412" },
    mutfak: { gok: ["#e2e8f0", "#f8fafc"], zemin: "#64748b", zeminUst: "#cbd5e1", koli: "#e5e7eb", koliCizgi: "#94a3b8", plat: "#cbd5e1", silu: "#cbd5e1" },
    sanayi: { gok: ["#57534e", "#a8a29e"], zemin: "#292524", zeminUst: "#57534e", koli: "#b91c1c", koliCizgi: "#450a0a", plat: "#78716c", silu: "#44403c" },
    zula: { gok: ["#1e0b3a", "#3b0764"], zemin: "#1e1b4b", zeminUst: "#22d3ee", koli: "#7c3aed", koliCizgi: "#22d3ee", plat: "#a855f7", silu: "#2e1065" },
    sabah: { gok: ["#1e1b4b", "#f472b6"], zemin: "#3f3f46", zeminUst: "#a1a1aa", koli: "#7c3f1d", koliCizgi: "#3b1d0d", plat: "#d4d4d8", silu: "#312e81" },
  };
  function arkaPlan(s, tm) {
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, tm.gok[0]); g.addColorStop(1, tm.gok[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    const kay = (hiz, gen) => -((s.kamera * hiz) % gen);
    ctx.fillStyle = tm.silu;
    if (s.tema === "depo") {
      // raflar
      for (let x = kay(0.3, 220) - 220; x < VW + 220; x += 220) { ctx.globalAlpha = 0.7; ctx.fillRect(x, 120, 150, 360); ctx.globalAlpha = 1; ctx.fillStyle = "#3b4458"; for (let y = 150; y < 470; y += 70) ctx.fillRect(x + 6, y, 138, 8); ctx.fillStyle = tm.silu; }
      ctx.fillStyle = "rgba(255,230,150,.12)"; for (let x = kay(0.15, 300) - 300; x < VW + 300; x += 300) { ctx.beginPath(); ctx.moveTo(x + 100, 0); ctx.lineTo(x + 40, 480); ctx.lineTo(x + 180, 480); ctx.fill(); }
      ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.font = "800 64px sans-serif"; ctx.fillText("MEZ4", kay(0.2, 900) + 300, 110);
    } else if (s.tema === "yol") {
      ctx.fillStyle = "#ffe8b0"; ctx.beginPath(); ctx.arc(760, 140, 60, 0, 7); ctx.fill();
      ctx.fillStyle = tm.silu;
      for (let x = kay(0.25, 140) - 140, i = 0; x < VW + 140; x += 140, i++) { const h = 140 + ((Math.floor((s.kamera * 0.25) / 140) + i) * 53 % 120); ctx.fillRect(x, 480 - h, 110, h); }
      ctx.fillStyle = "#f4d03f"; for (let x = kay(1, 80); x < VW; x += 80) ctx.fillRect(x, 500, 40, 6);
    } else if (s.tema === "sinav") {
      ctx.fillStyle = "#fff"; for (let x = kay(0.1, 400) - 400; x < VW + 400; x += 400) { ctx.beginPath(); ctx.arc(x + 80, 90, 30, 0, 7); ctx.arc(x + 115, 80, 38, 0, 7); ctx.arc(x + 155, 95, 28, 0, 7); ctx.fill(); }
      ctx.fillStyle = tm.silu; for (let x = kay(0.3, 360) - 360; x < VW + 360; x += 360) { ctx.fillRect(x, 300, 200, 180); ctx.fillStyle = "#1e3a8a"; ctx.font = "800 20px sans-serif"; ctx.fillText("SÜRÜCÜ KURSU", x + 18, 330); ctx.fillStyle = tm.silu; }
    } else if (s.tema === "gece") {
      ctx.fillStyle = "#fff"; for (let i = 0; i < 40; i++) ctx.fillRect((i * 173 - s.kamera * 0.05) % VW + (i * 173 - s.kamera * 0.05 < 0 ? VW : 0), (i * 97) % 260, 2, 2);
      ctx.fillStyle = "#fef3c7"; ctx.beginPath(); ctx.arc(780, 100, 40, 0, 7); ctx.fill(); ctx.fillStyle = tm.gok[0]; ctx.beginPath(); ctx.arc(800, 90, 36, 0, 7); ctx.fill();
      for (let x = kay(0.3, 160) - 160, i = 0; x < VW + 160; x += 160, i++) { const h = 160 + ((Math.floor((s.kamera * 0.3) / 160) + i) * 61 % 140); ctx.fillStyle = tm.silu; ctx.fillRect(x, 480 - h, 130, h); ctx.fillStyle = "rgba(250,204,21,.6)"; for (let y = 500 - h; y < 460; y += 34) for (let j = 0; j < 4; j++) if ((y + j * 7 + i) % 3) ctx.fillRect(x + 12 + j * 30, y, 14, 16); }
      ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.font = "800 46px sans-serif"; ctx.fillText("KÖFTE EKMEK 7/24", kay(0.2, 1100) + 300, 60);
    } else if (s.tema === "borsa") {
      ctx.strokeStyle = "rgba(34,197,94,.12)"; ctx.lineWidth = 1; for (let y = 40; y < 480; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
      for (let x = kay(0.3, 24) - 24, i = Math.floor(s.kamera * 0.3 / 24); x < VW + 24; x += 24, i++) { const a = 260 + Math.sin(i * 0.7) * 90 + Math.sin(i * 0.23) * 60, b = a + Math.sin(i * 1.3) * 40; ctx.fillStyle = b < a ? "rgba(34,197,94,.45)" : "rgba(239,68,68,.45)"; ctx.fillRect(x, Math.min(a, b), 14, Math.abs(a - b) + 4); }
      ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.font = "800 54px sans-serif"; ctx.fillText("BAKİYE: 12 ₺", kay(0.2, 1000) + 260, 70);
    } else if (s.tema === "otobus") {
      ctx.fillStyle = "#fff7ed"; ctx.beginPath(); ctx.arc(150, 380, 70, 0, 7); ctx.fill();
      for (let x = kay(0.25, 150) - 150, i = 0; x < VW + 150; x += 150, i++) { const h = 120 + ((Math.floor((s.kamera * 0.25) / 150) + i) * 47 % 110); ctx.fillStyle = tm.silu; ctx.fillRect(x, 480 - h, 120, h); }
      const bx = kay(0.6, 1400) + 900; ctx.fillStyle = "#16a34a"; ctx.fillRect(bx, 400, 260, 80); ctx.fillStyle = "#bbf7d0"; for (let j = 0; j < 5; j++) ctx.fillRect(bx + 14 + j * 48, 412, 36, 26); ctx.fillStyle = "#fff"; ctx.font = "900 22px sans-serif"; ctx.fillText("201", bx + 200, 468);
    } else if (s.tema === "mutfak") {
      ctx.fillStyle = "#e2e8f0"; for (let x = kay(0.2, 40) - 40; x < VW + 40; x += 40) for (let y = 0; y < 480; y += 40) { ctx.strokeStyle = "rgba(148,163,184,.4)"; ctx.strokeRect(x, y, 40, 40); }
      for (let x = kay(0.35, 320) - 320; x < VW + 320; x += 320) { ctx.fillStyle = "#94a3b8"; ctx.fillRect(x, 330, 220, 150); ctx.fillStyle = "#475569"; ctx.fillRect(x + 20, 300, 60, 30); ctx.fillRect(x + 120, 300, 60, 30); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(x + 50, 270 + Math.sin(performance.now() / 300 + x) * 6, 14, 0, 7); ctx.fill(); }
      ctx.fillStyle = "rgba(15,23,42,.12)"; ctx.font = "800 44px sans-serif"; ctx.fillText("İZMİT BELEDİYESİ · 1 EKMEK SATILDI", kay(0.2, 1400) + 200, 70);
    } else if (s.tema === "sanayi") {
      for (let x = kay(0.25, 260) - 260; x < VW + 260; x += 260) { ctx.fillStyle = tm.silu; ctx.fillRect(x, 260, 210, 220); ctx.fillStyle = "#1c1917"; ctx.fillRect(x + 30, 330, 150, 150); ctx.fillStyle = "#facc15"; for (let j = 0; j < 7; j++) ctx.fillRect(x + 30 + j * 22, 320, 11, 10); ctx.fillStyle = "#fff"; ctx.font = "800 15px sans-serif"; ctx.fillText("OTO TAMİR", x + 60, 300); }
      ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.font = "800 50px sans-serif"; ctx.fillText("ZANAAT ÖĞRENİN", kay(0.2, 1100) + 260, 80);
    } else if (s.tema === "zula") {
      ctx.strokeStyle = "rgba(34,211,238,.25)"; ctx.lineWidth = 1; const ofs = kay(0.4, 60); for (let x = ofs; x < VW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(VW / 2 + (x - VW / 2) * 3, 560); ctx.stroke(); } for (let y = 300; y < 560; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
      ctx.fillStyle = "#f472b6"; ctx.beginPath(); ctx.arc(VW / 2, 300, 110, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.font = "900 54px sans-serif"; ctx.fillText("LVL 50 · 600 ₺", kay(0.2, 1000) + 280, 80);
    } else if (s.tema === "sabah") {
      ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.arc(VW - 160, 470, 80, 0, 7); ctx.fill();
      for (let x = kay(0.3, 180) - 180; x < VW + 180; x += 180) { ctx.fillStyle = tm.silu; ctx.fillRect(x, 140, 150, 340); ctx.fillStyle = "rgba(253,224,71,.55)"; for (let y = 160; y < 460; y += 40) ctx.fillRect(x + 16, y, 118, 18); }
      ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.font = "900 80px sans-serif"; ctx.fillText("05:17", kay(0.2, 900) + 320, 110);
    } else {
      for (let x = kay(0.3, 180) - 180; x < VW + 180; x += 180) { ctx.fillRect(x, 60, 150, 420); const renk = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"]; for (let y = 80; y < 470; y += 56) for (let i = 0; i < 9; i++) { ctx.fillStyle = renk[(i + y) % 5]; ctx.globalAlpha = 0.35; ctx.fillRect(x + 10 + i * 15, y, 11, 44); } ctx.globalAlpha = 1; ctx.fillStyle = tm.silu; }
      ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.font = "800 54px sans-serif"; ctx.fillText("KPSS 2026", kay(0.2, 1000) + 260, 50);
    }
  }
  function kareleriCiz(s, tm) {
    const c0 = Math.max(0, Math.floor(s.kamera / T) - 1), c1 = Math.min(s.W - 1, Math.ceil((s.kamera + VW) / T) + 1);
    for (let r = 0; r < s.H; r++) for (let c = c0; c <= c1; c++) {
      const ch = s.k[r][c]; if (ch === ".") continue;
      const x = c * T, y = r * T;
      if (ch === "#") {
        ctx.fillStyle = tm.zemin; ctx.fillRect(x, y, T + 1, T + 1);
        if (!kati(kare(c, r - 1))) { ctx.fillStyle = tm.zeminUst; ctx.fillRect(x, y, T + 1, 9); }
        ctx.fillStyle = "rgba(0,0,0,.12)"; if ((c + r) % 3 === 0) ctx.fillRect(x + 8, y + 18, 6, 6);
      } else if (ch === "=") {
        const arenaDuvari = s.arena && c === s.arena.duvarC;
        ctx.fillStyle = arenaDuvari ? "#52525b" : tm.koli; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.strokeStyle = arenaDuvari ? "#a1a1aa" : tm.koliCizgi; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
        if (!arenaDuvari) { ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + T - 3, y + T - 3); ctx.moveTo(x + T - 3, y + 3); ctx.lineTo(x + 3, y + T - 3); ctx.stroke(); }
        else { ctx.fillStyle = "#fbbf24"; ctx.fillRect(x + 4, y + 16, T - 8, 8); }
      } else if (ch === "-") {
        ctx.fillStyle = tm.plat; ctx.fillRect(x, y, T + 1, 10); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x, y + 10, T + 1, 4);
      } else if (ch === "^") {
        ctx.fillStyle = "#d4d4d8";
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 13.3, y + T); ctx.lineTo(x + i * 13.3 + 6.6, y + T * 0.45); ctx.lineTo(x + (i + 1) * 13.3, y + T); ctx.fill(); }
        ctx.fillStyle = "#ef4444"; for (let i = 0; i < 3; i++) ctx.fillRect(x + i * 13.3 + 5.6, y + T * 0.45, 2, 4);
      }
    }
  }
  function emoji(e, x, y, boyut, aci) {
    ctx.save(); ctx.translate(x, y); if (aci) ctx.rotate(aci);
    ctx.font = `${boyut}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(e, 0, 0); ctx.restore();
  }
  function kahramanCiz(s, p) {
    const yer = s.oto && s.sv.motor;
    const sq = p.ezilme > 0 ? 1 - p.ezilme * 1.2 : 1;
    const bob = p.yer && Math.abs(p.vx) > 20 && !yer ? Math.abs(Math.sin(p.adim * Math.PI)) * 3 : 0;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h);
    if (yer) {
      // motor
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-26, -10, 12, 0, 7); ctx.arc(30, -10, 12, 0, 7); ctx.fill();
      ctx.fillStyle = "#9ca3af"; ctx.beginPath(); ctx.arc(-26, -10, 5, 0, 7); ctx.arc(30, -10, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.moveTo(-30, -18); ctx.lineTo(24, -18); ctx.lineTo(36, -30); ctx.lineTo(10, -34); ctx.lineTo(-16, -30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(30, -10); ctx.lineTo(36, -38); ctx.lineTo(28, -44); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "800 9px sans-serif"; ctx.fillText("85", -6, -22);
      if (KAHRAMAN.complete) ctx.drawImage(KAHRAMAN, -30, -86, 56, 58);
    } else {
      ctx.scale(p.yon * (2 - sq), sq);
      if (KAHRAMAN.complete) ctx.drawImage(KAHRAMAN, -32, -62 - bob, 64, 66);
      // bacaklar
      ctx.strokeStyle = "#2c2e36"; ctx.lineWidth = 7; ctx.lineCap = "round";
      const a = p.yer ? Math.sin(p.adim * Math.PI) * 7 : 4;
      ctx.beginPath(); ctx.moveTo(-6, -6 - bob); ctx.lineTo(-6 - a, 0); ctx.moveTo(6, -6 - bob); ctx.lineTo(6 + a, 0); ctx.stroke();
    }
    ctx.restore();
  }
  function bossCiz(b) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    if (b.olu) ctx.rotate(b.aci);
    if (b.dokunulmaz > 0 && Math.floor(b.dokunulmaz * 12) % 2) ctx.globalAlpha = 0.4;
    ctx.fillStyle = b.yuz === "kurban" ? "#4b5563" : b.yuz === "hoca" ? "#1e3a8a" : "#334155";
    ctx.beginPath(); ctx.roundRect(-30, -62, 60, 62, 12); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(-6, -60, 12, 18); ctx.fillStyle = "#dc2626"; ctx.fillRect(-3, -56, 6, 16);
    const yz = yuzler[b.yuz];
    ctx.save(); ctx.beginPath(); ctx.arc(0, -84, 28, 0, 7); ctx.closePath();
    if (yz) { ctx.clip(); ctx.drawImage(yz, -30, -114, 60, 60); } else { ctx.fillStyle = "#fcd9b6"; ctx.fill(); ctx.restore(); ctx.save(); emoji(b.emoji, 0, -84, 50); }
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.font = "800 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(b.ad, b.x + b.w / 2, b.y - 40); ctx.textAlign = "left";
    if (b.uyuyor && !b.olu) { emoji("💤", b.x + b.w + 6, b.y - 10 - (Math.floor(performance.now() / 400) % 2) * 8, 26); ctx.fillStyle = "#facc15"; ctx.font = "900 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("MOLADA!", b.x + b.w / 2, b.y - 56); ctx.textAlign = "left"; }
  }
  function ciz() {
    const s = S; if (!s) return;
    const tm = TEMA[s.tema];
    ctx.save();
    arkaPlan(s, tm);
    const sx = s.sallanma > 0 ? (Math.random() - 0.5) * 10 : 0, sy = s.sallanma > 0 ? (Math.random() - 0.5) * 10 : 0;
    ctx.translate(-Math.round(s.kamera) + sx, sy);
    kareleriCiz(s, tm);
    // kontrol + bitiş
    for (const k of s.kontrol) { ctx.fillStyle = "#e5e7eb"; ctx.fillRect(k.x + 8, k.y, 4, k.h); ctx.fillStyle = k.aktif ? "#22c55e" : "#ef4444"; ctx.beginPath(); ctx.moveTo(k.x + 12, k.y); ctx.lineTo(k.x + 40, k.y + 12); ctx.lineTo(k.x + 12, k.y + 24); ctx.fill(); }
    if (s.bitis) {
      const f = s.bitis; ctx.fillStyle = "#e5e7eb"; ctx.fillRect(f.x + 18, f.y, 5, f.h);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? "#111" : "#fff"; ctx.fillRect(f.x + 23 + i * 12, f.y + j * 12, 12, 12); }
      ctx.fillStyle = "#fff"; ctx.font = "800 14px sans-serif"; ctx.fillText(s.oto ? (s.sv.motor ? "EVE VARIŞ" : "DURAK") : "ÇIKIŞ", f.x - 6, f.y - 10);
    }
    for (const m of s.platform) {
      ctx.fillStyle = s.tema === "borsa" ? (Math.sin(m.t * 1.1) > 0 ? "#16a34a" : "#dc2626") : tm.plat;
      ctx.fillRect(m.x, m.y, m.w, m.h); ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(m.x, m.y + m.h, m.w, 4);
      if (s.tema === "borsa") { ctx.fillStyle = ctx.fillStyle = Math.sin(m.t * 1.1) > 0 ? "#16a34a" : "#dc2626"; ctx.fillRect(m.x + m.w / 2 - 2, m.y - 26, 4, 26); ctx.fillRect(m.x + m.w / 2 - 2, m.y + m.h, 4, 20); }
      else { ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x + 8, m.y + 7); ctx.lineTo(m.x + 20, m.y + 7); ctx.moveTo(m.x + m.w - 20, m.y + 7); ctx.lineTo(m.x + m.w - 8, m.y + 7); ctx.stroke(); }
    }
    const zaman = performance.now() / 1000;
    const TOPLA = s.sv.topla || "🍔", DUS = s.sv.dusman || {};
    for (const b of s.burger) if (!b.al) emoji(TOPLA, b.x + 12, b.y + 12 + Math.sin(zaman * 3 + b.x) * 3, 24);
    for (const d of s.dusman) {
      if (!d.canli || d.x < s.kamera - 100 || d.x > s.kamera + VW + 100) continue;
      if (d.tip === "yuru") emoji(DUS.yuru || (s.tema === "depo" ? "🚜" : s.tema === "sinav" ? "🚧" : s.tema === "kutuphane" ? "🐛" : "🛵"), d.x + 16, d.y + 16, 32);
      else if (d.tip === "uc") emoji(DUS.uc || (s.tema === "kutuphane" ? "🦇" : s.tema === "sinav" ? "📸" : "🕊️"), d.x + 18, d.y + 14, 30);
      else if (d.tip === "araba") { ctx.save(); ctx.translate(d.x + 32, d.y + 17); ctx.scale(-1, 1); emoji("🚗", 0, 0, 56); ctx.restore(); }
    }
    for (const m of s.bizim) {
      if (m.jet) { const g = ctx.createLinearGradient(m.x + 13 - Math.sign(m.vx) * 90, 0, m.x + 13, 0); g.addColorStop(0, "rgba(251,146,60,0)"); g.addColorStop(1, "rgba(251,191,36,.9)"); ctx.fillStyle = g; ctx.fillRect(Math.min(m.x + 13, m.x + 13 - Math.sign(m.vx) * 90), m.y + 8, 90, 10); }
      emoji(s.sv.topla || "🍔", m.x + 13, m.y + 13, 26, m.aci);
    }
    for (const c of s.cephane) { emoji(s.sv.topla || "🍔", c.x + 13, c.y + 13 + (c.yer ? Math.sin(performance.now() / 200 + c.x) * 3 : 0), 28); ctx.fillStyle = "#facc15"; ctx.font = "900 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText("+" + c.deger, c.x + 13, c.y - 4); ctx.textAlign = "left"; }
    for (const m of s.mermi) { emoji(m.emoji, m.x + m.w / 2, m.y + m.h / 2, 28, m.aci); if (m.yazi) { ctx.fillStyle = "#dc2626"; ctx.font = "900 10px sans-serif"; ctx.fillText(m.yazi, m.x - 2, m.y - 4); } }
    if (s.boss) bossCiz(s.boss);
    if (s.polis) {
      const po = s.polis;
      ctx.save(); ctx.translate(po.x + 40, po.y + 22); ctx.scale(-1, 1); emoji(po.emoji, 0, 0, 72); ctx.restore();
      const yan = Math.floor((po.siren || 0) * 6) % 2;
      if (po.emoji === "🚓") { ctx.fillStyle = yan ? "rgba(239,68,68,.35)" : "rgba(59,130,246,.35)"; ctx.beginPath(); ctx.arc(po.x + 40, po.y - 8, 36, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = "rgba(148,163,184,.35)"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(po.x + 10 - i * 30, po.y + 10 + Math.sin((po.siren || 0) * 3 + i) * 8, 30 - i * 6, 0, 7); ctx.fill(); } emoji("💤", po.x + 70, po.y - 20 - (Math.floor((po.siren || 0) * 2) % 2) * 6, 26); }
    }
    if (s.olu <= 0 && !s.bitti && !(s.p.koruma > 0 && Math.floor(s.p.koruma * 10) % 2)) kahramanCiz(s, s.p);
    for (const q of s.parca) { ctx.globalAlpha = Math.min(1, q.t * 2); ctx.fillStyle = q.renk; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); }
    ctx.globalAlpha = 1;
    ctx.restore();
    hudCiz(s);
  }
  function hudCiz(s) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.roundRect(12, 12, 330, 40, 12); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "800 17px ui-monospace, monospace";
    ctx.fillText(`⏱ ${sureYaz(s.sure)}   💀 ${s.olum}   ${s.sv.topla || "🍔"} ${s.toplanan}/${s.burgerToplam}`, 24, 38);
    ctx.font = "800 15px sans-serif"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillText(`${s.no + 1}. Bölüm · ${s.sv.ad}`, VW - 20, 38); ctx.textAlign = "left";
    const b = s.boss;
    if (b && !b.olu) {
      const w = 360, x = (VW - w) / 2, y = 64;
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.roundRect(x - 8, y - 22, w + 16, 46, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "800 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText(b.ad.toUpperCase(), VW / 2, y - 6);
      ctx.fillStyle = "#3f3f46"; ctx.fillRect(x, y + 2, w, 12); ctx.fillStyle = "#ef4444"; ctx.fillRect(x, y + 2, w * (b.kalan / b.can), 12); ctx.textAlign = "left";
    }
    if (s.polis && !s.bitti) {
      const m = Math.max(0, Math.round((s.p.x - s.polis.x - s.polis.w) / 40));
      ctx.fillStyle = m < 4 ? "#ef4444" : "#fff"; ctx.font = "800 16px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${s.polis.emoji} ${s.polis.ad} ${m} m arkanda`, VW / 2, 80); ctx.textAlign = "left";
    }
    if (s.boss && !s.boss.olu) {
      const kalan = (s.toplanan + s.ekstra - s.atilan), y = 100, yazi = `Z ile ${s.sv.topla || "🍔"} fırlatabilirsin · elinde ${kalan}`;
      ctx.font = "800 16px sans-serif"; ctx.textAlign = "center"; const g = ctx.measureText(yazi).width + 28;
      ctx.fillStyle = kalan > 0 ? "rgba(234,179,8,.92)" : "rgba(63,63,70,.85)"; ctx.beginPath(); ctx.roundRect(VW / 2 - g / 2, y - 18, g, 28, 14); ctx.fill();
      ctx.fillStyle = kalan > 0 ? "#1c1917" : "#fff"; ctx.fillText(yazi, VW / 2, y + 1); ctx.textAlign = "left";
    }
    if (s.mesaj) { ctx.globalAlpha = Math.min(1, s.mesaj.t * 2); ctx.fillStyle = "#fff"; ctx.font = "900 30px sans-serif"; ctx.textAlign = "center"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 6; ctx.strokeText(s.mesaj.yazi, VW / 2, 150); ctx.fillText(s.mesaj.yazi, VW / 2, 150); ctx.textAlign = "left"; ctx.globalAlpha = 1; }
    if (s.olu > 0) { ctx.fillStyle = `rgba(0,0,0,${0.5 - s.olu * 0.3})`; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = "#fff"; ctx.font = "900 34px sans-serif"; ctx.textAlign = "center"; ctx.fillText("💀 " + (s.sonNeden || "Öldün"), VW / 2, VH / 2); ctx.textAlign = "left"; }
    ctx.restore();
  }

  // ---------- döngü ----------
  function dongu(t) {
    if (!calisiyor) return;
    requestAnimationFrame(dongu);
    const dt = Math.min(0.1, (t - sonZaman) / 1000 || 0); sonZaman = t;
    if (!ekran && !document.hidden) {
      birikim += dt;
      const ADIM = 1 / 120;
      while (birikim >= ADIM) { guncelle(ADIM); birikim -= ADIM; }
    }
    ciz();
  }

  // ---------- ekranlar (hikâye / bitiş / duraklat) ----------
  const katman = $("mcKatman");
  function ekranGoster(tip, veri) {
    ekran = tip; tus.sol = tus.sag = tus.zipla = false;
    katman.hidden = false; katman.textContent = "";
    const k = el("div", "mc-ekran-kart");
    if (tip === "giris") {
      k.append(el("small", "mc-etiket", `${S.no + 1}. BÖLÜM · ${S.sv.kim || ""}`), el("h2", null, S.sv.ad), el("p", null, S.sv.hikaye));
      const ip = el("p", "mc-ipucu", S.oto ? (S.sv.motor ? "Motor kendi gidiyor: sadece ZIPLA (Boşluk / ⬆ / ekrandaki tuş)." : "Durmadan koşuyorsun: sadece ZIPLA (Boşluk / ⬆ / ekrandaki tuş).") : "← → ile yürü, Boşluk / ⬆ ile zıpla. Düşmanların kafasına zıpla.");
      k.append(ip, dugme("▶ Başla", ekranTamam, true));
    } else if (tip === "bitti") {
      k.append(el("small", "mc-etiket", "BÖLÜM BİTTİ"), el("h2", null, `🏁 ${S.sv.ad}`));
      const ist = el("div", "mc-ist");
      ist.append(kutu("Süre", sureYaz(veri.sure)), kutu("Ölüm", S.olum), kutu(S.sv.topla ? "Toplanan " + S.sv.topla : "Burger", `${S.toplanan}/${S.burgerToplam}`));
      k.append(ist);
      if (veri.enIyi) k.append(el("p", "mc-rekor", "⭐ Kendi rekorun!"));
      const bt = el("div", "mc-btns");
      if (S.no + 1 < SEV.length) bt.append(dugme("Sonraki bölüm →", () => bolumBaslat(S.no + 1), true));
      else bt.append(el("p", "mc-rekor", "🏆 İbo'nun 100 maddesi çürütüldü. Berkay herkesi yendi. Oyun bitti! (İnanması zor.)"));
      bt.append(dugme("↺ Tekrar", () => bolumBaslat(S.no)), dugme("Bölümler", oyundanCik));
      const pay = dugme("📤 Paylaş", () => {
        const m = `🎮 Berkay: The Game · ${S.no + 1}. bölüm (${S.sv.ad}) ${sureYaz(veri.sure)}'de bitti, ${S.olum} kez öldüm. Geç bakalım: ${location.origin}/macera`;
        if (navigator.share) navigator.share({ text: m }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(m), "_blank", "noopener");
      });
      bt.append(pay);
      k.append(bt);
    } else if (tip === "durdu") {
      k.append(el("h2", null, "⏸ Durdu"));
      const bt = el("div", "mc-btns");
      bt.append(dugme("▶ Devam", ekranTamam, true), dugme("↺ Baştan", () => bolumBaslat(S.no)), dugme(sessiz ? "🔊 Sesi aç" : "🔇 Sesi kapat", () => { sesDurumu(!sessiz); ekranGoster("durdu"); }), dugme("Bölümler", oyundanCik));
      k.append(bt);
    }
    katman.append(k);
    const ilk = katman.querySelector(".mc-btn.ana"); if (ilk && matchMedia("(pointer: fine)").matches) ilk.focus();
  }
  const kutu = (a, b) => { const d = el("div"); d.append(el("small", null, a), el("b", null, String(b))); return d; };
  function dugme(yazi, f, ana) { const b = el("button", "mc-btn" + (ana ? " ana" : ""), yazi); b.type = "button"; b.addEventListener("click", (e) => { e.stopPropagation(); f(); }); return b; }
  function ekranTamam() {
    if (ekran === "giris" || ekran === "durdu") { sesAc(); ekran = null; katman.hidden = true; sonZaman = performance.now(); ziplaBasildi = false; muzikCal(S.boss && !S.boss.olu ? "boss" : S.sv.muzik || S.tema); }
    else if (ekran === "bitti" && S.no + 1 < SEV.length) bolumBaslat(S.no + 1);
  }
  function duraklat() { if (!S || S.bitti || ekran) return; muzikDur(); ekranGoster("durdu"); }
  $("mcDurdur").addEventListener("click", () => (ekran === "durdu" ? ekranTamam() : duraklat()));
  document.addEventListener("visibilitychange", () => { if (document.hidden && oyunAcik() && !ekran) duraklat(); else if (document.hidden) muzikDur(); });

  function bolumBaslat(no) {
    sesAc(); muzikDur();
    S = bolumKur(no);
    $("mcSecim").hidden = true; $("mcOyun").hidden = false;
    document.body.classList.add("mc-oynuyor");
    ekranGoster("giris");
    if (!calisiyor) { calisiyor = true; sonZaman = performance.now(); requestAnimationFrame(dongu); }
    history.replaceState(null, "", "#bolum" + (no + 1));
    $("mcOyun").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function oyundanCik() {
    calisiyor = false; S = null; ekran = null; muzikDur();
    $("mcOyun").hidden = true; $("mcSecim").hidden = false; katman.hidden = true;
    document.body.classList.remove("mc-oynuyor");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    history.replaceState(null, "", location.pathname);
    secimCiz();
  }
  $("mcCik").addEventListener("click", oyundanCik);
  $("mcSes").addEventListener("click", () => { sesAc(); sesDurumu(!sessiz); });
  $("mcSes").textContent = sessiz ? "🔇" : "🔊";
  addEventListener("keydown", (e) => { if (e.code === "KeyM" && oyunAcik()) { sesAc(); sesDurumu(!sessiz); } });
  $("mcTam").addEventListener("click", async () => {
    const k = $("mcOyun");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await k.requestFullscreen(); try { await screen.orientation.lock("landscape"); } catch { /* desteklenmiyor */ } }
    } catch { /* yok */ }
  });

  // ---------- bölüm seçimi + sıralama ----------
  let profile = null, skorlar = [];
  function kayitOku() { try { return JSON.parse(localStorage.getItem("macera_kayit") || "{}"); } catch { return {}; } }
  const KAPAK = SEV.map((x) => x.ikon || "🎮");
  function secimCiz() {
    const kayit = kayitOku(), acik = kayit.acik || 1;
    const k = $("mcBolumler"); k.textContent = "";
    SEV.forEach((sv, i) => {
      const kilit = i + 1 > acik;
      const b = el("button", "card mc-bolum" + (kilit ? " kilit" : "")); b.type = "button"; b.disabled = kilit;
      b.dataset.tema = sv.tema;
      b.append(el("span", "mc-bolum-ikon", kilit ? "🔒" : KAPAK[i]), el("small", null, `${i + 1}. BÖLÜM · ${(sv.kim || "").toUpperCase()}`), el("b", null, sv.ad));
      const benim = kayit[i + 1];
      const lider = skorlar.filter((x) => x.bolum === i + 1).sort((a, c) => a.sure - c.sure)[0];
      b.append(el("span", "mc-bolum-alt", benim ? `Senin en iyin: ${sureYaz(benim.sure)}` : kilit ? "Önceki bölümü bitir" : "Henüz bitirmedin"));
      if (lider) b.append(el("span", "mc-bolum-lider", `👑 ${lider.ad} · ${sureYaz(lider.sure)}`));
      b.addEventListener("click", () => bolumBaslat(i));
      k.append(b);
    });
    siralamaCiz();
  }
  function siralamaCiz() {
    const k = $("mcSiralama"); k.textContent = "";
    SEV.forEach((sv, i) => {
      const l = skorlar.filter((x) => x.bolum === i + 1).sort((a, b) => a.sure - b.sure).slice(0, 5);
      const kutu = el("div", "mc-sira");
      kutu.append(el("h3", null, `${KAPAK[i]} ${sv.ad}`));
      if (!l.length) kutu.append(el("p", "muted", "Henüz kimse bitirmedi."));
      else { const ol = el("ol"); l.forEach((x, j) => { const li = el("li", profile && x.uid === profile.uid ? "ben" : null); li.append(el("span", null, ["🥇", "🥈", "🥉"][j] || j + 1 + "."), Ekonomi.isim ? Ekonomi.isim(x.ad, undefined, { link: false }) : el("b", null, x.ad), el("b", "mc-sira-sure", sureYaz(x.sure)), el("small", "muted", `💀${x.olum}`)); ol.append(li); }); kutu.append(ol); }
      k.append(kutu);
    });
  }
  async function skorlariYukle() {
    if (typeof db === "undefined" || !db) return;
    try { skorlar = (await db.collection("macera_skor").get()).docs.map((d) => d.data()); } catch { skorlar = []; }
    if (!S) secimCiz(); else siralamaCiz();
  }
  async function skorGonder(bolum, sure, olum, burger) {
    if (!profile || typeof db === "undefined" || !db) return;
    const id = profile.uid + "_" + bolum;
    const eski = skorlar.find((x) => x.uid === profile.uid && x.bolum === bolum);
    if (eski && eski.sure <= sure) return;
    try {
      await db.collection("macera_skor").doc(id).set({ uid: profile.uid, ad: profile.kullaniciAdi, bolum, sure, olum, burger, tarih: firebase.firestore.FieldValue.serverTimestamp() });
      skorlar = skorlar.filter((x) => !(x.uid === profile.uid && x.bolum === bolum)).concat([{ uid: profile.uid, ad: profile.kullaniciAdi, bolum, sure, olum, burger }]);
      const lider = skorlar.filter((x) => x.bolum === bolum).sort((a, b) => a.sure - b.sure)[0];
      if (lider && lider.uid === profile.uid && window.Ekonomi) Ekonomi.toast(`👑 ${SEV[bolum - 1].ad} bölümünde grup rekoru senin!`, 4000);
    } catch (e) { console.warn("skor:", e.message); }
  }
  if (window.YaparmiAuth) YaparmiAuth.onChange((p) => { profile = p; $("mcGiris").hidden = !!p; });
  $("mcSifirla").addEventListener("click", () => { if (confirm("Bu cihazdaki ilerlemen (açılan bölümler ve en iyi sürelerin) silinsin mi? Sıralamadaki süreler kalır.")) { localStorage.removeItem("macera_kayit"); secimCiz(); } });
  secimCiz();
  skorlariYukle();
  const h = location.hash.match(/^#bolum(\d+)$/);
  if (h) { const n = Number(h[1]) - 1; if (n >= 0 && n < SEV.length && n + 1 <= (kayitOku().acik || 1)) bolumBaslat(n); }
})();
