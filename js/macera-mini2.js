// macera-mini2.js — Berkay: The Game, 31-50. bölümlerin oyunları.
// macera.js'teki motoru window.MACERA_EK(A) üzerinden kullanır (çizim, ses, girişler, ol/bitir, anlatıcı).
window.MACERA_EK = function (A) {
  "use strict";
  const { ctx, VW, VH, G, emoji, yazi, yuvarlak, berkayCiz, karistir, rastgele, soyle, ol, bitir, SES, bip, gurultu, parcaPatla, anlat, mesaj, salla, yuzCiz } = A;
  const icinde = (p, r) => !!p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const kenar = (x, a, b) => Math.max(a, Math.min(b, x));
  const uzak = (a, b, c, d) => Math.hypot(a - c, b - d);
  const simdi = () => performance.now() / 1000;
  function zemin(r1, r2) { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, r1); g.addColorStop(1, r2); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
  function bar(x, y, w, h, oran, renk, arka = "rgba(255,255,255,.15)") { yuvarlak(x, y, w, h, h / 2, arka); if (oran > 0) yuvarlak(x, y, Math.max(h, w * Math.min(1, oran)), h, h / 2, renk); }
  function kalpler(n, max, x, y, dolu = "❤️", bos = "🖤") { for (let i = 0; i < max; i++) emoji(i < n ? dolu : bos, x + i * 30, y, 24); }
  function dugmeCiz(r, metin, renk = "#334155", secili, font = "800 19px sans-serif") {
    yuvarlak(r.x, r.y, r.w, r.h, 14, renk);
    if (secili) { ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.stroke(); }
    yazi(metin, r.x + r.w / 2, r.y + r.h / 2 + 7, font);
  }
  function sarYaz(t, x, y, maxW, satirH, font, renk = "#fff") { ctx.font = font; const s = A.satirSar(t, maxW); s.forEach((l, i) => yazi(l, x, y + i * satirH, font, renk)); return y + s.length * satirH; }
  const onay = () => G.sec || G.at || G.zipla;
  // dokunuşu yöne çevir (labirent, D100)
  const tikYon = (t, x, y) => { const dx = t.x - x, dy = t.y - y; return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; };
  const M = {};

  // =========================================================
  // 31) Sayım Hatası: banttan geçeni say
  // =========================================================
  M.sayim = {
    HAVUZ: ["📦", "🎁", "🧻", "🧸", "📚", "🥤"],
    KUTU: { eksi: { x: 300, y: 300, w: 90, h: 80 }, arti: { x: 570, y: 300, w: 90, h: 80 }, tamam: { x: 400, y: 410, w: 160, h: 60 } },
    kur() { const o = { r: 0, hata: 0, gorevli: 2 }; M.sayim.tur(o); return o; },
    tur(o) {
      const r = o.r, H = M.sayim.HAVUZ;
      o.hedef = r >= 4 ? ["📦", "🧸"] : [r === 0 ? "📦" : rastgele(["📦", "🧻", "🧸"])];
      const n = 12 + r * 4, cift = r >= 3, x0 = [VW + 40, VW + 40];
      o.esya = [];
      for (let i = 0; i < n; i++) {
        const serit = cift && Math.random() < 0.5 ? 1 : 0;
        const e = Math.random() < 0.42 ? rastgele(o.hedef) : rastgele(H.filter((h) => !o.hedef.includes(h)));
        o.esya.push({ e, x: x0[serit], serit });
        x0[serit] += (r >= 2 ? 62 : 75) + Math.random() * (r >= 2 ? 70 : 110);
      }
      o.dogru = o.esya.filter((q) => o.hedef.includes(q.e)).length;
      o.hiz = 170 + r * 32; o.cevap = 0; o.faz = "bak"; o.sure = 12; o.sonuc = null;
    },
    guncelle(s, o, dt) {
      s.konus = { x: 150, y: 430 };
      if (o.faz === "sonuc") { o.bekle -= dt; if (o.bekle <= 0) { if (o.r >= 6) { mesaj("📦 Sayım tuttu! Koliler bir kere indi", 2.4); return bitir(); } M.sayim.tur(o); } return; }
      if (o.faz === "bak") {
        let son = -1e9;
        for (const q of o.esya) { q.x -= o.hiz * (q.serit ? 1.35 : 1) * dt; son = Math.max(son, q.x); }
        o.gorevli -= dt;
        if (o.r >= 1 && o.gorevli <= 0) { o.gorevli = 1.6 + Math.random() * 1.8; soyle(`Görevli: "${3 + Math.floor(Math.random() * 25)}!"`, 1.1); }
        if (son < -50) { o.faz = "cevap"; o.sure = 10; }
        return;
      }
      const K = M.sayim.KUTU, t = G.tik;
      if (G.sol || icinde(t, K.eksi)) o.cevap = Math.max(0, o.cevap - 1);
      if (G.sag || icinde(t, K.arti)) o.cevap = Math.min(60, o.cevap + 1);
      for (const [k, d] of [["sag", 1], ["sol", -1]]) {
        if (G.tus[k]) { o["t" + k] = (o["t" + k] || 0) + dt; if (o["t" + k] > 0.35) { o["r" + k] = (o["r" + k] || 0) - dt; if (o["r" + k] <= 0) { o["r" + k] = 0.06; o.cevap = kenar(o.cevap + d, 0, 60); } } }
        else o["t" + k] = 0;
      }
      o.sure -= dt;
      if (G.sec || G.at || icinde(t, K.tamam) || o.sure <= 0) {
        o.faz = "sonuc"; o.bekle = 1.6;
        if (o.cevap === o.dogru) {
          o.r++; o.sonuc = `✅ Doğru: ${o.dogru}`; SES.burger();
          if (o.r === 3) anlat("Bant ikiye çıktı. Alttaki daha hızlı akıyor.");
          if (o.r === 4) anlat("Şimdi iki şeyi birlikte say: 📦 ve 🧸.");
        } else {
          o.hata++; o.sonuc = `❌ ${o.cevap} değil, ${o.dogru} tane vardı`; salla(0.2); bip(200, 90, 0.35, "sawtooth", 0.1);
          if (o.hata >= 3) return ol("Sayı yanlış, kolileri 3. kez indir");
        }
      }
    },
    ciz(s, o) {
      zemin("#1e2433", "#3b4458");
      for (let i = 0; i < 6; i++) { ctx.fillStyle = "#2a3142"; ctx.fillRect(40 + i * 160, 110, 120, 130); for (let j = 0; j < 3; j++) emoji("📦", 70 + i * 160 + j * 30, 220, 26); }
      const cift = o.r >= 3 && o.faz === "bak";
      for (const y of cift ? [300, 400] : [330]) {
        ctx.fillStyle = "#111827"; ctx.fillRect(0, y - 34, VW, 68);
        ctx.fillStyle = "#374151"; for (let x = -((performance.now() / 6) % 40); x < VW; x += 40) ctx.fillRect(x, y + 30, 20, 4);
      }
      if (o.faz === "bak") for (const q of o.esya) emoji(q.e, q.x, cift ? (q.serit ? 400 : 300) : 330, 50);
      yuvarlak(VW / 2 - 170, 100, 340, 48, 14, "rgba(0,0,0,.6)");
      yazi(`Say: ${o.hedef.join(" + ")}`, VW / 2, 133, "900 26px sans-serif", "#fde68a");
      emoji("📹", 870, 450, 44); yazi("Kurban çekiyor", 870, 490, "700 13px sans-serif", "#cbd5e1");
      berkayCiz(150, 500, 110);
      if (o.faz !== "bak") {
        ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(0, 160, VW, 330);
        yazi("Kaç tane geçti?", VW / 2, 225, "800 24px sans-serif");
        const K = M.sayim.KUTU;
        dugmeCiz(K.eksi, "−", "#475569", false, "900 34px sans-serif"); dugmeCiz(K.arti, "+", "#475569", false, "900 34px sans-serif");
        yazi(String(o.cevap), VW / 2, 365, "900 64px ui-monospace,monospace");
        if (o.faz === "cevap") { dugmeCiz(K.tamam, "TAMAM", "#16a34a"); yazi(`${Math.ceil(o.sure)} sn`, VW / 2 + 140, 447, "800 16px sans-serif", "#fca5a5"); }
        if (o.sonuc) yazi(o.sonuc, VW / 2, 268, "900 26px sans-serif", o.sonuc.startsWith("✅") ? "#4ade80" : "#fca5a5");
      }
      kalpler(3 - o.hata, 3, VW - 110, 130);
    },
    skor: (o) => `🔢 ${o.r}/6`,
    gorev: (o) => (o.faz === "bak" ? `Banttan geçen ${o.hedef.join(" ve ")} sayısını say` : "← → ayarla · Boşluk / Z / TAMAM"),
  };

  // =========================================================
  // 32) Lahmacun Sonrası: Kurban bakmıyorken gazı bırak
  // =========================================================
  M.gaz = {
    SURE: 45,
    kur: () => ({ t: 0, basinc: 15, faz: "ders", fazT: 3, yakalan: 0, tut: 0, puf: [], sonuc: null, sonucT: 0, yakalandi: false, sesli: false, sesT: 0 }),
    vur(o, neden) {
      o.yakalan++; o.yakalandi = true; o.sonuc = neden; o.sonucT = 1.5; salla(0.3); bip(180, 60, 0.4, "sawtooth", 0.12);
      if (o.yakalan >= 3) ol("Kurban bayıldı. Berkay: 'Tamam gidiyom ben eve'");
    },
    guncelle(s, o, dt) {
      o.t += dt; s.konus = { x: 270, y: 300 };
      const basili = G.tus.zipla || G.tus.at || G.imlec.bas;
      o.fazT -= dt;
      if (o.fazT <= 0) {
        if (o.faz === "ders") { o.faz = "kipir"; o.fazT = Math.max(0.4, 0.85 - o.t * 0.008); bip(420, 420, 0.06, "triangle", 0.05); }
        else if (o.faz === "kipir") { o.faz = "bakiyor"; o.fazT = 0.9 + Math.random() * 1.6; }
        else { o.faz = "ders"; o.fazT = Math.max(1, 3 - o.t * 0.035) + Math.random() * 1.8; }
      }
      o.basinc += dt * (7 + o.t * 0.3);
      if (o.sonucT > 0) o.sonucT -= dt;
      if (basili) {
        o.tut += dt; o.basinc = Math.max(0, o.basinc - dt * 60);
        o.sesT -= dt; if (o.sesT <= 0) { o.sesT = 0.09; gurultu(0.08, o.tut > 0.8 ? 0.12 : 0.04, 160); }
        if (Math.random() < dt * 25) o.puf.push({ x: 255 + Math.random() * 30, y: 430, t: 1.4, vx: 20 + Math.random() * 50 });
        if (!o.yakalandi && o.faz === "bakiyor") return M.gaz.vur(o, "😳 Kurban gördü! 'Burnumun direği sikildi'");
        if (!o.sesli && o.tut > 1.1) { o.sesli = true; if (!o.yakalandi) return M.gaz.vur(o, "📢 PRRRT! Bütün kütüphane duydu"); }
      } else { o.tut = 0; o.sesli = false; o.yakalandi = false; }
      for (const p of o.puf) { p.t -= dt; p.x += p.vx * dt; p.y -= 30 * dt; }
      o.puf = o.puf.filter((p) => p.t > 0);
      if (o.basinc >= 100) return ol("Lahmacun patladı, kütüphane boşaltıldı");
      if (o.t >= M.gaz.SURE) { mesaj("🤫 Kütüphane kapandı, kimse anlamadı!", 2.4); return bitir(); }
      if (o.t > 15 && !o.a15) { o.a15 = true; anlat("Kurban burnunu çekti. Şüpheleniyor mu?"); }
      if (o.t > 30 && !o.a30) { o.a30 = true; anlat("Son 15 saniye. Lahmacun son gücünü topluyor."); }
    },
    ciz(s, o) {
      zemin("#2e1a47", "#4c2a6e");
      const RENK = ["#b91c1c", "#1d4ed8", "#15803d", "#a16207"];
      for (let i = 0; i < 8; i++) { ctx.fillStyle = "#3a2357"; ctx.fillRect(i * 125, 96, 110, 190); for (let j = 0; j < 4; j++) for (let k = 0; k < 6; k++) { ctx.fillStyle = RENK[(i + j + k) % 4]; ctx.fillRect(i * 125 + 8 + k * 16, 104 + j * 46, 12, 38); } }
      yuvarlak(120, 400, 720, 30, 8, "#92613f"); ctx.fillStyle = "#5b3a29"; ctx.fillRect(150, 430, 20, 100); ctx.fillRect(790, 430, 20, 100);
      berkayCiz(270, 410, 120); emoji("📐", 360, 390, 30);
      const yuz = o.faz === "ders" ? "😐" : o.faz === "kipir" ? "🤨" : "😳";
      ctx.save(); if (o.faz === "bakiyor") { ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 30; } emoji(yuz, 640, 340, 90); ctx.restore();
      emoji("📕", 640, 398, 40); yazi("Kurban", 640, 280, "800 16px sans-serif", "#e9d5ff");
      if (o.faz === "kipir") yazi("!", 700, 300, "900 46px sans-serif", "#facc15");
      if (o.faz === "bakiyor") { emoji("👀", 560, 310, 40); yazi("BAKIYOR!", 640, 252, "900 22px sans-serif", "#f87171"); }
      for (const p of o.puf) { ctx.globalAlpha = Math.min(0.6, p.t * 0.45); ctx.fillStyle = "#a3e635"; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + (1.4 - p.t) * 22, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      yuvarlak(40, 130, 46, 300, 14, "rgba(0,0,0,.5)");
      const h = 290 * Math.min(1, o.basinc / 100);
      yuvarlak(45, 425 - h, 36, h, 10, o.basinc > 80 ? "#ef4444" : o.basinc > 55 ? "#f59e0b" : "#84cc16");
      emoji("🌯", 63, 455, 34); yazi("Basınç", 63, 122, "800 13px sans-serif");
      yazi(`Kapanışa ${Math.max(0, M.gaz.SURE - o.t).toFixed(0)} sn`, VW - 120, 140, "900 22px sans-serif", "#fde68a");
      for (let i = 0; i < 3; i++) emoji(i < o.yakalan ? "💥" : "💨", VW - 156 + i * 36, 178, 26);
      if (G.tus.zipla || G.tus.at || G.imlec.bas) yazi(o.tut > 0.8 ? "Çok uzun! Bırak!" : "pssst…", 270, 268, "900 22px sans-serif", o.tut > 0.8 ? "#f87171" : "#bef264");
      if (o.sonucT > 0 && o.sonuc) yazi(o.sonuc, VW / 2, 488, "900 24px sans-serif", "#fca5a5");
    },
    skor: (o) => `💨 ${Math.floor(o.t)}/45 sn`,
    gorev: (o) => (o.faz === "bakiyor" ? "Kurban bakıyor, BIRAKMA!" : "Basınç dolunca basılı tut, kısa kısa bırak"),
  };

  // =========================================================
  // 33) 4'lü Masa: kütüphane labirenti
  // =========================================================
  const LAB = [
    "#####################",
    "#C....#.......#....C#",
    "#.##.##.#####.##.##.#",
    "#.#.............K.#.#",
    "#.#.##.###.###.##.#.#",
    "#......#..G..#......#",
    "#.#.##.###.###.##.#.#",
    "#.#.K.............#.#",
    "#.##.##.#####.##.##.#",
    "#C....#...P...#....C#",
    "#####################",
  ];
  const HAYALET = [{ ad: "Görevli", e: "🧑‍💼", tip: "kovala" }, { ad: "Alihan", e: "🧥", tip: "rastgele" }, { ad: "Burger", e: "🍔", tip: "pusu" }];
  M.labirent = {
    H: 40, OX: 60, OY: 98, anlatKendi: true,
    kur() {
      const k = LAB.map((r) => r.split(""));
      const o = { k, t: 0, son: 70, kitap: 0, sandalye: 0, guc: 0, istek: null, hay: [] };
      let ev = null;
      k.forEach((r, y) => r.forEach((c, x) => { if (c === "P") { o.p = { x, y, dx: 0, dy: 0, i: 0 }; r[x] = " "; } if (c === "G") { ev = { x, y }; r[x] = " "; } }));
      o.ev = ev;
      o.hay = HAYALET.map((h, j) => ({ ...h, x: ev.x, y: ev.y, dx: 0, dy: 0, i: 0, bekle: 1 + j * 2.5 }));
      return o;
    },
    acik(o, x, y) { const r = o.k[y]; return !!r && r[x] !== undefined && r[x] !== "#"; },
    adim(o, b, hiz, dt, sec) {
      if (!b.dx && !b.dy) { const d = sec(b); if (!d) return; b.dx = d[0]; b.dy = d[1]; b.i = 0; }
      b.i += hiz * dt;
      while (b.i >= 1) {
        b.x += b.dx; b.y += b.dy; b.i -= 1;
        if (b.varis) b.varis();
        const d = sec(b);
        if (!d) { b.dx = b.dy = 0; b.i = 0; break; }
        b.dx = d[0]; b.dy = d[1];
      }
    },
    guncelle(s, o, dt) {
      const L = M.labirent, H = L.H;
      o.t += dt; o.son -= dt; o.guc = Math.max(0, o.guc - dt);
      if (o.son <= 0) return ol("07:00 oldu, herkes geldi, 4'lü masa kapıldı");
      const p = o.p, px = p.x + p.dx * p.i, py = p.y + p.dy * p.i;
      s.konus = { x: L.OX + px * H + H / 2, y: L.OY + py * H + 10 };
      const d = G.yon(); if (d) o.istek = d;
      if (G.tus.sol) o.istek = [-1, 0]; if (G.tus.sag) o.istek = [1, 0]; if (G.tus.zipla) o.istek = [0, -1]; if (G.tus.asagi || G.tus.at) o.istek = [0, 1];
      if (G.tik) o.istek = tikYon(G.tik, L.OX + px * H + H / 2, L.OY + py * H + H / 2);
      // geri dönüş anında
      if (o.istek && (p.dx || p.dy) && o.istek[0] === -p.dx && o.istek[1] === -p.dy) { p.x += p.dx; p.y += p.dy; p.dx = -p.dx; p.dy = -p.dy; p.i = 1 - p.i; }
      p.varis = () => {
        const c = o.k[p.y][p.x];
        if (c === ".") { o.k[p.y][p.x] = " "; o.kitap++; if (o.kitap % 6 === 0) bip(900, 900, 0.03, "square", 0.04); }
        else if (c === "K") { o.k[p.y][p.x] = " "; o.guc = 5; SES.kontrol(); soyle("Alihan'ın kahve hakkı benim", 1.4); }
        else if (c === "C") {
          o.k[p.y][p.x] = "✓"; o.sandalye++; SES.burger(); mesaj(`🪑 ${o.sandalye}/4 sandalyeye kitap kondu`, 1.4);
          if (o.sandalye === 2) anlat("Yarısı tutuldu. Kurban: 'Kitap koy dümenden.'");
          if (o.sandalye >= 4) { mesaj("📚 4'lü masa İbo'nun!", 2.4); o.bitti = true; }
        }
      };
      L.adim(o, p, 5.4, dt, (b) => {
        if (o.istek && L.acik(o, b.x + o.istek[0], b.y + o.istek[1])) return o.istek;
        if ((b.dx || b.dy) && L.acik(o, b.x + b.dx, b.y + b.dy)) return [b.dx, b.dy];
        return null;
      });
      if (o.bitti) return bitir();
      for (const h of o.hay) {
        if (h.bekle > 0) { h.bekle -= dt; continue; }
        const hiz = o.guc > 0 ? 2.6 : Math.min(5, 3.7 + o.t * 0.02);
        L.adim(o, h, hiz, dt, (b) => {
          const yonler = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((y) => L.acik(o, b.x + y[0], b.y + y[1]));
          let aday = yonler.filter((y) => !(y[0] === -b.dx && y[1] === -b.dy && (b.dx || b.dy)));
          if (!aday.length) aday = yonler;
          if (!aday.length) return null;
          if (h.tip === "rastgele" && Math.random() < 0.55 && o.guc <= 0) return rastgele(aday);
          let tx = p.x, ty = p.y;
          if (h.tip === "pusu") { tx += p.dx * 3; ty += p.dy * 3; }
          const puan = (y) => (b.x + y[0] - tx) ** 2 + (b.y + y[1] - ty) ** 2;
          aday.sort((a, c) => (o.guc > 0 ? puan(c) - puan(a) : puan(a) - puan(c)));
          return aday[0];
        });
        const hx = h.x + h.dx * h.i, hy = h.y + h.dy * h.i;
        if (uzak(hx, hy, p.x + p.dx * p.i, p.y + p.dy * p.i) < 0.65) {
          if (o.guc > 0) { h.x = o.ev.x; h.y = o.ev.y; h.dx = h.dy = 0; h.i = 0; h.bekle = 3; SES.ez(); soyle(`${h.ad} kaçtı!`, 1.2); }
          else return ol(`${h.ad} yakaladı: "Sessiz ol!"`);
        }
      }
    },
    ciz(s, o) {
      const L = M.labirent, H = L.H;
      zemin("#1c1030", "#2e1a47");
      A.anlatYaz(300);
      const zaman = simdi();
      o.k.forEach((r, y) => r.forEach((c, x) => {
        const X = L.OX + x * H, Y = L.OY + y * H;
        if (c === "#") { yuvarlak(X + 2, Y + 2, H - 4, H - 4, 8, "#4c1d95"); ctx.fillStyle = "#6d28d9"; ctx.fillRect(X + 8, Y + 8, H - 16, 4); }
        else if (c === ".") { ctx.fillStyle = ["#f87171", "#60a5fa", "#4ade80"][(x + y) % 3]; ctx.fillRect(X + H / 2 - 4, Y + H / 2 - 6, 8, 12); }
        else if (c === "K") emoji("☕", X + H / 2, Y + H / 2 + Math.sin(zaman * 4) * 2, 26);
        else if (c === "C") emoji("🪑", X + H / 2, Y + H / 2, 30);
        else if (c === "✓") { emoji("🪑", X + H / 2, Y + H / 2, 30); emoji("📚", X + H / 2, Y + H / 2 - 8, 22); }
      }));
      for (const h of o.hay) { const hx = L.OX + (h.x + h.dx * h.i) * H + H / 2, hy = L.OY + (h.y + h.dy * h.i) * H + H / 2; emoji(o.guc > 0 ? (o.guc < 1.5 && Math.floor(zaman * 8) % 2 ? h.e : "😱") : h.e, hx, hy, 32); }
      const p = o.p;
      yuzCiz("ibo", L.OX + (p.x + p.dx * p.i) * H + H / 2, L.OY + (p.y + p.dy * p.i) * H + H / 2, 16, "🤓");
      const dk = 5 * 60 + 17 + Math.floor((70 - Math.max(0, o.son)) / 70 * 103);
      yazi(`🕔 ${String(Math.floor(dk / 60)).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`, 470, 552, "900 20px ui-monospace,monospace", o.son < 15 ? "#f87171" : "#fde68a");
      if (o.guc > 0) yazi(`☕ ${o.guc.toFixed(1)}`, 590, 552, "900 18px sans-serif", "#fde68a", "left");
    },
    skor: (o) => `🪑 ${o.sandalye}/4 · 📚 ${o.kitap}`,
    gorev: () => "4 köşedeki sandalyeye kitap koy · görevliye yakalanma",
  };

  // =========================================================
  // 34) Tuzla Lunapark: go-kart
  // =========================================================
  const PIST = (() => {
    const P = [[150, 150], [420, 112], [700, 122], [850, 200], [862, 360], [760, 462], [600, 450], [520, 338], [420, 338], [330, 460], [160, 466], [88, 320]];
    const out = [], n = P.length, ADIM = 20;
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < ADIM; k++) {
        const t = k / ADIM, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    return out;
  })();
  const PN = PIST.length;
  const PSEG = PIST.reduce((a, p, i) => a + uzak(p[0], p[1], PIST[(i + 1) % PN][0], PIST[(i + 1) % PN][1]), 0) / PN;
  const PNOKTA = (u) => { const i = Math.floor(u) % PN, f = u - Math.floor(u), a = PIST[i], b = PIST[(i + 1) % PN]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
  M.gokart = {
    GEN: 92, PAD: [55, 128, 196], PIST,
    kur() {
      const [x, y, a] = PNOKTA(2);
      return { t: -2.4, ben: { x: x - Math.sin(a) * 18, y: y + Math.cos(a) * 18, a, v: 0, idx: 2, tur: 0, yari: false, boost: 0 }, ibo: { u: 2 }, say: 3 };
    },
    en(b) { let en = b.idx, ed = 1e9; for (let k = -25; k <= 25; k++) { const i = (b.idx + k + PN) % PN, d = (PIST[i][0] - b.x) ** 2 + (PIST[i][1] - b.y) ** 2; if (d < ed) { ed = d; en = i; } } return [en, Math.sqrt(ed)]; },
    guncelle(s, o, dt) {
      const b = o.ben; o.t += dt; s.konus = { x: b.x, y: b.y - 10 };
      if (o.t < 0) { const k = Math.ceil(-o.t / 0.8); if (k !== o.say) { o.say = k; bip(440, 440, 0.12, "square", 0.1); } return; }
      if (!o.basladi) { o.basladi = true; bip(880, 880, 0.3, "square", 0.12); }
      const don = (G.tus.sag ? 1 : 0) - (G.tus.sol ? 1 : 0) + (G.imlec.bas ? (G.imlec.x > VW / 2 ? 1 : -1) : 0);
      b.a += kenar(don, -1, 1) * 2.8 * dt * Math.min(1, 0.35 + b.v / 260);
      const [idx, d] = M.gokart.en(b);
      const cim = d > M.gokart.GEN / 2;
      b.boost = Math.max(0, b.boost - dt);
      const hedef = cim ? 120 : b.boost > 0 ? 420 : 285;
      b.v += (hedef - b.v) * Math.min(1, dt * (b.v < hedef ? 1.3 : 3));
      b.x = kenar(b.x + Math.cos(b.a) * b.v * dt, 10, VW - 10); b.y = kenar(b.y + Math.sin(b.a) * b.v * dt, 10, VH - 10);
      if (idx > PN * 0.45 && idx < PN * 0.55) b.yari = true;
      if (b.idx > PN * 0.85 && idx < PN * 0.15 && b.yari) {
        b.tur++; b.yari = false; SES.kontrol();
        if (b.tur < 3) { mesaj(b.tur === 2 ? "🏁 SON TUR!" : "2. tur", 1.3); if (b.tur === 2) anlat("Son tur. 3. lig topçusu pistte de 3. olmamalı."); }
      }
      b.idx = idx;
      for (const pi of M.gokart.PAD) { const p = PIST[pi]; if (uzak(b.x, b.y, p[0], p[1]) < 30 && b.boost <= 0.3) { b.boost = 1.3; bip(400, 1200, 0.25, "sawtooth", 0.08); if (Math.random() < 0.4) soyle("Sınırsız deme dayanamam", 1.3); } }
      const benTop = b.tur * PN + idx, ib = o.ibo;
      ib.v = kenar(270 + (benTop - ib.u) * 0.35, 235, 340);
      ib.u += ib.v * dt / PSEG;
      if (b.tur >= 3) { mesaj("🏁 Kazandın! İbo Salon Burger ısmarlıyor", 2.6); return bitir(); }
      if (ib.u >= 3 * PN + 2) return ol("İbo önce bitirdi: 'Salon Burger senden'");
    },
    yol(w, renk, dash) {
      ctx.save(); ctx.lineJoin = ctx.lineCap = "round"; ctx.lineWidth = w; ctx.strokeStyle = renk; if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); PIST.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke(); ctx.restore();
    },
    kartCiz(x, y, a, renk, ben) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = "#111"; ctx.fillRect(-18, -17, 12, 6); ctx.fillRect(8, -17, 12, 6); ctx.fillRect(-18, 11, 12, 6); ctx.fillRect(8, 11, 12, 6);
      yuvarlak(-22, -12, 46, 24, 8, renk); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(14, -8, 6, 16);
      ctx.restore();
      if (ben) berkayCiz(x, y + 10, 34); else yuzCiz("ibo", x, y - 2, 12, "🤓");
    },
    ciz(s, o) {
      zemin("#3f6212", "#4d7c0f");
      emoji("🎡", 480, 240, 90); emoji("🎢", 260, 260, 64); emoji("🎠", 700, 300, 56); emoji("🍿", 640, 260, 30);
      const G2 = M.gokart.GEN;
      M.gokart.yol(G2 + 14, "#f8fafc"); M.gokart.yol(G2 + 14, "#dc2626", [18, 18]); M.gokart.yol(G2, "#52525b"); M.gokart.yol(3, "rgba(255,255,255,.45)", [14, 14]);
      const [sx, sy, sa] = PNOKTA(0);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(sa + Math.PI / 2);
      for (let i = -5; i < 5; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? "#111" : "#fff"; ctx.fillRect(i * 9.2, j * 9 - 9, 9.2, 9); }
      ctx.restore();
      for (const pi of M.gokart.PAD) emoji("⚡", PIST[pi][0], PIST[pi][1], 30);
      const [ix, iy, ia] = PNOKTA(o.ibo.u % PN);
      M.gokart.kartCiz(ix + Math.sin(ia) * 18, iy - Math.cos(ia) * 18, ia, "#2563eb", false);
      const b = o.ben; M.gokart.kartCiz(b.x, b.y, b.a, "#dc2626", true);
      if (b.boost > 0) emoji("🔥", b.x - Math.cos(b.a) * 30, b.y - Math.sin(b.a) * 30, 22);
      yuvarlak(VW - 200, 100, 180, 64, 12, "rgba(0,0,0,.55)");
      yazi(`Sen: ${Math.min(3, b.tur + 1)}/3. tur`, VW - 110, 126, "800 16px sans-serif", "#fca5a5");
      yazi(`İbo: ${Math.min(3, Math.floor(o.ibo.u / PN) + 1)}/3. tur`, VW - 110, 150, "800 16px sans-serif", "#93c5fd");
      if (o.t < 0.6) yazi(o.t < 0 ? String(Math.ceil(-o.t / 0.8)) : "GAZ!", VW / 2, VH / 2, "900 90px sans-serif", "#fde68a");
    },
    skor: (o) => `🏎️ ${Math.min(3, o.ben.tur + 1)}/3`,
    gorev: () => "← → direksiyon · İbo'dan önce 3 tur",
  };

  // =========================================================
  // 35) 30 Gün Hepsiburada: her olayda bir seçim
  // =========================================================
  const OLAY = [
    { e: "⏰", s: "04:40. Servis 04:50'de. Alarm çalıyor.", o: [["Kalk", { e: -4, y: "Kalktın. Has amele." }], ["5 dk daha", { e: 12, sans: 0.45, s: { p: -2600, m: -10, y: "Servis kaçtı, 2 yevmiye gitti" }, y: "Servisi son saniyede yakaladın" }], ["Kubi uyandırsın", { m: -6, e: 2, y: "Kubi: 'Aramayın amk.'" }]] },
    { e: "🍗", s: "Mola. Karnın zil çalıyor.", o: [["Popeyes", { p: -450, e: 16, m: 12, y: "Obez gibi yedin ama fizik sağlam" }], ["Poğaça", { p: -25, e: 8, y: "Poğaça ye yeter" }], ["Aç kal", { e: -6, m: -6, y: "Mide kazındı" }]] },
    { e: "📋", s: "Görevli sayıyı yanlış yazdı. Kolileri 3. kez diz.", o: [["Diz", { e: -14, m: -6, p: 300, y: "Feleğin sikildi ama bitti" }], ["İtiraz et", { m: 8, sans: 0.5, s: { p: -1300, y: "Müdür yevmiyeyi kesti" }, y: "Haklıydın, sayım düzeldi" }], ["Kurban'a yaptır", { m: 10, e: 6, sans: 0.5, s: { m: -18, y: "Kurban videoya çekti: 'Kölem nasıl beğendin mi?'" }, y: "Kurban dizdi, sen izledin" }]] },
    { e: "🍺", s: "Akşam: 'Nazı içicez amk hadi.'", o: [["İç", { p: -800, m: 22, e: -12, y: "Tüm para gitti alkole" }], ["Bir Carlsberg", { p: -150, m: 9, e: -3, y: "Salih'in tavsiyesi: ayıl" }], ["Eve git, uyu", { e: 22, m: -3, y: "10 saat uyudun" }]] },
    { e: "💼", s: "İbo 26.500 TL'lik bir ilan attı.", o: [["'26k napiyim aq'", { m: 10, y: "Burun kıvırdın, gaz geldi" }], ["Başvur", { m: -8, e: 4, sans: 0.3, s: { m: 24, y: "Mülakat çağrısı geldi!" }, y: "Cevap gelmedi" }], ["İbo'yu engelle", { m: 6, y: "İbo ikinci hesaptan yazdı" }]] },
    { e: "🦺", s: "Yeleğin çalındı.", o: [["Yenisini al", { p: -300, m: 2, y: "300 TL yelek" }], ["Başkasınınkini al", { m: 6, sans: 0.35, s: { e: -15, m: -8, y: "Sahibi yakaladı, tartıştınız" }, y: "Kimse fark etmedi" }], ["Yeleksiz çalış", { m: -8, e: -5, y: "Müdür söylendi" }]] },
    { e: "⚽", s: "Salih: 'Halısaha ayarlayın la.'", o: [["Git", { e: -14, m: 22, y: "3. lig topçusu sahada" }], ["Sat", { m: -10, e: 6, y: "Satanlara selam olsun… sen sattın" }], ["Git, 10 gol sözü ver", { e: -18, m: 32, sans: 0.3, s: { e: -22, y: "Sakatlandın, tek kollu oldun" }, y: "10 gol değil ama 3 gol" }]] },
    { e: "🛋️", s: "Hafta sonu. Ücretsiz izin hayali.", o: [["Evde yat", { e: 30, m: 4, y: "2 yıllık tecrübe konuştu" }], ["Kerpe'ye git", { p: -500, m: 24, e: -6, y: "Nazı içildi, deniz görüldü" }], ["FC27 indirimde, al", { p: -1200, m: 28, y: "İspanyollar tanrı gibi" }]] },
    { e: "📚", s: "Kütüphane: KPSS çalışılacak.", o: [["Çalış", { e: -8, m: -2, y: "Bir şeyler öğrendin galiba" }], ["115 dk puan hesapla", { m: 10, y: "İbo gizlice videoya çekti" }], ["Uyu", { e: 18, y: "Kütüphanede deliksiz uyku" }]] },
    { e: "🧑‍💼", s: "Müdür: 'Bugün mesai var.'", o: [["Kal", { e: -18, p: 900, m: -4, y: "Mesai parası geldi" }], ["'Çok iyi' de, kaç", { m: 10, sans: 0.5, s: { p: -1300, y: "Yakalandın, yevmiye kesildi" }, y: "Kimse fark etmedi" }], ["Kibarca reddet", { m: 3, e: 4, y: "Müdür surat astı" }]] },
    { e: "🔋", s: "Şarjın %1.", o: [["'Kapanacak tel' de, kaybol", { m: 10, e: 10, sans: 0.4, s: { p: -1300, m: -6, y: "İşe gelmedin sandılar" }, y: "Kimse aramadı, huzur" }], ["Powerbank al", { p: -350, m: 2, y: "Şarj %100" }], ["Umursama", { m: -5, y: "Gün boyu kapalı telefon" }]] },
    { e: "📊", s: "İbo'nun anketi: 'Berkay kaç gün dayanır?' En çok oy: 3 gün.", o: [["Hırslan", { m: 22, e: -4, y: "Gaza geldin" }], ["'Götüm delinene kadar…'", { m: 16, e: -8, y: "Grup kahkahadan yarıldı" }], ["Gruptan çık", { m: -14, e: 12, y: "Geri eklendin: 'Benim saf bir kalbim var'" }]] },
    { e: "🎂", s: "Doğum günün. Dayının kafesinde kutlama var.", o: [["Kutla", { p: -600, m: 26, y: "Eyw fındıklar" }], ["Pazara ertele", { m: -6, e: 6, y: "İbo: 'Harbi senin doğum günün mü?'" }], ["İbo hediye alsın", { m: 8, sans: 0.6, s: { m: -10, y: "Gelen hediye: çorba gibi bir şey" }, y: "İbo cidden hediye aldı" }]] },
    { e: "🚛", s: "2 tır üst üste geldi.", o: [["Hepsini indir", { e: -24, p: 700, m: 6, y: "Depo şefi övdü" }], ["Yarısı Alihan'a", { e: -10, sans: 0.6, s: { m: -10, y: "Alihan 11'e kadar yatmış, hepsi sana kaldı" }, y: "Alihan bu sefer çalıştı" }], ["Kaytar", { m: 6, e: 8, sans: 0.45, s: { p: -1300, m: -10, y: "Kaytarırken yakalandın" }, y: "Kimse görmedi" }]] },
    { e: "🌊", s: "İbo: 'Acilen Sakarya Aquapark, 1.560 TL.'", o: [["Git", { p: -1560, m: 30, e: -6, y: "Kaydırak, poğaça, mutluluk" }], ["'Labanzubu' de", { m: 4, y: "Kubizm'e katıldın" }], ["Biriktir, 70k lazım", { m: -4, e: 4, y: "70k hayali yaşıyor" }]] },
    { e: "🌯", s: "Lahmacun yedin. Mide bozuk.", o: [["Tuvalete koş", { e: -4, m: 2, y: "Kurtuldun" }], ["Dayan", { m: -8, y: "Vardiya çok uzun geçti" }], ["Kütüphaneye git", { m: 12, y: "Kurban bayılma noktasına geldi" }]] },
    { e: "🔧", s: "Cem: 'Siktir edin depoyu, sanayiye gidin.'", o: [["Dinle", { m: 12, e: -6, y: "Sanayide bir gün denedin" }], ["Depoya devam", { m: -3, e: 2, y: "Has amele yolunda" }], ["Motor tamiri öğren", { p: -200, m: 15, y: "Zanaat öğrendin… biraz" }]] },
    { e: "📱", s: "05:17. İbo: 'Kim kütüphane geliyor?'", o: [["Git", { e: -10, m: 6, y: "4'lü masa kapıldı" }], ["Uyu", { e: 14, y: "İbo 40 mesaj attı" }], ["Sessize al", { m: 4, e: 6, y: "Grup sessizde" }]] },
  ];
  M.dayanik = {
    KUTU: (k) => ({ x: 120 + k * 245, y: 380, w: 230, h: 86 }),
    kur: () => ({ gun: 1, e: 100, m: 70, p: 0, liste: karistir(OLAY).slice(0, 15), i: 0, sec: 0, sonuc: null, sonucT: 0, fark: null }),
    guncelle(s, o, dt) {
      s.konus = { x: 110, y: 440 };
      if (o.sonucT > 0) {
        o.sonucT -= dt;
        if (o.sonucT <= 0) {
          if (o.e <= 0) return ol("Bayıldın. İbo'nun anketi tuttu");
          if (o.m <= 0) return ol("'70k alıp kaçıcam' dedin. 70k yoktu, sadece kaçtın");
          if (o.gun > 30) { mesaj(`📅 30 gün doldu! Kasada ${o.p.toLocaleString("tr-TR")} TL`, 3); return bitir(); }
          o.i++; o.sec = 0; o.sonuc = null;
          if (o.i === 7) anlat("Yarı yol geçildi. Grupta kimse inanmıyor.");
        }
        return;
      }
      const olay = o.liste[o.i];
      if (G.sol) o.sec = (o.sec + 2) % 3;
      if (G.sag) o.sec = (o.sec + 1) % 3;
      let secilen = -1;
      if (G.sayi >= 1 && G.sayi <= 3) secilen = G.sayi - 1;
      for (let k = 0; k < 3; k++) if (icinde(G.tik, M.dayanik.KUTU(k))) secilen = k;
      if (onay()) secilen = o.sec;
      if (secilen < 0) return;
      const ef = olay.o[secilen][1];
      let y = ef.y; const d = { e: ef.e || 0, m: ef.m || 0, p: ef.p || 0 };
      if (ef.sans && Math.random() < ef.sans) { d.e += ef.s.e || 0; d.m += ef.s.m || 0; d.p += ef.s.p || 0; y = ef.s.y; }
      d.e -= 11; d.m -= 6; d.p += 2600;
      o.e = Math.min(100, o.e + d.e); o.m = Math.min(100, o.m + d.m); o.p += d.p; o.gun += 2;
      o.sonuc = y; o.fark = d; o.sonucT = 2; o.sec = secilen; SES.burger();
    },
    ciz(s, o) {
      zemin("#1e2433", "#3b4458");
      const st = [["⚡ Enerji", o.e, "#facc15"], ["🔥 Motivasyon", o.m, "#f472b6"]];
      st.forEach(([ad, v, r], i) => { yazi(ad, 40, 122 + i * 34, "800 15px sans-serif", "#fff", "left"); bar(180, 108 + i * 34, 260, 16, Math.max(0, v) / 100, v < 25 ? "#ef4444" : r); yazi(String(Math.max(0, Math.round(v))), 455, 122 + i * 34, "800 15px sans-serif", "#fff", "left"); });
      yazi(`💸 ${o.p.toLocaleString("tr-TR")} TL`, 40, 190, "900 20px sans-serif", "#4ade80", "left");
      yuvarlak(640, 100, 280, 100, 14, "rgba(0,0,0,.45)");
      yazi(`📅 ${Math.min(30, o.gun)}. GÜN / 30`, 780, 136, "900 26px sans-serif", "#fde68a");
      yazi("İbo'nun anketi: '3 gün dayanır' (%61)", 780, 172, "700 13px sans-serif", "#cbd5e1");
      const olay = o.liste[Math.min(o.i, o.liste.length - 1)];
      yuvarlak(120, 215, 720, 150, 18, "rgba(15,23,42,.85)");
      emoji(olay.e, 190, 290, 64);
      sarYaz(olay.s, 520, 280, 560, 30, "800 22px sans-serif");
      for (let k = 0; k < 3; k++) {
        const r = M.dayanik.KUTU(k), sec = o.sonuc ? k === o.sec : k === o.sec;
        yuvarlak(r.x, r.y, r.w, r.h, 14, sec ? "#1d4ed8" : "#334155");
        if (sec) { ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.stroke(); }
        yazi(String(k + 1), r.x + 18, r.y + 26, "900 15px sans-serif", "#94a3b8");
        sarYaz(olay.o[k][0], r.x + r.w / 2, r.y + 38, r.w - 30, 22, "800 17px sans-serif");
      }
      if (o.sonuc) {
        ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(0, 215, VW, 260);
        sarYaz(o.sonuc, VW / 2, 290, 760, 32, "900 26px sans-serif", "#fde68a");
        const f = o.fark, p = (v) => (v > 0 ? "+" : "") + v;
        yazi(`⚡ ${p(f.e)}   🔥 ${p(f.m)}   💸 ${p(f.p)} TL   (+2 gün)`, VW / 2, 400, "800 20px sans-serif", "#e2e8f0");
      }
      berkayCiz(70, 520, 90);
    },
    skor: (o) => `📅 ${Math.min(30, o.gun)}/30`,
    gorev: () => "Seç: ← → + Boşluk, 1-3 ya da dokun",
  };

  // =========================================================
  // 36) Halısaha 22:00: herkesin "gelcem"ini canlı tut
  // =========================================================
  const KADRO = [["Salih", "🧔", "Mangal var ailecek"], ["Alihan", "🧥", "Başım ağrıyor aga"], ["Kurban", "😳", "6-7'yi ben aldım zaten"], ["Burger", "🎓", "Ev çok uzak aq"], ["İbo", "🤓", "Stajdan çıkamadım"], ["Cem", "🏍️", "8'de işe gidiyorum"], ["Erdem", "🍭", "Yağmur yağıyor"], ["Timur Abi", "👨‍🔧", "6'da işten çıkıyom"]];
  M.kadro = {
    SURE: 45,
    KUTU: (i) => ({ x: 70 + (i % 4) * 210, y: 130 + Math.floor(i / 4) * 175, w: 190, h: 155 }),
    kur: () => ({ t: 0, sec: 0, bekle: 0, olay: 4, kisi: KADRO.map(([ad, e, bahane]) => ({ ad, e, bahane, bar: 75 + Math.random() * 25, hiz: 3.2 + Math.random() * 3.6, sat: false, not: null, notT: 0 })) }),
    guncelle(s, o, dt) {
      o.t += dt; s.konus = { x: VW / 2, y: 120 }; o.bekle = Math.max(0, o.bekle - dt);
      const carpan = 1 + o.t / 35;
      for (const k of o.kisi) {
        k.notT -= dt; if (k.sat) continue;
        k.bar -= k.hiz * carpan * dt;
        if (k.bar < 30 && !k.uyari) { k.uyari = true; k.not = k.bahane; k.notT = 2; }
        if (k.bar <= 0) { k.sat = true; k.bar = 0; k.not = "SATTI"; k.notT = 99; bip(220, 80, 0.4, "sawtooth", 0.1); salla(0.2); soyle(`${k.ad} sattı aq`, 1.6); }
      }
      o.olay -= dt;
      if (o.olay <= 0) { o.olay = 3 + Math.random() * 3; const ad = o.kisi.filter((k) => !k.sat); if (ad.length) { const k = rastgele(ad); k.bar = Math.max(1, k.bar - 35); k.not = k.bahane; k.notT = 2; bip(300, 200, 0.12, "triangle", 0.06); } }
      if (G.sol) o.sec = (o.sec + 7) % 8;
      if (G.sag) o.sec = (o.sec + 1) % 8;
      if (G.zipla && !G.sec) o.sec = (o.sec + 4) % 8;
      let ara = -1;
      if (G.sayi >= 1 && G.sayi <= 8) ara = G.sayi - 1;
      for (let i = 0; i < 8; i++) if (icinde(G.tik, M.kadro.KUTU(i))) ara = i;
      if (G.sec || G.at) ara = o.sec;
      if (ara >= 0 && o.bekle <= 0) {
        o.sec = ara; const k = o.kisi[ara];
        if (k.sat) { k.not = "Telefonu kapalı"; k.notT = 1; }
        else if (k.bar > 65) { k.bar -= 22; k.not = "Aramayın amk"; k.notT = 1.4; o.bekle = 0.4; bip(300, 200, 0.15, "square", 0.08); }
        else { k.bar = 100; k.uyari = false; k.not = "Gelcem gelcem"; k.notT = 1.2; o.bekle = 0.55; SES.burger(); }
      }
      const kalan = o.kisi.filter((k) => !k.sat).length;
      if (kalan < 6) return ol("Kadro çıkmadı. Satanlara selam olsun");
      if (o.t >= M.kadro.SURE) { mesaj(`⚽ ${kalan} kişi geldi! Maç başlıyor`, 2.5); return bitir(); }
      if (!o.a1 && o.t > 22) { o.a1 = true; anlat("21:37. Erdem: 'Yağmur var galiba.' Salih: 'Pamuk şeker.'"); }
    },
    ciz(s, o) {
      zemin("#14532d", "#166534");
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 4; ctx.strokeRect(30, 100, VW - 60, 400); ctx.beginPath(); ctx.moveTo(VW / 2, 100); ctx.lineTo(VW / 2, 500); ctx.stroke(); ctx.beginPath(); ctx.arc(VW / 2, 300, 60, 0, 7); ctx.stroke();
      const dk = 21 * 60 + 15 + Math.floor(Math.min(o.t, 45));
      yazi(`🕘 ${Math.floor(dk / 60)}:${String(dk % 60).padStart(2, "0")} → 22:00`, VW - 140, 118, "900 18px ui-monospace,monospace", "#fde68a");
      o.kisi.forEach((k, i) => {
        const r = M.kadro.KUTU(i);
        yuvarlak(r.x, r.y, r.w, r.h, 16, k.sat ? "rgba(69,10,10,.85)" : "rgba(15,23,42,.8)");
        if (i === o.sec) { ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.stroke(); }
        yazi(String(i + 1), r.x + 16, r.y + 24, "900 15px sans-serif", "#94a3b8");
        emoji(k.e, r.x + r.w / 2, r.y + 48, 46);
        yazi(k.ad, r.x + r.w / 2, r.y + 96, "800 16px sans-serif");
        bar(r.x + 16, r.y + 110, r.w - 32, 14, k.bar / 100, k.bar > 60 ? "#22c55e" : k.bar > 30 ? "#eab308" : "#ef4444");
        if (k.sat) { ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(-0.25); yazi("SATTI", 0, 10, "900 38px sans-serif", "#ef4444"); ctx.restore(); }
        else if (k.notT > 0 && k.not) yazi(`"${k.not}"`, r.x + r.w / 2, r.y + 146, "italic 700 13px sans-serif", "#fde68a");
        if (o.bekle > 0 && i === o.sec) emoji("📞", r.x + r.w - 22, r.y + 22, 24);
      });
      berkayCiz(VW / 2, 545, 60);
    },
    skor: (o) => `👥 ${o.kisi.filter((k) => !k.sat).length}/8`,
    gorev: () => "Azalanı ara (1-8 / dokun) · en az 6 kişi kalsın",
  };

  // =========================================================
  // 37) Bannerlord: yön savunmalı kılıç düellosu
  // =========================================================
  const DUSMAN = [{ ad: "Mezarcı", e: "💀", can: 6, hiz: 1, feint: 0 }, { ad: "Bayburtlu Kubi", e: "🛡️", can: 8, hiz: 1.25, feint: 0.2 }, { ad: "Atlı Alihan", e: "🐎", can: 10, hiz: 1.5, feint: 0.32 }];
  const OK = { sol: "◀", ust: "▲", sag: "▶" };
  M.kilic = {
    kur: (s) => { const d = s.kilicD || 0; return { d, ecan: DUSMAN[d].can, can: 5, faz: "giris", fazT: 1.2, yon: null, blok: { yon: null, t: -9 }, atis: 0, t: 0, sonuc: null, sonucT: 0, darbe: 0, vurus: 0 }; },
    guncelle(s, o, dt) {
      const D = DUSMAN[o.d];
      o.t += dt; o.atis = Math.max(0, o.atis - dt); o.sonucT -= dt; o.darbe = Math.max(0, o.darbe - dt); o.vurus = Math.max(0, o.vurus - dt);
      s.konus = { x: 250, y: 300 };
      if (G.sol) o.blok = { yon: "sol", t: o.t };
      if (G.sag) o.blok = { yon: "sag", t: o.t };
      if (G.zipla) o.blok = { yon: "ust", t: o.t };
      const tutulan = G.tus.sol ? "sol" : G.tus.sag ? "sag" : G.tus.zipla ? "ust" : null;
      o.fazT -= dt;
      if (o.faz === "giris") { if (o.fazT <= 0) { o.faz = "bekle"; o.fazT = 0.8; } return; }
      if (o.faz === "bekle" || o.faz === "acik") {
        if ((G.at || G.tik) && o.atis <= 0) {
          o.atis = 0.42; o.vurus = 0.18;
          if (o.faz === "bekle" && Math.random() < 0.45) { o.sonuc = "Blokladı"; o.sonucT = 0.7; bip(700, 500, 0.06, "square", 0.08); }
          else {
            const kritik = o.faz === "acik"; o.ecan -= kritik ? 2 : 1; o.sonuc = kritik ? "💥 KRİTİK!" : "Vurdun"; o.sonucT = 0.7; SES.vurus(); parcaPatla(700, 300, "#ef4444", 12);
            if (kritik) { o.faz = "bekle"; o.fazT = 0.7; }
            if (o.ecan <= 0) return M.kilic.yenildi(s, o);
          }
        }
        if (o.fazT <= 0) {
          if (o.faz === "acik") { o.faz = "bekle"; o.fazT = 0.5; }
          else { o.faz = "hazir"; o.yon = rastgele(["sol", "ust", "sag"]); o.sure = (0.95 - Math.min(0.35, o.t * 0.004)) / D.hiz; o.fazT = o.sure; o.feint = Math.random() < D.feint; o.feintOldu = false; bip(300, 300, 0.05, "triangle", 0.06); }
        }
        return;
      }
      if (o.feint && !o.feintOldu && o.fazT < o.sure * 0.45) { o.feintOldu = true; o.yon = rastgele(["sol", "ust", "sag"].filter((y) => y !== o.yon)); bip(500, 700, 0.05, "triangle", 0.06); }
      if (o.fazT <= 0) {
        const parry = o.blok.yon === o.yon && o.t - o.blok.t < 0.22;
        const blok = tutulan === o.yon || (o.blok.yon === o.yon && o.t - o.blok.t < 0.45);
        if (parry) { o.faz = "acik"; o.fazT = 0.95; o.sonuc = "⚡ PARRY! Z ile vur"; o.sonucT = 0.9; bip(1200, 1600, 0.12, "square", 0.1); }
        else if (blok) { o.faz = "bekle"; o.fazT = 0.45 + Math.random() * 0.8; o.sonuc = "🛡️ Blok"; o.sonucT = 0.6; bip(800, 600, 0.06, "square", 0.08); }
        else {
          o.can--; o.darbe = 0.4; salla(0.3); SES.ol(); o.sonuc = "Kılıcı yedin"; o.sonucT = 0.8; o.faz = "bekle"; o.fazT = 0.8;
          if (o.can <= 0) return ol(`${D.ad} kafanı kesti`);
        }
      }
    },
    yenildi(s, o) {
      SES.bitti();
      if (o.d + 1 >= DUSMAN.length) { mesaj("⚔️ Hepsinin kafası kesildi!", 2.5); return bitir(); }
      o.d++; s.kilicD = o.d; o.ecan = DUSMAN[o.d].can; o.can = Math.min(5, o.can + 2); o.faz = "giris"; o.fazT = 1.6;
      mesaj(`Sıradaki: ${DUSMAN[o.d].ad} · kayıt noktası`, 1.8);
    },
    ciz(s, o) {
      zemin("#0b1026", "#3b1d0d");
      for (const x of [80, 880]) { ctx.fillStyle = "#57534e"; ctx.fillRect(x - 6, 200, 12, 200); emoji("🔥", x, 190 + Math.sin(simdi() * 9 + x) * 3, 40); }
      ctx.fillStyle = "#44403c"; ctx.fillRect(0, 470, VW, 90);
      const D = DUSMAN[o.d];
      ctx.save(); if (o.darbe > 0) { ctx.globalAlpha = 0.6; } berkayCiz(250, 475, 180); ctx.restore();
      const kalkan = G.tus.sol ? [180, 350] : G.tus.sag ? [330, 350] : G.tus.zipla ? [250, 270] : [300, 400];
      emoji("🛡️", kalkan[0], kalkan[1], 54);
      emoji("🗡️", 330 + (o.vurus > 0 ? 120 : 0), 380, 60, o.vurus > 0 ? -0.6 : 0.3);
      const ex = 700 - (o.faz === "hazir" ? (1 - o.fazT / o.sure) * 40 : 0);
      emoji(D.e, ex, 340, 150);
      if (o.faz === "acik") emoji("💫", ex, 250, 50);
      yazi(D.ad, 700, 200, "900 20px sans-serif");
      bar(600, 214, 200, 12, o.ecan / D.can, "#ef4444");
      if (o.faz === "hazir") {
        const k = 1 - o.fazT / o.sure, pos = { sol: [130, 300], ust: [250, 180], sag: [400, 300] }[o.yon];
        ctx.fillStyle = `rgba(239,68,68,${0.3 + k * 0.6})`; ctx.beginPath(); ctx.arc(pos[0], pos[1], 38 + k * 10, 0, 7); ctx.fill();
        yazi(OK[o.yon], pos[0], pos[1] + 14, "900 40px sans-serif");
      }
      kalpler(o.can, 5, 40, 130);
      if (o.sonucT > 0 && o.sonuc) yazi(o.sonuc, VW / 2, 150, "900 30px sans-serif", o.sonuc.includes("PARRY") || o.sonuc.includes("KRİTİK") ? "#fde68a" : "#fff");
      yazi(`Rakip ${o.d + 1}/3`, VW - 80, 130, "800 16px sans-serif", "#cbd5e1");
    },
    skor: (o) => `⚔️ ${o.d + 1}/3`,
    gorev: () => "Gelen yöne savun: ← ⬆ → · Z ile vur",
  };

  // =========================================================
  // 38) İkinci El Kol: yönleri karışık kolla yazı yaz
  // =========================================================
  const KLAVYE = ["ABCDEFG", "HIJKLMN", "OPRSTUV", "XYZ0123", "456789␣"];
  const KELIME = ["GTA 6", "FC27", "PS5 AL"];
  const YONAD = { u: "⬆", d: "⬇", l: "⬅", r: "➡" };
  M.kol = {
    A: { x: 800, y: 380, w: 110, h: 110 },
    kur() { const o = { k: 0, yaz: "", x: 3, y: 2, hata: 0, t: 0, flas: 0 }; M.kol.karistir(o); return o; },
    karistir(o) { const Y = ["u", "d", "l", "r"]; let p; do { p = karistir(Y); } while (p.some((v, i) => v === Y[i])); o.harita = { u: p[0], d: p[1], l: p[2], r: p[3] }; o.ogren = {}; },
    guncelle(s, o, dt) {
      o.t += dt; o.flas = Math.max(0, o.flas - dt); s.konus = { x: 130, y: 400 };
      if (o.t > 100) return ol("100 saniye doldu, kol duvara fırlatıldı");
      const d = G.yon();
      if (d) {
        const ham = d[1] < 0 ? "u" : d[1] > 0 ? "d" : d[0] < 0 ? "l" : "r", g = o.harita[ham];
        o.ogren[ham] = g; const V = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[g];
        o.x = (o.x + V[0] + 7) % 7; o.y = (o.y + V[1] + 5) % 5; bip(500, 500, 0.03, "square", 0.04);
      }
      if (G.sec || icinde(G.tik, M.kol.A)) {
        const h = KLAVYE[o.y][o.x], ch = h === "␣" ? " " : h, hedef = KELIME[o.k];
        if (ch === hedef[o.yaz.length]) {
          o.yaz += ch; SES.burger();
          if (o.yaz === hedef) {
            o.k++; o.yaz = "";
            if (o.k >= KELIME.length) { mesaj("🎮 Kol çözüldü!", 2.2); return bitir(); }
            M.kol.karistir(o); mesaj("Tuşlar yine karıştı!", 1.4);
          }
        } else {
          o.hata++; o.flas = 0.4; bip(160, 90, 0.25, "sawtooth", 0.1); soyle(rastgele(["RB mi RT mi aq", "Yanlış harf aq", "Bu kol bozuk"]), 1.2);
          if (o.hata >= 6) return ol("6 yanlış harf, kol duvara fırlatıldı");
        }
      }
    },
    ciz(s, o) {
      zemin("#0f172a", "#1e1b4b");
      yuvarlak(150, 96, 660, 76, 16, "rgba(0,0,0,.5)");
      const hedef = KELIME[Math.min(o.k, KELIME.length - 1)];
      ctx.font = "900 38px ui-monospace,monospace"; ctx.textAlign = "left";
      const w = ctx.measureText(hedef).width, x0 = VW / 2 - w / 2;
      ctx.fillStyle = "#4ade80"; ctx.fillText(o.yaz, x0, 148);
      ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillText(hedef.slice(o.yaz.length), x0 + ctx.measureText(o.yaz).width, 148);
      yazi(`Kelime ${o.k + 1}/3`, 220, 128, "800 14px sans-serif", "#94a3b8");
      KLAVYE.forEach((r, y) => r.split("").forEach((c, x) => {
        const X = 180 + x * 72, Y = 196 + y * 56, sec = x === o.x && y === o.y;
        yuvarlak(X, Y, 64, 48, 10, sec ? (o.flas > 0 ? "#dc2626" : "#22c55e") : "#334155");
        yazi(c, X + 32, Y + 33, "900 22px ui-monospace,monospace");
      }));
      yuvarlak(40, 196, 110, 160, 14, "rgba(0,0,0,.45)");
      yazi("Kol:", 95, 222, "800 14px sans-serif", "#94a3b8");
      ["u", "d", "l", "r"].forEach((k, i) => yazi(`${YONAD[k]} = ${o.ogren[k] ? YONAD[o.ogren[k]] : "?"}`, 95, 252 + i * 28, "800 18px sans-serif"));
      const A2 = M.kol.A; ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(A2.x + 55, A2.y + 55, 50, 0, 7); ctx.fill(); yazi("A", A2.x + 55, A2.y + 70, "900 44px sans-serif");
      yazi("seç", A2.x + 55, A2.y + 128, "700 13px sans-serif", "#cbd5e1");
      emoji("🎮", 860, 250, 70);
      for (let i = 0; i < 6; i++) emoji(i < 6 - o.hata ? "🟩" : "🟥", 40 + i * 22, 400, 16);
      yazi(`⏱ ${Math.max(0, 100 - o.t).toFixed(0)} sn`, 95, 440, "900 18px sans-serif", "#fde68a");
    },
    skor: (o) => `🎮 ${o.k}/3`,
    gorev: () => "Yönler karışık! Dene, öğren · Boşluk / A ile seç",
  };

  // =========================================================
  // 39) Ağır Bakım: kabloları döndürüp aküyü fara bağla
  // =========================================================
  const YON4 = [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]];
  M.tamir = {
    C: 7, R: 4, B: 88, OX: 172, OY: 150,
    kur(s) { const o = { tur: s.tamirTur || 0, x: 0, y: 0, hamle: 0, bitti: 0 }; M.tamir.uret(o); return o; },
    dondur: (b) => ((b << 1) | (b >> 3)) & 15,
    uret(o) {
      const { C, R } = M.tamir;
      let yol = null;
      while (!yol) {
        const rs = Math.floor(Math.random() * R), re = Math.floor(Math.random() * R);
        const gor = new Set([`0,${rs}`]); let sayac = 0;
        const dfs = (x, y, p) => {
          if (++sayac > 4000) return false;
          if (x === C - 1 && y === re) { if (p.length >= C + 2) { yol = p.slice(); return true; } return false; }
          for (const [dx, dy] of karistir([[1, 0], [0, 1], [0, -1], [-1, 0]])) {
            const nx = x + dx, ny = y + dy, a = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx >= C || ny >= R || gor.has(a)) continue;
            gor.add(a); p.push([nx, ny]); if (dfs(nx, ny, p)) return true; p.pop(); gor.delete(a);
          }
          return false;
        };
        dfs(0, rs, [[0, rs]]);
        if (yol) { o.rs = rs; o.re = re; }
      }
      const bit = (a, b) => (b[0] > a[0] ? 2 : b[0] < a[0] ? 8 : b[1] > a[1] ? 4 : 1);
      o.k = Array.from({ length: R }, () => Array.from({ length: C }, () => { let b = rastgele([5, 3, 7, 3]); for (let i = Math.floor(Math.random() * 4); i > 0; i--) b = M.tamir.dondur(b); return b; }));
      yol.forEach((c, i) => { let b = i === 0 ? 8 : bit(c, yol[i - 1]); b |= i === yol.length - 1 ? 2 : bit(c, yol[i + 1]); o.k[c[1]][c[0]] = b; });
      for (const r of o.k) for (let x = 0; x < C; x++) for (let i = Math.floor(Math.random() * 4); i > 0; i--) r[x] = M.tamir.dondur(r[x]);
      if (M.tamir.cozuldu(o, M.tamir.guc(o))) o.k[yol[0][1]][yol[0][0]] = M.tamir.dondur(o.k[yol[0][1]][yol[0][0]]);
      o.yol = yol; o.t = 50; o.bitti = 0; o.g = M.tamir.guc(o);
    },
    guc(o) {
      const { C, R } = M.tamir, g = Array.from({ length: R }, () => Array(C).fill(false));
      if (!(o.k[o.rs][0] & 8)) return g;
      const q = [[0, o.rs]]; g[o.rs][0] = true;
      while (q.length) {
        const [x, y] = q.shift(), b = o.k[y][x];
        for (const [bt, dx, dy, ters] of YON4) {
          if (!(b & bt)) continue; const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= C || ny >= R || g[ny][nx]) continue;
          if (o.k[ny][nx] & ters) { g[ny][nx] = true; q.push([nx, ny]); }
        }
      }
      return g;
    },
    cozuldu: (o, g) => g[o.re][M.tamir.C - 1] && (o.k[o.re][M.tamir.C - 1] & 2),
    guncelle(s, o, dt) {
      const T = M.tamir; s.konus = { x: 90, y: 440 };
      if (o.bitti > 0) {
        o.bitti -= dt;
        if (o.bitti <= 0) { o.tur++; s.tamirTur = o.tur; if (o.tur >= 3) { mesaj("🔧 3 motor da çalıştı!", 2.4); return bitir(); } T.uret(o); anlat(o.tur === 1 ? "İkinci motor: Berkay'ın 'hız testi' yaptığı motor. Trafiği kapatın." : "Son motor. Getir kuryelik bunun üstünde başlayacak."); }
        return;
      }
      o.t -= dt; if (o.t <= 0) return ol("Motor çalışmadı. Ustaya gitmek lazım… Cem asla gitmez");
      const d = G.yon(); if (d) { o.x = kenar(o.x + d[0], 0, T.C - 1); o.y = kenar(o.y + d[1], 0, T.R - 1); }
      let don = G.sec || G.at;
      const t = G.tik;
      if (t) { const cx = Math.floor((t.x - T.OX) / T.B), cy = Math.floor((t.y - T.OY) / T.B); if (cx >= 0 && cy >= 0 && cx < T.C && cy < T.R) { o.x = cx; o.y = cy; don = true; } }
      if (don) {
        o.k[o.y][o.x] = T.dondur(o.k[o.y][o.x]); o.hamle++; bip(600, 400, 0.05, "square", 0.05);
        o.g = T.guc(o);
        if (T.cozuldu(o, o.g)) { o.bitti = 1.6; SES.bitti(); mesaj("💡 Far yandı! Motor çalıştı", 1.5); gurultu(0.8, 0.12, 300); }
      }
    },
    ciz(s, o) {
      const T = M.tamir, B = T.B;
      zemin("#292524", "#57534e");
      yazi(`Motor ${o.tur + 1}/3`, VW / 2, 132, "900 20px sans-serif", "#fde68a");
      yazi(`⏱ ${Math.ceil(o.t)}`, VW - 90, 132, "900 22px sans-serif", o.t < 10 ? "#f87171" : "#fff");
      for (let y = 0; y < T.R; y++) for (let x = 0; x < T.C; x++) {
        const X = T.OX + x * B, Y = T.OY + y * B, b = o.k[y][x], on = o.g[y][x];
        yuvarlak(X + 3, Y + 3, B - 6, B - 6, 10, "#1c1917");
        ctx.strokeStyle = on ? "#facc15" : "#78716c"; ctx.lineWidth = 14; ctx.lineCap = "round";
        if (on) { ctx.shadowColor = "#facc15"; ctx.shadowBlur = 14; }
        for (const [bt, dx, dy] of YON4) if (b & bt) { ctx.beginPath(); ctx.moveTo(X + B / 2, Y + B / 2); ctx.lineTo(X + B / 2 + dx * B / 2, Y + B / 2 + dy * B / 2); ctx.stroke(); }
        ctx.shadowBlur = 0;
        ctx.fillStyle = on ? "#fde68a" : "#a8a29e"; ctx.beginPath(); ctx.arc(X + B / 2, Y + B / 2, 9, 0, 7); ctx.fill();
        if (x === o.x && y === o.y) { ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3; ctx.strokeRect(X + 4, Y + 4, B - 8, B - 8); }
      }
      emoji("🔋", T.OX - 40, T.OY + o.rs * B + B / 2, 46);
      const fy = T.OY + o.re * B + B / 2, yandi = o.bitti > 0;
      if (yandi) { const g = ctx.createLinearGradient(T.OX + T.C * B + 30, 0, VW, 0); g.addColorStop(0, "rgba(253,224,71,.8)"); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(T.OX + T.C * B + 30, fy); ctx.lineTo(VW, fy - 90); ctx.lineTo(VW, fy + 90); ctx.fill(); }
      emoji("💡", T.OX + T.C * B + 34, fy, 46);
      emoji("🏍️", 80, 300, 60); yazi("Cem", 80, 350, "800 15px sans-serif");
    },
    skor: (o) => `🔧 ${o.tur}/3`,
    gorev: () => "Parçaları döndür, aküden fara elektrik gitsin",
  };

  // =========================================================
  // 40) 8K Ceket: farkı bul
  // =========================================================
  const FARK_TEMA = [
    { ad: "Alihan'ın gardırobu", arka: ["#1f2937", "#374151"], esya: ["🧥", "🧥", "🧥", "👔", "🧣", "🧢", "👟", "🧦", "👖"], yeni: ["🥼", "👕", "🎩", "👞", "🧤", "🦺"] },
    { ad: "Popeyes masası", arka: ["#7c2d12", "#9a3412"], esya: ["🍗", "🍟", "🥤", "🍔", "🧂", "🌶️"], yeni: ["🌭", "🍕", "🧃", "🥪", "🍩", "🥗"] },
    { ad: "Kerpe plajı", arka: ["#0369a1", "#ca8a04"], esya: ["⛱️", "🐚", "🏐", "🩴", "🍉", "🦀", "🧴"], yeni: ["🐙", "🎈", "🚤", "🍦", "🪣", "🦩"] },
  ];
  M.fark = {
    CX: 6, CY: 5, W: 70, H: 64, SOL: { x: 40, y: 140 }, SAG: { x: 500, y: 140 },
    kur(s) { const o = { tur: s.farkTur || 0, imlec: 14, flas: 0 }; M.fark.uret(o); return o; },
    uret(o) {
      const T = FARK_TEMA[o.tur], n = 30;
      o.sol = Array.from({ length: n }, () => (Math.random() < 0.72 ? rastgele(T.esya) : null));
      o.sag = o.sol.slice(); o.aci = o.sol.map(() => (Math.random() - 0.5) * 0.4); o.fark = [];
      for (const i of karistir([...Array(n).keys()]).slice(0, 5)) {
        if (o.sol[i] && Math.random() < 0.25) o.sag[i] = null;
        else if (!o.sol[i]) o.sag[i] = rastgele(T.yeni);
        else o.sag[i] = rastgele(T.yeni.concat(T.esya.filter((e) => e !== o.sol[i])));
        o.fark.push({ i, bul: false });
      }
      o.t = 40;
    },
    hucre(p) {
      for (const P of [M.fark.SOL, M.fark.SAG]) {
        const cx = Math.floor((p.x - P.x) / M.fark.W), cy = Math.floor((p.y - P.y) / M.fark.H);
        if (cx >= 0 && cy >= 0 && cx < M.fark.CX && cy < M.fark.CY) return cy * M.fark.CX + cx;
      }
      return -1;
    },
    guncelle(s, o, dt) {
      s.konus = { x: VW / 2, y: 520 }; o.flas = Math.max(0, o.flas - dt);
      if (o.gecis > 0) { o.gecis -= dt; if (o.gecis <= 0) { o.tur++; s.farkTur = o.tur; if (o.tur >= 3) { mesaj("🧥 Tüm farklar bulundu!", 2.4); return bitir(); } M.fark.uret(o); } return; }
      o.t -= dt; if (o.t <= 0) return ol("Süre bitti. Ceket hâlâ aynı sandın");
      const d = G.yon();
      if (d) { const x = kenar(o.imlec % 6 + d[0], 0, 5), y = kenar(Math.floor(o.imlec / 6) + d[1], 0, 4); o.imlec = y * 6 + x; }
      let i = -1;
      if (G.sec || G.at) i = o.imlec;
      if (G.tik) { i = M.fark.hucre(G.tik); if (i >= 0) o.imlec = i; }
      if (i < 0) return;
      const f = o.fark.find((q) => q.i === i && !q.bul);
      if (f) {
        f.bul = true; SES.burger();
        if (o.fark.every((q) => q.bul)) { o.gecis = 1.3; mesaj("✅ 5/5!", 1.2); }
      } else if (!o.fark.some((q) => q.i === i)) { o.t -= 4; o.flas = 0.5; o.yanlis = i; bip(200, 100, 0.25, "sawtooth", 0.1); salla(0.15); }
    },
    ciz(s, o) {
      const T = FARK_TEMA[Math.min(o.tur, FARK_TEMA.length - 1)], F = M.fark;
      zemin("#111827", "#1f2937");
      yazi(`${T.ad} · ${o.tur + 1}/3`, VW / 2, 124, "900 20px sans-serif", "#fde68a");
      for (const [P, l] of [[F.SOL, o.sol], [F.SAG, o.sag]]) {
        const g = ctx.createLinearGradient(0, P.y, 0, P.y + F.CY * F.H); g.addColorStop(0, T.arka[0]); g.addColorStop(1, T.arka[1]);
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(P.x, P.y, F.CX * F.W, F.CY * F.H, 14); ctx.fill();
        l.forEach((e, i) => { if (e) emoji(e, P.x + (i % 6) * F.W + F.W / 2, P.y + Math.floor(i / 6) * F.H + F.H / 2, 40, o.aci[i]); });
        for (const q of o.fark) if (q.bul) { ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(P.x + (q.i % 6) * F.W + F.W / 2, P.y + Math.floor(q.i / 6) * F.H + F.H / 2, 30, 0, 7); ctx.stroke(); }
        if (o.flas > 0 && o.yanlis != null) yazi("✖", P.x + (o.yanlis % 6) * F.W + F.W / 2, P.y + Math.floor(o.yanlis / 6) * F.H + F.H / 2 + 14, "900 40px sans-serif", "#ef4444");
        ctx.strokeStyle = "rgba(253,230,138,.8)"; ctx.lineWidth = 3; ctx.strokeRect(P.x + (o.imlec % 6) * F.W + 3, P.y + Math.floor(o.imlec / 6) * F.H + 3, F.W - 6, F.H - 6);
      }
      yazi(`Bulunan ${o.fark.filter((q) => q.bul).length}/5`, 160, 124, "800 16px sans-serif", "#4ade80");
      yazi(`⏱ ${Math.max(0, o.t).toFixed(0)} sn`, VW - 120, 124, "900 18px sans-serif", o.flas > 0 || o.t < 10 ? "#f87171" : "#fff");
    },
    skor: (o) => `🧥 ${o.tur + 1}/3`,
    gorev: () => "İki resimdeki 5 farkı bul (tıkla / ok + Boşluk)",
  };

  // =========================================================
  // 41) Fren Tutmadı: Volta ile tepe sürüşü
  // =========================================================
  const TEPE_KASIS = [900, 1700, 2550, 3300, 4300, 5200, 6000, 6900, 7700];
  const tepeH = (x) => 400 + 55 * Math.sin(x / 230) + 28 * Math.sin(x / 92 + 1.3) + 12 * Math.sin(x / 41 + 0.7) - TEPE_KASIS.reduce((a, c) => a + 36 * Math.exp(-(((x - c) / 70) ** 2)), 0);
  M.tepe = {
    SON: 8400, G2: 900, R: 16, anlatKendi: true,
    EKMEK: [700, 900, 1500, 1700, 2550, 3300, 3900, 4300, 5200, 5600, 6000, 6900, 7700, 8100],
    kur(s) { const x0 = s.tepeK || 120; return { x: x0, y: tepeH(x0) - 16, v: 0, vx: 0, vy: 0, a: 0, av: 0, yer: true, t: 45, ekmek: 0, alinan: {}, fren: 0 }; },
    egim: (x) => Math.atan((tepeH(x + 2) - tepeH(x - 2)) / 4),
    guncelle(s, o, dt) {
      const T = M.tepe, R = T.R;
      const gaz = G.tus.sag || (G.imlec.bas && G.imlec.x > VW / 2), fren = G.tus.sol || (G.imlec.bas && G.imlec.x <= VW / 2);
      o.t -= dt; if (o.t <= 0) return ol("Müşteri bekleyemedi. Alihan ekmeği yedi");
      s.konus = { x: 300, y: o.y - 34 };
      if (o.yer) {
        const a = T.egim(o.x);
        o.v += T.G2 * Math.sin(a) * dt;
        if (gaz) o.v += 620 * dt;
        o.fren = 0;
        if (fren) { const etki = a > 0.18 ? 0.3 : 1; o.fren = etki < 1 ? 1 : 0; if (o.v > 0) o.v = Math.max(0, o.v - 520 * etki * dt); else o.v = Math.max(-160, o.v - 300 * dt); }
        o.v -= o.v * 0.12 * dt; o.v = kenar(o.v, -160, 500);
        o.x += o.v * Math.cos(a) * dt; if (o.x < 40) { o.x = 40; o.v = 0; }
        o.y = tepeH(o.x) - R; o.a = a;
        const h1 = (tepeH(o.x + 2) - tepeH(o.x - 2)) / 4, h2 = (tepeH(o.x + 3) - 2 * tepeH(o.x) + tepeH(o.x - 3)) / 9;
        const kappa = h2 / Math.pow(1 + h1 * h1, 1.5);
        if (o.v > 120 && o.v * o.v * kappa > T.G2 * Math.cos(a) * 1.05) { o.yer = false; o.vx = o.v * Math.cos(a); o.vy = o.v * Math.sin(a); o.av = 0; }
      } else {
        o.vy += T.G2 * dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (gaz) o.av -= 5.5 * dt; if (fren) o.av += 5.5 * dt;
        o.av *= 1 - 0.8 * dt; o.a += o.av * dt;
        const zy = tepeH(o.x) - R;
        if (o.y >= zy) {
          const ea = T.egim(o.x); let f = o.a - ea; f = Math.atan2(Math.sin(f), Math.cos(f));
          if (Math.abs(f) > 1.0) return ol("Volta takla attı. Kask da yoktu");
          o.yer = true; o.y = zy; o.v = o.vx * Math.cos(ea) + o.vy * Math.sin(ea); o.a = ea; salla(0.08); bip(120, 80, 0.08, "square", 0.08);
        }
      }
      T.EKMEK.forEach((ex, i) => {
        if (o.alinan[i]) return;
        const ey = tepeH(ex) - (TEPE_KASIS.includes(ex) ? 140 : 60);
        if (uzak(o.x, o.y, ex, ey) < 42) { o.alinan[i] = true; o.ekmek++; SES.burger(); }
      });
      if (o.x >= 4200 && !s.tepeK) { s.tepeK = 4200; mesaj("✔ Kontrol noktası", 1.5); SES.kontrol(); }
      if (o.x > 4000 && !o.a4) { o.a4 = true; anlat("Son yokuşlar. Fren yok, tren yok, sadece dua var."); }
      if (o.x >= T.SON) { mesaj("🥖 Köfte ekmek teslim!", 2.4); return bitir(); }
    },
    ciz(s, o) {
      const T = M.tepe, cx = o.x - 300;
      zemin("#fb923c", "#fde68a");
      ctx.fillStyle = "rgba(124,74,82,.5)";
      ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, 300 + 40 * Math.sin((x + cx * 0.3) / 140)); ctx.lineTo(VW, VH); ctx.fill();
      A.anlatYaz(170);
      ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, tepeH(cx + x)); ctx.lineTo(VW, VH); ctx.closePath();
      ctx.fillStyle = "#78350f"; ctx.fill(); ctx.strokeStyle = "#65a30d"; ctx.lineWidth = 8; ctx.stroke();
      for (const [px, e, ad] of [[4200, "🚩", "Kontrol"], [T.SON, "🏠", "Müşteri"]]) { const sx = px - cx; if (sx > -60 && sx < VW + 60) { emoji(e, sx, tepeH(px) - 40, 50); yazi(ad, sx, tepeH(px) - 74, "800 14px sans-serif", "#1c1917"); } }
      T.EKMEK.forEach((ex, i) => { if (!o.alinan[i]) emoji("🥖", ex - cx, tepeH(ex) - (TEPE_KASIS.includes(ex) ? 140 : 60), 30); });
      ctx.save(); ctx.translate(300, o.y); ctx.rotate(o.a);
      ctx.fillStyle = "#111"; for (const wx of [-18, 18]) { ctx.beginPath(); ctx.arc(wx, 6, 11, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#9ca3af"; for (const wx of [-18, 18]) { ctx.beginPath(); ctx.arc(wx, 6, 4, 0, 7); ctx.fill(); }
      yuvarlak(-24, -10, 48, 12, 5, "#16a34a"); ctx.fillStyle = "#111"; ctx.fillRect(16, -26, 4, 18);
      emoji("📦", -20, -18, 20); berkayCiz(0, -6, 42);
      ctx.restore();
      yuvarlak(VW - 220, 100, 200, 74, 12, "rgba(0,0,0,.5)");
      yazi(`${Math.round(Math.abs(o.v) / 20)} km/s`, VW - 120, 130, "900 24px ui-monospace,monospace", Math.abs(o.v) > 460 ? "#f87171" : "#fff");
      yazi(`⏱ ${Math.ceil(o.t)} sn · ${Math.round(o.x / T.SON * 100)}%`, VW - 120, 158, "800 14px sans-serif", "#fde68a");
      if (o.fren) yazi("FREN TUTMADI! (tren?)", 300, o.y - 70, "900 20px sans-serif", "#dc2626");
    },
    skor: (o) => `🥖 ${o.ekmek}`,
    gorev: () => "→ gaz · ← fren · havada dengele",
  };

  // =========================================================
  // 42) Aldım SS: Kubi silmeden ekran görüntüsü al
  // =========================================================
  const SS_NORMAL = [["İbo", "Kalksanıza, kim kütüphane geliyor"], ["Berkay", "3. lig topçusuyum ben"], ["Salih", "Halısaha ayarlayın la"], ["Alihan", "10:30 gibi bizde olun"], ["Burger", "Hazır ve nazırım"], ["Kurban", "Labanzubu"], ["Kurban", "Aramayın amk"], ["Cem", "Yömüye"], ["İbo", "Acilen Sakarya Aquapark"], ["Kurban", "Pişirdim gene bir şeyler"], ["Berkay", "Popeyes söyledim"], ["Alpaslan", "Eyw fındıklar"], ["Kurban", "."], ["Salih", "Palamut"], ["Burger", "KSKSJOSKSJSOWPS"], ["Alihan", "Tren tutmadı"]];
  const SS_GIZLI = ["Hisseleri gizlice sattım", "30k var aslında, 12 TL yalan", "Ben bankayım zaten", "İbo'nun hediyesi çorba gibiydi", "Berkay'dan düşük aldım ya", "Belgrad parasını harcadım", "Gece LoL'de Yuumi oynadım", "Bir de gizli hesabım var", "Matematik 28 değil 18", "5:15 şakası bilerek yapıldı"];
  const KISI_RENK = { İbo: "#facc15", Berkay: "#f87171", Salih: "#4ade80", Alihan: "#60a5fa", Burger: "#fb923c", Kurban: "#c084fc", Cem: "#2dd4bf", Alpaslan: "#f472b6" };
  M.ss = {
    kur: () => ({ t: 0, mesaj: [], dogum: 1, ss: 0, hata: 0, kacan: 0, flas: 0, sonuc: null, sonucT: 0, sonGizli: -9 }),
    guncelle(s, o, dt) {
      o.t += dt; o.flas = Math.max(0, o.flas - dt); o.sonucT -= dt; s.konus = { x: 160, y: 400 };
      o.dogum -= dt;
      if (o.dogum <= 0) {
        o.dogum = Math.max(0.6, 1.5 - o.t * 0.012) * (0.7 + Math.random() * 0.6);
        if (Math.random() < 0.38 && o.t - o.sonGizli > 0.9) { o.sonGizli = o.t; o.mesaj.push({ kim: "Kurban", yazi: rastgele(SS_GIZLI), gizli: true, omur: Math.max(0.75, 1.45 - o.t * 0.012), ilk: 0 }); }
        else { const [k, y] = rastgele(SS_NORMAL); o.mesaj.push({ kim: k, yazi: y, gizli: false }); }
        o.mesaj[o.mesaj.length - 1].ilk = o.mesaj[o.mesaj.length - 1].omur || 1;
        bip(880, 880, 0.04, "sine", 0.05);
        if (o.mesaj.length > 7) o.mesaj.shift();
      }
      for (const m of o.mesaj) if (m.gizli && !m.silindi && !m.alindi) {
        m.omur -= dt;
        if (m.omur <= 0) { m.silindi = true; o.kacan++; o.sonuc = "Kubi sildi! Kanıt gitti"; o.sonucT = 1; bip(240, 120, 0.2, "sawtooth", 0.08); if (o.hata + o.kacan >= 4) return ol("Kubi bütün kanıtları sildi"); }
      }
      if (G.sec || G.at || G.zipla || G.tik) {
        const hedef = o.mesaj.filter((m) => m.gizli && !m.silindi && !m.alindi);
        o.flas = 0.25; bip(2000, 1500, 0.05, "square", 0.06); gurultu(0.06, 0.06, 4000);
        if (hedef.length) {
          for (const m of hedef) m.alindi = true;
          o.ss += hedef.length; o.sonuc = "📸 Aldım ss"; o.sonucT = 0.8; SES.burger();
          if (o.ss >= 12) { mesaj("📸 12 SS! Kubi'nin arşivi senin", 2.4); return bitir(); }
        } else { o.hata++; o.sonuc = "Boş SS. Kubi: '.'"; o.sonucT = 1; salla(0.15); if (o.hata + o.kacan >= 4) return ol("Boş SS'lerle rezil oldun"); }
      }
    },
    ciz(s, o) {
      zemin("#020617", "#0f172a");
      yuvarlak(290, 96, 380, 380, 26, "#0b141a");
      yuvarlak(290, 96, 380, 46, 20, "#1f2c34");
      yazi("👷 Has Ameleler (8)", 480, 126, "800 16px sans-serif", "#e9edef");
      let y = 462;
      for (let i = o.mesaj.length - 1; i >= 0 && y > 160; i--) {
        const m = o.mesaj[i], ben = m.kim === "Berkay", w = 300, h = 44, x = ben ? 355 : 305;
        y -= h + 6;
        yuvarlak(x, y, w, h, 10, ben ? "#005c4b" : "#1f2c34");
        yazi(m.kim, x + 10, y + 16, "800 12px sans-serif", KISI_RENK[m.kim] || "#fff", "left");
        if (m.silindi) yazi("🚫 Bu mesaj silindi", x + 10, y + 35, "italic 600 14px sans-serif", "#8696a0", "left");
        else {
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, w - 8, h); ctx.clip();
          yazi(m.yazi, x + 10, y + 35, "600 15px sans-serif", "#e9edef", "left"); ctx.restore();
          if (m.alindi) emoji("📸", x + w - 18, y + 14, 18);
          else if (m.gizli) { ctx.fillStyle = "#ef4444"; ctx.fillRect(x, y + h - 4, w * Math.max(0, m.omur / m.ilk), 4); }
        }
      }
      if (o.flas > 0) { ctx.fillStyle = `rgba(255,255,255,${o.flas * 2.6})`; ctx.fillRect(0, 0, VW, VH); }
      yuvarlak(720, 160, 200, 150, 16, "rgba(0,0,0,.45)");
      yazi(`📸 ${o.ss}/12`, 820, 210, "900 32px sans-serif", "#fde68a");
      for (let i = 0; i < 4; i++) emoji(i < 4 - o.hata - o.kacan ? "💚" : "🖤", 765 + i * 30, 260, 22);
      emoji("📱", 150, 300, 90); berkayCiz(150, 500, 100);
      if (o.sonucT > 0 && o.sonuc) yazi(o.sonuc, 820, 350, "900 20px sans-serif", o.sonuc.startsWith("📸") ? "#4ade80" : "#fca5a5");
    },
    skor: (o) => `📸 ${o.ss}/12`,
    gorev: () => "Kubi'nin gizli mesajı silinmeden SS al (Boşluk / dokun)",
  };

  // =========================================================
  // 43) Alsas-Loren: bölge fethetme stratejisi
  // =========================================================
  const HOI = [
    ["Prusya", 170, 190, 3, 1, 30], ["Bavyera", 230, 410, 2, 0, 12], ["Saksonya", 360, 150, 1, 0, 10], ["Ren", 370, 310, 2, 0, 15],
    ["Alsas-Loren", 520, 340, 3, 0, 24], ["Belçika", 520, 170, 1, 0, 14], ["Lüksemburg", 650, 250, 1, 0, 8], ["Lyon", 660, 430, 2, 0, 18], ["Paris", 800, 220, 3, 2, 30],
  ];
  const HOI_RENK = ["#71717a", "#3b82f6", "#ef4444"];
  const HOI_DOLGU = ["rgba(113,113,122,.55)", "rgba(37,99,235,.62)", "rgba(220,38,38,.62)"];
  // Bölgeler: her merkezin Voronoi hücresi (harita dikdörtgeninin, komşulara olan orta dikmelerle kırpılmış hali)
  const HOI_ALAN = [[30, 100], [930, 100], [930, 540], [30, 540]];
  const HOI_CEVRE = (() => {
    const kirp = (poli, ax, ay, bx, by) => {
      // a'ya b'den daha yakın noktalar kalır
      const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = bx - ax, ny = by - ay;
      const ic = (p) => (p[0] - mx) * nx + (p[1] - my) * ny <= 0, out = [];
      for (let i = 0; i < poli.length; i++) {
        const p = poli[i], q = poli[(i + 1) % poli.length], pi = ic(p), qi = ic(q);
        if (pi) out.push(p);
        if (pi !== qi) { const dp = (p[0] - mx) * nx + (p[1] - my) * ny, dq = (q[0] - mx) * nx + (q[1] - my) * ny, t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
      return out;
    };
    return HOI.map((a, i) => HOI.reduce((poli, b, j) => (i === j ? poli : kirp(poli, a[1], a[2], b[1], b[2])), HOI_ALAN));
  })();
  const hoiIcinde = (x, y) => { for (let i = 0; i < HOI_CEVRE.length; i++) { const P = HOI_CEVRE[i]; let ic = false; for (let a = 0, b = P.length - 1; a < P.length; b = a++) { if ((P[a][1] > y) !== (P[b][1] > y) && x < ((P[b][0] - P[a][0]) * (y - P[a][1])) / (P[b][1] - P[a][1]) + P[a][0]) ic = !ic; } if (ic) return i; } return -1; };
  M.hoi = {
    kur: () => ({ t: 0, d: HOI.map(([ad, x, y, b, sahip, asker]) => ({ ad, x, y, b, sahip, asker, yildiz: ad === "Alsas-Loren" })), filo: [], kaynak: -1, imlec: 0, ai: 3, surukle: -1 }),
    gonder(o, a, b) {
      const k = o.d[a], n = Math.floor(k.asker / 2); if (n < 1 || a === b) return;
      k.asker -= n; o.filo.push({ x: k.x, y: k.y, hedef: b, n, sahip: k.sahip });
      if (k.sahip === 1) bip(500, 700, 0.06, "triangle", 0.06);
    },
    // dokun-dokun: önce kendi bölgen, sonra hedef. Seçiliye tekrar dokunmak seçimi kaldırır.
    tikla(o, i) {
      const k = o.d[i];
      if (o.kaynak < 0) { if (k.sahip === 1) o.kaynak = i; }
      else if (i === o.kaynak) o.kaynak = -1;
      else { if (o.d[o.kaynak].sahip === 1) M.hoi.gonder(o, o.kaynak, i); o.kaynak = -1; }
    },
    guncelle(s, o, dt) {
      o.t += dt; s.konus = { x: 110, y: 470 };
      for (const k of o.d) if (k.sahip) k.asker += k.b * 0.9 * dt;
      for (const f of o.filo) {
        const h = o.d[f.hedef], dx = h.x - f.x, dy = h.y - f.y, l = Math.hypot(dx, dy);
        if (l < 8) {
          f.bitti = true;
          if (h.sahip === f.sahip) h.asker += f.n;
          else { h.asker -= f.n; if (h.asker < 0) { const eski = h.sahip; h.sahip = f.sahip; h.asker = -h.asker; if (f.sahip === 1) { SES.burger(); if (h.yildiz) { mesaj("⭐ Alsas-Loren alındı!", 1.8); anlat("Alsas-Loren düştü. Almanya kuruluyor. Fransa karşı saldırıda."); } } else if (eski === 1) { salla(0.2); bip(200, 90, 0.3, "sawtooth", 0.1); } if (o.kaynak === f.hedef) o.kaynak = -1; } }
        } else { f.x += dx / l * 110 * dt; f.y += dy / l * 110 * dt; }
      }
      o.filo = o.filo.filter((f) => !f.bitti);
      o.ai -= dt;
      if (o.ai <= 0) {
        o.ai = Math.max(1.3, 2.4 - o.t * 0.006);
        const benim = o.d.map((k, i) => i).filter((i) => o.d[i].sahip === 2 && o.d[i].asker > 10);
        if (benim.length) {
          const a = benim.sort((x, y) => o.d[y].asker - o.d[x].asker)[0], k = o.d[a];
          const hedefler = o.d.map((h, i) => i).filter((i) => o.d[i].sahip !== 2).map((i) => { const h = o.d[i]; return [i, h.asker + uzak(k.x, k.y, h.x, h.y) / 30 - (h.yildiz ? 8 : 0) - (h.sahip === 1 ? 4 : 0)]; }).sort((x, y) => x[1] - y[1]);
          if (hedefler.length && Math.floor(k.asker / 2) > o.d[hedefler[0][0]].asker + 2) M.hoi.gonder(o, a, hedefler[0][0]);
        }
      }
      // klavye
      if (G.sol) o.imlec = (o.imlec + 8) % 9;
      if (G.sag) o.imlec = (o.imlec + 1) % 9;
      if (G.sayi >= 1 && G.sayi <= 9) { o.imlec = G.sayi - 1; M.hoi.tikla(o, G.sayi - 1); }
      if (G.sec || G.at) M.hoi.tikla(o, o.imlec);
      // fare / dokunma: bölgenin her yerine dokunulur; kendi bölgenden sürükleyip hedefte bırakınca gider
      if (G.tik) {
        const i = hoiIcinde(G.tik.x, G.tik.y);
        if (i >= 0) {
          o.imlec = i;
          if (o.kaynak >= 0 && i !== o.kaynak) { M.hoi.tikla(o, i); o.surukle = -1; }
          else if (o.d[i].sahip === 1) { o.surukle = i; o.surukleYeni = o.kaynak !== i; o.kaynak = i; }
        } else o.kaynak = -1;
      }
      if (o.surukle >= 0) {
        const i = hoiIcinde(G.imlec.x, G.imlec.y);
        if (!G.imlec.bas) {
          if (i >= 0 && i !== o.surukle) { M.hoi.gonder(o, o.surukle, i); o.kaynak = -1; }
          else if (i === o.surukle && !o.surukleYeni) o.kaynak = -1; // seçiliye tekrar dokundu: bırak
          o.surukle = -1;
        } else if (i >= 0) o.uzerinde = i;
      }
      const ben = o.d.filter((k) => k.sahip === 1).length, dus = o.d.filter((k) => k.sahip === 2).length;
      const benFilo = o.filo.some((f) => f.sahip === 1), dusFilo = o.filo.some((f) => f.sahip === 2);
      if ((ben >= 7 && o.d[4].sahip === 1) || (!dus && !dusFilo)) { mesaj("🗺️ Almanya kuruldu!", 2.5); return bitir(); }
      if (!ben && !benFilo) return ol("Fransa her yeri aldı. Kurban: 'HOI4 oynaman lazım'");
      if (o.t > 150) return ol("Süre doldu, Almanya kurulamadı");
    },
    ciz(s, o) {
      zemin("#0c1f2e", "#0b3b5c");
      const yol = (P) => { ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
      HOI_CEVRE.forEach((P, i) => {
        const k = o.d[i];
        yol(P); ctx.fillStyle = HOI_DOLGU[k.sahip]; ctx.fill();
        if (o.surukle >= 0 && G.imlec.bas && o.uzerinde === i && i !== o.surukle) { ctx.fillStyle = "rgba(253,224,71,.25)"; ctx.fill(); }
        ctx.strokeStyle = "rgba(15,23,42,.9)"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.stroke();
      });
      // seçili ve klavye imleci: kalın kenar
      if (o.kaynak >= 0) { yol(HOI_CEVRE[o.kaynak]); ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 6; ctx.stroke(); }
      if (o.imlec >= 0 && o.imlec !== o.kaynak) { yol(HOI_CEVRE[o.imlec]); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]); }
      // sürükleme oku
      if (o.surukle >= 0 && G.imlec.bas) {
        const a = o.d[o.surukle], bx = G.imlec.x, by = G.imlec.y, an = Math.atan2(by - a.y, bx - a.x);
        ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bx, by); ctx.stroke();
        ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 18 * Math.cos(an - 0.45), by - 18 * Math.sin(an - 0.45)); ctx.lineTo(bx - 18 * Math.cos(an + 0.45), by - 18 * Math.sin(an + 0.45)); ctx.fill();
      }
      o.d.forEach((k, i) => {
        ctx.fillStyle = "rgba(15,23,42,.75)"; ctx.beginPath(); ctx.arc(k.x, k.y, 24, 0, 7); ctx.fill();
        ctx.strokeStyle = HOI_RENK[k.sahip]; ctx.lineWidth = 3; ctx.stroke();
        yazi(String(Math.floor(k.asker)), k.x, k.y + 7, "900 19px sans-serif");
        yazi(`${i + 1}. ${k.ad}${k.yildiz ? " ⭐" : ""}`, k.x, k.y + 44, "800 13px sans-serif", "#f8fafc");
      });
      for (const f of o.filo) { ctx.fillStyle = HOI_RENK[f.sahip]; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, 7); ctx.fill(); ctx.stroke(); yazi(String(f.n), f.x, f.y - 13, "800 12px sans-serif"); }
      yuvarlak(VW - 220, 106, 200, 62, 12, "rgba(0,0,0,.6)");
      yazi(`🔵 Almanya ${o.d.filter((k) => k.sahip === 1).length}  🔴 Fransa ${o.d.filter((k) => k.sahip === 2).length}`, VW - 120, 130, "800 14px sans-serif");
      yazi(`⏱ ${Math.max(0, 150 - o.t).toFixed(0)} sn`, VW - 120, 154, "800 14px sans-serif", "#fde68a");
      if (o.kaynak >= 0) { yuvarlak(VW / 2 - 200, 104, 400, 30, 10, "rgba(0,0,0,.6)"); yazi(`${o.d[o.kaynak].ad} seçili → hedefe dokun ya da sürükle`, VW / 2, 125, "800 15px sans-serif", "#fde68a"); }
    },
    skor: (o) => `🗺️ ${o.d.filter((k) => k.sahip === 1).length}/9`,
    gorev: () => "Kendi bölgenden hedefe sürükle ya da dokun-dokun",
  };

  // =========================================================
  // 44) Gerinme.apk: çubuğu bacağın üstünde tut
  // =========================================================
  M.esneme = {
    GUN: [1, 4, 7, 10, 14], UST: 110, ALT: 470,
    kur(s) { return { g: s.esnemeG || 0, bar: 250, bv: 0, hedef: 300, hv: 0, hedefY: 300, ilerleme: 30, hedefSaat: 0 }; },
    guncelle(s, o, dt) {
      const E = M.esneme, z = o.g, bh = 110 - z * 9;
      s.konus = { x: 760, y: 300 };
      const basili = G.tus.zipla || G.tus.at || G.imlec.bas;
      o.bv = kenar(o.bv + (basili ? -1500 : 1150) * dt, -520, 620);
      o.bar += o.bv * dt;
      if (o.bar < E.UST) { o.bar = E.UST; o.bv = Math.abs(o.bv) * 0.3; }
      if (o.bar + bh > E.ALT) { o.bar = E.ALT - bh; o.bv = -Math.abs(o.bv) * 0.3; }
      o.hedefSaat -= dt;
      if (o.hedefSaat <= 0) { o.hedefSaat = Math.max(0.35, 1.3 - z * 0.2) * (0.5 + Math.random()); o.hedefY = E.UST + 20 + Math.random() * (E.ALT - E.UST - 40); if (Math.random() < 0.15 + z * 0.08) o.hedefSaat *= 0.4; }
      o.hv += ((o.hedefY - o.hedef) * (3 + z * 1.6) - o.hv * (2.2 - z * 0.15)) * dt;
      o.hedef = kenar(o.hedef + o.hv * dt, E.UST + 12, E.ALT - 12);
      const ic = o.hedef > o.bar && o.hedef < o.bar + bh;
      o.ilerleme += (ic ? 22 : -(12 + z * 2)) * dt;
      if (o.ilerleme >= 100) {
        SES.bitti();
        if (z + 1 >= E.GUN.length) { mesaj("🧘 14 günlük program bitti! Bacak açıldı", 2.5); return bitir(); }
        o.g++; s.esnemeG = o.g; o.ilerleme = 30; mesaj(`${E.GUN[o.g]}. gün · kayıt noktası`, 1.4);
        if (o.g === 2) anlat("7. gün. Burger: 'Omuz sırt esnetmeleri de var.'");
      }
      if (o.ilerleme <= 0) return ol("Kas koptu. Burger: 'Ben yaptığım dönem artıyordu'");
    },
    ciz(s, o) {
      const E = M.esneme, bh = 110 - o.g * 9;
      zemin("#0f172a", "#14532d");
      ctx.fillStyle = "#166534"; ctx.fillRect(0, 420, VW, 140);
      yuvarlak(400, E.UST - 6, 76, E.ALT - E.UST + 12, 18, "rgba(0,0,0,.55)");
      const ic = o.hedef > o.bar && o.hedef < o.bar + bh;
      yuvarlak(406, o.bar, 64, bh, 12, ic ? "rgba(74,222,128,.75)" : "rgba(74,222,128,.4)");
      emoji("🦵", 438, o.hedef, 38);
      yuvarlak(500, E.UST, 22, E.ALT - E.UST, 11, "rgba(255,255,255,.15)");
      const h = (E.ALT - E.UST) * Math.max(0, Math.min(1, o.ilerleme / 100));
      yuvarlak(500, E.ALT - h, 22, h, 11, o.ilerleme < 25 ? "#ef4444" : "#facc15");
      emoji("🧘", 760, 340, 140); yazi("Burger", 760, 430, "800 16px sans-serif");
      emoji("📱", 200, 250, 70); yazi("Gerinme Egzersizleri.apk", 200, 310, "700 13px sans-serif", "#cbd5e1");
      yazi(`${E.GUN[o.g]}. GÜN / 14`, 200, 160, "900 26px sans-serif", "#fde68a");
      berkayCiz(200, 470, 100);
    },
    skor: (o) => `🧘 ${M.esneme.GUN[o.g]}/14. gün`,
    gorev: () => "Basılı tut = yüksel · 🦵 yeşil çubuğun içinde kalsın",
  };

  // =========================================================
  // 45) Hain Kim: kamerayı izle, haini bul
  // =========================================================
  const ODA = [["Kütüphane", 50, 110], ["Popeyes", 345, 110], ["Mez4 Depo", 640, 110], ["Halısaha", 50, 300], ["Kerpe", 345, 300], ["NCity", 640, 300]].map(([ad, x, y]) => ({ ad, x, y, w: 270, h: 160 }));
  const EKIP = [["İbo", "#facc15"], ["Kurban", "#c084fc"], ["Alihan", "#60a5fa"], ["Burger", "#fb923c"], ["Salih", "#4ade80"], ["Cem", "#2dd4bf"], ["Alpaslan", "#f472b6"]];
  const odaNokta = (r) => [r.x + 30 + Math.random() * (r.w - 60), r.y + 40 + Math.random() * (r.h - 70)];
  const odaIci = (r, k) => k.x > r.x && k.x < r.x + r.w && k.y > r.y && k.y < r.y + r.h;
  M.amongus = {
    OY: (i) => ({ x: 110 + (i % 3) * 260, y: 230 + Math.floor(i / 3) * 90, w: 230, h: 70 }),
    kur(s) { const o = { tur: s.auTur || 0, hata: s.auHata || 0 }; M.amongus.turKur(o); return o; },
    turKur(o) {
      o.faz = "izle"; o.t = 0; o.sure = 15; o.sec = 0; o.sonuc = null; o.puf = []; o.kirmizi = 0;
      o.kisi = EKIP.map(([ad, renk]) => { const [x, y] = odaNokta(rastgele(ODA)); return { ad, renk, x, y, hx: x, hy: y, bekle: Math.random() * 2, canli: true, gizli: 0 }; });
      const idx = karistir([...Array(7).keys()]);
      o.hain = idx[0]; o.kurban = idx[1]; o.yem = o.tur >= 1 ? idx[2] : -1;
      o.oda = Math.floor(Math.random() * 6); o.olumT = 6.5 + Math.random() * 2.5; o.oldu = false; o.ceset = null;
    },
    guncelle(s, o, dt) {
      s.konus = { x: 480, y: 520 };
      if (o.faz === "sonuc") { o.bekle -= dt; if (o.bekle <= 0) { if (o.tur >= 3) { mesaj("🔪 Bütün hainler bulundu!", 2.4); return bitir(); } M.amongus.turKur(o); } return; }
      if (o.faz === "izle") {
        o.t += dt; o.kirmizi = Math.max(0, o.kirmizi - dt);
        const R = ODA[o.oda], pencere = o.t > o.olumT - 4.5 && o.t < o.olumT + 1.5 && !o.oldu;
        o.kisi.forEach((k, i) => {
          if (!k.canli) return;
          if (k.gizli > 0) { k.gizli -= dt; return; }
          const zorla = pencere && (i === o.hain || i === o.kurban);
          if (zorla && !k.zorlandi) { k.zorlandi = true; [k.hx, k.hy] = odaNokta(R); k.bekle = 0; }
          if (pencere && !zorla && odaIci(R, { x: k.hx, y: k.hy }) && !(i === o.yem && o.t < o.olumT - 4)) { [k.hx, k.hy] = odaNokta(rastgele(ODA.filter((r) => r !== R))); k.bekle = 0; }
          if (k.bekle > 0) { k.bekle -= dt; return; }
          const dx = k.hx - k.x, dy = k.hy - k.y, l = Math.hypot(dx, dy), hiz = (zorla ? 220 : 140) + o.tur * 20;
          if (l < 4) {
            k.bekle = zorla ? 99 : 0.6 + Math.random() * 1.6;
            let r = rastgele(ODA);
            if (i === o.yem && o.t < o.olumT - 6) r = R;
            if (pencere || (o.t > o.olumT - 6 && o.t < o.olumT + 1.5)) r = rastgele(ODA.filter((q) => q !== R));
            if (!zorla) [k.hx, k.hy] = odaNokta(r);
          } else { k.x += dx / l * Math.min(l, hiz * dt); k.y += dy / l * Math.min(l, hiz * dt); }
        });
        const H = o.kisi[o.hain], K = o.kisi[o.kurban];
        if (!o.oldu && o.t >= o.olumT && odaIci(R, H) && odaIci(R, K)) {
          o.oldu = true; K.canli = false; o.ceset = { x: K.x, y: K.y, renk: K.renk }; o.kirmizi = 0.5;
          bip(900, 200, 0.4, "sawtooth", 0.12);
          o.puf.push({ x: H.x, y: H.y, t: 0.8 });
          const yeni = rastgele(ODA.filter((r) => r !== R)); [H.x, H.y] = odaNokta(yeni); H.hx = H.x; H.hy = H.y; H.gizli = 0.7; H.bekle = 1;
          o.puf.push({ x: H.x, y: H.y, t: 1.4 });
          o.kisi.forEach((k) => { k.zorlandi = false; if (k.bekle > 50) k.bekle = 0.5; });
        }
        if (!o.oldu && o.t > o.olumT + 3) { [H.x, H.y] = odaNokta(R); [K.x, K.y] = odaNokta(R); }
        for (const p of o.puf) p.t -= dt;
        if (o.t >= o.sure && o.oldu) { o.faz = "oy"; o.adaylar = o.kisi.map((k, i) => i).filter((i) => o.kisi[i].canli); bip(500, 500, 0.3, "square", 0.1); }
        return;
      }
      const n = o.adaylar.length;
      if (G.sol) o.sec = (o.sec + n - 1) % n;
      if (G.sag) o.sec = (o.sec + 1) % n;
      let oy = -1;
      if (G.sayi >= 1 && G.sayi <= n) oy = G.sayi - 1;
      for (let i = 0; i < n; i++) if (icinde(G.tik, M.amongus.OY(i))) oy = i;
      if (G.sec || G.at) oy = o.sec;
      if (oy < 0) return;
      o.sec = oy; const kim = o.adaylar[oy], ad = o.kisi[kim].ad;
      o.faz = "sonuc"; o.bekle = 2.4;
      if (kim === o.hain) { o.tur++; s.auTur = o.tur; o.sonuc = `${ad} atıldı. O bir haindi. ✅`; SES.bitti(); if (o.tur === 2) anlat("Son tur. Hain hâlâ aramızda."); }
      else { o.hata++; s.auHata = o.hata; o.sonuc = `${ad} atıldı. Hain değildi. Hain: ${o.kisi[o.hain].ad}`; salla(0.2); SES.ol(); if (o.hata >= 2) return ol("2 masum atıldı. İbo: 'Amongudss bir daha yok'"); }
    },
    ciz(s, o) {
      zemin("#020617", "#1e1b4b");
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(185, 270); ctx.lineTo(775, 270); ctx.moveTo(185, 190); ctx.lineTo(185, 380); ctx.moveTo(480, 190); ctx.lineTo(480, 380); ctx.moveTo(775, 190); ctx.lineTo(775, 380); ctx.stroke();
      ODA.forEach((r, i) => {
        yuvarlak(r.x, r.y, r.w, r.h, 16, "#1e293b");
        ctx.strokeStyle = i === o.oda && o.kirmizi > 0 ? "#ef4444" : "#475569"; ctx.lineWidth = i === o.oda && o.kirmizi > 0 ? 6 : 2;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.stroke();
        yazi(r.ad, r.x + 14, r.y + 22, "800 14px sans-serif", "#94a3b8", "left");
      });
      if (o.ceset) { emoji("🦴", o.ceset.x, o.ceset.y, 26); ctx.fillStyle = o.ceset.renk; ctx.fillRect(o.ceset.x - 12, o.ceset.y + 8, 24, 6); }
      for (const k of o.kisi) {
        if (!k.canli || k.gizli > 0) continue;
        ctx.fillStyle = k.renk; ctx.beginPath(); ctx.roundRect(k.x - 11, k.y - 14, 22, 28, 10); ctx.fill();
        ctx.fillStyle = "#bae6fd"; ctx.beginPath(); ctx.roundRect(k.x - 2, k.y - 9, 13, 8, 4); ctx.fill();
        yazi(k.ad, k.x, k.y - 20, "800 11px sans-serif");
      }
      for (const p of o.puf) if (p.t > 0) { ctx.globalAlpha = Math.min(0.5, p.t) * (o.tur >= 2 ? 0.5 : 1); emoji("💨", p.x, p.y, 30); ctx.globalAlpha = 1; }
      if (o.faz === "izle") { yazi(`● REC  ${Math.max(0, o.sure - o.t).toFixed(0)} sn`, VW - 110, 485, "900 16px ui-monospace,monospace", Math.floor(o.t * 2) % 2 ? "#ef4444" : "#fca5a5"); yazi(`Tur ${o.tur + 1}/3 · hata ${o.hata}/2`, 120, 485, "800 14px sans-serif", "#cbd5e1"); }
      else {
        ctx.fillStyle = "rgba(2,6,23,.88)"; ctx.fillRect(0, 100, VW, 390);
        yazi(o.faz === "oy" ? `Ceset bulundu: ${ODA[o.oda].ad}. Kim hain?` : o.sonuc, VW / 2, 170, "900 24px sans-serif", o.faz === "oy" ? "#fde68a" : o.sonuc.includes("✅") ? "#4ade80" : "#fca5a5");
        if (o.faz === "oy") o.adaylar.forEach((ki, i) => { const r = M.amongus.OY(i), k = o.kisi[ki]; dugmeCiz(r, `${i + 1}. ${k.ad}`, "#1e293b", i === o.sec); ctx.fillStyle = k.renk; ctx.beginPath(); ctx.arc(r.x + 24, r.y + r.h / 2, 10, 0, 7); ctx.fill(); });
      }
    },
    skor: (o) => `🔪 ${o.tur}/3`,
    gorev: (o) => (o.faz === "izle" ? "Kameraları izle: kim kimi haklıyor?" : "Haini seç"),
  };

  // =========================================================
  // 46) BTD 6: kule savunması
  // =========================================================
  const BTD_YOL = [[-30, 200], [200, 200], [200, 430], [460, 430], [460, 170], [720, 170], [720, 410], [990, 410]];
  const BTD_YUVA = [[90, 118], [100, 320], [330, 118], [320, 320], [590, 300], [860, 260], [600, 500], [860, 505]];
  const BTD_UZ = []; { let t = 0; for (let i = 0; i < BTD_YOL.length - 1; i++) { BTD_UZ.push(t); t += uzak(...BTD_YOL[i], ...BTD_YOL[i + 1]); } BTD_UZ.push(t); }
  const btdNokta = (d) => { for (let i = 0; i < BTD_YOL.length - 1; i++) if (d <= BTD_UZ[i + 1]) { const f = (d - BTD_UZ[i]) / (BTD_UZ[i + 1] - BTD_UZ[i]), a = BTD_YOL[i], b = BTD_YOL[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; } return BTD_YOL[BTD_YOL.length - 1]; };
  const BALON = { 1: ["#ef4444", 75], 2: ["#3b82f6", 95], 3: ["#22c55e", 115], 4: ["#eab308", 140] };
  const DALGA = [[[1, 12, 0.9]], [[1, 10, 0.6], [2, 6, 0.9]], [[2, 14, 0.6]], [[1, 10, 0.4], [3, 8, 0.8]], [[2, 12, 0.45], [3, 10, 0.6]], [[3, 14, 0.45], [4, 6, 0.8]], [[4, 14, 0.5], [2, 20, 0.25]], [[3, 10, 0.4], [40, 1, 1.5], [4, 12, 0.5]]];
  const KULE = [null, { e: "🐒", menzil: 130, ara: 0.6, alan: 0 }, { e: "🍔", menzil: 145, ara: 0.55, alan: 55 }, { e: "🐒🍔", menzil: 170, ara: 0.25, alan: 60 }];
  const KULE_FIYAT = [100, 150, 260];
  M.btd = {
    anlatKendi: true,
    kur: () => ({ para: 300, can: 20, dalga: -1, ara: 2.5, sira: [], balon: [], kule: {}, imlec: 0, efekt: [], uyari: null, uyariT: 0 }),
    islem(o, i) {
      const k = o.kule[i], lv = k ? k.lv : 0;
      if (lv >= 3) { o.uyari = "Maksimum seviye"; o.uyariT = 1; return; }
      const f = KULE_FIYAT[lv];
      if (o.para < f) { o.uyari = `Para yetmiyor (${f})`; o.uyariT = 1; bip(200, 150, 0.1, "square", 0.06); return; }
      o.para -= f; o.kule[i] = { lv: lv + 1, cd: 0 }; SES.kontrol();
      if (lv + 1 === 2 && !o.a2) { o.a2 = true; soyle("Burger at burger", 1.4); }
    },
    guncelle(s, o, dt) {
      s.konus = { x: 480, y: 300 }; o.uyariT -= dt;
      if (G.sol) o.imlec = (o.imlec + 7) % 8;
      if (G.sag) o.imlec = (o.imlec + 1) % 8;
      if (G.sayi >= 1 && G.sayi <= 8) { o.imlec = G.sayi - 1; M.btd.islem(o, o.imlec); }
      if (G.sec || G.at) M.btd.islem(o, o.imlec);
      if (G.tik) BTD_YUVA.forEach((p, i) => { if (uzak(p[0], p[1], G.tik.x, G.tik.y) < 36) { o.imlec = i; M.btd.islem(o, i); } });
      // dalga
      if (!o.sira.length && !o.balon.length) {
        if (o.dalga >= DALGA.length - 1) { mesaj("🎈 8 dalga bitti! Kurban ve Burger kazandı", 2.6); return bitir(); }
        o.ara -= dt;
        if (o.ara <= 0) {
          o.dalga++; o.ara = 3;
          if (o.dalga > 0) o.para += 40 + 10 * o.dalga;
          let t = 0; for (const [tip, n, aralik] of DALGA[o.dalga]) for (let i = 0; i < n; i++) { o.sira.push({ tip, t }); t += aralik; }
          o.sira.sort((a, b) => a.t - b.t); o.dalgaT = 0;
          mesaj(`🎈 ${o.dalga + 1}. dalga`, 1.3);
          if (o.dalga === 7) { anlat("Son dalga: İbo balonu geliyor. Kocaman."); salla(0.3); }
        }
      } else {
        o.dalgaT += dt;
        while (o.sira.length && o.sira[0].t <= o.dalgaT) { const b = o.sira.shift(); o.balon.push({ hp: b.tip, d: 0, moab: b.tip >= 40 }); }
      }
      for (const b of o.balon) { const hiz = b.moab ? 42 : BALON[Math.min(4, Math.ceil(b.hp))][1]; b.d += hiz * dt; }
      for (const b of o.balon) if (b.d >= BTD_UZ[BTD_UZ.length - 1] && b.hp > 0) { o.can -= Math.ceil(b.hp); b.hp = 0; b.kacti = true; salla(0.15); bip(150, 80, 0.2, "sawtooth", 0.08); }
      if (o.can <= 0) return ol("Balonlar geçti. Kurban: 'LoL'e gitseydik'");
      for (const [i, k] of Object.entries(o.kule)) {
        k.cd -= dt; if (k.cd > 0) continue;
        const K = KULE[k.lv], [px, py] = BTD_YUVA[i];
        let hedef = null;
        for (const b of o.balon) { if (b.hp <= 0) continue; const [bx, by] = btdNokta(b.d); if (uzak(px, py, bx, by) <= K.menzil && (!hedef || b.d > hedef.d)) hedef = b; }
        if (!hedef) continue;
        k.cd = K.ara; const [hx, hy] = btdNokta(hedef.d);
        o.efekt.push({ x1: px, y1: py, x2: hx, y2: hy, t: 0.1, alan: K.alan });
        const vur = (b) => { const once = Math.ceil(b.hp); b.hp -= 1; o.para += 2 * (once - Math.max(0, Math.ceil(b.hp))); };
        if (K.alan) { for (const b of o.balon) { if (b.hp <= 0) continue; const [bx, by] = btdNokta(b.d); if (uzak(hx, hy, bx, by) <= K.alan) vur(b); } }
        else vur(hedef);
        if (Math.random() < 0.3) bip(1400, 900, 0.03, "square", 0.03);
      }
      o.balon = o.balon.filter((b) => b.hp > 0);
      for (const e of o.efekt) e.t -= dt;
      o.efekt = o.efekt.filter((e) => e.t > 0);
    },
    ciz(s, o) {
      zemin("#3f6212", "#4d7c0f");
      A.anlatYaz(290);
      ctx.save(); ctx.lineJoin = ctx.lineCap = "round";
      for (const [w, r] of [[46, "#a16207"], [36, "#fde68a"]]) { ctx.lineWidth = w; ctx.strokeStyle = r; ctx.beginPath(); BTD_YOL.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
      ctx.restore();
      BTD_YUVA.forEach(([x, y], i) => {
        const k = o.kule[i];
        if (i === o.imlec) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, KULE[k ? k.lv : 1].menzil, 0, 7); ctx.stroke(); }
        ctx.fillStyle = k ? "#1e3a8a" : "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(x, y, 28, 0, 7); ctx.fill();
        ctx.strokeStyle = i === o.imlec ? "#fde68a" : "rgba(255,255,255,.4)"; ctx.lineWidth = 3; ctx.stroke();
        if (k) { emoji(KULE[k.lv].e, x, y, k.lv === 3 ? 22 : 32); yazi("★".repeat(k.lv), x, y + 44, "900 12px sans-serif", "#fde68a"); }
        else { yazi(`${i + 1}`, x, y - 4, "900 14px sans-serif", "#cbd5e1"); yazi("100💰", x, y + 14, "800 11px sans-serif", "#fde68a"); }
      });
      for (const e of o.efekt) { ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke(); if (e.alan) { ctx.fillStyle = "rgba(251,146,60,.35)"; ctx.beginPath(); ctx.arc(e.x2, e.y2, e.alan, 0, 7); ctx.fill(); } }
      for (const b of o.balon) {
        const [x, y] = btdNokta(b.d);
        if (b.moab) { ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.ellipse(x, y, 48, 30, 0, 0, 7); ctx.fill(); yuzCiz("ibo", x, y, 20, "🤓"); bar(x - 40, y - 42, 80, 7, b.hp / 40, "#ef4444"); continue; }
        const [r] = BALON[Math.min(4, Math.ceil(b.hp))];
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y + 26); ctx.stroke();
        ctx.fillStyle = r; ctx.beginPath(); ctx.ellipse(x, y, 12, 15, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(x - 4, y - 5, 3, 0, 7); ctx.fill();
      }
      yuvarlak(VW - 250, 100, 230, 40, 12, "rgba(0,0,0,.55)");
      yazi(`💰 ${o.para}   ❤️ ${Math.max(0, o.can)}   🎈 ${Math.max(1, o.dalga + 1)}/8`, VW - 135, 126, "800 16px sans-serif");
      const k = o.kule[o.imlec];
      yazi(k ? (k.lv < 3 ? `Seç: güçlendir ${KULE_FIYAT[k.lv]}💰` : "Maks seviye") : "Seç: 🐒 kur 100💰", 140, 545, "800 14px sans-serif", "#fde68a");
      if (o.uyariT > 0 && o.uyari) yazi(o.uyari, VW / 2, 150, "900 20px sans-serif", "#fca5a5");
    },
    skor: (o) => `🎈 ${Math.max(1, o.dalga + 1)}/8`,
    gorev: () => "Yuvaya dokun: 🐒 kur / güçlendir (1-8, ← → + Boşluk)",
  };

  // =========================================================
  // 47) D100 Geçişi: yol + deniz, Alihan'ın evine
  // =========================================================
  const D_SERIT = [
    { r: 2, v: 70, tip: "bot", uz: 3, ara: 5 }, { r: 3, v: -95, tip: "bot", uz: 2, ara: 4 }, { r: 4, v: 60, tip: "bot", uz: 4, ara: 6.5 },
    { r: 6, v: -120, tip: "araba", uz: 1, ara: 4, e: ["🚗", "🚙"] }, { r: 7, v: 160, tip: "araba", uz: 2, ara: 5, e: ["🚚", "🚌"] }, { r: 8, v: -210, tip: "araba", uz: 1, ara: 3.5, e: ["🏎️", "🛵", "🚕"] },
  ];
  const D_KAPI = [2, 8, 13];
  M.d100 = {
    CW: 60, CH: 44, OY: 100, anlatKendi: true,
    kur(s) {
      const o = { can: 3, dolu: s.d100Dolu ? s.d100Dolu.slice() : [false, false, false], t: 30, serit: [] };
      for (const sr of D_SERIT) { const l = []; let x = -200 + Math.random() * 100; while (x < VW + 200) { l.push({ x, e: sr.e ? rastgele(sr.e) : null }); x += (sr.uz + sr.ara * (0.7 + Math.random() * 0.6)) * 60; } o.serit.push({ ...sr, l }); }
      M.d100.basla(o); return o;
    },
    basla(o) { o.c = 7.5; o.r = 9; o.x = 7.5 * 60 + 30; o.hop = 0; o.t = 30; },
    olum(s, o, neden) {
      o.can--; salla(0.3); SES.ol(); mesaj(neden, 1.3);
      if (o.can <= 0) return ol(neden + ". Maç başladı bile");
      M.d100.basla(o);
    },
    guncelle(s, o, dt) {
      const D = M.d100, py = D.OY + o.r * D.CH + D.CH / 2;
      s.konus = { x: o.x, y: py - 10 };
      o.t -= dt; if (o.t <= 0) return M.d100.olum(s, o, "Süre bitti, Alihan kapıyı kilitledi");
      const yolBoyu = (VW + 400);
      for (const sr of o.serit) for (const it of sr.l) { it.x += sr.v * dt; if (sr.v > 0 && it.x > VW + 200) it.x -= yolBoyu; if (sr.v < 0 && it.x + sr.uz * 60 < -200) it.x += yolBoyu; }
      o.hop = Math.max(0, o.hop - dt);
      let d = G.yon();
      if (G.tik) d = tikYon(G.tik, o.x, py);
      if (d && o.hop <= 0) {
        const nr = kenar(o.r + d[1], 0, 9);
        o.x = kenar(o.x + d[0] * D.CW, 20, VW - 20); o.r = nr; o.hop = 0.09; bip(500, 700, 0.04, "square", 0.04);
        if (o.r === 0) {
          const k = D_KAPI.findIndex((c, i) => !o.dolu[i] && Math.abs(c * D.CW + D.CW / 2 - o.x) < 34);
          if (k < 0) return M.d100.olum(s, o, "Yanlış kapı, çite çarptın");
          o.dolu[k] = true; s.d100Dolu = o.dolu.slice(); SES.burger();
          if (o.dolu.every(Boolean)) { mesaj("🏠 Herkes Alihan'da! Maç başlıyor", 2.4); return bitir(); }
          mesaj(`🏠 ${o.dolu.filter(Boolean).length}/3 geldi`, 1.2);
          if (o.dolu.filter(Boolean).length === 2) anlat("Bir kişi kaldı. Maç başlamak üzere.");
          return M.d100.basla(o);
        }
      }
      const sr = o.serit.find((q) => q.r === o.r);
      if (sr && sr.tip === "araba") { for (const it of sr.l) { const cx = it.x + sr.uz * 30; if (Math.abs(cx - o.x) < sr.uz * 30 + 14) return M.d100.olum(s, o, "D100'de ezildin"); } }
      if (sr && sr.tip === "bot" && o.hop <= 0) {
        const ust = sr.l.find((it) => o.x > it.x + 4 && o.x < it.x + sr.uz * 60 - 4);
        if (!ust) return M.d100.olum(s, o, "Körfeze düştün");
        o.x += sr.v * dt; if (o.x < 8 || o.x > VW - 8) return M.d100.olum(s, o, "Bot seni açığa götürdü");
      }
    },
    ciz(s, o) {
      const D = M.d100, y = (r) => D.OY + r * D.CH;
      zemin("#020617", "#0f172a");
      ctx.fillStyle = "#14532d"; ctx.fillRect(0, y(0), VW, D.CH);
      D_KAPI.forEach((c, i) => { const x = c * D.CW + D.CW / 2; emoji("🏠", x, y(0) + 20, 40); if (o.dolu[i]) emoji("🍿", x + 22, y(0) + 30, 20); });
      ctx.fillStyle = "#ca8a04"; ctx.fillRect(0, y(1), VW, D.CH);
      for (let r = 2; r <= 4; r++) { ctx.fillStyle = r % 2 ? "#0369a1" : "#075985"; ctx.fillRect(0, y(r), VW, D.CH); }
      ctx.fillStyle = "#57534e"; ctx.fillRect(0, y(5), VW, D.CH); emoji("🚏", 80, y(5) + 22, 28);
      for (let r = 6; r <= 8; r++) { ctx.fillStyle = "#27272a"; ctx.fillRect(0, y(r), VW, D.CH); ctx.fillStyle = "rgba(255,255,255,.4)"; for (let x = 0; x < VW; x += 60) ctx.fillRect(x, y(r) + D.CH - 2, 30, 3); }
      ctx.fillStyle = "#71717a"; ctx.fillRect(0, y(9), VW, D.CH);
      A.anlatYaz(y(5) + 30);
      yazi("D100", 900, y(7) + 28, "900 16px sans-serif", "rgba(255,255,255,.3)");
      yazi("Kuruçeşme", 60, y(9) + 28, "800 13px sans-serif", "#e4e4e7");
      for (const sr of o.serit) for (const it of sr.l) {
        const cy = y(sr.r) + D.CH / 2;
        if (sr.tip === "bot") { yuvarlak(it.x, cy - 15, sr.uz * 60, 30, 14, "#f97316"); ctx.fillStyle = "#fed7aa"; ctx.fillRect(it.x + 8, cy - 4, sr.uz * 60 - 16, 8); }
        else { ctx.save(); ctx.translate(it.x + sr.uz * 30, cy); if (sr.v > 0) ctx.scale(-1, 1); emoji(it.e, 0, 0, sr.uz > 1 ? 50 : 40); ctx.restore(); }
      }
      berkayCiz(o.x, y(o.r) + D.CH - 2 - (o.hop > 0 ? 8 : 0), 42);
      bar(VW - 230, 525, 200, 10, o.t / 30, o.t < 8 ? "#ef4444" : "#facc15");
      kalpler(o.can, 3, VW - 340, 530);
    },
    skor: (o) => `🏠 ${o.dolu.filter(Boolean).length}/3`,
    gorev: () => "Arabalara çarpma, botlarda kal, boş kapıya gir",
  };

  // =========================================================
  // 48) 1 Ekmek Sattım: para üstü
  // =========================================================
  const URUN = [["Ekmek", 15, "🥖"], ["Çorba", 70, "🥣"], ["Kelle paça", 120, "🍲"], ["Ayran", 25, "🥛"], ["Köfte ekmek", 90, "🥙"], ["Çay", 10, "🍵"], ["Ekmek kadayıfı", 85, "🍮"], ["Poğaça", 20, "🥐"], ["Sucuk ekmek", 65, "🌭"]];
  const MUSTERI = [["Alihan", "🧥", "Ben ısmarlayamam aga"], ["İbo", "🤓", "Çabuk, kütüphane açılıyor"], ["Kurban", "😳", "12 TL'm var aslında… şaka"], ["Berkay", "🍔", "Poğaça ye yeter"], ["Burger", "🎓", "Hazır ve nazırım"], ["Cem", "🏍️", "Motor dışarıda, hızlı"], ["Timur Abi", "👨‍🔧", "6'da işten çıktım"], ["Alpaslan", "🎮", "Harçlık yollayın"]];
  const PARA = [1, 5, 10, 20, 50, 100];
  M.parausti = {
    KUTU: (i) => ({ x: 95 + i * 130, y: 418, w: 116, h: 72 }),
    GERI: { x: 640, y: 320, w: 110, h: 54 }, VER: { x: 770, y: 320, w: 130, h: 54 },
    kur() { const o = { n: 0, hata: 0 }; M.parausti.yeni(o); return o; },
    yeni(o) {
      const k = 1 + Math.floor(Math.random() * (o.n < 3 ? 2 : 3));
      o.sepet = Array.from({ length: k }, () => rastgele(URUN)); o.tutar = o.sepet.reduce((a, u) => a + u[1], 0);
      const banknot = [50, 100, 200, 500].find((b) => b > o.tutar) || 500;
      o.odenen = banknot + (o.n >= 5 && Math.random() < 0.5 ? o.tutar % 10 : 0);
      o.must = rastgele(MUSTERI); o.sabirMax = Math.max(8, 15 - o.n * 0.7); o.sabir = o.sabirMax; o.verilen = []; o.sonuc = null; o.bekle = 0;
    },
    guncelle(s, o, dt) {
      const P = M.parausti; s.konus = { x: 170, y: 200 };
      if (o.bekle > 0) { o.bekle -= dt; if (o.bekle <= 0) { if (o.n >= 10) { mesaj("💵 10 müşteri, kasa tuttu!", 2.4); return bitir(); } P.yeni(o); } return; }
      o.sabir -= dt;
      let ekle = 0;
      if (G.sayi >= 1 && G.sayi <= 6) ekle = PARA[G.sayi - 1];
      for (let i = 0; i < 6; i++) if (icinde(G.tik, P.KUTU(i))) ekle = PARA[i];
      if (ekle) { o.verilen.push(ekle); bip(1200, 1400, 0.04, "square", 0.05); }
      if ((G.sol || icinde(G.tik, P.GERI)) && o.verilen.length) o.verilen.pop();
      const ver = G.sec || G.zipla || icinde(G.tik, P.VER);
      if (ver || o.sabir <= 0) {
        const top = o.verilen.reduce((a, b) => a + b, 0), dogru = o.odenen - o.tutar;
        o.n++; o.bekle = 1.6;
        if (ver && top === dogru) { o.sonuc = `✅ ${dogru} TL tamam. "${o.must[2]}"`; SES.burger(); if (o.n === 5) anlat("Kuyruk uzadı. Bazıları küsuratı da veriyor, para üstü yuvarlak çıksın diye."); }
        else {
          o.hata++; o.sonuc = o.sabir <= 0 ? `⌛ ${o.must[0]} bekleyemedi, gitti` : `❌ ${top} TL verdin, ${dogru} olacaktı`; salla(0.2); bip(200, 90, 0.3, "sawtooth", 0.1);
          if (o.hata >= 3) return ol("Kasa açık verdi. Salih: 'Ben belediyedeyim ihtiyar'");
        }
      }
    },
    ciz(s, o) {
      const P = M.parausti;
      zemin("#e2e8f0", "#cbd5e1");
      ctx.fillStyle = "#64748b"; ctx.fillRect(0, 395, VW, 165);
      emoji(o.must[1], 170, 300, 110); yazi(o.must[0], 170, 380, "900 18px sans-serif", "#0f172a");
      bar(90, 112, 160, 12, o.sabir / o.sabirMax, o.sabir < 4 ? "#ef4444" : "#22c55e", "rgba(0,0,0,.15)");
      yuvarlak(310, 100, 300, 280, 14, "#fff");
      let y = 134;
      for (const u of o.sepet) { yazi(`${u[2]} ${u[0]}`, 330, y, "700 17px sans-serif", "#0f172a", "left"); yazi(`${u[1]} TL`, 590, y, "800 17px sans-serif", "#0f172a", "right"); y += 28; }
      ctx.fillStyle = "#cbd5e1"; ctx.fillRect(330, y - 14, 260, 2);
      yazi("Toplam", 330, y + 12, "900 18px sans-serif", "#0f172a", "left"); yazi(`${o.tutar} TL`, 590, y + 12, "900 18px sans-serif", "#0f172a", "right");
      yazi("Ödenen", 330, y + 40, "800 17px sans-serif", "#15803d", "left"); yazi(`${o.odenen} TL`, 590, y + 40, "900 17px sans-serif", "#15803d", "right");
      const top = o.verilen.reduce((a, b) => a + b, 0);
      yuvarlak(640, 100, 260, 200, 14, "#0f172a");
      yazi("Verdiğin para üstü", 770, 132, "800 15px sans-serif", "#94a3b8");
      yazi(`${top} TL`, 770, 186, "900 44px ui-monospace,monospace", "#fde68a");
      sarYaz(o.verilen.join(" + ") || "—", 770, 226, 230, 20, "700 14px sans-serif", "#cbd5e1");
      dugmeCiz(P.GERI, "⌫ Geri", "#475569"); dugmeCiz(P.VER, "VER ✓", "#16a34a");
      PARA.forEach((p, i) => { const r = P.KUTU(i); yuvarlak(r.x, r.y, r.w, r.h, 12, p >= 20 ? "#15803d" : "#b45309"); yazi(`${p} TL`, r.x + r.w / 2, r.y + 42, "900 22px sans-serif"); yazi(String(i + 1), r.x + 14, r.y + 20, "800 12px sans-serif", "rgba(255,255,255,.7)"); });
      if (o.sonuc) { yuvarlak(120, 210, 720, 70, 14, "rgba(15,23,42,.92)"); yazi(o.sonuc, VW / 2, 254, "900 20px sans-serif", o.sonuc.startsWith("✅") ? "#4ade80" : "#fca5a5"); }
      for (let i = 0; i < 3; i++) emoji(i < 3 - o.hata ? "💵" : "💸", 790 + i * 34, 520, 24);
      yazi("Salih 🧑‍🍳", 60, 530, "800 15px sans-serif", "#fff", "left");
    },
    skor: (o) => `💵 ${o.n}/10`,
    gorev: () => "Doğru para üstünü ver · 1-6 para, ← geri, Boşluk ver",
  };

  // =========================================================
  // 49) İlk 30 Madde: tuğla kırma
  // =========================================================
  const MADDE = ["PARA YOK", "ERKEN KALKAMAZ", "ÇALIŞMAZ", "FATURA YATIRMAZ", "AJANDA YOK", "SORUMSUZ", "26K BEĞENMEZ", "POPEYES", "ALKOL", "ŞARJ %1", "HALISAHA SATAR", "EXHAUST ATMAZ", "QR ÇEKER", "SOKAKTA YATAR", "KASK TAKMAZ", "85'E ÇIKAR", "BOT ŞİŞİRİR", "POĞAÇA YE DER", "GRUPTAN ÇIKAR", "ÜCRETSİZ İZİN", "70K KAÇAR", "KÜTÜPHANEDE UYUR", "GAZ ÇIKARIR", "TEK KOLLU", "YUUMI OYNAR", "MİLLİ İRADE DER", "3. LİG DEĞİL", "BANNERLORD", "STICKER SPAM", "AQUAPARK YOK"];
  const SATIR_RENK = ["#7f1d1d", "#b91c1c", "#c2410c", "#a16207", "#4d7c0f"];
  M.tugla = {
    RY: 462,
    kur() {
      const o = { tug: [], raket: 480, rw: 130, genis: 0, top: [{ x: 480, y: 450, vx: 0, vy: 0 }], can: 3, guc: [], bekle: true, kirik: 0 };
      MADDE.forEach((m, i) => o.tug.push({ x: 40 + (i % 6) * 148, y: 108 + Math.floor(i / 6) * 40, w: 140, h: 32, m, can: i < 6 ? 2 : 1, sat: Math.floor(i / 6) }));
      return o;
    },
    guncelle(s, o, dt) {
      const RY = M.tugla.RY; s.konus = { x: o.raket, y: RY - 20 };
      o.genis = Math.max(0, o.genis - dt); const rw = o.genis > 0 ? 200 : 130; o.rw = rw;
      if (G.imlec.bas) o.raket += (G.imlec.x - o.raket) * Math.min(1, dt * 18);
      o.raket = kenar(o.raket + ((G.tus.sag ? 1 : 0) - (G.tus.sol ? 1 : 0)) * 640 * dt, rw / 2, VW - rw / 2);
      if (o.bekle) {
        const b = o.top[0]; b.x = o.raket; b.y = RY - 12;
        if (G.sec || G.zipla || G.at || G.tik) { o.bekle = false; const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6; b.vx = Math.cos(a) * 380; b.vy = Math.sin(a) * 380; }
        return;
      }
      for (const b of o.top) for (let k = 0; k < 3; k++) {
        b.x += b.vx * dt / 3; b.y += b.vy * dt / 3;
        if (b.x < 9) { b.x = 9; b.vx = Math.abs(b.vx); }
        if (b.x > VW - 9) { b.x = VW - 9; b.vx = -Math.abs(b.vx); }
        if (b.y < 100) { b.y = 100; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y + 9 >= RY && b.y < RY + 14 && Math.abs(b.x - o.raket) < rw / 2 + 9) {
          const f = (b.x - o.raket) / (rw / 2), a = -Math.PI / 2 + kenar(f, -1, 1) * 1.05 + (Math.random() - 0.5) * 0.14, v = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.y = RY - 9; bip(520, 520, 0.04, "square", 0.06);
        }
        for (const t of o.tug) {
          if (t.can <= 0) continue;
          if (b.x + 9 > t.x && b.x - 9 < t.x + t.w && b.y + 9 > t.y && b.y - 9 < t.y + t.h) {
            const ox = Math.min(b.x + 9 - t.x, t.x + t.w - (b.x - 9)), oy = Math.min(b.y + 9 - t.y, t.y + t.h - (b.y - 9));
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            t.can--;
            if (t.can <= 0) { parcaPatla(t.x + t.w / 2, t.y + t.h / 2, "#fde68a", 10); SES.burger(); o.kirik++; if (Math.random() < 0.16) o.guc.push({ x: t.x + t.w / 2, y: t.y + t.h, e: Math.random() < 0.5 ? "🍔" : "☕" }); }
            else bip(700, 700, 0.04, "square", 0.05);
            const v = Math.hypot(b.vx, b.vy), yeni = Math.min(560, v + 4); b.vx *= yeni / v; b.vy *= yeni / v;
            break;
          }
        }
      }
      o.top = o.top.filter((b) => b.y < VH + 20);
      if (!o.top.length) {
        o.can--; salla(0.2); SES.ol();
        if (o.can <= 0) return ol("Toplar bitti. İbo: 'Berkay yapamaz'");
        o.top = [{ x: o.raket, y: RY - 12, vx: 0, vy: 0 }]; o.bekle = true;
      }
      for (const g of o.guc) {
        g.y += 170 * dt;
        if (g.y > RY - 10 && g.y < RY + 20 && Math.abs(g.x - o.raket) < o.rw / 2 + 14) {
          g.al = true; SES.kontrol();
          if (g.e === "🍔") { const b = o.top[0]; if (b) for (const ek of [-0.4, 0.4]) { const v = Math.hypot(b.vx, b.vy) || 380, a = Math.atan2(b.vy, b.vx) + ek; o.top.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); } }
          else o.genis = 8;
        }
      }
      o.guc = o.guc.filter((g) => !g.al && g.y < VH);
      if (o.tug.every((t) => t.can <= 0)) { mesaj("📜 30 madde kırıldı! Ama İbo yazmaya devam ediyor…", 3); return bitir(); }
      if (o.kirik >= 15 && !o.a15) { o.a15 = true; anlat("Yarısı gitti. İbo yeni maddeler düşünüyor. 30 yetmeyecek, 100 olacak."); }
    },
    ciz(s, o) {
      zemin("#1e1b4b", "#831843");
      for (const t of o.tug) {
        if (t.can <= 0) continue;
        yuvarlak(t.x, t.y, t.w, t.h, 6, SATIR_RENK[t.sat]);
        if (t.sat === 0 && t.can === 1) { ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t.x + 20, t.y); ctx.lineTo(t.x + 50, t.y + t.h); ctx.stroke(); }
        ctx.save(); ctx.beginPath(); ctx.rect(t.x, t.y, t.w, t.h); ctx.clip(); yazi(t.m, t.x + t.w / 2, t.y + 21, "800 12px sans-serif"); ctx.restore();
      }
      yuvarlak(o.raket - o.rw / 2, M.tugla.RY, o.rw, 14, 7, "#f43f5e");
      yazi("SAF KALP", o.raket, M.tugla.RY + 11, "900 10px sans-serif");
      for (const b of o.top) emoji("🍔", b.x, b.y, 22);
      for (const g of o.guc) emoji(g.e, g.x, g.y, 28);
      for (let i = 0; i < 3; i++) emoji(i < o.can ? "❤️" : "🖤", 40 + i * 28, 520, 20);
      if (o.bekle) yazi("Boşluk / dokun: topu at", VW / 2, 420, "800 18px sans-serif", "#fde68a");
      yuzCiz("ibo", VW - 50, 500, 24, "🤓"); yazi("✍️", VW - 20, 520, "20px sans-serif");
    },
    skor: (o) => `📜 ${o.kirik}/30`,
    gorev: () => "← → raket · 30 maddeyi kır",
  };

  // =========================================================
  // 50) FİNAL: Halil — mermi cehennemi, 4 aşama
  // =========================================================
  const FAZ = [
    { ad: "100 MADDE", hp: 120 },
    { ad: "05:17 ALARMI", hp: 150, anlat: "2. AŞAMA: Saat 05:17. 'Kalksanıza!' Alarm sarmalı dönüyor." },
    { ad: "SAKARYA AQUAPARK", hp: 170, anlat: "3. AŞAMA: 'Acilen Sakarya Aquapark.' Dalgalar geliyor, boşluğu bul." },
    { ad: "YAPARMI.COM", hp: 200, anlat: "SON AŞAMA: yaparmi.com açıldı. Yapay zekâ cevap veriyor: 'Evet, mal.'" },
  ];
  const FMADDE = ["PARA BİRİKTİREMEZ", "ERKEN KALKAMAZ", "ÇALIŞMAZ", "FATURA YATIRMAZ", "AJANDA KULLANMAZ", "SORUMLULUK ALMAZ", "26K NAPİYİM DER", "3. LİG DEĞİL", "KASK TAKMAZ", "ŞARJI HEP %1"];
  const AI_CEVAP = ["Evet, mal.", "Kızın köpeği bile kaçar", "Berkay yapamaz", "Hayır.", "Ücretsiz izinde"];
  M.final = {
    anlatKendi: true,
    kur(s) { const f = s.finalFaz || 0; return { f, can: 3, bomba: 2, x: 480, y: 470, kor: 1.5, mer: [], biz: [], atis: 0, b: { x: 480, y: 175, hp: FAZ[f].hp, hedef: 480 }, t: 0, gecis: f ? 1.6 : 0.6, z: {}, lazer: [], flas: 0, olu: false, sur: null, vur: 0 }; },
    guncelle(s, o, dt) {
      const b = o.b, F = FAZ[o.f];
      s.konus = { x: b.x, y: b.y + 6 };
      o.kor = Math.max(0, o.kor - dt); o.flas = Math.max(0, o.flas - dt); o.vur = Math.max(0, o.vur - dt); o.t += dt;
      let mx = (G.tus.sag ? 1 : 0) - (G.tus.sol ? 1 : 0), my = (G.tus.asagi ? 1 : 0) - (G.tus.zipla ? 1 : 0);
      if (mx && my) { mx *= 0.7071; my *= 0.7071; }
      o.x += mx * 300 * dt; o.y += my * 300 * dt;
      if (G.imlec.bas) { if (!o.sur) o.sur = { px: o.x, py: o.y, ix: G.imlec.x, iy: G.imlec.y }; o.x = o.sur.px + (G.imlec.x - o.sur.ix) * 1.3; o.y = o.sur.py + (G.imlec.y - o.sur.iy) * 1.3; } else o.sur = null;
      o.x = kenar(o.x, 14, VW - 14); o.y = kenar(o.y, 120, VH - 14);
      if (o.olu) { o.bitT -= dt; b.y += 70 * dt; if (o.bitT <= 0) { mesaj("🏆 HALİL YENİLDİ!", 3); return bitir(); } return; }
      if (o.gecis > 0) { o.gecis -= dt; if (o.gecis <= 0) mesaj(`⚠️ ${F.ad}`, 1.6); return; }
      // bizim burgerler
      o.atis -= dt;
      if (o.atis <= 0) { o.atis = 0.11; o.biz.push({ x: o.x - 9, y: o.y - 22 }, { x: o.x + 9, y: o.y - 22 }); }
      for (const m of o.biz) m.y -= 760 * dt;
      o.biz = o.biz.filter((m) => { if (m.y < 90) return false; if (Math.abs(m.x - b.x) < 44 && Math.abs(m.y - b.y) < 44) { b.hp -= 1; o.vur = 0.06; return false; } return true; });
      // bomba
      if (G.at && o.bomba > 0) { o.bomba--; o.kor = Math.max(o.kor, 1.3); o.flas = 0.5; o.mer = []; o.lazer = []; b.hp -= 25; SES.vurus(); salla(0.3); }
      // boss hareketi
      const hiz = [110, 60, 240, 120][o.f];
      if (Math.abs(b.x - b.hedef) < 8) b.hedef = 160 + Math.random() * 640;
      b.x += Math.sign(b.hedef - b.x) * Math.min(Math.abs(b.hedef - b.x), hiz * dt);
      const des = b.hp < F.hp * 0.3 ? 1.22 : 1, z = o.z;
      const nisan = (x, y) => Math.atan2(o.y - y, o.x - x);
      const ates = (x, y, a, v, r = 7, renk = "#fde68a") => o.mer.push({ x, y, vx: Math.cos(a) * v * des, vy: Math.sin(a) * v * des, r, renk });
      const sayac = (k, ilk, ara) => { z[k] = (z[k] ?? ilk) - dt; if (z[k] <= 0) { z[k] = ara; return true; } return false; };
      if (o.f === 0) {
        if (sayac("a", 0.6, 0.78 / des)) { const a0 = nisan(b.x, b.y); for (let k = -2; k <= 2; k++) ates(b.x, b.y + 20, a0 + k * 0.2, 215); }
        if (sayac("b", 1.8, 1.9 / des)) o.mer.push({ x: 110 + Math.random() * (VW - 220), y: 110, vx: 0, vy: 115 * des, w: 190, h: 26, yazi: rastgele(FMADDE), renk: "#dc2626" });
        if (sayac("c", 3, 3.2)) for (let k = 0; k < 14; k++) ates(b.x, b.y, k / 14 * Math.PI * 2 + Math.random() * 0.2, 150, 6, "#fca5a5");
      } else if (o.f === 1) {
        if (sayac("a", 0.3, 0.06)) { z.th = (z.th || 0) + 0.24; for (let k = 0; k < 2; k++) ates(b.x, b.y, z.th + k * Math.PI, 165, 6, "#f87171"); }
        if (sayac("b", 2, 2.4 / des)) { for (let k = 0; k < 24; k++) ates(b.x, b.y, k / 24 * Math.PI * 2 + (z.th || 0) * 0.5, 130, 7, "#fbbf24"); o.flas = 0.12; bip(1200, 1200, 0.15, "square", 0.08); }
      } else if (o.f === 2) {
        if (sayac("a", 0.8, 1.3 / des)) { const gx = 480 + Math.sin(o.t * 0.9) * 300, bosluk = 160; for (let x = 20; x < VW; x += 34) if (Math.abs(x - gx) > bosluk / 2) o.mer.push({ x, y: 110, vx: 0, vy: 150 * des, r: 9, renk: "#38bdf8" }); }
        if (sayac("b", 1, 0.55 / des)) ates(b.x, b.y + 20, nisan(b.x, b.y), 320, 6, "#e0f2fe");
      } else {
        if (sayac("l", 1, 1.5 / des)) {
          z.yon = !z.yon; o.lazer.push({ tip: z.yon ? "v" : "h", p: z.yon ? o.x : o.y, uyari: 0.85, aktif: 0.45 });
          if (b.hp < F.hp * 0.5) o.lazer.push({ tip: z.yon ? "h" : "v", p: z.yon ? 140 + Math.random() * 380 : 40 + Math.random() * 880, uyari: 0.95, aktif: 0.45 });
        }
        if (sayac("a", 0.5, 0.13)) { z.th = (z.th || 0) + 0.19; for (let k = 0; k < 5; k++) ates(b.x, b.y, z.th + k * Math.PI * 2 / 5, 150, 6, "#a78bfa"); }
        if (sayac("c", 2.5, 2.6)) { const a = nisan(b.x, b.y); o.mer.push({ x: b.x, y: b.y + 30, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, w: 170, h: 26, yazi: rastgele(AI_CEVAP), renk: "#7c3aed" }); }
      }
      for (const l of o.lazer) { if (l.uyari > 0) { l.uyari -= dt; if (l.uyari <= 0) bip(200, 120, 0.3, "sawtooth", 0.1); } else l.aktif -= dt; }
      o.lazer = o.lazer.filter((l) => l.uyari > 0 || l.aktif > 0);
      for (const m of o.mer) { m.x += m.vx * dt; m.y += m.vy * dt; }
      o.mer = o.mer.filter((m) => m.x > -120 && m.x < VW + 120 && m.y > 60 && m.y < VH + 60);
      if (o.kor <= 0) {
        let vur = false;
        for (const m of o.mer) {
          if (m.w) { if (Math.abs(m.x - o.x) < m.w / 2 + 3 && Math.abs(m.y - o.y) < m.h / 2 + 3) { vur = true; break; } }
          else if ((m.x - o.x) ** 2 + (m.y - o.y) ** 2 < (m.r + 4) ** 2) { vur = true; break; }
        }
        for (const l of o.lazer) if (l.uyari <= 0 && l.aktif > 0 && (l.tip === "v" ? Math.abs(o.x - l.p) < 18 : Math.abs(o.y - l.p) < 18)) vur = true;
        if (vur) {
          o.can--; o.kor = 2; salla(0.35); SES.ol();
          o.mer = o.mer.filter((m) => (m.x - o.x) ** 2 + (m.y - o.y) ** 2 > 160 ** 2);
          if (o.can <= 0) return ol(rastgele(["Halil'in 101. maddesi oldun", "İbo: 'BERKAY YAPAMAZ'", "05:17'de uyandırıldın, öldün"]));
          soyle(rastgele(["101. madde!", "BERKAY YAPAMAZ", "Has amele"]), 1.4);
        }
      }
      if (b.hp <= 0) {
        o.mer = []; o.lazer = []; SES.bitti(); salla(0.5); parcaPatla(b.x, b.y, "#facc15", 40);
        if (o.f >= FAZ.length - 1) { o.olu = true; o.bitT = 2.8; anlat("Halil düştü. 100 madde, 05:17 alarmı, Aquapark… Hepsi bitti. 101. madde: Berkay yaptı."); return; }
        o.f++; s.finalFaz = o.f; b.hp = FAZ[o.f].hp; o.z = {}; o.gecis = 2.2; o.can = Math.min(3, o.can + 1); o.bomba = Math.max(o.bomba, 2); o.kor = 2.5;
        anlat(FAZ[o.f].anlat); mesaj(`✔ Kayıt noktası · ${o.f + 1}. aşama`, 2);
      }
    },
    ciz(s, o) {
      const b = o.b, F = FAZ[o.f];
      zemin(["#1e1b4b", "#450a0a", "#0c4a6e", "#2e1065"][o.f], ["#f472b6", "#7f1d1d", "#0369a1", "#4c1d95"][o.f]);
      ctx.globalAlpha = 0.08; yazi(["100", "05:17", "💦", ".com"][o.f], VW / 2, 420, "900 200px sans-serif"); ctx.globalAlpha = 1;
      A.anlatYaz(300);
      for (const l of o.lazer) {
        if (l.uyari > 0) { ctx.strokeStyle = "rgba(239,68,68,.55)"; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); if (l.tip === "v") { ctx.moveTo(l.p, 100); ctx.lineTo(l.p, VH); } else { ctx.moveTo(0, l.p); ctx.lineTo(VW, l.p); } ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.fillStyle = "rgba(254,226,226,.9)"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 20; if (l.tip === "v") ctx.fillRect(l.p - 14, 100, 28, VH); else ctx.fillRect(0, l.p - 14, VW, 28); ctx.shadowBlur = 0; }
      }
      ctx.fillStyle = "rgba(250,204,21,.25)"; ctx.beginPath(); ctx.arc(b.x, b.y, 62 + Math.sin(o.t * 5) * 4, 0, 7); ctx.fill();
      ctx.save(); if (o.vur > 0) ctx.globalAlpha = 0.6; yuzCiz("ibo", b.x, b.y, 46, "🤓"); ctx.restore();
      yazi("HALİL (İBO)", b.x, b.y + 64, "900 14px sans-serif", "#fde68a");
      for (const m of o.biz) { ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, 7); ctx.fill(); }
      for (const m of o.mer) {
        if (m.w) { yuvarlak(m.x - m.w / 2, m.y - m.h / 2, m.w, m.h, 6, m.renk); yazi(m.yazi, m.x, m.y + 5, "900 12px sans-serif"); continue; }
        ctx.fillStyle = m.renk; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.45, 0, 7); ctx.fill();
      }
      if (!(o.kor > 0 && Math.floor(o.kor * 10) % 2)) berkayCiz(o.x, o.y + 24, 46);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, 7); ctx.fill(); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, 7); ctx.fill();
      bar(180, 100, 600, 12, Math.max(0, b.hp) / F.hp, b.hp < F.hp * 0.3 ? "#f97316" : "#ef4444", "rgba(0,0,0,.5)");
      yazi(`${o.f + 1}/4 · ${F.ad}`, VW / 2, 128, "900 14px sans-serif", "#fde68a");
      for (let i = 0; i < 3; i++) emoji(i < o.can ? "❤️" : "🖤", 30 + i * 28, 130, 20);
      for (let i = 0; i < o.bomba; i++) emoji("🍔", VW - 30 - i * 28, 130, 20);
      if (o.flas > 0) { ctx.fillStyle = `rgba(255,255,255,${o.flas})`; ctx.fillRect(0, 0, VW, VH); }
      if (o.gecis > 0 && !o.olu) yazi(F.ad, VW / 2, VH / 2, "900 54px sans-serif", "#fde68a");
    },
    skor: (o) => `🤓 ${o.f + 1}/4`,
    gorev: () => "Kaç! Z / 🍔 = bomba",
  };

  return M;
};
