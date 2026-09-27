// ============================================================
// spor.js — sadece spor.html'de çalışır. 5 bölüm:
//   🥊 Boks Makinesi   — güç barını doğru anda durdur (ne yaparsan yap ~300, el kırılır)
//   ⚽ Penaltı         — yön + güç seç, şut at (asla gol olmaz, her şutta bahane)
//   🏍️ Kasksız 85      — yokuş aşağı motor; fren bozuk, 85'i görünce...
//   📋 Spor Karnesi    — Berkay'ın "spor istatistikleri" (admin düzenler, Firestore: spor/karne)
//   🏆 Berkay Olimpiyatı — haftanın rezilliği oylaması (Firestore: spor/olimpiyat + spor_oylar)
// ============================================================

(function () {
  "use strict";

  const picker = document.getElementById("sporPicker");
  const box = document.getElementById("sporContainer");
  if (!picker || !box) return;

  // ---------------- Yardımcılar ----------------
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
  function lsGet(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* gizli sekme vb. — sorun değil */
    }
  }

  // Ses efektleri (dosya gerekmez, Web Audio ile)
  let ac = null;
  function ses(tur) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!ac) ac = new Ctx();
      if (ac.state === "suspended") ac.resume();
      const t = ac.currentTime;
      if (tur === "cit" || tur === "carpisma") {
        const uzun = tur === "carpisma" ? 0.5 : 0.08;
        const len = Math.floor(ac.sampleRate * uzun);
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, tur === "cit" ? 4 : 1.5);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const f = ac.createBiquadFilter();
        f.type = tur === "cit" ? "highpass" : "lowpass";
        f.frequency.value = tur === "cit" ? 1800 : 900;
        const g = ac.createGain();
        g.gain.value = tur === "cit" ? 1.2 : 1.6;
        src.connect(f).connect(g).connect(ac.destination);
        src.start(t);
      } else if (tur === "dup" || tur === "top") {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(tur === "dup" ? 140 : 220, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + 0.22);
      }
    } catch {
      /* ses çalınamazsa oyun yine çalışır */
    }
  }

  let temizle = null; // aktif bölümün zamanlayıcılarını durdurmak için
  let isAdmin = false;
  let aktif = "boks";

  function goster(ad) {
    if (temizle) {
      temizle();
      temizle = null;
    }
    aktif = ad;
    picker.querySelectorAll(".game-tab").forEach((t) => t.classList.toggle("active", t.dataset.spor === ad));
    box.innerHTML = "";
    ({ boks, penalti, motor, karne, olimpiyat }[ad] || boks)();
  }
  picker.querySelectorAll(".game-tab").forEach((t) => t.addEventListener("click", () => goster(t.dataset.spor)));

  // ============================================================
  // 🥊 BOKS MAKİNESİ
  // ============================================================
  function boks() {
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Gücün barın sonuna gelince VUR. Rekor 999. Hadi bakalım."));

    const makine = el("div", "sp-boks-makine");
    const ekran = el("div", "sp-boks-ekran", "000");
    const armut = el("div", "sp-boks-armut", "🥊");
    makine.appendChild(ekran);
    makine.appendChild(armut);
    wrap.appendChild(makine);

    const bar = el("div", "sp-bar");
    const dolgu = el("div", "sp-bar-dolgu");
    bar.appendChild(dolgu);
    wrap.appendChild(bar);

    const vur = btn("🥊 VUR!", "sp-big-btn");
    wrap.appendChild(vur);
    const mesaj = el("p", "sp-mesaj", "");
    wrap.appendChild(mesaj);

    const skorlar = el("div", "sp-tablo");
    wrap.appendChild(skorlar);
    const elSayac = el("p", "muted sp-small", "");
    wrap.appendChild(elSayac);
    box.appendChild(wrap);

    const BAHANE = [
      "Makine bozuk.",
      "Eldiven kaydı.",
      "Güneş gözüme geldi (kapalı alan).",
      "Isınmadım ki daha.",
      "Makine Burger'e göre ayarlı.",
      "Benim suçum yok.",
    ];

    let enIyi = lsGet("spor_boks_eniyi", 0);
    let kirik = lsGet("spor_boks_kirik", 0);

    function tabloCiz() {
      skorlar.innerHTML = "";
      skorlar.appendChild(el("div", "sp-tablo-baslik", "🏆 Rekor tablosu"));
      [
        ["🍔 Burger", "999", "(burger yedikten sonra)"],
        ["📦 Halil", "910", "(depo kasları)"],
        ["📚 Kurban", "870", "(KPSS stresi)"],
        ["🦅 Alihan", "—", "(\"Enver Paşa adına vurmam\")"],
        ["🤕 Berkay", enIyi ? String(enIyi) : "—", "(sen)"],
      ].forEach(([ad, skor, not]) => {
        const r = el("div", "sp-tablo-satir");
        r.appendChild(el("span", "sp-tablo-ad", ad));
        r.appendChild(el("span", "sp-tablo-not muted", not));
        r.appendChild(el("strong", "sp-tablo-skor", skor));
        skorlar.appendChild(r);
      });
      elSayac.textContent = "🦴 Bu cihazda kırılan el sayısı: " + kirik;
    }
    tabloCiz();

    let pos = 0;
    let yon = 1;
    let calisiyor = true;
    let raf = null;
    let kilit = false;
    function dongu() {
      if (calisiyor) {
        pos += yon * 1.8;
        if (pos >= 100) { pos = 100; yon = -1; }
        if (pos <= 0) { pos = 0; yon = 1; }
        dolgu.style.width = pos + "%";
      }
      raf = requestAnimationFrame(dongu);
    }
    raf = requestAnimationFrame(dongu);

    function vurus() {
      if (kilit) return;
      kilit = true;
      calisiyor = false;
      const guc = pos;
      const gercek = rand(278, 341) + Math.round(guc / 10); // ne yaparsan yap ~300
      armut.classList.remove("is-hit");
      void armut.offsetWidth;
      armut.classList.add("is-hit");
      ses("dup");
      let n = 0;
      const hedefGoster = Math.max(gercek, Math.round(guc * 9.99)); // önce umut ver
      const sayac = setInterval(() => {
        n += Math.ceil(hedefGoster / 25);
        if (n >= hedefGoster) n = hedefGoster;
        ekran.textContent = String(n).padStart(3, "0");
        if (n === hedefGoster) {
          clearInterval(sayac);
          setTimeout(() => {
            ekran.textContent = String(gercek).padStart(3, "0");
            ekran.classList.add("is-glitch");
            ses("cit");
            kirik++;
            lsSet("spor_boks_kirik", kirik);
            if (gercek > enIyi) {
              enIyi = gercek;
              lsSet("spor_boks_eniyi", enIyi);
            }
            wrap.classList.add("sp-shake");
            mesaj.textContent =
              (guc > 92 ? "Mükemmel zamanlama! Yine de: " : "") + gercek + ". Elinden \"çıt\" diye bir ses geldi. Berkay: \"" + sec(BAHANE) + "\"";
            tabloCiz();
            setTimeout(() => {
              wrap.classList.remove("sp-shake");
              ekran.classList.remove("is-glitch");
              vur.textContent = "🥊 Diğer elle dene";
              calisiyor = true;
              kilit = false;
            }, 900);
          }, 350);
        }
      }, 30);
    }
    vur.addEventListener("click", vurus);
    function tus(e) {
      if (e.code === "Space") {
        e.preventDefault();
        vurus();
      }
    }
    document.addEventListener("keydown", tus);
    temizle = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", tus);
    };
  }

  // ============================================================
  // ⚽ PENALTI
  // ============================================================
  function penalti() {
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Yön seç, güç barını ayarla, şutunu çek. Kaleci yok. Kolay olmalı..."));

    const skor = el("div", "sp-skorbord");
    wrap.appendChild(skor);

    const saha = el("div", "sp-saha");
    const kale = el("div", "sp-kale");
    ["sol", "orta", "sag"].forEach((y) => {
      const z = el("div", "sp-kale-bolge");
      z.dataset.yon = y;
      kale.appendChild(z);
    });
    saha.appendChild(kale);
    const top = el("div", "sp-top", "⚽");
    saha.appendChild(top);
    const oyuncu = el("div", "sp-oyuncu", "🧍");
    saha.appendChild(oyuncu);
    wrap.appendChild(saha);

    const bar = el("div", "sp-bar");
    const dolgu = el("div", "sp-bar-dolgu");
    bar.appendChild(dolgu);
    wrap.appendChild(bar);

    const yonlar = el("div", "sp-yonlar");
    const bSol = btn("↖️ Sol", "sp-big-btn sp-yon");
    const bOrta = btn("⬆️ Orta", "sp-big-btn sp-yon");
    const bSag = btn("↗️ Sağ", "sp-big-btn sp-yon");
    [bSol, bOrta, bSag].forEach((b) => yonlar.appendChild(b));
    wrap.appendChild(yonlar);

    const sonuc = el("p", "sp-mesaj", "");
    const bahane = el("p", "sp-bahane", "");
    wrap.appendChild(sonuc);
    wrap.appendChild(bahane);
    box.appendChild(wrap);

    const SONUC = [
      "Direk! Top direkten döndü, Berkay'ın ayağına geldi, Berkay ona da ıskaladı.",
      "Auta gitti. Park halindeki arabanın alarmı çaldı.",
      "Top tellere çarpıp suratına döndü. Günün tek isabeti.",
      "Top Alihan'ın kafasına geldi. Alihan: \"Enver Paşa böyle şut atmazdı.\"",
      "Kaleci yoktu. Top yine de dışarı gitti.",
      "Topa bastı, düştü, top yerinde kaldı.",
      "Top Burger'in elindeki burgere çarptı. Burger ağlıyor.",
      "Kurban topu kafayla çıkardı. KPSS kitabını kafasında taşıyordu.",
      "Top üst direğe çarpıp Halil'in depo yeleğine yapıştı.",
      "Şut çok güzeldi. Ama öbür kaleye.",
    ];
    const BAHANE = [
      "Zemin ıslaktı.",
      "Top yamuktu.",
      "Ayakkabım kaydı.",
      "Güneş gözüme geldi.",
      "Kale küçük.",
      "Rüzgâr vardı. (Kapalı saha.)",
      "Elim sargılı, dengem bozuldu.",
      "Benim suçum yok.",
      "Isınmadım daha.",
    ];

    let sut = lsGet("spor_penalti_sut", 0);
    function skorCiz() {
      skor.innerHTML = "";
      [["Şut", sut], ["Gol", 0], ["Berkay kariyer golü", 0]].forEach(([a, b]) => {
        const k = el("div", "sp-skor-kutu");
        k.appendChild(el("span", "muted", a));
        k.appendChild(el("strong", null, String(b)));
        skor.appendChild(k);
      });
    }
    skorCiz();

    let pos = 0;
    let yon = 1;
    let calisiyor = true;
    let kilit = false;
    let raf = null;
    function dongu() {
      if (calisiyor) {
        pos += yon * 2.2;
        if (pos >= 100) { pos = 100; yon = -1; }
        if (pos <= 0) { pos = 0; yon = 1; }
        dolgu.style.width = pos + "%";
      }
      raf = requestAnimationFrame(dongu);
    }
    raf = requestAnimationFrame(dongu);

    function sutCek(y) {
      if (kilit) return;
      kilit = true;
      calisiyor = false;
      const guc = pos;
      ses("top");
      sut++;
      lsSet("spor_penalti_sut", sut);
      const hedefX = { sol: 18, orta: 50, sag: 82 }[y];
      // Top önce kaleye doğru gidiyor gibi yapar, sonra saçma bir yere sapar
      top.style.left = hedefX + "%";
      top.style.top = guc < 20 ? "55%" : "22%";
      setTimeout(() => {
        let metin;
        if (guc < 20) metin = "Top kaleye ulaşamadı, yolda durdu. Bir karınca yolunu kesti.";
        else if (guc > 96) metin = "Top stadı aştı, Kandıra'ya düştü.";
        else metin = sec(SONUC);
        top.style.left = sec(["-10%", "110%", "50%", "8%", "92%"]);
        top.style.top = sec(["-15%", "5%", "80%"]);
        sonuc.textContent = "❌ " + metin;
        bahane.textContent = "Berkay: \"" + sec(BAHANE) + "\"";
        skorCiz();
        if (sut % 20 === 0) {
          sonuc.textContent += " 🏅 Tebrikler: " + sut + " şut, 0 gol. Berkay seviyesine ulaştın.";
        }
        setTimeout(() => {
          top.style.transition = "none";
          top.style.left = "50%";
          top.style.top = "78%";
          void top.offsetWidth;
          top.style.transition = "";
          calisiyor = true;
          kilit = false;
        }, 1100);
      }, 450);
    }
    bSol.addEventListener("click", () => sutCek("sol"));
    bOrta.addEventListener("click", () => sutCek("orta"));
    bSag.addEventListener("click", () => sutCek("sag"));
    temizle = () => cancelAnimationFrame(raf);
  }

  // ============================================================
  // 🏍️ KASKSIZ 85
  // ============================================================
  function motor() {
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Bayır aşağı eve dönüyorsun, eve 2 km var. Amaç: kaza yapmadan eve varmak. GAZ'a basılı tut, gerisini sen düşün."));

    const gosterge = el("div", "sp-hiz");
    const hizSayi = el("strong", null, "0");
    gosterge.appendChild(hizSayi);
    gosterge.appendChild(el("span", "muted", " km/s"));
    wrap.appendChild(gosterge);

    const yol = el("div", "sp-yol");
    const cizgi = el("div", "sp-yol-cizgi");
    yol.appendChild(cizgi);
    const moto = el("div", "sp-moto", "🏍️");
    yol.appendChild(moto);
    const buyuk = el("div", "sp-yol-yazi", "");
    yol.appendChild(buyuk);
    wrap.appendChild(yol);

    const mesafe = el("div", "sp-bar sp-mesafe");
    const mDolgu = el("div", "sp-bar-dolgu");
    mesafe.appendChild(mDolgu);
    wrap.appendChild(mesafe);
    const mYazi = el("p", "muted sp-small", "Eve: 2000 m");
    wrap.appendChild(mYazi);

    const kontrol = el("div", "sp-yonlar");
    const gaz = btn("🔥 GAZ (basılı tut)", "sp-big-btn");
    const fren = btn("🛑 FREN", "sp-big-btn sp-gri");
    const kask = btn("⛑️ KASK TAK", "sp-big-btn sp-gri");
    [gaz, fren, kask].forEach((b) => kontrol.appendChild(b));
    wrap.appendChild(kontrol);

    const mesaj = el("p", "sp-mesaj", "");
    wrap.appendChild(mesaj);
    const tekrar = btn("🔄 Tekrar bin", "sp-big-btn");
    tekrar.hidden = true;
    wrap.appendChild(tekrar);
    box.appendChild(wrap);

    const KAZA = [
      "Motor bir yöne, Berkay öbür yöne. Kask? Hangi kask.",
      "Hastane kaydı: \"Hasta sürekli 85 diye sayıklıyor.\"",
      "Berkay asfaltı çok yakından gördü. Asfalt da Berkay'ı.",
      "Kurban ambulansı aradı, sonra KPSS'ye döndü.",
      "Alihan: \"Enver Paşa da hızlı giderdi.\" Berkay: \"...\" (konuşamıyor)",
    ];
    const FREN = [
      "Fren bozuk. Berkay en son balata değiştirmeyi 2019'da düşünmüş.",
      "Frene bastın. Fren \"benim suçum yok\" dedi.",
      "Fren kolu elinde kaldı.",
    ];

    let hiz = 0;
    let yolAlinan = 0;
    let gazda = false;
    let gazaBasti = false;
    let bitti = false;
    let gordu = false;
    let off = 0;
    let timer = null;

    function sifirla() {
      hiz = 0;
      yolAlinan = 0;
      gazda = false;
      gazaBasti = false;
      bitti = false;
      gordu = false;
      moto.textContent = "🏍️";
      moto.classList.remove("is-crash");
      buyuk.textContent = "";
      mesaj.textContent = "";
      tekrar.hidden = true;
      [gaz, fren, kask].forEach((b) => (b.disabled = false));
    }

    function tik() {
      if (bitti) return;
      // Bayır aşağı: gaz olmasa da hız kendiliğinden artar
      hiz += gazda ? 1.1 : 0.4;
      yolAlinan += (hiz / 3.6) * 0.05;
      off = (off + hiz * 0.12) % 40;
      cizgi.style.backgroundPositionX = -off + "px";
      yol.style.setProperty("--titreme", Math.min(hiz / 85, 1) * 3 + "px");
      yol.classList.toggle("is-fast", hiz > 60);
      hizSayi.textContent = String(Math.floor(hiz));
      mDolgu.style.width = Math.min((yolAlinan / 2000) * 100, 100) + "%";
      mYazi.textContent = "Eve: " + Math.max(0, Math.round(2000 - yolAlinan)) + " m";
      if (hiz >= 85 && !gordu) {
        gordu = true;
        buyuk.textContent = "KUBİİİ 85'İ GÖRDÜM!";
        setTimeout(kaza, 1200);
      }
    }

    function kaza() {
      bitti = true;
      ses("carpisma");
      moto.textContent = "💥";
      moto.classList.add("is-crash");
      buyuk.textContent = "";
      mesaj.textContent =
        (gazaBasti ? "" : "Gaza hiç basmadın ama bayır aşağı motor kendi kendine 85'i gördü. ") +
        sec(KAZA) + " (Eve kalan: " + Math.round(2000 - yolAlinan) + " m)";
      [gaz, fren, kask].forEach((b) => (b.disabled = true));
      tekrar.hidden = false;
    }

    function gazBas(e) {
      e.preventDefault();
      if (bitti) return;
      gazda = true;
      gazaBasti = true;
    }
    function gazBirak() {
      gazda = false;
    }
    gaz.addEventListener("pointerdown", gazBas);
    gaz.addEventListener("pointerup", gazBirak);
    gaz.addEventListener("pointerleave", gazBirak);
    gaz.addEventListener("pointercancel", gazBirak);
    fren.addEventListener("click", () => {
      if (!bitti) mesaj.textContent = sec(FREN);
    });
    kask.addEventListener("click", () => {
      if (!bitti) mesaj.textContent = "Kask yok. Evde unutmuş. Aslında hiç almamış.";
    });
    tekrar.addEventListener("click", sifirla);

    sifirla();
    timer = setInterval(tik, 50);
    temizle = () => clearInterval(timer);
  }

  // ============================================================
  // 📋 SPOR KARNESİ (Firestore: spor/karne — admin düzenler)
  // ============================================================
  const KARNE_VARSAYILAN = [
    { emoji: "🏋️", baslik: "Spor salonu üyeliği", deger: "1", not: "Kullanılan gün: 1" },
    { emoji: "🏃", baslik: "Koşu bandı rekoru", deger: "8 km/s", not: "\"Kubiii 8'i gördüm\"" },
    { emoji: "⚽", baslik: "Halı saha kariyer golü", deger: "0", not: "Son maç: 18-4, katkı: 0" },
    { emoji: "🥊", baslik: "Boks makinesi rekoru", deger: "312", not: "Rekor 999. Bedeli: 1 el" },
    { emoji: "🏍️", baslik: "En yüksek hız", deger: "85 km/s", not: "Kasksız. Sonrası malum." },
    { emoji: "🤕", baslik: "Kırılan el", deger: "1+", not: "Ders çalışırken bile kırdı" },
    { emoji: "🌊", baslik: "Kayalıktan atlama", deger: "1", not: "Sonuç: tüm vücut çizik" },
    { emoji: "🎢", baslik: "Lunaparkta ağlama", deger: "∞", not: "Dönme dolap dahil" },
  ];

  function karne() {
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Berkay'ın resmî spor istatistikleri. Veriler bağımsız gözlemcilerce (4 arkadaş) doğrulanmıştır."));
    const grid = el("div", "sp-karne");
    wrap.appendChild(grid);
    const durum = el("p", "muted sp-small", "");
    wrap.appendChild(durum);
    const adminAlan = el("div", "sp-admin");
    wrap.appendChild(adminAlan);
    box.appendChild(wrap);

    let satirlar = KARNE_VARSAYILAN.map((s) => Object.assign({}, s));

    function ciz() {
      grid.innerHTML = "";
      satirlar.forEach((s) => {
        const k = el("div", "sp-karne-kart");
        k.appendChild(el("div", "sp-karne-emoji", s.emoji || "•"));
        k.appendChild(el("div", "sp-karne-deger", s.deger));
        k.appendChild(el("div", "sp-karne-baslik", s.baslik));
        if (s.not) k.appendChild(el("div", "sp-karne-not muted", s.not));
        grid.appendChild(k);
      });
      adminCiz();
    }

    function adminCiz() {
      adminAlan.innerHTML = "";
      if (!isAdmin) return;
      adminAlan.appendChild(btn("✏️ Karneyi düzenle", "game-mini-btn", duzenle));
    }

    function duzenle() {
      adminAlan.innerHTML = "";
      const form = el("div", "sp-admin-form");
      const kopya = satirlar.map((s) => Object.assign({}, s));
      function formCiz() {
        form.innerHTML = "";
        kopya.forEach((s, i) => {
          const r = el("div", "sp-admin-satir");
          [["emoji", 4, "😀"], ["baslik", 40, "Başlık"], ["deger", 20, "Değer"], ["not", 60, "Not"]].forEach(([alan, max, ph]) => {
            const inp = el("input", "sp-input sp-input-" + alan);
            inp.value = s[alan] || "";
            inp.maxLength = max;
            inp.placeholder = ph;
            inp.addEventListener("input", () => (s[alan] = inp.value));
            r.appendChild(inp);
          });
          r.appendChild(btn("✕", "game-mini-btn", () => {
            kopya.splice(i, 1);
            formCiz();
          }));
          form.appendChild(r);
        });
        const alt = el("div", "sp-admin-alt");
        if (kopya.length < 16) alt.appendChild(btn("+ Satır ekle", "game-mini-btn", () => {
          kopya.push({ emoji: "", baslik: "", deger: "", not: "" });
          formCiz();
        }));
        alt.appendChild(btn("💾 Kaydet", "game-mini-btn sp-kaydet", async () => {
          const temiz = kopya.filter((s) => s.baslik.trim()).map((s) => ({
            emoji: s.emoji.slice(0, 4), baslik: s.baslik.slice(0, 40), deger: s.deger.slice(0, 20), not: s.not.slice(0, 60),
          }));
          durum.textContent = "Kaydediliyor...";
          try {
            await db.collection("spor").doc("karne").set({ satirlar: temiz });
            satirlar = temiz;
            durum.textContent = "✅ Kaydedildi.";
            ciz();
          } catch (err) {
            durum.textContent = "⚠️ Kaydedilemedi: " + err.message + " (Firestore kurallarına spor eklendi mi?)";
          }
        }));
        alt.appendChild(btn("Vazgeç", "game-mini-btn", ciz));
        form.appendChild(alt);
      }
      formCiz();
      adminAlan.appendChild(form);
    }

    ciz();
    if (typeof db !== "undefined" && db) {
      db.collection("spor").doc("karne").get().then((snap) => {
        if (aktif !== "karne") return;
        const d = snap.exists ? snap.data() : null;
        if (d && Array.isArray(d.satirlar) && d.satirlar.length) {
          satirlar = d.satirlar.filter((s) => s && typeof s.baslik === "string").map((s) => ({
            emoji: String(s.emoji || ""), baslik: String(s.baslik), deger: String(s.deger || ""), not: String(s.not || ""),
          }));
          ciz();
        }
      }).catch(() => { /* kural yoksa varsayılan gösterilir */ });
    }
    temizle = () => { rerenderAdmin = null; };
    rerenderAdmin = () => { if (aktif === "karne") adminCiz(); };
  }

  // ============================================================
  // 🏆 BERKAY OLİMPİYATI (haftanın rezilliği oylaması)
  //   spor/olimpiyat  -> { hafta, adaylar: [..], gecmis: [{hafta, kazanan, oy}] }
  //   spor_oylar/{hafta_uid} -> { hafta, secim, uid }
  // ============================================================
  const OLIMPIYAT_VARSAYILAN = {
    hafta: "ilk",
    adaylar: [
      "Boks makinesinde rekor denerken el kırma",
      "Halı sahada 18-4'lük maçta 0 gol",
      "Kolayı yere koyup KPSS kitabı batırma",
      "Kasksız 85 ile bayır aşağı",
    ],
    gecmis: [],
  };

  function olimpiyat() {
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Haftanın rezilliğini sen seç. Her hafta en çok oyu alan olay madalyayı kapar. Herkesin 1 oyu var."));
    const gecmisAlan = el("div", "sp-gecmis");
    wrap.appendChild(gecmisAlan);
    const liste = el("div", "sp-aday-liste");
    wrap.appendChild(liste);
    const durum = el("p", "muted sp-small", "Yükleniyor...");
    wrap.appendChild(durum);
    const adminAlan = el("div", "sp-admin");
    wrap.appendChild(adminAlan);
    box.appendChild(wrap);

    let veri = JSON.parse(JSON.stringify(OLIMPIYAT_VARSAYILAN));
    let oylar = []; // [{secim, uid}]
    let benimOy = null;
    let dinleyici = null;

    const firebaseVar = typeof db !== "undefined" && db && typeof auth !== "undefined" && auth;

    function sayim() {
      const s = veri.adaylar.map(() => 0);
      oylar.forEach((o) => {
        if (o.secim >= 0 && o.secim < s.length) s[o.secim]++;
      });
      return s;
    }

    function ciz() {
      gecmisAlan.innerHTML = "";
      (veri.gecmis || []).slice(-3).reverse().forEach((g, i) => {
        const m = el("div", "sp-madalya" + (i === 0 ? " is-son" : ""));
        m.appendChild(el("span", "sp-madalya-ikon", i === 0 ? "🥇" : "🏅"));
        const t = el("div");
        t.appendChild(el("div", "sp-madalya-baslik", i === 0 ? "Geçen haftanın rezilliği" : "Önceki şampiyon"));
        t.appendChild(el("div", "sp-madalya-metin", g.kazanan + " (" + g.oy + " oy)"));
        m.appendChild(t);
        gecmisAlan.appendChild(m);
      });

      liste.innerHTML = "";
      const s = sayim();
      const toplam = s.reduce((a, b) => a + b, 0);
      if (!veri.adaylar.length) {
        liste.appendChild(el("p", "muted", "Bu hafta için henüz aday yok."));
      }
      veri.adaylar.forEach((a, i) => {
        const kart = el("div", "sp-aday" + (benimOy === i ? " is-benim" : ""));
        const ust = el("div", "sp-aday-ust");
        ust.appendChild(el("span", "sp-aday-metin", a));
        ust.appendChild(el("strong", "sp-aday-oy", s[i] + " oy"));
        kart.appendChild(ust);
        const b = el("div", "sp-bar sp-aday-bar");
        const d = el("div", "sp-bar-dolgu");
        d.style.width = toplam ? (s[i] / toplam) * 100 + "%" : "0%";
        b.appendChild(d);
        kart.appendChild(b);
        if (benimOy === null) {
          kart.appendChild(btn("🗳️ Bunu seçiyorum", "game-mini-btn", () => oyVer(i)));
        } else if (benimOy === i) {
          kart.appendChild(el("span", "sp-small muted", "✔ Senin oyun"));
        }
        liste.appendChild(kart);
      });
      adminCiz();
    }

    async function oyVer(i) {
      if (!firebaseVar) {
        durum.textContent = "Oylama şu an bağlı değil.";
        return;
      }
      durum.textContent = "Oy gönderiliyor...";
      try {
        if (!auth.currentUser) await auth.signInAnonymously();
        const uid = auth.currentUser.uid;
        await db.collection("spor_oylar").doc(veri.hafta + "_" + uid).set({ hafta: veri.hafta, secim: i, uid });
        benimOy = i;
        durum.textContent = "✅ Oyun alındı.";
        ciz();
      } catch (err) {
        durum.textContent = "⚠️ Oy verilemedi (zaten oy vermiş olabilirsin ya da oylama kapalı).";
      }
    }

    function adminCiz() {
      adminAlan.innerHTML = "";
      if (!isAdmin || !firebaseVar) return;
      const f = el("div", "sp-admin-form");
      f.appendChild(el("div", "sp-tablo-baslik", "⚙️ Admin: bu haftanın adayları"));
      veri.adaylar.forEach((a, i) => {
        const r = el("div", "sp-admin-satir");
        r.appendChild(el("span", "sp-aday-metin", a));
        r.appendChild(btn("✕", "game-mini-btn", () => {
          if (oylar.length && !confirm("Bu hafta oy verilmiş. Adayı silmek oyları karıştırabilir. Devam?")) return;
          veri.adaylar.splice(i, 1);
          kaydet();
        }));
        f.appendChild(r);
      });
      if (veri.adaylar.length < 10) {
        const r = el("div", "sp-admin-satir");
        const inp = el("input", "sp-input");
        inp.placeholder = "Yeni rezillik (ör. Durakta kartı kırma)";
        inp.maxLength = 80;
        r.appendChild(inp);
        r.appendChild(btn("+ Ekle", "game-mini-btn", () => {
          if (!inp.value.trim()) return;
          veri.adaylar.push(inp.value.trim());
          kaydet();
        }));
        f.appendChild(r);
      }
      const alt = el("div", "sp-admin-alt");
      alt.appendChild(btn("🏁 Haftayı bitir, kazananı ilan et", "game-mini-btn sp-kaydet", haftayiBitir));
      f.appendChild(alt);
      adminAlan.appendChild(f);
    }

    async function kaydet() {
      durum.textContent = "Kaydediliyor...";
      try {
        await db.collection("spor").doc("olimpiyat").set({
          hafta: veri.hafta,
          adaylar: veri.adaylar.slice(0, 10).map((a) => String(a).slice(0, 80)),
          gecmis: (veri.gecmis || []).slice(-10),
        });
        durum.textContent = "✅ Kaydedildi.";
      } catch (err) {
        durum.textContent = "⚠️ Kaydedilemedi: " + err.message + " (Firestore kurallarına spor eklendi mi?)";
      }
      ciz();
    }

    async function haftayiBitir() {
      const s = sayim();
      const max = Math.max(0, ...s);
      if (!max) {
        alert("Henüz hiç oy yok.");
        return;
      }
      const kazanan = veri.adaylar[s.indexOf(max)];
      if (!confirm("Kazanan: \"" + kazanan + "\" (" + max + " oy). Yeni hafta başlasın mı?")) return;
      veri.gecmis = (veri.gecmis || []).concat([{ hafta: veri.hafta, kazanan, oy: max }]);
      veri.hafta = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      veri.adaylar = [];
      oylar = [];
      benimOy = null;
      baglanOylar();
      await kaydet();
    }

    function baglanOylar() {
      if (dinleyici) dinleyici();
      dinleyici = db.collection("spor_oylar").where("hafta", "==", veri.hafta).onSnapshot(
        (snap) => {
          oylar = [];
          snap.forEach((d) => oylar.push(d.data()));
          const uid = auth.currentUser && auth.currentUser.uid;
          const benim = oylar.find((o) => o.uid === uid);
          benimOy = benim ? benim.secim : null;
          durum.textContent = oylar.length + " kişi oy verdi.";
          ciz();
        },
        () => {
          durum.textContent = "Oylar okunamadı (Firestore kurallarına spor_oylar eklendi mi?).";
          ciz();
        }
      );
    }

    ciz();
    if (!firebaseVar) {
      durum.textContent = "Oylama şu an bağlı değil.";
    } else {
      db.collection("spor").doc("olimpiyat").get().then((snap) => {
        if (snap.exists) {
          const d = snap.data();
          veri = {
            hafta: String(d.hafta || "ilk"),
            adaylar: Array.isArray(d.adaylar) ? d.adaylar.map(String) : [],
            gecmis: Array.isArray(d.gecmis) ? d.gecmis : [],
          };
        }
        baglanOylar();
      }).catch(() => baglanOylar());
      // Oyunu hatırlamak için (anonim de olsa) bir oturum lazım
      auth.onAuthStateChanged(() => { if (aktif === "olimpiyat") ciz(); });
    }
    rerenderAdmin = () => { if (aktif === "olimpiyat") adminCiz(); };
    temizle = () => {
      if (dinleyici) dinleyici();
      rerenderAdmin = null;
    };
  }

  // ---------------- Admin durumu ----------------
  let rerenderAdmin = null;
  if (window.YaparmiAuth) {
    window.YaparmiAuth.onChange((p) => {
      isAdmin = !!(p && p.rol === "admin");
      if (rerenderAdmin) rerenderAdmin();
    });
  }

  const ilk = (location.hash || "").replace("#", "");
  goster(["boks", "penalti", "motor", "karne", "olimpiyat"].includes(ilk) ? ilk : "boks");
})();
