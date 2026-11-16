// ============================================================
// topluluk-admin.js — admin.html "📊 Topluluk" sekmesi:
//   - Anket / Günün Sorusu / Haftanın Rezili oluştur, aç-kapat, doğru cevabı işaretle, sil
//   - Grup sayaçları (sayaclar/grup) düzenle, +1 / −1
//   - Vardiya kayıtlarını (vardiyalar) düzelt / sil
// Veri yapısı için bkz. js/topluluk.js başı.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("anketAdminListe")) return;

  let basladi = false;
  const TUR = { gunun: "🌞 Günün Sorusu", anket: "🗳️ Anket", rezillik: "🤡 Haftanın Rezili" };
  const VARDIYA = { gece: "🌙 Gece", gunduz: "☀️ Gündüz", sabah: "🌅 Sabah" };
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function tarihYaz(ts) { try { return ts && ts.toDate ? ts.toDate().toLocaleDateString("tr-TR") : "-"; } catch { return "-"; } }

  // ---------------- Anket oluştur ----------------
  $("anketOlustur").addEventListener("click", async () => {
    const baslik = $("anketBaslik").value.trim().slice(0, 160);
    const secenekler = $("anketSecenekler").value.split("\n").map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 10);
    const durum = $("anketOlusturDurum");
    if (!baslik || secenekler.length < 2) { durum.textContent = "Başlık ve en az 2 seçenek gerekli."; return; }
    durum.textContent = "Oluşturuluyor…";
    try {
      await db.collection("anketler").add({
        tur: TUR[$("anketTur").value] ? $("anketTur").value : "anket",
        baslik, secenekler, acik: true, dogru: null,
        tarih: firebase.firestore.FieldValue.serverTimestamp(),
      });
      $("anketBaslik").value = ""; $("anketSecenekler").value = "";
      durum.textContent = "✅ Açıldı, topluluk sayfasında görünüyor.";
    } catch (err) { durum.textContent = "⚠️ Olmadı: " + err.message; }
  });

  // ---------------- Anket listesi ----------------
  let oySay = {};
  function anketleriDinle() {
    db.collection("anket_oylar").limit(3000).onSnapshot((snap) => {
      oySay = {};
      snap.forEach((d) => { const v = d.data(); oySay[v.anketId] = (oySay[v.anketId] || 0) + 1; });
      document.querySelectorAll("[data-oysay]").forEach((e) => { e.textContent = (oySay[e.dataset.oysay] || 0) + " oy"; });
    });
    db.collection("anketler").orderBy("tarih", "desc").limit(100).onSnapshot((snap) => {
      const kutu = $("anketAdminListe");
      kutu.innerHTML = "";
      if (snap.empty) { kutu.appendChild(el("p", "muted", "Henüz anket yok.")); return; }
      snap.forEach((doc) => {
        const a = doc.data();
        const satir = el("div", "adm-anket" + (a.acik ? "" : " is-kapali"));
        satir.appendChild(el("span", "tpl-etiket", TUR[a.tur] || TUR.anket));
        satir.appendChild(el("b", null, a.baslik || "(başlıksız)"));
        satir.appendChild(el("span", "muted", tarihYaz(a.tarih)));
        const oy = el("span", "muted", (oySay[doc.id] || 0) + " oy"); oy.dataset.oysay = doc.id; satir.appendChild(oy);

        const sec = el("select");
        const bos = el("option", null, "Doğru cevap: yok"); bos.value = ""; sec.appendChild(bos);
        (a.secenekler || []).forEach((s, i) => { const o = el("option", null, "✅ " + s); o.value = String(i); if (a.dogru === i) o.selected = true; sec.appendChild(o); });
        sec.addEventListener("change", () => db.collection("anketler").doc(doc.id).update({ dogru: sec.value === "" ? null : Number(sec.value) }).catch((e) => alert(e.message)));
        satir.appendChild(sec);

        const ac = el("button", "admin-btn se-small " + (a.acik ? "reject" : "publish"), a.acik ? "⏹ Kapat" : "▶ Aç"); ac.type = "button";
        ac.addEventListener("click", () => db.collection("anketler").doc(doc.id).update({ acik: !a.acik }).catch((e) => alert(e.message)));
        satir.appendChild(ac);

        const sil = el("button", "admin-btn reject se-small", "Sil"); sil.type = "button";
        sil.addEventListener("click", () => { if (confirm('"' + a.baslik + '" silinsin mi?')) db.collection("anketler").doc(doc.id).delete().catch((e) => alert(e.message)); });
        satir.appendChild(sil);
        kutu.appendChild(satir);
      });
    }, (err) => { $("anketAdminListe").innerHTML = '<p class="muted">Okunamadı: ' + err.message + "</p>"; });
  }

  // ---------------- Grup sayaçları ----------------
  let sayaclar = [];
  const sayacKutu = $("grupSayacAdmin");
  function sayacCiz() {
    sayacKutu.innerHTML = "";
    if (!sayaclar.length) { sayacKutu.appendChild(el("p", "muted", "Sayaç yok. ➕ ile ekle.")); return; }
    sayaclar.forEach((s, i) => {
      const satir = el("div", "adm-sayac");
      const emoji = el("input"); emoji.value = s.emoji; emoji.maxLength = 8; emoji.placeholder = "🔢";
      emoji.addEventListener("input", () => { s.emoji = emoji.value; });
      const ad = el("input"); ad.value = s.ad; ad.maxLength = 60; ad.placeholder = "Berkay napıcak";
      ad.addEventListener("input", () => { s.ad = ad.value; });
      const deger = el("input", "adm-sayac-deger"); deger.type = "number"; deger.value = s.deger;
      deger.addEventListener("input", () => { s.deger = Math.round(Number(deger.value) || 0); });
      const art = el("button", "admin-btn publish se-small", "+1"); art.type = "button";
      art.addEventListener("click", () => { s.deger = (Number(s.deger) || 0) + 1; deger.value = s.deger; });
      const eks = el("button", "admin-btn reject se-small", "−1"); eks.type = "button";
      eks.addEventListener("click", () => { s.deger = (Number(s.deger) || 0) - 1; deger.value = s.deger; });
      const sil = el("button", "admin-btn reject se-small", "🗑"); sil.type = "button";
      sil.addEventListener("click", () => { sayaclar.splice(i, 1); sayacCiz(); });
      satir.append(emoji, ad, deger, art, eks, sil);
      sayacKutu.appendChild(satir);
    });
  }
  $("grupSayacEkle").addEventListener("click", () => { sayaclar.push({ emoji: "🔢", ad: "", deger: 0 }); sayacCiz(); });
  $("grupSayacKaydet").addEventListener("click", async () => {
    const liste = sayaclar.filter((s) => s.ad.trim()).map((s) => ({ emoji: String(s.emoji || "🔢").slice(0, 8), ad: s.ad.trim().slice(0, 60), deger: Math.round(Number(s.deger) || 0) })).slice(0, 20);
    $("grupSayacDurum").textContent = "Kaydediliyor…";
    try {
      await db.collection("sayaclar").doc("grup").set({ liste });
      $("grupSayacDurum").textContent = "✅ Kaydedildi.";
    } catch (err) { $("grupSayacDurum").textContent = "⚠️ " + err.message; }
  });
  function sayaclariYukle() {
    db.collection("sayaclar").doc("grup").get().then((snap) => {
      const v = snap.exists ? snap.data() : {};
      sayaclar = (Array.isArray(v.liste) ? v.liste : []).map((s) => ({ emoji: String(s.emoji || "🔢"), ad: String(s.ad || ""), deger: Number(s.deger) || 0 }));
      sayacCiz();
    }).catch((e) => { sayacKutu.innerHTML = '<p class="muted">Okunamadı: ' + e.message + "</p>"; });
  }

  // ---------------- Vardiyalar ----------------
  function vardiyalariDinle() {
    db.collection("vardiyalar").orderBy("tarih", "desc").limit(200).onSnapshot((snap) => {
      const tb = $("vardiyaAdminTablo");
      tb.innerHTML = "";
      if (snap.empty) { tb.innerHTML = '<tr><td colspan="7" class="muted">Kayıt yok.</td></tr>'; return; }
      snap.forEach((doc) => {
        const v = doc.data();
        const tr = el("tr");
        const td = (t) => { const c = el("td", null, t); tr.appendChild(c); return c; };
        td(v.tarih || "-"); td(v.kullaniciAdi || "?"); td(VARDIYA[v.vardiya] || v.vardiya || ""); td(v.bolum || "");
        const tlTd = td(""); const tl = el("input", "adm-tl"); tl.type = "number"; tl.value = v.tl || 0; tlTd.appendChild(tl);
        td(v.not || "");
        const islem = td("");
        const kaydet = el("button", "admin-btn publish se-small", "Kaydet"); kaydet.type = "button";
        kaydet.addEventListener("click", () => db.collection("vardiyalar").doc(doc.id).update({ tl: Math.max(0, Math.round(Number(tl.value) || 0)) }).catch((e) => alert(e.message)));
        const sil = el("button", "admin-btn reject se-small", "Sil"); sil.type = "button";
        sil.addEventListener("click", () => { if (confirm((v.kullaniciAdi || "?") + " " + v.tarih + " silinsin mi?")) db.collection("vardiyalar").doc(doc.id).delete().catch((e) => alert(e.message)); });
        islem.append(kaydet, sil);
        tb.appendChild(tr);
      });
    }, (err) => { $("vardiyaAdminTablo").innerHTML = '<tr><td colspan="7" class="muted">Okunamadı: ' + err.message + "</td></tr>"; });
  }

  function basla() {
    if (basladi || typeof db === "undefined" || !db) return;
    basladi = true;
    anketleriDinle(); sayaclariYukle(); vardiyalariDinle();
  }
  if (window.YaparmiAuth) window.YaparmiAuth.onChange((p) => { if (p && p.rol === "admin") basla(); });
})();
