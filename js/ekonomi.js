// ============================================================
// ekonomi.js — her sayfada (site.js'ten sonra) çalışır. BERKAY coin'i sitenin
// her yerine bağlar:
//   - Günlük giriş ödülü: kayıtlı kullanıcı siteye girince günde 1 kez sunucudan ister
//   - Oyun ödülü:  Ekonomi.skor("boks", 812)  → kişisel rekor kırılınca sunucu ödül verir
//                  (çağrılar biriktirilir, birkaç saniye sessizlik olunca en yüksek skor gider)
//   - İsim süsleri: Ekonomi.isim(ad, kozmetik) → renkli ad + rozet + unvan, profil linkli
//   - Özet:        Ekonomi.ozet(cb) → zenginler, bu hafta, isim süsleri, son dakika (sunucunun hazırladığı tek belge)
//   - Cüzdanım:    Ekonomi.cuzdanim(cb) → sadece kendi cüzdanım
// Bütün coin hareketleri sunucuda (api/borsa.js) yapılır; burası sadece ister ve gösterir.
// ============================================================
(function () {
  "use strict";
  const hazir = () => typeof db !== "undefined" && db && typeof auth !== "undefined" && auth;
  const kayitli = () => hazir() && auth.currentUser && !auth.currentUser.isAnonymous && window.YaparmiAuth && YaparmiAuth.getProfile && YaparmiAuth.getProfile();
  const bugun = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

  async function api(islem, veri) {
    if (!kayitli()) throw new Error("Önce giriş yap.");
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
    if (!j.ok) { if (j.kota && window.YaparmiKota) YaparmiKota.bildir(); throw new Error(j.hata || "Bir şeyler ters gitti."); }
    return j;
  }

  // ---------------- Bildirim balonu ----------------
  let toastEl = null, toastZaman = null;
  function toast(msg, sure) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "ek-toast";
      toastEl.setAttribute("role", "status");
      toastEl.addEventListener("click", () => { toastEl.hidden = true; });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastZaman);
    toastZaman = setTimeout(() => { toastEl.hidden = true; }, sure || 4000);
  }

  // ---------------- Günlük giriş ödülü ----------------
  async function gunluk() {
    const p = kayitli();
    if (!p) return;
    const anahtar = "yaparmi_gunluk_" + p.uid;
    try { if (localStorage.getItem(anahtar) === bugun()) return; } catch { /* yok */ }
    try {
      const r = await api("gunluk");
      try { localStorage.setItem(anahtar, bugun()); } catch { /* yok */ }
      if (r.odul > 0) {
        let m = `🎁 Günlük ödül +${r.odul} BERKAY · 🔥 ${r.seri}. gün`;
        if (r.bonus) m += ` (seri bonusu +${r.bonus}!)`;
        if (r.kayitBonusu) m = `🎉 Hoş geldin! ${r.kayitBonusu} BERKAY kayıt hediyesi + ` + m.slice(2);
        toast(m, 6000);
      }
    } catch (err) {
      // sunucu ayarlı değilse ya da ağ yoksa sessiz geç; yarın yine dener
      console.warn("Günlük ödül:", err.message);
    }
  }
  if (window.YaparmiAuth) YaparmiAuth.onChange((p) => { if (p) setTimeout(gunluk, 800); });

  // ---------------- Oyun ödülü ----------------
  const bekleyen = {}, gonderilen = {}, zamanlayici = {};
  const OYUN_AD = { boks: "Boks", penalti: "Penaltı", motor: "Kasksız 85", g2048: "2048", yilan: "Yılan" };
  function skor(oyun, deger) {
    deger = Math.round(Number(deger) || 0);
    if (!deger || !kayitli()) return;
    if (deger <= (bekleyen[oyun] || 0) || deger <= (gonderilen[oyun] || 0)) return;
    bekleyen[oyun] = deger;
    clearTimeout(zamanlayici[oyun]);
    zamanlayici[oyun] = setTimeout(() => gonder(oyun), 3000);
  }
  async function gonder(oyun) {
    const deger = bekleyen[oyun];
    delete bekleyen[oyun];
    if (!deger || deger <= (gonderilen[oyun] || 0)) return;
    gonderilen[oyun] = deger;
    try {
      const r = await api("oyunSkor", { oyun, skor: deger });
      if (r.odul > 0) toast(`🏆 ${OYUN_AD[oyun] || oyun} rekoru ${r.skor.toLocaleString("tr-TR")}! +${r.odul} BERKAY`, 5000);
      else if (r.limitDoldu) toast(`🏆 Yeni ${OYUN_AD[oyun] || oyun} rekoru! (Bu oyundan bugünkü BERKAY sınırı doldu)`, 4000);
    } catch (err) { console.warn("Oyun ödülü:", err.message); }
  }
  // Sayfadan çıkarken bekleyenleri hemen gönder
  addEventListener("pagehide", () => Object.keys(bekleyen).forEach(gonder));

  // ---------------- Özet + kendi cüzdanım + isim süsleri ----------------
  // Firestore okuma kotası için: herkesin cüzdanı OKUNMAZ. Sunucu 10 dk'da bir borsa/ozet belgesi
  // hazırlar (zenginler, bu hafta, isim süsleri, son dakika); sayfalar sadece onu (1 okuma) dinler.
  let ozetVeri = null, ozetDinliyor = false, ozetIstendi = false;
  const ozetAbone = new Set();
  function ozet(cb) {
    if (cb) { ozetAbone.add(cb); if (ozetVeri) cb(ozetVeri); }
    if (!ozetDinliyor && hazir()) {
      ozetDinliyor = true;
      db.collection("borsa").doc("ozet").onSnapshot((s) => {
        ozetVeri = s.exists ? s.data() : { zengin: [], kisi: {}, kozmetik: {}, hafta: [] };
        ozetAbone.forEach((f) => f(ozetVeri));
        olayGoster(ozetVeri.olay);
        sampiyonGoster(ozetVeri.ligGecen);
        // Özet yoksa ya da 15 dk'dan eskiyse sunucudan yenilemesini iste (sayfa başına en fazla bir kez)
        if (!ozetIstendi && (!s.exists || Date.now() - (ozetVeri.t || 0) > 15 * 60000)) {
          ozetIstendi = true;
          const iste = () => { if (kayitli()) api("ozet").catch(() => {}); };
          if (kayitli()) iste(); else if (window.YaparmiAuth) YaparmiAuth.onChange((p) => { if (p) iste(); });
        }
      }, (err) => console.warn("Özet okunamadı:", err.message));
    }
    return () => ozetAbone.delete(cb);
  }
  // Kendi cüzdanım (tek belge)
  let benimVeri = null, benimUid = null;
  const benimAbone = new Set();
  function cuzdanim(cb) {
    benimAbone.add(cb);
    if (benimVeri) cb(benimVeri);
    const p = kayitli();
    if (p && benimUid !== p.uid) {
      benimUid = p.uid;
      db.collection("borsa_cuzdan").doc(p.uid).onSnapshot((s) => {
        benimVeri = s.exists ? s.data() : null;
        benimAbone.forEach((f) => f(benimVeri));
      }, (err) => console.warn("Cüzdan okunamadı:", err.message));
    } else if (!p && window.YaparmiAuth) {
      YaparmiAuth.onChange((pp) => { if (pp && !benimUid) cuzdanim(() => {}); });
    }
    return () => benimAbone.delete(cb);
  }
  // Eski arayüz: bütün cüzdanlar. ARTIK KULLANILMIYOR (çok okuma yapıyordu); sadece admin kendi okur.
  function cuzdanlar(cb) {
    console.warn("Ekonomi.cuzdanlar yerine Ekonomi.ozet / Ekonomi.cuzdanim kullan.");
    return cuzdanim((c) => cb(c ? [c] : []));
  }
  function kozmetikBul(ad) {
    if (benimVeri && benimVeri.ad === ad) return benimVeri.kozmetik || null; // kendi süsüm anında görünsün
    return (ozetVeri && ozetVeri.kozmetik && ozetVeri.kozmetik[ad]) || null;
  }

  // ---------------- Ana sayfada haftanın şampiyonu ----------------
  function sampiyonGoster(lg) {
    if (!/^\/(index\.html)?$/.test(location.pathname)) return;
    const k = lg && lg.kazananlar && lg.kazananlar[0];
    if (!k) return;
    let s = document.getElementById("ekSampiyon");
    if (!s) {
      const hedef = document.querySelector("main .page-head, main header, main");
      if (!hedef) return;
      s = document.createElement("a"); s.id = "ekSampiyon"; s.className = "ek-sampiyon"; s.href = "/kumarhane#lig";
      if (hedef.tagName === "MAIN") hedef.prepend(s); else hedef.after(s);
    }
    s.textContent = "";
    const tac = document.createElement("span"); tac.className = "ek-sampiyon-tac"; tac.textContent = "👑";
    const yazi = document.createElement("span");
    const b = document.createElement("b"); b.textContent = k.ad;
    yazi.append("Haftanın şampiyonu ", b, ` · ${Math.round(k.xp).toLocaleString("tr-TR")} XP`);
    const ok = document.createElement("small"); ok.textContent = "Lige bak →";
    s.append(tac, yazi, ok);
  }

  // ---------------- Wrapped duyurusu (15 Aralık – 15 Ocak, ana sayfa) ----------------
  (function wrappedDuyuru() {
    if (!/^\/(index\.html)?$/.test(location.pathname)) return;
    const d = new Date(Date.now() + 3 * 3600000), ay = d.getUTCMonth(), gun = d.getUTCDate();
    if (!((ay === 11 && gun >= 15) || (ay === 0 && gun <= 15))) return;
    const yil = ay === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
    const koy = () => {
      const hedef = document.querySelector("main .page-head, main header, main");
      if (!hedef || document.getElementById("ekWrapped")) return;
      const a = document.createElement("a"); a.id = "ekWrapped"; a.className = "ek-sampiyon ek-wrapped"; a.href = "/wrapped";
      const t = document.createElement("span"); t.className = "ek-sampiyon-tac"; t.textContent = "🎁";
      const y = document.createElement("span"); const b = document.createElement("b"); b.textContent = `Berkay Wrapped ${yil}`; y.append(b, " çıktı! Yılın nasıl geçti?");
      const ok = document.createElement("small"); ok.textContent = "Gör →";
      a.append(t, y, ok);
      if (hedef.tagName === "MAIN") hedef.prepend(a); else hedef.after(a);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", koy); else koy();
  })();

  // ---------------- Son dakika bandı (admin "olay" yayınlayınca, her sayfada) ----------------
  function olayGoster(o) {
    if (!o || !o.t || Date.now() - o.t > 30 * 60000) return;
    try { if (localStorage.getItem("yaparmi_olay_kapandi") === String(o.t)) return; } catch { /* yok */ }
    let bant = document.getElementById("ekOlay");
    if (!bant) {
      bant = document.createElement("div");
      bant.id = "ekOlay"; bant.className = "ek-olay"; bant.setAttribute("role", "status");
      document.body.appendChild(bant);
    }
    bant.textContent = "";
    const etiket = document.createElement("b"); etiket.textContent = "📰 SON DAKİKA";
    const link = document.createElement("a");
    link.href = "/borsa#" + encodeURIComponent(o.sym || "BERKAY");
    link.textContent = `${o.baslik} · ${o.sym} ${o.etki > 0 ? "▲ +" : "▼ "}${o.etki}%`;
    link.className = "ek-olay-link";
    const kapat = document.createElement("button"); kapat.type = "button"; kapat.textContent = "✕"; kapat.setAttribute("aria-label", "Kapat");
    kapat.addEventListener("click", () => { bant.hidden = true; try { localStorage.setItem("yaparmi_olay_kapandi", String(o.t)); } catch { /* yok */ } });
    bant.append(etiket, link, kapat);
    bant.hidden = false;
  }
  // Her sayfada özeti dinle (isim süsleri + son dakika): sayfa başına 1 okuma
  if (hazir()) setTimeout(() => ozet(), 300);

  // Renkli ad + rozet (+ istenirse unvan). Profil sayfasına link verir.
  function isim(ad, kozmetik, secenek) {
    secenek = secenek || {};
    const k = kozmetik === undefined ? kozmetikBul(ad) : kozmetik;
    const el = document.createElement(secenek.link === false ? "span" : "a");
    el.className = "ek-isim";
    if (secenek.link !== false) el.href = "/profil?k=" + encodeURIComponent(ad || "");
    const yazi = document.createElement("b");
    yazi.textContent = ad || "?";
    if (k && /^#[0-9a-fA-F]{6}$/.test(k.renk || "")) yazi.style.color = k.renk;
    el.appendChild(yazi);
    if (k && k.rozet) { const r = document.createElement("span"); r.className = "ek-rozet"; r.textContent = k.rozet; el.appendChild(r); }
    // Geçen haftanın lig şampiyonu: her yerde taç
    const sampiyon = ozetVeri && ozetVeri.ligGecen && ozetVeri.ligGecen.kazananlar && ozetVeri.ligGecen.kazananlar[0];
    if (sampiyon && sampiyon.ad === ad) { const t = document.createElement("span"); t.className = "ek-tac"; t.textContent = "👑"; t.title = "Haftanın şampiyonu"; el.appendChild(t); }
    if (secenek.unvan !== false && k && k.unvan && (!k.unvanBitis || k.unvanBitis > Date.now())) {
      const u = document.createElement("small"); u.className = "ek-unvan"; u.textContent = k.unvan; el.appendChild(u);
    }
    return el;
  }

  window.EkonomiApi = api;
  window.Ekonomi = { api, toast, skor, cuzdanlar, cuzdanim, ozet, isim, kozmetikBul, bugun };
})();
