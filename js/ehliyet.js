// ============================================================
// ehliyet.js — sadece ehliyet.html'de çalışır. Berkay'ın ehliyet alma
// serüveni: 1) Yazılı sınav (10 soru, 4 şıklı, 5 doğru şart)
// 2) Araç seç (3 model, şoför koltuğuna admin resim ekleyebilir)
// 3) Sürüş sınavı (3 şeritli yol, kuzeye gidiyoruz, 3 çarpınca kaldık)
// 4) 1500m sonunda L Park (sürükle-bırak) — başarılı olursa ehliyet alınır.
//
// Admin ayarları (3 şoför resmi + çarpışma sesi) Firestore'dan okunuyor:
// ehliyet/ayarlar -> { araba1, araba2, araba3, carpmaSesi }
// (hepsi opsiyonel data URL string; yoksa varsayılan emoji/ses kullanılır)
// ============================================================

(function () {
  "use strict";

  const box = document.getElementById("ehliyetContainer");
  const steps = document.getElementById("ehliyetSteps");
  if (!box) return;

  // ---------------- Yardımcılar (spor.js ile aynı üslup) ----------------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function btn(text, cls, onClick) {
    const b = el("button", cls || "game-mini-btn", text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function rand(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }
  function sec(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Admin özel çarpışma sesi yoksa çalan, dosyasız üretilen "çarpışma" sesi.
  let ac = null;
  function sentetikCarpisma() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!ac) ac = new Ctx();
      if (ac.state === "suspended") ac.resume();
      const t = ac.currentTime;
      const len = Math.floor(ac.sampleRate * 0.5);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900;
      const g = ac.createGain();
      g.gain.value = 1.6;
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t);
    } catch {
      /* ses çalınamazsa oyun yine çalışır */
    }
  }

  let ozelCarpmaSesi = null; // Audio nesnesi, admin bir ses yüklediyse
  function carpmaSesiCal() {
    if (ozelCarpmaSesi) {
      try {
        ozelCarpmaSesi.currentTime = 0;
        const p = ozelCarpmaSesi.play();
        if (p && p.catch) p.catch(() => {});
        return;
      } catch {
        /* sentetiğe düş */
      }
    }
    sentetikCarpisma();
  }

  // ---------------- Admin ayarlarını yükle ----------------
  const ayarlar = { araba1: null, araba2: null, araba3: null, carpmaSesi: null };
  function ayarlariYukle() {
    if (typeof db === "undefined" || !db) return;
    db.collection("ehliyet")
      .doc("ayarlar")
      .get()
      .then((snap) => {
        if (!snap.exists) return;
        const d = snap.data() || {};
        ["araba1", "araba2", "araba3"].forEach((k) => {
          if (typeof d[k] === "string" && d[k].startsWith("data:image/")) ayarlar[k] = d[k];
        });
        if (typeof d.carpmaSesi === "string" && d.carpmaSesi.startsWith("data:audio/")) {
          ayarlar.carpmaSesi = d.carpmaSesi;
          ozelCarpmaSesi = new Audio(d.carpmaSesi);
          ozelCarpmaSesi.preload = "auto";
        }
      })
      .catch(() => {
        /* kural yoksa / bağlı değilse sessiz geç, varsayılanlar kullanılır */
      });
  }
  ayarlariYukle();

  // ============================================================
  // SORU HAVUZU (20 soru, her oyunda rastgele 10 tanesi sorulur)
  // ============================================================
  const SORU_HAVUZU = [
    { s: "Kırmızı ışıkta ne yapılır?", c: ["Dur", "Yavaşlayıp geç", "Korna çalıp geç", "Sadece gece dur"], d: 0 },
    { s: "\"Yol ver\" levhası gördüğünde ne yapılır?", c: ["Öncelik sendedir, geçersin", "Ana yoldaki araçlara öncelik verirsin", "Hız yaparsın", "Duraksamadan geçersin"], d: 1 },
    { s: "Emniyet kemeri şehir içinde de takılmalı mı?", c: ["Evet, her zaman", "Sadece otoyolda", "Sadece yolcu varsa", "Gerek yok"], d: 0 },
    { s: "Sarı yanıp sönen ışık ne anlama gelir?", c: ["Dikkatli geç", "Dur", "Hızlan", "Sollama serbest"], d: 0 },
    { s: "Alkollü araç kullanmanın bir cezası var mıdır?", c: ["Hayır", "Evet, trafikten men ve ceza", "Sadece sözlü uyarı", "Sadece gündüz yasak"], d: 1 },
    { s: "Aksi belirtilmedikçe şehir içi azami hız sınırı genelde kaç km/s'tir?", c: ["50", "90", "120", "30"], d: 0 },
    { s: "Dönel kavşakta (göbek) kime öncelik verilir?", c: ["Girmek isteyene", "Kavşak içinde olana", "Sağdan gelene", "Büyük araca"], d: 1 },
    { s: "Okul geçidinde ne yapılmalı?", c: ["Hız kesip dikkatli geç", "Korna çalıp hızlan", "Önemi yok", "Sadece gece dikkat et"], d: 0 },
    { s: "Dörtlü flaşör (arıza lambası) ne zaman kullanılır?", c: ["Müzik dinlerken", "Arıza/tehlike durumunda", "Sadece gece", "Park ederken her zaman"], d: 1 },
    { s: "Emniyet şeridi ne için kullanılır?", c: ["Hızlı gitmek için", "Sadece acil durum/zorunlu haller için", "Fazla araç sığdırmak için", "Dinlenmek için"], d: 1 },
    { s: "Islak yolda fren mesafesi nasıl değişir?", c: ["Kısalır", "Uzar", "Değişmez", "Sadece yazın değişir"], d: 1 },
    { s: "\"Dur\" levhası gördüğünde ne yapılır?", c: ["Tamamen durup bakıp geç", "Yavaşlayıp geç", "Hızlan", "Korna çal"], d: 0 },
    { s: "Sollama, görüşün kısıtlı olduğu viraj/tepe gibi yerlerde nasıldır?", c: ["Serbesttir", "Yasaktır", "Sadece gece serbest", "Sadece kamyonlar yapabilir"], d: 1 },
    { s: "Trafik kazasında ilk yapılması gereken nedir?", c: ["Hemen uzaklaşmak", "Can güvenliğini sağlayıp gerekirse 112'yi aramak", "Sosyal medyaya yazmak", "Tartışmaya başlamak"], d: 1 },
    { s: "Küçük çocuklar ön koltukta uygun önlem olmadan oturabilir mi?", c: ["Evet her zaman", "Hayır, yaş/boya uygun koltuk/önlem şart", "Sadece kısa yolda evet", "Önemi yok"], d: 1 },
    { s: "Yaya geçidinde yaya varken sürücü ne yapmalı?", c: ["Hızlanıp geçmeli", "Durup yayaya geçiş hakkı vermeli", "Korna çalmalı", "Yoluna devam etmeli"], d: 1 },
    { s: "Lastik basıncı düşükse ne olur?", c: ["Yakıt tasarrufu artar", "Yol tutuşu ve fren mesafesi olumsuz etkilenir", "Hiçbir etkisi yoktur", "Araç hızlanır"], d: 1 },
    { s: "Sis lambaları ne zaman kullanılmalı?", c: ["Her zaman", "Sis/kar/yoğun yağış gibi görüş azaldığında", "Sadece gece", "Sadece şehir dışında"], d: 1 },
    { s: "Takip mesafesi neye göre ayarlanmalı?", c: ["Sadece hıza göre", "Hız, hava/yol koşulları ve araç durumuna göre", "Öndeki araca hiç bakmadan", "Sabit 1 metre"], d: 1 },
    { s: "Berkay'a göre viraja en güvenli giriş yöntemi nedir?", c: ["Yavaşla ve dikkatli gir", "\"85'i gör\" diye bağırarak gir", "Gözlerini kapat", "Telefonla konuşarak gir"], d: 0 },
  ];

  function soruSeti() {
    return shuffle(SORU_HAVUZU).slice(0, 10);
  }

  // ---------------- Durum ----------------
  let temizle = null;
  const durum = {
    puan: 0,
    secilenAraba: 0, // 0,1,2
    mesafe: 0,
  };

  function sahneDegis(ad) {
    if (temizle) {
      temizle();
      temizle = null;
    }
    box.innerHTML = "";
    if (steps) {
      steps.querySelectorAll(".eh-step").forEach((s) => s.classList.toggle("active", s.dataset.step === ad));
    }
    ({ yazili: yazili, aracSec: aracSec, surus: surus, park: park, sonuc: sonuc }[ad] || yazili)();
  }

  // ============================================================
  // 1) YAZILI SINAV
  // ============================================================
  function yazili() {
    const sorular = soruSeti();
    let idx = 0;
    let dogru = 0;

    const wrap = el("div", "eh-wrap");
    wrap.appendChild(el("p", "muted eh-desc", "10 soru, en az 5 doğru yaparsan yazılıyı geçersin."));

    const ilerleme = el("div", "eh-quiz-progress");
    wrap.appendChild(ilerleme);

    const soruKutu = el("div", "eh-quiz-question");
    wrap.appendChild(soruKutu);

    const secenekler = el("div", "eh-quiz-options");
    wrap.appendChild(secenekler);

    box.appendChild(wrap);

    function sorumGoster() {
      const soru = sorular[idx];
      ilerleme.textContent = "Soru " + (idx + 1) + " / " + sorular.length + " — Doğru: " + dogru;
      soruKutu.textContent = soru.s;
      secenekler.innerHTML = "";
      soru.c.forEach((metin, i) => {
        const b = btn(metin, "eh-quiz-option", () => cevapVer(i));
        secenekler.appendChild(b);
      });
    }

    function cevapVer(secilen) {
      const soru = sorular[idx];
      const butonlar = secenekler.querySelectorAll(".eh-quiz-option");
      butonlar.forEach((b, i) => {
        b.disabled = true;
        if (i === soru.d) b.classList.add("is-correct");
        else if (i === secilen) b.classList.add("is-wrong");
      });
      if (secilen === soru.d) dogru++;
      setTimeout(() => {
        idx++;
        if (idx < sorular.length) sorumGoster();
        else sinavBitti();
      }, 650);
    }

    function sinavBitti() {
      durum.puan = dogru;
      wrap.innerHTML = "";
      const sonucEl = el("div", "eh-quiz-result");
      if (dogru >= 5) {
        sonucEl.appendChild(el("div", "eh-quiz-emoji", "✅"));
        sonucEl.appendChild(el("h3", null, "Yazılıyı geçtin! (" + dogru + "/10)"));
        sonucEl.appendChild(el("p", "muted", "Sıra sürüş sınavında. Önce bir araç seç."));
        sonucEl.appendChild(btn("🚗 Araç Seç →", "admin-btn publish", () => sahneDegis("aracSec")));
      } else {
        sonucEl.appendChild(el("div", "eh-quiz-emoji", "❌"));
        sonucEl.appendChild(el("h3", null, "Yazılıdan kaldın (" + dogru + "/10)"));
        sonucEl.appendChild(el("p", "muted", "En az 5 doğru gerekiyor. Tekrar dene."));
        sonucEl.appendChild(btn("🔄 Tekrar Dene", "game-mini-btn", () => sahneDegis("yazili")));
      }
      wrap.appendChild(sonucEl);
    }

    sorumGoster();
  }

  // ============================================================
  // 2) ARAÇ SEÇ
  // ============================================================
  const ARABALAR = [
    { renk: "#e0545a", ad: "Kırmızı Şahin" },
    { renk: "#3f8ee0", ad: "Mavi Doğan" },
    { renk: "#e0b23f", ad: "Altın Tofaş" },
  ];

  function aracSec() {
    const wrap = el("div", "eh-wrap");
    wrap.appendChild(el("p", "muted eh-desc", "Sürüş sınavına gireceğin aracı seç."));

    const grid = el("div", "eh-car-grid");
    ARABALAR.forEach((araba, i) => {
      const kart = el("div", "eh-car-card" + (durum.secilenAraba === i ? " is-selected" : ""));
      const sekil = el("div", "eh-car-shape");
      sekil.style.setProperty("--eh-car-color", araba.renk);
      const pencere = el("div", "eh-car-window");
      const resimAlan = ayarlar["araba" + (i + 1)];
      if (resimAlan) {
        const img = el("img");
        img.src = resimAlan;
        img.alt = "";
        pencere.appendChild(img);
      } else {
        pencere.appendChild(el("span", null, "🧑"));
      }
      sekil.appendChild(pencere);
      kart.appendChild(sekil);
      kart.appendChild(el("div", "eh-car-name", araba.ad));
      kart.addEventListener("click", () => {
        durum.secilenAraba = i;
        grid.querySelectorAll(".eh-car-card").forEach((k) => k.classList.remove("is-selected"));
        kart.classList.add("is-selected");
      });
      grid.appendChild(kart);
    });
    wrap.appendChild(grid);

    wrap.appendChild(btn("🏁 Sürüşe Başla", "admin-btn publish eh-start-btn", () => sahneDegis("surus")));
    box.appendChild(wrap);
  }

  // ============================================================
  // 3) SÜRÜŞ SINAVI
  // ============================================================
  function surus() {
    const HEDEF = 1500;
    const SERIT = 3;
    const araba = ARABALAR[durum.secilenAraba];

    const wrap = el("div", "eh-wrap");
    wrap.appendChild(el("p", "muted eh-desc", "Kuzeye gidiyorsun. ◀/▶ ile şerit değiştir, 3 kere çarparsan kalırsın. Hedef: 1500 m."));

    const hud = el("div", "eh-hud");
    const hiz = el("div", "eh-hud-item");
    const hizSayi = el("strong", null, "0");
    hiz.appendChild(hizSayi);
    hiz.appendChild(el("span", "muted", " km/s"));
    hud.appendChild(hiz);
    const mesafeYazi = el("div", "eh-hud-item", "0 / " + HEDEF + " m");
    hud.appendChild(mesafeYazi);
    const canlar = el("div", "eh-hud-item eh-lives");
    hud.appendChild(canlar);
    wrap.appendChild(hud);

    const yol = el("div", "eh-road");
    for (let i = 1; i < SERIT; i++) {
      const c = el("div", "eh-lane-line");
      c.style.left = (i / SERIT) * 100 + "%";
      yol.appendChild(c);
    }
    const oyuncu = el("div", "eh-player-car");
    oyuncu.style.setProperty("--eh-car-color", araba.renk);
    const oyuncuPencere = el("div", "eh-car-window eh-player-window");
    const resimAlan = ayarlar["araba" + (durum.secilenAraba + 1)];
    if (resimAlan) {
      const img = el("img");
      img.src = resimAlan;
      img.alt = "";
      oyuncuPencere.appendChild(img);
    } else {
      oyuncuPencere.appendChild(el("span", null, "🧑"));
    }
    oyuncu.appendChild(oyuncuPencere);
    yol.appendChild(oyuncu);

    const ilerBar = el("div", "eh-progress-bar");
    const ilerDolgu = el("div", "eh-progress-fill");
    ilerBar.appendChild(ilerDolgu);
    wrap.appendChild(yol);
    wrap.appendChild(ilerBar);

    const kontrol = el("div", "dpad eh-dpad");
    const solBtn = el("button", "dpad-btn dpad-left", "◀");
    solBtn.type = "button";
    const sagBtn = el("button", "dpad-btn dpad-right", "▶");
    sagBtn.type = "button";
    kontrol.appendChild(solBtn);
    kontrol.appendChild(sagBtn);
    wrap.appendChild(kontrol);

    const mesaj = el("p", "eh-mesaj", "");
    wrap.appendChild(mesaj);

    box.appendChild(wrap);

    const KAZA_MESAJ = [
      "Yan aynaya baktın ama araba oradaydı.",
      "Direksiyon hakimiyeti bahane, çarpışma gerçek.",
      "Sınav gözetmeni not aldı: \"Bir daha asla.\"",
      "Çarptın ama \"dokunuş\" diyerek savundu.",
      "Berkay: \"O araba benden önce oradaydı zaten.\"",
    ];
    const ENGEL_ARAC = ["🚙", "🚕", "🚌", "🚚", "🚐"];

    let hizDeger = 35;
    let konum = 0;
    let oyuncuSerit = 1;
    let can = 3;
    let bitti = false;
    let engeller = [];
    let spawnSure = 1.1;
    let sonZaman = performance.now();
    let raf = null;
    let carpmaKilit = false;

    function canlariCiz() {
      canlar.textContent = "❤️".repeat(can) + "🖤".repeat(3 - can);
    }
    canlariCiz();

    function seritX(i) {
      return ((i + 0.5) / SERIT) * yol.clientWidth;
    }

    function seritDegistir(d) {
      if (bitti) return;
      oyuncuSerit = Math.max(0, Math.min(SERIT - 1, oyuncuSerit + d));
      oyuncu.style.left = seritX(oyuncuSerit) + "px";
    }

    function carp() {
      if (carpmaKilit) return;
      carpmaKilit = true;
      can--;
      canlariCiz();
      carpmaSesiCal();
      oyuncu.classList.add("eh-flash");
      mesaj.textContent = sec(KAZA_MESAJ);
      setTimeout(() => {
        oyuncu.classList.remove("eh-flash");
        carpmaKilit = false;
      }, 700);
      if (can <= 0) basarisiz();
    }

    function basarisiz() {
      bitti = true;
      cancelAnimationFrame(raf);
      wrap.innerHTML = "";
      const sonucEl = el("div", "eh-quiz-result");
      sonucEl.appendChild(el("div", "eh-quiz-emoji", "💥"));
      sonucEl.appendChild(el("h3", null, "Sınavdan kaldın (" + Math.round(konum) + " m gittin)"));
      sonucEl.appendChild(el("p", "muted", "3 kere çarptın. Tekrar dene."));
      sonucEl.appendChild(btn("🔄 Tekrar Dene", "admin-btn publish", () => sahneDegis("surus")));
      sonucEl.appendChild(btn("🚗 Araç Değiştir", "game-mini-btn", () => sahneDegis("aracSec")));
      wrap.appendChild(sonucEl);
    }

    function basarili() {
      bitti = true;
      cancelAnimationFrame(raf);
      sahneDegis("park");
    }

    function kare(t) {
      const dt = Math.min(0.05, (t - sonZaman) / 1000);
      sonZaman = t;
      if (!bitti) {
        hizDeger = Math.min(110, hizDeger + 3 * dt);
        konum += (hizDeger / 3.6) * dt;

        const H = yol.clientHeight;
        const pxm = H / 50; // ekranda ~50 metre görünüyor

        spawnSure -= dt * (hizDeger / 55);
        if (spawnSure <= 0 && konum < HEDEF - 40) {
          spawnSure = 0.75 + Math.random() * 0.9;
          const s = rand(0, SERIT - 1);
          const e = el("div", "eh-obstacle", sec(ENGEL_ARAC));
          yol.appendChild(e);
          engeller.push({ el: e, y: -40, serit: s, hiz: rand(20, 45) });
        }

        const oyuncuY = H - 54;
        engeller = engeller.filter((eng) => {
          eng.y += ((hizDeger - eng.hiz) / 3.6) * dt * pxm;
          eng.el.style.top = eng.y + "px";
          eng.el.style.left = seritX(eng.serit) + "px";
          if (eng.serit === oyuncuSerit && Math.abs(eng.y - oyuncuY) < 30) {
            carp();
            eng.el.remove();
            return false;
          }
          if (eng.y > H + 50) {
            eng.el.remove();
            return false;
          }
          return true;
        });

        hizSayi.textContent = String(Math.floor(hizDeger));
        mesafeYazi.textContent = Math.max(0, Math.round(konum)) + " / " + HEDEF + " m";
        ilerDolgu.style.width = Math.min(100, (konum / HEDEF) * 100) + "%";

        if (konum >= HEDEF) basarili();
      }
      if (!bitti) raf = requestAnimationFrame(kare);
    }

    oyuncu.style.left = seritX(oyuncuSerit) + "px";

    function tusBas(e) {
      if (e.key === "ArrowLeft" && !e.repeat) {
        e.preventDefault();
        seritDegistir(-1);
      }
      if (e.key === "ArrowRight" && !e.repeat) {
        e.preventDefault();
        seritDegistir(1);
      }
    }
    document.addEventListener("keydown", tusBas);
    solBtn.addEventListener("click", () => seritDegistir(-1));
    sagBtn.addEventListener("click", () => seritDegistir(1));

    raf = requestAnimationFrame(kare);

    temizle = () => {
      bitti = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", tusBas);
    };
  }

  // ============================================================
  // 4) L PARK — sürükle bırak
  // ============================================================
  function park() {
    const wrap = el("div", "eh-wrap");
    wrap.appendChild(el("p", "muted eh-desc", "Son adım: aracı sürükleyip işaretli L Park alanına tam oturt."));

    const lot = el("div", "eh-park-lot");
    const hedef = el("div", "eh-park-target");
    hedef.appendChild(el("span", "eh-park-target-label", "L PARK"));
    lot.appendChild(hedef);

    const araba = ARABALAR[durum.secilenAraba];
    const arabaEl = el("div", "eh-park-car");
    arabaEl.style.setProperty("--eh-car-color", araba.renk);
    const pencere = el("div", "eh-car-window");
    const resimAlan2 = ayarlar["araba" + (durum.secilenAraba + 1)];
    if (resimAlan2) {
      const img = el("img");
      img.src = resimAlan2;
      img.alt = "";
      pencere.appendChild(img);
    } else {
      pencere.appendChild(el("span", null, "🧑"));
    }
    arabaEl.appendChild(pencere);
    lot.appendChild(arabaEl);

    wrap.appendChild(lot);
    const mesaj = el("p", "eh-mesaj", "");
    wrap.appendChild(mesaj);
    box.appendChild(wrap);

    let surukluyor = false;
    let offX = 0;
    let offY = 0;

    function dikdortgenlerUstUste(a, b) {
      const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const kesisim = ix * iy;
      const alanA = (a.right - a.left) * (a.bottom - a.top);
      return alanA > 0 && kesisim / alanA > 0.75;
    }

    function basla(e) {
      const lotRect = lot.getBoundingClientRect();
      const carRect = arabaEl.getBoundingClientRect();
      offX = e.clientX - carRect.left;
      offY = e.clientY - carRect.top;
      arabaEl.style.left = carRect.left - lotRect.left + "px";
      arabaEl.style.top = carRect.top - lotRect.top + "px";
      arabaEl.style.right = "auto";
      arabaEl.style.bottom = "auto";
      surukluyor = true;
      arabaEl.classList.add("is-dragging");
      arabaEl.setPointerCapture(e.pointerId);
    }
    function tasi(e) {
      if (!surukluyor) return;
      const lotRect = lot.getBoundingClientRect();
      const carRect = arabaEl.getBoundingClientRect();
      let nx = e.clientX - lotRect.left - offX;
      let ny = e.clientY - lotRect.top - offY;
      nx = Math.max(0, Math.min(nx, lotRect.width - carRect.width));
      ny = Math.max(0, Math.min(ny, lotRect.height - carRect.height));
      arabaEl.style.left = nx + "px";
      arabaEl.style.top = ny + "px";
    }
    function birak(e) {
      if (!surukluyor) return;
      surukluyor = false;
      arabaEl.classList.remove("is-dragging");
      try {
        arabaEl.releasePointerCapture(e.pointerId);
      } catch {
        /* yok say */
      }
      const carRect = arabaEl.getBoundingClientRect();
      const hedefRect = hedef.getBoundingClientRect();
      if (dikdortgenlerUstUste(carRect, hedefRect)) {
        basarili();
      } else {
        mesaj.textContent = "Tam oturmadı, biraz daha dene.";
      }
    }
    arabaEl.addEventListener("pointerdown", basla);
    arabaEl.addEventListener("pointermove", tasi);
    arabaEl.addEventListener("pointerup", birak);
    arabaEl.addEventListener("pointercancel", birak);

    function basarili() {
      mesaj.textContent = "";
      sahneDegis("sonuc");
    }

    temizle = () => {
      arabaEl.removeEventListener("pointerdown", basla);
      arabaEl.removeEventListener("pointermove", tasi);
      arabaEl.removeEventListener("pointerup", birak);
      arabaEl.removeEventListener("pointercancel", birak);
    };
  }

  // ============================================================
  // 5) SONUÇ — Ehliyet belgesi
  // ============================================================
  function sonuc() {
    const araba = ARABALAR[durum.secilenAraba];
    const wrap = el("div", "eh-wrap eh-sonuc-wrap");

    const kart = el("div", "eh-license-card");
    kart.appendChild(el("div", "eh-license-top", "🪪 T.C. SÜRÜCÜ BELGESİ"));
    const resimAlan3 = ayarlar["araba" + (durum.secilenAraba + 1)];
    const foto = el("div", "eh-license-foto");
    if (resimAlan3) {
      const img = el("img");
      img.src = resimAlan3;
      img.alt = "";
      foto.appendChild(img);
    } else {
      foto.appendChild(el("span", null, "🧑"));
    }
    kart.appendChild(foto);
    kart.appendChild(el("div", "eh-license-ad", "AD SOYAD: BERKAY"));
    kart.appendChild(el("div", "eh-license-satir", "SINIF: B"));
    kart.appendChild(el("div", "eh-license-satir", "ARAÇ: " + araba.ad));
    kart.appendChild(el("div", "eh-license-satir", "YAZILI: " + durum.puan + " / 10"));
    kart.appendChild(el("div", "eh-license-satir muted", "GEÇERLİLİK: Oldukça şüpheli"));
    wrap.appendChild(kart);

    wrap.appendChild(el("h3", "eh-tebrik", "🎉 Tebrikler, ehliyetini aldın!"));
    wrap.appendChild(btn("🔄 Baştan Başla", "admin-btn publish", () => sahneDegis("yazili")));

    box.appendChild(wrap);
  }

  sahneDegis("yazili");
})();
