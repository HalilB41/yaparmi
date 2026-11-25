// ============================================================
// dc.js — sohbet.html: grubun "Discord"u.
//   # genel  : ana sayfadaki Sohbet ile aynı kanal (Firestore ahir_mesajlar; script.js'e dokunulmadan,
//              aynı kurallarla yazılır: ahir_kullanicilar adı + ahir_limits 3 sn sınırı).
//   🔊 ses odaları: herkes herkese doğrudan bağlanır (WebRTC, ses Firestore'a yazılmaz).
//     ses_oda/{uid}      { ad, oda, mik, son }  kim hangi odada (30 sn'de bir "buradayım")
//     ses_sinyal/{a_b}   { kimden, kime, oda, offer, answer, t }  bağlantı kurmak için bir kez
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("dcMesajlar") || typeof db === "undefined" || !db) return;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const toast = (m, s) => (window.Ekonomi && Ekonomi.toast ? Ekonomi.toast(m, s) : alert(m));

  const ODALAR = [["genel", "Genel"], ["oyun", "Oyun Odası"], ["gece", "Gece Muhabbeti"]];
  const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
  const KALP_MS = 30000, ESKI_MS = 95000;
  const RENKLER = ["#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#2563eb", "#c026d3", "#ca8a04", "#dc2626", "#0d9488"];
  const renk = (ad) => { let h = 0; for (const ch of String(ad)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return RENKLER[h % RENKLER.length]; };
  const harf = (ad) => String(ad || "?").trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";
  function avatar(ad, kucuk) { const a = el("span", "dc-av" + (kucuk ? " kucuk" : ""), harf(ad)); a.style.background = renk(ad); return a; }

  let profile = null;
  window.YaparmiAuth.onChange((p) => {
    const once = profile && profile.uid;
    profile = p;
    $("dcBenAd").textContent = p ? p.kullaniciAdi : "Misafir";
    const av = $("dcBenAv"); av.textContent = harf(p ? p.kullaniciAdi : "?"); av.style.background = p ? renk(p.kullaniciAdi) : "";
    if (once && (!p || p.uid !== once)) ayril();
    sesCiz();
  });

  // =========================================================
  // # genel (metin)
  // =========================================================
  const kutu = $("dcMesajlar");
  let ilkYuk = true;
  db.collection("ahir_mesajlar").orderBy("tarih", "asc").limitToLast(50).onSnapshot((s) => {
    const altta = kutu.scrollHeight - kutu.scrollTop - kutu.clientHeight < 80;
    kutu.innerHTML = "";
    const list = s.docs.map((d) => d.data()).filter((m) => m && typeof m.mesaj === "string");
    if (!list.length) kutu.append(el("p", "dc-bos", "Henüz kimse yazmamış. İlk mesajı sen at 👋"));
    let onceki = null;
    for (const m of list) {
      const t = m.tarih && m.tarih.toDate ? m.tarih.toDate() : new Date();
      const ad = m.kullaniciAdi || "?";
      const ayni = onceki && onceki.ad === ad && t - onceki.t < 5 * 60000;
      if (!ayni) {
        const satir = el("div", "dc-msj");
        const ic = el("div", "dc-msj-ic");
        const bas = el("div", "dc-msj-bas"); bas.append(el("b", null, ad), el("small", null, t.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })));
        bas.querySelector("b").style.color = renk(ad);
        ic.append(bas);
        satir.append(avatar(ad), ic);
        kutu.append(satir);
        onceki = { ad, t, ic };
      } else onceki.t = t;
      onceki.ic.append(el("p", null, m.mesaj));
    }
    if (altta || ilkYuk) kutu.scrollTop = kutu.scrollHeight;
    ilkYuk = false;
  }, (e) => { kutu.innerHTML = ""; kutu.append(el("p", "dc-bos", "Sohbet yüklenemedi: " + e.message)); });

  const AD_KEY = "yaparmi_username";
  const temizAd = (s) => String(s || "").normalize("NFC").replace(/\s+/g, "").slice(0, 12);
  let sonGonder = 0;
  // Sohbet adı: önce bu tarayıcıdaki eski ad, sonra hesabın kullanıcı adı denenir.
  // ahir_kullanicilar/{ad} belgesine kendi uid'ini yazabiliyorsan o ad senindir
  // (boşsa alınır, seninse güncellenir, başkasınınsa kural reddeder).
  // Eski ad başka bir hesaba (ör. önceki anonim girişe) aitse otomatik hesabın adına geçer.
  let benimAd = null;
  async function sohbetAdi() {
    const uid = auth.currentUser.uid;
    if (benimAd && benimAd.uid === uid) return benimAd.ad;
    let eski = ""; try { eski = temizAd(localStorage.getItem(AD_KEY)); } catch { /* yok */ }
    const hesap = temizAd(profile && profile.kullaniciAdi);
    const adaylar = [...new Set([eski, hesap].filter(Boolean))];
    if (!adaylar.length) throw new Error("Önce sağ üstten giriş yap.");
    for (const ad of adaylar) {
      try {
        await db.collection("ahir_kullanicilar").doc(ad).set({ uid });
        try { localStorage.setItem(AD_KEY, ad); } catch { /* yok */ }
        benimAd = { uid, ad };
        return ad;
      } catch { /* bu ad başkasının, sıradakini dene */ }
    }
    throw new Error(`"${adaylar.join('" / "')}" sohbet adı başka bir hesapta kayıtlı. Admin panelinden ya da farklı bir kullanıcı adıyla dene.`);
  }
  const not = (y) => { $("dcNot").textContent = y || ""; $("dcNot").hidden = !y; };
  $("dcForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = $("dcYazi"), yazi = inp.value.trim().slice(0, 300);
    if (!yazi) return;
    if (!auth || !auth.currentUser) return not("Bağlanılıyor, birkaç saniye sonra tekrar dene.");
    if (Date.now() - sonGonder < 3000) return not("Yavaş ol biraz, 3 saniyede bir mesaj.");
    sonGonder = Date.now(); not("");
    inp.disabled = true;
    try {
      const ad = await sohbetAdi(), uid = auth.currentUser.uid;
      await db.collection("ahir_mesajlar").add({ uid, kullaniciAdi: ad, mesaj: yazi, tarih: firebase.firestore.FieldValue.serverTimestamp() });
      await db.collection("ahir_limits").doc(uid).set({ sonMesajZamani: firebase.firestore.FieldValue.serverTimestamp() });
      inp.value = "";
      if (window.Basarim) Basarim.say("ahir");
    } catch (err) {
      if (err.message.includes("permission")) { benimAd = null; not("Mesaj gönderilemedi, 3 saniye bekleyip tekrar dene."); }
      else not(err.message);
    }
    inp.disabled = false; inp.focus();
  });

  // =========================================================
  // 🔊 ses odaları
  // =========================================================
  let uyeler = [];          // ses_oda belgeleri (taze olanlar)
  let oda = null;           // girdiğim oda
  const mik = { akis: null, kapali: false, yok: false };
  let sagir = false, kalp = null, sinyalDur = null;
  const esler = new Map();  // uid -> { pc, sesEl, analiz, dur }
  let sesBaglam = null;
  const baglamAl = () => { try { sesBaglam = sesBaglam || new (window.AudioContext || window.webkitAudioContext)(); if (sesBaglam.state === "suspended") sesBaglam.resume(); } catch { /* yok */ } return sesBaglam; };
  function analizci(akis) { const b = baglamAl(); if (!b || !akis) return null; try { const kaynak = b.createMediaStreamSource(akis), a = b.createAnalyser(); a.fftSize = 256; kaynak.connect(a); return { a, veri: new Uint8Array(a.frequencyBinCount) }; } catch { return null; } }
  const duzey = (an) => { if (!an) return 0; an.a.getByteFrequencyData(an.veri); let t = 0; for (let i = 2; i < 40; i++) t += an.veri[i]; return t / 38; };
  let benAnaliz = null;

  db.collection("ses_oda").onSnapshot((s) => {
    const simdi = Date.now();
    uyeler = s.docs.map((d) => Object.assign({ uid: d.id }, d.data())).filter((u) => u.son && u.son.toMillis && simdi - u.son.toMillis() < ESKI_MS);
    // odadan çıkanların bağlantısını kapat
    if (oda) for (const uid of [...esler.keys()]) if (!uyeler.some((u) => u.uid === uid && u.oda === oda)) esKapat(uid);
    sesCiz();
  }, (e) => console.warn("ses_oda:", e.message));

  function sesCiz() {
    const kap = $("dcSesKanallar"); kap.innerHTML = "";
    for (const [id, ad] of ODALAR) {
      const b = el("button", "dc-kanal dc-ses" + (oda === id ? " on" : ""));
      b.type = "button"; b.append(el("span", null, "🔊"), document.createTextNode(" " + ad));
      const kac = uyeler.filter((u) => u.oda === id).length;
      if (kac) b.append(el("em", null, String(kac)));
      b.addEventListener("click", () => (oda === id ? null : katil(id)));
      kap.append(b);
      const liste = el("div", "dc-uyeler");
      for (const u of uyeler.filter((x) => x.oda === id)) {
        const benim = profile && u.uid === profile.uid;
        const s = el("div", "dc-uye"); s.dataset.uid = u.uid;
        s.append(avatar(u.ad, true), el("span", null, u.ad));
        if (!u.mik) s.append(el("i", null, "🔇"));
        if (benim && sagir) s.append(el("i", null, "🎧"));
        const e = esler.get(u.uid);
        if (e && e.durum === "kopuk") s.append(el("i", "dc-kopuk", "⚠️"));
        liste.append(s);
      }
      kap.append(liste);
    }
    const acik = !!oda;
    $("dcAyril").hidden = !acik;
    $("dcBenDurum").textContent = acik ? `🟢 Ses bağlı · ${ODALAR.find((o) => o[0] === oda)[1]}` : profile ? "Ses bağlı değil" : "Ses için giriş yap";
    $("dcMik").textContent = mik.kapali || mik.yok ? "🔇" : "🎙️";
    $("dcMik").classList.toggle("kapali", mik.kapali || mik.yok);
    $("dcSagir").classList.toggle("kapali", sagir);
  }

  async function mikAl() {
    if (mik.akis) return true;
    try {
      mik.akis = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mik.yok = false; benAnaliz = analizci(mik.akis);
      mik.akis.getAudioTracks().forEach((t) => (t.enabled = !mik.kapali && !sagir));
      return true;
    } catch { mik.yok = true; return false; }
  }
  async function varlikYaz() {
    if (!oda || !profile) return;
    try { await db.collection("ses_oda").doc(profile.uid).set({ ad: profile.kullaniciAdi, oda, mik: !(mik.kapali || mik.yok || sagir), son: firebase.firestore.FieldValue.serverTimestamp() }); }
    catch (e) { console.warn("ses_oda yaz:", e.message); if (/permission/i.test(e.message)) { toast("Ses odasına yazılamadı. Firestore kuralları güncel mi?", 4000); ayril(); } }
  }

  async function katil(id) {
    if (!profile) return toast("Sesli sohbete girmek için sağ üstten giriş yap.", 3000);
    if (oda) await ayril();
    baglamAl();
    const izin = await mikAl();
    if (!izin) toast("Mikrofon izni yok, sadece dinleyebilirsin.", 3500);
    oda = id;
    await varlikYaz();
    clearInterval(kalp); kalp = setInterval(varlikYaz, KALP_MS);
    sinyalDur = db.collection("ses_sinyal").where("kime", "==", profile.uid).onSnapshot((s) => s.docChanges().forEach((c) => { if (c.type !== "removed") teklifGeldi(c.doc.id, c.doc.data()); }), (e) => console.warn("sinyal:", e.message));
    // odadakilere ben bağlanırım (yeni gelen teklif verir)
    for (const u of uyeler) if (u.oda === id && u.uid !== profile.uid) teklifVer(u.uid);
    sesCiz();
  }

  async function ayril() {
    if (!oda) return;
    oda = null;
    clearInterval(kalp); kalp = null;
    if (sinyalDur) { sinyalDur(); sinyalDur = null; }
    for (const uid of [...esler.keys()]) esKapat(uid);
    if (mik.akis) { mik.akis.getTracks().forEach((t) => t.stop()); mik.akis = null; benAnaliz = null; }
    if (profile) { try { await db.collection("ses_oda").doc(profile.uid).delete(); } catch { /* yok */ } }
    sesCiz();
  }
  addEventListener("pagehide", () => { if (oda && profile) db.collection("ses_oda").doc(profile.uid).delete().catch(() => {}); });

  function iceBitir(pc) {
    return new Promise((coz) => {
      if (pc.iceGatheringState === "complete") return coz();
      const z = setTimeout(coz, 3500);
      pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(z); coz(); } });
    });
  }
  function pcKur(uid) {
    const pc = new RTCPeerConnection(ICE);
    const e = { pc, sesEl: null, analiz: null, durum: "baglaniyor", dur: null };
    esler.set(uid, e);
    if (mik.akis) mik.akis.getAudioTracks().forEach((t) => pc.addTrack(t, mik.akis));
    else pc.addTransceiver("audio", { direction: "recvonly" });
    pc.ontrack = (ev) => {
      const akis = ev.streams[0] || new MediaStream([ev.track]);
      if (!e.sesEl) { e.sesEl = new Audio(); e.sesEl.autoplay = true; e.sesEl.playsInline = true; }
      e.sesEl.srcObject = akis; e.sesEl.muted = sagir;
      e.sesEl.play().catch(() => toast("Sesi duymak için sayfaya bir kez dokun.", 3000));
      e.analiz = analizci(akis);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") e.durum = "bagli";
      else if (pc.connectionState === "failed") e.durum = "kopuk";
      sesCiz();
    };
    return e;
  }
  function esKapat(uid) {
    const e = esler.get(uid); if (!e) return;
    try { e.pc.close(); } catch { /* yok */ }
    if (e.dur) e.dur();
    if (e.sesEl) { e.sesEl.srcObject = null; }
    esler.delete(uid);
  }

  async function teklifVer(uid) {
    if (!oda || esler.has(uid)) return;
    const e = pcKur(uid), pc = e.pc, id = profile.uid + "_" + uid;
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await iceBitir(pc);
      if (!esler.has(uid) || esler.get(uid) !== e) return;
      const ref = db.collection("ses_sinyal").doc(id);
      await ref.set({ kimden: profile.uid, kime: uid, oda, offer: JSON.stringify(pc.localDescription), answer: null, t: Date.now() });
      e.dur = ref.onSnapshot(async (s) => {
        const d = s.data();
        if (!d || !d.answer || pc.signalingState !== "have-local-offer") return;
        try { await pc.setRemoteDescription(JSON.parse(d.answer)); } catch (err) { console.warn("cevap:", err.message); }
        if (e.dur) { e.dur(); e.dur = null; }
        ref.delete().catch(() => {});
      });
    } catch (err) { console.warn("teklif:", err.message); esKapat(uid); }
  }

  async function teklifGeldi(id, d) {
    if (!oda || !d || d.answer || !d.offer || d.oda !== oda || Date.now() - (d.t || 0) > 60000) return;
    const uid = d.kimden;
    const var_ = esler.get(uid);
    if (var_) {
      // ikimiz aynı anda teklif verdiysek: uid'i küçük olanın teklifi geçerli
      if (var_.pc.signalingState === "have-local-offer" && profile.uid > uid) esKapat(uid);
      else return;
    }
    const e = pcKur(uid), pc = e.pc;
    try {
      await pc.setRemoteDescription(JSON.parse(d.offer));
      await pc.setLocalDescription(await pc.createAnswer());
      await iceBitir(pc);
      await db.collection("ses_sinyal").doc(id).update({ answer: JSON.stringify(pc.localDescription) });
    } catch (err) { console.warn("cevap ver:", err.message); esKapat(uid); }
  }

  // --- düğmeler ---
  $("dcMik").addEventListener("click", async () => {
    if (mik.yok && oda) { if (await mikAl()) { const o = oda; await ayril(); await katil(o); } else toast("Tarayıcı mikrofon iznini engellemiş. Adres çubuğundaki kilitten izin ver.", 4000); return; }
    mik.kapali = !mik.kapali;
    if (mik.akis) mik.akis.getAudioTracks().forEach((t) => (t.enabled = !mik.kapali && !sagir));
    varlikYaz(); sesCiz();
  });
  $("dcSagir").addEventListener("click", () => {
    sagir = !sagir;
    esler.forEach((e) => { if (e.sesEl) e.sesEl.muted = sagir; });
    if (mik.akis) mik.akis.getAudioTracks().forEach((t) => (t.enabled = !mik.kapali && !sagir));
    varlikYaz(); sesCiz();
  });
  $("dcAyril").addEventListener("click", ayril);

  // --- konuşan göstergesi ---
  setInterval(() => {
    document.querySelectorAll(".dc-uye").forEach((s) => {
      const uid = s.dataset.uid;
      let k = 0;
      if (profile && uid === profile.uid) k = !mik.kapali && !sagir ? duzey(benAnaliz) : 0;
      else { const e = esler.get(uid); k = e ? duzey(e.analiz) : 0; }
      s.classList.toggle("konusuyor", k > 18);
    });
  }, 150);
})();
