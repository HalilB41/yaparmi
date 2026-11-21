// ============================================================
// harita.js — topluluk.html "🗺️ Harita": grubun efsanelerinin geçtiği yerler.
// Leaflet + CARTO/OpenStreetMap altlığı; sadece bölüm açılınca yüklenir.
// Firestore: harita/{id} {baslik, ne, hikaye, emoji, lat, lng, ekleyen, resimVar}, harita_resim/{id} {resim}.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const bolum = $("haritaBolum");
  if (!bolum || typeof db === "undefined" || !db) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const EMOJILER = ["💥", "🏍️", "🍔", "🚓", "🍺", "🏥", "⚽", "😴", "💀", "🤮", "💸", "❤️", "🎂", "🏆", "🤡", "📦"];
  const tsMs = (t) => (t && t.toMillis ? t.toMillis() : Date.now());

  let profile = null, harita = null, katman = null, pinler = new Map(), isaretler = new Map(), ekleMod = false, yeniKonum = null, yeniIsaret = null, secEmoji = EMOJILER[0], bekleyenResim = null, basladi = false;
  window.YaparmiAuth.onChange((p) => { profile = p; $("hrEkleBtn").hidden = !p; listeCiz(); });
  window.addEventListener("mk-bolum", (e) => { if (e.detail === "harita") baslat(); });
  if (!bolum.hidden) baslat();

  // --- Leaflet'i gerektiğinde yükle ---
  function leafletYukle() {
    if (window.L) return Promise.resolve();
    return new Promise((coz, red) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="; css.crossOrigin = "";
      document.head.append(css);
      const js = document.createElement("script"); js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      js.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="; js.crossOrigin = "";
      js.onload = () => coz(); js.onerror = () => red(new Error("Harita yüklenemedi (internet?)"));
      document.head.append(js);
    });
  }
  async function baslat() {
    if (basladi) { if (harita) setTimeout(() => harita.invalidateSize(), 50); return; }
    basladi = true;
    try { await leafletYukle(); } catch (e) { $("hrHarita").textContent = e.message; return; }
    harita = L.map("hrHarita", { zoomControl: true, attributionControl: true }).setView([39.2, 35.2], 6);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(harita);
    katman = L.layerGroup().addTo(harita);
    harita.on("click", (e) => { if (ekleMod) konumSec(e.latlng); });
    let ilk = true;
    db.collection("harita").onSnapshot((s) => {
      pinler = new Map(s.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
      isaretleriCiz();
      listeCiz();
      if (ilk) { ilk = false; sigdir(); const h = location.hash.split("/")[1]; if (h && pinler.has(h)) pinAc(h); }
    }, (e) => { $("hrListe").textContent = "Pinler yüklenemedi: " + e.message; });
  }
  function sigdir() {
    const l = [...pinler.values()];
    if (!l.length) return;
    if (l.length === 1) harita.setView([l[0].lat, l[0].lng], 14);
    else harita.fitBounds(L.latLngBounds(l.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
  }
  const ikon = (emoji, yeni) => L.divIcon({ className: "hr-pin" + (yeni ? " yeni" : ""), html: `<span><i>${emoji}</i></span>`, iconSize: [40, 40], iconAnchor: [20, 38], popupAnchor: [0, -34] });
  function isaretleriCiz() {
    katman.clearLayers(); isaretler.clear();
    pinler.forEach((p) => {
      const m = L.marker([p.lat, p.lng], { icon: ikon(EMOJILER.includes(p.emoji) ? p.emoji : "📍"), title: p.baslik, riseOnHover: true });
      m.bindPopup(() => popupIcerik(p), { maxWidth: 300, minWidth: 220, className: "hr-popup" });
      m.on("popupopen", () => history.replaceState(null, "", "#harita/" + p.id));
      m.addTo(katman); isaretler.set(p.id, m);
    });
  }
  function popupIcerik(p) {
    const k = el("div", "hr-pop");
    k.append(el("div", "hr-pop-bas", `${p.emoji || "📍"} ${p.baslik}`));
    if (p.ne) k.append(el("small", "hr-pop-ne", "🗓️ " + p.ne));
    if (p.resimVar) {
      const img = el("img", "hr-pop-resim"); img.alt = p.baslik; k.append(img);
      db.collection("harita_resim").doc(p.id).get().then((s) => { if (s.exists) img.src = s.data().resim; else img.remove(); }).catch(() => img.remove());
    }
    if (p.hikaye) k.append(el("p", null, p.hikaye));
    const alt = el("div", "hr-pop-alt");
    alt.append(el("small", "muted", `📌 ${p.ekleyen} · ${new Date(tsMs(p.tarih)).toLocaleDateString("tr-TR")}`));
    if (profile && (p.ekleyenUid === profile.uid || profile.rol === "admin")) {
      const sil = el("button", "link-btn", "🗑️"); sil.type = "button"; sil.title = "Pini sil";
      sil.addEventListener("click", async () => {
        if (!confirm("Bu pin silinsin mi?")) return;
        try { const b = db.batch(); if (p.resimVar) b.delete(db.collection("harita_resim").doc(p.id)); b.delete(db.collection("harita").doc(p.id)); await b.commit(); harita.closePopup(); }
        catch (e) { alert(e.message); }
      });
      alt.append(sil);
    }
    k.append(alt);
    return k;
  }
  function pinAc(id) {
    const p = pinler.get(id), m = isaretler.get(id);
    if (!p || !m) return;
    bolum.querySelector(".hr-sahne").scrollIntoView({ behavior: "smooth", block: "start" });
    harita.flyTo([p.lat, p.lng], Math.max(harita.getZoom(), 15), { duration: 0.8 });
    setTimeout(() => m.openPopup(), 850);
  }
  function listeCiz() {
    const k = $("hrListe"); if (!k) return;
    k.textContent = "";
    const l = [...pinler.values()].sort((a, b) => tsMs(b.tarih) - tsMs(a.tarih));
    if (!l.length) { const b = el("div", "card hr-bos"); b.append(el("span", null, "🗺️"), el("b", null, "Haritada henüz efsane yok"), el("small", "muted", profile ? "📍 Pin ekle'ye bas, ilk efsaneyi işaretle." : "Giriş yapıp ilk efsaneyi işaretle.")); k.append(b); return; }
    l.forEach((p) => {
      const kart = el("button", "card hr-kart"); kart.type = "button";
      kart.append(el("span", "hr-kart-emoji", p.emoji || "📍"));
      const ic = el("span", "hr-kart-ic");
      ic.append(el("b", null, p.baslik), el("small", "muted", [p.ne, p.ekleyen].filter(Boolean).join(" · ")));
      if (p.hikaye) ic.append(el("span", "hr-kart-hik", p.hikaye.length > 90 ? p.hikaye.slice(0, 87) + "…" : p.hikaye));
      kart.append(ic);
      if (p.resimVar) kart.append(el("span", "hr-kart-foto", "📷"));
      kart.addEventListener("click", () => pinAc(p.id));
      k.append(kart);
    });
  }

  // --- Pin ekleme ---
  const emojiKutu = $("hrEmojiler");
  EMOJILER.forEach((e) => {
    const b = el("button", "hr-emoji" + (e === secEmoji ? " on" : ""), e); b.type = "button"; b.setAttribute("role", "radio");
    b.addEventListener("click", () => { secEmoji = e; emojiKutu.querySelectorAll(".hr-emoji").forEach((x) => x.classList.toggle("on", x === b)); if (yeniIsaret) yeniIsaret.setIcon(ikon(secEmoji, true)); });
    emojiKutu.append(b);
  });
  function modAc(ac) {
    ekleMod = ac;
    $("hrIpucu").hidden = !ac;
    $("hrEkleBtn").classList.toggle("on", ac);
    $("hrHarita").classList.toggle("ekle", ac);
  }
  $("hrEkleBtn").addEventListener("click", () => {
    if (!profile) return;
    if (!harita) return;
    if ($("hrForm").hidden) modAc(!ekleMod); else formKapat();
  });
  $("hrIptal").addEventListener("click", () => modAc(false));
  $("hrKonum").addEventListener("click", () => {
    if (!harita || !navigator.geolocation) return;
    $("hrKonum").disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      $("hrKonum").disabled = false;
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      harita.flyTo(ll, 16, { duration: 0.8 });
      if (ekleMod) konumSec(ll);
    }, () => { $("hrKonum").disabled = false; alert("Konum alınamadı (izin verilmedi?)."); }, { enableHighAccuracy: true, timeout: 10000 });
  });
  function konumSec(ll) {
    yeniKonum = ll;
    if (yeniIsaret) yeniIsaret.setLatLng(ll);
    else { yeniIsaret = L.marker(ll, { icon: ikon(secEmoji, true), draggable: true }).addTo(harita); yeniIsaret.on("dragend", () => { yeniKonum = yeniIsaret.getLatLng(); }); }
    modAc(false);
    $("hrForm").hidden = false;
    $("hrDurum").textContent = "Pini sürükleyerek yerini düzeltebilirsin.";
    $("hrForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("hrBaslik").focus({ preventScroll: true });
  }
  function formKapat() {
    $("hrForm").hidden = true; $("hrForm").reset(); bekleyenResim = null; yeniKonum = null;
    if (yeniIsaret) { harita.removeLayer(yeniIsaret); yeniIsaret = null; }
    modAc(false);
  }
  $("hrFormIptal").addEventListener("click", formKapat);
  $("hrFoto").addEventListener("change", async () => {
    const f = $("hrFoto").files[0]; bekleyenResim = null; if (!f) return;
    try { bekleyenResim = await resimKucult(f, 900, 300000); $("hrDurum").textContent = "📷 Fotoğraf hazır."; }
    catch (e) { $("hrDurum").textContent = "⚠️ " + e.message; $("hrFoto").value = ""; }
  });
  $("hrForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!profile || !yeniKonum) return;
    const baslik = $("hrBaslik").value.trim();
    if (baslik.length < 2) { $("hrDurum").textContent = "⚠️ Bir başlık yaz."; return; }
    const b = e.target.querySelector('button[type="submit"]'); b.disabled = true; $("hrDurum").textContent = "Kaydediliyor…";
    try {
      const ref = db.collection("harita").doc();
      const batch = db.batch();
      batch.set(ref, {
        baslik, ne: $("hrNe").value.trim().slice(0, 40), hikaye: $("hrHikaye").value.trim().slice(0, 600), emoji: secEmoji,
        lat: Math.round(yeniKonum.lat * 1e6) / 1e6, lng: Math.round(yeniKonum.lng * 1e6) / 1e6,
        ekleyen: profile.kullaniciAdi, ekleyenUid: profile.uid, tarih: firebase.firestore.FieldValue.serverTimestamp(), resimVar: !!bekleyenResim,
      });
      if (bekleyenResim) batch.set(db.collection("harita_resim").doc(ref.id), { resim: bekleyenResim, yukleyenUid: profile.uid });
      await batch.commit();
      formKapat();
      if (window.Ekonomi) Ekonomi.toast("📍 Efsane haritaya işlendi", 2500);
      setTimeout(() => pinAc(ref.id), 600);
    } catch (err) { $("hrDurum").textContent = "⚠️ " + err.message; }
    finally { b.disabled = false; }
  });
})();
