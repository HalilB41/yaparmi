// ============================================================
// FIREBASE AYARLARI
// ============================================================
// 1) https://console.firebase.google.com adresinden yeni bir proje oluştur.
// 2) Sol menüden "Build > Firestore Database" e girip veritabanını oluştur.
// 3) Proje ayarları (dişli ikon) > "Genel" sekmesi > "Uygulamalarınız"
//    kısmından bir Web uygulaması (</>) ekle.
// 4) Sana verilen firebaseConfig objesini aşağıya olduğu gibi yapıştır.
//
// Not: Bu config bilgileri "gizli anahtar" değildir, Firebase web
// projelerinde herkese açık şekilde tarayıcıda çalışır. Güvenlik,
// Firestore "Rules" (kurallar) kısmından sağlanır. README.md dosyasında
// örnek güvenli kurallar var, onları da eklemeyi unutma.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBvkESGAXaEfIFUZxlfO3fA0VZHguDaX4U",
  authDomain: "yaparmi.firebaseapp.com",
  projectId: "yaparmi",
  storageBucket: "yaparmi.firebasestorage.app",
  messagingSenderId: "601883593189",
  appId: "1:601883593189:web:22d1fbd6562e7f8e33070c",
  measurementId: "G-1EL6G2D6DX"
};

let db = null;
let auth = null;

// Not: Firebase Storage bilerek kullanılmıyor (yeni projelerde ücretli
// Blaze planı istiyor). Galeri fotoğrafları da diğer her şey gibi sadece
// Firestore (ücretsiz Spark planı) üzerinden, base64 metin olarak
// saklanıyor — bkz. js/site.js: resizeImageToSquare().
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
} catch (err) {
  console.warn("Firebase henüz ayarlanmadı, sorular/Ahır sohbeti/galeri çalışmayacak:", err.message);
}
