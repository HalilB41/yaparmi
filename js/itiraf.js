// ============================================================
// itiraf.js — topluluk.html "🤫 İtiraflar": anonim itiraf yaz, onaylananları oku, tepki bırak.
// Yazma ve tepki sunucudan (api/borsa.js → itirafIslem); kimin yazdığı hiçbir yerde tutulmaz.
// Okuma: itiraf_yayin (son 40), sadece bölüm açıkken dinlenir.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const bolum = $("itirafBolum");
  if (!bolum) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const TEPKILER = ["😂", "💀", "😳", "🔥", "🤡", "❤️"];
  let profile = null, dinliyor = false, liste = [];
  const benimKey = "yaparmi_itiraf_tepki";
  const benim = (() => { try { return JSON.parse(localStorage.getItem(benimKey) || "{}"); } catch { return {}; } })();
  const benimKaydet = () => { try { localStorage.setItem(benimKey, JSON.stringify(benim)); } catch { /* yok */ } };

  function once(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "az önce";
    if (s < 3600) return Math.floor(s / 60) + " dk önce";
    if (s < 86400) return Math.floor(s / 3600) + " saat önce";
    if (s < 86400 * 7) return Math.floor(s / 86400) + " gün önce";
    return new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  }

  // --- Yazma ---
  const form = $("itForm"), metin = $("itMetin");
  metin.addEventListener("input", () => { $("itSay").textContent = metin.value.length + " / 280"; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = metin.value.trim();
    if (t.length < 5) { durum("Biraz daha yaz, en az 5 karakter.", true); return; }
    const b = form.querySelector("button"); b.disabled = true;
    try {
      const r = await Ekonomi.api("itirafGonder", { metin: t });
      metin.value = ""; $("itSay").textContent = "0 / 280";
      durum(`🤐 Gönderildi! Admin onaylayınca burada görünecek. Bugün ${r.kalan} hakkın kaldı.`);
    } catch (err) { durum("⚠️ " + err.message, true); }
    finally { b.disabled = false; }
  });
  function durum(m, hata) { const e = $("itDurum"); e.textContent = m || ""; e.classList.toggle("hata", !!hata); }

  window.YaparmiAuth.onChange((p) => {
    profile = p;
    $("itGiris").hidden = !!p; form.hidden = !p;
    ciz();
  });

  // --- Okuma ---
  function baslat() {
    if (dinliyor || typeof db === "undefined" || !db) return;
    dinliyor = true;
    db.collection("itiraf_yayin").orderBy("t", "desc").limit(40).onSnapshot((s) => {
      liste = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      ciz();
    }, (err) => { $("itListe").innerHTML = ""; $("itListe").append(el("p", "muted", "İtiraflar yüklenemedi: " + err.message)); });
  }
  function ciz() {
    const k = $("itListe");
    if (!dinliyor) return;
    k.textContent = "";
    if (!liste.length) {
      const b = el("div", "it-bos"); b.append(el("span", null, "🤫"), el("b", null, "Henüz itiraf yok"), el("small", "muted", "İlk günahı sen çıkar."));
      k.append(b); return;
    }
    liste.forEach((x, i) => {
      const kart = el("article", "card it-kart");
      kart.style.setProperty("--it-renk", ["#7c3aed", "#db2777", "#ea580c", "#0891b2", "#16a34a", "#ca8a04"][i % 6]);
      const ust = el("div", "it-ust");
      ust.append(el("span", "it-no", "#" + (x.no || x.id.slice(0, 4).toUpperCase())), el("time", "muted", once(x.t || x.yayin || Date.now())));
      const m = el("p", "it-metin", x.metin);
      const tepki = el("div", "it-tepkiler");
      TEPKILER.forEach((e) => {
        const n = (x.tepki || {})[e] || 0;
        const b = el("button", "it-tepki" + (benim[x.id] === e ? " on" : "") + (n ? " var" : ""));
        b.type = "button"; b.title = profile ? "Tepki ver" : "Tepki için giriş yap";
        b.append(el("span", null, e)); if (n) b.append(el("b", null, String(n)));
        b.addEventListener("click", () => tepkiVer(x, e, b));
        tepki.append(b);
      });
      kart.append(ust, m, tepki);
      k.append(kart);
    });
  }
  async function tepkiVer(x, e, b) {
    if (!profile) { durum("Tepki vermek için giriş yap.", true); return; }
    b.disabled = true;
    // anında göster, sunucu cevabıyla düzelt
    const eski = benim[x.id];
    x.tepki = { ...(x.tepki || {}) };
    if (eski) x.tepki[eski] = Math.max(0, (x.tepki[eski] || 0) - 1);
    if (eski === e) delete benim[x.id]; else { benim[x.id] = e; x.tepki[e] = (x.tepki[e] || 0) + 1; }
    ciz();
    try {
      const r = await Ekonomi.api("itirafTepki", { id: x.id, emoji: e });
      x.tepki = r.tepki; if (r.benim) benim[x.id] = r.benim; else delete benim[x.id];
      benimKaydet(); ciz();
    } catch (err) { durum("⚠️ " + err.message, true); if (eski) benim[x.id] = eski; else delete benim[x.id]; ciz(); }
  }

  window.addEventListener("mk-bolum", (ev) => { if (ev.detail === "itiraf") baslat(); });
  if (!bolum.hidden) baslat();
})();
