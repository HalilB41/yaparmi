// ============================================================
// yaparmi.com — ana mantık
// ============================================================

const NAME = "Berkay";

// AI cevap veremezse (kota doldu, internet yok vb.) buradan rastgele
// bir yedek cevap seçilir, site hiçbir zaman bozulmaz.
const FALLBACK_RESPONSES = [
  "Hayır, {name} bunu yapamaz.",
  "{name}'dan bu iş çıkmaz, boşuna bekleme.",
  "İhtimal düşük... aslında ihtimal yok, {name} başaramaz.",
  "{name} bunu da beceremez, üzgünüm.",
  "Kâhin görüyor: {name} bu sefer de yapamayacak.",
  "Yıldızlar açık: {name} bunu başaramaz.",
  "{name} girer, dener, yine de yapamaz.",
  "Söylemesi zor ama hayır, {name} bunu yapamaz.",
  "Kesinlikle olmaz, {name} bu işi beceremez.",
  "Deneyebilir ama {name} bunu başaramayacak.",
  "Geçmiş veriler net: {name} bu konuda hep başarısız oldu.",
  "Bilim bunu kanıtladı: {name} yapamaz.",
  "%0 ihtimal. {name} bunu yapamaz.",
  "{name} bu sefer de son ana bırakıp yapamayacak.",
  "Maalesef {name} bunu da yapamayacak.",
];

function pickFallbackResponse() {
  const template = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
  return template.replaceAll("{name}", NAME);
}

// ---------------- Sol/sağ menü ve panel geçişleri ----------------
// Trivia (Genel soru-cevap kutusu) tek ve kategorisiz: hangi konuda soru
// sorulursa sorulsun yapay zeka aynı kutudan cevap verir. Berkayın Ahırı da
// aynı sayfada (SPA) açılan tek panel; Spor/Ders/Oyun/Sosyal Hayat/Galeri
// artık ayrı gerçek sayfalar (spor.html, ders.html, ...) — index.html'de
// düz <a href> linkleri, JS'e ihtiyaçları yok.

const panels = {
  trivia: document.getElementById("panel-trivia"),
  ahir: document.getElementById("panel-ahir"),
};

function showView(view) {
  Object.entries(panels).forEach(([key, el]) => {
    if (el) el.hidden = key !== view;
  });
}

// Sadece Berkayın Ahırı butonu (data-view'lı olan, sağ alttaki yuvarlak
// buton) sayfa içi panel değiştiriyor; Spor/Ders/Oyun/Sosyal Hayat/Galeri
// artık hamburger menüdeki düz <a href> linkleri, tarayıcı kendi gerçek
// sayfa geçişini yapıyor.
const allNavItems = document.querySelectorAll("[data-view]");
allNavItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    allNavItems.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const view = btn.dataset.view;
    showView(view);

    if (view === "ahir") {
      initAhir();
    }
  });
});

// Logo'ya tıklayınca (kenar butonlarından herhangi birine tıklayıp
// başka bir panele geçtikten sonra bile) her zaman ortadaki soru-cevap
// kutusuna geri dönülür.
const homeLink = document.getElementById("homeLink");
if (homeLink) {
  homeLink.addEventListener("click", (e) => {
    e.preventDefault();
    allNavItems.forEach((b) => b.classList.remove("active"));
    showView("trivia");
  });
}

// ---------------- AI'dan cevap al (yedekli) ----------------

async function getAnswer(question) {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("API HATA DETAYI:", data);
      throw new Error(data.error || ("API hatası: " + res.status));
    }
    if (!data.answer) throw new Error("Boş cevap");
    return data.answer;
  } catch (err) {
    console.warn("AI cevabı alınamadı, yedek cevap kullanılıyor:", err.message);
    return pickFallbackResponse();
  }
}

// ---------------- Typewriter efekti (Google Çeviri tarzı) ----------------

const answerTextEl = document.getElementById("answer-text");
const answerPlaceholderEl = document.getElementById("answer-placeholder");
const cursorEl = document.getElementById("cursor");

let typingTimer = null;

function typeWrite(text, speedMs = 28) {
  if (typingTimer) clearInterval(typingTimer);
  answerTextEl.textContent = "";
  cursorEl.hidden = false;
  let i = 0;
  typingTimer = setInterval(() => {
    answerTextEl.textContent += text.charAt(i);
    i++;
    if (i >= text.length) {
      clearInterval(typingTimer);
      cursorEl.hidden = true;
    }
  }, speedMs);
}

