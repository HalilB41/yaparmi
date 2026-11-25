// ============================================================
// basarim.js — TÜM sayfalarda çalışır. Başarımlar (rozetler).
// Oyunlar şunları çağırır:
//   Basarim.say("sayac", 1)     → bir sayacı artırır (ör. kâhine sorulan soru)
//   Basarim.rekor("sayac", 512) → sayacı en yüksek değere çeker (ör. 2048'de en büyük kare)
//   Basarim.ac("id")            → doğrudan açar
// Kayıt bu cihazın tarayıcısında tutulur (localStorage). Açılınca altta bildirim çıkar.
// Yeni başarım eklemek için LISTE'ye bir satır ekle; "sayac" + "hedef" verirsen sayaçla açılır.
// ============================================================
(function () {
  "use strict";

  const KATEGORILER = [
    ["kahin", "🔮", "Kâhin ve Sohbet"],
    ["macera", "🎮", "Macera"],
    ["grup", "🤝", "Grup"],
    ["diger", "📚", "Sosyal hayat, galeri"],
    ["gizli", "🌙", "Gizli"],
  ];

  const LISTE = [
    { id: "ilk_soru", k: "kahin", ikon: "🔮", ad: "Merak kedisi", acik: "Kâhine ilk soruyu sor.", sayac: "kahin", hedef: 1 },
    { id: "kahin_10", k: "kahin", ikon: "🌧️", ad: "Soru yağmuru", acik: "Kâhine 10 soru sor.", sayac: "kahin", hedef: 10 },
    { id: "kahin_50", k: "kahin", ikon: "🧙", ad: "Kâhinin müdavimi", acik: "Kâhine 50 soru sor.", sayac: "kahin", hedef: 50 },
    { id: "ahir_ilk", k: "kahin", ikon: "💬", ad: "Sohbete hoş geldin", acik: "Sohbete ilk mesajını yaz.", sayac: "ahir", hedef: 1 },
    { id: "ahir_20", k: "kahin", ikon: "📣", ad: "Sohbetin sesi", acik: "Sohbete 20 mesaj yaz.", sayac: "ahir", hedef: 20 },

    // Macera ilerlemesinden (localStorage macera_kayit2) hesaplanır
    { id: "mc_ilk", k: "macera", ikon: "📦", ad: "Has amele", acik: "Macera'da ilk bölümü bitir.", sayac: "macera_bolum", hedef: 1 },
    { id: "mc_10", k: "macera", ikon: "🏍️", ad: "Yolun başı", acik: "Macera'da 10 bölüm bitir.", sayac: "macera_bolum", hedef: 10 },
    { id: "mc_20", k: "macera", ikon: "🛵", ad: "Kurye ruhu", acik: "Macera'da 20 bölüm bitir.", sayac: "macera_bolum", hedef: 20 },
    { id: "mc_30", k: "macera", ikon: "⏰", ad: "05:17 alarmı", acik: "Macera'da 30 bölüm bitir.", sayac: "macera_bolum", hedef: 30 },
    { id: "mc_40", k: "macera", ikon: "🗺️", ad: "Alsas-Loren fatihi", acik: "Macera'da 40 bölüm bitir.", sayac: "macera_bolum", hedef: 40 },
    { id: "mc_final", k: "macera", ikon: "🤓", ad: "Halil'i yendin", acik: "Macera'nın final boss'u Halil'i yen.", sayac: "macera_final", hedef: 1 },



    { id: "davet_1", k: "grup", ikon: "🔗", ad: "Davetçi", acik: "Davet linkinle bir arkadaşın kayıt olsun.", sayac: "davet", hedef: 1 },
    { id: "davet_3", k: "grup", ikon: "👥", ad: "Grup kurucusu", acik: "Davet linkinle 3 arkadaşın kayıt olsun.", sayac: "davet", hedef: 3 },
    { id: "paylas", k: "grup", ikon: "📤", ad: "Yayıncı", acik: "Kâhinin bir cevabını paylaş.", sayac: "paylas", hedef: 1 },
    { id: "bildirim", k: "grup", ikon: "🔔", ad: "Haberim olsun", acik: "Sohbet bildirimlerini aç.", sayac: "bildirim", hedef: 1 },
    { id: "uygulama", k: "grup", ikon: "📲", ad: "Cebimde", acik: "yaparmi.com'u uygulama olarak yükle.", sayac: "uygulama", hedef: 1 },

    { id: "son_ilk", k: "diger", ikon: "🏁", ad: "Kader çizildi", acik: "Sosyal hayat hikâyesinde bir sona ulaş.", sayac: "son", hedef: 1 },
    { id: "son_5", k: "diger", ikon: "🗺️", ad: "Bütün yollar", acik: "Sosyal hayatta 5 farklı sona ulaş.", sayac: "son", hedef: 5 },
    { id: "oneri", k: "diger", ikon: "📸", ad: "Paparazzi", acik: "Galeriye fotoğraf öner.", sayac: "oneri", hedef: 1 },

    { id: "gece", k: "gizli", gizli: true, ikon: "🦉", ad: "Berkay gibi uyumuyorsun", acik: "Siteye gece 02.00 ile 05.00 arasında gir.", sayac: "gece", hedef: 1 },
    { id: "tema", k: "gizli", gizli: true, ikon: "🌑", ad: "Karanlık taraf", acik: "Ayarlardan koyu temaya geç.", sayac: "tema", hedef: 1 },
    { id: "ziyaret_7", k: "gizli", gizli: true, ikon: "📅", ad: "Sadık ziyaretçi", acik: "Siteye 7 farklı gün gir.", sayac: "gun", hedef: 7 },
    { id: "hepsi_yarisi", k: "gizli", gizli: true, ikon: "👑", ad: "Berkay'dan daha başarılı", acik: "Başarımların yarısını aç.", sayac: "acilan", hedef: 18 },
  ];

  const ANAHTAR = "yaparmi_basarimlar";
  function oku() {
    try {
      const v = JSON.parse(localStorage.getItem(ANAHTAR) || "null");
      if (v && typeof v === "object") return { acik: v.acik || {}, sayac: v.sayac || {}, gunler: v.gunler || [] };
    } catch { /* bozuksa sıfırdan */ }
    return { acik: {}, sayac: {}, gunler: [] };
  }
  let veri = oku();
  function yaz() {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(veri)); } catch { /* gizli sekme */ }
  }

  // ---------------- Bildirim ----------------
  const kuyruk = [];
  let gosteriliyor = false;
  function bildir(b) {
    kuyruk.push(b);
    if (!gosteriliyor) siradaki();
  }
  function siradaki() {
    const b = kuyruk.shift();
    if (!b) { gosteriliyor = false; return; }
    gosteriliyor = true;
    const t = document.createElement("a");
    t.className = "bs-toast";
    t.href = "/profil#basarim";
    t.setAttribute("role", "status");
    t.innerHTML = '<span class="bs-toast-ikon"></span><span class="bs-toast-yazi"><small>Başarım açıldı</small><b></b></span>';
    t.querySelector(".bs-toast-ikon").textContent = b.ikon;
    t.querySelector("b").textContent = b.ad;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("is-on"));
    setTimeout(() => {
      t.classList.remove("is-on");
      setTimeout(() => { t.remove(); siradaki(); }, 350);
    }, 3200);
  }

  // ---------------- Açma ----------------
  function ac(id) {
    const b = LISTE.find((x) => x.id === id);
    if (!b || veri.acik[id]) return false;
    veri.acik[id] = Date.now();
    veri.sayac.acilan = Object.keys(veri.acik).length;
    yaz();
    bildir(b);
    kontrol("acilan");
    document.dispatchEvent(new CustomEvent("basarim", { detail: b }));
    rozetGuncelle();
    return true;
  }
  function kontrol(sayacAdi) {
    const deger = veri.sayac[sayacAdi] || 0;
    LISTE.forEach((b) => {
      if (b.sayac === sayacAdi && deger >= b.hedef && !veri.acik[b.id]) ac(b.id);
    });
  }
  function say(sayacAdi, n) {
    veri.sayac[sayacAdi] = (veri.sayac[sayacAdi] || 0) + (n || 1);
    yaz();
    kontrol(sayacAdi);
  }
  function rekor(sayacAdi, deger) {
    if (!(deger > (veri.sayac[sayacAdi] || 0))) return;
    veri.sayac[sayacAdi] = deger;
    yaz();
    kontrol(sayacAdi);
  }
  // Aynı şeyi bir kez sayar (ör. aynı hikâye sonu iki kez sayılmasın)
  function farkli(sayacAdi, anahtar) {
    const k = "_" + sayacAdi;
    const set = veri.sayac[k] || [];
    if (set.includes(anahtar)) return;
    set.push(anahtar);
    veri.sayac[k] = set.slice(-200);
    veri.sayac[sayacAdi] = set.length;
    yaz();
    kontrol(sayacAdi);
  }

  window.Basarim = {
    LISTE, KATEGORILER,
    say, rekor, farkli, ac,
    durum: () => veri,
    sifirla: () => { veri = { acik: {}, sayac: {}, gunler: [] }; yaz(); rozetGuncelle(); },
  };

  // ---------------- Üst bardaki kupa düğmesi ----------------
  function rozetGuncelle() {
    const n = document.getElementById("bsSayi");
    if (n) n.textContent = Object.keys(veri.acik).length + "/" + LISTE.length;
  }
  function kupaEkle() {
    const yer = document.querySelector(".top-actions");
    if (!yer || document.getElementById("bsBtn")) return;
    const a = document.createElement("a");
    a.id = "bsBtn";
    a.className = "icon-btn bs-btn" + (location.pathname.replace(/\.html$/, "").replace(/\/+$/, "") === "/profil" ? " on" : "");
    a.href = "/profil#basarim";
    a.title = "Başarımlar";
    a.setAttribute("aria-label", "Başarımlar");
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg><span class="bs-sayi" id="bsSayi"></span>';
    yer.insertBefore(a, yer.firstChild);
    rozetGuncelle();
  }

  // ---------------- Sayfa açılışında kontroller ----------------
  function acilis() {
    kupaEkle();
    const simdi = new Date();
    const gun = simdi.getFullYear() + "-" + (simdi.getMonth() + 1) + "-" + simdi.getDate();
    farkli("gun", gun);
    if (simdi.getHours() >= 2 && simdi.getHours() < 5) say("gece");
    document.addEventListener("tema-degisti", (e) => { if (e.detail && e.detail.mod === "dark") say("tema"); });
    // Macera ilerlemesi: bitirilen bölüm sayısı ve final
    try {
      const k = JSON.parse(localStorage.getItem("macera_kayit2") || "{}");
      const biten = Object.keys(k).filter((x) => /^\d+$/.test(x)).length;
      if (biten) rekor("macera_bolum", biten);
      if (k[50]) rekor("macera_final", 1);
    } catch { /* yok sayılabilir */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", acilis);
  else acilis();
})();
