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

function loadQueue() {
  db.collection("galeri_oneriler")
    .orderBy("tarih", "desc")
    .limitToLast(50)
    .onSnapshot(
      (snapshot) => {
        queueList.innerHTML = "";
        if (snapshot.empty) {
          queueList.innerHTML = '<p class="muted">Bekleyen öneri yok.</p>';
          return;
        }
        snapshot.forEach((doc) => {
          const data = doc.data();
          const row = document.createElement("div");
          row.className = "admin-queue-item";

          const img = document.createElement("img");
          img.alt = "";
          row.appendChild(img);
          if (typeof data.yol === "string") {
            storage
              .ref(data.yol)
              .getDownloadURL()
              .then((url) => {
                img.src = url;
              })
              .catch(() => {});
          }

          const meta = document.createElement("div");
          meta.className = "meta";
          const strong = document.createElement("strong");
          strong.textContent = data.gonderenKullaniciAdi || "Misafir";
          meta.appendChild(strong);
          meta.appendChild(document.createElement("br"));
          meta.appendChild(document.createTextNode(formatTarih(data.tarih)));
          row.appendChild(meta);

          const actions = document.createElement("div");
          actions.className = "admin-queue-actions";

          const publishBtn = document.createElement("button");
          publishBtn.type = "button";
          publishBtn.className = "admin-btn publish";
          publishBtn.textContent = "Yayınla";
          publishBtn.addEventListener("click", () => publishSuggestion(doc.id, data));
          actions.appendChild(publishBtn);

          const rejectBtn = document.createElement("button");
          rejectBtn.type = "button";
          rejectBtn.className = "admin-btn reject";
          rejectBtn.textContent = "Reddet";
          rejectBtn.addEventListener("click", () => rejectSuggestion(doc.id));
          actions.appendChild(rejectBtn);

          row.appendChild(actions);
          queueList.appendChild(row);
        });
      },
      (err) => {
        console.error("Öneri listesi okunamadı:", err.message);
        queueList.innerHTML = '<p class="muted">Yüklenemedi.</p>';
      }
    );
}

async function publishSuggestion(id, data) {
  try {
    await db.collection("galeri").add({
      yol: data.yol,
      tarih: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection("galeri_oneriler").doc(id).delete();
  } catch (err) {
    console.error("Yayınlanamadı:", err.message);
    alert("Yayınlanamadı: " + err.message);
  }
}

async function rejectSuggestion(id) {
  try {
    await db.collection("galeri_oneriler").doc(id).delete();
  } catch (err) {
    console.error("Silinemedi:", err.message);
  }
}

function loadSorular() {
  db.collection("sorular")
    .orderBy("tarih", "desc")
    .limit(200)
    .onSnapshot(
      (snapshot) => {
        soruTableBody.innerHTML = "";
        if (snapshot.empty) {
          soruTableBody.innerHTML = '<tr><td colspan="4" class="muted">Henüz soru yok.</td></tr>';
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

          soruTableBody.appendChild(tr);
        });
      },
      (err) => {
        console.error("Soru geçmişi okunamadı:", err.message);
        soruTableBody.innerHTML = '<tr><td colspan="4" class="muted">Yüklenemedi.</td></tr>';
      }
    );
}

if (adminUploadForm) {
  adminUploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = adminUploadFile.files[0];
    if (!file) return;
    adminUploadStatus.textContent = "Yükleniyor...";
    const submitBtn = adminUploadForm.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const blob = await resizeImageToSquare(file, 1080);
      const path = "galeri/" + Date.now() + "_" + Math.random().toString(36).slice(2) + ".jpg";
      await storage.ref(path).put(blob, { contentType: "image/jpeg" });
      await db.collection("galeri").add({
        yol: path,
        tarih: firebase.firestore.FieldValue.serverTimestamp(),
      });
      adminUploadStatus.textContent = "Yayınlandı!";
      adminUploadForm.reset();
    } catch (err) {
      console.error("Yüklenemedi:", err.message);
      adminUploadStatus.textContent = "Yüklenemedi: " + err.message;
    }
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