// ---------------- Form işlemleri ----------------

const form = document.getElementById("ask-form");
const input = document.getElementById("question");
const askBtn = document.getElementById("ask-btn");
const btnText = askBtn.querySelector(".btn-text");
const btnLoading = askBtn.querySelector(".btn-loading");

// Son sorulan soruyu hatırlıyoruz: kutuda hâlâ aynı soru duruyorsa
// (kullanıcı yeni bir şey yazmadıysa) tekrar "Sor"a basınca soruyu
// tekrar göndermek yerine kutuyu temizliyoruz.
let lastAskedQuestion = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rest = input.value.trim();
  if (!rest) return;

  // Kutuda kullanıcının yazdığı kısım, "Berkay" öneki hep sabit.
  const question = `${NAME} ${rest}`;

  if (lastAskedQuestion !== null && rest === lastAskedQuestion) {
    input.value = "";
    lastAskedQuestion = null;
    input.focus();
    return;
  }

  answerPlaceholderEl.hidden = true;
  askBtn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  // Cevap gelene kadar kutuda "düşünüyor" mesajı göster.
  if (typingTimer) clearInterval(typingTimer);
  answerTextEl.textContent = "Kanzi düşünüyor...";
  cursorEl.hidden = false;

  const response = await getAnswer(question);
  typeWrite(response);
  logQuestion(question, response, "genel");

  lastAskedQuestion = rest;

  askBtn.disabled = false;
  btnText.hidden = false;
  btnLoading.hidden = true;
  // Not: soru kutuda kalsın diye input.value burada temizlenmiyor.
  input.focus();
});

// ---------------- Firestore'a kayıt (opsiyonel) ----------------

function logQuestion(question, response, category) {
  if (typeof db === "undefined" || !db) return;
  try {
    const profile = window.YaparmiAuth && window.YaparmiAuth.getProfile ? window.YaparmiAuth.getProfile() : null;
    const payload = {
      soru: question,
      cevap: response,
      kategori: category || "genel",
      tarih: firebase.firestore.FieldValue.serverTimestamp(),
    };
    // Giriş yapmış (kayıtlı, anonim Ahır oturumu değil) biriyse kullanıcı
    // adını da ekliyoruz — admin panelinde "kim sormuş" diye görünsün diye.
    if (profile && profile.kullaniciAdi) {
      payload.kullaniciAdi = profile.kullaniciAdi;
    }
    db.collection("sorular").add(payload);
  } catch (err) {
    console.warn("Soru kaydedilemedi:", err.message);
  }
}

// ============================================================
// Arka plan sesleri — iki dosya sırayla, otomatik ve döngülü
// ============================================================
// Tarayıcılar sesli otomatik oynatmayı engelliyor, bu yüzden:
// 1) Ses "sessiz" (muted) halde otomatik başlar (buna her tarayıcı izin verir).
// 2) Kullanıcı sayfada herhangi bir yere ilk tıkladığı / bir tuşa bastığı an
//    ses otomatik olarak sesli hale gelir. Ayrı bir "başlat" butonuna gerek yok.

const track1 = document.getElementById("track1");
const track2 = document.getElementById("track2");
const soundToggle = document.getElementById("sound-toggle");
const soundIcon = document.getElementById("sound-icon");

const tracks = [track1, track2];
let currentTrack = 0;
let isMuted = false;
let soundUnlocked = false;

tracks.forEach((audio) => {
  audio.muted = true;
  audio.addEventListener("ended", playNextTrack);
});

function playCurrentTrack() {
  const audio = tracks[currentTrack];
  const p = audio.play();
  if (p && p.catch) {
    p.catch(() => {
      /* tarayıcı engelledi, ilk kullanıcı etkileşiminde tekrar denenecek */
    });
  }
}

function playNextTrack() {
  currentTrack = (currentTrack + 1) % tracks.length;
  playCurrentTrack();
}

function unlockSound() {
  if (soundUnlocked || isMuted) return;
  soundUnlocked = true;
  tracks.forEach((a) => (a.muted = false));
  playCurrentTrack();
}

["click", "touchstart", "keydown", "scroll"].forEach((evt) => {
  document.addEventListener(evt, unlockSound, { once: true, passive: true });
});

window.addEventListener("load", () => {
  playCurrentTrack();
});

