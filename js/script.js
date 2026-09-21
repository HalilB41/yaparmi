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
// sorulursa sorulsun yapay zeka aynı kutudan cevap verir. Spor / Ders / Oyun /
// Sosyal Hayat / Galeri / Berkayın Ahırı bunun ayrı kategorileri DEĞİL,
// kendi başlarına bağımsız panellerdir (şimdilik çoğu placeholder).

const panels = {
  trivia: document.getElementById("panel-trivia"),
  spor: document.getElementById("panel-spor"),
  ders: document.getElementById("panel-ders"),
  oyun: document.getElementById("panel-oyun"),
  sosyal: document.getElementById("panel-sosyal"),
  galeri: document.getElementById("panel-galeri"),
  ahir: document.getElementById("panel-ahir"),
};

function showView(view) {
  Object.entries(panels).forEach(([key, el]) => {
    if (el) el.hidden = key !== view;
  });
}

const allNavItems = document.querySelectorAll(".nav-item");
allNavItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    allNavItems.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const view = btn.dataset.view;
    showView(view);

    if (view === "ahir") {
      maybeGreetAhir();
    }
  });
});

// ---------------- AI'dan cevap al (yedekli) ----------------

async function getAnswer(question, category) {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, category }),
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

  const response = await getAnswer(question, "genel");
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
    db.collection("sorular").add({
      soru: question,
      cevap: response,
      kategori: category || "genel",
      tarih: firebase.firestore.FieldValue.serverTimestamp(),
    });
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
// Berkayın Ahırı — kullanıcı adı + AI ile serbest sohbet
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

let ahirGreeted = false;
let ahirHistory = [];

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

usernameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = usernameInput.value.trim().slice(0, 20);
  if (!name) return;
  setUsername(name);
  usernameInput.value = "";
  refreshAhirUI();
  maybeGreetAhir();
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

function maybeGreetAhir() {
  const name = getUsername();
  if (!name || ahirGreeted || ahirMessages.children.length > 0) return;
  ahirGreeted = true;
  appendAhirMessage(
    `${name}, Ahır'a hoş geldin. Berkay efsanesini gerçekten tanıyor musun yoksa sadece vakit mi öldürüyorsun? Bir şey yaz da görelim. 😏`,
    "ai"
  );
}

ahirForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = ahirInput.value.trim();
  const username = getUsername();
  if (!text || !username) return;

  appendAhirMessage(text, "user");
  ahirHistory.push({ role: "user", content: text });
  ahirInput.value = "";
  ahirInput.disabled = true;

  const thinkingEl = appendAhirMessage("...", "ai thinking");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        message: text,
        history: ahirHistory.slice(-10),
      }),
    });
    const data = await res.json().catch(() => ({}));
    thinkingEl.remove();

    if (!res.ok || !data.reply) {
      console.error("Ahır sohbet hatası:", data);
      appendAhirMessage("Ahır şu an çok kalabalık galiba, birazdan tekrar dene.", "ai");
    } else {
      appendAhirMessage(data.reply, "ai");
      ahirHistory.push({ role: "assistant", content: data.reply });
    }
  } catch (err) {
    thinkingEl.remove();
    console.error("Ahır bağlantı hatası:", err.message);
    appendAhirMessage("Bağlantı koptu galiba, tekrar dene.", "ai");
  }

  ahirInput.disabled = false;
  ahirInput.focus();
});

maybeGreetAhir();
