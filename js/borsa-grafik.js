// ============================================================
// borsa-grafik.js — BERKAY grafiği (borsa.html ve admin.html ortak).
// Canvas üzerine mum / çizgi grafik, hacim, fare ile kaydırma-yakınlaştırma,
// artı imleç, yatay çizgiler (giriş / likidasyon) ve admin için
// "geleceğe fiyat çizme" modu.
//
//   const g = new BorsaGrafik(canvas);
//   g.veri(mumlar)            // 1 dakikalık [{t,o,h,l,c,v}]
//   g.periyot(5 * 60000)      // 1 / 5 / 15 / 60 dk
//   g.tip("mum" | "cizgi")
//   g.cizgiler([{ p, renk, yazi }])
//   g.cizimModu({ acik, sureMs, carpan, bitti(noktalar) })   // sadece admin
//   g.rota(noktalar)          // admin: kayıtlı rotayı kesik çizgiyle göster
// ============================================================
(function () {
  "use strict";

  let stil = null;
  const css = (ad, yedek) => {
    if (!stil) { stil = getComputedStyle(document.documentElement); requestAnimationFrame(() => { stil = null; }); }
    const v = stil.getPropertyValue(ad).trim();
    return v || yedek;
  };
  const sayiYaz = (p) => {
    if (!Number.isFinite(p)) return "-";
    if (p >= 1e12) return p.toExponential(2).replace(".", ",");
    if (p >= 1e9) return (p / 1e9).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + "Mr";
    if (p >= 1e6) return (p / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + "M";
    if (p >= 1000) return p.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
    if (p >= 10) return p.toFixed(2);
    if (p >= 1) return p.toFixed(3);
    if (p > 0 && p < 1e-4) return p.toExponential(2).replace(".", ",");
    return p.toPrecision(4);
  };
  const saatYaz = (t, uzun) => {
    const d = new Date(t);
    const s = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    return uzun ? d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) + " " + s : s;
  };

  class BorsaGrafik {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext("2d");
      this.ham = [];
      this.mumlar = [];
      this.per = 60000;
      this.tur = "mum";
      this.logSecim = "oto"; // "oto" | "acik" | "kapali"
      this.kirpik = [];
      this.yatay = [];
      this.adet = 80;
      this.sag = 0; // sondan kaç mum kaydırıldı
      this.imlec = null;
      this.cizim = { acik: false, sureMs: 30 * 60000, carpan: 4, noktalar: [], bitti: null };
      this.rotaNoktalar = null;
      this._kirli = true;
      this._sonAnim = 0;

      const ro = new ResizeObserver(() => this.boyutla());
      ro.observe(canvas);
      this.boyutla();
      this.olaylar();
      document.addEventListener("tema-degisti", () => this.ciz());
      document.addEventListener("visibilitychange", () => { if (!document.hidden && this._kirli) this.ciz(); });
      // Sadece bir şey değişince çiz (veri, fare, boyut, tema). Sürekli döngü yok.
      // Ekranda görünmüyorsa (sekme gizli, admin'de başka sekme) hiç çizme.
      this._gorunur = true;
      if ("IntersectionObserver" in window) new IntersectionObserver((e) => { this._gorunur = e[0].isIntersecting; if (this._gorunur) this.ciz(); }).observe(canvas);
    }

    boyutla() {
      const r = this.c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.W = Math.max(200, r.width);
      this.H = Math.max(160, r.height);
      this.c.width = Math.round(this.W * dpr);
      this.c.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ciz();
    }
    ciz() {
      if (this._bekliyor) return;
      this._bekliyor = true;
      requestAnimationFrame(() => {
        this._bekliyor = false;
        if (!this._gorunur || document.hidden || !this.c.isConnected || this.c.offsetParent === null) { this._kirli = true; return; }
        this._kirli = false;
        this.renkler = null;
        this.cizGercek(0);
      });
    }

    veri(mumlar) { this.ham = mumlar || []; this.topla(); this.ciz(); }
    periyot(ms) { this.per = ms; this.sag = 0; this.topla(); this.ciz(); }
    tip(t) { this.tur = t; this.ciz(); }
    logOlcek(v) { this.logSecim = v; this.ciz(); }
    cizgiler(l) { this.yatay = l || []; this.ciz(); }
    rota(n) { this.rotaNoktalar = n && n.length ? n : null; this.ciz(); }
    cizimModu(o) {
      Object.assign(this.cizim, o || {});
      if (!this.cizim.acik) this.cizim.noktalar = [];
      this.c.style.touchAction = this.cizim.acik ? "none" : "pan-y";
      this.c.style.cursor = this.cizim.acik ? "crosshair" : "";
      this.ciz();
    }

    topla() {
      const per = this.per;
      if (per === 60000) { this.mumlar = this.ham.slice(); return; }
      const out = [];
      for (const m of this.ham) {
        const k = Math.floor(m.t / per) * per;
        const s = out[out.length - 1];
        if (s && s.t === k) { s.h = Math.max(s.h, m.h); s.l = Math.min(s.l, m.l); s.c = m.c; s.v += m.v || 0; }
        else out.push({ t: k, o: m.o, h: m.h, l: m.l, c: m.c, v: m.v || 0 });
      }
      this.mumlar = out;
    }

    // ---------------- Olaylar ----------------
    olaylar() {
      const c = this.c;
      let surukle = null;
      c.style.touchAction = "pan-y";
      c.addEventListener("pointerdown", (e) => {
        const { x, y } = this.nokta(e);
        if (this.cizim.acik && x >= this.simdiX) {
          c.setPointerCapture(e.pointerId);
          this.cizim.noktalar = [];
          this.cizimEkle(x, y, true);
          this._ciziyor = true;
          return;
        }
        surukle = { x, sag: this.sag };
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener("pointermove", (e) => {
        const { x, y } = this.nokta(e);
        this.imlec = { x, y };
        if (this._ciziyor) { this.cizimEkle(x, y); }
        else if (surukle) {
          const g = this.mumGen || 8;
          this.sag = Math.max(0, Math.min(this.mumlar.length - 5, surukle.sag + Math.round((x - surukle.x) / g)));
        }
        this.ciz();
      });
      const birak = () => {
        surukle = null;
        if (this._ciziyor) {
          this._ciziyor = false;
          if (this.cizim.noktalar.length >= 2 && this.cizim.bitti) this.cizim.bitti(this.cizim.noktalar.slice());
        }
      };
      c.addEventListener("pointerup", birak);
      c.addEventListener("pointercancel", birak);
      c.addEventListener("pointerleave", () => { this.imlec = null; this.ciz(); });
      c.addEventListener("wheel", (e) => {
        if (this.cizim.acik) return;
        e.preventDefault();
        this.adet = Math.max(15, Math.min(400, Math.round(this.adet * (e.deltaY > 0 ? 1.15 : 0.87))));
        this.ciz();
      }, { passive: false });
      c.addEventListener("dblclick", () => { this.adet = 80; this.sag = 0; this.ciz(); });
    }
    nokta(e) { const r = this.c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    cizimEkle(x, y, ilk) {
      const n = this.cizim.noktalar;
      const t = this.xZaman(x), p = this.yFiyat(y);
      if (ilk) {
        const simdi = Date.now();
        n.push({ t: simdi, p: this.sonFiyat() });
        if (t > simdi + 1000) n.push({ t, p });
        return;
      }
      if (t <= n[n.length - 1].t + 2000) return; // zaman hep ileri gider
      n.push({ t, p });
    }

    // ---------------- Ölçek ----------------
    sonFiyat() { const m = this.mumlar[this.mumlar.length - 1]; return this.canliFiyat || (m ? m.c : 1); }
    xZaman(x) { return Date.now() + ((x - this.simdiX) / Math.max(1, this.plotSag - this.simdiX)) * this.cizim.sureMs; }
    zamanX(t) { return this.simdiX + ((t - Date.now()) / this.cizim.sureMs) * (this.plotSag - this.simdiX); }
    yFiyat(y) {
      const k = (this.plotAlt - y) / (this.plotAlt - this.plotUst);
      return this.log ? Math.exp(Math.log(this.ymin) + k * (Math.log(this.ymax) - Math.log(this.ymin))) : this.ymin + k * (this.ymax - this.ymin);
    }
    fiyatY(p) {
      const k = this.log ? (Math.log(p) - Math.log(this.ymin)) / (Math.log(this.ymax) - Math.log(this.ymin)) : (p - this.ymin) / (this.ymax - this.ymin);
      return this.plotAlt - k * (this.plotAlt - this.plotUst);
    }

    // ---------------- Çizim ----------------
    cizGercek(zaman) {
      const ctx = this.ctx, W = this.W, H = this.H;
      const yukari = css("--ok", "#1d8656"), asagi = css("--err", "#c8412c");
      const yazi = css("--muted", "#888"), cizgi = css("--line", "#ddd"), murekkep = css("--ink", "#111"), vurgu = css("--accent", "#5a3fd4");
      ctx.clearRect(0, 0, W, H);
      const sagBosluk = 66, altBosluk = 22;
      this.plotUst = 10; this.plotAlt = H - altBosluk; this.plotSag = W - sagBosluk;
      const cizimAcik = this.cizim.acik;
      this.simdiX = cizimAcik ? Math.round(this.plotSag * 0.55) : this.plotSag;
      this.log = cizimAcik;

      const n = this.mumlar.length;
      const son = Math.max(0, n - this.sag);
      const ilk = Math.max(0, son - this.adet);
      const gorunen = this.mumlar.slice(ilk, son);
      const gen = this.simdiX / Math.max(this.adet, 10);
      this.mumGen = gen;

      // y aralığı: uç iğneler (ani sıçramalar) aralığı belirlemesin.
      // Kapanışların %3–%97'lik dilimine göre aralık kur, dışında kalan iğneleri kırp (▲/▼ ile göster).
      const kapanis = gorunen.map((m) => m.c).filter((x) => x > 0).sort((a, b) => a - b);
      let mn = Infinity, mx = -Infinity;
      if (kapanis.length) {
        const al = (q) => kapanis[Math.min(kapanis.length - 1, Math.max(0, Math.round(q * (kapanis.length - 1))))];
        const alt = al(0.03), ust = al(0.97);
        for (const m of gorunen) {
          const govdeAlt = Math.min(m.o, m.c), govdeUst = Math.max(m.o, m.c);
          if (govdeUst <= ust * 3 && govdeAlt >= alt / 3) { mn = Math.min(mn, govdeAlt); mx = Math.max(mx, govdeUst); }
        }
        for (const m of gorunen) {
          if (m.h <= Math.max(mx, ust) * 1.6) mx = Math.max(mx, m.h);
          if (m.l >= Math.min(mn, alt) / 1.6) mn = Math.min(mn, m.l);
        }
      }
      if (this.canliFiyat && this.sag === 0) { mn = Math.min(mn, this.canliFiyat); mx = Math.max(mx, this.canliFiyat); }
      if (!Number.isFinite(mn)) { mn = 0.9; mx = 1.1; }
      if (cizimAcik) {
        const p = this.sonFiyat(), k = this.cizim.carpan || 4;
        mn = Math.min(mn, p / k); mx = Math.max(mx, p * k);
        for (const q of this.cizim.noktalar) { mn = Math.min(mn, q.p); mx = Math.max(mx, q.p); }
      } else {
        for (const l of this.yatay) if (l.p > mn * 0.7 && l.p < mx * 1.4) { mn = Math.min(mn, l.p); mx = Math.max(mx, l.p); }
      }
      if (this.rotaNoktalar && cizimAcik) for (const q of this.rotaNoktalar) { mn = Math.min(mn, q.p); mx = Math.max(mx, q.p); }
      mn = Math.max(1e-6, mn);
      this.log = cizimAcik || this.logSecim === "acik" || (this.logSecim === "oto" && mx / mn > 4);
      this.logOto = !cizimAcik && this.logSecim === "oto" && this.log;
      const pay = (mx - mn) * 0.08 || mx * 0.02 || 0.01;
      if (this.log) { this.ymin = mn / 1.08; this.ymax = mx * 1.08; }
      else { this.ymin = Math.max(1e-6, mn - pay); this.ymax = mx + pay; }
      const kirp = (y) => Math.max(this.plotUst, Math.min(this.plotAlt, y));

      // ızgara + fiyat ekseni
      ctx.font = "600 11px Manrope, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      const satir = 5;
      for (let i = 0; i <= satir; i++) {
        const y = this.plotUst + ((this.plotAlt - this.plotUst) * i) / satir;
        ctx.strokeStyle = cizgi; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(this.plotSag, Math.round(y) + 0.5); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = yazi; ctx.textAlign = "left";
        ctx.fillText(sayiYaz(this.yFiyat(y)), this.plotSag + 8, y);
      }

      // hacim
      let vmax = 0;
      for (const m of gorunen) vmax = Math.max(vmax, m.v || 0);
      const xOf = (i) => (i - ilk) * gen + gen / 2 + (this.adet - gorunen.length) * gen * (son === n ? 1 : 0);
      if (vmax > 0) {
        for (let i = ilk; i < son; i++) {
          const m = this.mumlar[i]; if (!m.v) continue;
          const h = (m.v / vmax) * (this.plotAlt - this.plotUst) * 0.16;
          ctx.fillStyle = m.c >= m.o ? yukari : asagi; ctx.globalAlpha = 0.18;
          ctx.fillRect(xOf(i) - gen * 0.35, this.plotAlt - h, Math.max(1, gen * 0.7), h);
        }
        ctx.globalAlpha = 1;
      }

      // mumlar / çizgi
      if (this.tur === "cizgi") {
        ctx.beginPath();
        for (let i = ilk; i < son; i++) { const x = xOf(i), y = kirp(this.fiyatY(this.mumlar[i].c)); if (i === ilk) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.strokeStyle = vurgu; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
        if (son > ilk) {
          ctx.lineTo(xOf(son - 1), this.plotAlt); ctx.lineTo(xOf(ilk), this.plotAlt); ctx.closePath();
          const gr = ctx.createLinearGradient(0, this.plotUst, 0, this.plotAlt);
          gr.addColorStop(0, vurgu + "55"); gr.addColorStop(1, vurgu + "00");
          ctx.fillStyle = gr; ctx.fill();
        }
      } else {
        for (let i = ilk; i < son; i++) {
          const m = this.mumlar[i], x = xOf(i);
          const renk = m.c >= m.o ? yukari : asagi;
          ctx.strokeStyle = renk; ctx.fillStyle = renk; ctx.lineWidth = 1;
          const yh = this.fiyatY(m.h), yl = this.fiyatY(m.l);
          ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, kirp(yh)); ctx.lineTo(Math.round(x) + 0.5, kirp(yl)); ctx.stroke();
          const y1 = kirp(this.fiyatY(Math.max(m.o, m.c))), y2 = kirp(this.fiyatY(Math.min(m.o, m.c)));
          ctx.fillRect(x - gen * 0.36, y1, Math.max(1, gen * 0.72), Math.max(1, y2 - y1));
          // grafiğe sığmayan ani sıçrama: ucuna ok + değer
          if (yh < this.plotUst - 1 || yl > this.plotAlt + 1) {
            const ust = yh < this.plotUst - 1, yy = ust ? this.plotUst + 2 : this.plotAlt - 2;
            ctx.beginPath();
            if (ust) { ctx.moveTo(x, yy); ctx.lineTo(x - 5, yy + 8); ctx.lineTo(x + 5, yy + 8); }
            else { ctx.moveTo(x, yy); ctx.lineTo(x - 5, yy - 8); ctx.lineTo(x + 5, yy - 8); }
            ctx.closePath(); ctx.fill();
            ctx.font = "800 10px Manrope, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = ust ? "top" : "bottom";
            ctx.fillText(sayiYaz(ust ? m.h : m.l), x, ust ? yy + 10 : yy - 10);
          }
        }
      }

      if (this.log && !cizimAcik) {
        ctx.font = "800 10px Manrope, system-ui, sans-serif"; ctx.fillStyle = yazi; ctx.textAlign = "right"; ctx.textBaseline = "top";
        ctx.fillText(this.logOto ? "LOG (otomatik)" : "LOG", this.plotSag - 6, this.plotUst + 2);
      }
      // zaman ekseni
      ctx.fillStyle = yazi; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      const adim = Math.max(1, Math.round(90 / gen));
      const uzun = this.per >= 3600000;
      for (let i = ilk; i < son; i += adim) { const x = xOf(i); if (x > 24 && x < this.plotSag - 20) ctx.fillText(saatYaz(this.mumlar[i].t, uzun), x, H - 6); }

      // yatay çizgiler (giriş, likidasyon…)
      ctx.setLineDash([5, 4]);
      for (const l of this.yatay) {
        if (!(l.p > this.ymin && l.p < this.ymax)) continue;
        const y = Math.round(this.fiyatY(l.p)) + 0.5;
        ctx.strokeStyle = l.renk; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.plotSag, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "700 10px Manrope, system-ui, sans-serif";
        const w = ctx.measureText(l.yazi).width + 10;
        ctx.fillStyle = l.renk; ctx.fillRect(4, y - 9, w, 18);
        ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(l.yazi, 9, y);
        ctx.setLineDash([5, 4]);
      }
      ctx.setLineDash([]);

      // gelecek alanı (admin çizim modu)
      if (cizimAcik) {
        ctx.fillStyle = vurgu; ctx.globalAlpha = 0.06;
        ctx.fillRect(this.simdiX, this.plotUst, this.plotSag - this.simdiX, this.plotAlt - this.plotUst);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = vurgu; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(this.simdiX + 0.5, this.plotUst); ctx.lineTo(this.simdiX + 0.5, this.plotAlt); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = yazi; ctx.font = "700 11px Manrope, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText("ŞİMDİ", this.simdiX + 6, this.plotUst + 4);
        ctx.textAlign = "right";
        ctx.fillText("+" + Math.round(this.cizim.sureMs / 60000) + " dk", this.plotSag - 6, this.plotUst + 4);
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        for (let k = 1; k <= 3; k++) {
          const t = Date.now() + (this.cizim.sureMs * k) / 4;
          ctx.fillText(saatYaz(t, this.cizim.sureMs > 6 * 3600000), this.zamanX(t), H - 6);
        }
        if (!this.cizim.noktalar.length && !this.rotaNoktalar) {
          ctx.fillStyle = vurgu; ctx.font = "800 13px Manrope, system-ui, sans-serif";
          ctx.fillText("✏️ Buraya fareyle/parmakla çiz", (this.simdiX + this.plotSag) / 2, (this.plotUst + this.plotAlt) / 2);
        }
      }
      const yolCiz = (noktalar, renk, kesik) => {
        if (!noktalar || noktalar.length < 2 || !cizimAcik) return;
        ctx.strokeStyle = renk; ctx.lineWidth = 2.5; ctx.setLineDash(kesik ? [6, 5] : []);
        ctx.beginPath();
        noktalar.forEach((q, i) => { const x = this.zamanX(q.t), y = this.fiyatY(q.p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke(); ctx.setLineDash([]);
      };
      yolCiz(this.rotaNoktalar, css("--sun", "#f5b82e"), true);
      yolCiz(this.cizim.noktalar, vurgu, false);

      // canlı fiyat etiketi
      const p = this.sonFiyat();
      if (p > this.ymin && p < this.ymax) {
        const y = Math.round(this.fiyatY(p)) + 0.5;
        const sonMum = this.mumlar[n - 1];
        const renk = sonMum && p < sonMum.o ? asagi : yukari;
        ctx.strokeStyle = renk; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.plotSag, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = renk;
        ctx.fillRect(this.plotSag + 2, y - 10, sagBosluk - 4, 20);
        ctx.fillStyle = "#fff"; ctx.font = "800 11px Manrope, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(sayiYaz(p), this.plotSag + 7, y);
        if (this.sag === 0 && n) {
          const nabiz = 0.8;
          const x = cizimAcik ? this.simdiX : xOf(n - 1);
          ctx.fillStyle = renk; ctx.globalAlpha = 0.25 * nabiz;
          ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
        }
      }

      // artı imleç + bilgi
      if (this.imlec && !this._ciziyor) {
        const { x, y } = this.imlec;
        if (x < this.plotSag && y > this.plotUst && y < this.plotAlt) {
          ctx.strokeStyle = murekkep; ctx.globalAlpha = 0.35; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(x + 0.5, this.plotUst); ctx.lineTo(x + 0.5, this.plotAlt); ctx.moveTo(0, y + 0.5); ctx.lineTo(this.plotSag, y + 0.5); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          ctx.fillStyle = murekkep; ctx.fillRect(this.plotSag + 2, y - 10, sagBosluk - 4, 20);
          ctx.fillStyle = css("--bg", "#fff"); ctx.font = "700 11px Manrope, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(sayiYaz(this.yFiyat(y)), this.plotSag + 7, y);
          if (cizimAcik && x > this.simdiX) {
            ctx.fillStyle = murekkep; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
            ctx.fillText(saatYaz(this.xZaman(x), true), x, this.plotAlt - 4);
          } else {
            const i = Math.floor((x - xOf(ilk) + gen / 2) / gen) + ilk;
            const m = this.mumlar[i];
            if (m && i >= ilk && i < son) {
              ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "700 11px Manrope, system-ui, sans-serif";
              ctx.fillStyle = yazi;
              const deg = ((m.c - m.o) / m.o) * 100;
              ctx.fillText(`${saatYaz(m.t, true)}  A ${sayiYaz(m.o)}  Y ${sayiYaz(m.h)}  D ${sayiYaz(m.l)}  K ${sayiYaz(m.c)}  ${deg >= 0 ? "+" : ""}${deg.toFixed(2)}%`, 8, this.plotUst + 2);
            }
          }
        }
      }
    }
  }

  window.BorsaGrafik = BorsaGrafik;
  window.BorsaSayi = sayiYaz;
})();

// ============================================================
// Ortak: sunucu çağrısı + fiyat eğrisi (sunucudaki api/borsa.js ile aynı formüller,
// sadece "tahmini" değerleri göstermek için; asıl hesap sunucuda yapılır).
// ============================================================
(function () {
  "use strict";
  window.BorsaApi = async function (islem, veri) {
    if (typeof auth === "undefined" || !auth || !auth.currentUser) throw new Error("Önce giriş yap.");
    const token = await auth.currentUser.getIdToken();
    let r;
    try {
      r = await fetch("/api/borsa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(Object.assign({ islem }, veri || {})),
      });
    } catch { throw new Error("Sunucuya ulaşılamadı."); }
    const j = await r.json().catch(() => ({ ok: false, hata: "Sunucu cevap vermedi (" + r.status + ")." }));
    if (!j.ok) throw new Error(j.hata || "Bir şeyler ters gitti.");
    return j;
  };
  const LIK = 0.9;
  const E = {
    al: (p, N, D) => ({ q: (D / p) * (1 - Math.exp(-N / D)), p1: p * Math.exp(N / D) }),
    sat: (p, q, D) => { const x = (q * p) / D; return { N: D * Math.log1p(x), p1: p / (1 + x) }; },
    shortAc: (p, N, D) => ({ q: (D / p) * Math.expm1(N / D), p1: p * Math.exp(-N / D) }),
    geriAl: (p, q, D) => { const x = Math.min((q * p) / D, 0.98); return { N: -D * Math.log1p(-x), p1: p / (1 - x) }; },
  };
  // Kaldıraç K/Z = "şimdi kapatsan" (kapanış da fiyatı iter). v:2 = ara sürümden kalan düz hesaplı pozisyon.
  E.pnl = (poz, p, D) => {
    if (poz.v === 2) return poz.yon === "long" ? poz.boyut * (p - poz.giris) : poz.boyut * (poz.giris - p);
    return poz.yon === "long" ? E.sat(p, poz.boyut, D).N - poz.notional : poz.notional - E.geriAl(p, poz.boyut, D).N;
  };
  E.lik = (poz, D) => {
    if (poz.v === 2) { const f = (LIK * poz.teminat) / poz.boyut; return poz.yon === "long" ? Math.max(0, poz.giris - f) : poz.giris + f; }
    return poz.yon === "long"
      ? Math.max(0, (D * Math.expm1((poz.notional - LIK * poz.teminat) / D)) / poz.boyut)
      : (D * (1 - Math.exp(-(poz.notional + LIK * poz.teminat) / D))) / poz.boyut;
  };
  window.BorsaEgri = E;
  window.BorsaGun = (t) => new Date(t + 3 * 3600000).toISOString().slice(0, 10);
})();
