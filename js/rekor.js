// ============================================================
// rekor.js — Spor oyunlarının ORTAK rekor tablosu (Firestore: rekorlar).
// Herkesin her oyun için tek bir kaydı var: rekorlar/{oyun}_{uid} { oyun, uid, ad, skor, tarih }
// Sadece giriş yapmış (kayıtlı) kullanıcılar tabloya girer; skor sadece yükselebilir.
//   Rekor.gonder("boks", 812)          → kendi rekorundan yüksekse kaydeder
//   Rekor.tablo("boks", kutuElementi)  → ilk 10'u gösterir (canlı güncellenir)
// ============================================================
(function () {
  "use strict";
  const OYUNLAR = {
    boks: { ad: "Boks makinesi", birim: "", ust: 999, yerel: () => lsNum("spor_boks_eniyi") },
    penalti: { ad: "En uzun gol serisi", birim: " gol", ust: 1000, yerel: () => lsNum("spor_rekor_penalti") },
    motor: { ad: "Kasksız 85 en uzun yol", birim: " m", ust: 1500, yerel: () => lsNum("spor_rekor_motor") },
  };
  function lsNum(k) { try { return Number(JSON.parse(localStorage.getItem(k) || "0")) || 0; } catch { return 0; } }
  function lsMax(k, v) { try { if (v > lsNum(k)) localStorage.setItem(k, JSON.stringify(v)); } catch { /* yok */ } }

  const hazir = () => typeof db !== "undefined" && db && typeof auth !== "undefined" && auth;
  function profil() { return window.YaparmiAuth && YaparmiAuth.getProfile ? YaparmiAuth.getProfile() : null; }
  const bilinen = {}; // bu oturumda bilinen kendi rekorlarım

  async function gonder(oyun, skor) {
    const o = OYUNLAR[oyun];
    skor = Math.max(0, Math.min(o ? o.ust : 0, Math.round(skor)));
    if (!o || !skor) return;
    if (oyun === "penalti") lsMax("spor_rekor_penalti", skor);
    if (oyun === "motor") lsMax("spor_rekor_motor", skor);
    const p = profil();
    if (!p || !hazir() || !auth.currentUser || auth.currentUser.isAnonymous) return;
    const id = oyun + "_" + p.uid;
    const ref = db.collection("rekorlar").doc(id);
    try {
      if (bilinen[id] === undefined) {
        const snap = await ref.get();
        bilinen[id] = snap.exists ? snap.data().skor || 0 : 0;
      }
      if (skor <= bilinen[id]) return;
      bilinen[id] = skor;
      await ref.set({ oyun, uid: p.uid, ad: p.kullaniciAdi, skor, tarih: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.warn("Rekor kaydedilemedi:", err.message);
    }
  }

  function tablo(oyun, kutu) {
    const o = OYUNLAR[oyun];
    if (!o || !kutu) return () => {};
    kutu.className = "sp-tablo rk-tablo";
    kutu.innerHTML = '<div class="sp-tablo-baslik">👥 Grup rekorları · ' + o.ad + '</div><div class="rk-satirlar"><p class="muted sp-small">Yükleniyor…</p></div><p class="muted sp-small rk-not"></p>';
    const satirlar = kutu.querySelector(".rk-satirlar");
    const not = kutu.querySelector(".rk-not");
    function notYaz() {
      not.textContent = profil() ? "" : "Senin rekorunun da burada görünmesi için sağ üstten giriş yap.";
    }
    notYaz();
    notlar.clear();
    notlar.add(notYaz);
    if (!hazir()) { satirlar.innerHTML = '<p class="muted sp-small">Tablo şu an bağlı değil.</p>'; return () => {}; }
    return db.collection("rekorlar").where("oyun", "==", oyun).onSnapshot((snap) => {
      const liste = [];
      snap.forEach((d) => liste.push(d.data()));
      liste.sort((a, b) => b.skor - a.skor);
      satirlar.innerHTML = "";
      if (!liste.length) { satirlar.innerHTML = '<p class="muted sp-small">Henüz kimse yok. İlk rekoru sen kır!</p>'; return; }
      const ben = profil() && profil().uid;
      liste.slice(0, 10).forEach((r, i) => {
        const s = document.createElement("div");
        s.className = "sp-tablo-satir" + (r.uid === ben ? " is-sen" : "");
        const sira = document.createElement("span");
        sira.className = "rk-sira";
        sira.textContent = ["🥇", "🥈", "🥉"][i] || String(i + 1);
        const ad = document.createElement("span");
        ad.className = "sp-tablo-ad";
        ad.textContent = r.ad + (r.uid === ben ? " (sen)" : "");
        const bos = document.createElement("span");
        bos.className = "sp-tablo-not";
        const skor = document.createElement("strong");
        skor.className = "sp-tablo-skor";
        skor.textContent = r.skor.toLocaleString("tr-TR") + o.birim;
        s.append(sira, ad, bos, skor);
        satirlar.appendChild(s);
      });
      if (ben && liste[0].uid === ben && window.Basarim) Basarim.ac("lider");
    }, () => { satirlar.innerHTML = '<p class="muted sp-small">Tablo okunamadı (Firestore kurallarına rekorlar eklendi mi?).</p>'; });
  }

  // Giriş yapınca bu cihazdaki eski rekorları da tabloya gönder
  let yerelGitti = false;
  function yereliGonder() {
    if (yerelGitti || !profil()) return;
    yerelGitti = true;
    Object.keys(OYUNLAR).forEach((k) => { const v = OYUNLAR[k].yerel(); if (v) gonder(k, v); });
  }

  const notlar = new Set();
  if (window.YaparmiAuth) YaparmiAuth.onChange(() => { notlar.forEach((f) => f()); yereliGonder(); });

  window.Rekor = { gonder, tablo };
})();
