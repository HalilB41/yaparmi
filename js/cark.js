// ============================================================
// cark.js — sadece cark.html: Sınırsız Çark + Sınırsız Maximus Çarkı.
//
// Firestore:
//   cark/ayarlar  { acik, tur, hak, sinirsiz: [{ad, agirlik, maximus}], maximus: [{ad, agirlik}] }
//     acik     → çarklar açık mı (admin panelinden açılıp kapanır)
//     tur      → admin çarkı her açtığında 1 artar; haklar her turda yenilenir
//     hak      → bir kullanıcının bir turda Sınırsız Çark'ı kaç kez çevirebileceği
//     maximus: true olan dilim → çıkarsa kullanıcı 1 Maximus bileti kazanır
//     sifirTur → admin "herkesin hakkını sıfırla" dediği tur; o turda kimsenin hakkı kalmaz
//     sifirZaman → o andan önce kazanılmış, kullanılmamış Maximus biletleri geçersiz
//   cark_sonuclari/{id}  kime ne çıktı (admin panelinde hepsi görünür)
//     Sınırsız: id = tur_uid_sN      Maximus: id = mx_<bilet belgesinin id'si>
//     { uid, kullaniciAdi, cark, odul, maximusBileti, tur, sira | bilet, tarih, istendi, verildi }
//
// Çarkı çevirmek için gerçek bir hesap (kullanıcı adı) şart.
// ============================================================
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const kapi = $("carkKapi");
  const kapiYazi = $("carkKapiYazi");
  const girisBtn = $("carkGirisBtn");
  const icerik = $("carkIcerik");
  const durumEl = $("carkDurum");
  const odulListe = $("odulListe");

  let ayarlar = { acik: false, tur: 0, hak: 1, sinirsiz: [], maximus: [], sifirTur: -1, sifirMs: 0 };
  let profile = null;
  let authCozuldu = false;
  let sonuclar = []; // kullanıcının kendi sonuçları
  let sonucDinleyici = null;
  let donuyor = false;
  let gizliId = null; // çark dönerken yeni sonuç Ödüllerim'de erken görünmesin

  // ---------------- Yardımcılar ----------------
  function temizDilimler(l, maximusOlabilir) {
    return (Array.isArray(l) ? l : [])
      .filter((d) => d && typeof d.ad === "string" && d.ad.trim())
      .map((d) => ({
        ad: d.ad.trim().slice(0, 80),
        agirlik: Math.max(0, Math.min(1000, Number(d.agirlik) || 0)),
        maximus: !!(maximusOlabilir && d.maximus),
      }))
      .filter((d) => d.agirlik > 0);
  }

  function agirlikliSec(dilimler) {
    const toplam = dilimler.reduce((t, d) => t + d.agirlik, 0);
    let r = Math.random() * toplam;
    for (let i = 0; i < dilimler.length; i++) {
      r -= dilimler[i].agirlik;
      if (r < 0) return i;
    }
    return dilimler.length - 1;
  }

  function tarihYaz(ts) {
    try { return ts && ts.toDate ? ts.toDate().toLocaleString("tr-TR") : "az önce"; } catch { return "-"; }
  }

  const carklar = {
    sinirsiz: { tuval: $("sinirsizTuval"), btn: $("sinirsizCevir"), kilit: $("sinirsizKilit"), hakEl: $("sinirsizHak"), aci: 0, dilimler: [] },
    maximus: { tuval: $("maximusTuval"), btn: $("maximusCevir"), kilit: $("maximusKilit"), hakEl: $("maximusHak"), aci: 0, dilimler: [] },
  };

  function dilimleriGuncelle() {
    if (donuyor) return; // dönerken çarkın şekli değişmesin
    carklar.sinirsiz.dilimler = temizDilimler(ayarlar.sinirsiz, true);
    carklar.maximus.dilimler = temizDilimler(ayarlar.maximus, false);
    CarkCiz.ciz(carklar.sinirsiz.tuval, carklar.sinirsiz.dilimler, CarkCiz.RENKLER);
    maximusCiz(true);
  }

  // Maximus kilitliyken ödüller görünmesin: sadece "?" dilimleri çizilir.
  const GIZLI_DILIMLER = Array.from({ length: 8 }, () => ({ ad: "?", agirlik: 1, maximus: false }));
  let maximusGizliCizili = null;
  function maximusKilitli() {
    return !(ayarlar.acik && kullanilmamisBiletler(gorunen()).length > 0);
  }
  function maximusCiz(zorla) {
    if (donuyor) return;
    const gizli = maximusKilitli();
    if (!zorla && gizli === maximusGizliCizili) return;
    maximusGizliCizili = gizli;
    if (gizli) CarkCiz.ciz(carklar.maximus.tuval, GIZLI_DILIMLER, CarkCiz.MAXIMUS_RENKLER);
    else CarkCiz.ciz(carklar.maximus.tuval, carklar.maximus.dilimler, CarkCiz.MAXIMUS_RENKLER);
  }

  function dondur(cark, index) {
    return new Promise((resolve) => {
      // Dilimler şansa göre farklı genişlikte: seçilen dilimin ortasına (biraz kaydırarak) denk getir.
      const d = CarkCiz.acilar(cark.dilimler)[index];
      const gen = d.son - d.bas;
      const sapma = (Math.random() - 0.5) * gen * 0.7;
      const hedef = (((360 - ((d.bas + d.son) / 2 + sapma)) % 360) + 360) % 360;
      const simdiki = ((cark.aci % 360) + 360) % 360;
      let fark = hedef - simdiki;
      if (fark < 0) fark += 360;
      // Her çevirişte süre 5-13 saniye arası rastgele, tur sayısı da süreye göre rastgele.
      const sure = 5 + Math.random() * 8;
      const tur = Math.round(sure * (0.9 + Math.random() * 0.6));
      cark.aci += 360 * Math.max(3, tur) + fark;
      const tuval = cark.tuval;
      tuval.style.transition = "transform " + sure.toFixed(2) + "s cubic-bezier(.12,.72,.12,1)";
      tuval.style.transform = "rotate(" + cark.aci + "deg)";
      let bitti = false;
      const son = () => { if (bitti) return; bitti = true; resolve(); };
      tuval.addEventListener("transitionend", son, { once: true });
      setTimeout(son, sure * 1000 + 400);
    });
  }

  // ---------------- Hak ve bilet hesabı ----------------
  function gorunen() {
    return sonuclar.filter((s) => s.id !== gizliId);
  }
  function buTurdakiSinirsizlar(liste = sonuclar) {
    return liste.filter((s) => s.cark === "sinirsiz" && s.tur === ayarlar.tur);
  }
  function kalanHak(liste = sonuclar) {
    if (ayarlar.sifirTur === ayarlar.tur) return 0;
    return Math.max(0, (ayarlar.hak || 1) - buTurdakiSinirsizlar(liste).length);
  }
  function siradakiSira() {
    const kullanilan = new Set(buTurdakiSinirsizlar().map((s) => s.sira));
    for (let i = 0; i < (ayarlar.hak || 1); i++) if (!kullanilan.has(i)) return i;
    return -1;
  }
  // Admin sıfırlamadan önce kazanılmış bilet geçersiz. (tarihMs 0 = az önce yazıldı, sunucu saati henüz gelmedi → geçerli)
  function biletSifirlandi(s) {
    return ayarlar.sifirMs > 0 && s.tarihMs > 0 && s.tarihMs <= ayarlar.sifirMs;
  }
  function kullanilmamisBiletler(liste = sonuclar) {
    const kullanilan = new Set(liste.filter((s) => s.cark === "maximus").map((s) => s.bilet));
    return liste.filter((s) => s.cark === "sinirsiz" && s.maximusBileti && !kullanilan.has(s.id) && !biletSifirlandi(s));
  }

  function arayuzGuncelle() {
    const acik = !!ayarlar.acik;
    const hak = kalanHak(gorunen());
    const biletler = kullanilmamisBiletler(gorunen());
    const s = carklar.sinirsiz;
    const m = carklar.maximus;

    if (acik) {
      durumEl.className = "card cark-durum is-acik";
      durumEl.textContent = "🟢 Çarklar AÇIK! Halil depoda, kutu taşıyor. Çevir bakalım.";
    } else {
      durumEl.className = "card cark-durum";
      durumEl.textContent = "🔴 Çarklar şu an kapalı. Halil Hepsiburada deposuna amelelik yapmaya gidince admin açacak.";
    }

    s.kilit.hidden = acik;
    s.btn.disabled = donuyor || !acik || hak <= 0 || !s.dilimler.length;
    s.hakEl.textContent = !acik ? "Kapalı" : hak > 0 ? "Bu tur kalan hakkın: " + hak : "Bu turdaki hakkın bitti, bir sonraki açılışı bekle.";

    m.kilit.hidden = acik && biletler.length > 0;
    maximusCiz(false);
    m.btn.disabled = donuyor || !acik || !biletler.length || !m.dilimler.length;
    m.hakEl.textContent = biletler.length
      ? "🎟️ " + biletler.length + " Maximus biletin var!"
      : "Kilitli. Açmak için Sınırsız Çark'tan 🌟 Maximus dilimi çıkmalı.";
  }

  function durumYaz(metin) {
    durumEl.className = "card cark-durum is-hata";
    durumEl.textContent = metin;
  }

  // ---------------- Çevirme ----------------
  async function cevir(tur) {
    if (donuyor || !profile || !ayarlar.acik) return;
    const cark = carklar[tur];
    if (!cark.dilimler.length) return;

    let docId, veri;
    const index = agirlikliSec(cark.dilimler);
    const dilim = cark.dilimler[index];
    const ortak = {
      uid: profile.uid,
      kullaniciAdi: profile.kullaniciAdi,
      cark: tur,
      odul: dilim.ad,
      tarih: firebase.firestore.FieldValue.serverTimestamp(),
      istendi: false,
    };

    if (tur === "sinirsiz") {
      const sira = siradakiSira();
      if (sira < 0) return;
      docId = ayarlar.tur + "_" + profile.uid + "_s" + sira;
      veri = Object.assign(ortak, { maximusBileti: dilim.maximus, tur: ayarlar.tur, sira });
    } else {
      const bilet = kullanilmamisBiletler()[0];
      if (!bilet) return;
      docId = "mx_" + bilet.id;
      veri = Object.assign(ortak, { maximusBileti: false, bilet: bilet.id });
    }

    donuyor = true;
    gizliId = docId;
    arayuzGuncelle();
    try {
      // Önce kaydediyoruz: sayfayı yenileyip "kötü çıktı, bir daha çevireyim" olmasın.
      await db.collection("cark_sonuclari").doc(docId).set(veri);
    } catch (err) {
      console.error("Çark sonucu kaydedilemedi:", err.message);
      donuyor = false;
      gizliId = null;
      arayuzGuncelle();
      durumYaz("⚠️ Çevrilemedi: " + err.message + " (Çark kapanmış ya da hakkın bitmiş olabilir.)");
      return;
    }

    await dondur(cark, index);
    donuyor = false;
    dilimleriGuncelle();
    arayuzGuncelle();
    modalAc(docId, veri);
    gizliId = null;
    odulleriCiz();
    arayuzGuncelle();
  }

  carklar.sinirsiz.btn.addEventListener("click", () => cevir("sinirsiz"));
  carklar.maximus.btn.addEventListener("click", () => cevir("maximus"));

  // ---------------- Kazandın ekranı ----------------
  const modal = $("carkModal");
  const modalIste = $("carkModalIste");
  const modalMaximus = $("carkModalMaximus");
  let modalDocId = null;

  function modalAc(docId, veri) {
    modalDocId = docId;
    $("carkModalOdul").textContent = veri.maximusBileti ? "🌟 SINIRSIZ MAXİMUS ÇARKI bileti" : veri.odul;
    $("carkModalIco").textContent = veri.cark === "maximus" ? "🌟" : veri.maximusBileti ? "🎟️" : "🎉";
    $("carkModalBaslik").textContent = "Tebrikler " + veri.kullaniciAdi + "!";
    $("carkModalNot").textContent = veri.maximusBileti
      ? "Sınırsız Maximus Çarkı'nın kilidi açıldı. Hemen çevirebilirsin."
      : "İstersen şimdi iste, istersen sonra Ödüllerim'den iste.";
    modalIste.hidden = !!veri.maximusBileti;
    modalIste.disabled = false;
    modalIste.textContent = "🎁 Ödülü iste";
    modalMaximus.hidden = !veri.maximusBileti;
    modal.hidden = false;
    konfeti(veri.cark === "maximus" || veri.maximusBileti ? 260 : 170);
    (veri.maximusBileti ? modalMaximus : modalIste).focus();
  }
  function modalKapat() { modal.hidden = true; }

  $("carkModalKapat").addEventListener("click", modalKapat);
  modal.addEventListener("click", (e) => { if (e.target === modal) modalKapat(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) modalKapat(); });
  modalIste.addEventListener("click", async () => {
    if (!modalDocId) return;
    modalIste.disabled = true;
    const ok = await odulIste(modalDocId);
    modalIste.textContent = ok ? "✅ İstendi" : "⚠️ Olmadı, tekrar dene";
    if (!ok) modalIste.disabled = false;
  });
  modalMaximus.addEventListener("click", () => {
    modalKapat();
    $("maximusKart").scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => cevir("maximus"), 450);
  });

  async function odulIste(docId) {
    try {
      await db.collection("cark_sonuclari").doc(docId).update({
        istendi: true,
        istenmeTarihi: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.error("Ödül istenemedi:", err.message);
      return false;
    }
  }

  // ---------------- Ödüllerim ----------------
  function odulleriCiz() {
    const liste = gorunen().sort((a, b) => (b.tarihMs || Infinity) - (a.tarihMs || Infinity));
    odulListe.innerHTML = "";
    if (!liste.length) {
      odulListe.innerHTML = '<p class="muted">Henüz bir şey kazanmadın. Çark açılınca çevir.</p>';
      return;
    }
    const kullanilanBilet = new Set(gorunen().filter((s) => s.cark === "maximus").map((s) => s.bilet));
    liste.forEach((s) => {
      const satir = document.createElement("div");
      satir.className = "odul-satir" + (s.cark === "maximus" ? " is-maximus" : "");
      const ico = document.createElement("span");
      ico.className = "odul-ico";
      ico.textContent = s.cark === "maximus" ? "🌟" : s.maximusBileti ? "🎟️" : "🎁";
      const bilgi = document.createElement("div");
      bilgi.className = "odul-bilgi";
      const ad = document.createElement("b");
      ad.textContent = s.maximusBileti ? "Maximus bileti" : s.odul;
      const alt = document.createElement("small");
      alt.textContent = (s.cark === "maximus" ? "Sınırsız Maximus Çarkı" : "Sınırsız Çark") + " · " + tarihYaz(s.tarih);
      bilgi.append(ad, alt);
      const sag = document.createElement("div");
      sag.className = "odul-sag";
      if (s.maximusBileti) {
        sag.innerHTML = '<span class="odul-etiket"></span>';
        sag.firstChild.textContent = kullanilanBilet.has(s.id) ? "Kullanıldı" : biletSifirlandi(s) ? "Sıfırlandı" : "Kullanılmadı";
      } else if (s.verildi) {
        sag.innerHTML = '<span class="odul-etiket is-verildi">✅ Verildi</span>';
      } else if (s.istendi) {
        sag.innerHTML = '<span class="odul-etiket is-istendi">⏳ İstendi</span>';
      } else {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn odul-iste";
        b.textContent = "Ödülü iste";
        b.addEventListener("click", async () => {
          b.disabled = true;
          if (!(await odulIste(s.id))) { b.disabled = false; b.textContent = "Tekrar dene"; }
        });
        sag.appendChild(b);
      }
      satir.append(ico, bilgi, sag);
      odulListe.appendChild(satir);
    });
  }

  function sonuclariDinle() {
    if (sonucDinleyici) sonucDinleyici();
    sonuclar = [];
    if (!profile) return;
    sonucDinleyici = db.collection("cark_sonuclari")
      .where("uid", "==", profile.uid)
      .onSnapshot(
        (snap) => {
          sonuclar = snap.docs.map((d) => {
            const v = d.data();
            return Object.assign({ id: d.id, tarihMs: v.tarih && v.tarih.toMillis ? v.tarih.toMillis() : 0 }, v);
          });
          odulleriCiz();
          arayuzGuncelle();
        },
        (err) => {
          console.error("Ödüller okunamadı:", err.message);
          odulListe.innerHTML = '<p class="muted">Ödüller okunamadı (Firestore kurallarına cark_sonuclari eklendi mi?).</p>';
        }
      );
  }

  // ---------------- Konfeti ----------------
  const konfetiTuval = $("konfeti");
  let konfetiAnim = null;
  function konfeti(adet) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = konfetiTuval.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    konfetiTuval.width = W * dpr; konfetiTuval.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    konfetiTuval.hidden = false;
    const renk = ["#5a3fd4", "#f5b82e", "#e05a8a", "#2fa36b", "#3fa7d6", "#ff7a59", "#ffffff"];
    const parcalar = [];
    for (let i = 0; i < adet; i++) {
      const soldan = i % 2 === 0;
      parcalar.push({
        x: soldan ? -10 : W + 10,
        y: H * (0.55 + Math.random() * 0.3),
        vx: (soldan ? 1 : -1) * (5 + Math.random() * 9),
        vy: -(11 + Math.random() * 11),
        w: 6 + Math.random() * 7, h: 8 + Math.random() * 10,
        a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.35,
        c: renk[i % renk.length],
      });
    }
    const bas = performance.now();
    cancelAnimationFrame(konfetiAnim);
    function kare(t) {
      ctx.clearRect(0, 0, W, H);
      parcalar.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.a * 2)) + 2);
        ctx.restore();
      });
      if (t - bas < 4200) konfetiAnim = requestAnimationFrame(kare);
      else { ctx.clearRect(0, 0, W, H); konfetiTuval.hidden = true; }
    }
    konfetiAnim = requestAnimationFrame(kare);
  }

  // ---------------- Giriş kontrolü ----------------
  function sayfaGuncelle() {
    if (profile) {
      kapi.hidden = true;
      icerik.hidden = false;
      return;
    }
    icerik.hidden = true;
    kapi.hidden = false;
    const bekliyor = !authCozuldu || (auth && auth.currentUser && !auth.currentUser.isAnonymous);
    girisBtn.hidden = bekliyor;
    kapiYazi.textContent = bekliyor
      ? "Yükleniyor…"
      : "Çarkı çevirmek için bir kullanıcı adın olmalı. Sağ üstten kayıt ol (kullanıcı adı + şifre) ya da giriş yap, çark hemen açılır.";
  }

  girisBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = document.getElementById("authToggle");
    const p = document.getElementById("authPanel");
    if (t && p && p.hidden) t.click();
    const k = document.getElementById("authUser");
    if (k) setTimeout(() => k.focus(), 250);
  });

  if (typeof db === "undefined" || !db || typeof auth === "undefined" || !auth) {
    kapiYazi.textContent = "Çark şu an bağlı değil (Firebase ayarlanmamış).";
    return;
  }

  auth.onAuthStateChanged(() => { authCozuldu = true; sayfaGuncelle(); });
  if (window.YaparmiAuth) {
    window.YaparmiAuth.onChange((p) => {
      const eskiUid = profile && profile.uid;
      profile = p && p.kullaniciAdi ? p : null;
      sayfaGuncelle();
      if ((profile && profile.uid) !== eskiUid) sonuclariDinle();
      arayuzGuncelle();
    });
  }

  db.collection("cark").doc("ayarlar").onSnapshot(
    (snap) => {
      const v = snap.exists ? snap.data() : {};
      ayarlar = {
        acik: !!v.acik,
        tur: Number.isInteger(v.tur) ? v.tur : 0,
        hak: Number.isInteger(v.hak) && v.hak > 0 ? v.hak : 1,
        sinirsiz: v.sinirsiz || [],
        maximus: v.maximus || [],
        sifirTur: Number.isInteger(v.sifirTur) ? v.sifirTur : -1,
        sifirMs: v.sifirZaman && v.sifirZaman.toMillis ? v.sifirZaman.toMillis() : 0,
      };
      dilimleriGuncelle();
      odulleriCiz();
      arayuzGuncelle();
    },
    (err) => {
      console.error("Çark ayarları okunamadı:", err.message);
      durumYaz("⚠️ Çark ayarları okunamadı (Firestore kurallarına cark eklendi mi?).");
    }
  );

  dilimleriGuncelle();
  arayuzGuncelle();
})();
