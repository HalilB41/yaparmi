// ============================================================
// gallery.js — sadece galeri.html'de çalışır. Yayınlanan fotoğrafları
// Snapchat tarzı yatay kaydırmalı bir şeritte gösterir ve ziyaretçilerin
// yeni fotoğraf ÖNERMESİNE izin verir (admin onaylayınca yayınlanır).
// Kayıt olmak zorunlu değil — Ahır'daki gibi görünmez bir anonim giriş
// kullanılıyor (sadece spam'i azaltmak için).
//
// Not: Firebase Storage KULLANILMIYOR (ücretli plan gerektiriyor) —
// fotoğraflar site.js'teki resizeImageToSquare() ile küçültülüp base64
// (data URL) metni olarak doğrudan Firestore'a yazılıyor.
// ============================================================

const galleryScroller = document.getElementById("galleryScroller");
const suggestForm = document.getElementById("suggestForm");
const suggestFile = document.getElementById("suggestFile");
const suggestStatus = document.getElementById("suggestStatus");

function loadGallery() {
  if (typeof db === "undefined" || !db) {
    galleryScroller.innerHTML = '<p class="gallery-empty">Galeri şu an bağlı değil.</p>';
    return;
  }
  db.collection("galeri")
    .orderBy("tarih", "desc")
    .limitToLast(100)
    .onSnapshot(
      (snapshot) => {
        if (snapshot.empty) {
          galleryScroller.innerHTML = '<p class="gallery-empty">Henüz fotoğraf yok.</p>';
          return;
        }
        galleryScroller.innerHTML = "";
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (!data || typeof data.resim !== "string") return;
          const card = document.createElement("div");
          card.className = "gallery-photo";
          const img = document.createElement("img");
          img.alt = "";
          img.loading = "lazy";
          img.src = data.resim;
          card.appendChild(img);
          galleryScroller.appendChild(card);
        });
      },
      (err) => {
        console.error("Galeri okunamadı:", err.message);
        galleryScroller.innerHTML = '<p class="gallery-empty">Galeri yüklenemedi.</p>';
      }
    );
}
loadGallery();

function ensureAuthed() {
  if (typeof auth === "undefined" || !auth) return Promise.resolve(null);
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return auth
    .signInAnonymously()
    .then((cred) => cred.user)
    .catch(() => null);
}

if (suggestForm) {
  suggestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = suggestFile.files[0];
    if (!file) return;
    if (typeof db === "undefined" || !db) {
      suggestStatus.textContent = "Şu an bağlı değil, daha sonra tekrar dene.";
      return;
    }

    suggestStatus.textContent = "Gönderiliyor...";
    const submitBtn = suggestForm.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const user = await ensureAuthed();
      if (!user) throw new Error("Giriş yapılamadı");

      const dataUrl = await resizeImageToSquare(file, 720);

      const profile = window.YaparmiAuth && window.YaparmiAuth.getProfile ? window.YaparmiAuth.getProfile() : null;

      await db.collection("galeri_oneriler").add({
        resim: dataUrl,
        gonderenUid: user.uid,
        gonderenKullaniciAdi: profile ? profile.kullaniciAdi : null,
        tarih: firebase.firestore.FieldValue.serverTimestamp(),
      });

      suggestStatus.textContent = "Gönderildi! Admin onaylarsa galeriye eklenir. 🎉";
      suggestForm.reset();
    } catch (err) {
      console.error("Öneri gönderilemedi:", err.message);
      suggestStatus.textContent = err.message || "Gönderilemedi, tekrar dene.";
    }

    if (submitBtn) submitBtn.disabled = false;
  });
}
