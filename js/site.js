// ============================================================
// site.js — TÜM sayfalarda ortak çalışır: hamburger menü (Spor/Ders/
// Oyun/Sosyal Hayat/Galeri), sağ üstteki Giriş Yap / Kayıt Ol widget'ı,
// ve galeri fotoğraflarını aynı boyuta küçültme yardımcı fonksiyonu.
//
// Not: Bu, Berkayın Ahırı'ndaki takma ad ile AYNI şey DEĞİL. Ahır'da
// sadece bir takma ad seçiliyor (şifresiz, geçici). Burası gerçek bir
// hesap: kullanıcı adı + şifre ile "kayıt ol/giriş yap", Firebase
// Authentication (e-posta/şifre) üzerinden çalışıyor — kullanıcı adını
// "kullaniciadi@yaparmi.local" gibi sahte bir e-postaya çevirip
// kullanıyoruz, hiçbir yere gerçek mail atılmıyor.
// ============================================================

(function () {
  // ---------------- Hamburger menü ----------------
  const menuBtn = document.getElementById("menuBtn");
  const menuDrawer = document.getElementById("menuDrawer");
  const menuOverlay = document.getElementById("menuOverlay");

  function closeMenu() {
    if (!menuBtn || !menuDrawer || !menuOverlay) return;
    menuBtn.setAttribute("aria-expanded", "false");
    menuDrawer.hidden = true;
    menuOverlay.hidden = true;
  }
  function openMenu() {
    if (!menuBtn || !menuDrawer || !menuOverlay) return;
    menuBtn.setAttribute("aria-expanded", "true");
    menuDrawer.hidden = false;
    menuOverlay.hidden = false;
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const isOpen = menuBtn.getAttribute("aria-expanded") === "true";
      if (isOpen) closeMenu();
      else openMenu();
    });
  }
  if (menuOverlay) menuOverlay.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

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
  // piksel boyutunda bir JPEG'e küçültüp/kırpıyor — galerideki bütün
  // fotoğraflar böylece aynı boyutta oluyor.
  window.resizeImageToSquare = async function resizeImageToSquare(file, size) {
    size = size || 1080;
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
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
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
      authToggle.textContent = "Giriş Yap";
      authPanel.innerHTML =
        '<div class="auth-error" id="authErr"></div>' +
        '<form id="authForm" autocomplete="off">' +
        '<input id="authUser" type="text" placeholder="Kullanıcı adı" maxlength="20" autocomplete="username" required />' +
        '<input id="authPass" type="password" placeholder="Şifre (en az 6 karakter)" minlength="6" autocomplete="current-password" required />' +
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
        '<button type="button" class="link-btn" id="logoutBtn">Çıkış Yap</button>' +
        "</div>";
      authPanel.querySelector(".who").textContent = profile.kullaniciAdi;
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
