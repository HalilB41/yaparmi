// ============================================================
// profil.js — sadece profil.html. /profil?k=kullaniciAdi (yoksa kendi profilin).
// Cüzdan (BERKAY/TL, toplam değer, sıralama, günlük seri), oyun rekorları,
// borsa karnesi (en iyi işlem, en büyük likidasyon, açık pozisyonlar),
// tahmin sonuçları ve zenginler listesi.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const para = (x, k = 2) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  const isaretli = (x, k = 2) => (x >= 0 ? "+" : "") + para(x, k);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const E = window.BorsaEgri;
  const OYUN = { boks: ["🥊", "Boks makinesi", ""], penalti: ["⚽", "Gol serisi", " gol"], motor: ["🏍️", "Kasksız 85", " m"], g2048: ["🔢", "2048 en büyük kare", ""], yilan: ["🐍", "Yılan", " yem"] };

  let profile = null, basladi = false, cuzdanlar = [], d = null, gecmis = [], bahisler = [], hedefUid = null;
  const istenen = new URLSearchParams(location.search).get("k");

  $("ekGirisBtn").addEventListener("click", (e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); const t = $("authToggle"), p = $("authPanel"); if (t && p && p.hidden) t.click(); });
  if (typeof db === "undefined" || !db) { $("ekKapiYazi").textContent = "Şu an bağlı değil."; return; }
  window.YaparmiAuth.onChange((p) => {
    profile = p;
    if (!p) { $("ekIcerik").hidden = true; $("ekKapi").hidden = false; $("ekKapiYazi").innerHTML = "Profilleri görmek için <b>giriş yap</b>."; $("ekGirisBtn").hidden = false; return; }
    $("ekKapi").hidden = true; $("ekIcerik").hidden = false;
    if (!basladi) { basladi = true; dinle(); }
  });

  function hedefAd() { return istenen || (profile && profile.kullaniciAdi); }
  // Bütün coinlerin durumu (değer hesabı için): sym → durum
  const BC = window.BorsaCoin;
  let coinler = BC.liste(null);
  const durumlar = {}, dinlenen = {};
  function pozlari(uid) {
    const l = [];
    Object.entries(durumlar).forEach(([sym, dd]) => Object.values(dd.poz || {}).forEach((p) => { if (p.uid === uid) l.push({ p, dd, sym }); }));
    return l;
  }
  function deger(c) {
    if (!c) return 0;
    let t = c.btl || 0;
    coinler.forEach((k) => { const m = BC.bakiye(c, k.sym); const dd = durumlar[k.sym]; if (m) t += m * (dd ? dd.fiyat : k.sym === "BERKAY" ? 1 : 0); });
    pozlari(c.uid).forEach(({ p, dd }) => { t += Math.max(0, p.teminat + E.pnl(p, dd.fiyat, dd.derinlik)); });
    return t;
  }

  function dinle() {
    const coinDinle = () => coinler.forEach((k) => {
      if (dinlenen[k.sym]) return;
      dinlenen[k.sym] = true;
      db.collection("borsa").doc(BC.durumId(k.sym)).onSnapshot((s) => { if (s.exists) durumlar[k.sym] = s.data(); if (k.sym === "BERKAY") d = durumlar.BERKAY || null; ciz(); }, () => {});
    });
    db.collection("borsa").doc("coinler").onSnapshot((s) => { coinler = BC.liste(s.exists ? s.data() : null); coinDinle(); }, () => coinDinle());
    Ekonomi.cuzdanlar((l) => {
      cuzdanlar = l;
      const c = l.find((x) => x.ad === hedefAd());
      if (c && c.uid !== hedefUid) {
        hedefUid = c.uid;
        db.collection("borsa_gecmis").where("uid", "==", c.uid).onSnapshot((s) => { gecmis = s.docs.map((x) => x.data()); ciz(); }, () => {});
        db.collection("tahmin_bahis").where("uid", "==", c.uid).onSnapshot((s) => { bahisler = s.docs.map((x) => x.data()); ciz(); }, () => {});
      }
      ciz();
    });
  }

  function kutu(hedef, satirlar) {
    const k = $(hedef); k.textContent = "";
    if (!satirlar.length) { k.append(el("p", "muted", "Henüz bir şey yok.")); return; }
    satirlar.forEach((s) => k.append(s));
  }
  function satir(sol, sag, cls) { const r = el("div", "bx-satir"); r.append(typeof sol === "string" ? el("span", null, sol) : sol, el("span", "bx-sag " + (cls || ""), sag)); return r; }

  function ciz() {
    const ad = hedefAd();
    document.title = (ad || "Profil") + " · yaparmi.com";
    const c = cuzdanlar.find((x) => x.ad === ad);
    const ust = $("pfUst"); ust.textContent = "";
    if (!c) {
      ust.append(el("h1", null, ad || "?"), el("p", "muted", cuzdanlar.length ? "Bu kişinin henüz BERKAY cüzdanı yok (siteye kayıtlı girince açılır)." : "Yükleniyor…"));
      ["pfCuzdan", "pfRekor", "pfBorsa", "pfTahmin"].forEach((id) => { $(id).textContent = ""; });
      zenginler(); return;
    }
    const siralama = [...cuzdanlar].sort((a, b) => deger(b) - deger(a));
    const sira = siralama.findIndex((x) => x.uid === c.uid) + 1;
    const baslik = el("div", "pf-baslik");
    const avatar = el("div", "pf-avatar", (c.kozmetik && c.kozmetik.rozet) || (c.ad || "?").slice(0, 1).toUpperCase());
    const isimKutu = el("div");
    const h = el("h1"); h.append(Ekonomi.isim(c.ad, c.kozmetik || null, { link: false }));
    isimKutu.append(h);
    const rozetler = el("div", "pf-etiketler");
    rozetler.append(el("span", null, `🏅 ${sira}. zengin`), el("span", null, `🔥 ${c.seri || 0} gün seri`), el("span", null, "📅 " + new Date(c.olusturma || Date.now()).toLocaleDateString("tr-TR")));
    if (profile && c.uid === profile.uid) rozetler.append(Object.assign(el("a", "link-btn", "🏆 Başarımlarım"), { href: "/basarimlar" }));
    isimKutu.append(rozetler);
    baslik.append(avatar, isimKutu);
    ust.append(baslik);

    // Cüzdan
    const toplam = deger(c);
    const oz = $("pfCuzdan"); oz.textContent = "";
    const kalemler = [["BERKAY", para(c.bkc || 0)], ["TL", para(c.btl || 0)], ["Toplam değer", para(toplam) + " TL"], ["Borsada gerçekleşen K/Z", isaretli(c.gerceklesen || 0) + " TL"]];
    coinler.forEach((k) => { const m = BC.bakiye(c, k.sym); if (k.sym !== "BERKAY" && m > 1e-9) kalemler.splice(kalemler.length - 2, 0, [k.sym, para(m, m < 10 ? 4 : 2)]); });
    kalemler.forEach(([a, b]) => { const x = el("div"); x.append(el("span", null, a), el("b", null, b)); oz.append(x); });

    // Rekorlar
    const rek = c.rekorlar || {};
    kutu("pfRekor", Object.keys(OYUN).filter((k) => rek[k]).map((k) => satir(OYUN[k][0] + " " + OYUN[k][1], rek[k].toLocaleString("tr-TR") + OYUN[k][2])));

    // Borsa karnesi
    const kapali = gecmis.filter((g) => g.sebep !== "yenileme");
    const enIyi = kapali.filter((g) => g.pnl > 0).sort((a, b) => b.pnl - a.pnl)[0];
    const enKotu = kapali.filter((g) => g.sebep === "likide").sort((a, b) => b.teminat - a.teminat)[0];
    const kazanma = kapali.length ? kapali.filter((g) => g.pnl > 0).length / kapali.length : 0;
    const borsa = [];
    borsa.push(satir("📊 Kapanan işlem", `${kapali.length} · %${(kazanma * 100).toFixed(0)} kârlı`));
    if (enIyi) borsa.push(satir(`🤑 En iyi: ${enIyi.coin || "BERKAY"} ${enIyi.kaldirac}x ${enIyi.yon.toUpperCase()}`, `${isaretli(enIyi.pnl)} TL (${isaretli(enIyi.yuzde, 0)}%)`, "yukari"));
    if (enKotu) borsa.push(satir(`💀 En büyük likidasyon: ${enKotu.coin || "BERKAY"} ${enKotu.kaldirac}x ${enKotu.yon.toUpperCase()}`, `−${para(enKotu.teminat)} TL`, "asagi"));
    pozlari(c.uid).forEach(({ p, dd: d, sym }) => {
      const pnl = E.pnl(p, d.fiyat, d.derinlik);
      borsa.push(satir(`⚡ Açık: ${sym} ${p.kaldirac}x ${p.yon.toUpperCase()}`, `${isaretli(pnl)} TL (${isaretli((pnl / p.teminat) * 100, 0)}%)`, pnl >= 0 ? "yukari" : "asagi"));
    });
    kutu("pfBorsa", kapali.length || borsa.length > 1 ? borsa : []);

    // Tahminler
    const biten = bahisler.filter((b) => b.sonuc);
    const yatirilan = bahisler.reduce((t, b) => t + b.miktar, 0);
    const net = biten.reduce((t, b) => t + (b.odenen || 0) - b.miktar, 0);
    const tah = [];
    if (bahisler.length) {
      tah.push(satir("🎲 Yatırılan", para(yatirilan, 0) + " BERKAY"));
      tah.push(satir("✅ Bildiği", `${biten.filter((b) => b.sonuc === "kazandi").length} / ${biten.filter((b) => b.sonuc !== "iade").length}`));
      tah.push(satir("💰 Net", isaretli(net, 0) + " BERKAY", net >= 0 ? "yukari" : "asagi"));
    }
    kutu("pfTahmin", tah);
    zenginler(c.uid);
  }

  function zenginler(vurgu) {
    const l = [...cuzdanlar].sort((a, b) => deger(b) - deger(a)).slice(0, 15);
    kutu("pfZengin", l.map((c, i) => {
      const r = el("div", "bx-satir" + (c.uid === vurgu ? " pf-vurgu" : ""));
      r.append(el("span", "rk-sira", ["🥇", "🥈", "🥉"][i] || String(i + 1)), Ekonomi.isim(c.ad, c.kozmetik || null), el("span", "bx-sag", para(deger(c)) + " TL"));
      return r;
    }));
  }
})();
