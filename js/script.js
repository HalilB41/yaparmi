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

// ---------------- Kategoriler (Berkay'ın hayatının alanları) ----------------

const CATEGORIES = {
  genel: { placeholder: "spor yapar mı?" },
  ders: { placeholder: "sınavı geçer mi?" },
  spor: { placeholder: "maçı kazanır mı?" },
  oyun: { placeholder: "oyunda seviye atlar mı?" },
  sosyal: { placeholder: "kıza çıkma teklif eder mi?" },
};

let currentCategory = "genel";

const categoryTabsEl = document.getElementById("categoryTabs");
categoryTabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-tab");
  if (!btn) return;
  categoryTabsEl.querySelectorAll(".cat-tab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentCategory = btn.dataset.cat;
  const cfg = CATEGORIES[currentCategory] || CATEGORIES.genel;
  input.placeholder = cfg.placeholder;
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

  const response = await getAnswer(question, currentCategory);
  typeWrite(response);
  logQuestion(question, response, currentCategory);

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
