// ============================================================
// admin.js — sadece admin.html'de çalışır. Görünürlük burada kontrol
// ediliyor ama GERÇEK güvenlik Firestore/Storage kurallarında: admin
// olmayan biri arayüzü atlatsa bile verilere erişemez.
// ============================================================

const adminGate = document.getElementById("adminGate");
const adminContent = document.getElementById("adminContent");
const queueList = document.getElementById("queueList");
const soruTableBody = document.getElementById("soruTableBody");
const adminUploadForm = document.getElementById("adminUploadForm");
const adminUploadFile = document.getElementById("adminUploadFile");
const adminUploadStatus = document.getElementById("adminUploadStatus");

let adminStarted = false;

function formatTarih(ts) {
  if (!ts || typeof ts.toDate !== "function") return "-";
  try {
    return ts.toDate().toLocaleString("tr-TR");
  } catch {
    return "-";
  }
}

function startAdminPanel() {
  if (adminStarted) return;
  adminStarted = true;
  loadQueue();
  loadSorular();
}

// ---------------- Galeri önerileri + geçmiş ----------------
// Öneriler artık karar verilince SİLİNMİYOR; belgeye durum yazılıyor:
//   durum yok           → bekliyor (kuyrukta görünür)
//   durum "yayinlandi"  → galeriye eklendi (galeriId = galeri belgesi)
//   durum "reddedildi"  → reddedildi
//   durum "kaldirildi"  → yayınlanmıştı, sonra galeriden kaldırıldı
// kararTarihi = son kararın zamanı. Böylece admin "öncesi ve sonrası"nı görür.
const oneriGecmis = document.getElementById("oneriGecmis");
const oneriFiltre = document.getElementById("oneriFiltre");
const oneriToplu = document.getElementById("oneriToplu");
let oneriler = [];
let gecmisFiltre = "";
const DURUM = {
  yayinlandi: ["✅ Yayınlandı", "is-yayinlandi"],
  reddedildi: ["✖ Reddedildi", "is-reddedildi"],
  kaldirildi: ["🗑️ Galeriden kaldırıldı", "is-kaldirildi"],
};

function oneriButon(metin, cls, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "admin-btn " + cls;
  b.textContent = metin;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try { await fn(); } finally { b.disabled = false; }
  });
  return b;
}

function oneriSatir(o, gecmisMi) {
  const row = document.createElement("div");
  row.className = gecmisMi ? "admin-queue-gecmis" : "admin-queue-item";

  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  if (typeof o.resim === "string") img.src = o.resim;
  row.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "meta";
  const strong = document.createElement("strong");
  strong.textContent = o.gonderenKullaniciAdi || "Misafir";
  meta.appendChild(strong);
  meta.appendChild(document.createElement("br"));
  meta.appendChild(document.createTextNode("📤 Önerildi: " + formatTarih(o.tarih)));
  if (gecmisMi) {
    const [ad, cls] = DURUM[o.durum] || ["?", ""];
    meta.appendChild(document.createElement("br"));
    const etiket = document.createElement("span");
    etiket.className = "oneri-durum " + cls;
    etiket.textContent = ad + ": " + formatTarih(o.kararTarihi);
    meta.appendChild(etiket);
  }
  row.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "admin-queue-actions";
  if (!gecmisMi) {
    actions.appendChild(oneriButon("Yayınla", "publish", () => publishSuggestion(o)));
    actions.appendChild(oneriButon("Reddet", "reject", () => rejectSuggestion(o)));
  } else {
    if (o.durum === "reddedildi" || o.durum === "kaldirildi") {
      actions.appendChild(oneriButon("Yayınla", "publish se-small", () => publishSuggestion(o)));
    }
    if (o.durum === "yayinlandi") {
      actions.appendChild(oneriButon("Galeriden kaldır", "reject se-small", () => galeridenKaldir(o)));
    }
    actions.appendChild(oneriButon("Kaydı sil", "reject se-small", () => kaydiSil(o)));
  }
  row.appendChild(actions);
  return row;
}

