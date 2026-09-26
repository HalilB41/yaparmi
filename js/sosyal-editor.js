// ============================================================
// sosyal-editor.js — sadece admin.html'de çalışır.
// "👥 Sosyal Hayat Düzenle" butonuna basınca hikaye, Sosyal Hayat
// sayfasındaki haliyle BİREBİR AYNI şekilde tam ekran açılır; tek fark
// her şeyin yerinde düzenlenebilmesi:
//   - Ortadaki yazıya ve emojiye tıklayıp değiştir.
//   - Seçeneklerin yazısına tıklayıp değiştir, "Git ▶" ile o seçeneğin
//     açtığı adıma geç, ✕ ile seçeneği sil, "+ Seçenek ekle" ile ekle.
//   - Sona gelince "➕ Devam ettir" → hikaye oradan devam eder.
//   - "💾 Kaydet ve yayınla" → Firestore (sosyal_hikaye/ana), oyun anında güncellenir.
// ============================================================

(function () {
  "use strict";

  const openBtn = document.getElementById("sosyalEditBtn");
  const overlay = document.getElementById("sosyalEditor");
  if (!openBtn || !overlay || !window.SosyalHikaye) return;

  // Tam ekran katman hiçbir kartın içinde sıkışmasın diye <body>'ye taşı.
  document.body.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  const stage = $("seStage");
  const emojiIn = $("seEmoji");
  const textIn = $("seText");
  const choicesEl = $("seChoices");
  const endBox = $("seEnd");
  const stepEl = $("seStep");
  const pathEl = $("sePath");
  const backBtn = $("seBack");
  const deleteBtn = $("seDeleteNode");
  const statusEl = $("seStatus");
  const saveBtn = $("seSave");
  const avatarImg = $("seAvatarImg");
  const avatarFallback = $("seAvatarFallback");
  const imgFile = $("seImgFile");
  const imgRemove = $("seImgRemove");
  const imgStatus = $("seImgStatus");

  const MAX_SECENEK = 6;

  let hikaye = null;
  let gecmis = []; // ziyaret edilen adımların ID'leri; sonuncusu şu anki adım
  let kirli = false;
  let yuklendi = false;

  // ---------------- Yardımcılar ----------------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function yeniId() {
    let id;
    do {
      id = "d" + Math.random().toString(36).slice(2, 7);
    } while (hikaye.dugumler[id]);
    return id;
  }
  function yeniDugum() {
    const id = yeniId();
    hikaye.dugumler[id] = { emoji: "", metin: "", secenekler: [] };
    return id;
  }
  function setStatus(t) {
    statusEl.textContent = t || "";
  }
  function degisti() {
    kirli = true;
    setStatus("● Kaydedilmemiş değişiklikler var");
    saveBtn.classList.add("is-dirty");
  }
  function simdiki() {
    return gecmis[gecmis.length - 1];
  }
  function kisalt(s, n) {
    s = s || "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  function otoYukseklik() {
    textIn.style.height = "auto";
    textIn.style.height = textIn.scrollHeight + 2 + "px";
  }

  // ---------------- Bir adımı göster (oyundaki gibi) ----------------
  function git(id, geriMi) {
    if (!hikaye.dugumler[id]) return;
    if (!geriMi) gecmis.push(id);
    ciz(true);
  }

  function ciz(animasyon) {
    const id = simdiki();
    const d = hikaye.dugumler[id];

    if (animasyon) {
      stage.classList.remove("is-in");
      void stage.offsetWidth;
      stage.classList.add("is-in");
    }

    emojiIn.value = d.emoji || "";
    textIn.value = d.metin;
    otoYukseklik();

    // Seçenekler
    choicesEl.innerHTML = "";
    d.secenekler.forEach((s, i) => choicesEl.appendChild(secenekKutusu(d, s, i)));
    if (d.secenekler.length && d.secenekler.length < MAX_SECENEK) {
      const ekle = el("button", "story-choice se-add-choice", "+ Seçenek ekle");
      ekle.type = "button";
      ekle.addEventListener("click", () => {
        d.secenekler.push({ etiket: "", hedef: yeniDugum() });
        degisti();
        ciz(false);
        const inputs = choicesEl.querySelectorAll(".se-choice-input");
        if (inputs.length) inputs[inputs.length - 1].focus();
      });
      choicesEl.appendChild(ekle);
    }

    const son = d.secenekler.length === 0;
    endBox.hidden = !son;
    stage.classList.toggle("is-end", son);

    // Alt bilgi, yol, butonlar
    stepEl.textContent = (son ? "🏁 SON · " : "") + gecmis.length + ". adım";
    deleteBtn.hidden = id === hikaye.baslangic;
    backBtn.disabled = gecmis.length < 2;
    pathEl.innerHTML = "";
    gecmis.forEach((gid, i) => {
      const g = hikaye.dugumler[gid];
      const b = el("button", "se-crumb" + (i === gecmis.length - 1 ? " is-current" : ""), (g && g.emoji) || "•");
      b.type = "button";
      b.title = kisalt(g && g.metin, 80) || "(boş adım)";
      b.addEventListener("click", () => {
        gecmis = gecmis.slice(0, i + 1);
        ciz(true);
      });
      pathEl.appendChild(b);
      if (i < gecmis.length - 1) pathEl.appendChild(el("span", "se-crumb-sep", "›"));
    });
  }

  function secenekKutusu(d, s, i) {
    const box = el("div", "story-choice se-choice-edit");
    const hedef = hikaye.dugumler[s.hedef];
    if (!s.etiket.trim()) box.classList.add("is-empty");

    const inp = el("input", "se-choice-input");
    inp.value = s.etiket;
    inp.maxLength = 60;
    inp.placeholder = "Seçenek yazısı...";
    inp.addEventListener("input", () => {
      s.etiket = inp.value;
      box.classList.toggle("is-empty", !inp.value.trim());
      degisti();
    });
    box.appendChild(inp);

    const row = el("div", "se-choice-tools");
    const gitBtn = el("button", "se-tool se-go", hedef && !hedef.metin.trim() ? "Yaz ▶" : "Git ▶");
    gitBtn.type = "button";
    gitBtn.title = hedef ? "Bu seçeneğin açtığı adım: " + (kisalt(hedef.metin, 80) || "(henüz boş)") : "";
    gitBtn.addEventListener("click", () => git(s.hedef));
    row.appendChild(gitBtn);

    const silBtn = el("button", "se-tool", "✕");
    silBtn.type = "button";
    silBtn.title = "Bu seçeneği sil";
    silBtn.addEventListener("click", () => {
      const hedefBos = hedef && !hedef.metin.trim() && !hedef.secenekler.length;
      d.secenekler.splice(i, 1);
      // Hiç yazılmamış boş adım başka yerden kullanılmıyorsa onu da temizle
      if (hedefBos && !Object.values(hikaye.dugumler).some((x) => x.secenekler.some((y) => y.hedef === s.hedef))) {
        delete hikaye.dugumler[s.hedef];
      }
      degisti();
      ciz(false);
    });
    row.appendChild(silBtn);

    box.appendChild(row);
    return box;
  }

  // ---------------- Yerinde düzenleme alanları ----------------
  textIn.addEventListener("input", () => {
    hikaye.dugumler[simdiki()].metin = textIn.value;
    otoYukseklik();
    degisti();
  });
  emojiIn.addEventListener("input", () => {
    hikaye.dugumler[simdiki()].emoji = emojiIn.value;
    const cur = pathEl.querySelector(".se-crumb.is-current");
    if (cur) cur.textContent = emojiIn.value || "•";
    degisti();
  });

  $("seContinue").addEventListener("click", () => {
    const d = hikaye.dugumler[simdiki()];
    d.secenekler.push({ etiket: "", hedef: yeniDugum() });
    d.secenekler.push({ etiket: "", hedef: yeniDugum() });
    degisti();
    ciz(false);
    const ilk = choicesEl.querySelector(".se-choice-input");
    if (ilk) ilk.focus();
  });

  backBtn.addEventListener("click", () => {
    if (gecmis.length < 2) return;
    gecmis.pop();
    ciz(true);
  });
  $("seHome").addEventListener("click", () => {
    gecmis = [hikaye.baslangic];
    ciz(true);
  });

  deleteBtn.addEventListener("click", () => {
    const id = simdiki();
    if (id === hikaye.baslangic) return;
    if (!confirm("Bu adım silinsin mi? Buraya gelen seçenekler de silinir.")) return;
    delete hikaye.dugumler[id];
    Object.values(hikaye.dugumler).forEach((x) => {
      x.secenekler = x.secenekler.filter((s) => s.hedef !== id);
    });
    gecmis = gecmis.filter((g) => g !== id && hikaye.dugumler[g]);
    if (!gecmis.length) gecmis = [hikaye.baslangic];
    degisti();
    ciz(true);
  });

  // ---------------- Kaydet / sıfırla ----------------
  // Başlangıçtan ulaşılamayan (artık hiçbir seçeneğin götürmediği) adımlar
  // kaydederken otomatik temizlenir.
  function ulasilamayanlariTemizle() {
    const ulasilan = new Set();
    (function yuru(id) {
      if (ulasilan.has(id) || !hikaye.dugumler[id]) return;
      ulasilan.add(id);
      hikaye.dugumler[id].secenekler.forEach((s) => yuru(s.hedef));
    })(hikaye.baslangic);
    Object.keys(hikaye.dugumler).forEach((id) => {
      if (!ulasilan.has(id)) delete hikaye.dugumler[id];
    });
  }

  // İlk sorunlu adıma giden yolu bulur ki oraya götürebilelim
  function yolBul(hedefId) {
    const onceki = { [hikaye.baslangic]: null };
    const kuyruk = [hikaye.baslangic];
    while (kuyruk.length) {
      const id = kuyruk.shift();
      if (id === hedefId) break;
      hikaye.dugumler[id].secenekler.forEach((s) => {
        if (hikaye.dugumler[s.hedef] && !(s.hedef in onceki)) {
          onceki[s.hedef] = id;
          kuyruk.push(s.hedef);
        }
      });
    }
    const yol = [];
    let cur = hedefId;
    while (cur) {
      yol.unshift(cur);
      cur = onceki[cur];
    }
    return yol[0] === hikaye.baslangic ? yol : [hikaye.baslangic];
  }

  function dogrula() {
    for (const [id, d] of Object.entries(hikaye.dugumler)) {
      if (!d.metin.trim()) return { id, t: "Bu adımın yazısı boş." };
      for (const s of d.secenekler) {
        if (!s.etiket.trim()) return { id, t: "Bu adımda yazısı boş bir seçenek var." };
      }
    }
    return null;
  }

  saveBtn.addEventListener("click", async () => {
    ulasilamayanlariTemizle();
    const hata = dogrula();
    if (hata) {
      gecmis = yolBul(hata.id);
      ciz(true);
      setStatus("⚠️ Kaydedilmedi: " + hata.t + " (Seni o adıma getirdim.)");
      return;
    }
    const temiz = window.SosyalHikaye.temizle(hikaye);
    if (JSON.stringify(temiz).length > 900000) {
      setStatus("⚠️ Hikaye çok uzun oldu, biraz kısalt.");
      return;
    }
    saveBtn.disabled = true;
    setStatus("Kaydediliyor...");
    try {
      await db.collection("sosyal_hikaye").doc("ana").set({
        baslangic: temiz.baslangic,
        dugumler: temiz.dugumler,
        guncelleme: firebase.firestore.FieldValue.serverTimestamp(),
      });
      kirli = false;
      saveBtn.classList.remove("is-dirty");
      setStatus("✅ Kaydedildi! Sosyal Hayat sayfası artık bu hikayeyi gösteriyor.");
    } catch (err) {
      console.error("Hikaye kaydedilemedi:", err.message);
      setStatus("⚠️ Kaydedilemedi: " + err.message);
    }
    saveBtn.disabled = false;
  });

  $("seReset").addEventListener("click", () => {
    if (!confirm("Tüm hikaye varsayılan hale dönsün mü? (Kaydet'e basmadıkça yayına çıkmaz.)")) return;
    hikaye = window.SosyalHikaye.varsayilan();
    gecmis = [hikaye.baslangic];
    degisti();
    ciz(true);
  });

  // ---------------- Berkay'ın resmi ----------------
  function resmiGoster(src) {
    avatarImg.hidden = !src;
    avatarFallback.hidden = !!src;
    imgRemove.hidden = !src;
    if (src) avatarImg.src = src;
  }

  imgFile.addEventListener("change", async () => {
    const file = imgFile.files[0];
    if (!file) return;
    imgStatus.textContent = "Resim yükleniyor...";
    try {
      const dataUrl = await window.resizeImageToSquare(file, 400);
      await db.collection("sosyal_hikaye").doc("resim").set({ resim: dataUrl });
      resmiGoster(dataUrl);
      imgStatus.textContent = "✅ Berkay'ın resmi güncellendi.";
    } catch (err) {
      console.error("Resim yüklenemedi:", err.message);
      imgStatus.textContent = "⚠️ Resim yüklenemedi: " + err.message;
    }
    imgFile.value = "";
  });

  imgRemove.addEventListener("click", async () => {
    if (!confirm("Berkay'ın resmi kaldırılsın mı?")) return;
    try {
      await db.collection("sosyal_hikaye").doc("resim").delete();
      resmiGoster(null);
      imgStatus.textContent = "Resim kaldırıldı (yerine 🧍 görünecek).";
    } catch (err) {
      imgStatus.textContent = "⚠️ Kaldırılamadı: " + err.message;
    }
  });

  // ---------------- Aç / kapat ----------------
  async function ac() {
    overlay.hidden = false;
    document.body.classList.add("se-open");
    if (!yuklendi) {
      setStatus("Yükleniyor...");
      const { hikaye: h, resim, kaynak } = await window.SosyalHikaye.yukle();
      hikaye = h;
      yuklendi = true;
      resmiGoster(resim);
      gecmis = [hikaye.baslangic];
      setStatus(kaynak === "firestore" ? "" : "Şu an varsayılan hikaye gösteriliyor (henüz hiç kaydedilmedi).");
    }
    ciz(true);
  }

  function kapat() {
    if (kirli && !confirm("Kaydedilmemiş değişiklikler var, yine de kapatılsın mı?")) return;
    overlay.hidden = true;
    document.body.classList.remove("se-open");
  }

  openBtn.addEventListener("click", ac);
  $("seClose").addEventListener("click", kapat);
  document.addEventListener("keydown", (e) => {
    if (!overlay.hidden && e.key === "Escape") kapat();
  });

  window.addEventListener("beforeunload", (e) => {
    if (kirli) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
