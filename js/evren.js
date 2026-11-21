// ============================================================
// evren.js — "Berkay Evreni": yukarıdan bakılan canlı mahalle (evren.html).
// Herkes kendi avatarıyla dolaşır; o an sitede olanları canlı görürsün, yazınca kafanın üstünde balon çıkar.
// Binalara girince sitenin ilgili bölümü açılır. Haritada fotoğraftaki Berkay (NPC) dolaşıp laf atar.
//
// Ağ: hareket ve sohbet kişiler arasında DOĞRUDAN gider (WebRTC veri kanalı), Firestore'a yazılmaz.
// Firestore sadece: evren/{uid} (kim burada, 45 sn'de bir "buradayım" + kaba konum) ve
// evren_sinyal/{a_b} (iki kişinin bağlantı kurmak için bir kez değiştirdiği teklif/cevap).
// Doğrudan bağlantı kurulamayan kişi (bazı mobil hatlar) yine görünür ama 45 sn'de bir zıplar.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const T = 32, MW = 60, MH = 40, DW = MW * T, DH = MH * T;
  const HIZ = 190, KALP_MS = 45000, ESKI_MS = 130000;
  const AVATARLAR = ["😎", "🐻", "🦊", "🐸", "🐼", "🐵", "🦁", "🐷", "🤖", "👽", "🐔", "🦄", "🐶", "🐱", "💀", "🤡"];
  const EMOJI = ["👋", "😂", "💀", "🔥", "❤️", "🤡", "🍔", "🏍️"];
  const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

  // ---------- harita ----------
  const BINALAR = [
    { ad: "Kumarhane", ikon: "🎰", x: 5, y: 4, w: 11, h: 8, renk: "#4c1d95", cati: "#7c3aed", link: "/kumarhane", kapi: "alt" },
    { ad: "Borsa", ikon: "📈", x: 18, y: 5, w: 8, h: 7, renk: "#1e3a8a", cati: "#3b82f6", link: "/borsa", kapi: "alt" },
    { ad: "Berkaypedia Kütüphanesi", ikon: "📖", x: 34, y: 4, w: 10, h: 8, renk: "#78350f", cati: "#b45309", link: "/topluluk#wiki", kapi: "alt" },
    { ad: "Kâhin Çadırı", ikon: "🔮", x: 47, y: 5, w: 8, h: 7, renk: "#701a75", cati: "#c026d3", link: "/", kapi: "alt", cadir: true },
    { ad: "Mez4 Deposu", ikon: "📦", x: 3, y: 24, w: 14, h: 10, renk: "#374151", cati: "#6b7280", link: "/macera", kapi: "ust", yazi: "MEZ4" },
    { ad: "Spor Salonu", ikon: "⚽", x: 19, y: 25, w: 8, h: 7, renk: "#065f46", cati: "#10b981", link: "/spor", kapi: "ust" },
    { ad: "Galeri", ikon: "🖼️", x: 34, y: 25, w: 8, h: 7, renk: "#9f1239", cati: "#f43f5e", link: "/galeri", kapi: "ust" },
    { ad: "Topluluk Meydanı Kulübü", ikon: "📊", x: 45, y: 24, w: 10, h: 7, renk: "#854d0e", cati: "#eab308", link: "/topluluk", kapi: "ust" },
  ];
  BINALAR.forEach((b) => {
    const kx = b.x + Math.floor(b.w / 2) - 1;
    b.kapiR = { x: kx * T, y: (b.kapi === "alt" ? b.y + b.h : b.y - 1) * T, w: 2 * T, h: T };
  });
  const SU = { x: 48, y: 33, w: 9, h: 5 };
  const yolMu = (c, r) => (r >= 17 && r <= 19) || (c >= 28 && c <= 30) || (r >= 15 && r <= 21 && c >= 25 && c <= 33);
  const meydanMu = (c, r) => r >= 15 && r <= 21 && c >= 25 && c <= 33;
  // ağaçlar: sabit tohumlu rastgele
  const AGACLAR = [];
  (function () {
    let t = 12345; const rnd = () => ((t = (t * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 400 && AGACLAR.length < 70; i++) {
      const c = 1 + Math.floor(rnd() * (MW - 2)), r = 1 + Math.floor(rnd() * (MH - 2));
      if (yolMu(c, r) || r === 16 || r === 20 || c === 27 || c === 31) continue;
      if (BINALAR.some((b) => c >= b.x - 1 && c <= b.x + b.w && r >= b.y - 2 && r <= b.y + b.h + 1)) continue;
      if (c >= SU.x - 1 && c <= SU.x + SU.w && r >= SU.y - 1 && r <= SU.y + SU.h) continue;
      if (AGACLAR.some((a) => Math.abs(a.c - c) < 2 && Math.abs(a.r - r) < 2)) continue;
      AGACLAR.push({ c, r, tur: rnd() < 0.7 ? "🌳" : "🌲" });
    }
  })();
  // çarpışma kutuları
  const ENGEL = [];
  BINALAR.forEach((b) => ENGEL.push({ x: b.x * T, y: b.y * T, w: b.w * T, h: b.h * T }));
  AGACLAR.forEach((a) => ENGEL.push({ x: a.c * T + 8, y: a.r * T + 14, w: 16, h: 14 }));
  ENGEL.push({ x: SU.x * T, y: SU.y * T, w: SU.w * T, h: SU.h * T });
  ENGEL.push({ x: 28.5 * T, y: 17.5 * T, w: 2 * T, h: 2 * T }); // çeşme
  const carpar = (x, y) => x < T || y < T || x > DW - T || y > DH - T || ENGEL.some((e) => x + 10 > e.x && x - 10 < e.x + e.w && y + 4 > e.y && y - 8 < e.y + e.h);

  // statik haritayı bir kez çiz
  const harita = document.createElement("canvas"); harita.width = DW; harita.height = DH;
  (function () {
    const g = harita.getContext("2d");
    for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
      const x = c * T, y = r * T;
      if (meydanMu(c, r)) { g.fillStyle = (c + r) % 2 ? "#d6d3d1" : "#e7e5e4"; }
      else if (yolMu(c, r)) g.fillStyle = "#52525b";
      else g.fillStyle = (c * 7 + r * 13) % 5 === 0 ? "#65a30d" : "#6fb52b";
      g.fillRect(x, y, T, T);
      if (!yolMu(c, r) && (c * 31 + r * 17) % 11 === 0) { g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x + 10, y + 12, 3, 6); g.fillRect(x + 18, y + 8, 3, 6); }
    }
    // yol şeritleri
    g.fillStyle = "#facc15";
    for (let c = 0; c < MW; c += 2) if (!meydanMu(c, 18)) g.fillRect(c * T + 6, 18 * T + 14, 20, 4);
    for (let r = 0; r < MH; r += 2) if (!meydanMu(29, r)) g.fillRect(29 * T + 14, r * T + 6, 4, 20);
    // kaldırım
    g.fillStyle = "#a8a29e";
    for (let c = 0; c < MW; c++) { if (!meydanMu(c, 16)) g.fillRect(c * T, 16 * T + 26, T, 6); if (!meydanMu(c, 20)) g.fillRect(c * T, 20 * T, T, 6); }
    // çeşme
    g.fillStyle = "#78716c"; g.beginPath(); g.arc(29.5 * T, 18.5 * T, 44, 0, 7); g.fill();
    g.fillStyle = "#38bdf8"; g.beginPath(); g.arc(29.5 * T, 18.5 * T, 36, 0, 7); g.fill();
    g.fillStyle = "#e0f2fe"; g.beginPath(); g.arc(29.5 * T, 18.5 * T, 10, 0, 7); g.fill();
    // göl
    g.fillStyle = "#0ea5e9"; g.beginPath(); g.ellipse((SU.x + SU.w / 2) * T, (SU.y + SU.h / 2) * T, SU.w * T / 2, SU.h * T / 2, 0, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse((SU.x + SU.w / 2 - 1) * T, (SU.y + SU.h / 2 - 0.6) * T, 40, 10, 0, 0, 7); g.fill();
    // binalar
    BINALAR.forEach((b) => {
      const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 8, y + 10, w, h);
      if (b.cadir) {
        g.fillStyle = b.renk; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + h); g.fill();
        g.fillStyle = b.cati; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + (i * w) / 5, y + h); g.lineTo(x + ((i + 0.5) * w) / 5, y + h); g.fill(); }
      } else {
        g.fillStyle = b.renk; g.fillRect(x, y, w, h);
        g.fillStyle = b.cati; g.fillRect(x, y, w, 22);
        g.fillStyle = "rgba(255,255,255,.18)";
        for (let wy = y + 36; wy < y + h - 30; wy += 36) for (let wx = x + 16; wx < x + w - 24; wx += 34) g.fillRect(wx, wy, 20, 18);
      }
      // kapı
      const k = b.kapiR; g.fillStyle = "#1c1917"; g.fillRect(k.x + 8, b.kapi === "alt" ? y + h - 30 : y, k.w - 16, 30);
      g.fillStyle = "#fbbf24"; g.fillRect(k.x + k.w / 2 + 6, b.kapi === "alt" ? y + h - 16 : y + 14, 4, 4);
      // tabela
      g.font = "800 15px system-ui, sans-serif"; g.textAlign = "center";
      const tw = g.measureText(b.ikon + " " + b.ad).width + 20;
      g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x + w / 2 - tw / 2, y + 30, tw, 24);
      g.fillStyle = "#fff"; g.fillText(b.ikon + " " + b.ad, x + w / 2, y + 47);
      if (b.yazi) { g.font = "900 44px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.2)"; g.fillText(b.yazi, x + w / 2, y + h / 2 + 34); }
      g.textAlign = "left";
    });
    // ağaçlar
    g.font = "30px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    AGACLAR.forEach((a) => g.fillText(a.tur, a.c * T + 16, a.r * T + 12));
    g.fillText("🦆", (SU.x + 3) * T, (SU.y + 2.5) * T);
    // meydan tabelası
    g.font = "800 14px system-ui, sans-serif"; g.fillStyle = "#44403c"; g.fillText("BERKAY MEYDANI", 29.5 * T, 15.4 * T);
  })();

  // ---------- durum ----------
  let profile = null, ben = null, avatar = "😎";
  try { avatar = localStorage.getItem("evren_avatar") || AVATARLAR[Math.floor(Math.random() * AVATARLAR.length)]; } catch { /* yok */ }
  const kisiler = new Map(); // uid → {ad, avatar, x, y, hx, hy, balon, emo, durum, pc, kanal, sonPoz}
  const cv = $("evTuval"), ctx = cv.getContext("2d");
  let kam = { x: 0, y: 0 }, hedef = null, kapiYakin = null;
  const tus = {};
  const NPC = { ad: "Berkay (NPC)", x: 30 * T, y: 22 * T, hx: 30 * T, hy: 22 * T, balon: null, sonLaf: 0, img: new Image() };
  NPC.img.src = "/images/karakter.webp";
  const NPC_LAF = ["Kasksız 85'i gören var mı?", "Burger ısmarlayan?", "Ehliyet sınavı yarın (5. deneme)", "Mez4'e geç kaldım yine", "Borsa çöktü mü?", "Rulette 36x vurdum (yalan)", "KPSS'ye çalışıyorum (yatıyorum)", "Kâhin bana kötü şeyler söyledi", "Bu şehirde kask zorunlu mu?", "Halil nerde aq"];

  // ---------- boyut ----------
  function boyut() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv._w = r.width; cv._h = r.height;
  }
  addEventListener("resize", boyut);

  // ---------- giriş ----------
  const YON = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  addEventListener("keydown", (e) => {
    if (document.activeElement === $("evYazi")) { if (e.key === "Escape") $("evYazi").blur(); return; }
    if (YON[e.code]) { tus[e.code] = true; hedef = null; e.preventDefault(); }
    if (e.key === "Enter") { e.preventDefault(); $("evYazi").focus(); }
    if (e.code === "KeyE" && kapiYakin) gir(kapiYakin);
    const n = Number(e.key); if (n >= 1 && n <= EMOJI.length) emoGonder(EMOJI[n - 1]);
  });
  addEventListener("keyup", (e) => { delete tus[e.code]; });
  addEventListener("blur", () => { for (const k in tus) delete tus[k]; });
  cv.addEventListener("pointerdown", (e) => {
    const r = cv.getBoundingClientRect(), wx = e.clientX - r.left + kam.x, wy = e.clientY - r.top + kam.y;
    // NPC'ye tıklandıysa laf etsin
    if (Math.hypot(wx - NPC.x, wy - (NPC.y - 20)) < 30) { npcKonus(); return; }
    // binanın kapısına / kendisine tıklandıysa oraya yürü
    hedef = { x: wx, y: wy };
  });

  // ---------- oyun döngüsü ----------
  let son = performance.now(), sonPozGonder = 0;
  function dongu(t) {
    requestAnimationFrame(dongu);
    const dt = Math.min(0.05, (t - son) / 1000); son = t;
    if (!ben) return ciz(t);
    // hareket
    let dx = 0, dy = 0;
    for (const k in tus) if (YON[k]) { dx += YON[k][0]; dy += YON[k][1]; }
    if (!dx && !dy && hedef) {
      const hx = hedef.x - ben.x, hy = hedef.y - ben.y, d = Math.hypot(hx, hy);
      if (d < 6) hedef = null; else { dx = hx / d; dy = hy / d; }
    }
    const L = Math.hypot(dx, dy);
    ben.hareket = L > 0;
    if (L > 0) {
      dx /= L; dy /= L;
      const nx = ben.x + dx * HIZ * dt, ny = ben.y + dy * HIZ * dt;
      if (!carpar(nx, ben.y)) ben.x = nx; else if (hedef) hedef = null;
      if (!carpar(ben.x, ny)) ben.y = ny; else if (hedef && !carpar(nx, ben.y)) hedef = null;
      if (dx) ben.yon = dx > 0 ? 1 : -1;
      ben.adim += dt * 10;
    }
    // konumu eşlere gönder (10/sn, sadece değişince)
    if (t - sonPozGonder > 100 && (ben.x !== ben.gx || ben.y !== ben.gy)) {
      sonPozGonder = t; ben.gx = ben.x; ben.gy = ben.y;
      yayinla({ t: "poz", x: Math.round(ben.x), y: Math.round(ben.y), yon: ben.yon });
    }
    // kapı yakınlığı
    const yakin = BINALAR.find((b) => { const k = b.kapiR; return ben.x > k.x - 20 && ben.x < k.x + k.w + 20 && ben.y > k.y - 30 && ben.y < k.y + k.h + 30; });
    if (yakin !== kapiYakin) { kapiYakin = yakin; kapiGoster(); }
    // başkalarını yumuşakça hedef konuma kaydır
    kisiler.forEach((k) => { const f = Math.min(1, dt * (k.kanal && k.kanal.readyState === "open" ? 12 : 3)); const ex = k.x, ey = k.y; k.x += (k.hx - k.x) * f; k.y += (k.hy - k.y) * f; k.hareket = Math.hypot(k.x - ex, k.y - ey) > 0.3; if (k.hareket) k.adim = (k.adim || 0) + dt * 10; });
    npcGuncelle(dt, t);
    sesGuncelle();
    // kamera
    kam.x = Math.max(0, Math.min(DW - cv._w, ben.x - cv._w / 2));
    kam.y = Math.max(0, Math.min(DH - cv._h, ben.y - cv._h / 2));
    if (DW < cv._w) kam.x = (DW - cv._w) / 2;
    ciz(t);
  }
  function npcGuncelle(dt, t) {
    const d = Math.hypot(NPC.hx - NPC.x, NPC.hy - NPC.y);
    if (d < 4) {
      if (!NPC.bekle) NPC.bekle = 1 + Math.random() * 3;
      NPC.bekle -= dt;
      if (NPC.bekle <= 0) {
        NPC.bekle = 0;
        for (let i = 0; i < 20; i++) { const x = (2 + Math.random() * (MW - 4)) * T, y = (2 + Math.random() * (MH - 4)) * T; if (!carpar(x, y) && Math.hypot(x - NPC.x, y - NPC.y) < 9 * T) { NPC.hx = x; NPC.hy = y; break; } }
      }
    } else {
      const nx = NPC.x + ((NPC.hx - NPC.x) / d) * 90 * dt, ny = NPC.y + ((NPC.hy - NPC.y) / d) * 90 * dt;
      if (carpar(nx, ny)) { NPC.hx = NPC.x; NPC.hy = NPC.y; } else { NPC.yon = nx > NPC.x ? 1 : -1; NPC.x = nx; NPC.y = ny; NPC.adim = (NPC.adim || 0) + dt * 8; }
    }
    if (ben && Math.hypot(ben.x - NPC.x, ben.y - NPC.y) < 90 && t - NPC.sonLaf > 9000) npcKonus();
    if (NPC.balon && t > NPC.balon.bitis) NPC.balon = null;
  }
  function npcKonus() { NPC.sonLaf = performance.now(); NPC.balon = { yazi: NPC_LAF[Math.floor(Math.random() * NPC_LAF.length)], bitis: performance.now() + 4500 }; }

  // ---------- çizim ----------
  function ciz(t) {
    const w = cv._w || 0, h = cv._h || 0;
    if (!w) return;
    ctx.fillStyle = "#3f6212"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(harita, kam.x, kam.y, w, h, 0, 0, w, h);
    ctx.save(); ctx.translate(-kam.x, -kam.y);
    // kapı vurgusu
    if (kapiYakin) { const k = kapiYakin.kapiR; ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.strokeRect(k.x, k.y, k.w, k.h); ctx.setLineDash([]); }
    if (hedef) { ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hedef.x, hedef.y, 8 + Math.sin(t / 150) * 2, 0, 7); ctx.stroke(); }
    // y sırasına göre çiz (arkadaki önce)
    const hepsi = [...kisiler.values()].map((k) => ({ ...k, _k: k }));
    if (ben) hepsi.push({ ...ben, _ben: true });
    hepsi.push({ _npc: true, x: NPC.x, y: NPC.y });
    hepsi.sort((a, b) => a.y - b.y);
    for (const k of hepsi) { if (k._npc) npcCiz(t); else avatarCiz(k._ben ? ben : k._k, k._ben, t); }
    ctx.restore();
  }
  function emojiYaz(e, x, y, boyut) { ctx.font = `${boyut}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e, x, y); }
  function avatarCiz(k, benim, t) {
    const bob = k.hareket ? Math.abs(Math.sin((k.adim || 0))) * 3 : 0;
    const uzak = !benim && !(k.kanal && k.kanal.readyState === "open");
    ctx.globalAlpha = uzak ? 0.6 : 1;
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(k.x, k.y + 2, 13, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = benim ? "#fff" : "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(k.x, k.y - 18 - bob, 17, 0, 7); ctx.fill();
    const konusuyor = benim ? mik.konusuyor : k.konusuyor;
    if (konusuyor) { ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 4 + Math.sin(t / 80) * 1.5; ctx.stroke(); }
    else if (benim) { ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 3; ctx.stroke(); }
    emojiYaz(k.avatar || "🙂", k.x, k.y - 17 - bob, 24);
    // isim
    ctx.font = "800 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const ad = (benim ? "sen" : k.ad || "?") + ((benim ? mik.acik : k.mik) ? " 🎙️" : "") + (uzak ? " 📶" : "");
    const tw = ctx.measureText(ad).width + 10;
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.roundRect(k.x - tw / 2, k.y + 6, tw, 17, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(ad, k.x, k.y + 19);
    ctx.globalAlpha = 1;
    if (k.emo && t < k.emo.bitis) { const p = 1 - (k.emo.bitis - t) / 2000; emojiYaz(k.emo.e, k.x, k.y - 50 - p * 30, 28); }
    if (k.balon && t < k.balon.bitis) balonCiz(k.x, k.y - 44 - bob, k.balon.yazi);
  }
  function npcCiz(t) {
    const bob = Math.hypot(NPC.hx - NPC.x, NPC.hy - NPC.y) > 4 ? Math.abs(Math.sin(NPC.adim || 0)) * 3 : 0;
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(NPC.x, NPC.y + 2, 16, 6, 0, 0, 7); ctx.fill();
    if (NPC.img.complete) { ctx.save(); ctx.translate(NPC.x, NPC.y - bob); ctx.scale(NPC.yon || 1, 1); ctx.drawImage(NPC.img, -26, -54, 52, 54); ctx.restore(); }
    ctx.font = "800 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const tw = ctx.measureText("Berkay 🤖").width + 10;
    ctx.fillStyle = "rgba(124,58,237,.85)"; ctx.beginPath(); ctx.roundRect(NPC.x - tw / 2, NPC.y + 6, tw, 17, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText("Berkay 🤖", NPC.x, NPC.y + 19);
    if (NPC.balon) balonCiz(NPC.x, NPC.y - 60 - bob, NPC.balon.yazi);
  }
  function balonCiz(x, y, yazi) {
    ctx.font = "700 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    // satırlara böl (en fazla 180 px)
    const kelime = String(yazi).split(" "), satir = []; let s = "";
    for (const k of kelime) { const d = s ? s + " " + k : k; if (ctx.measureText(d).width > 180 && s) { satir.push(s); s = k; } else s = d; }
    if (s) satir.push(s);
    const w = Math.min(200, Math.max(...satir.map((x) => ctx.measureText(x).width)) + 18), h = satir.length * 16 + 10;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 6, y); ctx.fill();
    ctx.fillStyle = "#111"; satir.forEach((l, i) => ctx.fillText(l, x, y - h + 18 + i * 16));
  }

  // ---------- kapılar ----------
  function kapiGoster() {
    const k = $("evKapi");
    if (!kapiYakin) { k.hidden = true; return; }
    k.hidden = false; k.textContent = "";
    k.append(el("span", null, `${kapiYakin.ikon} ${kapiYakin.ad}`));
    const b = el("button", "btn", "Gir →"); b.type = "button"; b.addEventListener("click", () => gir(kapiYakin));
    k.append(b, el("small", "muted", "(E)"));
  }
  function gir(b) {
    try { localStorage.setItem("evren_konum", JSON.stringify({ x: Math.round(ben.x), y: Math.round(ben.y + (b.kapi === "alt" ? 40 : -40)) })); } catch { /* yok */ }
    ayril();
    location.href = b.link;
  }

  // ---------- sohbet + emoji ----------
  $("evForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const y = $("evYazi").value.trim().slice(0, 140);
    if (!y || !ben) return;
    ben.balon = { yazi: y, bitis: performance.now() + 6000 };
    yayinla({ t: "msg", yazi: y });
    logaYaz("sen", y);
    $("evYazi").value = ""; $("evYazi").blur();
  });
  $("evMik").addEventListener("click", mikDegistir);
  $("evSesAc").addEventListener("click", sesleriAc);
  addEventListener("keydown", (e) => { if (e.code === "KeyM" && document.activeElement !== $("evYazi")) mikDegistir(); });
  cv.addEventListener("pointerdown", () => { if (!$("evSesAc").hidden) sesleriAc(); });
  const emoKutu = $("evEmojiler");
  EMOJI.forEach((e, i) => { const b = el("button", null, e); b.type = "button"; b.title = `${e} (${i + 1})`; b.addEventListener("click", () => emoGonder(e)); emoKutu.append(b); });
  function emoGonder(e) { if (!ben) return; ben.emo = { e, bitis: performance.now() + 2000 }; yayinla({ t: "emo", e }); }
  function logaYaz(ad, yazi) {
    const l = $("evLog"); const s = el("div"); s.append(el("b", null, ad + ": "), document.createTextNode(yazi)); l.append(s);
    while (l.children.length > 30) l.firstChild.remove();
    l.scrollTop = l.scrollHeight;
  }
  // avatar seçimi
  const avKutu = $("evAvatarlar");
  AVATARLAR.forEach((a) => { const b = el("button", a === avatar ? "on" : null, a); b.type = "button"; b.addEventListener("click", () => { avatar = a; try { localStorage.setItem("evren_avatar", a); } catch { /* yok */ } avKutu.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); if (ben) { ben.avatar = a; yayinla({ t: "bilgi", ad: profile.kullaniciAdi, avatar: a }); kalpAt(); } }); avKutu.append(b); });

  // ---------- ağ: varlık (Firestore) ----------
  let kalpZaman = null, varlikDinle = null, sinyalDinle = null;
  async function kalpAt() {
    if (!ben || !profile) return;
    try { await db.collection("evren").doc(profile.uid).set({ ad: profile.kullaniciAdi, avatar, x: Math.round(ben.x), y: Math.round(ben.y), son: firebase.firestore.FieldValue.serverTimestamp() }); } catch (e) { console.warn("evren:", e.message); }
  }
  function katil() {
    let konum = null; try { konum = JSON.parse(localStorage.getItem("evren_konum") || "null"); } catch { /* yok */ }
    let x = konum ? konum.x : 29.5 * T + (Math.random() - 0.5) * 6 * T, y = konum ? konum.y : 21.5 * T;
    if (carpar(x, y)) { x = 26 * T; y = 21 * T; }
    ben = { x, y, gx: 0, gy: 0, yon: 1, adim: 0, avatar };
    kalpAt();
    kalpZaman = setInterval(kalpAt, KALP_MS);
    varlikDinle = db.collection("evren").onSnapshot((s) => {
      const simdi = Date.now(), gorulen = new Set();
      s.docs.forEach((d) => {
        if (d.id === profile.uid) return;
        const v = d.data(), sonMs = v.son && v.son.toMillis ? v.son.toMillis() : 0;
        if (simdi - sonMs > ESKI_MS) return;
        gorulen.add(d.id);
        let k = kisiler.get(d.id);
        if (!k) { k = { uid: d.id, ad: v.ad, avatar: v.avatar, x: v.x, y: v.y, hx: v.x, hy: v.y, durum: "yeni" }; kisiler.set(d.id, k); logaYaz("🌍", `${v.ad} evrene girdi`); baglan(k); const bt = bekleyenTeklif[d.id]; if (bt) { delete bekleyenTeklif[d.id]; teklifGeldi(bt.id, bt.v); } }
        k.ad = v.ad; k.avatar = v.avatar;
        if (!(k.kanal && k.kanal.readyState === "open")) { k.hx = v.x; k.hy = v.y; }
      });
      kisiler.forEach((k, uid) => { if (!gorulen.has(uid)) { kapat(k); kisiler.delete(uid); logaYaz("🌍", `${k.ad} ayrıldı`); } });
      listeCiz();
    }, (e) => console.warn("evren dinleme:", e.message));
    sinyalDinle = db.collection("evren_sinyal").where("kime", "==", profile.uid).onSnapshot((s) => s.docs.forEach((d) => teklifGeldi(d.id, d.data())), (e) => console.warn("sinyal:", e.message));
    listeCiz();
  }
  function ayril() {
    clearInterval(kalpZaman);
    if (varlikDinle) varlikDinle();
    if (sinyalDinle) sinyalDinle();
    kisiler.forEach(kapat);
    if (profile) db.collection("evren").doc(profile.uid).delete().catch(() => {});
  }
  addEventListener("pagehide", ayril);

  // ---------- ağ: WebRTC (doğrudan bağlantı) ----------
  const ciftId = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
  function iceBitir(pc) {
    return new Promise((coz) => {
      if (pc.iceGatheringState === "complete") return coz();
      const z = setTimeout(coz, 3000);
      pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(z); coz(); } });
    });
  }
  function kanalKur(k, kanal) {
    k.kanal = kanal;
    kanal.onopen = () => {
      k.durum = "canli";
      kanal.send(JSON.stringify({ t: "bilgi", ad: profile.kullaniciAdi, avatar }));
      kanal.send(JSON.stringify({ t: "poz", x: Math.round(ben.x), y: Math.round(ben.y), yon: ben.yon }));
      if (mik.akis) { sesEkle(k); kanal.send(JSON.stringify({ t: "mik", acik: mik.acik })); }
      listeCiz();
    };
    kanal.onclose = () => { k.durum = "uzak"; listeCiz(); };
    kanal.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === "poz") { k.hx = Number(m.x) || k.hx; k.hy = Number(m.y) || k.hy; }
      else if (m.t === "msg") { const y = String(m.yazi || "").slice(0, 140); k.balon = { yazi: y, bitis: performance.now() + 6000 }; logaYaz(k.ad, y); }
      else if (m.t === "emo") { if (EMOJI.includes(m.e)) k.emo = { e: m.e, bitis: performance.now() + 2000 }; }
      else if (m.t === "bilgi") { if (AVATARLAR.includes(m.avatar)) k.avatar = m.avatar; listeCiz(); }
      else if (m.t === "mik") { k.mik = !!m.acik; listeCiz(); }
      else if (m.t === "sdp" || m.t === "ice") yenidenAnlas(k, m);
    };
  }
  // Bağlantı kurulduktan sonraki pazarlıklar (mikrofon eklenince vb.) Firestore'a değil veri kanalına gider.
  // "Kibar eş" yöntemi: iki taraf aynı anda teklif ederse büyük uid'li olan geri çekilir.
  function pcHazirla(k, pc) {
    k.kibar = profile.uid > k.uid; k.teklifte = false; k.yoksay = false;
    pc.ontrack = (e) => sesBagla(k, e.streams[0] || new MediaStream([e.track]));
    pc.onnegotiationneeded = async () => {
      if (!(k.kanal && k.kanal.readyState === "open")) return; // ilk bağlantı Firestore üzerinden yapılır
      try { k.teklifte = true; await pc.setLocalDescription(); k.kanal.send(JSON.stringify({ t: "sdp", d: pc.localDescription })); }
      catch (e) { console.warn("pazarlık:", e.message); } finally { k.teklifte = false; }
    };
    pc.onicecandidate = (e) => { if (e.candidate && k.kanal && k.kanal.readyState === "open") k.kanal.send(JSON.stringify({ t: "ice", c: e.candidate })); };
  }
  async function yenidenAnlas(k, m) {
    const pc = k.pc; if (!pc) return;
    try {
      if (m.t === "sdp") {
        const d = m.d, cakisma = d.type === "offer" && (k.teklifte || pc.signalingState !== "stable");
        k.yoksay = !k.kibar && cakisma;
        if (k.yoksay) return;
        await pc.setRemoteDescription(d);
        if (d.type === "offer") { await pc.setLocalDescription(); k.kanal.send(JSON.stringify({ t: "sdp", d: pc.localDescription })); }
      } else if (m.c) {
        try { await pc.addIceCandidate(m.c); } catch (e) { if (!k.yoksay) console.warn("ice:", e.message); }
      }
    } catch (e) { console.warn("yeniden anlaşma:", e.message); }
  }

  // ---------- sesli sohbet (yakınlık) ----------
  // Yakındakini tam duyarsın (≈4 kare), uzaklaştıkça kısılır, ≈15 kareden sonra duyulmaz.
  const mik = { akis: null, acik: false, analiz: null, konusuyor: false };
  let sesBaglam = null;
  const baglamAl = () => { try { sesBaglam = sesBaglam || new (window.AudioContext || window.webkitAudioContext)(); if (sesBaglam.state === "suspended") sesBaglam.resume(); } catch { /* yok */ } return sesBaglam; };
  function analizKur(akis) {
    const b = baglamAl(); if (!b) return null;
    try { const a = b.createAnalyser(); a.fftSize = 256; b.createMediaStreamSource(akis).connect(a); return { a, veri: new Uint8Array(a.frequencyBinCount) }; } catch { return null; }
  }
  const sesDuzeyi = (an) => { if (!an) return 0; an.a.getByteFrequencyData(an.veri); let t = 0; for (let i = 2; i < 40; i++) t += an.veri[i]; return t / 38; };
  function sesBagla(k, akis) {
    if (k.sesEl && k.sesEl.srcObject === akis) return;
    if (!k.sesEl) { k.sesEl = new Audio(); k.sesEl.autoplay = true; k.sesEl.playsInline = true; }
    k.sesEl.srcObject = akis;
    k.sesEl.volume = 0;
    k.sesEl.play().catch(() => { $("evSesAc").hidden = false; });
    k.analiz = analizKur(akis);
  }
  function sesEkle(k) {
    if (!mik.akis || !k.pc || k.sesGonderen) return;
    try { k.sesGonderen = k.pc.addTrack(mik.akis.getAudioTracks()[0], mik.akis); } catch (e) { console.warn("ses ekle:", e.message); }
  }
  async function mikDegistir() {
    const b = $("evMik");
    if (!mik.akis) {
      try {
        mik.akis = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) { logaYaz("🎙️", "Mikrofona izin verilmedi."); return; }
      mik.analiz = analizKur(mik.akis);
      kisiler.forEach(sesEkle);
    }
    mik.acik = !mik.acik;
    mik.akis.getAudioTracks().forEach((t) => (t.enabled = mik.acik));
    b.classList.toggle("on", mik.acik); b.textContent = mik.acik ? "🎙️" : "🔇"; b.title = mik.acik ? "Mikrofonu kapat" : "Mikrofonu aç";
    yayinla({ t: "mik", acik: mik.acik });
    baglamAl(); sesleriAc();
    listeCiz();
  }
  function sesleriAc() { kisiler.forEach((k) => { if (k.sesEl) k.sesEl.play().catch(() => {}); }); $("evSesAc").hidden = true; baglamAl(); }
  function sesGuncelle() {
    kisiler.forEach((k) => {
      if (!k.sesEl || !ben) return;
      const d = Math.hypot(k.x - ben.x, k.y - ben.y);
      const v = d < 130 ? 1 : d > 480 ? 0 : 1 - (d - 130) / 350;
      k.sesEl.volume = Math.max(0, Math.min(1, v * v));
      k.konusuyor = k.mik && sesDuzeyi(k.analiz) > 18;
    });
    mik.konusuyor = mik.acik && sesDuzeyi(mik.analiz) > 18;
  }
  async function baglan(k, deneme = 0) {
    if (!(profile.uid < k.uid)) { k.durum = "bekliyor"; return; } // teklifi küçük uid'li taraf yapar
    k.durum = "baglaniyor"; listeCiz();
    const pc = new RTCPeerConnection(ICE); k.pc = pc; k.sesGonderen = null;
    pcHazirla(k, pc);
    kanalKur(k, pc.createDataChannel("evren"));
    pc.onconnectionstatechange = () => izle(k, pc, deneme);
    await pc.setLocalDescription(await pc.createOffer());
    await iceBitir(pc);
    const id = ciftId(profile.uid, k.uid), t = Date.now();
    k.teklifT = t;
    await db.collection("evren_sinyal").doc(id).set({ kimden: profile.uid, kime: k.uid, offer: JSON.stringify(pc.localDescription), answer: null, t });
    const dur = db.collection("evren_sinyal").doc(id).onSnapshot(async (s) => {
      const v = s.data();
      if (!v || v.t !== t || !v.answer || pc.currentRemoteDescription) return;
      dur();
      try { await pc.setRemoteDescription(JSON.parse(v.answer)); } catch (e) { console.warn("cevap:", e.message); }
    });
    k.sinyalDur = dur;
  }
  const islenen = {}, bekleyenTeklif = {};
  async function teklifGeldi(id, v) {
    if (!v.offer || v.answer || islenen[id] === v.t) return;
    const k = kisiler.get(v.kimden);
    if (!k) { bekleyenTeklif[v.kimden] = { id, v }; return; } // kişinin varlık kaydı gelince işlenir
    islenen[id] = v.t;
    if (k.pc) try { k.pc.close(); } catch { /* yok */ }
    const pc = new RTCPeerConnection(ICE); k.pc = pc; k.sesGonderen = null; k.durum = "baglaniyor"; listeCiz();
    pcHazirla(k, pc);
    pc.ondatachannel = (e) => kanalKur(k, e.channel);
    pc.onconnectionstatechange = () => izle(k, pc, 0);
    await pc.setRemoteDescription(JSON.parse(v.offer));
    await pc.setLocalDescription(await pc.createAnswer());
    await iceBitir(pc);
    try { await db.collection("evren_sinyal").doc(id).update({ answer: JSON.stringify(pc.localDescription) }); } catch (e) { console.warn("cevap yaz:", e.message); }
  }
  function izle(k, pc, deneme) {
    if (pc !== k.pc) return;
    if (pc.connectionState === "connected") { k.durum = "canli"; listeCiz(); }
    if (pc.connectionState === "failed") {
      k.durum = "uzak"; listeCiz();
      if (deneme < 2 && kisiler.has(k.uid)) setTimeout(() => { if (kisiler.has(k.uid) && k.pc === pc) baglan(k, deneme + 1); }, 4000 + deneme * 4000);
    }
  }
  function kapat(k) { try { if (k.sinyalDur) k.sinyalDur(); if (k.pc) k.pc.close(); if (k.sesEl) { k.sesEl.pause(); k.sesEl.srcObject = null; } } catch { /* yok */ } }
  function yayinla(m) { const s = JSON.stringify(m); kisiler.forEach((k) => { if (k.kanal && k.kanal.readyState === "open") try { k.kanal.send(s); } catch { /* yok */ } }); }

  // ---------- liste ----------
  function listeCiz() {
    const l = $("evListe"); l.textContent = "";
    const n = kisiler.size + (ben ? 1 : 0);
    $("evSayi").textContent = n ? `${n} kişi evrende` : "";
    if (ben) { const s = el("div", "ev-kisi ben"); s.append(el("span", null, avatar), el("b", null, profile.kullaniciAdi + " (sen)" + (mik.acik ? " 🎙️" : ""))); l.append(s); }
    kisiler.forEach((k) => {
      const s = el("div", "ev-kisi");
      s.append(el("span", null, k.avatar || "🙂"), el("b", null, k.ad + (k.mik ? " 🎙️" : "")), el("small", "ev-durum " + (k.durum || ""), { canli: "🟢 canlı", baglaniyor: "🟡 bağlanıyor", bekliyor: "🟡 bağlanıyor", uzak: "⚪ yavaş bağlantı", yeni: "🟡" }[k.durum] || ""));
      s.addEventListener("click", () => { hedef = { x: k.x, y: k.y + 30 }; });
      l.append(s);
    });
    if (!kisiler.size) l.append(el("p", "muted ev-yalniz", "Şu an evrende senden başka kimse yok. Berkay (NPC) sana eşlik ediyor 🤖"));
  }

  // ---------- başlat ----------
  boyut();
  requestAnimationFrame(dongu);
  if (typeof db === "undefined" || !db) { $("evGiris").hidden = false; $("evGiris").textContent = "Şu an bağlı değil."; return; }
  window.YaparmiAuth.onChange((p) => {
    const ilk = !profile && p;
    profile = p;
    $("evGiris").hidden = !!p;
    $("evPanel").hidden = !p;
    if (ilk) { boyut(); katil(); }
  });
})();
