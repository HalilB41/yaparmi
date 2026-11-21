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

  // ---------- Berkay'ın sözleri (grup geçmişinden) ----------
  const SOZ = {
    genel: ["a.kevaşem", "a.burger", "kubiiii 85'i gördüm 85!", "3. lig topçusuyum ben", "Go kart lazım", "Sınırsız deme dayanamam", "70k alıp kaçıcam bi anda",
      "26k napiyim aq", "Tüm para gitti alkole", "Şarjım 1, kapanacak tel", "Poğaça ye yeter", "Motor alacaktım vazgeçtim", "Eyw fındıklar", "Araba hızlı evet, gövde etten",
      "Bedenim benimle, 20 senedir sadık kalbim", "Benim saf bir kalbim var", "Özele giriyor aq", "Trafiği kapatın", "Sakarya Aquapark yapalım", "Babam parasını veririm diyor"],
    olum: ["Düşer kalkarım sanki yapboz", "Kulenin menzilinde değildim", "Beni hayatımda kimse sevmedi", "Feleğim sikildi", "Tamam gidiyom ben eve", "a.kevaşem", "Yastayız oyun yok bugün", "Adam değilsin sen aq"],
    burger: ["a.burger", "Popeyes olsa daha iyiydi", "Sınırsız deme dayanamam", "Burgerimi yemeyin aq"],
    ez: ["Kafanızı kesicem", "3. lig farkı", "Satanlara selam olsun", "a.kevaşem", "10 gol atacam bugün"],
    at: ["a.burger yakala", "Al bunu da", "Kafanızı kesicem"],
  };
  const rastgele = (l) => l[Math.floor(Math.random() * l.length)];
  function soyle(yazi, sure = 2.4) { if (S && yazi) S.balon = { yazi, t: sure }; }
  function belkiSoyle(liste, olasilik) { if (S && !(S.balon && S.balon.t > 0.6) && Math.random() < olasilik) soyle(rastgele(liste)); }

  // ---------- giriş ----------
  const tus = { sol: false, sag: false, zipla: false, at: false };
  let ziplaBasildi = false, atBasildi = false;
  const TUSLAR = { ArrowLeft: "sol", KeyA: "sol", ArrowRight: "sag", KeyD: "sag", ArrowUp: "zipla", KeyW: "zipla", Space: "zipla", KeyZ: "at", KeyX: "at" };
  addEventListener("keydown", (e) => {
    if (!oyunAcik()) return;
    const k = TUSLAR[e.code];
    if (k) { e.preventDefault(); if (k === "zipla" && !tus.zipla) ziplaBasildi = true; if (k === "at" && !tus.at) atBasildi = true; if (k === "sol" && !tus.sol) solBasildi = true; if (k === "sag" && !tus.sag) sagBasildi = true; tus[k] = true; }
    const rakam = /^(Digit|Numpad)([1-9])$/.exec(e.code); if (rakam && S && S.mini) { e.preventDefault(); sayiBasildi = Number(rakam[2]); }
    if (e.code === "Escape" || e.code === "KeyP") duraklat();
    if ((e.code === "Enter" || e.code === "Space") && ekran) { e.preventDefault(); ekranTamam(); }
  });
  addEventListener("keyup", (e) => { const k = TUSLAR[e.code]; if (k) tus[k] = false; });
  document.querySelectorAll("[data-mc-tus]").forEach((b) => {
    const k = b.dataset.mcTus;
    const bas = (e) => { e.preventDefault(); if (k === "zipla" && !tus.zipla) ziplaBasildi = true; if (k === "at") atBasildi = true; if (k === "sol") solBasildi = true; if (k === "sag") sagBasildi = true; tus[k] = true; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch { /* yok */ } if (ekran && k === "zipla") ekranTamam(); };
    const birak = (e) => { e.preventDefault(); tus[k] = false; b.classList.remove("on"); };
    b.addEventListener("pointerdown", bas); b.addEventListener("pointerup", birak); b.addEventListener("pointercancel", birak); b.addEventListener("lostpointercapture", () => { tus[k] = false; b.classList.remove("on"); });
  });
  cv.addEventListener("pointerdown", (e) => {
    if (!S || !S.mini || ekran) return;
    const r = cv.getBoundingClientRect();
    tik = { x: ((e.clientX - r.left) / r.width) * VW, y: ((e.clientY - r.top) / r.height) * VH };
  });
  addEventListener("blur", () => { tus.sol = tus.sag = tus.zipla = tus.at = false; });

  // ---------- durum ----------
  let S = null; // aktif bölüm durumu
  let ekran = null; // "giris" | "bitti" | "durdu" | null
  let calisiyor = false, sonZaman = 0, birikim = 0;
  const oyunAcik = () => !$("mcOyun").hidden;

  function bolumKur(no) {
    const sv = SEV[no];
    if (sv.mini) {
      const m = { no, sv, mini: true, tema: sv.tema, W: 1, H: 1, k: [[]], parca: [], dusman: [], mermi: [], burger: [], kontrol: [], platform: [], kitapci: [], bizim: [], cephane: [],
        boss: null, arena: null, polis: null, gorev: null, kamera: 0, sure: 0, olum: 0, toplanan: 0, burgerToplam: 0, atilan: 0, ekstra: 0, bitti: false, olu: 0, mesaj: null, balon: null, sozSaat: 5, sallanma: 0,
        p: { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0 } };
      solBasildi = sagBasildi = false; sayiBasildi = 0; tik = null;
      miniKur(m);
      return m;
    }
    const satir = sv.harita, W = satir[0].length;
    const k = satir.map((r) => r.split(""));
    const s = {
      no, sv, W, H: satir.length, k, oto: !!sv.otomatik, tema: sv.tema,
      dusman: [], mermi: [], parca: [], kitapci: [], burger: [], kontrol: [], bitis: null, platform: [],
      boss: null, arena: null, kamera: 0, sure: 0, olum: 0, toplanan: 0, atilan: 0, ekstra: 0, cephane: [], cephaneSaat: 0, atisBekle: 0, bizim: [], basla: null, sallanma: 0, bitti: false, olu: 0, mesaj: null, balon: null, sozSaat: 4,
    };
    let arenaBas = null, arenaDuvar = null;
    for (let r = 0; r < s.H; r++) for (let c = 0; c < W; c++) {
      const ch = k[r][c], x = c * T, y = r * T;
      if ("PeucoCkBFAmK".includes(ch)) k[r][c] = ".";
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
      else if (ch === "K") s.kacak = { x: x + 4, y: y - 10, w: 30, h: 48, vx: 0, vy: 0, yer: false, ilkX: x + 4, sozSaat: 1.5, balon: null };
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
    // görevler
    s.gorev = sv.gorev || null;
    if (s.gorev && s.gorev.tip === "sure") { s.kalan = s.gorev.limit; s.kalanKontrol = s.gorev.limit; }
    if (s.gorev && s.gorev.tip === "hayatta") { s.hayatta = 0; s.dalgaSaat = 2; s.hayattaBitti = false; }
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
    if (S.mini) return miniGuncelle(dt);
    const s = S, p = s.p;
    if (s.bitti) return;
    if (s.olu > 0) { s.olu -= dt; parcaGuncelle(dt); if (s.olu <= 0) yenidenDog(); return; }
    if (S.p.koruma > 0) S.p.koruma -= dt;
    // ara ara Berkay bir şey söyler
    if (S.balon) { S.balon.t -= dt; if (S.balon.t <= 0) S.balon = null; }
    S.sozSaat -= dt;
    if (S.sozSaat <= 0) { S.sozSaat = 7 + Math.random() * 6; if (!S.balon) soyle(rastgele(Math.random() < 0.5 && S.sv.sozler ? S.sv.sozler : SOZ.genel)); }
    s.sure += dt * 1000;
    // yatay
    const yonTus = ((tus.sag ? 1 : 0) - (tus.sol ? 1 : 0)) * (s.sv.ters ? -1 : 1);
    const hedef = s.oto ? (s.sv.ucus ? KOS_OTO * 0.75 : KOS_OTO) : yonTus * KOS;
    const ivme = p.yer ? (s.sv.kaygan ? 480 : 2600) : (s.sv.kaygan ? 900 : 1700);
    if (p.vx < hedef) p.vx = Math.min(hedef, p.vx + ivme * dt); else if (p.vx > hedef) p.vx = Math.max(hedef, p.vx - ivme * dt);
    if (hedef > 0) p.yon = 1; else if (hedef < 0) p.yon = -1;
    // zıplama (coyote + tampon + değişken yükseklik)
    if (s.sv.ucus) {
      // kanat çırp: havada da zıplanır, yerçekimi hafif
      if (ziplaBasildi) { p.vy = -520; SES.zipla(); }
      ziplaBasildi = false;
      p.vy = Math.min(700, p.vy + G * 0.5 * dt);
    } else {
      p.coyote = p.yer ? 0.1 : p.coyote - dt;
      p.tampon = ziplaBasildi ? 0.12 : p.tampon - dt; ziplaBasildi = false;
      if (p.tampon > 0 && p.coyote > 0) { p.vy = -ZIPLA; p.tampon = 0; p.coyote = 0; SES.zipla(); }
      if (!tus.zipla && p.vy < -320) p.vy = -320;
      p.vy = Math.min(MAX_DUS, p.vy + G * dt);
    }
    for (const m of s.platform) { m.t += dt; const nx = m.ox + Math.sin(m.t * 1.1) * 3 * T; m.dx = nx - m.x; m.x = nx; }
    if (p.uzerinde) { p.x += p.uzerinde.dx; if (katiVar(p.x, p.y, p.w, p.h)) p.x -= p.uzerinde.dx; }
    const yerdeydi = p.yer, altOnce = p.y + p.h;
    hareket(p, dt, true);
    p.uzerinde = null;
    if (p.vy >= 0) for (const m of s.platform) {
      if (p.x + p.w > m.x + 2 && p.x < m.x + m.w - 2 && altOnce <= m.y + 2 && p.y + p.h >= m.y) { p.y = m.y - p.h; p.vy = 0; p.yer = true; p.uzerinde = m; break; }
    }
    if (s.sv.ucus && p.duvar) return ol("Direğe çarptın");
    if (s.sv.ruzgar) {
      const r = s.sv.ruzgar * (0.55 + 0.45 * Math.sin(s.sure / 1000 * 0.9)) * (p.yer ? 1 : 1.25), ox = p.x;
      p.x += r * dt; if (katiVar(p.x, p.y, p.w, p.h)) p.x = ox;
    }
    if (!yerdeydi && p.yer) p.ezilme = 0.12;
    p.ezilme = Math.max(0, p.ezilme - dt);
    if (p.yer && Math.abs(p.vx) > 20) p.adim += dt * Math.abs(p.vx) / 40;
    // düşme / diken
    if (p.y > s.H * T + 60) return ol("Boşluğa düştün");
    const c0 = Math.floor((p.x + 8) / T), c1 = Math.floor((p.x + p.w - 9) / T), r0 = Math.floor((p.y + p.h * 0.5) / T), r1 = Math.floor((p.y + p.h - 1) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (kare(c, r) === "^" && p.y + p.h > r * T + T * 0.45) return ol("Dikene bastın");
    // burger, kontrol noktası, bitiş
    for (const b of s.burger) if (!b.al && kesisir(p, b)) { b.al = true; s.toplanan++; SES.burger(); parcaPatla(b.x + 12, b.y + 12, "#f5b82e", 8); belkiSoyle(SOZ.burger, 0.18);
      if (s.gorev && s.gorev.tip === "sure") { s.kalan += s.gorev.bonus || 2; s.mesaj = { yazi: `+${s.gorev.bonus || 2} sn`, t: 0.8 }; }
      if (s.gorev && s.gorev.tip === "topla" && s.toplanan === s.burgerToplam) { s.mesaj = { yazi: "✅ Hepsi toplandı! Çıkışa koş →", t: 2.2 }; SES.kontrol(); } }
    for (const k of s.kontrol) if (!k.aktif && kesisir(p, k)) { s.kontrol.forEach((x) => { if (x.x <= k.x) x.aktif = true; }); s.kontrolNokta = { x: k.x - 4, y: k.y + 80 - 50 }; if (s.gorev && s.gorev.tip === "sure") s.kalanKontrol = Math.max(s.kalan, 15); SES.kontrol(); s.mesaj = { yazi: "✔ Kontrol noktası", t: 1.4 }; }
    if (s.bitis && kesisir(p, s.bitis) && (!s.arena || s.arena.bitti)) {
      if (gorevTamam()) return bitir();
      if (!s.mesaj) s.mesaj = { yazi: s.gorev.tip === "topla" ? `🔒 Önce hepsini topla (${s.toplanan}/${s.burgerToplam})` : `🔒 Önce ${Math.ceil(s.gorev.sure - s.hayatta)} sn daha dayan`, t: 1.2 };
    }
    // süre
    if (s.gorev && s.gorev.tip === "sure") { s.kalan -= dt; if (s.kalan <= 0) { s.kalan = 0; return ol("Süre doldu ⏰"); } }
    // hayatta kal
    if (s.gorev && s.gorev.tip === "hayatta" && !s.hayattaBitti) {
      s.hayatta += dt;
      s.dalgaSaat -= dt;
      if (s.dalgaSaat <= 0) {
        s.dalgaSaat = Math.max(1.1, 2.6 - s.hayatta * 0.04);
        if (s.dusman.filter((d) => d.canli && d.tip === "yuru").length < 7) {
          const sol = Math.random() < 0.5;
          s.dusman.push({ tip: "yuru", x: sol ? 2 * T : (s.W - 3) * T, y: T, w: 32, h: 32, vx: sol ? 80 : -80, vy: 0, canli: true, dalga: true });
        }
      }
      if (s.hayatta >= s.gorev.sure) {
        s.hayattaBitti = true; s.mermi = []; s.kitapci = [];
        s.dusman.forEach((d) => { if (d.canli) { d.canli = false; parcaPatla(d.x + 16, d.y + 16, "#a855f7", 10); } });
        s.mesaj = { yazi: "🏆 Hayatta kaldın! Bayrağa koş", t: 3 }; SES.bitti();
      }
    }
    // kovala
    if (s.kacak) { const r = kacakGuncelle(dt); if (r) return r; }
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
          if (d.tip !== "araba") { d.canli = false; SES.ez(); parcaPatla(d.x + d.w / 2, d.y + d.h / 2, "#a855f7", 14); s.sallanma = 0.12; belkiSoyle(SOZ.ez, 0.35); }
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
    const hayattaAktif = s.gorev && s.gorev.tip === "hayatta" && !s.hayattaBitti;
    if ((s.boss && !s.boss.olu) || hayattaAktif) {
      s.cephaneSaat -= dt;
      if (s.cephaneSaat <= 0 && s.cephane.length < 6) {
        s.cephaneSaat = hayattaAktif ? 1.8 : 1.1;
        const a0 = hayattaAktif ? 2 * T : s.arena.bas + T, a1 = hayattaAktif ? (s.W - 3) * T : s.arena.son - T * 2;
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
        bip(700, 300, 0.07, "triangle", 0.12); belkiSoyle(SOZ.at, 0.12);
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

  function gorevTamam() {
    const s = S, g = s.gorev;
    if (!g) return true;
    if (g.tip === "topla") return s.toplanan >= s.burgerToplam;
    if (g.tip === "hayatta") return s.hayattaBitti;
    return true;
  }
  // kovalama: kaçan kişi sağa kaçar, engellerin üstünden atlar
  function kacakGuncelle(dt) {
    const s = S, k = s.kacak, p = s.p, g = s.gorev || {};
    const fark = k.x - p.x, son = (s.W - 3) * T;
    let hiz = fark < 340 ? (g.hiz || 250) : fark < 620 ? 110 : 0;
    if (k.x > son) hiz = 0;
    k.vx = hiz;
    k.vy = Math.min(MAX_DUS, k.vy + G * dt);
    if (k.yer && hiz > 0) {
      const duvar = katiVar(k.x + k.w + 6, k.y, 6, k.h - 6);
      const onC = Math.floor((k.x + k.w + 30) / T), alt = kare(onC, Math.floor((k.y + k.h + 4) / T));
      const ileriDusman = s.dusman.some((d) => d.canli && d.x > k.x && d.x - k.x < 70 && Math.abs(d.y - k.y) < 60);
      if (duvar || (!kati(alt) && alt !== "-") || ileriDusman) k.vy = -ZIPLA * 0.97;
    }
    hareket(k, dt, true);
    if (k.y > s.H * T) { k.x = Math.min(son, p.x + 7 * T); k.y = 0; k.vy = 0; }
    k.sozSaat -= dt;
    if (k.balon) { k.balon.t -= dt; if (k.balon.t <= 0) k.balon = null; }
    if (k.sozSaat <= 0 && g.sozler) { k.sozSaat = 3.5 + Math.random() * 2; k.balon = { yazi: rastgele(g.sozler), t: 2.2 }; }
    if (kesisir({ x: p.x - 4, y: p.y, w: p.w + 8, h: p.h }, k)) {
      s.mesaj = { yazi: `🙌 ${g.ad || "Yakaladın"} yakalandı!`, t: 2 }; parcaPatla(k.x + 15, k.y + 20, "#22c55e", 20);
      soyle(rastgele(["Yakaladım seni aq", "Gelcem dedin geldin", "Satmak yok"]), 2.5);
      return bitir();
    }
    return null;
  }

  // =====================================================================
  // ---------- Mini oyunlar: platform değil, tamamen farklı oynanışlar ----------
  // Her mini oyun: kur(s) → durum nesnesi, guncelle(s, o, dt), ciz(s, o), skor(o) (sol üst yazı),
  // gorev(o) (üst orta yazı). Kazanınca bitir(), kaybedince ol("neden") → kısa süre sonra baştan.
  // =====================================================================
  const berkayCiz = (x, y, h, ters) => { if (!KAHRAMAN.complete) return; ctx.save(); ctx.translate(x, y); if (ters) ctx.scale(-1, 1); ctx.drawImage(KAHRAMAN, -h * 0.48, -h, h * 0.97, h); ctx.restore(); };
  const yuvarlak = (x, y, w, h, r, renk) => { ctx.fillStyle = renk; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  const yazi = (t, x, y, font, renk = "#fff", hiza = "center") => { ctx.font = font; ctx.fillStyle = renk; ctx.textAlign = hiza; ctx.fillText(t, x, y); ctx.textAlign = "left"; };
  const karistir = (l) => { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let solBasildi = false, sagBasildi = false, sayiBasildi = 0, tik = null;

  const MINI = {
    // ---- 1) Trafik: 3 şerit, kasksız motor, 85'i gör ----
    trafik: {
      kur: () => ({ serit: 1, gx: 480, t: 0, hiz: 30, engel: [], dogum: 1, yol: 0, gor85: 0 }),
      guncelle(s, o, dt) {
        if (solBasildi) o.serit = Math.max(0, o.serit - 1);
        if (sagBasildi) o.serit = Math.min(2, o.serit + 1);
        const hedefX = 330 + o.serit * 150; o.gx += (hedefX - o.gx) * Math.min(1, dt * 14);
        o.t += dt; o.hiz = Math.min(92, 30 + o.t * 1.7); o.yol += o.hiz * dt * 9;
        if (o.hiz >= 85) o.gor85 += dt;
        const v = 140 + o.hiz * 5.2;
        o.dogum -= dt;
        if (o.dogum <= 0) {
          o.dogum = Math.max(0.42, 1.25 - o.t * 0.017);
          const bos = Math.floor(Math.random() * 3);
          const dolu = Math.random() < Math.min(0.55, o.t * 0.012) ? [0, 1, 2].filter((x) => x !== bos) : [rastgele([0, 1, 2].filter((x) => x !== bos))];
          for (const l of dolu) o.engel.push({ serit: l, y: -60, e: rastgele(["🚗", "🚙", "🚕", "🚌", "🚧", "🐄", "🕳️"]) });
        }
        for (const e of o.engel) e.y += v * dt * (e.e === "🚌" ? 0.85 : 1);
        o.engel = o.engel.filter((e) => e.y < VH + 80);
        for (const e of o.engel) if (Math.abs(330 + e.serit * 150 - o.gx) < 60 && Math.abs(e.y - 450) < 52) return ol(e.e === "🐄" ? "İneğe çarptın 🐄" : e.e === "🕳️" ? "Çukura girdin" : "Kaza! Kask da yok");
        if (o.gor85 >= 12) { s.mesaj = { yazi: "🏁 85'i gördün, eve vardın!", t: 2 }; return bitir(); }
        s.konus = { x: o.gx, y: 380 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#4d7c0f"; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#3f3f46"; ctx.fillRect(250, 0, 460, VH);
        ctx.fillStyle = "#fff"; ctx.fillRect(250, 0, 6, VH); ctx.fillRect(704, 0, 6, VH);
        for (let l = 1; l < 3; l++) for (let y = (o.yol % 80) - 80; y < VH; y += 80) ctx.fillRect(250 + l * 153 - 3, y, 6, 44);
        for (let y = (o.yol * 0.6 % 160) - 160; y < VH; y += 160) { emoji("🌳", 150, y, 54); emoji("🌲", 810, y + 70, 54); }
        for (const e of o.engel) emoji(e.e, 330 + e.serit * 150, e.y, 62, e.e.includes("🚗") || e.e.includes("🚙") || e.e.includes("🚕") || e.e.includes("🚌") ? Math.PI / 2 * 0 : 0);
        ctx.save(); ctx.translate(o.gx, 450); emoji("🏍️", 0, 18, 70); ctx.restore(); berkayCiz(o.gx, 440, 74);
        // hız göstergesi
        yuvarlak(VW - 200, VH - 120, 170, 96, 16, "rgba(0,0,0,.55)");
        yazi(Math.round(o.hiz) + " km/s", VW - 115, VH - 70, "900 34px ui-monospace,monospace", o.hiz >= 85 ? "#f87171" : "#fff");
        yazi(o.hiz >= 85 ? `85 GÖRÜLDÜ · ${Math.max(0, 12 - o.gor85).toFixed(1)} sn` : "Kask: YOK", VW - 115, VH - 42, "800 14px sans-serif", "#fde68a");
      },
      skor: (o) => `🏍️ ${Math.round(o.yol)} m`,
      gorev: (o) => (o.hiz < 85 ? "← → şerit değiştir · 85'e çık" : "85'te 12 saniye dayan!"),
    },

    // ---- 2) Penaltı: nişan al, şut çek, 8'de 5 gol ----
    penalti: {
      kur: () => ({ atis: 0, gol: 0, faz: "x", nx: 0, ny: 0, t: 0, top: null, kaleci: 0, kaleciHedef: 0, sonuc: null, bekle: 0 }),
      guncelle(s, o, dt) {
        o.t += dt;
        const sut = ziplaBasildi || atBasildi || tik; tik = null;
        if (o.bekle > 0) { o.bekle -= dt; if (o.bekle <= 0) { o.top = null; o.sonuc = null; o.faz = "x"; o.kaleci = 0; o.t = 0; if (o.gol >= 5) return bitir(); if (o.atis - o.gol > 3) return ol("Satanlar kazandı, maç kaybedildi"); } return; }
        if (o.faz === "x") { o.nx = Math.sin(o.t * (2.4 + o.atis * 0.25)) * 1.18; if (sut) { o.faz = "y"; o.t = 0; } }
        else if (o.faz === "y") { o.ny = (Math.sin(o.t * (2.8 + o.atis * 0.25) - Math.PI / 2) + 1) / 2 * 1.2; if (sut) { o.faz = "uc"; o.atis++; o.top = { t: 0 }; o.kaleciHedef = Math.random() < 0.42 ? o.nx : (Math.random() * 2 - 1); } }
        else if (o.faz === "uc") {
          o.top.t += dt * 1.8; o.kaleci += (o.kaleciHedef - o.kaleci) * Math.min(1, dt * 5);
          if (o.top.t >= 1) {
            const disari = Math.abs(o.nx) > 1 || o.ny > 1;
            const kurtardi = !disari && Math.abs(o.kaleci - o.nx) < 0.36 && o.ny < 0.85;
            o.sonuc = disari ? "DIŞARI" : kurtardi ? "KURTARDI" : "GOOOL";
            if (o.sonuc === "GOOOL") { o.gol++; SES.burger(); soyle(rastgele(["3. lig farkı", "10 gol atacam demiştim", "Rabona bile gerek yok"]), 1.6); } else { bip(300, 120, 0.3, "sawtooth", 0.1); soyle(rastgele(["Kaleci hile yaptı", "Satanlar yüzünden", "Topa bak aq"]), 1.6); }
            o.faz = "son"; o.bekle = 1.2;
          }
        }
        s.konus = { x: 480, y: 420 };
      },
      ciz(s, o) {
        const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#1e3a8a"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#15803d"; ctx.fillRect(0, 300, VW, VH - 300);
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#16a34a" : "#15803d"; ctx.fillRect(0, 300 + i * 34, VW, 34); }
        // kale
        const kx = 240, ky = 110, kw = 480, kh = 190;
        ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1; for (let x = kx; x <= kx + kw; x += 20) { ctx.beginPath(); ctx.moveTo(x, ky); ctx.lineTo(x, ky + kh); ctx.stroke(); } for (let y = ky; y <= ky + kh; y += 20) { ctx.beginPath(); ctx.moveTo(kx, y); ctx.lineTo(kx + kw, y); ctx.stroke(); }
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(kx, ky + kh); ctx.lineTo(kx, ky); ctx.lineTo(kx + kw, ky); ctx.lineTo(kx + kw, ky + kh); ctx.stroke();
        // kaleci
        const kalX = 480 + o.kaleci * kw / 2; emoji("🧤", kalX - 46, 220, 34); emoji("🧍", kalX, 240, 110); emoji("🧤", kalX + 46, 220, 34); yazi("Kaleci Salih", kalX, 160, "800 13px sans-serif");
        const hx = 480 + o.nx * kw / 2, hy = ky + kh - o.ny * kh;
        if (o.top) { const t = Math.min(1, o.top.t); const bx = 480 + (hx - 480) * t, by = 480 + (hy - 480) * t; emoji("⚽", bx, by, 46 - t * 20); }
        else emoji("⚽", 480, 480, 46);
        if (o.faz === "x" || o.faz === "y") { ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, o.faz === "x" ? ky + kh / 2 : hy, 18, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(hx - 26, o.faz === "x" ? ky + kh / 2 : hy); ctx.lineTo(hx + 26, o.faz === "x" ? ky + kh / 2 : hy); ctx.moveTo(hx, (o.faz === "x" ? ky + kh / 2 : hy) - 26); ctx.lineTo(hx, (o.faz === "x" ? ky + kh / 2 : hy) + 26); ctx.stroke(); }
        berkayCiz(400, 540, 110);
        if (o.sonuc) yazi(o.sonuc === "GOOOL" ? "⚽ GOOOL!" : o.sonuc === "KURTARDI" ? "🧤 KURTARDI" : "❌ DIŞARI", 480, 360, "900 54px sans-serif", o.sonuc === "GOOOL" ? "#4ade80" : "#f87171");
        yazi(`Gol ${o.gol}/5 · Şut ${o.atis}/8`, 480, 530, "900 22px sans-serif", "#fde68a");
      },
      skor: (o) => `⚽ ${o.gol}/5`,
      gorev: (o) => (o.faz === "x" ? "Boşluk: sağ-sol nişanı kilitle" : o.faz === "y" ? "Boşluk: yüksekliği kilitle ve vur!" : "8 şutta 5 gol at"),
    },

    // ---- 3) KPSS: grup bilgi yarışması ----
    kpss: {
      SORULAR: [
        ["Berkay KPSS denemesinde kaç aldı?", "93", "91", "85", "100"],
        ["Kurban 6 ay çalışıp denemeden kaç aldı?", "91", "93", "70", "99"],
        ["Berkay kasksız motorla kaç km/s ile bayır aşağı indi?", "85", "120", "60", "200"],
        ["İbo'nun kütüphane alarmı kaçta çalar?", "05:17", "07:30", "04:50", "06:15"],
        ["Salih sabah 8'den beri kaç ekmek sattı?", "1", "0", "100", "8"],
        ["Alihan'ın meşhur ceketi kaç TL?", "8.000 TL", "800 TL", "26.000 TL", "1.560 TL"],
        ["Kurban'ın attığı banka ekran görüntüsünde kaç TL vardı?", "12 TL", "30.000 TL", "301 TL", "0 TL"],
        ["Burger o gece kaç saat uyudu?", "3,5", "8", "12", "0"],
        ["Alpaslan Zula'ya kaç TL yatırdı?", "600 TL", "6.000 TL", "60 TL", "1.000 TL"],
        ["İbo 100 TL'lik neyden zehirlendi?", "Tavuk şiş dürüm", "Popeyes", "Köfte ekmek", "Ekmek kadayıfı"],
        ["Sakarya Aquapark bileti kaç kişi gidilince ucuzluyor?", "7", "3", "11", "20"],
        ["Berkay hangi maaşa '…napiyim aq' dedi?", "26 bin", "67 bin", "38 bin", "100 bin"],
        ["Berkay hangi bölümden mezun?", "İtfaiye", "Bilgisayar", "Muhasebe", "Aşçılık"],
        ["Berkay LoL'de takım savaşında hangi büyüyü atmadı?", "Exhaust", "Flash", "Ignite", "Heal"],
        ["Grupta 'Çorbacı' lakabı kimin?", "Kurban", "İbo", "Salih", "Cem"],
        ["Grubun tek evli üyesi kim?", "Cem", "Alihan", "Burger", "Alpaslan"],
        ["İbo kaç maddelik Berkay eleştiri listesi yazdı?", "100", "10", "30", "1000"],
        ["Berkay İzmir'de kaç gün sokakta yattı?", "2", "1", "7", "0"],
        ["Tekel bayisi ilanında günlük ücret ne kadardı?", "1.000 TL", "500 TL", "2.800 TL", "10.000 TL"],
        ["İbo çakmağını kaç TL'ye satıyordu?", "10.000 TL", "100 TL", "1.000 TL", "50 TL"],
        ["Berkay kendini hangi ligin topçusu sanıyor?", "3. lig", "Süper Lig", "Amatör", "Premier Lig"],
        ["Salih halısahada hangi mevkide oynamak ister?", "Forvet", "Kaleci", "Defans", "Yedek"],
        ["Hindistan'a uçak bileti kaç TL'ydi?", "16 bin", "1.600", "160 bin", "6 bin"],
      ],
      kur() { return { sorular: karistir(MINI.kpss.SORULAR).slice(0, 10).map((q) => ({ s: q[0], dogru: q[1], sec: karistir(q.slice(1)) })), i: 0, sec: 0, sure: 12, dogru: 0, yanlis: 0, sonuc: null, bekle: 0 }; },
      guncelle(s, o, dt) {
        const q = o.sorular[o.i];
        if (o.bekle > 0) {
          o.bekle -= dt;
          if (o.bekle <= 0) {
            o.sonuc = null; o.i++; o.sec = 0; o.sure = 12;
            if (o.yanlis > 3) return ol(`${o.dogru * 10} puan. Optik okumadı`);
            if (o.i >= o.sorular.length) { s.mesaj = { yazi: `🎓 ${o.dogru * 10} puan! Kubi'yi geçtin`, t: 2.5 }; return bitir(); }
          }
          return;
        }
        if (solBasildi) o.sec = (o.sec + 3) % 4;
        if (sagBasildi) o.sec = (o.sec + 1) % 4;
        if (sayiBasildi >= 1 && sayiBasildi <= 4) { o.sec = sayiBasildi - 1; ziplaBasildi = true; }
        if (tik) { for (let k = 0; k < 4; k++) { const b = kpssKutu(k); if (tik.x > b.x && tik.x < b.x + b.w && tik.y > b.y && tik.y < b.y + b.h) { o.sec = k; ziplaBasildi = true; } } tik = null; }
        o.sure -= dt;
        if (ziplaBasildi || atBasildi || o.sure <= 0) {
          const dogru = o.sure > 0 && q.sec[o.sec] === q.dogru;
          if (dogru) { o.dogru++; SES.burger(); } else { o.yanlis++; bip(300, 120, 0.3, "sawtooth", 0.1); soyle(rastgele(["QR çektim o soruyu", "Optik hatası", "Kubi kopya vermedi"]), 1.6); }
          o.sonuc = dogru ? "dogru" : "yanlis"; o.bekle = 1.1;
        }
        s.konus = { x: 120, y: 420 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#2e1a47"; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#3b2463"; for (let x = 0; x < VW; x += 120) ctx.fillRect(x + 10, 0, 100, VH);
        const q = o.sorular[Math.min(o.i, o.sorular.length - 1)];
        yuvarlak(140, 120, 680, 110, 18, "rgba(255,255,255,.95)");
        yazi(`Soru ${Math.min(o.i + 1, 10)}/10`, 480, 150, "800 14px sans-serif", "#6d28d9");
        ctx.font = "900 24px sans-serif"; ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.fillText(q.s, 480, 192, 650); ctx.textAlign = "left";
        for (let k = 0; k < 4; k++) {
          const b = kpssKutu(k), secili = o.sec === k;
          let renk = secili ? "#facc15" : "rgba(255,255,255,.85)";
          if (o.sonuc && q.sec[k] === q.dogru) renk = "#4ade80"; else if (o.sonuc === "yanlis" && secili) renk = "#f87171";
          yuvarlak(b.x, b.y, b.w, b.h, 14, renk);
          yazi(`${"ABCD"[k]}) ${q.sec[k]}`, b.x + b.w / 2, b.y + 38, "800 22px sans-serif", "#111");
        }
        // süre çubuğu
        yuvarlak(140, 250, 680, 10, 5, "rgba(255,255,255,.2)"); yuvarlak(140, 250, 680 * Math.max(0, o.sure / 12), 10, 5, o.sure < 4 ? "#ef4444" : "#a78bfa");
        berkayCiz(120, 540, 120);
        yazi(`✔ ${o.dogru}   ✘ ${o.yanlis}/3`, 840, 530, "900 22px sans-serif", "#fde68a");
      },
      skor: (o) => `📝 ${o.dogru * 10} puan`,
      gorev: () => "← → seç, Boşluk cevapla (ya da tıkla / 1-4). 3'ten fazla yanlış = elendin",
    },

    // ---- 4) Borsa: al-sat, parayı 2'ye katla ----
    borsa: {
      kur: () => ({ fiyat: 100, gecmis: Array(120).fill(100), nakit: 1000, adet: 0, egilim: 0, egilimSure: 0, t: 60, haber: null, alis: 0 }),
      guncelle(s, o, dt) {
        o.egilimSure -= dt;
        if (o.egilimSure <= 0) { o.egilimSure = 1.6 + Math.random() * 2.4; o.egilim = (Math.random() - 0.48) * 0.5; if (Math.random() < 0.25) { const h = rastgele([["Kubi gizlice sattı!", -0.35], ["Berkay borsaya girdi", -0.25], ["Halka arz tavan!", 0.4], ["İbo çorbacı ilan etti", 0.3], ["Burger pump yaptı", 0.35]]); o.haber = { yazi: h[0], t: 2 }; o.egilim = h[1]; } }
        if (o.haber) { o.haber.t -= dt; if (o.haber.t <= 0) o.haber = null; }
        o.fiyat = Math.max(5, o.fiyat * (1 + (o.egilim + (Math.random() - 0.5) * 0.9) * dt));
        o.ornek = (o.ornek || 0) + dt; if (o.ornek > 0.08) { o.ornek = 0; o.gecmis.push(o.fiyat); o.gecmis.shift(); }
        if (ziplaBasildi || atBasildi || tik) {
          tik = null;
          if (o.adet > 0) { o.nakit = o.adet * o.fiyat; o.adet = 0; SES.burger(); soyle(o.nakit > o.alisDeger ? rastgele(["Çorba parası çıktı", "Kârı aldım kaçtım"]) : rastgele(["Zararına sattım aq", "Ayı piyasası"]), 1.5); }
          else { o.adet = o.nakit / o.fiyat; o.alisDeger = o.nakit; o.nakit = 0; bip(500, 800, 0.1, "square", 0.08); }
        }
        const deger = o.nakit + o.adet * o.fiyat;
        o.t -= dt;
        if (deger >= 2000) { s.mesaj = { yazi: "📈 2'ye katladın! Çorbacı Kubi kıskandı", t: 2.5 }; return bitir(); }
        if (deger < 400) return ol("Battın. Bakiye: 12 TL");
        if (o.t <= 0) return ol(`Süre bitti, ${Math.round(deger)} TL'de kaldın`);
        s.konus = { x: 110, y: 400 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, VW, VH);
        ctx.strokeStyle = "rgba(34,197,94,.1)"; ctx.lineWidth = 1; for (let y = 120; y < 470; y += 35) { ctx.beginPath(); ctx.moveTo(200, y); ctx.lineTo(920, y); ctx.stroke(); }
        const min = Math.min(...o.gecmis) * 0.95, max = Math.max(...o.gecmis) * 1.05;
        const px = (i) => 200 + i * (720 / (o.gecmis.length - 1)), py = (v) => 470 - ((v - min) / (max - min)) * 340;
        ctx.strokeStyle = o.gecmis[o.gecmis.length - 1] >= o.gecmis[o.gecmis.length - 20] ? "#22c55e" : "#ef4444"; ctx.lineWidth = 3; ctx.beginPath();
        o.gecmis.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)))); ctx.stroke();
        if (o.adet > 0) { ctx.setLineDash([6, 6]); ctx.strokeStyle = "#facc15"; ctx.beginPath(); const ay = py(o.alisDeger / o.adet); ctx.moveTo(200, ay); ctx.lineTo(920, ay); ctx.stroke(); ctx.setLineDash([]); yazi("alış", 205, py(o.alisDeger / o.adet) - 6, "800 12px sans-serif", "#facc15", "left"); }
        yazi(`KUBİCOIN ${o.fiyat.toFixed(2)} ₺`, 560, 105, "900 26px ui-monospace,monospace", "#e2e8f0");
        const deger = o.nakit + o.adet * o.fiyat;
        yuvarlak(200, 485, 720, 56, 14, "rgba(255,255,255,.08)");
        yazi(`Servet: ${Math.round(deger)} ₺  ·  Hedef: 2.000 ₺  ·  ${o.adet > 0 ? "ELİNDE COİN VAR" : "NAKİTTESİN"}  ·  ⏰ ${Math.max(0, o.t).toFixed(0)} sn`, 560, 520, "800 18px sans-serif", deger >= 1000 ? "#4ade80" : "#f87171");
        if (o.haber) { yuvarlak(260, 56, 600, 30, 10, "#dc2626"); yazi("📰 SON DAKİKA: " + o.haber.yazi, 560, 77, "800 16px sans-serif"); }
        berkayCiz(110, 470, 120);
        yuvarlak(40, 490, 140, 48, 14, o.adet > 0 ? "#dc2626" : "#16a34a"); yazi(o.adet > 0 ? "SAT (Boşluk)" : "AL (Boşluk)", 110, 520, "900 16px sans-serif");
      },
      skor: (o) => `💰 ${Math.round(o.nakit + o.adet * o.fiyat)} ₺`,
      gorev: () => "Boşluk: AL / SAT · 1.000 ₺'yi 60 sn'de 2.000 ₺ yap",
    },

    // ---- 5) Kurye: köfte ekmek yakala, yıldızlardan kaç ----
    kurye: {
      kur: () => ({ x: 480, dusen: [], dogum: 0.6, yakalanan: 0, can: 3, t: 0 }),
      guncelle(s, o, dt) {
        const yon = (tus.sag ? 1 : 0) - (tus.sol ? 1 : 0);
        o.x = Math.max(60, Math.min(VW - 60, o.x + yon * 520 * dt));
        if (tik) { o.hedef = tik.x; tik = null; }
        if (o.hedef != null && !yon) { o.x += (o.hedef - o.x) * Math.min(1, dt * 10); if (Math.abs(o.hedef - o.x) < 4) o.hedef = null; }
        o.t += dt; o.dogum -= dt;
        if (o.dogum <= 0) {
          o.dogum = Math.max(0.35, 0.85 - o.t * 0.012);
          const r = Math.random(), tip = r < 0.55 ? "🥖" : r < 0.82 ? "⭐" : r < 0.92 ? "🍔" : "🧥";
          o.dusen.push({ x: 60 + Math.random() * (VW - 120), y: -30, v: 170 + Math.random() * 90 + o.t * 3, e: tip });
        }
        for (const d of o.dusen) {
          d.y += d.v * dt;
          if (!d.al && d.y > 430 && d.y < 500 && Math.abs(d.x - o.x) < 58) {
            d.al = true;
            if (d.e === "⭐") { o.can--; s.sallanma = 0.2; bip(300, 100, 0.25, "sawtooth", 0.1); soyle("1 yıldız mı aq", 1.4); if (o.can <= 0) return ol("Müşteriler 1 yıldız yağdırdı ⭐"); }
            else { o.yakalanan += d.e === "🧥" ? 3 : 1; SES.burger(); if (d.e === "🧥") soyle("8 bin TL ceket geldi", 1.4); }
          }
        }
        o.dusen = o.dusen.filter((d) => !d.al && d.y < VH + 40);
        if (o.yakalanan >= 25) { s.mesaj = { yazi: "🛵 Siparişler teslim! (Biri yolda yendi)", t: 2.5 }; return bitir(); }
        s.konus = { x: o.x, y: 400 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#0b1026"; ctx.fillRect(0, 0, VW, VH);
        for (let x = 0; x < VW; x += 160) { ctx.fillStyle = "#111827"; ctx.fillRect(x, 200, 130, 300); ctx.fillStyle = "rgba(250,204,21,.5)"; for (let y = 220; y < 480; y += 40) ctx.fillRect(x + 14, y, 30, 18); }
        ctx.fillStyle = "#27272a"; ctx.fillRect(0, 500, VW, 60);
        for (const d of o.dusen) emoji(d.e, d.x, d.y, 40);
        emoji("🛵", o.x, 492, 64); berkayCiz(o.x, 470, 72);
        for (let i = 0; i < 3; i++) emoji(i < o.can ? "❤️" : "🖤", VW - 120 + i * 34, 80, 26);
      },
      skor: (o) => `🥖 ${o.yakalanan}/25`,
      gorev: () => "← → (ya da dokun) · 🥖🍔🧥 topla, ⭐ 1 yıldızlardan kaç",
    },

    // ---- 6) Tekel: kasaları üst üste diz ----
    dolap: {
      kur: () => ({ kat: [{ x: 330, w: 300 }], x: 0, yon: 1, w: 300, hiz: 230, kamera: 0, dusen: [] }),
      guncelle(s, o, dt) {
        o.x += o.yon * o.hiz * dt;
        if (o.x < 120) { o.x = 120; o.yon = 1; } if (o.x + o.w > VW - 120) { o.x = VW - 120 - o.w; o.yon = -1; }
        for (const d of o.dusen) { d.vy += 1400 * dt; d.y += d.vy * dt; }
        o.dusen = o.dusen.filter((d) => d.y < 900);
        const hedefK = Math.max(0, (o.kat.length - 6) * 34); o.kamera += (hedefK - o.kamera) * Math.min(1, dt * 5);
        if (ziplaBasildi || atBasildi || tik) {
          tik = null;
          const alt = o.kat[o.kat.length - 1];
          let a = Math.max(o.x, alt.x), b = Math.min(o.x + o.w, alt.x + alt.w);
          if (Math.abs(o.x - alt.x) < 7) { a = alt.x; b = alt.x + alt.w; o.x = alt.x; s.mesaj = { yazi: "✨ Tam oturdu!", t: 0.7 }; bip(880, 1320, 0.12, "square", 0.08); }
          const ust = b - a;
          const yUst = 470 - o.kat.length * 34;
          if (ust <= 4) { o.dusen.push({ x: o.x, w: o.w, y: yUst, vy: 0 }); return ol("Kasa yere düştü, şişeler kırıldı 🍾"); }
          if (o.x < a) o.dusen.push({ x: o.x, w: a - o.x, y: yUst, vy: 0 });
          if (o.x + o.w > b) o.dusen.push({ x: b, w: o.x + o.w - b, y: yUst, vy: 0 });
          o.kat.push({ x: a, w: ust }); o.w = ust; o.hiz = Math.min(520, o.hiz + 18); o.x = o.yon > 0 ? 120 : VW - 120 - o.w;
          SES.zipla();
          if (o.kat.length - 1 >= 12) { s.mesaj = { yazi: "🍻 Dolap dizildi! Burger özür dilesin", t: 2.5 }; return bitir(); }
          if (o.kat.length === 7) soyle("Yaparım kardeşim yaparım", 1.6);
        }
        s.konus = { x: 90, y: 380 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#3f1d0b"; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#1c1917"; ctx.fillRect(100, 0, VW - 200, VH); ctx.fillStyle = "rgba(186,230,253,.08)"; ctx.fillRect(110, 0, VW - 220, VH);
        ctx.save(); ctx.translate(0, o.kamera);
        const kasa = (x, y, w, renk) => { yuvarlak(x, y, w, 32, 4, renk); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x, y + 24, w, 8); for (let bx = x + 8; bx < x + w - 10; bx += 18) { ctx.fillStyle = "#facc15"; ctx.fillRect(bx, y - 10, 8, 14); ctx.fillStyle = "#78350f"; ctx.fillRect(bx + 1, y - 14, 6, 5); } };
        o.kat.forEach((k, i) => kasa(k.x, 470 - i * 34, k.w, ["#15803d", "#dc2626", "#ca8a04", "#2563eb"][i % 4]));
        for (const d of o.dusen) kasa(d.x, d.y, d.w, "#7f1d1d");
        if (!s.olu) kasa(o.x, 470 - o.kat.length * 34, o.w, ["#15803d", "#dc2626", "#ca8a04", "#2563eb"][o.kat.length % 4]);
        ctx.restore();
        berkayCiz(70, 540, 110);
        yazi(`Kat ${o.kat.length - 1}/12`, VW - 60, 520, "900 22px sans-serif", "#fde68a", "right");
      },
      skor: (o) => `🍺 ${o.kat.length - 1}/12`,
      gorev: () => "Boşluk (ya da dokun): kasayı bırak · taşan kısım düşer · 12 kat diz",
    },

    // ---- 7) Ritim: Cem'in beati ----
    ritim: {
      kur() {
        const notalar = []; let t = 2;
        for (let i = 0; i < 44; i++) { const serit = Math.floor(Math.random() * 3); notalar.push({ t, serit }); if (i % 8 === 7) notalar.push({ t: t + 0.25, serit: (serit + 1 + Math.floor(Math.random() * 2)) % 3 }); t += i > 24 ? 0.42 : 0.55; }
        return { notalar, t: 0, vurus: 0, kacan: 0, kombo: 0, efekt: [], bitis: t + 1.5, toplam: notalar.length };
      },
      guncelle(s, o, dt) {
        o.t += dt;
        const basilan = [];
        if (solBasildi) basilan.push(0); if (ziplaBasildi || atBasildi) basilan.push(1); if (sagBasildi) basilan.push(2);
        if (tik) { basilan.push(Math.max(0, Math.min(2, Math.floor((tik.x - 255) / 150)))); tik = null; }
        for (const l of basilan) {
          const n = o.notalar.find((x) => !x.bitti && x.serit === l && Math.abs(x.t - o.t) < 0.16);
          if (n) { n.bitti = true; n.vurdu = true; o.vurus++; o.kombo++; bip([523, 659, 784][l], [523, 659, 784][l], 0.12, "square", 0.08); o.efekt.push({ serit: l, t: 0.25, iyi: true }); if (o.kombo % 10 === 0) soyle(rastgele(["Vay aq nakarat çok iyi", "Tam arabada dinlemelik", "Cem abi beat yap"]), 1.5); }
          else { o.kombo = 0; o.efekt.push({ serit: l, t: 0.2, iyi: false }); }
        }
        for (const n of o.notalar) if (!n.bitti && o.t - n.t > 0.16) { n.bitti = true; o.kacan++; o.kombo = 0; }
        for (const e of o.efekt) e.t -= dt; o.efekt = o.efekt.filter((e) => e.t > 0);
        if (o.kacan > o.toplam * 0.3) return ol("Ritim kaçtı, Cem abi bozuldu");
        if (o.t > o.bitis) { s.mesaj = { yazi: `🎵 %${Math.round((o.vurus / o.toplam) * 100)} isabet! Nakarat çok iyi`, t: 2.5 }; return bitir(); }
        s.konus = { x: 110, y: 380 };
      },
      ciz(s, o) {
        const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "#1e0b3a"); g.addColorStop(1, "#3b0764"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        const RENK = ["#22d3ee", "#f472b6", "#facc15"], OK = ["◀", "▲", "▶"];
        for (let l = 0; l < 3; l++) { ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fillRect(255 + l * 150, 0, 140, VH); }
        ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(255, 460, 440, 4);
        for (let l = 0; l < 3; l++) { ctx.strokeStyle = RENK[l]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(325 + l * 150, 462, 30, 0, 7); ctx.stroke(); yazi(OK[l], 325 + l * 150, 471, "900 22px sans-serif", RENK[l]); }
        for (const e of o.efekt) { ctx.globalAlpha = e.t * 4; ctx.fillStyle = e.iyi ? RENK[e.serit] : "#ef4444"; ctx.beginPath(); ctx.arc(325 + e.serit * 150, 462, 44, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        for (const n of o.notalar) { if (n.bitti) continue; const y = 462 - (n.t - o.t) * 380; if (y < -40) continue; ctx.fillStyle = RENK[n.serit]; ctx.beginPath(); ctx.arc(325 + n.serit * 150, y, 24, 0, 7); ctx.fill(); emoji("🎵", 325 + n.serit * 150, y, 22); }
        berkayCiz(110, 540, 120); emoji("🎧", 110, 440, 40); emoji("🎤", 850, 420, 60); yazi("Cem & yenge", 850, 480, "800 14px sans-serif");
        yazi(`Kombo ${o.kombo}`, 850, 160, "900 26px sans-serif", "#fde68a");
        yazi(`Kaçan ${o.kacan}/${Math.floor(o.toplam * 0.3)}`, 850, 200, "800 16px sans-serif", "#fca5a5");
      },
      skor: (o) => `🎵 ${o.vurus}/${o.toplam}`,
      gorev: () => "Notalar çizgiye gelince: ← / Boşluk / → (ya da şeride dokun)",
    },

    // ---- 8) Gece baskını: pencerelerden çıkan Kubi'yi yakala ----
    baskin: {
      kur: () => ({ delik: Array.from({ length: 9 }, () => ({ kim: null, t: 0 })), dogum: 0.8, yakalanan: 0, kacan: 0, imlec: 4, t: 0, vur: [] }),
      guncelle(s, o, dt) {
        o.t += dt; o.dogum -= dt;
        if (o.dogum <= 0) {
          o.dogum = Math.max(0.38, 0.95 - o.t * 0.015);
          const bos = o.delik.map((d, i) => (d.kim ? -1 : i)).filter((i) => i >= 0);
          if (bos.length) { const i = rastgele(bos); o.delik[i] = { kim: Math.random() < 0.22 ? "ibo" : "kubi", t: Math.max(0.75, 1.5 - o.t * 0.02) }; }
        }
        for (const d of o.delik) if (d.kim) { d.t -= dt; if (d.t <= 0) { if (d.kim === "kubi") { o.kacan++; if (o.kacan >= 6) return ol("Kubi telefonu sakladı, kanıt yok"); } d.kim = null; } }
        // imleç: ← → satır içinde, Boşluk ile satır atla; sayı tuşları; dokunma
        if (solBasildi) o.imlec = (o.imlec + 8) % 9;
        if (sagBasildi) o.imlec = (o.imlec + 1) % 9;
        let hedef = null;
        if (sayiBasildi >= 1 && sayiBasildi <= 9) hedef = [6, 7, 8, 3, 4, 5, 0, 1, 2][sayiBasildi - 1];
        if (ziplaBasildi || atBasildi) hedef = o.imlec;
        if (tik) { for (let i = 0; i < 9; i++) { const b = baskinKutu(i); if (tik.x > b.x && tik.x < b.x + b.w && tik.y > b.y && tik.y < b.y + b.h) hedef = i; } tik = null; }
        if (hedef != null) {
          o.imlec = hedef; const d = o.delik[hedef]; o.vur.push({ i: hedef, t: 0.2 });
          if (d.kim === "kubi") { o.yakalanan++; d.kim = null; SES.ez(); if (o.yakalanan % 6 === 0) soyle(rastgele(["Yakaladım Kubi'yi", "Ne izliyon gece 3'te", "Salih haklıymış"]), 1.4); }
          else if (d.kim === "ibo") { d.kim = null; o.kacan++; bip(300, 100, 0.3, "sawtooth", 0.12); s.mesaj = { yazi: "İbo'ya vurdun! Kaçan +1", t: 1 }; if (o.kacan >= 6) return ol("İbo'ya vurdun, Kubi kaçtı"); }
        }
        for (const v of o.vur) v.t -= dt; o.vur = o.vur.filter((v) => v.t > 0);
        if (o.yakalanan >= 20) { s.mesaj = { yazi: "📱 Kubi 20 kez yakalandı! Baskın başarılı", t: 2.5 }; return bitir(); }
        s.konus = { x: 110, y: 380 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#fef3c7"; ctx.beginPath(); ctx.arc(860, 220, 36, 0, 7); ctx.fill();
        yazi("03:13", 860, 290, "900 22px ui-monospace,monospace", "#f87171");
        ctx.fillStyle = "#1e293b"; ctx.fillRect(250, 60, 460, 470);
        for (let i = 0; i < 9; i++) {
          const b = baskinKutu(i), d = o.delik[i];
          yuvarlak(b.x, b.y, b.w, b.h, 8, d.kim ? "#fde68a" : "#0f172a");
          if (d.kim === "kubi") { emoji("😳", b.x + b.w / 2, b.y + b.h / 2 - 6, 56); emoji("📱", b.x + b.w / 2 + 30, b.y + b.h / 2 + 22, 30); yazi("Kubi", b.x + b.w / 2, b.y + b.h - 6, "800 12px sans-serif", "#111"); }
          if (d.kim === "ibo") { emoji("🤓", b.x + b.w / 2, b.y + b.h / 2 - 6, 56); yazi("İbo (vurma!)", b.x + b.w / 2, b.y + b.h - 6, "800 12px sans-serif", "#b91c1c"); }
          if (o.imlec === i) { ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 10); ctx.stroke(); }
          if (o.vur.some((v) => v.i === i)) emoji("🔦", b.x + b.w / 2, b.y + b.h / 2, 60);
        }
        berkayCiz(110, 540, 120); emoji("🔦", 160, 440, 40);
        yazi(`Kaçan ${o.kacan}/6`, 850, 520, "900 20px sans-serif", "#fca5a5");
      },
      skor: (o) => `📱 ${o.yakalanan}/20`,
      gorev: () => "Kubi'ye tıkla / dokun (ya da ← → + Boşluk, 1-9) · İbo'ya vurma",
    },
    // ---- 9) Hafıza: Aquapark ekibini eşleştir ----
    hafiza: {
      kur() {
        const E = ["🍔", "🤓", "😳", "🧥", "🍞", "🎤", "🎮", "🏍️"];
        return { kart: karistir([...E, ...E]).map((e) => ({ e, acik: false, bitti: false })), imlec: 0, secili: [], bekle: 0, t: 75, hamle: 0 };
      },
      guncelle(s, o, dt) {
        o.t -= dt;
        if (o.t <= 0) return ol("Süre bitti, ekip yine toplanamadı");
        if (o.bekle > 0) { o.bekle -= dt; if (o.bekle <= 0) { for (const i of o.secili) o.kart[i].acik = false; o.secili = []; } return; }
        if (solBasildi) o.imlec = (o.imlec + 15) % 16;
        if (sagBasildi) o.imlec = (o.imlec + 1) % 16;
        let ac = null;
        if (ziplaBasildi || atBasildi) ac = o.imlec;
        if (sayiBasildi) ac = null;
        if (tik) { for (let i = 0; i < 16; i++) { const b = hafizaKutu(i); if (tik.x > b.x && tik.x < b.x + b.w && tik.y > b.y && tik.y < b.y + b.h) ac = i; } tik = null; }
        if (ac == null) return;
        o.imlec = ac; const k = o.kart[ac];
        if (k.acik || k.bitti) return;
        k.acik = true; o.secili.push(ac); bip(600, 700, 0.06, "square", 0.06);
        if (o.secili.length === 2) {
          o.hamle++;
          const [a, b] = o.secili.map((i) => o.kart[i]);
          if (a.e === b.e) { a.bitti = b.bitti = true; o.secili = []; SES.burger(); if (o.kart.every((x) => x.bitti)) { s.mesaj = { yazi: "🏊 Ekip toplandı! 7 kişi, bilet 1.560 TL", t: 2.5 }; return bitir(); } }
          else o.bekle = 0.8;
        }
        s.konus = { x: 110, y: 400 };
      },
      ciz(s, o) {
        const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "#0ea5e9"); g.addColorStop(1, "#0369a1"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        for (let i = 0; i < 16; i++) {
          const b = hafizaKutu(i), k = o.kart[i];
          yuvarlak(b.x, b.y, b.w, b.h, 12, k.bitti ? "rgba(74,222,128,.85)" : k.acik ? "#fff" : "#1e3a8a");
          if (k.acik || k.bitti) emoji(k.e, b.x + b.w / 2, b.y + b.h / 2, 46); else yazi("?", b.x + b.w / 2, b.y + b.h / 2 + 12, "900 34px sans-serif", "#93c5fd");
          if (o.imlec === i) { ctx.strokeStyle = "#facc15"; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 14); ctx.stroke(); }
        }
        berkayCiz(110, 540, 120);
        yazi(`⏰ ${Math.max(0, o.t).toFixed(0)} sn`, 860, 520, "900 22px sans-serif", o.t < 15 ? "#fca5a5" : "#fff");
      },
      skor: (o) => `🃏 ${o.kart.filter((x) => x.bitti).length / 2}/8`,
      gorev: () => "Kartlara tıkla (ya da ← → + Boşluk) · 8 çifti 75 sn'de eşleştir",
    },

    // ---- 10) Yılan: Popeyes peşinde ----
    yilan: {
      kur: () => ({ govde: [[8, 7], [7, 7], [6, 7]], yon: [1, 0], adim: 0, yem: [16, 7], yenen: 0, buyu: 0 }),
      guncelle(s, o, dt) {
        if (solBasildi) o.yon = [o.yon[1], -o.yon[0]];
        if (sagBasildi) o.yon = [-o.yon[1], o.yon[0]];
        o.adim += dt;
        const ara = Math.max(0.075, 0.15 - o.yenen * 0.004);
        if (o.adim < ara) return;
        o.adim = 0;
        const bas = [o.govde[0][0] + o.yon[0], o.govde[0][1] + o.yon[1]];
        if (bas[0] < 0 || bas[0] >= 24 || bas[1] < 0 || bas[1] >= 13) return ol("Duvara çarptın");
        if (o.govde.some((p) => p[0] === bas[0] && p[1] === bas[1])) return ol("Kendini ısırdın");
        o.govde.unshift(bas);
        if (bas[0] === o.yem[0] && bas[1] === o.yem[1]) {
          o.yenen++; o.buyu += 2; SES.burger();
          if (o.yenen % 5 === 0) soyle(rastgele(["Popeyes'e parayı gömdüm", "Bir kova daha", "Tüm para gitti tavuğa"]), 1.4);
          if (o.yenen >= 15) { s.mesaj = { yazi: "🍗 15 kova Popeyes! Maaş bitti", t: 2.5 }; return bitir(); }
          do { o.yem = [Math.floor(Math.random() * 24), Math.floor(Math.random() * 13)]; } while (o.govde.some((p) => p[0] === o.yem[0] && p[1] === o.yem[1]));
        }
        if (o.buyu > 0) o.buyu--; else o.govde.pop();
        s.konus = { x: 72 + o.govde[0][0] * 34 + 17, y: 70 + o.govde[0][1] * 34 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#7c2d12"; ctx.fillRect(0, 0, VW, VH);
        for (let x = 0; x < 24; x++) for (let y = 0; y < 13; y++) { ctx.fillStyle = (x + y) % 2 ? "#fed7aa" : "#fdba74"; ctx.fillRect(72 + x * 34, 70 + y * 34, 34, 34); }
        emoji("🍗", 72 + o.yem[0] * 34 + 17, 70 + o.yem[1] * 34 + 17, 28);
        o.govde.forEach((p, i) => { if (i === 0) return; yuvarlak(72 + p[0] * 34 + 3, 70 + p[1] * 34 + 3, 28, 28, 8, i % 2 ? "#dc2626" : "#b91c1c"); });
        const b = o.govde[0];
        if (KAHRAMAN.complete) ctx.drawImage(KAHRAMAN, 72 + b[0] * 34 - 4, 70 + b[1] * 34 - 6, 42, 42);
        yazi("POPEYES", 480, 520, "900 26px sans-serif", "#fde68a");
      },
      skor: (o) => `🍗 ${o.yenen}/15`,
      gorev: () => "← sola dön, → sağa dön · 15 kova Popeyes ye, duvara ve kendine çarpma",
    },

    // ---- 11) Uyan: 04:50 servisi ----
    uyan: {
      kur: () => ({ tur: 0, faz: "uyku", bekle: 1.5 + Math.random() * 2.5, pencere: 0.75, can: 3, sonuc: null, sonucT: 0, tepki: [] }),
      guncelle(s, o, dt) {
        const bas = ziplaBasildi || atBasildi || solBasildi || sagBasildi || tik; tik = null;
        if (o.sonucT > 0) { o.sonucT -= dt; if (o.sonucT <= 0) { o.sonuc = null; o.faz = "uyku"; o.bekle = 1.2 + Math.random() * 3; } return; }
        if (o.faz === "uyku") {
          o.bekle -= dt;
          if (bas) { o.can--; o.sonuc = "Erken kalktın, servis daha gelmedi"; o.sonucT = 1.2; bip(300, 120, 0.3, "sawtooth", 0.1); if (o.can <= 0) return ol("Hep erken kalktın, has amele oldun"); return; }
          if (o.bekle <= 0) { o.faz = "alarm"; o.zaman = 0; }
        } else if (o.faz === "alarm") {
          o.zaman += dt;
          if (Math.floor(o.zaman * 8) % 2 === 0 && Math.floor((o.zaman - dt) * 8) % 2 !== 0) bip(1200, 1200, 0.06, "square", 0.08);
          if (bas) { o.tur++; o.tepki.push(Math.round(o.zaman * 1000)); o.sonuc = `✅ ${Math.round(o.zaman * 1000)} ms`; o.sonucT = 0.9; o.pencere = Math.max(0.42, o.pencere - 0.04); SES.burger(); if (o.tur >= 10) { s.mesaj = { yazi: `⏰ 10 kez uyandın! Ort. ${Math.round(o.tepki.reduce((a, b) => a + b, 0) / o.tepki.length)} ms`, t: 2.5 }; return bitir(); } return; }
          if (o.zaman > o.pencere) { o.can--; o.sonuc = "Uyuyakaldın, servis kaçtı"; o.sonucT = 1.2; soyle("Bune aq 2 saat önceden durakta", 1.4); if (o.can <= 0) return ol("Servis 3 kez kaçtı"); }
        }
        s.konus = { x: 480, y: 330 };
      },
      ciz(s, o) {
        const alarm = o.faz === "alarm";
        ctx.fillStyle = alarm ? (Math.floor(performance.now() / 120) % 2 ? "#7f1d1d" : "#450a0a") : "#0b1026"; ctx.fillRect(0, 0, VW, VH);
        yuvarlak(260, 360, 440, 120, 20, "#334155"); yuvarlak(270, 330, 140, 60, 20, "#e2e8f0");
        berkayCiz(480, 420, 120, false);
        if (!alarm) { emoji("💤", 600, 260 + Math.sin(performance.now() / 300) * 8, 46); }
        emoji("⏰", 480, 160 + (alarm ? Math.sin(performance.now() / 30) * 6 : 0), alarm ? 110 : 80);
        yazi("04:50", 480, 250, "900 34px ui-monospace,monospace", alarm ? "#fde68a" : "#64748b");
        if (alarm) yazi("KALK! (Boşluk / dokun)", 480, 300, "900 30px sans-serif", "#fff");
        if (o.sonuc) yazi(o.sonuc, 480, 520, "900 26px sans-serif", o.sonuc.startsWith("✅") ? "#4ade80" : "#fca5a5");
        for (let i = 0; i < 3; i++) emoji(i < o.can ? "❤️" : "🖤", VW - 120 + i * 34, 120, 26);
      },
      skor: (o) => `⏰ ${o.tur}/10`,
      gorev: () => "Alarm çalınca hemen bas! Erken basarsan da can gider",
    },

    // ---- 12) Bardak: Kubi'nin hediyesi hangi kutuda? ----
    bardak: {
      kur: () => ({ tur: 0, dogru: 0, yanlis: 0, faz: "goster", t: 0, yer: [0, 1, 2], hedef: Math.floor(Math.random() * 3), takas: [], imlec: 1, sonuc: null }),
      guncelle(s, o, dt) {
        o.t += dt;
        if (o.faz === "goster" && o.t > 1.4) {
          o.faz = "karis"; o.t = 0;
          const n = 4 + o.tur * 2; o.takas = [];
          for (let i = 0; i < n; i++) { const a = Math.floor(Math.random() * 3); let b = Math.floor(Math.random() * 2); if (b >= a) b++; o.takas.push([a, b]); }
          o.hiz = 0.42 - o.tur * 0.05; o.adim = 0;
        } else if (o.faz === "karis") {
          if (o.t >= o.hiz) {
            o.t = 0; const [a, b] = o.takas[o.adim];
            const ia = o.yer.indexOf(a), ib = o.yer.indexOf(b); [o.yer[ia], o.yer[ib]] = [o.yer[ib], o.yer[ia]];
            o.adim++; bip(400, 500, 0.04, "triangle", 0.05);
            if (o.adim >= o.takas.length) { o.faz = "sec"; o.t = 0; }
          }
        } else if (o.faz === "sec") {
          if (solBasildi) o.imlec = Math.max(0, o.imlec - 1);
          if (sagBasildi) o.imlec = Math.min(2, o.imlec + 1);
          let sec = null;
          if (ziplaBasildi || atBasildi) sec = o.imlec;
          if (sayiBasildi >= 1 && sayiBasildi <= 3) sec = sayiBasildi - 1;
          if (tik) { const i = Math.floor((tik.x - 220) / 180); if (i >= 0 && i < 3 && tik.y > 220 && tik.y < 460) sec = i; tik = null; }
          if (sec != null) {
            o.imlec = sec; const bulundu = o.yer[sec] === o.hedef;
            o.sonuc = bulundu ? "🎁 Buldun!" : "🍜 Çorba çıktı…"; o.faz = "sonuc"; o.t = 0;
            if (bulundu) { o.dogru++; SES.burger(); } else { o.yanlis++; bip(300, 120, 0.3, "sawtooth", 0.1); soyle("Çorba mı aldın İbo", 1.5); }
          }
        } else if (o.faz === "sonuc" && o.t > 1.4) {
          if (o.yanlis >= 2) return ol("Hediyeyi bulamadın, çorba içtin");
          o.tur++; if (o.dogru >= 5) { s.mesaj = { yazi: "🎁 Hediye bulundu! 301 TL'lik sürpriz", t: 2.5 }; return bitir(); }
          o.faz = "goster"; o.t = 0; o.hedef = Math.floor(Math.random() * 3); o.yer = [0, 1, 2];
        }
        s.konus = { x: 110, y: 400 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#3b0764"; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = "#7c2d12"; ctx.fillRect(160, 420, 640, 40);
        const anim = o.faz === "karis" ? Math.min(1, o.t / o.hiz) : 1;
        for (let k = 0; k < 3; k++) {
          const pos = o.yer.indexOf(k); let x = 310 + pos * 180;
          if (o.faz === "karis" && o.adim < o.takas.length) { /* yumuşak geçiş için küçük zıplama */ }
          const acik = o.faz === "goster" || o.faz === "sonuc";
          if (acik && k === o.hedef) emoji("🎁", x, 400, 60);
          if (acik && k !== o.hedef && o.faz === "sonuc") emoji("🍜", x, 400, 50);
          ctx.save(); ctx.translate(x, acik ? 300 : 360 - (o.faz === "karis" ? Math.sin(anim * Math.PI) * 14 : 0)); emoji("🥡", 0, 0, 120); ctx.restore();
          if (o.faz === "sec" && pos === o.imlec) { ctx.strokeStyle = "#facc15"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, 360, 76, 0, 7); ctx.stroke(); }
        }
        if (o.sonuc) yazi(o.sonuc, 480, 180, "900 40px sans-serif", o.sonuc.startsWith("🎁") ? "#4ade80" : "#fca5a5");
        if (o.faz === "sec") yazi("Hediye hangisinde?", 480, 180, "900 30px sans-serif");
        berkayCiz(110, 540, 120);
        yazi(`✔ ${o.dogru}/5   ✘ ${o.yanlis}/2`, 850, 520, "900 22px sans-serif", "#fde68a");
      },
      skor: (o) => `🎁 ${o.dogru}/5`,
      gorev: (o) => (o.faz === "sec" ? "← → seç + Boşluk (ya da tıkla / 1-3)" : "Hediyeyi gözünle takip et…"),
    },

    // ---- 13) Keskin nişancı: Miramar 8x ----
    sniper: {
      kur: () => ({ x: 480, t: 0, hedef: [], dogum: 0.8, vurulan: 0, iska: 0, sure: 60, geri: 0 }),
      guncelle(s, o, dt) {
        const yon = (tus.sag ? 1 : 0) - (tus.sol ? 1 : 0);
        o.x = Math.max(120, Math.min(VW - 120, o.x + yon * 420 * dt)); o.t += dt; o.sure -= dt;
        if (o.sure <= 0) return ol(`Süre bitti, ${o.vurulan} vuruş`);
        const sway = Math.sin(o.t * 1.7) * 26 + Math.sin(o.t * 3.1) * 10;
        o.y = 330 + sway;
        o.dogum -= dt;
        if (o.dogum <= 0) { o.dogum = Math.max(0.55, 1.4 - o.t * 0.012); o.hedef.push({ x: 160 + Math.random() * 640, y: 330 + (Math.random() - 0.5) * 60, t: Math.max(1.1, 2.4 - o.t * 0.02), dost: Math.random() < 0.2 }); }
        for (const h of o.hedef) h.t -= dt;
        o.hedef = o.hedef.filter((h) => h.t > 0 && !h.vur);
        o.geri = Math.max(0, o.geri - dt);
        let ates = ziplaBasildi || atBasildi;
        if (tik) { o.x = Math.max(120, Math.min(VW - 120, tik.x)); ates = true; tik = null; }
        if (ates && o.geri <= 0) {
          o.geri = 0.35; gurultu(0.15, 0.25, 1200); s.sallanma = 0.08;
          const v = o.hedef.find((h) => Math.abs(h.x - o.x) < 26 && Math.abs(h.y - o.y) < 30);
          if (v) { v.vur = true; if (v.dost) { o.iska += 2; s.mesaj = { yazi: "Takım arkadaşını vurdun! (Kubi)", t: 1 }; } else { o.vurulan++; SES.ez(); if (o.vurulan % 4 === 0) soyle(rastgele(["Kafanızı kesicem", "8x dürbün farkı", "Scoot attım"]), 1.4); } }
          else o.iska++;
          if (o.iska >= 8) return ol("Çok ıskaladın, Miramar'da yem oldun");
          if (o.vurulan >= 12) { s.mesaj = { yazi: "🎯 Chicken dinner! Miramar temizlendi", t: 2.5 }; return bitir(); }
        }
        s.konus = { x: 110, y: 400 };
      },
      ciz(s, o) {
        const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "#fcd34d"); g.addColorStop(1, "#b45309"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#92400e"; for (let x = 0; x < VW; x += 200) { ctx.beginPath(); ctx.moveTo(x - 40, 360); ctx.lineTo(x + 80, 250); ctx.lineTo(x + 220, 360); ctx.fill(); }
        ctx.fillStyle = "#78350f"; ctx.fillRect(0, 360, VW, 200);
        for (let x = 140; x < VW; x += 170) { ctx.fillStyle = "#d6d3d1"; ctx.fillRect(x, 300, 90, 60); ctx.fillStyle = "#57534e"; ctx.fillRect(x + 10, 312, 22, 18); ctx.fillRect(x + 56, 312, 22, 18); }
        for (const h of o.hedef) emoji(h.dost ? "😳" : "🪖", h.x, h.y, 40);
        // dürbün
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.moveTo(o.x + 110, o.y); ctx.arc(o.x, o.y, 110, 0, Math.PI * 2, true); ctx.closePath(); ctx.fillStyle = "rgba(0,0,0,.82)"; ctx.fill(); ctx.restore();
        ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - 110, o.y); ctx.lineTo(o.x + 110, o.y); ctx.moveTo(o.x, o.y - 110); ctx.lineTo(o.x, o.y + 110); ctx.stroke();
        ctx.strokeStyle = "#ef4444"; ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, 7); ctx.stroke();
        yazi(`🎯 ${o.vurulan}/12   ✘ ${o.iska}/8   ⏰ ${Math.max(0, o.sure).toFixed(0)}`, 480, 530, "900 22px sans-serif", "#fde68a");
      },
      skor: (o) => `🎯 ${o.vurulan}/12`,
      gorev: () => "← → nişan al, Boşluk ateş (ya da tıkla) · 🪖 vur, 😳 Kubi'yi vurma",
    },

    // ---- 14) Depo ayıklama: Trendyol mu Hepsiburada mı ----
    ayikla: {
      kur: () => ({ koli: null, dogum: 0.4, dogru: 0, yanlis: 0, hiz: 120, gecen: [] }),
      guncelle(s, o, dt) {
        if (!o.koli) { o.dogum -= dt; if (o.dogum <= 0) { const r = Math.random(); o.koli = { tip: r < 0.42 ? "T" : r < 0.84 ? "H" : "K", y: 40 }; } return; }
        o.koli.y += o.hiz * dt;
        let karar = null;
        if (solBasildi) karar = "T"; if (sagBasildi) karar = "H"; if (ziplaBasildi || atBasildi) karar = "K";
        if (tik) { karar = tik.x < 380 ? "T" : tik.x > 580 ? "H" : "K"; tik = null; }
        if (karar || o.koli.y > 470) {
          const dogru = karar === o.koli.tip;
          o.gecen.push({ tip: o.koli.tip, yon: karar, t: 0.4, dogru });
          if (dogru) { o.dogru++; o.hiz = Math.min(420, o.hiz + 9); SES.burger(); if (o.dogru % 8 === 0) soyle(rastgele(["Alpaslan da övdü beni", "Has amele benim", "Tır boşalttık"]), 1.4); }
          else { o.yanlis++; bip(300, 120, 0.3, "sawtooth", 0.1); s.mesaj = { yazi: karar ? "Yanlış banda attın!" : "Koli düştü!", t: 0.8 }; }
          o.koli = null; o.dogum = 0.25;
          if (o.yanlis >= 4) return ol("Alpaslan denetledi: kovuldun");
          if (o.dogru >= 30) { s.mesaj = { yazi: "📦 30 koli! Alpaslan bile övdü", t: 2.5 }; return bitir(); }
        }
        for (const g of o.gecen) g.t -= dt; o.gecen = o.gecen.filter((g) => g.t > 0);
        s.konus = { x: 110, y: 400 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#292524"; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#44403c"; ctx.fillRect(420, 0, 120, 500); for (let y = (performance.now() / 8) % 30; y < 500; y += 30) { ctx.fillStyle = "#57534e"; ctx.fillRect(420, y, 120, 4); }
        yuvarlak(120, 380, 200, 110, 16, "#f97316"); yazi("◀ TRENDYOL", 220, 445, "900 22px sans-serif");
        yuvarlak(640, 380, 200, 110, 16, "#ea580c"); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(640, 380, 200, 110); yazi("HEPSİBURADA ▶", 740, 445, "900 20px sans-serif");
        yuvarlak(430, 505, 100, 44, 10, "#7f1d1d"); yazi("ÇÖP ▲", 480, 534, "900 16px sans-serif");
        const renk = { T: "#f97316", H: "#c2410c", K: "#78716c" };
        if (o.koli) { yuvarlak(440, o.koli.y, 80, 64, 8, "#d6a26b"); ctx.fillStyle = renk[o.koli.tip]; ctx.fillRect(448, o.koli.y + 22, 64, 20); yazi(o.koli.tip === "T" ? "TRENDYOL" : o.koli.tip === "H" ? "HEPSİB." : "KIRIK 💥", 480, o.koli.y + 37, "900 11px sans-serif"); }
        for (const g of o.gecen) { const x = g.yon === "T" ? 220 - (0.4 - g.t) * 300 : g.yon === "H" ? 740 + (0.4 - g.t) * 300 : 480; emoji(g.dogru ? "📦" : "❌", x, 430, 40); }
        emoji("🧐", 860, 160, 60); yazi("Alpaslan izliyor", 860, 215, "800 13px sans-serif");
        berkayCiz(110, 360, 110);
        yazi(`✔ ${o.dogru}/30   ✘ ${o.yanlis}/4`, 860, 290, "900 20px sans-serif", "#fde68a");
      },
      skor: (o) => `📦 ${o.dogru}/30`,
      gorev: () => "← Trendyol · → Hepsiburada · Boşluk kırık koliyi çöpe (ya da dokun)",
    },

    // ---- 15) Labanzubu: sırayı tekrar et ----
    simon: {
      kur: () => ({ sira: [Math.floor(Math.random() * 4)], faz: "goster", i: 0, t: 0, yanan: -1, girdi: 0 }),
      guncelle(s, o, dt) {
        o.t += dt;
        const SES4 = [392, 494, 587, 698];
        if (o.faz === "goster") {
          const ara = Math.max(0.32, 0.6 - o.sira.length * 0.03);
          if (o.t > ara) { o.t = 0; if (o.i < o.sira.length) { o.yanan = o.sira[o.i]; bip(SES4[o.yanan], SES4[o.yanan], ara * 0.7, "triangle", 0.1); o.i++; } else { o.faz = "gir"; o.girdi = 0; o.yanan = -1; } }
          else if (o.t > ara * 0.7) o.yanan = -1;
          return;
        }
        if (o.faz === "bekle") { if (o.t > 0.8) { o.faz = "goster"; o.i = 0; o.t = 0; } return; }
        let p = null;
        if (solBasildi) p = 0; if (ziplaBasildi) p = 1; if (sagBasildi) p = 2; if (atBasildi) p = 3;
        if (sayiBasildi >= 1 && sayiBasildi <= 4) p = sayiBasildi - 1;
        if (tik) { for (let k = 0; k < 4; k++) { const b = simonKutu(k); if (tik.x > b.x && tik.x < b.x + b.w && tik.y > b.y && tik.y < b.y + b.h) p = k; } tik = null; }
        if (o.yanan >= 0 && o.t > 0.2) o.yanan = -1;
        if (p == null) return;
        o.yanan = p; o.t = 0; bip(SES4[p], SES4[p], 0.18, "triangle", 0.1);
        if (p !== o.sira[o.girdi]) return ol(`Labanzubu bozuldu (${o.sira.length - 1} tur)`);
        o.girdi++;
        if (o.girdi >= o.sira.length) {
          if (o.sira.length >= 9) { s.mesaj = { yazi: "🌀 LABANZUBU! Kubizm akımı onaylandı", t: 2.5 }; return bitir(); }
          o.sira.push(Math.floor(Math.random() * 4)); o.faz = "bekle"; o.t = 0; SES.burger();
          if (o.sira.length === 5) soyle("Lababazubu", 1.4);
        }
        s.konus = { x: 110, y: 400 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#18181b"; ctx.fillRect(0, 0, VW, VH);
        const R = ["#22d3ee", "#f472b6", "#facc15", "#4ade80"], A = ["LA", "BAN", "ZU", "BU"], T = ["◀", "Boşluk", "▶", "Z"];
        for (let k = 0; k < 4; k++) {
          const b = simonKutu(k), yan = o.yanan === k;
          ctx.globalAlpha = yan ? 1 : 0.35; yuvarlak(b.x, b.y, b.w, b.h, 22, R[k]); ctx.globalAlpha = 1;
          yazi(A[k], b.x + b.w / 2, b.y + b.h / 2 + 14, "900 44px sans-serif", "#111"); yazi(T[k], b.x + b.w / 2, b.y + b.h - 14, "800 14px sans-serif", "#111");
        }
        yazi(o.faz === "gir" ? "Sıra sende!" : "İzle…", 480, 110, "900 30px sans-serif", o.faz === "gir" ? "#4ade80" : "#fff");
        emoji("😳", 860, 200, 70); yazi("Kubi: Labanzubu", 860, 260, "800 14px sans-serif");
        berkayCiz(110, 540, 120);
      },
      skor: (o) => `🌀 ${o.sira.length - 1}/9`,
      gorev: () => "Yanan sırayı tekrarla: ← / Boşluk / → / Z (ya da dokun) · 9 tur",
    },

    // ---- 16) Kayalıklardan atlama: suya düş ----
    dalis: {
      kur() { return { faz: "aci", t: 0, aci: 0, guc: 0, basarili: 0, kaza: 0, su: MINI.dalis.suYeni(), x: 0, y: 0, vx: 0, vy: 0, sonuc: null }; },
      suYeni() { const a = 430 + Math.random() * 330, w = 120 - Math.random() * 40; return { a, b: a + w }; },
      guncelle(s, o, dt) {
        o.t += dt;
        const bas = ziplaBasildi || atBasildi || tik; tik = null;
        if (o.faz === "aci") { o.aci = 0.15 + (Math.sin(o.t * 2.6) + 1) / 2 * 0.95; if (bas) { o.faz = "guc"; o.t = 0; } }
        else if (o.faz === "guc") { o.guc = (Math.sin(o.t * 3.2 - Math.PI / 2) + 1) / 2; if (bas) { o.faz = "uc"; const v = 260 + o.guc * 420; o.x = 190; o.y = 220; o.vx = Math.cos(o.aci) * v; o.vy = -Math.sin(o.aci) * v; SES.zipla(); } }
        else if (o.faz === "uc") {
          o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt;
          if (o.y >= 440) {
            const suda = o.x > o.su.a && o.x < o.su.b;
            o.faz = "sonuc"; o.t = 0; o.sonuc = suda ? "🌊 Şıp! Mükemmel dalış" : "🪨 Kayalara çakıldın";
            if (suda) { o.basarili++; SES.burger(); soyle(rastgele(["Güzel ülkem izin veriyor bu sefer", "Tepeden atladık", "Kerpe'nin efendisi"]), 1.4); }
            else { o.kaza++; s.sallanma = 0.3; bip(200, 60, 0.4, "sawtooth", 0.12); soyle("Tüm vücudum soyuldu aq", 1.4); }
          }
        } else if (o.faz === "sonuc" && o.t > 1.3) {
          if (o.kaza >= 3) return ol("3 kez kayalara çakıldın");
          if (o.basarili >= 5) { s.mesaj = { yazi: "🏆 5 dalış! Kayalar seni affetti", t: 2.5 }; return bitir(); }
          o.faz = "aci"; o.t = 0; o.su = MINI.dalis.suYeni(); o.sonuc = null;
        }
        s.konus = { x: o.faz === "uc" ? o.x : 190, y: o.faz === "uc" ? o.y : 180 };
      },
      ciz(s, o) {
        const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "#38bdf8"); g.addColorStop(1, "#e0f2fe"); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = "#0284c7"; ctx.fillRect(0, 440, VW, 120);
        ctx.fillStyle = "#57534e"; ctx.beginPath(); ctx.moveTo(0, 230); ctx.lineTo(210, 230); ctx.lineTo(250, 440); ctx.lineTo(0, 440); ctx.fill();
        ctx.fillStyle = "#44403c";
        for (let x = 260; x < VW; x += 60) { if (x + 30 > o.su.a && x < o.su.b) continue; ctx.beginPath(); ctx.moveTo(x, 450); ctx.lineTo(x + 25, 400 + (x * 7) % 30); ctx.lineTo(x + 55, 450); ctx.fill(); }
        ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.setLineDash([6, 6]); ctx.strokeRect(o.su.a, 432, o.su.b - o.su.a, 20); ctx.setLineDash([]);
        if (o.faz === "aci" || o.faz === "guc") {
          ctx.strokeStyle = "#facc15"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(200, 200); ctx.lineTo(200 + Math.cos(o.aci) * 110, 200 - Math.sin(o.aci) * 110); ctx.stroke();
          yuvarlak(40, 60, 24, 140, 8, "rgba(0,0,0,.4)"); if (o.faz === "guc") yuvarlak(40, 60 + 140 * (1 - o.guc), 24, 140 * o.guc, 8, "#ef4444");
          berkayCiz(190, 230, 80);
        } else if (o.faz === "uc") { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.atan2(o.vy, o.vx)); berkayCiz(0, 30, 64); ctx.restore(); }
        else emoji(o.sonuc && o.sonuc.startsWith("🌊") ? "💦" : "🤕", o.x, 430, 60);
        if (o.sonuc) yazi(o.sonuc, 480, 120, "900 38px sans-serif", o.sonuc.startsWith("🌊") ? "#fff" : "#7f1d1d");
        yazi(`🌊 ${o.basarili}/5   🪨 ${o.kaza}/3`, 860, 520, "900 22px sans-serif", "#0c4a6e");
      },
      skor: (o) => `🌊 ${o.basarili}/5`,
      gorev: (o) => (o.faz === "aci" ? "Boşluk: açıyı kilitle" : o.faz === "guc" ? "Boşluk: gücü kilitle ve atla!" : "Kesik çizgili suya düş, kayalara değil"),
    },

    // ---- 17) Burger'in mesajları: ne demek istedi? ----
    yazim: {
      KELIME: [["awuaqoark", "aquapark"], ["berddsnsşz", "neredesiniz"], ["kütpjane", "kütüphane"], ["haılsaga", "halısaha"], ["otobğs", "otobüs"], ["kalkıypm", "kalkıyorum"], ["gelcrm", "gelcem"], ["uyuyakaldkm", "uyuyakaldım"], ["popetes", "popeyes"], ["sakarta", "sakarya"], ["kubşi", "kubi"], ["tmaam agaa", "tamam aga"], ["yrın sbah", "yarın sabah"], ["kerpw", "kerpe"], ["dşrüm", "dürüm"], ["borsda", "borsa"]],
      kur() { return { sorular: karistir(MINI.yazim.KELIME).slice(0, 12).map(([h, d]) => ({ h, d, sec: karistir([d, ...karistir(MINI.yazim.KELIME.filter((x) => x[1] !== d)).slice(0, 2).map((x) => x[1])]) })), i: 0, imlec: 1, t: 5, dogru: 0, yanlis: 0, sonuc: null, bekle: 0 }; },
      guncelle(s, o, dt) {
        if (o.bekle > 0) { o.bekle -= dt; if (o.bekle <= 0) { o.sonuc = null; o.i++; o.t = Math.max(3, 5 - o.i * 0.15); o.imlec = 1; if (o.yanlis >= 3) return ol("Burger'i anlayamadın"); if (o.i >= o.sorular.length) { s.mesaj = { yazi: "📱 Burger'in dilini çözdün!", t: 2.5 }; return bitir(); } } return; }
        const q = o.sorular[o.i];
        if (solBasildi) o.imlec = Math.max(0, o.imlec - 1);
        if (sagBasildi) o.imlec = Math.min(2, o.imlec + 1);
        let sec = null;
        if (ziplaBasildi || atBasildi) sec = o.imlec;
        if (sayiBasildi >= 1 && sayiBasildi <= 3) sec = sayiBasildi - 1;
        if (tik) { for (let k = 0; k < 3; k++) { const x = 170 + k * 220; if (tik.x > x && tik.x < x + 200 && tik.y > 330 && tik.y < 400) sec = k; } tik = null; }
        o.t -= dt;
        if (sec != null || o.t <= 0) {
          if (sec != null) o.imlec = sec;
          const dogru = sec != null && q.sec[sec] === q.d;
          o.sonuc = dogru ? "dogru" : "yanlis"; o.bekle = 0.9;
          if (dogru) { o.dogru++; SES.burger(); } else { o.yanlis++; bip(300, 120, 0.3, "sawtooth", 0.1); }
        }
        s.konus = { x: 110, y: 400 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#0b141a"; ctx.fillRect(0, 0, VW, VH);
        const q = o.sorular[Math.min(o.i, o.sorular.length - 1)];
        yuvarlak(260, 110, 440, 50, 12, "#1f2c33"); yazi("🍔 Burger King · çevrimiçi", 480, 142, "800 16px sans-serif", "#e9edef");
        yuvarlak(300, 190, 360, 80, 16, "#005c4b"); yazi(q.h, 480, 242, "900 34px sans-serif", "#e9edef");
        for (let k = 0; k < 3; k++) {
          const x = 170 + k * 220; let renk = o.imlec === k ? "#facc15" : "#e2e8f0";
          if (o.sonuc && q.sec[k] === q.d) renk = "#4ade80"; else if (o.sonuc === "yanlis" && o.imlec === k) renk = "#f87171";
          yuvarlak(x, 330, 200, 70, 14, renk); yazi(q.sec[k], x + 100, 374, "900 22px sans-serif", "#111");
        }
        yuvarlak(170, 420, 640, 10, 5, "rgba(255,255,255,.15)"); yuvarlak(170, 420, 640 * Math.max(0, o.t / 5), 10, 5, o.t < 1.5 ? "#ef4444" : "#22c55e");
        berkayCiz(110, 540, 120);
        yazi(`${o.i + 1}/12   ✔ ${o.dogru}   ✘ ${o.yanlis}/3`, 850, 520, "900 20px sans-serif", "#fde68a");
      },
      skor: (o) => `📱 ${o.dogru}/12`,
      gorev: () => "Burger ne yazmak istedi? ← → seç + Boşluk (ya da tıkla / 1-3)",
    },

    // ---- 18) Aquapark kaydırağı: borudan uçma ----
    kaydirak: {
      kur: () => ({ x: MINI.kaydirak.merkez(420, 0), vx: 0, t: 0, yol: 0, dondurma: 0, esya: [] }),
      merkez: (y, yol) => { const d = yol - y, a = Math.max(0.3, Math.min(1, 0.3 + d / 5000)); return 480 + (Math.sin(d / 190) * 150 + Math.sin(d / 80) * 35) * a; },
      guncelle(s, o, dt) {
        o.t += dt; const hiz = 240 + Math.min(200, o.t * 5); o.yol += hiz * dt;
        const yon = (tus.sag ? 1 : 0) - (tus.sol ? 1 : 0);
        if (tik) { o.hedefX = tik.x; tik = null; }
        o.vx += (yon * 2000 - o.vx * 3.2) * dt;
        if (!yon && o.hedefX != null) { o.vx += Math.sign(o.hedefX - o.x) * 1200 * dt; if (Math.abs(o.hedefX - o.x) < 10) o.hedefX = null; }
        o.x += o.vx * dt;
        const m = MINI.kaydirak.merkez(420, o.yol), gen = Math.max(120, 160 - o.t * 0.9);
        if (Math.abs(o.x - m) > gen) return ol("Kaydıraktan uçtun! 🌊");
        if (Math.random() < dt * 1.3) o.esya.push({ d: o.yol + 640, k: (Math.random() - 0.5) * 1.4, e: Math.random() < 0.7 ? "🍦" : "🥐" });
        for (const e of o.esya) { const y = 420 - (e.d - o.yol); const ex = MINI.kaydirak.merkez(y, o.yol) + e.k * gen * 0.7; if (!e.al && Math.abs(y - 420) < 26 && Math.abs(ex - o.x) < 34) { e.al = true; o.dondurma++; SES.burger(); if (e.e === "🥐") soyle("Poğaça ye yeter", 1.4); } }
        o.esya = o.esya.filter((e) => !e.al && e.d > o.yol - 200);
        if (o.t >= 40) { s.mesaj = { yazi: "🏊 Havuza indin! Sakarya Aquapark yapıldı", t: 2.5 }; return bitir(); }
        s.konus = { x: o.x, y: 380 };
      },
      ciz(s, o) {
        ctx.fillStyle = "#86efac"; ctx.fillRect(0, 0, VW, VH);
        const gen = Math.max(120, 160 - o.t * 0.9);
        for (let y = -20; y < VH + 20; y += 10) { const m = MINI.kaydirak.merkez(y, o.yol); ctx.fillStyle = "#f97316"; ctx.fillRect(m - gen - 16, y, gen * 2 + 32, 11); ctx.fillStyle = "#38bdf8"; ctx.fillRect(m - gen, y, gen * 2, 11); }
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3; for (let y = -((o.yol) % 60); y < VH; y += 60) { const m = MINI.kaydirak.merkez(y, o.yol); ctx.beginPath(); ctx.moveTo(m - 30, y); ctx.lineTo(m + 30, y + 8); ctx.stroke(); }
        for (const e of o.esya) { const y = 420 - (e.d - o.yol); if (y < -40 || y > VH + 40) continue; emoji(e.e, MINI.kaydirak.merkez(y, o.yol) + e.k * gen * 0.7, y, 34); }
        ctx.save(); ctx.translate(o.x, 420); ctx.rotate(o.vx / 2000); berkayCiz(0, 30, 70); ctx.restore();
        yazi(`⏰ ${Math.max(0, 40 - o.t).toFixed(0)} sn`, 860, 520, "900 22px sans-serif", "#14532d");
      },
      skor: (o) => `🍦 ${o.dondurma}`,
      gorev: () => "← → ile borunun içinde kal (ya da dokun) · 40 sn dayan",
    },
  };
  function hafizaKutu(i) { return { x: 262 + (i % 4) * 112, y: 96 + Math.floor(i / 4) * 108, w: 100, h: 96 }; }
  function simonKutu(k) { return { x: 290 + (k % 2) * 200, y: 140 + Math.floor(k / 2) * 190, w: 180, h: 170 }; }
  function kpssKutu(k) { return { x: 140 + (k % 2) * 350, y: 290 + Math.floor(k / 2) * 80, w: 330, h: 62 }; }
  function baskinKutu(i) { return { x: 270 + (i % 3) * 145, y: 80 + Math.floor(i / 3) * 150, w: 130, h: 130 }; }

  function miniKur(s) { s.oyun = MINI[s.sv.mini].kur(s); s.konus = { x: 120, y: 400 }; }
  function miniGuncelle(dt) {
    const s = S;
    if (s.bitti) { solBasildi = sagBasildi = false; sayiBasildi = 0; tik = null; return; }
    if (s.olu > 0) { s.olu -= dt; parcaGuncelle(dt); if (s.olu <= 0) { miniKur(s); s.mesaj = { yazi: "Baştan!", t: 1 }; } solBasildi = sagBasildi = ziplaBasildi = atBasildi = false; sayiBasildi = 0; tik = null; return; }
    if (s.balon) { s.balon.t -= dt; if (s.balon.t <= 0) s.balon = null; }
    s.sozSaat -= dt;
    if (s.sozSaat <= 0) { s.sozSaat = 8 + Math.random() * 6; if (!s.balon) soyle(rastgele(s.sv.sozler || SOZ.genel)); }
    s.sure += dt * 1000;
    MINI[s.sv.mini].guncelle(s, s.oyun, dt);
    solBasildi = sagBasildi = ziplaBasildi = atBasildi = false; sayiBasildi = 0; tik = null;
    parcaGuncelle(dt);
    s.sallanma = Math.max(0, s.sallanma - dt);
    if (s.mesaj) { s.mesaj.t -= dt; if (s.mesaj.t <= 0) s.mesaj = null; }
  }
  function miniCiz() {
    const s = S, m = MINI[s.sv.mini];
    ctx.save();
    if (s.sallanma > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    m.ciz(s, s.oyun);
    if (s.balon && s.olu <= 0) balonCiz(s.konus.x, s.konus.y - 70, s.balon.yazi, Math.min(1, s.balon.t * 3));
    ctx.restore();
    s.miniSkor = m.skor(s.oyun);
    hudCiz(s);
    if (!s.bitti && !s.olu) {
      const g = m.gorev(s.oyun); ctx.font = "800 15px sans-serif"; ctx.textAlign = "center";
      const w = ctx.measureText(g).width + 30; yuvarlak(VW / 2 - w / 2, 62, w, 30, 12, "rgba(0,0,0,.55)");
      ctx.fillStyle = "#fff"; ctx.fillText(g, VW / 2, 82); ctx.textAlign = "left";
    }
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
    if (b.berkay) setTimeout(() => soyle(rastgele(b.berkay), 3), 900);
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
    s.olum++; s.olu = 0.9; s.sonNeden = neden; s.olumSozu = rastgele(SOZ.olum); s.balon = null;
    SES.ol(); s.sallanma = 0.3;
    if (s.mini) parcaPatla(VW / 2, VH / 2, "#f97316", 24); else parcaPatla(p.x + p.w / 2, p.y + p.h / 2, "#f97316", 24);
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
    if (s.gorev && s.gorev.tip === "sure") s.kalan = Math.max(s.kalanKontrol, s.gorev.limit * 0.4);
    if (s.gorev && s.gorev.tip === "hayatta" && !s.hayattaBitti) {
      s.hayatta = 0; s.dalgaSaat = 2; s.cephane = [];
      s.dusman = s.dusman.filter((d) => !d.dalga);
      s.dusman.forEach((d, i) => { const o = s.ilkDusman[i]; if (o) Object.assign(d, { x: o.x, y: o.y, canli: true }); });
      s.mesaj = { yazi: "Sayaç sıfırlandı, baştan!", t: 1.5 };
    }
    if (s.kacak && s.kacak.x < s.p.x + 6 * T) { s.kacak.x = s.p.x + 6 * T; s.kacak.y = 0; s.kacak.vy = 0; }
    // arabalar geri gelsin (motor bölümünde öldükten sonra yol boş kalmasın)
    s.dusman.forEach((d, i) => { if (d.tip === "araba") { const o = s.ilkDusman[i]; d.x = o.x; d.vx = 0; } });
  }
  function bitir() {
    const s = S;
    s.bitti = true; muzikCal("zafer");
    const sure = Math.round(s.sure), bolum = s.no + 1;
    let enIyi = null;
    try {
      const kayit = JSON.parse(localStorage.getItem("macera_kayit2") || "{}");
      const eski = kayit[bolum];
      enIyi = !eski || sure < eski.sure;
      if (enIyi) kayit[bolum] = { sure, olum: s.olum, burger: s.toplanan };
      kayit.acik = Math.max(kayit.acik || 1, bolum + 1);
      localStorage.setItem("macera_kayit2", JSON.stringify(kayit));
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
    izmir: { gok: ["#020617", "#0f172a"], zemin: "#1f2937", zeminUst: "#4b5563", koli: "#78350f", koliCizgi: "#451a03", plat: "#6b7280", silu: "#0b1220" },
    kerpe: { gok: ["#38bdf8", "#bae6fd"], zemin: "#a16207", zeminUst: "#fde68a", koli: "#57534e", koliCizgi: "#292524", plat: "#78716c", silu: "#0369a1" },
    halisaha: { gok: ["#0f172a", "#1e3a8a"], zemin: "#14532d", zeminUst: "#22c55e", koli: "#e5e7eb", koliCizgi: "#9ca3af", plat: "#f8fafc", silu: "#0b1a33" },
    lol: { gok: ["#0c1a2b", "#123b3a"], zemin: "#1c2e1f", zeminUst: "#4d7c0f", koli: "#57534e", koliCizgi: "#a3a3a3", plat: "#2dd4bf", silu: "#0f2a2a" },
    gondol: { gok: ["#7dd3fc", "#fef3c7"], zemin: "#365314", zeminUst: "#65a30d", koli: "#9a3412", koliCizgi: "#431407", plat: "#e7e5e4", silu: "#a8a29e" },
    tekel: { gok: ["#3f1d0b", "#7c2d12"], zemin: "#44403c", zeminUst: "#fbbf24", koli: "#15803d", koliCizgi: "#052e16", plat: "#d6d3d1", silu: "#451a03" },
    firtina: { gok: ["#1f2937", "#4b5563"], zemin: "#3f3f46", zeminUst: "#a1a1aa", koli: "#ea580c", koliCizgi: "#7c2d12", plat: "#e4e4e7", silu: "#111827" },
    durum: { gok: ["#052e16", "#3f6212"], zemin: "#292524", zeminUst: "#84cc16", koli: "#a16207", koliCizgi: "#422006", plat: "#d9f99d", silu: "#1a2e05" },
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
    } else if (s.tema === "izmir") {
      ctx.fillStyle = "#fff"; for (let i = 0; i < 30; i++) ctx.fillRect((i * 151 + 40) % VW, (i * 83) % 220, 2, 2);
      for (let x = kay(0.3, 200) - 200, i = 0; x < VW + 200; x += 200, i++) { ctx.fillStyle = tm.silu; ctx.fillRect(x, 230, 170, 250); ctx.fillStyle = "#facc15"; ctx.fillRect(x + 150, 300, 6, 180); ctx.fillStyle = "rgba(250,204,21,.15)"; ctx.beginPath(); ctx.arc(x + 153, 300, 40, 0, 7); ctx.fill(); }
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.font = "800 46px sans-serif"; ctx.fillText("İZMİR OTOGAR", kay(0.2, 1000) + 260, 90);
    } else if (s.tema === "kerpe") {
      ctx.fillStyle = "#fef9c3"; ctx.beginPath(); ctx.arc(780, 110, 50, 0, 7); ctx.fill();
      ctx.fillStyle = "#0284c7"; ctx.fillRect(0, 380, VW, 100); ctx.fillStyle = "rgba(255,255,255,.5)"; for (let x = kay(0.5, 80) - 80; x < VW + 80; x += 80) ctx.fillRect(x, 392 + Math.sin(performance.now() / 400 + x) * 4, 40, 3);
      for (let x = kay(0.3, 420) - 420; x < VW + 420; x += 420) { ctx.fillStyle = "#57534e"; ctx.beginPath(); ctx.moveTo(x, 400); ctx.lineTo(x + 70, 280); ctx.lineTo(x + 150, 300); ctx.lineTo(x + 200, 400); ctx.fill(); }
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.font = "800 44px sans-serif"; ctx.fillText("KERPE · NAZI İÇİCEZ", kay(0.2, 1100) + 200, 70);
    } else if (s.tema === "halisaha") {
      for (let x = kay(0.25, 360) - 360; x < VW + 360; x += 360) { ctx.fillStyle = "#e5e7eb"; ctx.fillRect(x + 20, 60, 8, 320); ctx.fillStyle = "#fef9c3"; ctx.fillRect(x, 50, 50, 18); ctx.fillStyle = "rgba(254,249,195,.12)"; ctx.beginPath(); ctx.moveTo(x, 68); ctx.lineTo(x + 50, 68); ctx.lineTo(x + 180, 480); ctx.lineTo(x - 130, 480); ctx.fill(); }
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2; for (let x = kay(0.35, 60) - 60; x < VW + 60; x += 60) { ctx.beginPath(); ctx.moveTo(x, 330); ctx.lineTo(x, 480); ctx.stroke(); }
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.font = "900 50px sans-serif"; ctx.fillText("HALISAHA 22:00", kay(0.2, 1000) + 250, 110);
    } else if (s.tema === "lol") {
      ctx.fillStyle = "#14532d"; for (let x = kay(0.3, 120) - 120; x < VW + 120; x += 120) { ctx.beginPath(); ctx.arc(x + 60, 400, 70, Math.PI, 0); ctx.fill(); }
      for (let x = kay(0.25, 600) - 600; x < VW + 600; x += 600) { ctx.fillStyle = "#334155"; ctx.fillRect(x + 100, 200, 60, 200); ctx.fillStyle = "#2dd4bf"; ctx.beginPath(); ctx.arc(x + 130, 190, 24, 0, 7); ctx.fill(); }
      ctx.fillStyle = "rgba(45,212,191,.15)"; ctx.font = "900 48px sans-serif"; ctx.fillText("WEST MASTER 350 LP", kay(0.2, 1200) + 220, 90);
    } else if (s.tema === "gondol") {
      ctx.fillStyle = "#fff"; for (let x = kay(0.15, 300) - 300; x < VW + 300; x += 300) { ctx.beginPath(); ctx.arc(x + 60, 120, 30, 0, 7); ctx.arc(x + 95, 110, 38, 0, 7); ctx.arc(x + 130, 122, 28, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#a8a29e"; for (let x = kay(0.25, 500) - 500; x < VW + 500; x += 500) { ctx.beginPath(); ctx.moveTo(x, 480); ctx.lineTo(x + 160, 230); ctx.lineTo(x + 320, 480); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x + 125, 285); ctx.lineTo(x + 160, 230); ctx.lineTo(x + 195, 285); ctx.fill(); ctx.fillStyle = "#a8a29e"; }
      ctx.strokeStyle = "#44403c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(VW, 100); ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.font = "900 46px sans-serif"; ctx.fillText("HİNDİSTAN · 16.000 ₺", kay(0.2, 1100) + 260, 70);
    } else if (s.tema === "tekel") {
      for (let x = kay(0.3, 230) - 230; x < VW + 230; x += 230) { ctx.fillStyle = "#1c1917"; ctx.fillRect(x, 170, 200, 310); ctx.fillStyle = "rgba(186,230,253,.25)"; ctx.fillRect(x + 10, 180, 180, 290); for (let r = 0; r < 5; r++) for (let j = 0; j < 7; j++) { ctx.fillStyle = ["#16a34a", "#dc2626", "#ca8a04", "#2563eb"][(r + j) % 4]; ctx.fillRect(x + 18 + j * 24, 200 + r * 55, 12, 36); } }
      ctx.fillStyle = "rgba(251,191,36,.18)"; ctx.font = "900 46px sans-serif"; ctx.fillText("TEKEL · GÜNLÜK 1.000 ₺", kay(0.2, 1100) + 220, 90);
    } else if (s.tema === "firtina") {
      for (let x = kay(0.3, 220) - 220; x < VW + 220; x += 220) { ctx.fillStyle = tm.silu; ctx.fillRect(x, 300, 180, 180); }
      const t = performance.now() / 1000; ctx.strokeStyle = "rgba(186,230,253,.35)"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) { const x = ((i * 97 - t * 500) % VW + VW) % VW, y = ((i * 61 + t * 700) % VH); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 14, y + 22); ctx.stroke(); }
      if (Math.sin(t * 0.7) > 0.985) { ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(0, 0, VW, VH); }
      ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.font = "900 50px sans-serif"; ctx.fillText("DİREKSİYON PİSTİ", kay(0.2, 1000) + 250, 90);
    } else if (s.tema === "durum") {
      for (let x = kay(0.3, 260) - 260; x < VW + 260; x += 260) { ctx.fillStyle = tm.silu; ctx.fillRect(x, 260, 220, 220); ctx.fillStyle = "#facc15"; ctx.fillRect(x + 40, 280, 140, 30); ctx.fillStyle = "#1a2e05"; ctx.font = "900 16px sans-serif"; ctx.fillText("DÜRÜM 100₺", x + 58, 301); }
      ctx.fillStyle = "rgba(132,204,22,.18)"; ctx.font = "900 52px sans-serif"; ctx.fillText("ZEHİRLENDİM ÖLCEM", kay(0.2, 1100) + 220, 90);
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
    if (s.mini) return miniCiz();
    const tm = TEMA[s.tema];
    ctx.save();
    arkaPlan(s, tm);
    const sx = s.sallanma > 0 ? (Math.random() - 0.5) * 10 : 0, sy = s.sallanma > 0 ? (Math.random() - 0.5) * 10 : 0;
    if (s.sv.sarhos) { const t = performance.now() / 1000; ctx.translate(VW / 2, VH / 2); ctx.rotate(Math.sin(t * 1.2) * 0.045); ctx.scale(1 + Math.sin(t * 0.8) * 0.02, 1 + Math.cos(t * 0.9) * 0.02); ctx.translate(-VW / 2, -VH / 2); }
    ctx.translate(-Math.round(s.kamera) + sx, sy);
    kareleriCiz(s, tm);
    // kontrol + bitiş
    for (const k of s.kontrol) { ctx.fillStyle = "#e5e7eb"; ctx.fillRect(k.x + 8, k.y, 4, k.h); ctx.fillStyle = k.aktif ? "#22c55e" : "#ef4444"; ctx.beginPath(); ctx.moveTo(k.x + 12, k.y); ctx.lineTo(k.x + 40, k.y + 12); ctx.lineTo(k.x + 12, k.y + 24); ctx.fill(); }
    if (s.bitis) {
      const f = s.bitis; ctx.fillStyle = "#e5e7eb"; ctx.fillRect(f.x + 18, f.y, 5, f.h);
      if (!gorevTamam()) emoji("🔒", f.x + 46, f.y - 18, 28);
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
    if (s.kacak) {
      const k = s.kacak, g = s.gorev || {};
      ctx.save(); ctx.translate(k.x + k.w / 2, k.y + k.h / 2 + 2); if (k.vx > 0) ctx.scale(-1, 1); emoji(g.emoji || "🏃", 0, 0, 50); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.font = "800 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText(g.ad || "", k.x + k.w / 2, k.y - 8); ctx.textAlign = "left";
      if (k.balon) balonCiz(k.x + k.w / 2, k.y - 18, k.balon.yazi, Math.min(1, k.balon.t * 3));
    }
    if (s.sv.ucus && s.olu <= 0) emoji("🎈", s.p.x + s.p.w / 2 + 4, s.p.y - 26 + Math.sin(performance.now() / 180) * 3, 30);
    if (s.balon && s.olu <= 0) balonCiz(s.p.x + s.p.w / 2, s.p.y - 34, s.balon.yazi, Math.min(1, s.balon.t * 3));
    for (const q of s.parca) { ctx.globalAlpha = Math.min(1, q.t * 2); ctx.fillStyle = q.renk; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (s.sv.karanlik) {
      const px = s.p.x + s.p.w / 2 - Math.round(s.kamera), py = s.p.y + 22;
      const gr = ctx.createRadialGradient(px, py, 50, px, py, 230);
      gr.addColorStop(0, "rgba(3,3,12,0)"); gr.addColorStop(0.6, "rgba(3,3,12,.55)"); gr.addColorStop(1, "rgba(3,3,12,.96)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    }
    if (s.sv.ruzgar) {
      const t = performance.now() / 1000; ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const y = (i * 53) % VH, x = ((i * 211 - t * 900 * (0.6 + (i % 3) * 0.2)) % (VW + 200) + VW + 200) % (VW + 200) - 100; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60 + (i % 4) * 20, y + 4); ctx.stroke(); }
    }
    hudCiz(s);
  }
  function balonCiz(x, y, yazi, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.font = "800 15px sans-serif";
    const g = Math.min(320, ctx.measureText(yazi).width + 22), h = 30, bx = x - g / 2, by = y - h;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(bx, by, g, h, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 7, by + h - 1); ctx.lineTo(x, by + h + 10); ctx.lineTo(x + 7, by + h - 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 7, by + h); ctx.lineTo(x, by + h + 10); ctx.lineTo(x + 7, by + h); ctx.stroke();
    ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.fillText(yazi, x, by + 20, g - 12); ctx.restore();
  }
  function hudCiz(s) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.roundRect(12, 12, 330, 40, 12); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "800 17px ui-monospace, monospace";
    ctx.fillText(`⏱ ${sureYaz(s.sure)}   💀 ${s.olum}   ${s.mini ? s.miniSkor || "" : `${s.sv.topla || "🍔"} ${s.toplanan}/${s.burgerToplam}`}`, 24, 38);
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
    if (s.gorev && !s.bitti) {
      const g = s.gorev; let yazi = "", acil = false;
      if (g.tip === "topla") yazi = s.toplanan >= s.burgerToplam ? "✅ Hepsi tamam, çıkışa koş" : `Görev: ${s.sv.topla || "🍔"} ${s.toplanan}/${s.burgerToplam} topla`;
      else if (g.tip === "sure") { yazi = `⏰ ${s.kalan.toFixed(1)} sn`; acil = s.kalan < 10; }
      else if (g.tip === "hayatta") yazi = s.hayattaBitti ? "✅ Bayrak açıldı" : `⏳ Hayatta kal: ${Math.floor(s.hayatta)}/${g.sure} sn`;
      else if (g.tip === "kovala" && s.kacak) { const m = Math.max(0, Math.round((s.kacak.x - s.p.x) / 40)); yazi = `${g.emoji || "🏃"} ${g.ad}'i yakala · ${m} m önde`; }
      if (yazi) {
        ctx.font = g.tip === "sure" ? "900 26px ui-monospace, monospace" : "800 18px sans-serif"; ctx.textAlign = "center";
        const gw = ctx.measureText(yazi).width + 30, y = 82;
        ctx.fillStyle = acil ? (Math.floor(performance.now() / 250) % 2 ? "rgba(220,38,38,.95)" : "rgba(127,29,29,.95)") : "rgba(0,0,0,.55)";
        ctx.beginPath(); ctx.roundRect(VW / 2 - gw / 2, y - 24, gw, 36, 14); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(yazi, VW / 2, y + 2); ctx.textAlign = "left";
      }
    }
    if ((s.boss && !s.boss.olu) || (s.gorev && s.gorev.tip === "hayatta" && !s.hayattaBitti)) {
      const kalan = (s.toplanan + s.ekstra - s.atilan), y = s.boss ? 100 : 128, yazi = `Z ile ${s.sv.topla || "🍔"} fırlatabilirsin · elinde ${kalan}`;
      ctx.font = "800 16px sans-serif"; ctx.textAlign = "center"; const g = ctx.measureText(yazi).width + 28;
      ctx.fillStyle = kalan > 0 ? "rgba(234,179,8,.92)" : "rgba(63,63,70,.85)"; ctx.beginPath(); ctx.roundRect(VW / 2 - g / 2, y - 18, g, 28, 14); ctx.fill();
      ctx.fillStyle = kalan > 0 ? "#1c1917" : "#fff"; ctx.fillText(yazi, VW / 2, y + 1); ctx.textAlign = "left";
    }
    if (s.mesaj) { ctx.globalAlpha = Math.min(1, s.mesaj.t * 2); ctx.fillStyle = "#fff"; ctx.font = "900 30px sans-serif"; ctx.textAlign = "center"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 6; ctx.strokeText(s.mesaj.yazi, VW / 2, 150); ctx.fillText(s.mesaj.yazi, VW / 2, 150); ctx.textAlign = "left"; ctx.globalAlpha = 1; }
    if (s.olu > 0) { ctx.fillStyle = `rgba(0,0,0,${0.5 - s.olu * 0.3})`; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = "#fff"; ctx.font = "900 34px sans-serif"; ctx.textAlign = "center"; ctx.fillText("💀 " + (s.sonNeden || "Öldün"), VW / 2, VH / 2); if (s.olumSozu) { ctx.font = "italic 800 20px sans-serif"; ctx.fillStyle = "#fde68a"; ctx.fillText(`Berkay: "${s.olumSozu}"`, VW / 2, VH / 2 + 40); } ctx.textAlign = "left"; }
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
      const ip = el("p", "mc-ipucu", S.sv.ipucu ? S.sv.ipucu : S.oto ? (S.sv.motor ? "Motor kendi gidiyor: sadece ZIPLA (Boşluk / ⬆ / ekrandaki tuş)." : "Durmadan koşuyorsun: sadece ZIPLA (Boşluk / ⬆ / ekrandaki tuş).") : "← → ile yürü, Boşluk / ⬆ ile zıpla. Düşmanların kafasına zıpla.");
      k.append(ip, dugme("▶ Başla", ekranTamam, true));
    } else if (tip === "bitti") {
      k.append(el("small", "mc-etiket", "BÖLÜM BİTTİ"), el("h2", null, `🏁 ${S.sv.ad}`));
      const ist = el("div", "mc-ist");
      ist.append(kutu("Süre", sureYaz(veri.sure)), kutu(S.mini ? "Deneme" : "Ölüm", S.mini ? S.olum + 1 : S.olum), S.mini ? kutu("Skor", S.miniSkor || "") : kutu(S.sv.topla ? "Toplanan " + S.sv.topla : "Burger", `${S.toplanan}/${S.burgerToplam}`));
      k.append(ist);
      if (veri.enIyi) k.append(el("p", "mc-rekor", "⭐ Kendi rekorun!"));
      k.append(el("p", "mc-ipucu", `Berkay: "${rastgele(S.sv.bitisSoz || SOZ.genel)}"`));
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
    if (ekran === "giris" || ekran === "durdu") { sesAc(); ekran = null; katman.hidden = true; sonZaman = performance.now(); ziplaBasildi = atBasildi = solBasildi = sagBasildi = false; sayiBasildi = 0; tik = null; muzikCal(S.boss && !S.boss.olu ? "boss" : S.sv.muzik || S.tema); }
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
  // eski 11 bölümlük ilerlemeden açılan bölüm sayısını taşı
  try { if (!localStorage.getItem("macera_kayit2") && localStorage.getItem("macera_kayit")) { const e = JSON.parse(localStorage.getItem("macera_kayit")); localStorage.setItem("macera_kayit2", JSON.stringify({ acik: Math.min(SEV.length, e.acik || 1) })); } } catch { /* yok */ }
  function kayitOku() { try { return JSON.parse(localStorage.getItem("macera_kayit2") || "{}"); } catch { return {}; } }
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
    try { skorlar = (await db.collection("macera_skor2").get()).docs.map((d) => d.data()); } catch { skorlar = []; }
    if (!S) secimCiz(); else siralamaCiz();
  }
  async function skorGonder(bolum, sure, olum, burger) {
    if (!profile || typeof db === "undefined" || !db) return;
    const id = profile.uid + "_" + bolum;
    const eski = skorlar.find((x) => x.uid === profile.uid && x.bolum === bolum);
    if (eski && eski.sure <= sure) return;
    try {
      await db.collection("macera_skor2").doc(id).set({ uid: profile.uid, ad: profile.kullaniciAdi, bolum, sure, olum, burger, tarih: firebase.firestore.FieldValue.serverTimestamp() });
      skorlar = skorlar.filter((x) => !(x.uid === profile.uid && x.bolum === bolum)).concat([{ uid: profile.uid, ad: profile.kullaniciAdi, bolum, sure, olum, burger }]);
      const lider = skorlar.filter((x) => x.bolum === bolum).sort((a, b) => a.sure - b.sure)[0];
      if (lider && lider.uid === profile.uid && window.Ekonomi) Ekonomi.toast(`👑 ${SEV[bolum - 1].ad} bölümünde grup rekoru senin!`, 4000);
    } catch (e) { console.warn("skor:", e.message); }
  }
  if (window.YaparmiAuth) YaparmiAuth.onChange((p) => { profile = p; $("mcGiris").hidden = !!p; });
  $("mcSifirla").addEventListener("click", () => { if (confirm("Bu cihazdaki ilerlemen (açılan bölümler ve en iyi sürelerin) silinsin mi? Sıralamadaki süreler kalır.")) { localStorage.removeItem("macera_kayit2"); secimCiz(); } });
  secimCiz();
  skorlariYukle();
  const h = location.hash.match(/^#bolum(\d+)$/);
  if (h) { const n = Number(h[1]) - 1; if (n >= 0 && n < SEV.length && n + 1 <= (kayitOku().acik || 1)) bolumBaslat(n); }
})();
