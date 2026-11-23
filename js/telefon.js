// ============================================================
// telefon.js — "Berkay'ın Telefonu": sahte telefon arayüzü. Kilit ekranı (kod: 0085),
// uygulamalar ve 10 gizli sır. İlerleme sadece bu tarayıcıda (localStorage) tutulur.
// İçerik grup arşivindeki olaylardan esinlenen şakalardır.
// ============================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ekran = $("tlEkran");

  // ---------------- sırlar ----------------
  const SIRLAR = {
    kilit: "Kilit kodu: 0085 (tabii ki)",
    babam: "Babam: 'Parasını veririm' ama hep 'diyor'",
    banka: "Gizli hesap: 0,00 TL (o da boş)",
    lol: "Gerçek rank: Gümüş IV, 'West Master' değil",
    sifre: "Bütün şifreler 0085",
    gelistirici: "Geliştirici modu: Kask hatırlatıcısı kalıcı kapatılmış",
    galeri: "Gizli albüm: 'Kayalardan önce' (1 fotoğraf)",
    aquapark: "Aquapark 8. kez ertelendi",
    sarki: "Gizli çalma listesi: 'Kubi'ye diss'",
    arsiv: "Arşivlenen sohbet: Vardiya Müdürü",
  };
  const bulunan = () => { try { return JSON.parse(localStorage.getItem("telefon_sirlar") || "[]"); } catch { return []; } };
  function sirCiz() {
    const b = bulunan(); $("tlSirSay").textContent = `${b.length}/${Object.keys(SIRLAR).length}`;
    const ul = $("tlSirListe"); ul.textContent = "";
    for (const [k, v] of Object.entries(SIRLAR)) ul.append(el("li", b.includes(k) ? "tl-bulundu" : "", b.includes(k) ? "✅ " + v : "🔒 ???"));
  }
  let toastZ = null;
  function sir(k) {
    const b = bulunan(); if (b.includes(k)) return;
    b.push(k); try { localStorage.setItem("telefon_sirlar", JSON.stringify(b)); } catch { /* yok */ }
    sirCiz();
    const t = $("tlToast"); t.textContent = `🔓 Sır bulundu (${b.length}/10): ${SIRLAR[k]}` + (b.length === 10 ? " · 🏆 Hepsini buldun! Berkay'dan daha iyi tanıyorsun telefonunu." : "");
    t.hidden = false; clearTimeout(toastZ); toastZ = setTimeout(() => { t.hidden = true; }, 4200);
  }
  $("tlSifirla").addEventListener("click", () => { try { localStorage.removeItem("telefon_sirlar"); } catch { /* yok */ } sirCiz(); kilitEkrani(); });

  // ---------------- saat ----------------
  const saat = () => new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  setInterval(() => { $("tlSaat").textContent = saat(); }, 10000); $("tlSaat").textContent = saat();

  // ---------------- kilit ----------------
  const BILDIRIM = [
    ["🍗", "Popeyes", "Siparişin yolda! Bu ay 14. siparişin 🎉"],
    ["😳", "Kubi", "85'i gördün mü lan"],
    ["🏦", "Banka", "Hesabınızdan 389,90 TL çekildi. Kalan bakiye: 26,50 TL"],
    ["🍞", "Salih", "gelcem"],
    ["🔋", "Pil", "Pil %1. Şarj aleti takın."],
  ];
  function kilitEkrani() {
    ekran.className = "tl-ekran tl-kilit"; ekran.textContent = "";
    const ust = el("div", "tl-kilit-saat"); ust.append(el("b", null, saat()), el("small", null, new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })));
    const bl = el("div", "tl-bildirimler");
    BILDIRIM.forEach(([e, k, m]) => { const b = el("div", "tl-bildirim"); b.append(el("span", "tl-b-ikon", e)); const t = el("div"); t.append(el("b", null, k), el("p", null, m)); b.append(t); bl.append(b); });
    const ac = el("button", "tl-kaydir", "Açmak için dokun ↑"); ac.type = "button"; ac.onclick = sifreEkrani;
    ekran.append(ust, bl, ac);
  }
  function sifreEkrani() {
    ekran.className = "tl-ekran tl-sifre"; ekran.textContent = "";
    let kod = "";
    const nokta = el("div", "tl-noktalar"); for (let i = 0; i < 4; i++) nokta.append(el("i"));
    const ipucu = el("p", "tl-ipucu", "Şifreyi gir");
    let yanlis = 0;
    const tus = el("div", "tl-tuslar");
    const bas = (r) => {
      if (kod.length >= 4) return; kod += r;
      [...nokta.children].forEach((n, i) => n.classList.toggle("dolu", i < kod.length));
      if (kod.length === 4) setTimeout(() => {
        if (kod === "0085") { sir("kilit"); anaEkran(); return; }
        yanlis++; nokta.classList.add("tl-salla"); setTimeout(() => nokta.classList.remove("tl-salla"), 450);
        ipucu.textContent = yanlis >= 2 ? "İpucu: Berkay'ın en meşhur hızı (başında 00)" : "Yanlış şifre";
        kod = ""; [...nokta.children].forEach((n) => n.classList.remove("dolu"));
      }, 150);
    };
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].forEach((r) => {
      const b = el("button", r ? "tl-tus" : "tl-tus tl-bos", r); b.type = "button";
      if (r === "⌫") b.onclick = () => { kod = kod.slice(0, -1); [...nokta.children].forEach((n, i) => n.classList.toggle("dolu", i < kod.length)); };
      else if (r) b.onclick = () => bas(r);
      tus.append(b);
    });
    const geri = el("button", "tl-link", "İptal"); geri.type = "button"; geri.onclick = kilitEkrani;
    ekran.append(el("div", "tl-kilit-ikon", "🔒"), ipucu, nokta, tus, geri);
  }

  // ---------------- ana ekran ----------------
  const UYGULAMALAR = [
    ["whatsapp", "💬", "WhatsApp", "#22c55e"], ["banka", "🏦", "Banka", "#2563eb"], ["popeyes", "🍗", "Popeyes", "#f97316"], ["lol", "⚔️", "LoL", "#0f766e"],
    ["galeri", "🖼️", "Galeri", "#db2777"], ["takvim", "📅", "Takvim", "#dc2626"], ["notlar", "📝", "Notlar", "#ca8a04"], ["muzik", "🎵", "Müzik", "#16a34a"],
    ["harita", "🗺️", "Haritalar", "#0891b2"], ["ayarlar", "⚙️", "Ayarlar", "#64748b"],
  ];
  function anaEkran() {
    ekran.className = "tl-ekran tl-ana"; ekran.textContent = "";
    const izgara = el("div", "tl-izgara");
    UYGULAMALAR.forEach(([id, e, ad, renk]) => {
      const b = el("button", "tl-app"); b.type = "button";
      const ik = el("span", "tl-app-ikon", e); ik.style.background = renk;
      if (id === "whatsapp") ik.append(el("i", "tl-rozet", "47"));
      b.append(ik, el("small", null, ad)); b.onclick = () => uygulama(id, ad, renk);
      izgara.append(b);
    });
    ekran.append(el("div", "tl-duvar-yazi", "kubiiii 85'i gördüm 85"), izgara);
  }
  $("tlEv").addEventListener("click", () => { if (!ekran.classList.contains("tl-kilit") && !ekran.classList.contains("tl-sifre")) anaEkran(); });

  function cerceve(ad, renk) {
    ekran.className = "tl-ekran tl-uyg"; ekran.textContent = "";
    const bas = el("div", "tl-uyg-bas"); bas.style.background = renk;
    const geri = el("button", "tl-geri", "‹"); geri.type = "button"; geri.onclick = anaEkran;
    bas.append(geri, el("b", null, ad));
    const ic = el("div", "tl-uyg-ic");
    ekran.append(bas, ic);
    return { ic, bas, geri };
  }
  const satir = (sol, sag, alt, cls) => { const s = el("div", "tl-satir" + (cls ? " " + cls : "")); const a = el("div"); a.append(el("b", null, sol)); if (alt) a.append(el("small", null, alt)); s.append(a); if (sag != null) s.append(el("span", null, sag)); return s; };

  // ---------------- uygulamalar ----------------
  const SOHBET = {
    "Yaparmı Grubu 🔥": [["İbo", "Acilen Sakarya Aquapark yapmamız lazım, 7 kişi olursak 1.560"], ["Burger", "awuaqoark tamam ama berddsnsşz"], ["Kubi", "Labanzubu"], ["Salih", "gelcem"], ["Ben", "kubiiii 85'i gördüm 85"], ["İbo", "Berkay bunu da listeye ekliyorum, 101. madde"], ["Cem", "sanayiye gidin zanaat öğrenin"]],
    "Kubi 😳": [["Kubi", "bakiyem 12 TL ss attım gördün mü"], ["Ben", "30 bin nerde lan"], ["Kubi", "borsada, çorba parası"], ["Ben", "KPSS'de seni geçtim bu arada"], ["Kubi", "QR çektin"]],
    "Salih 🍞": [["Ben", "halısaha 22:00 geliyon mu"], ["Salih", "gelcem"], ["Ben", "kesin mi"], ["Salih", "gelcem dedim"], ["Ben", "neredesin maç başladı"], ["Salih", "(görüldü 22:47)"]],
    "Babam": [["Babam", "Oğlum otel çok pahalı"], ["Ben", "Baba ben parasını veririm diyorum ya"], ["Babam", "Sen hangi parayla veriyorsun"], ["Ben", "Ücretsiz izindeyim şu an"], ["Babam", "…"]],
    "Gebze Depo İK": [["İK", "Merhaba, net 26.500 TL, servis var, 04:50. Başlıyor musunuz?"], ["Ben", "26k napiyim aq"], ["İK", "Pardon?"]],
  };
  const APP = {
    whatsapp(ad, renk) {
      const { ic } = cerceve(ad, renk);
      Object.keys(SOHBET).forEach((k) => { const s = satir(k, "", SOHBET[k][SOHBET[k].length - 1][1].slice(0, 34) + "…"); s.onclick = () => sohbet(k); ic.append(s); });
      const ar = satir("🗄️ Arşivlenmiş (1)", "›", "Gizlenmiş sohbetler", "tl-soluk"); ar.onclick = () => { sir("arsiv"); sohbetGoster("Vardiya Müdürü (arşiv)", [["Müdür", "Yarın 08:00'de depodasın"], ["Ben", "Ücretsiz izin aldım"], ["Müdür", "2 yıldır ücretsiz izindesin"], ["Ben", "Evet"]]); }; ic.append(ar);
    },
    banka(ad, renk) {
      const { ic } = cerceve(ad, renk);
      const kart = el("div", "tl-banka-kart"); kart.append(el("small", null, "Vadesiz hesap"), el("b", null, "26,50 TL"), el("small", null, "Berkay ****0085"));
      let tik = 0; kart.onclick = () => { if (++tik >= 5) { sir("banka"); kart.querySelector("b").textContent = "Gizli hesap: 0,00 TL"; } };
      ic.append(kart, el("p", "tl-baslik", "Son hareketler"));
      [["Popeyes", "−389,90"], ["Tekel Bayi", "−240,00"], ["Maaş (ücretsiz izin)", "+0,00"], ["Kubi'ye borç", "−50,00"], ["yaparmi.com Kumarhane", "−∞"], ["Babam", "+500,00"], ["Popeyes", "−412,50"], ["Go kart", "−300,00"]].forEach(([a, b]) => ic.append(satir(a, b + " TL", null, b.startsWith("+") ? "tl-arti" : "tl-eksi")));
    },
    popeyes(ad, renk) {
      const { ic } = cerceve(ad, renk);
      ic.append(el("div", "tl-rozet-buyuk", "🏆 Efsane Müşteri · Bu ay 14 sipariş"));
      ["Bugün · 8'li kova + patates · 389,90 TL", "Dün · 12'li kova (tek kişi) · 412,50 TL", "Pazartesi · Sandviç menü + ekstra sos · 229 TL", "Geçen hafta · 'Sınırsız' sordu, yokmuş", "Maaş günü · 3 kova · 1.020 TL"].forEach((x) => ic.append(satir(x.split(" · ")[0], "🍗", x.split(" · ").slice(1).join(" · "))));
    },
    lol(ad, renk) {
      const { ic } = cerceve(ad, renk);
      const r = el("div", "tl-rozet-buyuk", "Rank: West Master 350 LP"); r.onclick = () => { sir("lol"); r.textContent = "Gerçek rank: Gümüş IV · 12 LP"; }; ic.append(r);
      [["Yuumi", "0/12/3", "Yenilgi · Exhaust kullanılmadı"], ["Yuumi", "1/9/20", "Yenilgi · 'Kulenin menzilinde değildim'"], ["Garen", "4/4/2", "Zafer · Takım taşıdı"], ["Yuumi", "0/15/1", "Yenilgi · AFK sanıldı"], ["Teemo", "2/11/0", "Yenilgi · Koreli çocuk"]].forEach(([s, k, d]) => ic.append(satir(s + " · " + k, d.startsWith("Zafer") ? "✅" : "❌", d)));
    },
    galeri(ad, renk) {
      const { ic } = cerceve(ad, renk);
      const g = el("div", "tl-galeri");
      [["🏍️", "85 km/s öncesi"], ["🤕", "85 km/s sonrası"], ["🌃", "İzmir, 2. gece"], ["🍗", "Popeyes (14)"], ["🎓", "KPSS 93 (QR)"], ["🚗", "Ehliyet ✅"], ["🏊", "Aquapark (hayal)"], ["📦", "Depo, son gün"], ["🍺", "Kerpe"]].forEach(([e, a]) => { const f = el("div", "tl-foto"); f.append(el("span", null, e), el("small", null, a)); g.append(f); });
      const gizli = el("div", "tl-foto tl-gizli-foto"); gizli.append(el("span", null, "🔒"), el("small", null, "Gizli albüm")); gizli.onclick = () => { sir("galeri"); gizli.textContent = ""; gizli.append(el("span", null, "🪨"), el("small", null, "Kayalardan önce")); };
      g.append(gizli); ic.append(g);
    },
    takvim(ad, renk) {
      const { ic } = cerceve(ad, renk);
      [["Bugün", "Ücretsiz izin (2. yıl)"], ["Cuma 22:00", "Halısaha (Salih gelcek mi?)"], ["Ehliyet sınavı", "✅ Geçti (Türk trafiği yasta)"], ["KPSS", "93 · çalışmadım"], ["Maaş günü", "—"], ["Kerpe", "5:15 otobüs (şakaymış)"]].forEach(([a, b]) => ic.append(satir(a, null, b)));
      const aq = satir("Sakarya Aquapark", "🔁", "Ertelendi ×7 · dokun"); let n = 7; aq.onclick = () => { n++; aq.querySelector("small").textContent = `Ertelendi ×${n}`; if (n >= 8) sir("aquapark"); }; ic.append(aq);
    },
    notlar(ad, renk) {
      const { ic } = cerceve(ad, renk);
      ic.append(el("p", "tl-baslik", "2026 Hedefleri"));
      ["✅ Ehliyet al", "✅ KPSS'den 93 (yöntem önemli değil)", "❌ Sakarya Aquapark", "❌ Motor al (vazgeçtim)", "⏳ 70k alıp kaçmak", "❌ Kask almak", "❌ Para biriktirmek (İbo'nun 1. maddesi)"].forEach((x) => ic.append(el("div", "tl-not", x)));
      const s = el("div", "tl-not tl-soluk", "🔒 Şifreler (dokun)"); s.onclick = () => { sir("sifre"); s.textContent = "Instagram: 0085 · Banka: 0085 · LoL: 0085 · Kilit: 0085"; }; ic.append(s);
    },
    muzik(ad, renk) {
      const { ic } = cerceve(ad, renk);
      const cal = el("div", "tl-calan"); cal.append(el("span", null, "🎤"), el("b", null, "Nakarat (Arabada Dinlemelik)"), el("small", null, "Cem & Yenge"), el("div", "tl-dalga"));
      ic.append(cal, el("p", "tl-baslik", "Çalma listeleri"));
      ["🏍️ Kasksız Sürüş", "🍺 Kerpe Yolu", "😴 Ücretsiz İzin Chill"].forEach((x) => ic.append(satir(x, "▶")));
      const g = satir("🔒 Gizli liste", "›", "Basılı tut ya da dokun", "tl-soluk"); g.onclick = () => { sir("sarki"); g.querySelector("b").textContent = "🎤 Kubi'ye Diss (Burger feat. Berkay)"; }; ic.append(g);
    },
    harita(ad, renk) {
      const { ic } = cerceve(ad, renk);
      ic.append(el("p", "tl-baslik", "Son aramalar"));
      [["İzmir Otogarı", "2 gece kalındı"], ["Popeyes", "Favori · 14 ziyaret"], ["Kerpe", "Kayalıklar ⚠️"], ["Gebze Depo", "04:50 servis"], ["Sakarya Aquapark", "Hiç gidilmedi"], ["En yakın kaskçı", "Aranıp vazgeçildi"]].forEach(([a, b]) => ic.append(satir("📍 " + a, null, b)));
    },
    ayarlar(ad, renk) {
      const { ic } = cerceve(ad, renk);
      [["Uçak modu", "Kapalı"], ["Ücretsiz izin modu", "AÇIK"], ["Kask hatırlatıcı", "KAPALI"], ["Pil", "%1 · Şarjım 1, kapanacak tel"], ["Ekran süresi", "LoL: 9 sa/gün"], ["Depolama", "Popeyes fişleri: 4 GB"]].forEach(([a, b]) => ic.append(satir(a, b)));
      const ver = satir("Yazılım sürümü", "85.0.85", "7 kez dokun"); let n = 0; ver.onclick = () => { if (++n >= 7) { sir("gelistirici"); ver.querySelector("small").textContent = "Geliştirici modu açıldı: kask hatırlatıcısı kalıcı olarak kapatılmış"; } }; ic.append(ver);
    },
  };
  function uygulama(id, ad, renk) { APP[id](ad, renk); }
  function sohbet(k) { if (k === "Babam") sir("babam"); sohbetGoster(k, SOHBET[k]); }
  function sohbetGoster(ad, mesajlar) {
    const { ic, geri } = cerceve(ad, "#075e54");
    geri.onclick = () => APP.whatsapp("WhatsApp", "#22c55e");
    ic.classList.add("tl-wp");
    mesajlar.forEach(([kim, m]) => { const b = el("div", "tl-mesaj" + (kim === "Ben" ? " tl-ben" : "")); if (kim !== "Ben" && ad.includes("Grubu")) b.append(el("small", null, kim)); b.append(el("p", null, m)); ic.append(b); });
    const yaz = el("div", "tl-yaz"); yaz.append(el("span", null, "Mesaj yaz… (Berkay'ın telefonu, yazamazsın)")); ic.append(yaz);
  }

  sirCiz(); kilitEkrani();
})();
