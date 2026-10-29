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
    ["kahin", "🔮", "Kâhin ve Ahır"],
    ["spor", "🥊", "Spor"],
    ["ehliyet", "🚘", "Ehliyet"],
    ["grup", "🤝", "Grup"],
    ["diger", "📚", "Ders, sosyal hayat, galeri"],
    ["gizli", "🌙", "Gizli"],
  ];

  const LISTE = [
    { id: "ilk_soru", k: "kahin", ikon: "🔮", ad: "Merak kedisi", acik: "Kâhine ilk soruyu sor.", sayac: "kahin", hedef: 1 },
    { id: "kahin_10", k: "kahin", ikon: "🌧️", ad: "Soru yağmuru", acik: "Kâhine 10 soru sor.", sayac: "kahin", hedef: 10 },
    { id: "kahin_50", k: "kahin", ikon: "🧙", ad: "Kâhinin müdavimi", acik: "Kâhine 50 soru sor.", sayac: "kahin", hedef: 50 },
    { id: "ahir_ilk", k: "kahin", ikon: "🐴", ad: "Ahıra hoş geldin", acik: "Berkayın Ahırı'na ilk mesajını yaz.", sayac: "ahir", hedef: 1 },
    { id: "ahir_20", k: "kahin", ikon: "📣", ad: "Ahırın sesi", acik: "Ahır'a 20 mesaj yaz.", sayac: "ahir", hedef: 20 },

    { id: "boks_ilk", k: "spor", ikon: "🥊", ad: "İlk yumruk", acik: "Torbaya ilk kez vur.", sayac: "boks_vurus", hedef: 1 },
    { id: "boks_50", k: "spor", ikon: "💪", ad: "Torba düşmanı", acik: "Torbaya toplam 50 kez vur.", sayac: "boks_vurus", hedef: 50 },
    { id: "boks_500", k: "spor", ikon: "👊", ad: "Fena değil", acik: "Boks makinesinde 500'ü geç.", sayac: "boks_rekor", hedef: 500 },
    { id: "boks_900", k: "spor", ikon: "🍔", ad: "Burger'in rakibi", acik: "Boks makinesinde 900'ü geç.", sayac: "boks_rekor", hedef: 900 },
    { id: "boks_999", k: "spor", ikon: "🏆", ad: "Efsane", acik: "Boks makinesinde tam 999 vur.", sayac: "boks_rekor", hedef: 999 },
    { id: "el_kirik", k: "spor", ikon: "🦴", ad: "Çıt!", acik: "Boks yaparken elini kır.", sayac: "el_kirik", hedef: 1 },
    { id: "el_kirik_5", k: "spor", ikon: "🏥", ad: "Ortopedinin gediklisi", acik: "Elini 5 kez kır.", sayac: "el_kirik", hedef: 5 },
    { id: "gol_ilk", k: "spor", ikon: "⚽", ad: "İlk gol", acik: "Penaltıda Kurban'a gol at.", sayac: "gol", hedef: 1 },
    { id: "gol_10", k: "spor", ikon: "📚", ad: "Kurban'ın kâbusu", acik: "Penaltıda toplam 10 gol at.", sayac: "gol", hedef: 10 },
    { id: "gol_seri3", k: "spor", ikon: "🎩", ad: "Hat-trick", acik: "Üst üste 3 penaltı golü at.", sayac: "gol_seri", hedef: 3 },
    { id: "kubi85", k: "spor", ikon: "🏍️", ad: "Kubiii 85'i gördüm", acik: "Kasksız 85'te hızı 85'e çıkar.", sayac: "motor_hiz", hedef: 85 },
    { id: "tarla", k: "spor", ikon: "🌾", ad: "Tarlaya vardı", acik: "Kasksız 85'te tarlaya kazasız ulaş.", sayac: "tarla", hedef: 1 },
    { id: "kaza_10", k: "spor", ikon: "🪖", ad: "Kask nedir?", acik: "Kasksız 85'te 10 kaza yap.", sayac: "kaza", hedef: 10 },


    { id: "yazili", k: "ehliyet", ikon: "📝", ad: "Teoride iyi", acik: "Ehliyet yazılısını geç.", sayac: "yazili", hedef: 1 },
    { id: "yazili_10", k: "ehliyet", ikon: "💯", ad: "Kitap gibi", acik: "Yazılıdan 10/10 al.", sayac: "yazili_tam", hedef: 1 },
    { id: "surus", k: "ehliyet", ikon: "🛣️", ad: "Kazasız", acik: "Sürüş sınavını geç.", sayac: "surus", hedef: 1 },
    { id: "ehliyet", k: "ehliyet", ikon: "🪪", ad: "Belgeli", acik: "L parkı yap ve ehliyetini al.", sayac: "ehliyet", hedef: 1 },

    { id: "davet_1", k: "grup", ikon: "🔗", ad: "Davetçi", acik: "Davet linkinle bir arkadaşın kayıt olsun.", sayac: "davet", hedef: 1 },
    { id: "davet_3", k: "grup", ikon: "👥", ad: "Grup kurucusu", acik: "Davet linkinle 3 arkadaşın kayıt olsun.", sayac: "davet", hedef: 3 },
    { id: "lider", k: "grup", ikon: "🥇", ad: "Rekortmen", acik: "Bir spor oyununun grup rekor tablosunda 1. ol.", sayac: "lider_x", hedef: 1 },
    { id: "paylas", k: "grup", ikon: "📤", ad: "Yayıncı", acik: "Kâhinin bir cevabını paylaş.", sayac: "paylas", hedef: 1 },
    { id: "bildirim", k: "grup", ikon: "🔔", ad: "Haberim olsun", acik: "Ahır bildirimlerini aç.", sayac: "bildirim", hedef: 1 },
    { id: "uygulama", k: "grup", ikon: "📲", ad: "Cebimde", acik: "yaparmi.com'u uygulama olarak yükle.", sayac: "uygulama", hedef: 1 },

    { id: "optik", k: "diger", ikon: "📷", ad: "Kopya ustası", acik: "Ders sayfasında optiği okut.", sayac: "optik", hedef: 1 },
    { id: "optik_99", k: "diger", ikon: "🎯", ad: "Neredeyse tam", acik: "Optikten 99 al.", sayac: "optik_puan", hedef: 99 },
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
    t.href = "/basarimlar";
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
    a.className = "icon-btn bs-btn" + (location.pathname.replace(/\.html$/, "").replace(/\/+$/, "") === "/basarimlar" ? " on" : "");
    a.href = "/basarimlar";
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
    // Eski kayıtlardan gelenler (önceki sürümde oynanmış oyunlar)
    try {
      const boks = JSON.parse(localStorage.getItem("spor_boks_eniyi") || "0");
      if (boks) rekor("boks_rekor", boks);
      const kirik = JSON.parse(localStorage.getItem("spor_boks_kirik") || "0");
      if (kirik) rekor("el_kirik", kirik);
      const pen = JSON.parse(localStorage.getItem("spor_penalti") || "null");
      if (pen && pen.gol) rekor("gol", pen.gol);
    } catch { /* yok sayılabilir */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", acilis);
  else acilis();
})();
