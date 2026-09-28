// ============================================================
// spor.js — sadece spor.html'de çalışır. 5 bölüm:
//   🥊 Boks Makinesi   — bar yeşile ne kadar yakınsa o kadar sert (900 altı: bazen el kırılır, çoğu zaman bahane)
//   ⚽ Penaltı         — dönen oku doğru anda durdur, kalecide Kurban var
//   🏍️ Kasksız 85      — 1500 m ötedeki tarlaya arabalara çarpmadan var (kaza resmi admin panelinden)
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

  // 🏍️ 85'i geçince çalan ses (audio/kubi85.mp3)
  // Tarayıcılar sesi ancak kullanıcı bir tuşa bastıktan sonra çalmaya izin verir;
  // bu yüzden ilk gaz/şerit tuşunda sesin kilidini açıp dosyayı önceden yüklüyoruz.
  const KUBI_SES = "audio/kubi85.mp3";
  let kubiBuf = null;
  let kubiYukleniyor = false;
  let kubiKaynak = null;
  let kubiYedek = null; // Web Audio yoksa <audio> ile çal
  function kubiKilidiAc() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        if (!kubiYedek) {
          kubiYedek = new Audio(KUBI_SES);
          kubiYedek.preload = "auto";
        }
        return;
      }
      if (!ac) ac = new Ctx();
      if (ac.state === "suspended") ac.resume();
      if (kubiBuf || kubiYukleniyor) return;
      kubiYukleniyor = true;
      fetch(KUBI_SES)
        .then((r) => r.arrayBuffer())
        .then((b) => new Promise((ok, hata) => ac.decodeAudioData(b, ok, hata)))
        .then((buf) => (kubiBuf = buf))
        .catch(() => (kubiYukleniyor = false));
    } catch {
      /* ses yoksa oyun yine çalışır */
    }
  }
  function kubiCal() {
    try {
      kubiDurdur();
      if (ac && kubiBuf) {
        if (ac.state === "suspended") ac.resume();
        kubiKaynak = ac.createBufferSource();
        kubiKaynak.buffer = kubiBuf;
        kubiKaynak.connect(ac.destination);
        kubiKaynak.start();
      } else {
        if (!kubiYedek) kubiYedek = new Audio(KUBI_SES);
        kubiYedek.currentTime = 0;
        const p = kubiYedek.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch {
      /* sessiz geç */
    }
  }
  function kubiDurdur() {
    try {
      if (kubiKaynak) kubiKaynak.stop();
    } catch {
      /* zaten bitmiş */
    }
    kubiKaynak = null;
    if (kubiYedek) kubiYedek.pause();
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
  // Bar kırmızıdan (zayıf) yeşile (güçlü) dolar; ne kadar yeşilde basarsan o kadar
  // yüksek vurursun (en fazla 999). 900'ün altında: %20 el kırılır, %80 bahane.
  // ============================================================
  const BOKS_BAHANE = [
    "Makine bozuk.",
    "Eldiven kaydı.",
    "Güneş gözüme geldi. (Kapalı alan.)",
    "Isınmadım ki daha.",
    "Makine Burger'e göre ayarlı.",
    "Benim suçum yok.",
    "Dün halı sahada yoruldum.",
    "Elim hâlâ sargılı, sayılmaz.",
    "Sensör beni tanımadı.",
    "Alihan konuşunca konsantrem bozuldu.",
    "Kurban KPSS sorusu sordu, aklım gitti.",
    "Popeyes'tan yeni çıktım, midem dolu.",
    "Bu makine Enver Paşa'dan kalma.",
    "Yumruğum hızlı, makine yavaş.",
    "Halil'in deposunda bütün gücümü harcadım.",
    "Deneme vuruşuydu o, saymıyoruz.",
    "Airdrop'u düşündüm, dikkatim dağıldı.",
    "Soldan vursam 999'du.",
    "Zemin ıslaktı.",
    "Makine vurmadan önce 'hazır' demedi.",
  ];

  function boks() {
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Bar kırmızıdan yeşile doluyor. Ne kadar yeşilde basarsan o kadar sert vurursun. Rekor: 999."));

    const makine = el("div", "sp-boks-makine");
    const ekran = el("div", "sp-boks-ekran", "000");
    const armut = el("div", "sp-boks-armut", "🥊");
    makine.appendChild(ekran);
    makine.appendChild(armut);
    wrap.appendChild(makine);

    const bar = el("div", "sp-bar sp-bar-boks");
    const dolgu = el("div", "sp-bar-dolgu");
    bar.appendChild(dolgu);
    wrap.appendChild(bar);

    const vur = btn("🥊 VUR! (boşluk)", "sp-big-btn");
    wrap.appendChild(vur);
    const mesaj = el("p", "sp-mesaj", "");
    const bahane = el("p", "sp-bahane", "");
    wrap.appendChild(mesaj);
    wrap.appendChild(bahane);

    const skorlar = el("div", "sp-tablo");
    wrap.appendChild(skorlar);
    const elSayac = el("p", "muted sp-small", "");
    wrap.appendChild(elSayac);
    box.appendChild(wrap);

    let enIyi = lsGet("spor_boks_eniyi", 0);
    let kirik = lsGet("spor_boks_kirik", 0);
    let bahaneSira = lsGet("spor_boks_bahane", 0);

    function tabloCiz() {
      skorlar.innerHTML = "";
      skorlar.appendChild(el("div", "sp-tablo-baslik", "🏆 Rekor tablosu"));
      const satirlar = [
        ["🍔 Burger", 999, "(burger yedikten sonra)"],
        ["📦 Halil", 910, "(depo kasları)"],
        ["📚 Kurban", 870, "(KPSS stresi)"],
        ["🦅 Alihan", -1, "(\"Enver Paşa adına vurmam\")"],
        ["🥊 Berkay", enIyi, "(sen)"],
      ].sort((a, b) => b[1] - a[1]);
      satirlar.forEach(([ad, skor, not]) => {
        const r = el("div", "sp-tablo-satir" + (ad.includes("Berkay") ? " is-sen" : ""));
        r.appendChild(el("span", "sp-tablo-ad", ad));
        r.appendChild(el("span", "sp-tablo-not muted", not));
        r.appendChild(el("strong", "sp-tablo-skor", skor > 0 ? String(skor) : "—"));
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
        pos += yon * 1.5;
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
      const skor = Math.max(0, Math.min(999, Math.round(pos * 9.99 + rand(-12, 12))));
      armut.classList.remove("is-hit");
      void armut.offsetWidth;
      armut.classList.add("is-hit");
      ses("dup");
      mesaj.textContent = "";
      bahane.textContent = "";
      let n = 0;
      const sayac = setInterval(() => {
        n = Math.min(skor, n + Math.max(1, Math.ceil(skor / 25)));
        ekran.textContent = String(n).padStart(3, "0");
        if (n < skor) return;
        clearInterval(sayac);
        const yeniRekor = skor > enIyi;
        if (yeniRekor) {
          enIyi = skor;
          lsSet("spor_boks_eniyi", enIyi);
        }
        if (skor >= 900) {
          mesaj.textContent = skor === 999
            ? "💥 999! Burger'in rekoruna ortak oldun! Salon ayakta alkışlıyor."
            : "💪 " + skor + "! Salondakiler şokta. Burger burgerini düşürdü.";
          bahane.textContent = "Berkay: \"Ben demiştim.\" (Kimse bir şey dememişti.)";
        } else if (Math.random() < 0.2) {
          ses("cit");
          kirik++;
          lsSet("spor_boks_kirik", kirik);
          wrap.classList.add("sp-shake");
          mesaj.textContent = "🦴 " + skor + ". Elinden \"çıt\" diye bir ses geldi.";
          bahane.textContent = "Berkay: \"" + BOKS_BAHANE[bahaneSira % BOKS_BAHANE.length] + "\"";
          bahaneSira++;
        } else {
          mesaj.textContent = skor + (yeniRekor ? " (kendi rekorun!)" : "") + ". Beklenen: 999.";
          bahane.textContent = "Berkay: \"" + BOKS_BAHANE[bahaneSira % BOKS_BAHANE.length] + "\"";
          bahaneSira++;
        }
        lsSet("spor_boks_bahane", bahaneSira);
        tabloCiz();
        setTimeout(() => {
          wrap.classList.remove("sp-shake");
          calisiyor = true;
          kilit = false;
        }, 900);
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
  // Topun önünde soldan sağa 180° dönen bir ok var; VUR'a basınca top neredeyse
  // okun gösterdiği yöne gider. Kalede sağa sola giden kaleci Kurban var.
  // ============================================================
  function penalti() {
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Ok soldan sağa dönüyor. Kaleyi gösterdiği anda VUR'a bas (ya da boşluk). Kalede Kurban var, KPSS kitabıyla."));

    const skor = el("div", "sp-skorbord");
    wrap.appendChild(skor);

    const saha = el("div", "sp-saha");
    const kale = el("div", "sp-kale");
    saha.appendChild(kale);
    const kaleci = el("div", "sp-kaleci", "🧤");
    saha.appendChild(kaleci);
    const ok = el("div", "sp-ok");
    saha.appendChild(ok);
    const top = el("div", "sp-top", "⚽");
    saha.appendChild(top);
    wrap.appendChild(saha);

    const vur = btn("⚽ VUR! (boşluk)", "sp-big-btn");
    wrap.appendChild(vur);
    const sonuc = el("p", "sp-mesaj", "");
    const bahane = el("p", "sp-bahane", "");
    wrap.appendChild(sonuc);
    wrap.appendChild(bahane);
    box.appendChild(wrap);

    const KACAN = [
      "Top direkten döndü.",
      "Top auta gitti, park halindeki arabanın alarmı çaldı.",
      "Top tellere çarpıp suratına döndü.",
      "Top Alihan'ın kafasına geldi. Alihan: \"Enver Paşa böyle şut atmazdı.\"",
      "Top Burger'in burgerine çarptı. Burger ağlıyor.",
      "Top Halil'in depo yeleğine yapıştı.",
    ];
    const KURTARIS = [
      "Kurban kurtardı! KPSS kitabıyla çeldi.",
      "Kurban kurtardı ve \"memur olunca bunu da anlatacağım\" dedi.",
      "Kurban uzandı, topu tuttu, KPSS'ye döndü.",
    ];
    const BAHANE = [
      "Zemin ıslaktı.", "Top yamuktu.", "Ayakkabım kaydı.", "Güneş gözüme geldi.",
      "Kale küçük.", "Rüzgâr vardı. (Kapalı saha.)", "Elim sargılı, dengem bozuldu.",
      "Benim suçum yok.", "Kaleci önceden hareket etti.",
    ];
    const GOL = [
      "GOOOL! Berkay'ın kariyerindeki ilk... yok, ilk değilmiş, yine de GOOOL!",
      "GOOOL! Berkay formasını çıkarmaya çalıştı, kafası sıkıştı.",
      "GOOOL! Alihan: \"Enver Paşa da böyle atardı.\"",
      "GOOOL! Burger kutlama için burger ısmarladı. Kendine.",
      "GOOOL! Kurban: \"KPSS'de de böyle şans olsa.\"",
    ];

    let st = lsGet("spor_penalti", { sut: 0, gol: 0 });
    function skorCiz() {
      skor.innerHTML = "";
      [["Şut", st.sut], ["Gol", st.gol], ["İsabet", st.sut ? Math.round((st.gol / st.sut) * 100) + "%" : "—"]].forEach(([a, b]) => {
        const k = el("div", "sp-skor-kutu");
        k.appendChild(el("span", "muted", a));
        k.appendChild(el("strong", null, String(b)));
        skor.appendChild(k);
      });
    }
    skorCiz();

    // açı: 180 (sol) -> 0 (sağ)
    let aci = 180;
    let adim = -1.6;
    let dondur = true;
    let kaleciX = 0.5; // 0..1 kale içindeki konum
    let kaleciYon = 1;
    let kilit = false;
    let raf = null;

    function boyut() {
      return { W: saha.clientWidth, H: saha.clientHeight };
    }
    function topBaslangic() {
      const { W, H } = boyut();
      return { x: W / 2, y: H - 34 };
    }
    function topKoy(x, y) {
      top.style.left = x + "px";
      top.style.top = y + "px";
    }
    function sifirlaTop() {
      top.style.transition = "none";
      const b = topBaslangic();
      topKoy(b.x, b.y);
      void top.offsetWidth;
      top.style.transition = "";
    }
    sifirlaTop();

    function dongu() {
      const { W } = boyut();
      if (dondur) {
        aci += adim;
        if (aci <= 0) { aci = 0; adim = 1.6; }
        if (aci >= 180) { aci = 180; adim = -1.6; }
      }
      const b = topBaslangic();
      ok.style.left = b.x + "px";
      ok.style.top = b.y + "px";
      ok.style.transform = "rotate(" + -aci + "deg)";
      kaleciX += kaleciYon * 0.006;
      if (kaleciX > 0.92) kaleciYon = -1;
      if (kaleciX < 0.08) kaleciYon = 1;
      const kaleSol = W * 0.12;
      const kaleGen = W * 0.76;
      kaleci.style.left = kaleSol + kaleciX * kaleGen + "px";
      raf = requestAnimationFrame(dongu);
    }
    raf = requestAnimationFrame(dongu);

    function sut() {
      if (kilit) return;
      kilit = true;
      dondur = false;
      ok.style.opacity = "0.3";
      ses("top");
      const { W } = boyut();
      const b = topBaslangic();
      const golCizgisiY = 80; // kalenin alt çizgisi (px)
      const a = ((aci + (Math.random() * 10 - 5)) * Math.PI) / 180; // ±5° sapma
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let hedefX;
      let hedefY;
      let durum;
      if (dy < 0.12) {
        // neredeyse yatay: yana gider
        hedefX = dx > 0 ? W + 30 : -30;
        hedefY = b.y - 30;
        durum = "kacti";
      } else {
        const t = (b.y - golCizgisiY) / dy;
        hedefX = b.x + dx * t;
        hedefY = golCizgisiY - 30;
        const kaleSol = W * 0.12 + 6;
        const kaleSag = W * 0.88 - 6;
        const kaleciPx = W * 0.12 + kaleciX * W * 0.76;
        if (hedefX < kaleSol || hedefX > kaleSag) durum = "kacti";
        else if (Math.abs(hedefX - kaleciPx) < 28) durum = "kurtardi";
        else durum = "gol";
        if (durum === "kurtardi") hedefY = golCizgisiY - 6;
      }
      topKoy(hedefX, hedefY);
      st.sut++;
      setTimeout(() => {
        if (durum === "gol") {
          st.gol++;
          sonuc.textContent = "⚽ " + sec(GOL);
          bahane.textContent = "";
          saha.classList.add("is-gol");
        } else {
          sonuc.textContent = "❌ " + (durum === "kurtardi" ? sec(KURTARIS) : sec(KACAN));
          bahane.textContent = "Berkay: \"" + sec(BAHANE) + "\"";
        }
        lsSet("spor_penalti", st);
        skorCiz();
        setTimeout(() => {
          saha.classList.remove("is-gol");
          sifirlaTop();
          ok.style.opacity = "";
          dondur = true;
          kilit = false;
        }, 1300);
      }, 480);
    }
    vur.addEventListener("click", sut);
    function tus(e) {
      if (e.code === "Space") {
        e.preventDefault();
        sut();
      }
    }
    document.addEventListener("keydown", tus);
    temizle = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", tus);
    };
  }

  // ============================================================
  // 🏍️ KASKSIZ 85
  // Hedef: 1500 m ötedeki tarla. Yolda arabalar var, ↑/↓ ile şerit değiştir,
  // → gaz, ← fren. Kaza olursa admin panelinden seçilen resim ekrana gelir.
  // ============================================================
  let motorResim = null; // Firestore: spor/motor.resim
  let motorResimYuklendi = false;
  function motorResmiYukle() {
    if (motorResimYuklendi || typeof db === "undefined" || !db) return;
    motorResimYuklendi = true;
    db.collection("spor").doc("motor").get().then((snap) => {
      const r = snap.exists ? snap.data().resim : null;
      if (typeof r === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(r)) motorResim = r;
    }).catch(() => { /* yoksa 💥 gösterilir */ });
  }

  function motor() {
    motorResmiYukle();
    const HEDEF = 1500;
    const SERIT = 3;
    const wrap = el("div", "sp-wrap");
    wrap.appendChild(el("p", "muted sp-desc", "Hedef: 1500 m ötedeki tarla. Yol bayır aşağı, arabalara çarpma. ↑/↓ şerit değiştir, → gaz, ← fren (klavye ya da aşağıdaki tuşlar)."));

    const ust = el("div", "sp-motor-ust");
    const hizEl = el("div", "sp-hiz");
    const hizSayi = el("strong", null, "0");
    hizEl.appendChild(hizSayi);
    hizEl.appendChild(el("span", "muted", " km/s"));
    ust.appendChild(hizEl);
    const mesafeYazi = el("div", "sp-motor-mesafe", "🌾 Tarlaya: 1500 m");
    ust.appendChild(mesafeYazi);
    wrap.appendChild(ust);

    const yol = el("div", "sp-yol2");
    for (let i = 1; i < SERIT; i++) {
      const c = el("div", "sp-serit-cizgi");
      c.style.top = (i / SERIT) * 100 + "%";
      yol.appendChild(c);
    }
    const moto = el("div", "sp-moto2", "🏍️");
    yol.appendChild(moto);
    const tarla = el("div", "sp-tarla", "🌾");
    yol.appendChild(tarla);
    const buyuk = el("div", "sp-yol-yazi", "");
    yol.appendChild(buyuk);
    const kazaEkran = el("div", "sp-kaza");
    kazaEkran.hidden = true;
    yol.appendChild(kazaEkran);
    wrap.appendChild(yol);

    const mesafe = el("div", "sp-bar sp-mesafe");
    const mDolgu = el("div", "sp-bar-dolgu");
    mesafe.appendChild(mDolgu);
    wrap.appendChild(mesafe);

    const kontrol = el("div", "sp-motor-kontrol");
    const yukari = btn("⬆️", "sp-big-btn sp-gri sp-kare");
    const asagi = btn("⬇️", "sp-big-btn sp-gri sp-kare");
    const fren = btn("🛑 FREN", "sp-big-btn sp-gri");
    const gaz = btn("🔥 GAZ", "sp-big-btn");
    const yonler = el("div", "sp-yon-dikey");
    yonler.appendChild(yukari);
    yonler.appendChild(asagi);
    kontrol.appendChild(yonler);
    kontrol.appendChild(fren);
    kontrol.appendChild(gaz);
    wrap.appendChild(kontrol);

    const mesaj = el("p", "sp-mesaj", "");
    wrap.appendChild(mesaj);
    const tekrar = btn("🔄 Tekrar bin", "sp-big-btn");
    wrap.appendChild(tekrar);
    box.appendChild(wrap);

    const KAZA = [
      "Kasksız çarptı. Kask? Hangi kask.",
      "Hastane kaydı: \"Hasta sürekli 'kubiii' diye sayıklıyor.\"",
      "Berkay arabanın bagajını çok yakından gördü.",
      "Kurban ambulansı aradı, sonra KPSS'ye döndü.",
      "Alihan: \"Enver Paşa da çarpardı.\"",
      "Burger olay yerine geldi, burger yiyerek tutanak tuttu.",
      "Halil çekiciyi depodan ayarladı, faturayı Berkay'a kesti.",
    ];
    const ARACLAR = ["🚗", "🚙", "🚕", "🚚", "🚌", "🚜"];

    let hiz, konum, serit, araclar, bitti, gazda, frende, gordu85, sonZaman, spawnSure, raf;
    let frenMesaj = false;

    function seritY(i) {
      return ((i + 0.5) / SERIT) * yol.clientHeight;
    }

    function sifirla() {
      hiz = 30;
      konum = 0;
      serit = 1;
      bitti = false;
      gazda = false;
      frende = false;
      gordu85 = false;
      kubiDurdur();
      spawnSure = 1.2;
      araclar.forEach((a) => a.el.remove());
      araclar = [];
      kazaEkran.hidden = true;
      kazaEkran.innerHTML = "";
      yol.classList.remove("is-kaza");
      buyuk.textContent = "";
      mesaj.textContent = "";
      moto.classList.remove("is-crash");
      moto.textContent = "🏍️";
      tekrar.hidden = true;
      tarla.style.left = "110%";
      sonZaman = performance.now();
    }
    araclar = [];

    function seritDegistir(d) {
      if (bitti) return;
      serit = Math.max(0, Math.min(SERIT - 1, serit + d));
    }

    function kaza() {
      bitti = true;
      ses("carpisma");
      moto.classList.add("is-crash");
      moto.textContent = "💥";
      kazaEkran.hidden = false;
      kazaEkran.innerHTML = "";
      yol.classList.add("is-kaza");
      araclar.forEach((a) => (a.el.style.visibility = "hidden"));
      if (motorResim) {
        const img = el("img");
        img.src = motorResim;
        img.alt = "Kaza";
        kazaEkran.appendChild(img);
      } else {
        kazaEkran.appendChild(el("div", "sp-kaza-emoji", "💥"));
      }
      kazaEkran.appendChild(el("div", "sp-kaza-yazi", "KAZA! " + Math.round(konum) + " m"));
      mesaj.textContent = sec(KAZA) + " (Tarlaya kalan: " + Math.max(0, Math.round(HEDEF - konum)) + " m)";
      tekrar.hidden = false;
    }

    function kazandi() {
      bitti = true;
      buyuk.textContent = "🌾 TARLAYA VARDI!";
      mesaj.textContent = "Berkay tarlaya kazasız vardı! Kasksız ama sağ salim. Traktörcü amca: \"Hayırdır evlat, bu hızla nereye?\"";
      tekrar.hidden = false;
    }

    function kare(t) {
      const dt = Math.min(0.05, (t - sonZaman) / 1000);
      sonZaman = t;
      if (!bitti) {
        // Bayır aşağı: kendiliğinden hızlanır. Gaz daha çok, fren yavaşlatır.
        hiz += (2.5 + (gazda ? 16 : 0) - (frende ? 28 : 0)) * dt;
        hiz = Math.max(10, Math.min(140, hiz));
        konum += (hiz / 3.6) * dt;
        if (hiz >= 85 && !gordu85) {
          gordu85 = true;
          buyuk.textContent = "KUBİİİ 85'İ GÖRDÜM!";
          kubiCal();
          setTimeout(() => { if (!bitti) buyuk.textContent = ""; }, 1800);
        }
        const W = yol.clientWidth;
        const pxm = W / 90; // ekranda ~90 metre görünüyor
        // araç üret
        spawnSure -= dt * (hiz / 60);
        if (spawnSure <= 0 && konum < HEDEF - 60) {
          spawnSure = 0.9 + Math.random() * 1.2;
          const s = rand(0, SERIT - 1);
          const e = el("div", "sp-arac", sec(ARACLAR));
          yol.appendChild(e);
          araclar.push({ el: e, x: W + 40, serit: s, hiz: rand(25, 55) });
        }
        const motoX = W * 0.16;
        araclar = araclar.filter((a) => {
          a.x -= ((hiz - a.hiz) / 3.6) * dt * pxm;
          a.el.style.left = a.x + "px";
          a.el.style.top = seritY(a.serit) + "px";
          if (a.serit === serit && Math.abs(a.x - motoX) < 34) kaza();
          if (a.x < -60 || a.x > W + 80) {
            a.el.remove();
            return false;
          }
          return true;
        });
        moto.style.top = seritY(serit) + "px";
        const kalan = HEDEF - konum;
        tarla.style.left = kalan < 90 ? motoX + kalan * pxm + "px" : "110%";
        hizSayi.textContent = String(Math.floor(hiz));
        mesafeYazi.textContent = "🌾 Tarlaya: " + Math.max(0, Math.round(kalan)) + " m";
        mDolgu.style.width = Math.min(100, (konum / HEDEF) * 100) + "%";
        yol.style.setProperty("--kay", -((konum * pxm) % 60) + "px");
        yol.classList.toggle("is-fast", hiz > 85);
        if (!bitti && konum >= HEDEF) kazandi();
      }
      raf = requestAnimationFrame(kare);
    }

    function basili(b, ac, kapa) {
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); kubiKilidiAc(); ac(); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, kapa));
    }
    basili(gaz, () => (gazda = true), () => (gazda = false));
    basili(fren, () => {
      frende = true;
      if (!frenMesaj) {
        frenMesaj = true;
        mesaj.textContent = "Fren çalışıyor! Berkay şaşırdı. (Balatalar 2019'dan kalma ama olsun.)";
      }
    }, () => (frende = false));
    yukari.addEventListener("click", () => { kubiKilidiAc(); seritDegistir(-1); });
    asagi.addEventListener("click", () => { kubiKilidiAc(); seritDegistir(1); });
    tekrar.addEventListener("click", () => { kubiKilidiAc(); sifirla(); });
    wrap.addEventListener("pointerdown", kubiKilidiAc);

    function tusBas(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        kubiKilidiAc();
      }
      if (e.key === "ArrowUp" && !e.repeat) seritDegistir(-1);
      if (e.key === "ArrowDown" && !e.repeat) seritDegistir(1);
      if (e.key === "ArrowRight") gazda = true;
      if (e.key === "ArrowLeft") frende = true;
    }
    function tusBirak(e) {
      if (e.key === "ArrowRight") gazda = false;
      if (e.key === "ArrowLeft") frende = false;
    }
    document.addEventListener("keydown", tusBas);
    document.addEventListener("keyup", tusBirak);

    sifirla();
    raf = requestAnimationFrame(kare);
    temizle = () => {
      cancelAnimationFrame(raf);
      kubiDurdur();
      document.removeEventListener("keydown", tusBas);
      document.removeEventListener("keyup", tusBirak);
    };
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
