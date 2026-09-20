// ============================================================
// yaparmi.com — ana mantık
// ============================================================

const NAME = "Berkay";

// Ne sorulursa sorulsun havuzdan rastgele bir "olumsuz" cevap seçilir.
// {name} otomatik olarak yukarıdaki NAME ile değiştirilir.
const RESPONSES = [
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
  "Herkes umutlanıyor ama {name} yine yapamaz.",
  "{name} sözde girişir, sonunda yapamaz.",
  "Falcı bakıyor... falcı gülüyor... {name} yapamaz.",
];

function pickResponse() {
  const template = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
  return template.replaceAll("{name}", NAME);
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

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  answerPlaceholderEl.hidden = true;
  askBtn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  // Küçük bir "düşünme" gecikmesi -> falcı havası
  setTimeout(() => {
    const response = pickResponse();
    typeWrite(response);
    logQuestion(question, response);

    askBtn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
    input.value = "";
    input.focus();
  }, 500 + Math.random() * 500);
});

// ---------------- Firestore'a kayıt (opsiyonel) ----------------

function logQuestion(question, response) {
  if (typeof db === "undefined" || !db) return;
  try {
    db.collection("sorular").add({
      soru: question,
      cevap: response,
      tarih: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("Soru kaydedilemedi:", err.message);
  }
}

// ============================================================
// Arka plan sesleri — iki dosya sırayla, otomatik ve döngülü
// ============================================================

const track1 = document.getElementById("track1");
const track2 = document.getElementById("track2");
const soundToggle = document.getElementById("sound-toggle");
const soundIcon = document.getElementById("sound-icon");
const soundUnlock = document.getElementById("sound-unlock");
const soundUnlockBtn = document.getElementById("sound-unlock-btn");

const tracks = [track1, track2];
let currentTrack = 0;
let isMuted = false;

function playCurrentTrack() {
  if (isMuted) return;
  const audio = tracks[currentTrack];
  const p = audio.play();
  if (p && p.catch) {
    p.catch(() => {
      // Tarayıcı otomatik oynatmayı engelledi, kullanıcı etkileşimi bekleniyor.
      soundUnlock.hidden = false;
    });
  }
}

function playNextTrack() {
  currentTrack = (currentTrack + 1) % tracks.length;
  playCurrentTrack();
}

tracks.forEach((audio) => {
  audio.addEventListener("ended", playNextTrack);
});

function startAudioLoop() {
  soundUnlock.hidden = true;
  playCurrentTrack();
}

soundUnlockBtn.addEventListener("click", startAudioLoop);

// Sayfa yüklenir yüklenmez dene; tarayıcı engellerse "sesi başlat" butonu çıkar.
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
    soundUnlock.hidden = true;
  } else {
    playCurrentTrack();
  }
});