function onerileriCiz() {
  const bekleyen = oneriler.filter((o) => !o.durum);
  const gecmis = oneriler
    .filter((o) => o.durum && (!gecmisFiltre || o.durum === gecmisFiltre))
    .sort((a, b) => zaman(b.kararTarihi) - zaman(a.kararTarihi));

  queueList.innerHTML = "";
  if (!bekleyen.length) queueList.innerHTML = '<p class="muted">Bekleyen öneri yok.</p>';
  bekleyen.forEach((o) => queueList.appendChild(oneriSatir(o, false)));
  if (oneriToplu) oneriToplu.hidden = bekleyen.length < 2;

  if (!oneriGecmis) return;
  oneriGecmis.innerHTML = "";
  if (!gecmis.length) {
    oneriGecmis.innerHTML = '<p class="muted">' + (gecmisFiltre ? "Bu filtrede kayıt yok." : "Henüz karar verilmiş öneri yok.") + "</p>";
    return;
  }
  gecmis.forEach((o) => oneriGecmis.appendChild(oneriSatir(o, true)));
}

function zaman(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : Date.now();
}

if (oneriFiltre) {
  oneriFiltre.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-filtre]");
    if (!b) return;
    gecmisFiltre = b.dataset.filtre;
    oneriFiltre.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    onerileriCiz();
  });
}

function loadQueue() {
  db.collection("galeri_oneriler")
    .orderBy("tarih", "desc")
    .limit(150)
    .onSnapshot(
      (snapshot) => {
        oneriler = snapshot.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        onerileriCiz();
      },
      (err) => {
        console.error("Öneri listesi okunamadı:", err.message);
        queueList.innerHTML = '<p class="muted">Yüklenemedi.</p>';
        if (oneriGecmis) oneriGecmis.innerHTML = '<p class="muted">Yüklenemedi.</p>';
      }
    );
}