soundToggle.addEventListener("click", () => {
  isMuted = !isMuted;
  soundToggle.classList.toggle("muted", isMuted);
  soundToggle.setAttribute("aria-pressed", String(isMuted));
  soundIcon.textContent = isMuted ? "🔇" : "🔊";

  if (isMuted) {
    tracks.forEach((a) => a.pause());
  } else {
    soundUnlocked = true;
    tracks.forEach((a) => (a.muted = false));
    playCurrentTrack();
  }
});

// ============================================================
// Berkayın Ahırı — kullanıcı adı + GERÇEK KULLANICILARIN birbiriyle
// yazıştığı, Firebase Firestore'a bağlı ortak sohbet odası.
// Burada yapay zeka YOK: her mesaj Firestore'a yazılıp herkese gerçek
// zamanlı (onSnapshot) dağıtılıyor, kimse bot cevabı almıyor.
// ============================================================

const USERNAME_KEY = "yaparmi_username";
const USERNAME_CHANGED_KEY = "yaparmi_username_changed";

function getUsername() {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
}
function setUsername(name) {
  try {
    localStorage.setItem(USERNAME_KEY, name);
  } catch {
    /* localStorage yoksa (gizli sekme vb.) sorun değil, sohbet yine çalışır */
  }
}
function hasChangedName() {
  try {
    return localStorage.getItem(USERNAME_CHANGED_KEY) === "1";
  } catch {
    return false;
  }
}
function markNameChanged() {
  try {
    localStorage.setItem(USERNAME_CHANGED_KEY, "1");
  } catch {
    /* yok sayılabilir */
  }
}

const usernameGate = document.getElementById("usernameGate");
const usernameForm = document.getElementById("usernameForm");
const usernameInput = document.getElementById("usernameInput");
const ahirChat = document.getElementById("ahirChat");
const ahirUserInfo = document.getElementById("ahirUserInfo");
const ahirUsernameDisplay = document.getElementById("ahirUsernameDisplay");
const ahirChangeNameBtn = document.getElementById("ahirChangeNameBtn");
const ahirMessages = document.getElementById("ahirMessages");
const ahirForm = document.getElementById("ahirForm");
const ahirInput = document.getElementById("ahirInput");
const ahirSendBtn = ahirForm.querySelector("button[type=submit]");

function refreshAhirUI() {
  const name = getUsername();
  if (name) {
    usernameGate.hidden = true;
    ahirChat.hidden = false;
    ahirUserInfo.hidden = false;
    ahirUsernameDisplay.textContent = name;
    ahirChangeNameBtn.hidden = hasChangedName();
  } else {
    usernameGate.hidden = false;
    ahirChat.hidden = true;
    ahirUserInfo.hidden = true;
  }
}
refreshAhirUI();

// Kullanıcı adını normalize eder: baştaki/sondaki/aradaki TÜM boşlukları
// kaldırır (birleşik/tek kelime olsun diye), küçük harfe çevirir (Türkçe
// İ/I kurallarına göre) ve en fazla 12 karaktere keser.
function normalizeUsername(raw) {
  return raw
    .normalize("NFC")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("tr-TR")
    .slice(0, 12);
}

const usernameSubmitBtn = usernameForm.querySelector("button[type=submit]");
const usernameError = document.getElementById("usernameError");

function setUsernameError(text) {
  if (usernameError) usernameError.textContent = text || "";
}

usernameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = normalizeUsername(usernameInput.value);
  setUsernameError("");

  if (!name) {
    setUsernameError("Boşluksuz, en az 1 karakterli bir kullanıcı adı yaz.");
    return;
  }
  if (!db || !auth) {
    setUsernameError("Ahır şu an bağlı değil, birkaç saniye sonra tekrar dene.");
    return;
  }
  if (!ahirReady || !auth.currentUser) {
    setUsernameError("Bağlanılıyor, birkaç saniye sonra tekrar dene.");
    return;
  }

  if (usernameSubmitBtn) usernameSubmitBtn.disabled = true;

  try {
    // Kullanıcı adı = belge ID'si. Bu isim daha önce alınmışsa Firestore
    // kuralları bu isteği "update" sayıp reddeder (allow update: if false
    // olduğu için), yani aynı isimden 2. kişi asla alamaz.
    await db.collection("ahir_kullanicilar").doc(name).set({
      uid: auth.currentUser.uid,
    });
    setUsername(name);
    usernameInput.value = "";
    refreshAhirUI();
  } catch (err) {
    console.error("Kullanıcı adı alınamadı:", err.message);
    setUsernameError("Bu kullanıcı adı zaten alınmış, başka bir tane dene.");
  }

  if (usernameSubmitBtn) usernameSubmitBtn.disabled = false;
});

