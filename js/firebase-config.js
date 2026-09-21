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
  apiKey: "BURAYA_API_KEY_GELECEK",
  authDomain: "BURAYA_PROJE.firebaseapp.com",
  projectId: "BURAYA_PROJE_ID",
  storageBucket: "BURAYA_PROJE.appspot.com",
  messagingSenderId: "BURAYA_SENDER_ID",
  appId: "BURAYA_APP_ID"
};

let db = null;
let auth = null;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
} catch (err) {
  console.warn("Firebase henüz ayarlanmadı, sorular/Ahır sohbeti çalışmayacak:", err.message);
}