async function publishSuggestion(o) {
  try {
    const ref = await db.collection("galeri").add({
      resim: o.resim,
      tarih: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection("galeri_oneriler").doc(o.id).update({
      durum: "yayinlandi",
      galeriId: ref.id,
      kararTarihi: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Yayınlanamadı:", err.message);
    alert("Yayınlanamadı: " + err.message);
  }
}

async function rejectSuggestion(o) {
  try {
    await db.collection("galeri_oneriler").doc(o.id).update({
      durum: "reddedildi",
      kararTarihi: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Reddedilemedi:", err.message);
    alert("Reddedilemedi: " + err.message);
  }
}

async function galeridenKaldir(o) {
  if (!confirm("Bu fotoğraf galeriden kaldırılsın mı? Geçmişte kalır, istersen tekrar yayınlarsın.")) return;
  try {
    if (o.galeriId) await db.collection("galeri").doc(o.galeriId).delete();
    await db.collection("galeri_oneriler").doc(o.id).update({
      durum: "kaldirildi",
      galeriId: firebase.firestore.FieldValue.delete(),
      kararTarihi: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Kaldırılamadı:", err.message);
    alert("Kaldırılamadı: " + err.message);
  }
}

async function kaydiSil(o) {
  if (!confirm("Bu kayıt geçmişten tamamen silinsin mi?" + (o.durum === "yayinlandi" ? " (Fotoğraf galeride kalmaya devam eder.)" : ""))) return;
  try {
    await db.collection("galeri_oneriler").doc(o.id).delete();
  } catch (err) {
    console.error("Silinemedi:", err.message);
    alert("Silinemedi: " + err.message);
  }
}

async function hepsine(fn, soru) {
  const bekleyen = oneriler.filter((o) => !o.durum);
  if (!bekleyen.length || !confirm(soru.replace("{n}", bekleyen.length))) return;
  for (const o of bekleyen) await fn(o);
}
const hepsiYayinla = document.getElementById("oneriHepsiYayinla");
const hepsiReddet = document.getElementById("oneriHepsiReddet");
if (hepsiYayinla) hepsiYayinla.addEventListener("click", () => hepsine(publishSuggestion, "Bekleyen {n} önerinin hepsi yayınlansın mı?"));
if (hepsiReddet) hepsiReddet.addEventListener("click", () => hepsine(rejectSuggestion, "Bekleyen {n} önerinin hepsi reddedilsin mi?"));

function loadSorular() {
  db.collection("sorular")
    .orderBy("tarih", "desc")
    .limit(200)
    .onSnapshot(
      (snapshot) => {
        soruTableBody.innerHTML = "";
        if (snapshot.empty) {
          soruTableBody.innerHTML = '<tr><td colspan="6" class="muted">Henüz soru yok.</td></tr>';
          return;
        }
        snapshot.forEach((doc) => {
          const data = doc.data();
          const tr = document.createElement("tr");

          const tdTarih = document.createElement("td");
          tdTarih.textContent = formatTarih(data.tarih);
          tr.appendChild(tdTarih);

          const tdUser = document.createElement("td");
          tdUser.textContent = data.kullaniciAdi || "Misafir";
          tr.appendChild(tdUser);

          const tdSoru = document.createElement("td");
          tdSoru.textContent = data.soru || "";
          tr.appendChild(tdSoru);

          const tdCevap = document.createElement("td");
          tdCevap.textContent = data.cevap || "";
          tr.appendChild(tdCevap);

          const tdModel = document.createElement("td");
          tdModel.className = "muted";
          tdModel.textContent = data.model || "—";
          tr.appendChild(tdModel);

          // Paylaş: soruyu "kim sordu" bilgisiyle kart yapıp WhatsApp'a gönder (js/kahin-paylas.js)
          const tdPaylas = document.createElement("td");
          const btnPaylas = document.createElement("button");
          btnPaylas.type = "button";
          btnPaylas.className = "admin-btn se-small";
          btnPaylas.textContent = "📤 Paylaş";
          btnPaylas.addEventListener("click", () => {
            if (window.KahinPaylas) window.KahinPaylas({ soru: data.soru || "", cevap: data.cevap || "", kullaniciAdi: data.kullaniciAdi || "", tarih: formatTarih(data.tarih) });
          });
          tdPaylas.appendChild(btnPaylas);
          tr.appendChild(tdPaylas);

          soruTableBody.appendChild(tr);
        });
      },
      (err) => {
        console.error("Soru geçmişi okunamadı:", err.message);
        soruTableBody.innerHTML = '<tr><td colspan="6" class="muted">Yüklenemedi.</td></tr>';
      }
    );
}

if (adminUploadForm) {
  adminUploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dosyalar = Array.from(adminUploadFile.files || []);
    if (!dosyalar.length) return;
    const submitBtn = adminUploadForm.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;
    let giden = 0;
    const hatalar = [];
    for (let i = 0; i < dosyalar.length; i++) {
      adminUploadStatus.textContent = "Yükleniyor… " + (i + 1) + " / " + dosyalar.length;
      try {
        const dataUrl = await resizeImageToSquare(dosyalar[i], 720);
        await db.collection("galeri").add({
          resim: dataUrl,
          tarih: firebase.firestore.FieldValue.serverTimestamp(),
        });
        giden++;
      } catch (err) {
        console.error("Yüklenemedi:", dosyalar[i].name, err.message);
        hatalar.push(dosyalar[i].name);
      }
    }
    adminUploadStatus.textContent = hatalar.length
      ? giden + " yayınlandı, " + hatalar.length + " yüklenemedi (" + hatalar.join(", ") + ")."
      : (giden > 1 ? giden + " fotoğraf yayınlandı!" : "Yayınlandı!");
    if (giden) adminUploadForm.reset();
    if (submitBtn) submitBtn.disabled = false;
  });
}

if (window.YaparmiAuth) {
  window.YaparmiAuth.onChange((profile) => {
    if (profile && profile.rol === "admin") {
      adminGate.hidden = true;
      adminContent.hidden = false;
      startAdminPanel();
    } else {
      adminGate.hidden = false;
      adminContent.hidden = true;
    }
  });
}
