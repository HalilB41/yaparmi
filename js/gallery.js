// ============================================================
// gallery.js — sadece galeri.html.
//   Vitrin (en son kare) + kare ızgara + tam ekran görüntüleyici
//   (telefonda sağa/sola kaydır, aşağı çekip kapat; bilgisayarda ← → Esc).
//
// Yükleme:
//   - Güvenilir yükleyiciler (GUVENILIR listesi: atkannes, burger) ve admin
//     giriş yaptıysa fotoğraf ONAYSIZ, doğrudan galeriye gider: galeri/{id} { resim, tarih, yukleyen }
//   - Diğer herkes öneri gönderir (galeri_oneriler), admin onaylayınca yayınlanır.
//   Bu ayrım Firestore kurallarında da var (tarayıcıdan atlatılamaz).
//
// Not: Firebase Storage KULLANILMIYOR (ücretli plan) — fotoğraflar site.js'teki
// resizeImageToSquare() ile küçültülüp base64 olarak doğrudan Firestore'a yazılıyor.
// ============================================================
(function () {
  "use strict";
  const GUVENILIR = ["atkannes", "burger"]; // küçük harfle; firestore.rules'taki liste ile aynı olmalı
  const ONERI_LIMIT = 20;
  const $ = (id) => document.getElementById(id);
  const izgara = $("glIzgara");
  const suggestForm = $("suggestForm");
  const suggestFile = $("suggestFile");
  const suggestStatus = $("suggestStatus");
  const suggestOnizleme = $("suggestOnizleme");
  let fotolar = []; // [{ id, resim, tarih(ms), yukleyen }]
  let acikIndex = -1;

  const tarihYaz = (ms) => (ms ? new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "");
  function profil() { return window.YaparmiAuth && YaparmiAuth.getProfile ? YaparmiAuth.getProfile() : null; }
  function dogrudanMi() {
    const p = profil();
    return !!(p && (p.rol === "admin" || GUVENILIR.includes(String(p.kullaniciAdi || "").toLowerCase())));
  }

  // ---------------- Liste ----------------
  function yukle() {
    if (typeof db === "undefined" || !db) { izgara.innerHTML = '<p class="gl-bos">Galeri şu an bağlı değil.</p>'; return; }
    db.collection("galeri").orderBy("tarih", "desc").limit(200).onSnapshot((snap) => {
      fotolar = [];
      snap.forEach((d) => {
        const x = d.data();
        if (!x || typeof x.resim !== "string") return;
        fotolar.push({ id: d.id, resim: x.resim, tarih: x.tarih && x.tarih.toMillis ? x.tarih.toMillis() : 0, yukleyen: x.yukleyen || "" });
      });
      ciz();
    }, (err) => {
      console.error("Galeri okunamadı:", err.message);
      izgara.innerHTML = '<p class="gl-bos">Galeri yüklenemedi.</p>';
    });
  }

  function ciz() {
    izgara.textContent = "";
    const v = $("glVitrin");
    if (!fotolar.length) { v.hidden = true; izgara.innerHTML = '<p class="gl-bos">Henüz fotoğraf yok. İlk kareyi sen ekle!</p>'; return; }
    const ilk = fotolar[0];
    v.hidden = false;
    $("glVitrinImg").src = ilk.resim;
    $("glVitrinArka").style.backgroundImage = 'url("' + ilk.resim + '")';
    $("glVitrinKim").textContent = ilk.yukleyen ? "📸 " + ilk.yukleyen : "";
    $("glVitrinTarih").textContent = tarihYaz(ilk.tarih);
    $("glSayi").textContent = fotolar.length + " kare";
    fotolar.forEach((f, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gl-kare";
      b.setAttribute("aria-label", "Fotoğrafı büyüt" + (f.yukleyen ? " (" + f.yukleyen + ")" : ""));
      b.style.setProperty("--gecikme", Math.min(i, 24) * 25 + "ms");
      const img = document.createElement("img");
      img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = f.resim;
      b.appendChild(img);
      if (f.yukleyen || f.tarih) {
        const alt = document.createElement("span");
        alt.className = "gl-kare-alt";
        alt.textContent = (f.yukleyen ? "📸 " + f.yukleyen + " · " : "") + tarihYaz(f.tarih);
        b.appendChild(alt);
      }
      b.addEventListener("click", () => ac(i));
      izgara.appendChild(b);
    });
  }
  $("glVitrinFoto").addEventListener("click", () => ac(0));

  // ---------------- Tam ekran görüntüleyici ----------------
  const lb = $("glLb"), lbImg = $("glLbImg"), sahne = $("glLbSahne");
  function goster() {
    const f = fotolar[acikIndex];
    if (!f) return;
    lbImg.src = f.resim;
    $("glLbArka").style.backgroundImage = 'url("' + f.resim + '")';
    $("glLbSayac").textContent = acikIndex + 1 + " / " + fotolar.length;
    $("glLbAlt").textContent = [f.yukleyen ? "📸 " + f.yukleyen : "", tarihYaz(f.tarih)].filter(Boolean).join(" · ");
    $("glLbOnceki").disabled = acikIndex <= 0;
    $("glLbSonraki").disabled = acikIndex >= fotolar.length - 1;
    // komşuları önceden yükle
    [acikIndex - 1, acikIndex + 1].forEach((i) => { if (fotolar[i]) { const im = new Image(); im.src = fotolar[i].resim; } });
  }
  function ac(i) {
    acikIndex = i;
    lb.hidden = false;
    document.documentElement.classList.add("gl-kilit");
    goster();
    history.pushState({ glLb: true }, "");
  }
  function kapat(gecmistenGeldi) {
    if (lb.hidden) return;
    lb.hidden = true;
    document.documentElement.classList.remove("gl-kilit");
    sahne.style.transform = "";
    if (!gecmistenGeldi && history.state && history.state.glLb) history.back();
  }
  function git(yon) {
    const yeni = acikIndex + yon;
    if (yeni < 0 || yeni >= fotolar.length) { sahne.animate([{ transform: `translateX(${-yon * 18}px)` }, { transform: "none" }], { duration: 220 }); return; }
    acikIndex = yeni;
    goster();
    lbImg.animate([{ opacity: 0.2, transform: `translateX(${yon * 40}px) scale(.98)` }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
  }
  // Telefonda geri tuşu görüntüleyiciyi kapatsın, sayfadan çıkmasın
  addEventListener("popstate", () => kapat(true));
  $("glLbKapat").addEventListener("click", () => kapat());
  $("glLbOnceki").addEventListener("click", () => git(-1));
  $("glLbSonraki").addEventListener("click", () => git(1));
  lb.addEventListener("click", (e) => { if (e.target === sahne || e.target === lb || e.target.id === "glLbArka") kapat(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") kapat();
    else if (e.key === "ArrowLeft") git(-1);
    else if (e.key === "ArrowRight") git(1);
  });
  // Dokunmatik: yatay kaydır = önceki/sonraki, aşağı çek = kapat
  let dx0 = 0, dy0 = 0, kaydir = false;
  sahne.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; dx0 = e.touches[0].clientX; dy0 = e.touches[0].clientY; kaydir = true; sahne.style.transition = "none"; }, { passive: true });
  sahne.addEventListener("touchmove", (e) => {
    if (!kaydir || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dx0, dy = e.touches[0].clientY - dy0;
    if (Math.abs(dy) > Math.abs(dx) && dy > 0) sahne.style.transform = `translateY(${dy}px) scale(${Math.max(0.85, 1 - dy / 1500)})`;
    else sahne.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  sahne.addEventListener("touchend", (e) => {
    if (!kaydir) return;
    kaydir = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - dx0, dy = t.clientY - dy0;
    sahne.style.transition = "transform .2s ease";
    sahne.style.transform = "";
    if (dy > 110 && Math.abs(dy) > Math.abs(dx)) kapat();
    else if (dx < -50) git(1);
    else if (dx > 50) git(-1);
  });
  function dosyaAdi() { return "yaparmi-galeri-" + (acikIndex + 1) + ".jpg"; }
  async function blobAl() { const r = await fetch(fotolar[acikIndex].resim); return r.blob(); }
  $("glLbIndir").addEventListener("click", async () => {
    const a = document.createElement("a");
    a.href = fotolar[acikIndex].resim; a.download = dosyaAdi(); a.click();
  });
  $("glLbPaylas").addEventListener("click", async () => {
    try {
      const b = await blobAl();
      const dosya = new File([b], dosyaAdi(), { type: b.type || "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [dosya] })) { await navigator.share({ files: [dosya], text: "yaparmi.com galerisinden 📸" }); return; }
      window.open("https://wa.me/?text=" + encodeURIComponent("yaparmi.com galerisi 📸 " + location.origin + "/galeri"), "_blank", "noopener");
    } catch (err) { if (err && err.name !== "AbortError") console.warn(err.message); }
  });

  // ---------------- Yükleme / öneri ----------------
  function yukleKutusu() {
    const dogrudan = dogrudanMi();
    $("glYukleBaslik").textContent = dogrudan ? "📸 Fotoğraf yükle" : "📤 Fotoğraf öner";
    $("glYukleYazi").textContent = dogrudan
      ? "Sen güvenilir yükleyicisin: fotoğrafların onay beklemeden, adınla hemen galeriye eklenir. Tek seferde en fazla 20."
      : "Kayıt olmana gerek yok. Tek seferde en fazla 20 fotoğraf. Admin onaylarsa galeriye eklenir.";
    $("glGonder").textContent = dogrudan ? "Galeriye ekle" : "Gönder";
  }
  if (window.YaparmiAuth) YaparmiAuth.onChange(yukleKutusu);
  yukleKutusu();

  function ensureAuthed() {
    if (typeof auth === "undefined" || !auth) return Promise.resolve(null);
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return auth.signInAnonymously().then((c) => c.user).catch(() => null);
  }

  function onizlemeCiz() {
    suggestOnizleme.querySelectorAll("img").forEach((i) => URL.revokeObjectURL(i.src));
    suggestOnizleme.innerHTML = "";
    const dosyalar = Array.from(suggestFile.files || []);
    suggestOnizleme.hidden = !dosyalar.length;
    dosyalar.slice(0, ONERI_LIMIT).forEach((f) => { const img = document.createElement("img"); img.alt = ""; img.src = URL.createObjectURL(f); suggestOnizleme.appendChild(img); });
    suggestStatus.textContent = dosyalar.length > ONERI_LIMIT ? dosyalar.length + " fotoğraf seçtin, ilk " + ONERI_LIMIT + " tanesi gidecek." : dosyalar.length > 1 ? dosyalar.length + " fotoğraf seçildi." : "";
  }
  suggestFile.addEventListener("change", onizlemeCiz);

  suggestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dosyalar = Array.from(suggestFile.files || []).slice(0, ONERI_LIMIT);
    if (!dosyalar.length) return;
    if (typeof db === "undefined" || !db) { suggestStatus.textContent = "Şu an bağlı değil, daha sonra tekrar dene."; return; }
    const btn = $("glGonder");
    btn.disabled = true; suggestFile.disabled = true;
    const dogrudan = dogrudanMi();
    let giden = 0;
    const hatalar = [];
    try {
      const user = await ensureAuthed();
      if (!user) throw new Error("Giriş yapılamadı");
      const p = profil();
      for (let i = 0; i < dosyalar.length; i++) {
        suggestStatus.textContent = dosyalar.length > 1 ? "Yükleniyor… " + (i + 1) + " / " + dosyalar.length : "Yükleniyor…";
        try {
          const dataUrl = await resizeImageToSquare(dosyalar[i], 720);
          if (dogrudan) {
            const veri = { resim: dataUrl, tarih: firebase.firestore.FieldValue.serverTimestamp() };
            if (p && p.rol !== "admin") veri.yukleyen = p.kullaniciAdi;
            await db.collection("galeri").add(veri);
          } else {
            await db.collection("galeri_oneriler").add({
              resim: dataUrl, gonderenUid: user.uid, gonderenKullaniciAdi: p ? p.kullaniciAdi : null,
              tarih: firebase.firestore.FieldValue.serverTimestamp(),
            });
          }
          giden++;
        } catch (err) { console.error("Yüklenemedi:", dosyalar[i].name, err.message); hatalar.push(dosyalar[i].name); }
      }
    } catch (err) { hatalar.push(err.message); }

    if (giden && !hatalar.length) suggestStatus.textContent = (giden > 1 ? giden + " fotoğraf " : "Fotoğraf ") + (dogrudan ? "galeriye eklendi! 📸" : "gönderildi! Admin onaylarsa galeriye eklenir. 🎉");
    else if (giden) suggestStatus.textContent = giden + " fotoğraf gitti, " + hatalar.length + " tanesi gitmedi (" + hatalar.join(", ") + ").";
    else suggestStatus.textContent = "Gönderilemedi, tekrar dene." + (hatalar.length ? " (" + hatalar[hatalar.length - 1] + ")" : "");
    if (giden) {
      if (window.Basarim) Basarim.say("oneri");
      suggestForm.reset();
      suggestOnizleme.innerHTML = ""; suggestOnizleme.hidden = true;
      if (dogrudan) window.scrollTo({ top: 0, behavior: "smooth" });
    }
    suggestFile.disabled = false; btn.disabled = false;
  });

  yukle();
})();
