// ============================================================
// oyuncu.js — seviye (XP), günlük görevler ve haftalık lig için ortak arayüz parçaları.
// Kumarhane, profil ve borsa sayfalarında kullanılır. Veriler: kendi cüzdanım (Ekonomi.cuzdanim)
// ve sunucunun özeti (Ekonomi.ozet → lig, ligGecen). Görev listesi sunucuyla AYNI hesapla
// (HMAC-SHA256, anahtar "gorev", mesaj = gün) tarayıcıda bulunur; sunucuya istek atılmaz.
// ============================================================
(function () {
  "use strict";
  const para = (x, k = 0) => (Number.isFinite(x) ? x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k }) : "—");
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // Sunucudaki api/borsa.js ile aynı olmalı
  const seviye = (xp) => Math.floor(Math.sqrt(Math.max(0, xp || 0) / 50)) + 1;
  const seviyeXp = (sv) => 50 * (sv - 1) * (sv - 1);
  const UNVANLAR = [[30, "Berkay'ın Ta Kendisi", "🦄"], [20, "Efsane", "🌟"], [16, "Berkay'ın Bankeri", "🏦"], [12, "Kumarbaz", "🎰"], [8, "Borsa Kurdu", "🐺"], [5, "Tefeci", "💼"], [3, "Meraklı", "👀"], [1, "Çaylak", "🐣"]];
  const unvan = (sv) => { const u = UNVANLAR.find(([s]) => sv >= s); return { ad: u[1], ikon: u[2] }; };
  const carkBonus = (sv) => (sv >= 5 ? 1 : 0) + (sv >= 10 ? 1 : 0) + (sv >= 20 ? 1 : 0);
  const GOREVLER = [
    ["crash3x", "kumar", "Crash'te 3x ya da üstünde çek", 1, 40, "/kumarhane#crash"],
    ["crash5", "kumar", "5 tur Crash oyna", 5, 25, "/kumarhane#crash"],
    ["mines5", "kumar", "Mines'ta tek oyunda 5 kutu açıp çek", 1, 40, "/kumarhane#mines"],
    ["mines3", "kumar", "3 kez Mines oyna", 3, 25, "/kumarhane#mines"],
    ["plinko10", "kumar", "10 kez Plinko at", 10, 25, "/kumarhane#plinko"],
    ["plinko5x", "kumar", "Plinko'da 5x ya da üstü yakala", 1, 50, "/kumarhane#plinko"],
    ["bj3", "kumar", "Blackjack'te 3 el kazan", 3, 40, "/kumarhane#blackjack"],
    ["bj21", "kumar", "Blackjack yap (ilk iki kartta 21)", 1, 60, "/kumarhane#blackjack"],
    ["duelloKazan", "sosyal", "1 düello kazan", 1, 40, "/kumarhane#duello"],
    ["duelloOyna", "sosyal", "1 düello aç ya da kabul et", 1, 20, "/kumarhane#duello"],
    ["tahmin1", "sosyal", "Tahmin pazarında bahis yap", 1, 20, "/topluluk#tahmin"],
    ["cark1", "sosyal", "BERKAY çarkını çevir", 1, 15, "/cark"],
    ["oyun1", "sosyal", "Spor'daki oyunlardan birinde skor yap", 1, 20, "/spor"],
    ["islem5", "borsa", "Borsada 5 işlem yap", 5, 30, "/borsa"],
    ["kaldiracKar", "borsa", "Bir kaldıraç pozisyonunu kârla kapat", 1, 40, "/borsa"],
    ["coin2", "borsa", "BERKAY dışında bir coin al", 1, 25, "/borsa"],
  ].map(([id, grup, ad, hedef, odul, link]) => ({ id, grup, ad, hedef, odul, link }));
  const bugun = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  const gorevOnbellek = {};
  async function gunGorevleri(gun) {
    if (gorevOnbellek[gun]) return gorevOnbellek[gun];
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode("gorev"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(gun)));
    return (gorevOnbellek[gun] = ["kumar", "sosyal", "borsa"].map((g, i) => { const l = GOREVLER.filter((x) => x.grup === g); return l[h[i] % l.length]; }));
  }

  // ---- Seviye kartı ----
  function seviyeKarti(c) {
    const xp = (c && c.xp) || 0, sv = seviye(xp), u = unvan(sv);
    const alt = seviyeXp(sv), ust = seviyeXp(sv + 1), oran = Math.min(1, (xp - alt) / (ust - alt));
    const k = el("div", "oy-seviye");
    const rozet = el("div", "oy-sv"); rozet.append(el("small", null, "SEVİYE"), el("b", null, String(sv)));
    const orta = el("div", "oy-sv-orta");
    orta.append(el("b", null, `${u.ikon} ${u.ad}`));
    const bar = el("div", "oy-bar"); const dolu = el("i"); dolu.style.width = (oran * 100).toFixed(1) + "%"; bar.append(dolu);
    orta.append(bar, el("small", "muted", `${para(xp)} XP · sonraki seviyeye ${para(ust - xp)} XP` + (carkBonus(sv) ? ` · günde +${carkBonus(sv)} bedava çark` : "")));
    const sonraki = UNVANLAR.slice().reverse().find(([s]) => s > sv);
    if (sonraki) orta.append(el("small", "muted", `Seviye ${sonraki[0]}'de: ${sonraki[2]} ${sonraki[1]}`));
    k.append(rozet, orta);
    return k;
  }

  // ---- Günlük görevler ----
  async function gorevlerCiz(kutu, c, al) {
    const gun = bugun(), liste = await gunGorevleri(gun);
    const gv = c && c.gorev && c.gorev.g === gun ? c.gorev : { s: {}, al: [] };
    kutu.textContent = "";
    liste.forEach((g) => {
      const n = Math.min(g.hedef, (gv.s || {})[g.id] || 0), alindi = (gv.al || []).includes(g.id), tamam = n >= g.hedef;
      const r = el("div", "oy-gorev" + (alindi ? " alindi" : tamam ? " tamam" : ""));
      const sol = el("div", "oy-gorev-sol");
      const baslik = el("a", null, g.ad); baslik.href = g.link;
      const bar = el("div", "oy-bar ince"); const dolu = el("i"); dolu.style.width = (n / g.hedef) * 100 + "%"; bar.append(dolu);
      sol.append(baslik, bar, el("small", "muted", `${n}/${g.hedef} · ödül ${g.odul} BERKAY + 25 XP`));
      r.append(sol);
      if (alindi) r.append(el("span", "oy-gorev-tik", "✅"));
      else {
        const b = el("button", "admin-btn " + (tamam ? "publish" : ""), tamam ? "Ödülü al" : "Git"); b.type = "button";
        b.addEventListener("click", () => { if (!tamam) { location.href = g.link; return; } al(g, b); });
        r.append(b);
      }
      kutu.append(r);
    });
    const yarin = new Date(); yarin.setHours(24, 0, 0, 0);
    kutu.append(el("p", "muted oy-not", "Görevler her gün gece yarısı yenilenir."));
  }
  async function gorevAl(g, btn) {
    btn.disabled = true;
    try { const r = await Ekonomi.api("gorevAl", { id: g.id }); Ekonomi.toast(r.mesaj, 4000); }
    catch (err) { Ekonomi.toast("⚠️ " + err.message, 4000); btn.disabled = false; }
  }

  // ---- Haftalık lig ----
  function ligCiz(kutu, ozet, benimUid) {
    kutu.textContent = "";
    const lig = ozet && ozet.lig, gecen = ozet && ozet.ligGecen;
    if (gecen && gecen.kazananlar && gecen.kazananlar.length) {
      const s = el("div", "oy-sampiyon");
      const k = gecen.kazananlar[0];
      s.append(el("span", "oy-tac", "👑"), el("div", null), el("b", null, k.ad));
      s.children[1].append(el("small", null, "GEÇEN HAFTANIN ŞAMPİYONU"));
      s.append(el("small", "muted", `${para(k.xp)} XP · +${k.odul} BERKAY`));
      kutu.append(s);
    }
    const l = (lig && lig.liste) || [];
    if (!l.length) kutu.append(el("p", "muted", "Bu hafta henüz kimse XP kazanmadı. İlk sen başla!"));
    l.forEach((k, i) => {
      const r = el("div", "bx-satir" + (k.uid === benimUid ? " pf-vurgu" : ""));
      r.append(el("span", "rk-sira", ["🥇", "🥈", "🥉"][i] || String(i + 1)), window.Ekonomi ? Ekonomi.isim(k.ad) : el("span", null, k.ad), el("span", "bx-sag", para(k.xp) + " XP"));
      kutu.append(r);
    });
    // Pazartesi 00:00'a (İstanbul) kalan süre
    const simdi = Date.now() + 3 * 3600000, t = new Date(simdi), gun = (t.getUTCDay() + 6) % 7;
    const bitis = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - gun + 7) - simdi;
    const g = Math.floor(bitis / 86400000), sa = Math.floor((bitis % 86400000) / 3600000);
    kutu.append(el("p", "muted oy-not", `Hafta ${g ? g + " gün " : ""}${sa} saat sonra biter · ilk 3: 500 / 250 / 100 BERKAY · sıralama 10 dakikada bir güncellenir`));
  }

  // Seviye atlayınca kutlama (kendi cüzdanımda c.seviyeAtladi)
  function seviyeKutla(c) {
    if (!c || !c.seviyeAtladi) return;
    const k = "yaparmi_sv_goruldu";
    let gor = 0; try { gor = Number(localStorage.getItem(k)) || 0; } catch { /* yok */ }
    if (c.seviyeAtladi.t <= gor) return;
    try { localStorage.setItem(k, String(c.seviyeAtladi.t)); } catch { /* yok */ }
    if (Date.now() - c.seviyeAtladi.t > 600000) return; // eski
    const sv = c.seviyeAtladi.sv, u = unvan(sv);
    Ekonomi.toast(`🎉 Seviye ${sv}! ${u.ikon} ${u.ad}` + (carkBonus(sv) > carkBonus(sv - 1) ? " · +1 bedava çark hakkı" : ""), 6000);
  }

  window.Oyuncu = { seviye, unvan, seviyeXp, carkBonus, seviyeKarti, gorevlerCiz, gorevAl, ligCiz, seviyeKutla, gunGorevleri };
})();
