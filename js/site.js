// ============================================================
// site.js — TÜM sayfalarda ortak çalışır: üst bar (logo, bölümler,
// tema düğmesi), sağ üstteki Giriş Yap / Kayıt Ol widget'ı, alt bilgi,
// ve galeri fotoğraflarını aynı boyuta küçültme yardımcı fonksiyonu.
//
// Not: Bu, Berkayın Ahırı'ndaki takma ad ile AYNI şey DEĞİL. Ahır'da
// sadece bir takma ad seçiliyor (şifresiz, geçici). Burası gerçek bir
// hesap: kullanıcı adı + şifre ile "kayıt ol/giriş yap", Firebase
// Authentication (e-posta/şifre) üzerinden çalışıyor — kullanıcı adını
// "kullaniciadi@yaparmi.local" gibi sahte bir e-postaya çevirip
// kullanıyoruz, hiçbir yere gerçek mail atılmıyor.
// ============================================================

// ---------------- Kota koruması (tüm sayfalarda, diğer her şeyden önce) ----------------
// Firebase ücretsiz planı günlük okuma kotası dolunca ("resource-exhausted") sayfalar boş kalmasın:
//   1) Üstte "site dinleniyor, şu saatte döner" bandı çıkar (bir kez).
//   2) Daha önce görülen bazı belgeler (borsa fiyatları, coin listesi, özet, sayaçlar, ayarlar)
//      tarayıcıda saklanır; kota doluyken onlar "son görülen" olarak gösterilir.
// Firestore'un kendi sınıflarına sarmalayıcı eklenir; bir şey ters giderse orijinal çağrı aynen çalışır.
(function () {
  "use strict";
  const ONEK = "yaparmi_on:";
  const IZINLI = /^(borsa\/(durum|durum_[A-Z0-9]+|coinler|ozet|ekonomi)|sayaclar\/[^/]+|ayarlar\/[^/]+|spor\/[^/]+|cark\/ayarlar)$/;
  const kotaHatasi = (e) => !!e && (e.code === "resource-exhausted" || /quota|resource.exhausted/i.test(String(e.message || "")));
  // Kota Pasifik saatiyle gece yarısı sıfırlanır: Türkiye'de kışın 11:00, yazın 10:00
  function donusSaati() {
    try { return /PDT/.test(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" })) ? "10:00" : "11:00"; } catch { return "11:00"; }
  }
  let bildirildi = false;
  function bildir() {
    if (bildirildi) return;
    bildirildi = true;
    const goster = () => {
      if (document.getElementById("kotaBant")) return;
      const b = document.createElement("div");
      b.id = "kotaBant"; b.className = "kota-bant"; b.setAttribute("role", "status");
      b.innerHTML = "<b>😴 Site bugünlük dinleniyor</b><span>Ücretsiz veri sınırı doldu. Borsa, galeri, profil gibi kısımlar Türkiye saatiyle <b>" + donusSaati() + "</b>'de geri gelir (şimdilik son görülen bilgiler gösteriliyor). Kâhin ve oyunlar çalışıyor.</span>";
      const x = document.createElement("button"); x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Kapat");
      x.addEventListener("click", () => b.remove());
      b.appendChild(x);
      document.body.appendChild(b);
    };
    if (document.body) goster(); else document.addEventListener("DOMContentLoaded", goster);
  }
  window.YaparmiKota = { bildir, kotaHatasi, donusSaati };

  try {
    const fs = window.firebase && firebase.firestore;
    if (!fs || !fs.DocumentReference || !fs.Query) return;
    // JSON'a çevrilebilir kopya (Timestamp → {__ts}) ve geri çevirme
    const duz = (v) => {
      if (v && typeof v === "object") {
        if (typeof v.toMillis === "function") return { __ts: v.toMillis() };
        if (Array.isArray(v)) return v.map(duz);
        const o = {}; for (const k in v) o[k] = duz(v[k]); return o;
      }
      return v;
    };
    const canlandir = (v) => {
      if (v && typeof v === "object") {
        if (typeof v.__ts === "number" && Object.keys(v).length === 1) return fs.Timestamp && fs.Timestamp.fromMillis ? fs.Timestamp.fromMillis(v.__ts) : new Date(v.__ts);
        if (Array.isArray(v)) return v.map(canlandir);
        const o = {}; for (const k in v) o[k] = canlandir(v[k]); return o;
      }
      return v;
    };
    const yolu = (ref) => { try { return ref instanceof fs.DocumentReference ? ref.path : null; } catch { return null; } };
    function sakla(yol, snap) {
      if (!yol || !IZINLI.test(yol) || !snap || !snap.exists) return;
      try { const j = JSON.stringify({ t: Date.now(), v: duz(snap.data()) }); if (j.length < 300000) localStorage.setItem(ONEK + yol, j); } catch { /* yer yok */ }
    }
    function sahte(ref, yol) {
      if (!yol || !IZINLI.test(yol)) return null;
      let k = null;
      try { k = JSON.parse(localStorage.getItem(ONEK + yol) || "null"); } catch { k = null; }
      if (!k) return null;
      const veri = canlandir(k.v);
      return { exists: true, id: ref.id, ref, metadata: { fromCache: true, hasPendingWrites: false }, data: () => canlandir(k.v), get: (alan) => veri[alan], _yedek: true };
    }
    const D = fs.DocumentReference.prototype, Q = fs.Query.prototype;
    // onSnapshot(sarmal): başarıda sakla, kota hatasında bant + son görülen
    function onSnapshotSar(asil, belgeMi) {
      return function (...args) {
        try {
          let i = 0;
          if (args[0] && typeof args[0] === "object" && typeof args[0].next !== "function" && typeof args[1] === "function") i = 1; // seçenekler
          let next, error, complete;
          if (args[i] && typeof args[i] === "object") { const o = args[i]; next = o.next && o.next.bind(o); error = o.error && o.error.bind(o); complete = o.complete && o.complete.bind(o); }
          else { next = args[i]; error = args[i + 1]; complete = args[i + 2]; }
          if (typeof next !== "function") return asil.apply(this, args);
          const ref = this, yol = belgeMi ? yolu(this) : null;
          const yeniNext = (snap) => { if (belgeMi) sakla(yol, snap); return next(snap); };
          const yeniError = (err) => {
            if (kotaHatasi(err)) {
              bildir();
              const y = belgeMi ? sahte(ref, yol) : null;
              if (y) { try { next(y); } catch (e) { console.warn(e); } return; }
            }
            if (typeof error === "function") return error(err);
            console.warn("Firestore:", err && err.message);
          };
          const yeni = args.slice(0, i);
          yeni.push(yeniNext, yeniError);
          if (complete) yeni.push(complete);
          return asil.apply(this, yeni);
        } catch (e) {
          return asil.apply(this, args);
        }
      };
    }
    function getSar(asil, belgeMi) {
      return function (...args) {
        const ref = this, yol = belgeMi ? yolu(this) : null;
        let p;
        try { p = asil.apply(this, args); } catch (e) { throw e; }
        if (!p || typeof p.then !== "function") return p;
        return p.then((snap) => { if (belgeMi) sakla(yol, snap); return snap; }, (err) => {
          if (kotaHatasi(err)) { bildir(); const y = belgeMi ? sahte(ref, yol) : null; if (y) return y; }
          throw err;
        });
      };
    }
    D.onSnapshot = onSnapshotSar(D.onSnapshot, true);
    D.get = getSar(D.get, true);
    Q.onSnapshot = onSnapshotSar(Q.onSnapshot, false);
    Q.get = getSar(Q.get, false);
    // Yazma işlemleri de kota hatası verirse bandı göster
    ["set", "update", "delete"].forEach((ad) => {
      const asil = D[ad];
      if (typeof asil !== "function") return;
      D[ad] = function (...a) { const p = asil.apply(this, a); return p && p.catch ? p.catch((e) => { if (kotaHatasi(e)) bildir(); throw e; }) : p; };
    });
  } catch (e) {
    console.warn("Kota koruması kurulamadı:", e && e.message);
  }
})();

(function () {
  // ---------------- Üst bar + alt bilgi (tüm sayfalarda ortak) ----------------
  // Menü, logo, tema düğmesi ve Giriş Yap butonu buradan eklenir; sayfaların
  // HTML'inde sadece kendi içerikleri var.
  const NAV = [
    ["/", "Kâhin"], ["/spor", "Spor"], ["/sosyal", "Sosyal hayat"], ["/galeri", "Galeri"],
    ["/borsa", "Borsa"], ["/kumarhane", "Kumarhane"], ["/cark", "Çark"], ["/topluluk", "Topluluk"],
  ];
  const here = (location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/").replace(/\/+$/, "") || "/");
  // Logo: içinde soru işareti olan konuşma balonu + sarı yıldız (renkler CSS'ten, .brand-mark)
  const ORB =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-6 12 12)">' +
    '<path class="bm-bubble" d="M8 3h8a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5h-6.3l-3.7 3.3c-.5.45-1.3.1-1.3-.57v-3.1A5 5 0 0 1 3 12V8a5 5 0 0 1 5-5z"/>' +
    '<path class="bm-q" d="M9.7 8.2a2.4 2.4 0 1 1 3.5 2.15c-.75.38-1.2.95-1.2 1.75v.25" fill="none" stroke-width="2.3" stroke-linecap="round"/>' +
    '<circle class="bm-dot" cx="12" cy="14.9" r="1.3"/></g>' +
    '<path class="bm-spark" d="M20.6 .6l.75 1.7 1.7.75-1.7.75-.75 1.7-.75-1.7-1.7-.75 1.7-.75z"/></svg>';
  const MOON = '<svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const SUN = '<svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  const RENKLER = [
    ["", "Kâhin moru", "#5a3fd4"], ["popeyes", "Popeyes turuncusu", "#e8590c"],
    ["pembe", "Ehliyet pembesi", "#d6336c"], ["tarla", "Tarla yeşili", "#2b8a3e"],
  ];
  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.innerHTML =
    '<div class="topbar-in">' +
    '<a class="brand" href="/" aria-label="yaparmi.com ana sayfa"><span class="brand-mark">' + ORB + '</span><span class="brand-word">yaparmı<b>?</b><small>.com</small></span></a>' +
    '<nav class="mainnav" aria-label="Bölümler">' +
    NAV.map(([href, label]) => '<a href="' + href + '"' + (href === here ? ' class="on" aria-current="page"' : "") + ">" + label + "</a>").join("") +
    "</nav>" +
    '<div class="top-actions">' +
    '<div class="tema-widget"><button type="button" class="icon-btn theme-btn" id="themeBtn" aria-label="Tema ve ayarlar" aria-expanded="false">' + MOON + SUN + "</button>" +
    '<div class="card tema-panel" id="temaPanel" hidden>' +
    '<div class="tema-baslik">Görünüm</div>' +
    '<div class="tema-mod" role="group" aria-label="Açık / koyu">' +
    '<button type="button" data-mod="light">☀️ Açık</button><button type="button" data-mod="dark">🌙 Koyu</button><button type="button" data-mod="">💻 Sistem</button></div>' +
    '<div class="tema-baslik">Renk</div>' +
    '<div class="tema-renkler">' +
    RENKLER.map(([k, ad, c]) => '<button type="button" data-renk="' + k + '" title="' + ad + '" aria-label="' + ad + '" style="--sw:' + c + '"><i></i><span>' + ad + "</span></button>").join("") +
    "</div>" +
    '<div class="tema-baslik">Bildirimler</div>' +
    '<button type="button" class="tema-bildirim" id="bildirimBtn">🔔 Sohbet bildirimlerini aç</button>' +
    '<p class="tema-not" id="bildirimNot"></p>' +
    "</div></div>" +
    '<div class="auth-widget" id="authWidget"><button type="button" class="auth-toggle" id="authToggle">Giriş yap</button><div class="card auth-panel" id="authPanel" hidden></div></div>' +
    "</div></div>";
  document.body.insertBefore(topbar, document.body.firstChild);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML =
    '<div class="site-footer-in"><span>yaparmi.com · sadece eğlence amaçlıdır, kimse alınmasın.</span><nav>' +
    NAV.slice(1).concat([["/profil", "Profil"]]).map(([href, label]) => '<a href="' + href + '">' + label + "</a>").join("") + "</nav></div>";
  document.body.appendChild(footer);

  // ---------------- Telefon: alt menü çubuğu + "Menü" sayfası ----------------
  // Sadece dar ekranda görünür (CSS: .alt-bar). Üstteki yatay menü telefonda gizlenir.
  const ALT = [["/", "🔮", "Kâhin"], ["/borsa", "📈", "Borsa"], ["/kumarhane", "🎰", "Kumar"], ["/cark", "🎡", "Çark"]];
  const IKON = { "/": "🔮", "/spor": "🥊", "/sosyal": "🎭", "/galeri": "🖼️", "/borsa": "📈", "/kumarhane": "🎰", "/cark": "🎡", "/topluluk": "📊" };
  const altBar = document.createElement("nav");
  altBar.className = "alt-bar";
  altBar.setAttribute("aria-label", "Hızlı menü");
  altBar.innerHTML =
    ALT.map(([href, ico, ad]) => '<a href="' + href + '"' + (href === here ? ' class="on" aria-current="page"' : "") + "><i>" + ico + "</i><span>" + ad + "</span></a>").join("") +
    '<button type="button" id="altMenuBtn" aria-expanded="false" aria-controls="altSayfa"><i>☰</i><span>Menü</span></button>';
  const altSayfa = document.createElement("div");
  altSayfa.className = "alt-sayfa";
  altSayfa.id = "altSayfa";
  altSayfa.hidden = true;
  altSayfa.innerHTML =
    '<div class="alt-sayfa-kart" role="dialog" aria-label="Bütün bölümler"><div class="alt-tutamac"></div>' +
    '<div class="alt-izgara">' +
    NAV.concat([["/profil", "Profilim"], ["/topluluk#wiki", "Berkaypedia"], ["/topluluk#harita", "Harita"], ["/topluluk#olasi", "Kim daha olası?"], ["/topluluk#tahmin", "Tahmin"], ["/topluluk#soz", "Sözler"], ["/topluluk#itiraf", "İtiraflar"]]).map(([href, ad]) =>
      '<a href="' + href + '"' + (href === here ? ' class="on"' : "") + "><i>" + (IKON[href] || ({ "/profil": "👤", "/topluluk#wiki": "📖", "/topluluk#harita": "🗺️", "/topluluk#olasi": "🤔", "/topluluk#tahmin": "🎲", "/topluluk#soz": "🤝", "/topluluk#itiraf": "🤫" })[href] || "🏆") + "</i><span>" + ad + "</span></a>").join("") +
    "</div></div>";
  document.body.appendChild(altBar);
  document.body.appendChild(altSayfa);
  const altBtn = document.getElementById("altMenuBtn");
  const altKapat = () => { altSayfa.hidden = true; altBtn.setAttribute("aria-expanded", "false"); };
  altBtn.addEventListener("click", () => { altSayfa.hidden = !altSayfa.hidden; altBtn.setAttribute("aria-expanded", String(!altSayfa.hidden)); });
  altSayfa.addEventListener("click", (e) => { if (e.target === altSayfa) altKapat(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !altSayfa.hidden) altKapat(); });

  // Tema: açık / koyu / sistem + renk. Seçim hatırlanır (sayfaların <head>'indeki küçük
  // betik, sayfa açılırken yanıp sönmesin diye aynı ayarları en başta uygular).
  const TEMA = "yaparmi_tema";
  const RENK = "yaparmi_renk";
  const root = document.documentElement;
  const temaBtn = document.getElementById("themeBtn");
  const temaPanel = document.getElementById("temaPanel");
  function lsYaz(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* yok sayılabilir */ } }
  function temaCiz() {
    temaPanel.querySelectorAll("[data-mod]").forEach((b) => b.classList.toggle("on", (root.dataset.theme || "") === b.dataset.mod));
    temaPanel.querySelectorAll("[data-renk]").forEach((b) => b.classList.toggle("on", (root.dataset.renk || "") === b.dataset.renk));
  }
  temaBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    temaPanel.hidden = !temaPanel.hidden;
    temaBtn.setAttribute("aria-expanded", String(!temaPanel.hidden));
    temaCiz();
  });
  temaPanel.addEventListener("click", (e) => {
    e.stopPropagation();
    const mod = e.target.closest("[data-mod]");
    const renk = e.target.closest("[data-renk]");
    if (mod) {
      if (mod.dataset.mod) root.dataset.theme = mod.dataset.mod; else delete root.dataset.theme;
      lsYaz(TEMA, mod.dataset.mod);
    }
    if (renk) {
      if (renk.dataset.renk) root.dataset.renk = renk.dataset.renk; else delete root.dataset.renk;
      lsYaz(RENK, renk.dataset.renk);
    }
    if (mod || renk) {
      temaCiz();
      document.dispatchEvent(new CustomEvent("tema-degisti", { detail: { mod: root.dataset.theme || "", renk: root.dataset.renk || "" } }));
    }
  });
  document.addEventListener("click", () => { if (!temaPanel.hidden) { temaPanel.hidden = true; temaBtn.setAttribute("aria-expanded", "false"); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") temaPanel.hidden = true; });

  // Davet linki: yaparmi.com/?davet=kullaniciadi ile gelen kişi kayıt olursa davet edene sayılır
  try {
    const u = new URL(location.href);
    const d = (u.searchParams.get("davet") || "").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9._-]/g, "").slice(0, 20);
    if (d) {
      localStorage.setItem("yaparmi_davet", d);
      u.searchParams.delete("davet");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  } catch { /* yok sayılabilir */ }


  // ---------------- Yas modu: Berkay ehliyeti geçti 🖤 ----------------
  // Her sayfada sol üstte siyah kurdele. Açılış ekranı oturum başına bir
  // kez çıkar (sayfadan sayfaya geçerken tekrar tekrar açılmasın diye).
  // Kaldırmak için: bu bloğu ve style.css'in sonundaki "YAS" bölümünü sil.
  (function yasModu() {
    const kurdele = document.createElement("div");
    kurdele.className = "yas-kurdele";
    kurdele.setAttribute("aria-hidden", "true");
    kurdele.innerHTML = "<span></span>";
    document.body.appendChild(kurdele);

    const ANAHTAR = "yaparmi_yas_ehliyet_goruldu";
    try {
      if (sessionStorage.getItem(ANAHTAR)) return;
    } catch {
      /* depolama yoksa her açılışta gösterilir */
    }

    const overlay = document.createElement("div");
    overlay.className = "yas-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "yasBaslik");
    overlay.innerHTML =
      '<div class="yas-card">' +
      '<img src="images/berkay-kaza.jpg" alt="Berkay ve motoru, son yolculuğunda" />' +
      '<div class="yas-body">' +
      '<p class="yas-ust">🖤 ACI HABER 🖤</p>' +
      '<h2 id="yasBaslik">Türk trafiğinin kara günü</h2>' +
      '<p class="yas-lead">Berkay, ehliyet sınavını maalesef <strong>GEÇMİŞTİR.</strong></p>' +
      "<p>Kasksız 85'le bayır aşağı inip asfaltla bizzat tanışan, şeritleri hâlâ yol süsü sanan Berkay'a bugün itibarıyla direksiyon resmen teslim edilmiştir.</p>" +
      "<p>Yayaların, kaldırımların, bariyerlerin ve tüm trafik levhalarının acısını paylaşıyor, sürücülerimize sabır ve dikkat diliyoruz.</p>" +
      "<p>Yolda <em>“kubiiii”</em> diye bir ses duyarsanız lütfen derhal sağa çekiniz.</p>" +
      '<p class="yas-imza">— yaparmi.com ailesi ve Türkiye\'nin tüm kaldırımları</p>' +
      '<button type="button" id="yasKapat">Başımız sağ olsun 🖤</button>' +
      "</div></div>";
    document.body.appendChild(overlay);

    const eskiOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function kapat() {
      overlay.remove();
      document.body.style.overflow = eskiOverflow;
      document.removeEventListener("keydown", escKapat);
      try {
        sessionStorage.setItem(ANAHTAR, "1");
      } catch {
        /* yok sayılabilir */
      }
    }
    function escKapat(e) {
      if (e.key === "Escape") kapat();
    }
    overlay.querySelector("#yasKapat").addEventListener("click", kapat);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) kapat();
    });
    document.addEventListener("keydown", escKapat);
    overlay.querySelector("#yasKapat").focus();
  })();

  // ---------------- Kullanıcı adı yardımcıları ----------------
  function usernameToEmail(name) {
    return name + "@yaparmi.local";
  }

  function normalizeAccountUsername(raw) {
    return (raw || "")
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, "")
      .toLocaleLowerCase("tr-TR")
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 20);
  }

  // ---------------- Görsel yeniden boyutlandırma (galeri için) ----------------
  // Hangi boyutta / oranda yüklenirse yüklensin, kare şeklinde ve aynı
  // piksel boyutunda bir JPEG'e küçültüp/kırpıyor. Firebase Storage
  // KULLANMIYORUZ (yeni projelerde ücretli Blaze planı istiyor) — bunun
  // yerine fotoğrafı base64 (data URL) metnine çevirip DOĞRUDAN Firestore
  // belgesine gömüyoruz. Firestore'un ücretsiz planı (Spark) bu iş için
  // yeterli, tek kısıtı bir belgenin ~1MB'ı geçmemesi — o yüzden kaliteyi
  // gerekirse otomatik düşürerek 900KB'ın altına sığdırıyoruz.
  window.resizeImageToSquare = async function resizeImageToSquare(file, size) {
    size = size || 720;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const x = (size - w) / 2;
    const y = (size - h) / 2;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bitmap, x, y, w, h);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 900000 && quality > 0.3) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > 900000) {
      throw new Error("Fotoğraf çok büyük/karmaşık, daha küçük ya da daha sade bir fotoğraf dene.");
    }
    return dataUrl;
  };

  // Oranı koruyarak küçült (en uzun kenar `max`), JPEG; `limit` karakterin altına sığana kadar kaliteyi düşür.
  window.resimKucult = async function resimKucult(file, max, limit) {
    max = max || 900; limit = limit || 300000;
    const bmp = await createImageBitmap(file);
    const o = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * o); c.height = Math.round(bmp.height * o);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let q = 0.8, url = c.toDataURL("image/jpeg", q);
    while (url.length > limit && q > 0.3) { q -= 0.1; url = c.toDataURL("image/jpeg", q); }
    if (url.length > limit) throw new Error("Fotoğraf çok büyük, daha küçük bir tane dene.");
    return url;
  };

  // ---------------- Giriş Yap / Kayıt Ol widget'ı ----------------
  const authToggle = document.getElementById("authToggle");
  const authPanel = document.getElementById("authPanel");

  // window.YaparmiAuth her sayfada tanımlanır (widget DOM'u olmasa bile),
  // böylece script.js gibi başka dosyalar profil bilgisine güvenle erişebilir.
  let mode = "login"; // "login" | "register"
  let profile = null; // {uid, kullaniciAdi, rol} ya da null
  const listeners = [];

  window.YaparmiAuth = {
    getProfile: () => profile,
    onChange: (cb) => {
      listeners.push(cb);
      try {
        cb(profile);
      } catch {
        /* yok sayılabilir */
      }
    },
  };

  function notify() {
    listeners.forEach((cb) => {
      try {
        cb(profile);
      } catch {
        /* yok sayılabilir */
      }
    });
  }

  if (authToggle && authPanel) {
    function authErrorMessage(err) {
      switch (err && err.code) {
        case "auth/email-already-in-use":
          return "Bu kullanıcı adı zaten alınmış.";
        case "auth/weak-password":
          return "Şifre en az 6 karakter olmalı.";
        case "auth/invalid-email":
          return "Kullanıcı adında sadece harf, rakam, nokta, alt çizgi ya da tire kullanabilirsin.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "Kullanıcı adı veya şifre yanlış.";
        case "auth/too-many-requests":
          return "Çok fazla deneme oldu, biraz sonra tekrar dene.";
        default:
          console.error("Auth hatası:", err && err.message);
          return "Bir şeyler ters gitti, tekrar dene.";
      }
    }

    function renderLoggedOut() {
      authToggle.textContent = "Giriş yap";
      // Kayıt olurken şifreyi yanlış yazmamak için ikinci bir "şifre tekrar"
      // kutusu ekleniyor — sadece kayıt modunda, girişte gerek yok.
      const confirmField =
        mode === "register"
          ? '<input id="authPassConfirm" type="password" placeholder="Şifre (tekrar)" minlength="6" autocomplete="new-password" required />'
          : "";
      authPanel.innerHTML =
        '<div class="auth-error" id="authErr"></div>' +
        '<form id="authForm" autocomplete="off">' +
        '<input id="authUser" type="text" placeholder="Kullanıcı adı" maxlength="20" autocomplete="username" required />' +
        '<input id="authPass" type="password" placeholder="Şifre (en az 6 karakter)" minlength="6" autocomplete="' +
        (mode === "register" ? "new-password" : "current-password") +
        '" required />' +
        confirmField +
        '<button type="submit" id="authSubmitBtn">' +
        (mode === "login" ? "Giriş Yap" : "Kayıt Ol") +
        "</button>" +
        "</form>" +
        '<button type="button" class="auth-switch" id="authSwitch">' +
        (mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap") +
        "</button>";

      const switchBtn = document.getElementById("authSwitch");
      if (switchBtn) {
        switchBtn.addEventListener("click", () => {
          mode = mode === "login" ? "register" : "login";
          renderLoggedOut();
        });
      }
      const formEl = document.getElementById("authForm");
      if (formEl) formEl.addEventListener("submit", onAuthSubmit);
    }

    function renderLoggedIn() {
      authToggle.textContent = "👤 " + profile.kullaniciAdi;
      const isAdmin = profile.rol === "admin";
      authPanel.innerHTML =
        '<div class="auth-userbox">' +
        '<span class="who"></span>' +
        (isAdmin ? '<span class="role-badge">ADMIN</span>' : "") +
        (isAdmin ? '<a href="/admin" class="link-btn">⚙️ Admin Paneli</a>' : "") +
        '<a href="/profil" class="link-btn">👤 Profilim</a>' +
        '<a href="/borsa" class="link-btn">🪙 Cüzdanım (Borsa)</a>' +
        '<div class="davet-kutu"><b>🔗 Arkadaşını davet et</b><span>Linkinle kayıt olan her arkadaşın sana sayılır, rozet kazanırsın.</span>' +
        '<button type="button" class="btn davet-kopya" id="davetKopya">Davet linkini kopyala</button><small id="davetSayi"></small></div>' +
        '<button type="button" class="link-btn" id="logoutBtn">Çıkış Yap</button>' +
        "</div>";
      authPanel.querySelector(".who").textContent = profile.kullaniciAdi;
      const davetLink = location.origin + "/?davet=" + encodeURIComponent(profile.kullaniciAdi);
      const kopyaBtn = document.getElementById("davetKopya");
      kopyaBtn.addEventListener("click", async () => {
        try {
          if (navigator.share && matchMedia("(pointer:coarse)").matches) {
            await navigator.share({ title: "yaparmi.com", text: "Berkay yapar mı? Gel sen de sor:", url: davetLink });
          } else {
            await navigator.clipboard.writeText(davetLink);
            kopyaBtn.textContent = "✅ Kopyalandı";
            setTimeout(() => (kopyaBtn.textContent = "Davet linkini kopyala"), 1800);
          }
        } catch { document.getElementById("davetSayi").textContent = davetLink; }
      });
      if (db) {
        db.collection("davetler").where("davetEden", "==", profile.kullaniciAdi).get().then((snap) => {
          const n = snap.size;
          document.getElementById("davetSayi") && (document.getElementById("davetSayi").textContent = n ? n + " arkadaşın davetinle katıldı." : "Henüz davetinle katılan yok.");
          if (window.Basarim) Basarim.rekor("davet", n);
        }).catch(() => { /* kurallar eklenmemiş olabilir */ });
      }
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          if (auth) auth.signOut();
          authPanel.hidden = true;
        });
      }
    }

    async function onAuthSubmit(e) {
      e.preventDefault();
      const errEl = document.getElementById("authErr");
      if (errEl) errEl.textContent = "";
      const rawName = document.getElementById("authUser").value;
      const pass = document.getElementById("authPass").value;
      const name = normalizeAccountUsername(rawName);

      if (!name) {
        if (errEl) errEl.textContent = "Kullanıcı adında sadece harf, rakam, nokta, alt çizgi ya da tire kullanabilirsin.";
        return;
      }
      if (typeof db === "undefined" || !db || typeof auth === "undefined" || !auth) {
        if (errEl) errEl.textContent = "Şu an bağlı değil, birkaç saniye sonra tekrar dene.";
        return;
      }
      if (mode === "register") {
        const confirmEl = document.getElementById("authPassConfirm");
        if (confirmEl && confirmEl.value !== pass) {
          if (errEl) errEl.textContent = "Şifreler eşleşmiyor, ikisini de aynı yaz.";
          return;
        }
      }

      const submitBtn = document.getElementById("authSubmitBtn");
      if (submitBtn) submitBtn.disabled = true;

      const email = usernameToEmail(name);
      try {
        if (mode === "register") {
          const cred = await auth.createUserWithEmailAndPassword(email, pass);
          const rol = name === "admin" ? "admin" : "kullanici";
          await db.collection("kullanicilar").doc(cred.user.uid).set({
            kullaniciAdi: name,
            rol: rol,
            olusturulmaTarihi: firebase.firestore.FieldValue.serverTimestamp(),
          });
          // Davet linkiyle geldiyse davet edene yaz (kendini davet edemez)
          let davetEden = "";
          try { davetEden = localStorage.getItem("yaparmi_davet") || ""; } catch { /* yok */ }
          if (davetEden && davetEden !== name) {
            db.collection("davetler").doc(cred.user.uid).set({
              davetEden, davetEdilen: name, tarih: firebase.firestore.FieldValue.serverTimestamp(),
            }).catch((err) => console.warn("Davet kaydedilemedi:", err.message));
          }
        } else {
          await auth.signInWithEmailAndPassword(email, pass);
        }
      } catch (err) {
        if (errEl) errEl.textContent = authErrorMessage(err);
      }

      if (submitBtn) submitBtn.disabled = false;
    }

    authToggle.addEventListener("click", () => {
      authPanel.hidden = !authPanel.hidden;
    });
    document.addEventListener("click", (e) => {
      if (!authPanel.hidden && !authPanel.contains(e.target) && e.target !== authToggle) {
        authPanel.hidden = true;
      }
    });

    renderLoggedOut();

    if (typeof db !== "undefined" && db && typeof auth !== "undefined" && auth) {
      auth.onAuthStateChanged(async (user) => {
        // Ahır'ın anonim girişi de aynı auth nesnesini kullanıyor — burada
        // sadece GERÇEK (anonim olmayan) hesapları "giriş yapılmış" sayıyoruz.
        if (!user || user.isAnonymous) {
          profile = null;
          renderLoggedOut();
          notify();
          return;
        }
        try {
          const snap = await db.collection("kullanicilar").doc(user.uid).get();
          if (snap.exists) {
            profile = Object.assign({ uid: user.uid }, snap.data());
            renderLoggedIn();
          } else if (user.email && user.email.endsWith("@yaparmi.local")) {
            // Hesap (Firebase Authentication'da) var ama profil belgesi
            // (kullanicilar/{uid}) yok — mesela Firestore kuralları henüz
            // yayınlanmadan önce kayıt olunduysa bu olur. Burada kendini
            // onarmayı deniyor; kurallar artık doğruysa bu yazma başarılı
            // olur ve admin paneli/rozeti bir sonraki denemede açılır.
            const recoveredName = user.email.slice(0, user.email.indexOf("@"));
            const rol = recoveredName === "admin" ? "admin" : "kullanici";
            try {
              await db.collection("kullanicilar").doc(user.uid).set({
                kullaniciAdi: recoveredName,
                rol: rol,
                olusturulmaTarihi: firebase.firestore.FieldValue.serverTimestamp(),
              });
              profile = { uid: user.uid, kullaniciAdi: recoveredName, rol: rol };
              renderLoggedIn();
            } catch (err2) {
              console.warn("Profil onarılamadı (Firestore kuralları henüz güncel olmayabilir):", err2.message);
              profile = null;
              renderLoggedOut();
            }
          } else {
            profile = null;
            renderLoggedOut();
          }
        } catch (err) {
          console.warn("Profil okunamadı:", err.message);
          profile = null;
        }
        notify();
      });
    } else {
      authToggle.disabled = true;
      authToggle.textContent = "Bağlı değil";
    }
  }
})();
