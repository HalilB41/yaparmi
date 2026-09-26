// ============================================================
// sosyal-editor.js — sadece admin.html'de çalışır.
// "👥 Sosyal Hayat Düzenle" butonuna basınca açılır:
//   1) Önce hikayenin ALGORİTMA ŞEMASI (akış ağacı) görünür.
//   2) Şemadaki bir kutuya tıklayınca altta o adım düzenlenir:
//      metin, emoji, seçenekler (her seçeneğin gideceği adım).
//   3) "Kaydet ve yayınla" ile Firestore'a (sosyal_hikaye/ana) yazılır,
//      sosyal.html anında yeni hikayeyi kullanır.
// Berkay'ın ortadaki resmi de buradan yüklenir (sosyal_hikaye/resim).
// ============================================================

(function () {
  "use strict";

  const openBtn = document.getElementById("sosyalEditBtn");
  const editor = document.getElementById("sosyalEditor");
  if (!openBtn || !editor || !window.SosyalHikaye) return;

  const treeEl = document.getElementById("seTree");
  const orphanEl = document.getElementById("seOrphans");
  const formEl = document.getElementById("seForm");
  const statusEl = document.getElementById("seStatus");
  const saveBtn = document.getElementById("seSave");
  const resetBtn = document.getElementById("seReset");
  const addNodeBtn = document.getElementById("seAddNode");
  const imgPreview = document.getElementById("seImgPreview");
  const imgFile = document.getElementById("seImgFile");
  const imgRemove = document.getElementById("seImgRemove");
  const imgStatus = document.getElementById("seImgStatus");

  let hikaye = null;
  let seciliId = null;
  let kirli = false;
  let yuklendi = false;

  // ---------------- Yardımcılar ----------------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function kisalt(s, n) {
    s = s || "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  function yeniId() {
    let id;
    do {
      id = "d" + Math.random().toString(36).slice(2, 7);
    } while (hikaye.dugumler[id]);
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

  // ---------------- Algoritma şeması (ağaç) ----------------
  // Başlangıç adımından DFS ile ağaç çiziliyor. Bir adıma ikinci kez
  // ulaşılırsa (döngü ya da iki koldan aynı yere bağlantı) tekrar
  // çizilmiyor, yerine "↪ git" kutusu konuyor.
  function dugumKutusu(id, etiket) {
    const d = hikaye.dugumler[id];
    const box = el("button", "se-node");
    box.type = "button";
    if (id === seciliId) box.classList.add("is-selected");
    if (id === hikaye.baslangic) box.classList.add("is-start");

    if (etiket) box.appendChild(el("span", "se-edge", etiket));
    if (!d) {
      box.classList.add("is-missing");
      box.appendChild(el("span", "se-node-text", "⚠️ Eksik adım: " + id));
      return box;
    }
    const son = d.secenekler.length === 0;
    if (son) box.classList.add("is-end");
    const head = el("span", "se-node-head");
    head.appendChild(el("span", "se-node-emoji", d.emoji || "•"));
    head.appendChild(el("span", "se-node-id", id === hikaye.baslangic ? "BAŞLANGIÇ" : son ? "SON" : id));
    box.appendChild(head);
    box.appendChild(el("span", "se-node-text", kisalt(d.metin, 70) || "(boş metin)"));
    box.addEventListener("click", () => sec(id));
    return box;
  }

  function agacCiz() {
    treeEl.innerHTML = "";
    const gorulen = new Set();
    const root = el("ul");
    root.appendChild(liCiz(hikaye.baslangic, null, gorulen));
    treeEl.appendChild(root);
    // İlk çizimde şemayı başlangıç kutusu ortada görünecek şekilde kaydır
    if (!agacCiz.kaydirildi) {
      agacCiz.kaydirildi = true;
      const wrap = treeEl.parentElement;
      requestAnimationFrame(() => {
        wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
      });
    }

    // Başlangıçtan ulaşılamayan adımlar
    orphanEl.innerHTML = "";
    const yetimler = Object.keys(hikaye.dugumler).filter((id) => !gorulen.has(id));
    if (yetimler.length) {
      orphanEl.appendChild(el("p", "muted se-orphan-title", "Hiçbir seçenekten ulaşılamayan adımlar (oyunda görünmez):"));
      const row = el("div", "se-orphan-row");
      yetimler.forEach((id) => row.appendChild(dugumKutusu(id)));
      orphanEl.appendChild(row);
    }
  }

  function liCiz(id, etiket, gorulen) {
    const li = el("li");
    if (gorulen.has(id) && hikaye.dugumler[id]) {
      const ref = el("button", "se-node se-ref");
      ref.type = "button";
      if (etiket) ref.appendChild(el("span", "se-edge", etiket));
      const d = hikaye.dugumler[id];
      ref.appendChild(el("span", "se-node-text", "↪ " + (d.emoji || "") + " " + kisalt(d.metin, 28)));
      ref.addEventListener("click", () => sec(id));
      li.appendChild(ref);
      return li;
    }
    gorulen.add(id);
    li.appendChild(dugumKutusu(id, etiket));
    const d = hikaye.dugumler[id];
    if (d && d.secenekler.length) {
      const ul = el("ul");
      d.secenekler.forEach((s) => ul.appendChild(liCiz(s.hedef, s.etiket || "(etiketsiz)", gorulen)));
      li.appendChild(ul);
    }
    return li;
  }

  // ---------------- Seçili adımı düzenleme formu ----------------
  function sec(id) {
    seciliId = id;
    agacCiz();
    formCiz();
    formEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hedefSecici(mevcut) {
    const sel = el("select", "se-select");
    Object.keys(hikaye.dugumler).forEach((id) => {
      const d = hikaye.dugumler[id];
      const o = el("option", null, (d.emoji || "•") + " " + kisalt(d.metin, 40) + "  [" + id + "]");
      o.value = id;
      if (id === mevcut) o.selected = true;
      sel.appendChild(o);
    });
    const yeni = el("option", null, "➕ Yeni adım oluştur");
    yeni.value = "__yeni__";
    sel.appendChild(yeni);
    if (!mevcut || !hikaye.dugumler[mevcut]) yeni.selected = true;
    return sel;
  }

  function formCiz() {
    formEl.innerHTML = "";
    const d = hikaye.dugumler[seciliId];
    if (!d) {
      formEl.appendChild(el("p", "muted", "👆 Düzenlemek için şemadan bir kutuya tıkla."));
      return;
    }

    const baslik = el("h3", "se-form-title", "✏️ Adım düzenle");
    baslik.appendChild(el("span", "se-form-id", " [" + seciliId + "]"));
    formEl.appendChild(baslik);

    // Emoji + metin
    const row1 = el("div", "se-row");
    const emojiIn = el("input", "se-input se-emoji-input");
    emojiIn.value = d.emoji || "";
    emojiIn.maxLength = 8;
    emojiIn.placeholder = "😀";
    emojiIn.title = "Berkay'ın resminin köşesinde çıkan emoji";
    emojiIn.addEventListener("input", () => {
      d.emoji = emojiIn.value;
      degisti();
      agacCiz();
    });
    row1.appendChild(emojiIn);
    const metinIn = el("textarea", "se-input se-textarea");
    metinIn.value = d.metin;
    metinIn.maxLength = 600;
    metinIn.rows = 3;
    metinIn.placeholder = "Bu adımda ekranda yazacak metin...";
    metinIn.addEventListener("input", () => {
      d.metin = metinIn.value;
      degisti();
      agacCiz();
    });
    row1.appendChild(metinIn);
    formEl.appendChild(row1);

    // Seçenekler
    formEl.appendChild(
      el("p", "muted se-hint", d.secenekler.length ? "Seçenekler (butonlar):" : "Bu adımda seçenek yok → burası bir SON. Devam ettirmek için seçenek ekle.")
    );
    d.secenekler.forEach((s, i) => {
      const row = el("div", "se-row se-choice-row");
      const etiketIn = el("input", "se-input");
      etiketIn.value = s.etiket;
      etiketIn.maxLength = 60;
      etiketIn.placeholder = "Buton yazısı (ör. İzmir'e gitsin)";
      etiketIn.addEventListener("input", () => {
        s.etiket = etiketIn.value;
        degisti();
        agacCiz();
      });
      row.appendChild(etiketIn);
      row.appendChild(el("span", "se-arrow", "→"));
      const sel = hedefSecici(s.hedef);
      sel.addEventListener("change", () => {
        if (sel.value === "__yeni__") {
          const id = yeniId();
          hikaye.dugumler[id] = { emoji: "", metin: "", secenekler: [] };
          s.hedef = id;
        } else {
          s.hedef = sel.value;
        }
        degisti();
        agacCiz();
        formCiz();
      });
      row.appendChild(sel);
      const git = el("button", "admin-btn reject se-small", "Git");
      git.type = "button";
      git.title = "Bu seçeneğin gittiği adımı düzenle";
      git.addEventListener("click", () => sec(s.hedef));
      row.appendChild(git);
      const sil = el("button", "admin-btn reject se-small", "✕");
      sil.type = "button";
      sil.title = "Seçeneği sil";
      sil.addEventListener("click", () => {
        d.secenekler.splice(i, 1);
        degisti();
        agacCiz();
        formCiz();
      });
      row.appendChild(sil);
      formEl.appendChild(row);
    });

    const actions = el("div", "se-row se-actions");
    if (d.secenekler.length < 6) {
      const ekle = el("button", "admin-btn publish se-small", "+ Seçenek ekle");
      ekle.type = "button";
      ekle.addEventListener("click", () => {
        const id = yeniId();
        hikaye.dugumler[id] = { emoji: "", metin: "", secenekler: [] };
        d.secenekler.push({ etiket: "", hedef: id });
        degisti();
        agacCiz();
        formCiz();
      });
      actions.appendChild(ekle);
    }
    if (seciliId !== hikaye.baslangic) {
      const bas = el("button", "admin-btn reject se-small", "🚩 Başlangıç yap");
      bas.type = "button";
      bas.addEventListener("click", () => {
        hikaye.baslangic = seciliId;
        degisti();
        agacCiz();
        formCiz();
      });
      actions.appendChild(bas);

      const silBtn = el("button", "admin-btn reject se-small se-danger", "🗑️ Adımı sil");
      silBtn.type = "button";
      silBtn.addEventListener("click", () => {
        if (!confirm("Bu adım silinsin mi? Ona giden seçenekler de silinir.")) return;
        const silinen = seciliId;
        delete hikaye.dugumler[silinen];
        Object.values(hikaye.dugumler).forEach((x) => {
          x.secenekler = x.secenekler.filter((s) => s.hedef !== silinen);
        });
        seciliId = hikaye.baslangic;
        degisti();
        agacCiz();
        formCiz();
      });
      actions.appendChild(silBtn);
    }
    formEl.appendChild(actions);
  }

  // ---------------- Kaydet / sıfırla ----------------
  function dogrula() {
    const hatalar = [];
    Object.entries(hikaye.dugumler).forEach(([id, d]) => {
      if (!d.metin.trim()) hatalar.push("[" + id + "] adımının metni boş.");
      d.secenekler.forEach((s, i) => {
        if (!s.etiket.trim()) hatalar.push("[" + id + "] adımının " + (i + 1) + ". seçeneğinin yazısı boş.");
        if (!hikaye.dugumler[s.hedef]) hatalar.push("[" + id + "] adımının " + (i + 1) + ". seçeneği olmayan bir adıma gidiyor.");
      });
    });
    return hatalar;
  }

  saveBtn.addEventListener("click", async () => {
    const hatalar = dogrula();
    if (hatalar.length) {
      setStatus("⚠️ Kaydedilemedi: " + hatalar[0] + (hatalar.length > 1 ? " (+" + (hatalar.length - 1) + " hata daha)" : ""));
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
      setStatus("⚠️ Kaydedilemedi: " + err.message + " (Firestore kurallarına sosyal_hikaye eklendi mi? README'ye bak.)");
    }
    saveBtn.disabled = false;
  });

  resetBtn.addEventListener("click", () => {
    if (!confirm("Tüm hikaye varsayılan hale dönsün mü? (Kaydet'e basmadıkça yayına çıkmaz.)")) return;
    hikaye = window.SosyalHikaye.varsayilan();
    seciliId = hikaye.baslangic;
    degisti();
    agacCiz();
    formCiz();
  });

  addNodeBtn.addEventListener("click", () => {
    const id = yeniId();
    hikaye.dugumler[id] = { emoji: "", metin: "", secenekler: [] };
    degisti();
    sec(id);
  });

  // ---------------- Berkay'ın resmi ----------------
  function resmiGoster(src) {
    if (src) {
      imgPreview.src = src;
      imgPreview.hidden = false;
      imgRemove.hidden = false;
    } else {
      imgPreview.hidden = true;
      imgRemove.hidden = true;
    }
  }

  imgFile.addEventListener("change", async () => {
    const file = imgFile.files[0];
    if (!file) return;
    imgStatus.textContent = "Yükleniyor...";
    try {
      const dataUrl = await window.resizeImageToSquare(file, 400);
      await db.collection("sosyal_hikaye").doc("resim").set({ resim: dataUrl });
      resmiGoster(dataUrl);
      imgStatus.textContent = "✅ Berkay'ın resmi güncellendi.";
    } catch (err) {
      console.error("Resim yüklenemedi:", err.message);
      imgStatus.textContent = "⚠️ Yüklenemedi: " + err.message;
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
  openBtn.addEventListener("click", async () => {
    const acik = !editor.hidden;
    if (acik) {
      if (kirli && !confirm("Kaydedilmemiş değişiklikler var, yine de kapatılsın mı?")) return;
      editor.hidden = true;
      openBtn.textContent = "👥 Sosyal Hayat Düzenle";
      return;
    }
    editor.hidden = false;
    openBtn.textContent = "✖ Düzenlemeyi kapat";
    if (!yuklendi) {
      setStatus("Yükleniyor...");
      const { hikaye: h, resim, kaynak } = await window.SosyalHikaye.yukle();
      hikaye = h;
      seciliId = null;
      yuklendi = true;
      resmiGoster(resim);
      setStatus(kaynak === "firestore" ? "" : "Şu an varsayılan hikaye gösteriliyor (henüz hiç kaydedilmedi).");
    }
    agacCiz();
    formCiz();
  });

  window.addEventListener("beforeunload", (e) => {
    if (kirli) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
