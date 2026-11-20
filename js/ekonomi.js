// ============================================================
// ekonomi.js — her sayfada (site.js'ten sonra) çalışır. BERKAY coin'i sitenin
// her yerine bağlar:
//   - Günlük giriş ödülü: kayıtlı kullanıcı siteye girince günde 1 kez sunucudan ister
//   - Oyun ödülü:  Ekonomi.skor("boks", 812)  → kişisel rekor kırılınca sunucu ödül verir
//                  (çağrılar biriktirilir, birkaç saniye sessizlik olunca en yüksek skor gider)
//   - İsim süsleri: Ekonomi.isim(ad, kozmetik) → renkli ad + rozet + unvan, profil linkli
//   - Cüzdanlar:   Ekonomi.cuzdanlar(cb) → herkesin cüzdanı (zenginler listesi, isim süsleri)
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
    if (!j.ok) throw new Error(j.hata || "Bir şeyler ters gitti.");
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

  // ---------------- Cüzdanlar + isim süsleri ----------------
  let cuzdanListe = null, dinliyor = false;
  const abone = new Set();
  function cuzdanlar(cb) {
    abone.add(cb);
    if (cuzdanListe) cb(cuzdanListe);
    if (!dinliyor && hazir()) {
      dinliyor = true;
      const basla = () => db.collection("borsa_cuzdan").onSnapshot(
        (s) => { cuzdanListe = s.docs.map((d) => d.data()); abone.forEach((f) => f(cuzdanListe)); },
        (err) => console.warn("Cüzdanlar okunamadı:", err.message)
      );
      // giriş yapılmadan okunamaz: auth çözülünce başla
      if (auth.currentUser) basla(); else { const kapat = auth.onAuthStateChanged((u) => { if (u) { kapat(); basla(); } }); }
    }
    return () => abone.delete(cb);
  }
  function kozmetikBul(ad) {
    if (!cuzdanListe) return null;
    const c = cuzdanListe.find((x) => x.ad === ad);
    return c ? c.kozmetik || null : null;
  }
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
    if (secenek.unvan !== false && k && k.unvan && (!k.unvanBitis || k.unvanBitis > Date.now())) {
      const u = document.createElement("small"); u.className = "ek-unvan"; u.textContent = k.unvan; el.appendChild(u);
    }
    return el;
  }

  window.EkonomiApi = api;
  window.Ekonomi = { api, toast, skor, cuzdanlar, isim, kozmetikBul, bugun };
})();