ahirChangeNameBtn.addEventListener("click", () => {
  if (hasChangedName()) return;
  markNameChanged();
  try {
    localStorage.removeItem(USERNAME_KEY);
  } catch {
    /* yok sayılabilir */
  }
  refreshAhirUI();
});

// Mesajları HER ZAMAN textContent ile ekliyoruz — kullanıcı "<image>" ya da
// başka bir HTML/script parçası yazsa bile sayfa asla bozulmaz/çalıştırılmaz.
function appendAhirMessage(text, sender) {
  const div = document.createElement("div");
  div.className = "msg " + sender;
  div.textContent = text;
  ahirMessages.appendChild(div);
  ahirMessages.scrollTop = ahirMessages.scrollHeight;
  return div;
}

// Sistem bildirimleri (bağlantı hatası, hız sınırı vb.) — bir kullanıcıdan
// gelmiyor, sadece "other" balon stilini ödünç alıyor.
function appendAhirNotice(text) {
  appendAhirMessage(text, "other");
}

function setAhirInputEnabled(enabled) {
  ahirInput.disabled = !enabled;
  ahirSendBtn.disabled = !enabled;
}

// ---------------- Firebase: anonim giriş + gerçek zamanlı ortak sohbet ----------------

let ahirInitStarted = false;
let ahirListenerStarted = false;
let ahirReady = false;

function startAhirListener() {
  if (ahirListenerStarted) return;
  ahirListenerStarted = true;
  db.collection("ahir_mesajlar")
    .orderBy("tarih", "asc")
    .limitToLast(50)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const data = change.doc.data();
          if (!data || typeof data.mesaj !== "string") return;
          const isOwn = !!(auth.currentUser && data.uid === auth.currentUser.uid);
          const label = isOwn ? data.mesaj : `${data.kullaniciAdi || "?"}: ${data.mesaj}`;
          appendAhirMessage(label, isOwn ? "user" : "other");
        });
      },
      (err) => {
        console.error("Ahır dinleme hatası:", err.message);
        appendAhirNotice("Sohbet akışı koptu, sayfayı yenilemeyi dene.");
      }
    );
}

function initAhir() {
  if (ahirInitStarted) return;
  ahirInitStarted = true;

  if (!db || !auth) {
    appendAhirNotice("Ahır şu an bağlı değil (Firebase ayarlanmamış). Daha sonra tekrar dene.");
    setAhirInputEnabled(false);
    return;
  }

  setAhirInputEnabled(false);

  auth.onAuthStateChanged((user) => {
    if (!user) return;
    ahirReady = true;
    setAhirInputEnabled(true);
    startAhirListener();
  });

  // Zaten bir hesapla giriş yapılmışsa (sağ üstteki Giriş Yap/Kayıt Ol ile,
  // anonim de olsa) onu kullan; anonim girişi SADECE hiç oturum yoksa
  // başlat. Aksi halde signInAnonymously() gerçek hesabı değiştirip
  // kullanıcıyı sessizce oturumdan düşürürdü.
  if (!auth.currentUser) {
    auth.signInAnonymously().catch((err) => {
      console.error("Ahır giriş hatası:", err.message);
      appendAhirNotice("Sohbete bağlanılamadı, sayfayı yenilemeyi dene.");
    });
  }
}

let lastAhirSendAt = 0;

ahirForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = ahirInput.value.trim();
  const username = getUsername();
  if (!text || !username || !ahirReady) return;

  // İstemci tarafında basit bir hız sınırı; asıl (bypass edilemeyen) koruma
  // Firestore güvenlik kurallarında.
  const now = Date.now();
  if (now - lastAhirSendAt < 3000) {
    appendAhirNotice("Yavaş ol biraz, art arda çok hızlı yazıyorsun.");
    return;
  }
  lastAhirSendAt = now;

  ahirInput.value = "";
  setAhirInputEnabled(false);

  try {
    const uid = auth.currentUser.uid;
    await db.collection("ahir_mesajlar").add({
      uid,
      kullaniciAdi: username.slice(0, 12),
      mesaj: text.slice(0, 300),
      tarih: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // Hız sınırı kaydı — Firestore kuralları bir sonraki mesajda bunu kontrol ediyor.
    await db.collection("ahir_limits").doc(uid).set({
      sonMesajZamani: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Ahır mesaj gönderme hatası:", err.message);
    appendAhirNotice("Mesaj gönderilemedi, tekrar dene.");
  }

  setAhirInputEnabled(true);
  ahirInput.focus();
});
