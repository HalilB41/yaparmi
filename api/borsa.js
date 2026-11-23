// ============================================================
// Vercel Serverless Function — /api/borsa
// BERKAY (BERKAY) borsası: fiyat, spot al/sat, kaldıraçlı pozisyon,
// Berkay Market ve admin işlemleri.
//
// Bakiyeler SADECE burada (sunucuda) değişir. Tarayıcı Firestore'a yazamaz
// (kurallarda borsa_* koleksiyonlarına write: false), bu yüzden kimse kendi
// bakiyesini elle artıramaz. Sunucu firebase-admin ile yazar.
//
// Gerekli Vercel ortam değişkeni:
//   FIREBASE_SERVICE_ACCOUNT  → Firebase Console > Proje ayarları > Hizmet
//   hesapları > "Yeni özel anahtar oluştur" ile inen JSON dosyasının TAMAMI.
//
// ---------------- Para birimleri ----------------
//   BERKAY → coin. Toplam arz 1.000.000. Dağıtılmayan kısım "kasa"da durur.
//   USDT     → nakit. BERKAY'ın fiyatı USDT cinsinden. Spot'ta BERKAY satınca USDT
//          gelir, USDT ile BERKAY alınır. Kaldıraçta teminat USDT'dir.
//
// ---------------- Fiyat nasıl oluşur? ----------------
//   Her alım fiyatı yükseltir, her satış düşürür:  fiyat × e^(±USDT / derinlik)
//   Kaldıraçlı pozisyon açmak/kapatmak da aynı eğriden geçer (long = alım,
//   short = satış), yani kaldıraçla girenler de fiyatı oynatır. Pozisyonun
//   K/Z'si "şimdi kapatsan ne alırsın"dır (kapatmak da fiyatı geri iter).
//   Eğri yola bağlı olmadığı için "pompala-sat" ile bedava para basılamaz.
//   Her 10 saniyede küçük bir rastgele oynaklık var (admin 0 yapabilir).
//   Admin grafiğe çizgi çizerse fiyat o çizgiyi izler.
//
// ---------------- Piyasa yapıcı (MM) ----------------
//   Admin açarsa dakikada bir kasa adına alım/satım yapar (aynı eğriden):
//     denge → fiyat [hedef×(1−bant), hedef×(1+bant)] dışına çıkarsa hedefe doğru,
//             dakikada en fazla "dakikalık" USDT kadar alır/satar
//     al / sat → her dakika "dakikalık" USDT kadar alır / satar
//   MM'nin parası kasadır: kullanıcı bakiyelerine ve toplam arza dokunmaz.
//   Ne kadar alıp sattığı borsa/gizli.mm içinde tutulur (sadece admin görür).
//
// ---------------- Firestore ----------------
//   borsa/durum         herkese açık: fiyat, son mumlar, açık pozisyonlar, akış, ayarlar
//   borsa/gizli         sadece admin: çizilen rota (gelecekteki fiyat — kullanıcı görmesin)
//   borsa_cuzdan/{uid}  kişinin bakiyesi (kendisi + admin okur)
//   borsa_grafik/{gün}  eski 1 dakikalık mumlar { m: [{t,o,h,l,c,v}] }
//   borsa_gecmis/{id}   kapanan/likide olan pozisyonlar (kendisi + admin okur)
//   borsa_market/{id}   ürünler (herkes okur)
//   borsa_siparis/{id}  market siparişleri (kendisi + admin okur)
//   borsa_log/{id}      her para hareketi (sadece admin okur)
//   borsa/ekonomi       ödül ayarları: günlük giriş, oyun rekoru, BERKAY çarkı (herkes okur)
//   tahmin/{id}         tahmin pazarı iddiaları (herkes okur)
//   tahmin_bahis/{id}   kim neye ne yatırdı (giriş yapan okur)
//
// ---------------- Ekonomi (coin nereden gelir, nereye gider) ----------------
//   Bütün ödüller KASADAN gelir, bütün ücretler/bahisler KASAYA gider: toplam arz hep korunur.
//   Günlük giriş: her İstanbul gününde 1 kez; seri (üst üste gün) her N. günde bonus.
//   Oyun ödülü: oyun başına sunucudaki kişisel rekor kırılınca; günlük oyun başına sınır var.
//   BERKAY çarkı: dilimleri ve ağırlıkları admin belirler, sonucu SUNUCU seçer.
//   Tahmin: yatırılan BERKAY kasaya girer; sonuçlanınca havuz kazananlara yatırdıkları oranda
//           dağıtılır (kimse bilemediyse herkese iade). İptalde herkese iade.
// ============================================================

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomUUID, createHmac, randomInt } from "node:crypto";

const BASLANGIC_ARZ = 1_000_000;
const KAYIT_BONUSU = 200; // BERKAY
const BASLANGIC_FIYAT = 1; // 1 BERKAY = 1 USDT
const ADIM_MS = 10_000; // fiyat her 10 saniyede bir adım atar
// Firestore kotası (ücretsiz plan: günde 50.000 okuma / 20.000 yazma) için tick seyrek yazılır.
// Aradaki 10 sn'lik adımlar yine hesaplanır, sadece belgeye daha seyrek toplu yazılır.
const TICK_TEK_MS = 30_000; // açık olan coin en fazla 30 sn'de bir
const TICK_LISTE_MS = 300_000; // listedeki diğer coinler en fazla 5 dk'da bir
const MUM_MS = 60_000; // 1 dakikalık mumlar
const SON_MUM = 240; // durum belgesinde tutulan son mum sayısı (4 saat)
const MAX_GERI_MS = 6 * 3600_000; // kimse yokken en fazla 6 saati geriye dönük hesapla
const LIK_ORAN = 0.9; // teminatın %90'ı erirse likidasyon
const MAX_ACIK_POZ = 5; // kişi başı aynı anda açık pozisyon
const MAX_KALDIRAC = 20;
const MAX_POZ_ORAN = 0.5; // tek pozisyon en fazla derinliğin yarısı kadar büyüklükte (fiyatı en fazla ~%65 iter)
const AKIS_SAY = 25;

// ---------------- Coinler ----------------
// BERKAY sitenin ana parası (ödüller, market, çark hep BERKAY). Diğerleri aynı mantıkla çalışan
// ayrı piyasalar: her birinin kendi fiyatı, grafiği, arzı, kaldıraç pozisyonları ve MM'si var.
// Admin yenisini ekleyebilir (borsa/coinler belgesi). Cüzdanda BERKAY = c.bkc, diğerleri = c.coin[SYM].
const VARSAYILAN_COINLER = [
  { sym: "BERKAY", ad: "BerkayCoin", emoji: "B", renk: "#f5b82e", fiyat: 1, derinlik: 10_000, sira: 0 },
  { sym: "KURBAN", ad: "Kurban", emoji: "🐑", renk: "#d9480f", fiyat: 0.5, derinlik: 10_000, sira: 1 },
  { sym: "BURGER", ad: "Burger", emoji: "🍔", renk: "#f59f00", fiyat: 2, derinlik: 10_000, sira: 2 },
  { sym: "ALIHAN", ad: "Alihan", emoji: "☕", renk: "#8d5524", fiyat: 1, derinlik: 10_000, sira: 3 },
  { sym: "HALIL", ad: "Halil", emoji: "👑", renk: "#7048e8", fiyat: 3, derinlik: 10_000, sira: 4 },
  // gercek: fiyat ve mumlar gerçek piyasadan (Binance, olmazsa Coinbase) gelir; alım-satım fiyatı itmez
  { sym: "BTC", ad: "Bitcoin", emoji: "₿", renk: "#f7931a", fiyat: 1000, derinlik: 200_000, sira: 5, arz: 21_000_000, gercek: { binance: "BTCUSDT", coinbase: "BTC-USD" } },
  { sym: "ETH", ad: "Ethereum", emoji: "Ξ", renk: "#627eea", fiyat: 100, derinlik: 100_000, sira: 6, arz: 120_000_000, gercek: { binance: "ETHUSDT", coinbase: "ETH-USD" } },
  { sym: "SOL", ad: "Solana", emoji: "◎", renk: "#14b88a", fiyat: 10, derinlik: 50_000, sira: 7, arz: 600_000_000, gercek: { binance: "SOLUSDT", coinbase: "SOL-USD" } },
];
// ---------------- Gerçek piyasa fiyatı ----------------
const DIS_ZAMAN_ASIMI = 3500;
async function disJson(url) {
  const ac = new AbortController();
  const z = setTimeout(() => ac.abort(), DIS_ZAMAN_ASIMI);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(z); }
}
// Gerçek 1 dakikalık mumlar [{t,o,h,l,c}] (eskiden yeniye). Son mum o anki dakika (fiyat = son c).
async function gercekMumlar(g, baslangic, now) {
  const adet = Math.min(1000, Math.max(2, Math.ceil((now - baslangic) / MUM_MS) + 1));
  try {
    const j = await disJson(`https://data-api.binance.vision/api/v3/klines?symbol=${g.binance}&interval=1m&limit=${adet}`);
    const l = j.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).filter((m) => m.c > 0);
    if (l.length) return l;
  } catch { /* Coinbase'e geç */ }
  const bas = Math.max(baslangic, now - 299 * MUM_MS);
  const j = await disJson(`https://api.exchange.coinbase.com/products/${g.coinbase}/candles?granularity=60&start=${new Date(bas).toISOString()}&end=${new Date(now).toISOString()}`);
  return j.map((k) => ({ t: k[0] * 1000, l: +k[1], h: +k[2], o: +k[3], c: +k[4] })).filter((m) => m.c > 0).sort((a, b) => a.t - b.t);
}
const ANA = "BERKAY";
function coinListesi(snap) {
  const kayitli = snap && snap.exists && Array.isArray(snap.data().liste) ? snap.data().liste : [];
  const m = new Map(VARSAYILAN_COINLER.map((c) => [c.sym, { ...c }]));
  for (const c of kayitli) if (c && c.sym) m.set(c.sym, Object.assign(m.get(c.sym) || {}, c));
  return [...m.values()].filter((c) => !c.silindi).sort((a, b) => (a.sira ?? 99) - (b.sira ?? 99));
}
function symTemiz(x) { return String(x || ANA).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || ANA; }
const durumId = (sym) => (sym === ANA ? "durum" : "durum_" + sym);
const gizliId = (sym) => (sym === ANA ? "gizli" : "gizli_" + sym);
const grafikId = (sym, gun) => (sym === ANA ? gun : sym + "_" + gun);
// Cüzdandaki coin bakiyesi
function bakiye(c, sym) { return sym === ANA ? c.bkc || 0 : (c.coin && c.coin[sym]) || 0; }
function bakiyeYaz(c, sym, v) {
  if (sym === ANA) c.bkc = r6(v);
  else { c.coin = Object.assign({}, c.coin || {}); c.coin[sym] = r6(v); if (c.coin[sym] <= 1e-9) delete c.coin[sym]; }
}

class Hata extends Error {
  constructor(mesaj, kod = 400) { super(mesaj); this.kod = kod; }
}

// ---------------- Firebase ----------------
function firebase() {
  if (!getApps().length) {
    const ham = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!ham) throw new Hata("Borsa sunucusu henüz ayarlanmamış (FIREBASE_SERVICE_ACCOUNT eksik).", 503);
    let sa;
    try {
      sa = JSON.parse(ham.trim().startsWith("{") ? ham : Buffer.from(ham, "base64").toString("utf8"));
    } catch {
      throw new Hata("FIREBASE_SERVICE_ACCOUNT okunamadı (JSON'un tamamını yapıştır).", 503);
    }
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    initializeApp({ credential: cert(sa) });
  }
  return { db: getFirestore(), auth: getAuth() };
}

// ---------------- Küçük yardımcılar ----------------
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const r2 = (x) => Math.round(x * 100) / 100;
const sayi = (x) => (typeof x === "number" && Number.isFinite(x) ? x : Number(x));
function gunAnahtari(t) { return new Date(t + 3 * 3600_000).toISOString().slice(0, 10); } // İstanbul günü
function normal() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------- Fiyat eğrisi ----------------
// N USDT harcayıp BERKAY almak: gelen BERKAY ve yeni fiyat
function egriAl(p, N, D) { return { q: (D / p) * (1 - Math.exp(-N / D)), p1: p * Math.exp(N / D) }; }
// q BERKAY satmak: gelen USDT ve yeni fiyat
function egriSat(p, q, D) { const x = (q * p) / D; return { N: D * Math.log1p(x), p1: p / (1 + x) }; }
// N USDT'lik short açmak: satılan (ödünç) BERKAY ve yeni fiyat
function egriShortAc(p, N, D) { return { q: (D / p) * Math.expm1(N / D), p1: p * Math.exp(-N / D) }; }
// q BERKAY'ı geri almak (short kapatma): ödenen USDT ve yeni fiyat
function egriGeriAl(p, q, D) { const x = Math.min((q * p) / D, 0.98); return { N: -D * Math.log1p(-x), p1: p / (1 - x) }; }

// Pozisyon şu an kapatılsa kâr/zarar (USDT) — kapanışın fiyatı itmesini de hesaba katar
function pozPnl(poz, p, D) {
  if (poz.v === 2) return poz.yon === "long" ? poz.boyut * (p - poz.giris) : poz.boyut * (poz.giris - p);
  if (poz.yon === "long") return egriSat(p, poz.boyut, D).N - poz.notional;
  return poz.notional - egriGeriAl(p, poz.boyut, D).N;
}
function likFiyati(poz, D) {
  const M = poz.teminat, N = poz.notional, q = poz.boyut;
  if (poz.yon === "long") return Math.max(0, (D * Math.expm1((N - LIK_ORAN * M) / D)) / q);
  return (D * (1 - Math.exp(-(N + LIK_ORAN * M) / D))) / q;
}

// ---------------- Durum ----------------
function yeniDurum(now, def) {
  const f = def && def.fiyat > 0 ? def.fiyat : BASLANGIC_FIYAT;
  return {
    sym: def ? def.sym : ANA,
    fiyat: f,
    toplamArz: def && def.arz > 0 ? def.arz : BASLANGIC_ARZ,
    kasaBKC: def && def.arz > 0 ? def.arz : BASLANGIC_ARZ,
    derinlik: def && def.derinlik > 0 ? def.derinlik : 10_000,
    oynaklik: 0.003,
    maxKaldirac: MAX_KALDIRAC,
    acik: true,
    sonTick: now,
    son: [{ t: Math.floor(now / MUM_MS) * MUM_MS, o: f, h: f, l: f, c: f, v: 0 }],
    saat: [],
    poz: {},
    akis: [],
    rotaVar: false,
    kurulus: now,
  };
}
const BASLANGIC_URUNLER = [
  { id: "alihan-kahve", ad: "Alihan'ın kahvesi (1 aylık)", aciklama: "Bir ay boyunca Alihan'ın kahvesi senden yana.", emoji: "☕", fiyat: 2500, stok: -1, aktif: true, sira: 1 },
  { id: "kola", ad: "Coca-Cola", aciklama: "Buz gibi bir kutu kola.", emoji: "🥤", fiyat: 300, stok: -1, aktif: true, sira: 2 },
];

const EKONOMI_VARSAYILAN = {
  acik: true,
  gunlukMiktar: 10, seriGun: 7, seriBonus: 50,
  rekorOdul: 15, oyunGunlukLimit: 30,
  carkUcret: 10, carkGunlukBedava: 1,
  carkDilimler: [
    { ad: "+5", miktar: 5, agirlik: 30 },
    { ad: "+20", miktar: 20, agirlik: 20 },
    { ad: "−10", miktar: -10, agirlik: 18 },
    { ad: "+50", miktar: 50, agirlik: 8 },
    { ad: "Boş", miktar: 0, agirlik: 15 },
    { ad: "−25", miktar: -25, agirlik: 5 },
    { ad: "+200 💎", miktar: 200, agirlik: 1 },
  ], // ortalama getiri ≈ 8,5 BERKAY < 10 ücret: uzun vadede kasa kazanır, çark para basmaz
};
// Oyun ödülü: bilinen oyunlar ve inandırıcı en yüksek skor (üstü kırpılır)
const OYUN_UST = { boks: 999, penalti: 1000, motor: 1500, g2048: 131072, yilan: 2000 };
const DIJITAL_URUNLER = [
  { id: "renk-altin", ad: "Altın isim", aciklama: "Adın her yerde altın sarısı görünür.", emoji: "🟡", fiyat: 500, stok: -1, aktif: true, sira: 20, tur: "renk", deger: "#e0a100", sureGun: 0 },
  { id: "renk-mor", ad: "Mor isim", aciklama: "Adın mor görünür.", emoji: "🟣", fiyat: 300, stok: -1, aktif: true, sira: 21, tur: "renk", deger: "#7c4dff", sureGun: 0 },
  { id: "renk-pembe", ad: "Pembe isim", aciklama: "Adın pembe görünür.", emoji: "🩷", fiyat: 300, stok: -1, aktif: true, sira: 22, tur: "renk", deger: "#e0457b", sureGun: 0 },
  { id: "rozet-tac", ad: "Taç rozeti", aciklama: "Adının yanında 👑.", emoji: "👑", fiyat: 800, stok: -1, aktif: true, sira: 23, tur: "rozet", deger: "👑", sureGun: 0 },
  { id: "rozet-balina", ad: "Balina rozeti", aciklama: "Adının yanında 🐳.", emoji: "🐳", fiyat: 1000, stok: -1, aktif: true, sira: 24, tur: "rozet", deger: "🐳", sureGun: 0 },
  { id: "rozet-kurukafa", ad: "Likide rozeti", aciklama: "Gururla 💀.", emoji: "💀", fiyat: 150, stok: -1, aktif: true, sira: 25, tur: "rozet", deger: "💀", sureGun: 0 },
  { id: "unvan-ozel", ad: "Özel unvan (7 gün)", aciklama: "Adının altında istediğin unvan yazar (en fazla 24 harf).", emoji: "🏷️", fiyat: 1200, stok: -1, aktif: true, sira: 26, tur: "unvan", deger: "", sureGun: 7 },
];
function ekonomiAyar(snap) {
  const e = Object.assign({}, EKONOMI_VARSAYILAN, snap && snap.exists ? snap.data() : {});
  e.carkDilimler = (Array.isArray(e.carkDilimler) ? e.carkDilimler : []).filter((x) => x && x.agirlik > 0).slice(0, 16);
  return e;
}
function oncekiGun(gun) { return new Date(Date.parse(gun + "T12:00:00Z") - 86400_000).toISOString().slice(0, 10); }
// Cüzdan yoksa kayıt bonusuyla oluştur (borsaya hiç girmemiş biri günlük ödül alırken vb.)
function cuzdanOlustur(kim, d, now, k) {
  const bonus = Math.min(KAYIT_BONUSU, d.kasaBKC);
  d.kasaBKC = r6(d.kasaBKC - bonus);
  k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "bonus", detay: `Kayıt bonusu: ${bonus} BERKAY`, bkc: bonus, btl: 0 });
  return { uid: kim.uid, ad: kim.ad, bkc: bonus, btl: 0, bonus, gerceklesen: 0, olusturma: now, sonIslem: 0 };
}
// Kasadan kullanıcıya (miktar > 0) ya da kullanıcıdan kasaya (miktar < 0) BERKAY
function kasaTransfer(d, c, miktar) {
  if (miktar > 0) { const m = Math.min(miktar, d.kasaBKC); d.kasaBKC = r6(d.kasaBKC - m); c.bkc = r6((c.bkc || 0) + m); return m; }
  if (miktar < 0) { const m = Math.min(-miktar, c.bkc || 0); c.bkc = r6((c.bkc || 0) - m); d.kasaBKC = r6(d.kasaBKC + m); return -m; }
  return 0;
}

// Bir pazar işlemi (spot ya da kaldıraç) sonrası mumu güncelle
function mumYaz(d, t, p, hacim, tasanlar) {
  const kova = Math.floor(t / MUM_MS) * MUM_MS;
  const son = d.son;
  const sonMum = son[son.length - 1];
  if (sonMum && sonMum.t === kova) {
    sonMum.h = r6(Math.max(sonMum.h, p));
    sonMum.l = r6(Math.min(sonMum.l, p));
    sonMum.c = r6(p);
    sonMum.v = r2((sonMum.v || 0) + hacim);
  } else if (!sonMum || kova > sonMum.t) {
    const o = sonMum ? sonMum.c : p;
    son.push({ t: kova, o: r6(o), h: r6(Math.max(o, p)), l: r6(Math.min(o, p)), c: r6(p), v: r2(hacim) });
  }
  if (son.length > SON_MUM) tasanlar.push(...son.splice(0, son.length - SON_MUM));
  saatYaz(d, t, p, hacim);
}
// Saatlik özet (son 25 saat): coin listesindeki 24s değişim / hacim için
function saatYaz(d, t, p, hacim) {
  const saat = (d.saat ||= []);
  const sk = Math.floor(t / 3600_000) * 3600_000;
  const ss = saat[saat.length - 1];
  if (ss && ss.t === sk) { ss.c = r6(p); ss.h = r6(Math.max(ss.h, p)); ss.l = r6(Math.min(ss.l, p)); ss.v = r2((ss.v || 0) + hacim); }
  else if (!ss || sk > ss.t) { const o = ss ? ss.c : p; saat.push({ t: sk, o: r6(o), h: r6(Math.max(o, p)), l: r6(Math.min(o, p)), c: r6(p), v: r2(hacim) }); }
  if (saat.length > 25) saat.splice(0, saat.length - 25);
}

// Gerçek piyasadan gelen hazır mumu yaz (aynı dakikada sitedeki işlem hacmi korunur)
function mumKoy(d, m, tasanlar) {
  const son = d.son;
  const sonMum = son[son.length - 1];
  if (sonMum && sonMum.t === m.t) {
    sonMum.o = r6(m.o); sonMum.h = r6(Math.max(m.h, m.c)); sonMum.l = r6(Math.min(m.l, m.c)); sonMum.c = r6(m.c);
  } else if (!sonMum || m.t > sonMum.t) {
    son.push({ t: m.t, o: r6(m.o), h: r6(m.h), l: r6(m.l), c: r6(m.c), v: 0 });
  } else return;
  if (son.length > SON_MUM) tasanlar.push(...son.splice(0, son.length - SON_MUM));
  saatYaz(d, m.t, m.l, 0); saatYaz(d, m.t, m.h, 0); saatYaz(d, m.t, m.c, 0);
}

function akisEkle(d, kayit) {
  d.akis.unshift(kayit);
  if (d.akis.length > AKIS_SAY) d.akis.length = AKIS_SAY;
}

// Çizilen rotadan t anındaki hedef fiyat
function rotaHedef(rota, t) {
  if (!rota || !Array.isArray(rota.noktalar) || rota.noktalar.length < 2) return null;
  const n = rota.noktalar;
  if (t < n[0].t || t > n[n.length - 1].t) return null;
  for (let i = 1; i < n.length; i++) {
    if (t <= n[i].t) {
      const a = n[i - 1], b = n[i];
      const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return Math.exp(Math.log(a.p) + (Math.log(b.p) - Math.log(a.p)) * k);
    }
  }
  return null;
}

// Likidasyon kontrolü: teminatın %90'ı eriyen pozisyon zorla kapatılır (fiyatı da iter → zincirleme)
function likidasyonlar(d, t, kapananlar) {
  for (let tur = 0; tur < 60; tur++) {
    let bulundu = null;
    for (const poz of Object.values(d.poz)) {
      if (pozPnl(poz, d.fiyat, d.derinlik) <= -LIK_ORAN * poz.teminat + 1e-9) { bulundu = poz; break; }
    }
    if (!bulundu) return;
    pozKapatIc(d, bulundu, t, "likide", kapananlar);
  }
}

// Pozisyonu eğri üzerinden kapat (fiyatı iter); kullanıcıya dönecek USDT'yi döndürür
function pozKapatIc(d, poz, t, sebep, kapananlar) {
  const D = d.derinlik;
  const p0 = d.fiyat;
  let pnl, p1, cikis;
  if (poz.v === 2) { pnl = pozPnl(poz, p0, D); p1 = p0; cikis = p0; } // ara sürümden kalan pozisyon: fiyatı itmeden kapanır
  else if (poz.yon === "long") { const r = egriSat(p0, poz.boyut, D); pnl = r.N - poz.notional; p1 = r.p1; cikis = r.N / poz.boyut; }
  else { const r = egriGeriAl(p0, poz.boyut, D); pnl = poz.notional - r.N; p1 = r.p1; cikis = r.N / poz.boyut; }
  if (sebep === "likide") {
    // Fiyat bir anda likidasyon noktasını çok aştıysa (büyük alım, admin fiyatı, rota),
    // zorla kapanış fiyatı en fazla "tam likidasyon noktasında kapansaydı" kadar iter.
    // Yoksa derin zarardaki short'un geri alımı fiyatı tek seferde onlarca kat fırlatabiliyordu.
    const sinir = poz.yon === "long" ? Math.exp(-(poz.notional - LIK_ORAN * poz.teminat) / D) : Math.exp((poz.notional + LIK_ORAN * poz.teminat) / D);
    const etki = p1 / p0;
    if (poz.yon === "short" && etki > sinir) p1 = p0 * sinir;
    if (poz.yon === "long" && etki < sinir) p1 = p0 * sinir;
  }
  const iade = sebep === "likide" ? 0 : Math.max(0, poz.teminat + pnl);
  const gercekPnl = iade - poz.teminat;
  d.fiyat = Math.max(1e-6, p1);
  mumYaz(d, t, d.fiyat, Math.abs(poz.notional + pnl), kapananlar.tasanlar);
  delete d.poz[poz.id];
  akisEkle(d, { t, ad: poz.ad, tur: sebep === "likide" ? "lik" : "kapat", yon: poz.yon, x: poz.kaldirac, m: r2(poz.notional), f: r6(d.fiyat) });
  const kayit = {
    id: poz.id, uid: poz.uid, coin: d.sym || ANA, ad: poz.ad, yon: poz.yon, kaldirac: poz.kaldirac, teminat: r2(poz.teminat),
    notional: r2(poz.notional), boyut: r6(poz.boyut), giris: r6(poz.giris), cikis: r6(cikis),
    pnl: r2(gercekPnl), yuzde: r2((gercekPnl / poz.teminat) * 100), iade: r2(iade),
    acilis: poz.acilis, kapanis: t, sebep,
  };
  kapananlar.liste.push(kayit);
  return kayit;
}

// Piyasa yapıcı: dakikada bir işlem. Döndürdüğü USDT: + alım, − satım
function mmAdim(d, mm) {
  if (!mm || !mm.acik) return 0;
  const D = d.derinlik, p = d.fiyat, max = Math.max(0, sayi(mm.dakikalik) || 0);
  if (!max) return 0;
  let N = 0;
  if (mm.mod === "al") N = max;
  else if (mm.mod === "sat") N = -max;
  else {
    let h = sayi(mm.hedef);
    if (mm.mod === "serbest") {
      // Serbest: sabit hedef yok. Referans = fiyatın kayan ortalaması (son ~N dakika, log ölçekte).
      // Fiyat istediği yöne gidebilir, ortalama da arkasından gelir; MM sadece ani iğneleri törpüler.
      const sure = Math.max(5, Math.min(1440, sayi(mm.sure) || 60));
      if (!(mm.ort > 0)) mm.ort = p;
      mm.ort = r6(Math.exp(Math.log(mm.ort) + (Math.log(p) - Math.log(mm.ort)) / sure));
      h = mm.ort;
    }
    const bant = Math.max(0, sayi(mm.bant) || 0) / 100;
    if (!(h > 0)) return 0;
    // Bant dışına çıkınca hedefe doğru YUMUŞAK döner: her dakika aradaki farkın (log ölçekte) en fazla
    // yarısını kapatır ve asla hedefi geçmez. Tek dakikada tavandan dibe ya da dipten tavana zıplamaz.
    if (p < h * (1 - bant)) N = Math.min(max, 0.5 * D * Math.log(h / p));
    else if (p > h * (1 + bant)) N = -Math.min(max, 0.5 * D * Math.log(p / h));
  }
  if (Math.abs(N) < 1e-6) return 0;
  if (N > 0) d.fiyat = egriAl(p, N, D).p1;
  else { const q = (D / p) * Math.expm1(-N / D); d.fiyat = Math.max(1e-6, egriSat(p, q, D).p1); }
  return N;
}

// Zamanı "şimdi"ye kadar ilerlet: oynaklık + rota + likidasyonlar
function ilerlet(d, gizli, now, kapananlar) {
  if (d.gercek) {
    // Gerçek coin: fiyat dışarıdan. Alınamadıysa hiçbir şey ilerlemez (sonTick aynı kalır).
    const mumlar = kapananlar.dis;
    if (!mumlar) return;
    const sonT = d.son.length ? d.son[d.son.length - 1].t : 0;
    for (const m of mumlar) {
      if (m.t < sonT) continue;
      if (Object.keys(d.poz).length) for (const p of [m.l, m.h]) { d.fiyat = p; likidasyonlar(d, m.t, kapananlar); }
      d.fiyat = m.c;
      mumKoy(d, m, kapananlar.tasanlar);
    }
    // Saat farkı yüzünden son mum atlansa bile güncel fiyat her zaman uygulanır
    const sonFiyat = mumlar[mumlar.length - 1].c;
    if (Math.abs(d.fiyat - sonFiyat) > 1e-12 || Object.keys(d.poz).length) {
      d.fiyat = sonFiyat;
      mumYaz(d, now, d.fiyat, 0, kapananlar.tasanlar);
      likidasyonlar(d, now, kapananlar);
    }
    d.sonTick = now;
    d.disZaman = now;
    return;
  }
  if (!d.acik) { d.sonTick = now; return; }
  if (now - d.sonTick > MAX_GERI_MS) d.sonTick = now - MAX_GERI_MS;
  const adim = Math.floor((now - d.sonTick) / ADIM_MS);
  for (let i = 1; i <= adim; i++) {
    const t = d.sonTick + i * ADIM_MS;
    const hedef = rotaHedef(gizli && gizli.rota, t);
    let p = d.fiyat;
    if (hedef) {
      p = p * Math.pow(hedef / p, 0.6) * Math.exp((d.oynaklik || 0) * 0.25 * normal());
    } else if (d.oynaklik > 0) {
      p = p * Math.exp(d.oynaklik * normal());
    }
    d.fiyat = Math.min(1e9, Math.max(1e-6, p));
    let hacim = 0;
    if (gizli && gizli.mm && gizli.mm.acik && Math.floor(t / MUM_MS) !== Math.floor((t - ADIM_MS) / MUM_MS)) {
      const N = mmAdim(d, gizli.mm);
      if (gizli.mm.mod === "serbest") kapananlar.gizliDegisti = true; // ortalama her dakika güncellenir
      if (N) {
        hacim = Math.abs(N);
        const st = gizli.mm;
        if (N > 0) st.alinan = r2((st.alinan || 0) + N); else st.satilan = r2((st.satilan || 0) - N);
        st.sonIslem = { t, N: r2(N), f: r6(d.fiyat) };
        kapananlar.gizliDegisti = true;
      }
    }
    mumYaz(d, t, d.fiyat, hacim, kapananlar.tasanlar);
    likidasyonlar(d, t, kapananlar);
  }
  d.sonTick += adim * ADIM_MS;
  if (gizli && gizli.rota && gizli.rota.noktalar && gizli.rota.noktalar.length) {
    const sonT = gizli.rota.noktalar[gizli.rota.noktalar.length - 1].t;
    if (now > sonT) { gizli.rota = null; kapananlar.gizliDegisti = true; }
  }
  d.rotaVar = !!(gizli && gizli.rota);
}

// Sahte fiyatla açılmış BTC/ETH/SOL'u gerçek fiyata geçir (bir kez):
// eldeki coinler ESKİ fiyattan USDT'ye çevrilir, açık pozisyonlar eski fiyattan kapatılıp iade edilir,
// grafik silinip gerçek mumlarla baştan kurulur. Böylece kimse 20 USDT'ye aldığı "BTC" ile zengin olmaz.
async function gercegeGec(db, sym, def, dis, now) {
  const durumRef = db.collection("borsa").doc(durumId(sym));
  await db.runTransaction(async (tx) => {
    const dSnap = await tx.get(durumRef);
    if (!dSnap.exists || dSnap.data().gercek) return;
    const cs = await tx.get(db.collection("borsa_cuzdan"));
    const d = dSnap.data(); d.poz = d.poz || {};
    const p0 = d.fiyat, D = d.derinlik;
    const cuz = {};
    cs.docs.forEach((x) => { cuz[x.id] = x.data(); });
    const loglar = [], gecmis = [];
    for (const [uid, c] of Object.entries(cuz)) {
      const m = bakiye(c, sym);
      if (m > 1e-12) {
        const tl = r6(m * p0);
        bakiyeYaz(c, sym, 0); c.btl = r6((c.btl || 0) + tl);
        loglar.push({ uid, ad: c.ad, tur: "admin", detay: `${sym} gerçek fiyata geçti: ${r6(m)} ${sym} eski fiyattan (${r6(p0)}) ${r2(tl)} USDT'ye çevrildi`, bkc: 0, btl: tl });
        c._degisti = true;
      }
    }
    for (const poz of Object.values(d.poz)) {
      const iade = r2(Math.max(0, poz.teminat + pozPnl(poz, p0, D)));
      const c = cuz[poz.uid];
      if (c) { c.btl = r6((c.btl || 0) + iade); c._degisti = true; }
      gecmis.push({ id: poz.id, uid: poz.uid, ad: poz.ad, coin: sym, yon: poz.yon, kaldirac: poz.kaldirac, teminat: r2(poz.teminat), notional: r2(poz.notional), boyut: r6(poz.boyut), giris: r6(poz.giris), cikis: r6(p0), pnl: r2(iade - poz.teminat), yuzde: r2(((iade - poz.teminat) / poz.teminat) * 100), iade, acilis: poz.acilis, kapanis: now, sebep: "yenileme" });
    }
    const yeni = yeniDurum(now, def);
    Object.assign(yeni, { sym, gercek: true, son: [], saat: [], sonTick: now, sifirlama: now, acik: d.acik !== false, maxKaldirac: d.maxKaldirac || MAX_KALDIRAC, derinlik: d.derinlik || def.derinlik });
    const tasan = [];
    for (const m of dis) { yeni.fiyat = m.c; mumKoy(yeni, m, tasan); }
    for (const [uid, c] of Object.entries(cuz)) if (c._degisti) { delete c._degisti; tx.set(db.collection("borsa_cuzdan").doc(uid), c); }
    for (const g of gecmis) tx.set(db.collection("borsa_gecmis").doc(g.id), g);
    tx.set(durumRef, yeni);
    tx.set(db.collection("borsa").doc(gizliId(sym)), { rota: null, mm: null });
    for (const l of loglar) tx.set(db.collection("borsa_log").doc(), { coin: sym, ...l, ms: now, tarih: FieldValue.serverTimestamp() });
  });
  await grafikGunleriniSil(db, sym).catch(() => {});
}

// ---------------- İşlem çatısı ----------------
// Her işlem bir Firestore transaction içinde: önce okumalar, sonra hesap, sonra yazmalar.
async function islem(db, now, ekOkumalar, hesapla, sym = ANA, def = null) {
  const durumRef = db.collection("borsa").doc(durumId(sym));
  const gizliRef = db.collection("borsa").doc(gizliId(sym));
  def = def || VARSAYILAN_COINLER.find((c) => c.sym === sym) || null;
  let dis = null;
  if (def && def.gercek) {
    // Gerçek coin: işlemden önce piyasadan son mumları çek (transaction içinde dış istek yapılmaz)
    const on = await durumRef.get();
    const sonTick = on.exists ? on.data().sonTick || 0 : 0;
    const baslangic = on.exists && on.data().gercek ? Math.max(sonTick - MUM_MS, now - SON_MUM * MUM_MS) : now - SON_MUM * MUM_MS;
    try { dis = await gercekMumlar(def.gercek, baslangic, now); if (!dis.length) dis = null; } catch { dis = null; }
    if (on.exists && !on.data().gercek && dis) await gercegeGec(db, sym, def, dis, now);
  }
  return db.runTransaction(async (tx) => {
    const kumarRef = db.collection("borsa").doc("kumar");
    const [dSnap, gSnap, kumarSnap] = await Promise.all([tx.get(durumRef), tx.get(gizliRef), sym === ANA ? tx.get(kumarRef) : Promise.resolve(null)]);
    const ek = {};
    for (const [ad, ref] of Object.entries(ekOkumalar || {})) ek[ad] = await tx.get(ref);
    const yeni = !dSnap.exists;
    const d = yeni ? yeniDurum(now, def) : dSnap.data();
    d.sym = sym;
    if (yeni && def && def.gercek) { d.gercek = true; d.son = []; d.sonTick = now - SON_MUM * MUM_MS; }
    d.poz = d.poz || {};
    d.akis = d.akis || [];
    d.son = d.son || [];
    // Kumarhane kasa farkı (borsa/kumar.bekleyen) BERKAY kasasına aktarılır. Kumar işlemleri bu belgeye
    // yazar ki herkesin dinlediği borsa belgesi her Plinko topunda değişmesin (okuma kotası).
    const kumarBekleyen = kumarSnap && kumarSnap.exists ? sayi(kumarSnap.data().bekleyen) || 0 : 0;
    if (kumarBekleyen) d.kasaBKC = r6(d.kasaBKC + kumarBekleyen);
    const gizli = gSnap.exists ? gSnap.data() : { rota: null, mm: null };
    const k = { tasanlar: [], liste: [], gizliDegisti: false, loglar: [], grafikSil: false, dis };
    if (d.gercek && !dis && yeni) throw new Hata(`${sym} gerçek fiyatı şu an alınamadı, birazdan tekrar dene.`, 503);
    ilerlet(d, gizli, now, k);
    const sonuc = await hesapla({ tx, d, gizli, ek, k });
    likidasyonlar(d, now, k);
    d.rotaVar = !!(gizli && gizli.rota);

    // yazmalar
    tx.set(durumRef, d);
    if (kumarBekleyen) tx.set(kumarRef, { bekleyen: FieldValue.increment(-kumarBekleyen) }, { merge: true });
    if (k.gizliDegisti || !gSnap.exists) tx.set(gizliRef, { rota: gizli.rota || null, mm: gizli.mm || null });
    if (yeni && sym === ANA) for (const u of BASLANGIC_URUNLER) tx.set(db.collection("borsa_market").doc(u.id), { ...u, olusturma: now });
    if (sym === ANA && !d.dijitalTohum) { d.dijitalTohum = true; for (const u of DIJITAL_URUNLER) tx.set(db.collection("borsa_market").doc(u.id), { ...u, olusturma: now }, { merge: true }); }
    const gunler = {};
    for (const m of k.tasanlar) (gunler[gunAnahtari(m.t)] ||= []).push(m);
    for (const [gun, mumlar] of Object.entries(gunler)) {
      tx.set(db.collection("borsa_grafik").doc(grafikId(sym, gun)), { m: FieldValue.arrayUnion(...mumlar) }, { merge: true });
    }
    for (const kayit of k.liste) {
      tx.set(db.collection("borsa_gecmis").doc(kayit.id), kayit);
      if (kayit.sebep === "likide") {
        k.loglar.push({ uid: kayit.uid, ad: kayit.ad, tur: "likidasyon", detay: `${sym} ${kayit.kaldirac}x ${kayit.yon.toUpperCase()} likide oldu (−${kayit.teminat} USDT teminat)`, btl: 0, bkc: 0 });
      }
    }
    for (const l of k.loglar) tx.set(db.collection("borsa_log").doc(), { coin: sym, ...l, ms: now, tarih: FieldValue.serverTimestamp() });
    if (k.grafikSil && sonuc) sonuc.__grafikSil = true;
    return sonuc;
  });
}

// Grafik gün belgelerini (borsa_grafik/*) sil — sıfırlamadan sonra, transaction dışında
async function grafikGunleriniSil(db, sym = ANA) {
  const hepsi = await db.collection("borsa_grafik").listDocuments();
  const belgeler = hepsi.filter((r) => (sym === ANA ? /^\d{4}-\d{2}-\d{2}$/.test(r.id) : r.id.startsWith(sym + "_")));
  for (let i = 0; i < belgeler.length; i += 400) {
    const b = db.batch();
    belgeler.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
  return belgeler.length;
}

function cuzdanCevap(c) {
  return c ? { bkc: r6(c.bkc || 0), btl: r6(c.btl || 0), coin: c.coin || {}, gerceklesen: r2(c.gerceklesen || 0), bonus: c.bonus || 0 } : null;
}
// İstenen coini kayıttan bul (yoksa hata)
// Coin listesi sunucuda 60 sn önbellekte (her istekte okuma harcamasın)
let coinOnbellek = { t: 0, liste: null };
async function coinListesiOku(db) {
  if (coinOnbellek.liste && Date.now() - coinOnbellek.t < 60_000) return coinOnbellek.liste;
  const liste = coinListesi(await db.collection("borsa").doc("coinler").get());
  coinOnbellek = { t: Date.now(), liste };
  return liste;
}
async function coinBul(db, sym) {
  const liste = await coinListesiOku(db);
  const def = liste.find((c) => c.sym === sym);
  if (!def) throw new Hata(`${sym} diye bir coin yok.`);
  return { def, liste };
}
function pozOzet(p) { return { ...p }; }

// ---------------- Özet: zenginler, bu hafta, isim süsleri (borsa/ozet) ----------------
// Tarayıcılar bütün cüzdanları ve 7 günlük işlem geçmişini OKUMASIN diye (Firestore okuma kotası)
// sunucu en fazla 10 dakikada bir tek bir özet belgesi hazırlar; herkes sadece onu okur (1 okuma).
const OZET_MS = 10 * 60_000;
let ozetKontrol = 0; // bu sunucu örneğinde son kontrol (aynı dakikada tekrar okumasın)
async function ozetBelki(db, now, zorla) {
  if (!zorla && now - ozetKontrol < 60_000) return null;
  ozetKontrol = now;
  const ref = db.collection("borsa").doc("ozet");
  const s = await ref.get();
  const eski = s.exists ? s.data() : null;
  if (!zorla && eski && now - (eski.t || 0) < OZET_MS) return null;
  return ozetHesapla(db, now, eski);
}
async function ozetHesapla(db, now, eski) {
  const liste = await coinListesiOku(db);
  const [cs, ...ds] = await Promise.all([db.collection("borsa_cuzdan").get(), ...liste.map((c) => db.collection("borsa").doc(durumId(c.sym)).get())]);
  const dur = {};
  liste.forEach((c, i) => { if (ds[i].exists) dur[c.sym] = ds[i].data(); });
  // Bu hafta: sadece son özetten beri kapanan pozisyonlar okunur, eskiler özette birikir
  const haftaBasi = now - 7 * 86400_000;
  const sonG = eski && eski.gecmisT > haftaBasi ? eski.gecmisT : haftaBasi;
  const gs = await db.collection("borsa_gecmis").where("kapanis", ">", sonG).get();
  const hafta = new Map(((eski && eski.hafta) || []).filter((x) => x.t >= haftaBasi).map((x) => [x.id, x]));
  let gecmisT = sonG;
  gs.docs.forEach((x) => {
    const g = x.data();
    if (g.kapanis > gecmisT) gecmisT = g.kapanis;
    if (g.sebep === "yenileme") return;
    hafta.set(g.id || x.id, { id: g.id || x.id, ad: g.ad, coin: g.coin || ANA, x: g.kaldirac, yon: g.yon, pnl: g.pnl, yuzde: g.yuzde, teminat: g.teminat, sebep: g.sebep, t: g.kapanis });
  });
  const haftaListe = [...hafta.values()].sort((a, b) => b.t - a.t).slice(0, 1500);
  // Değerler: USDT + bütün coinler + açık pozisyonların "şimdi kapatsan" değeri
  const kisiler = cs.docs.map((x) => {
    const c = x.data();
    let deger = c.btl || 0;
    for (const [sym, dd] of Object.entries(dur)) {
      const m = bakiye(c, sym);
      if (m) deger += m * dd.fiyat;
      for (const p of Object.values(dd.poz || {})) if (p.uid === c.uid) deger += Math.max(0, p.teminat + pozPnl(p, dd.fiyat, dd.derinlik));
    }
    return { uid: c.uid || x.id, ad: c.ad || "?", deger: r2(deger), kozmetik: c.kozmetik && Object.keys(c.kozmetik).length ? c.kozmetik : null, seri: c.seri || 0, olusturma: c.olusturma || 0,
      xp: c.xp || 0, haftaXp: c.hafta && c.hafta.k === haftaAnahtari(now) ? c.hafta.xp : 0 };
  }).sort((a, b) => b.deger - a.deger);
  const kisi = {}, kozmetik = {};
  kisiler.forEach((k, i) => {
    kisi[k.uid] = { ad: k.ad, deger: k.deger, sira: i + 1, seri: k.seri, olusturma: k.olusturma, xp: k.xp };
    if (k.kozmetik) kozmetik[k.ad] = k.kozmetik;
  });
  // Haftalık lig: bu haftanın XP'sine göre. Hafta değişince geçen haftanın ilk 3'üne kasadan ödül.
  const hk = haftaAnahtari(now);
  const lig = { k: hk, liste: kisiler.filter((k) => k.haftaXp > 0).sort((a, b) => b.haftaXp - a.haftaXp).slice(0, 10).map((k) => ({ uid: k.uid, ad: k.ad, xp: k.haftaXp })) };
  let ligGecen = (eski && eski.ligGecen) || null, ligOdendi = (eski && eski.ligOdendi) || null;
  if (eski && eski.lig && eski.lig.k !== hk && ligOdendi !== eski.lig.k) {
    const kazananlar = (eski.lig.liste || []).slice(0, 3).map((k, i) => ({ ...k, odul: LIG_ODUL[i] }));
    if (kazananlar.length) await ligOde(db, now, eski.lig.k, kazananlar);
    ligGecen = { k: eski.lig.k, kazananlar };
    ligOdendi = eski.lig.k;
  }
  // Turnuva: geçen haftanınki ödenmediyse öde (belge içinde "odendi" işaretiyle, iki kez ödenmez)
  const oncekiHafta = haftaAnahtari(now - 7 * 86400_000);
  let turnuvaOdendi = (eski && eski.turnuvaOdendi) || null;
  if (turnuvaOdendi !== oncekiHafta) {
    try { await turnuvaOde(db, now, oncekiHafta); turnuvaOdendi = oncekiHafta; } catch (e) { console.error("turnuva ödemesi:", e.message); }
  }
  const kumarS = await db.collection("borsa").doc("kumar").get();
  const kumarV = kumarS.exists ? kumarS.data() : {};
  const ozet = {
    t: now, gecmisT, hafta: haftaListe, kozmetik, kisi, lig, ligGecen, ligOdendi, turnuvaOdendi,
    jackpot: kumarV.jackpot || SLOT_JACKPOT_TABAN, sonJackpot: kumarV.sonJackpot || null,
    zengin: kisiler.slice(0, 20).map((k) => ({ uid: k.uid, ad: k.ad, deger: k.deger, kozmetik: k.kozmetik })),
    olay: (eski && eski.olay) || null,
  };
  await db.collection("borsa").doc("ozet").set(ozet);
  return ozet;
}

const LIG_ODUL = [500, 250, 100];
async function ligOde(db, now, hafta, kazananlar) {
  const refs = {};
  kazananlar.forEach((k, i) => { refs["w" + i] = db.collection("borsa_cuzdan").doc(k.uid); });
  await islem(db, now, refs, async ({ tx, d, ek, k }) => {
    kazananlar.forEach((kz, i) => {
      const s = ek["w" + i];
      if (!s.exists) return;
      const c = s.data();
      const odul = kasaTransfer(d, c, kz.odul);
      c.ligKupa = [{ hafta, sira: i + 1, odul, xp: kz.xp }, ...(c.ligKupa || [])].slice(0, 20);
      const yk = yilAnahtari(now); c.yil = Object.assign({}, c.yil || {}); c.yil[yk] = Object.assign({}, c.yil[yk] || {}); c.yil[yk]["lig" + (i + 1)] = (c.yil[yk]["lig" + (i + 1)] || 0) + 1;
      tx.set(s.ref, c);
      k.loglar.push({ uid: kz.uid, ad: kz.ad, tur: "lig", detay: `Haftalık lig ${i + 1}.'si (${hafta} haftası, ${kz.xp} XP) → +${odul} BERKAY`, bkc: odul, btl: 0 });
    });
    return null;
  });
}

async function turnuvaOde(db, now, hk) {
  const tRef = db.collection("borsa_turnuva").doc(hk);
  const on = await tRef.get();
  if (!on.exists || on.data().odendi) return;
  const { havuz, kazananlar } = turnuvaOdulleri(on.data());
  const refs = { t: tRef };
  kazananlar.forEach((k, i) => { refs["w" + i] = db.collection("borsa_cuzdan").doc(k.uid); });
  await islem(db, now, refs, async ({ tx, d, ek, k }) => {
    if (!ek.t.exists || ek.t.data().odendi) return null;
    const odenen = [];
    kazananlar.forEach((kz, i) => {
      const s = ek["w" + i];
      if (!s.exists) return;
      const c = s.data();
      const odul = kasaTransfer(d, c, kz.odul);
      c.turnuvaKupa = [{ hafta: hk, oyun: ek.t.data().oyun, sira: i + 1, skor: kz.skor, odul }, ...(c.turnuvaKupa || [])].slice(0, 20);
      oyuncuOlay(c, "turnuvaKupa", { sira: i + 1 }, now);
      tx.set(s.ref, c);
      odenen.push({ ad: kz.ad, skor: kz.skor, odul });
      k.loglar.push({ uid: kz.uid, ad: kz.ad, tur: "turnuva", detay: `Turnuva ${i + 1}.'si (${hk}, skor ${kz.skor}) → +${odul} BERKAY`, bkc: odul, btl: 0 });
    });
    tx.set(tRef, { odendi: true, havuzSon: havuz, kazananlar: odenen }, { merge: true });
    return null;
  });
}

// ---------------- Kullanıcı işlemleri ----------------
async function kullaniciIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const cuzRef = db.collection("borsa_cuzdan").doc(kim.uid);

  if (tur === "tick" || tur === "tickHepsi") {
    // tick: tek coin · tickHepsi: listedeki bütün coinler (coin listesi sayfası açıkken)
    const liste = await coinListesiOku(db);
    // Tarayıcı hangi coinlerin bayatladığını (sonTick) zaten biliyor: sadece onları göndersin, sunucu boşuna okumasın
    const istenen = Array.isArray(govde.coinler) ? new Set(govde.coinler.map(symTemiz)) : null;
    const hedefler = tur === "tick" ? liste.filter((c) => c.sym === symTemiz(govde.coin)) : liste.filter((c) => !istenen || istenen.has(c.sym));
    const aralik = tur === "tick" ? TICK_TEK_MS : TICK_LISTE_MS;
    // Sırayla (paralel değil): gerçek coinlere geçiş bütün cüzdanları kilitliyor, aynı anda koşarsa birbirini kilitler
    const hatalar = [];
    for (const def of hedefler) {
      const snap = await db.collection("borsa").doc(durumId(def.sym)).get();
      if (snap.exists && now - (snap.data().sonTick || 0) < aralik) continue;
      await islem(db, now, {}, async () => null, def.sym, def).catch((e) => { hatalar.push(def.sym + ": " + (e && e.message)); console.error("tick " + def.sym, e); });
    }
    await ozetBelki(db, now).catch((e) => console.error("özet", e));
    return hatalar.length ? { ok: true, hatalar } : { ok: true };
  }

  // Özet eskiyse/yoksa yenile (herhangi bir sayfa isteyebilir; sunucu 10 dk sınırını kendi uygular)
  if (tur === "ozet") {
    await ozetBelki(db, now);
    return { ok: true };
  }

  if (tur === "baslat") {
    // Cüzdanı zaten olan biri için transaction gerekmez: sayfa açılışı borsadaki yoğunluktan etkilenmesin
    const mevcut = await cuzRef.get();
    if (mevcut.exists) return { ok: true, cuzdan: cuzdanCevap(mevcut.data()), yeni: false };
    return islem(db, now, { c: cuzRef }, async ({ tx, d, ek, k }) => {
      if (ek.c.exists) return { ok: true, cuzdan: cuzdanCevap(ek.c.data()), yeni: false };
      const bonus = Math.min(KAYIT_BONUSU, d.kasaBKC);
      d.kasaBKC = r6(d.kasaBKC - bonus);
      const c = { uid: kim.uid, ad: kim.ad, bkc: bonus, btl: 0, bonus, gerceklesen: 0, olusturma: now, sonIslem: 0 };
      tx.set(cuzRef, c);
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "bonus", detay: `Kayıt bonusu: ${bonus} BERKAY`, bkc: bonus, btl: 0 });
      return { ok: true, cuzdan: cuzdanCevap(c), yeni: true, bonus };
    });
  }

  // geri kalanların hepsi cüzdan ister
  const urunRef = tur === "marketAl" ? db.collection("borsa_market").doc(String(govde.urunId || "-")) : null;
  const sym = tur === "marketAl" ? ANA : symTemiz(govde.coin);
  const { def } = sym === ANA ? { def: null } : await coinBul(db, sym);
  return islem(db, now, urunRef ? { c: cuzRef, u: urunRef } : { c: cuzRef }, async ({ tx, d, ek, k }) => {
    if (!ek.c.exists) throw new Hata("Önce borsaya giriş yap (cüzdanın yok).");
    const c = ek.c.data();
    if (now - (c.sonIslem || 0) < 700) throw new Hata("Biraz yavaş, çok hızlı işlem yapıyorsun.");
    c.sonIslem = now;
    const D = d.derinlik;
    let mesaj = "", ekCevap = {};

    if (tur !== "marketAl" && !d.acik) throw new Hata("Piyasa şu an kapalı.");
    // Gerçek coinde bayat fiyatla işlem olmasın: bu istekte piyasadan taze fiyat gelmiş olmalı
    if (d.gercek && !k.dis) throw new Hata(`${sym} gerçek fiyatı şu an alınamadı, birkaç saniye sonra tekrar dene.`);
    const G = !!d.gercek;

    if (tur === "spotAl") {
      const N = r6(sayi(govde.btl));
      if (!(N > 0)) throw new Hata("Geçerli bir USDT miktarı yaz.");
      if (N > c.btl + 1e-9) throw new Hata("Yeterli USDT'n yok.");
      const r = G ? { q: N / d.fiyat, p1: d.fiyat } : egriAl(d.fiyat, N, D);
      if (r.q > d.kasaBKC) throw new Hata(`Kasada bu kadar ${sym} kalmadı.`);
      c.btl = r6(c.btl - N); bakiyeYaz(c, sym, bakiye(c, sym) + r.q);
      d.kasaBKC = r6(d.kasaBKC - r.q);
      d.fiyat = r.p1;
      mumYaz(d, now, d.fiyat, N, k.tasanlar);
      akisEkle(d, { t: now, ad: kim.ad, tur: "al", m: r2(N), q: r6(r.q), f: r6(d.fiyat) });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "spot-al", detay: `${r6(r.q)} ${sym} aldı (${r2(N)} USDT)`, bkc: sym === ANA ? r6(r.q) : 0, btl: -N });
      mesaj = `${r.q.toFixed(4)} ${sym} aldın.`;
      ekCevap = { q: r6(r.q), ort: r6(N / r.q) };
    } else if (tur === "spotSat") {
      const q = r6(sayi(govde.miktar ?? govde.bkc));
      if (!(q > 0)) throw new Hata(`Geçerli bir ${sym} miktarı yaz.`);
      const elde = bakiye(c, sym);
      if (q > elde + 1e-9) throw new Hata(`Yeterli ${sym} bakiyen yok.`);
      const r = G ? { N: q * d.fiyat, p1: d.fiyat } : egriSat(d.fiyat, q, D);
      bakiyeYaz(c, sym, Math.max(0, elde - q)); c.btl = r6(c.btl + r.N);
      d.kasaBKC = r6(d.kasaBKC + q);
      d.fiyat = Math.max(1e-6, r.p1);
      mumYaz(d, now, d.fiyat, r.N, k.tasanlar);
      akisEkle(d, { t: now, ad: kim.ad, tur: "sat", m: r2(r.N), q, f: r6(d.fiyat) });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "spot-sat", detay: `${q} ${sym} sattı (${r2(r.N)} USDT)`, bkc: sym === ANA ? -q : 0, btl: r6(r.N) });
      mesaj = `${q} ${sym} sattın, ${r.N.toFixed(2)} USDT geldi.`;
      ekCevap = { N: r6(r.N), ort: r6(r.N / q) };
    } else if (tur === "pozAc") {
      const yon = govde.yon === "short" ? "short" : "long";
      const x = Math.round(sayi(govde.kaldirac));
      const M = r6(sayi(govde.teminat));
      const maxX = Math.min(MAX_KALDIRAC, d.maxKaldirac || MAX_KALDIRAC);
      if (!(x >= 1 && x <= maxX)) throw new Hata(`Kaldıraç 1x ile ${maxX}x arası olmalı.`);
      if (!(M >= 1)) throw new Hata("Teminat en az 1 USDT olmalı.");
      if (M > c.btl + 1e-9) throw new Hata("Yeterli USDT'n yok. Spot'tan coin satıp USDT alabilirsin.");
      const acik = Object.values(d.poz).filter((p) => p.uid === kim.uid).length;
      if (acik >= MAX_ACIK_POZ) throw new Hata(`${sym}'da aynı anda en fazla ${MAX_ACIK_POZ} pozisyon açabilirsin.`);
      const N = M * x;
      if (N > D * MAX_POZ_ORAN) throw new Hata(`Pozisyon büyüklüğü (teminat × kaldıraç) en fazla ${Math.floor(D * MAX_POZ_ORAN)} USDT olabilir. Teminatı ya da kaldıracı düşür.`);
      // Gerçek coinde pozisyon fiyatı itmez: giriş = piyasa fiyatı, K/Z düz hesap (v:2)
      const r = G ? { q: N / d.fiyat, p1: d.fiyat } : yon === "long" ? egriAl(d.fiyat, N, D) : egriShortAc(d.fiyat, N, D);
      const id = randomUUID().replace(/-/g, "").slice(0, 16);
      const poz = { id, coin: sym, uid: kim.uid, ad: kim.ad, yon, kaldirac: x, teminat: M, notional: r6(N), boyut: G ? N / d.fiyat : r6(r.q), giris: G ? d.fiyat : r6(N / r.q), acilis: now };
      if (G) poz.v = 2;
      poz.lik = r6(G ? (yon === "long" ? Math.max(0, poz.giris - (LIK_ORAN * M) / poz.boyut) : poz.giris + (LIK_ORAN * M) / poz.boyut) : likFiyati(poz, D));
      d.poz[id] = poz;
      c.btl = r6(c.btl - M);
      d.fiyat = Math.max(1e-6, r.p1);
      mumYaz(d, now, d.fiyat, N, k.tasanlar);
      akisEkle(d, { t: now, ad: kim.ad, tur: yon, x, m: r2(N), f: r6(d.fiyat) });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "poz-ac", detay: `${sym} ${x}x ${yon.toUpperCase()} açtı · teminat ${M} USDT · büyüklük ${r2(N)} USDT`, bkc: 0, btl: -M });
      mesaj = `${sym} ${x}x ${yon.toUpperCase()} açıldı. Ortalama giriş ${poz.giris.toFixed(4)}`;
      ekCevap = { poz: pozOzet(poz) };
    } else if (tur === "pozKapat") {
      const poz = d.poz[String(govde.id || "")];
      if (!poz || poz.uid !== kim.uid) throw new Hata("Pozisyon bulunamadı (likide olmuş olabilir).");
      const kayit = pozKapatIc(d, poz, now, "kapat", k);
      c.btl = r6(c.btl + kayit.iade);
      c.gerceklesen = r2((c.gerceklesen || 0) + kayit.pnl);
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "poz-kapat", detay: `${sym} ${poz.kaldirac}x ${poz.yon.toUpperCase()} kapattı · K/Z ${kayit.pnl >= 0 ? "+" : ""}${kayit.pnl} USDT (%${kayit.yuzde})`, bkc: 0, btl: kayit.iade });
      mesaj = `Pozisyon kapandı: ${kayit.pnl >= 0 ? "+" : ""}${kayit.pnl.toFixed(2)} USDT`;
      ekCevap = { sonuc: kayit };
    } else if (tur === "marketAl") {
      if (!ek.u.exists) throw new Hata("Ürün bulunamadı.");
      const u = ek.u.data();
      if (!u.aktif) throw new Hata("Bu ürün şu an satışta değil.");
      if (u.stok === 0) throw new Hata("Stokta kalmadı.");
      const f = r6(sayi(u.fiyat));
      // Dijital ürün (isim rengi / rozet / unvan): anında uygulanır, teslim beklemez
      const dijital = ["renk", "rozet", "unvan"].includes(u.tur);
      let deger = String(u.deger || "");
      if (u.tur === "renk" && !/^#[0-9a-fA-F]{6}$/.test(deger)) throw new Hata("Bu renk ürünü hatalı ayarlanmış (admin).");
      if (u.tur === "unvan" && !deger) {
        deger = String(govde.unvan || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
        if (deger.length < 2) throw new Hata("Unvanını yaz (2–24 harf).");
      }
      if (u.tur === "rozet" && !deger) deger = u.emoji || "⭐";
      if (c.bkc + 1e-9 < f) throw new Hata(`Yeterli BERKAY'ın yok (${f} BERKAY gerekiyor).`);
      c.bkc = r6(c.bkc - f);
      d.kasaBKC = r6(d.kasaBKC + f);
      if (typeof u.stok === "number" && u.stok > 0) tx.update(ek.u.ref, { stok: u.stok - 1 });
      if (dijital) {
        c.kozmetik = Object.assign({}, c.kozmetik || {});
        c.kozmetik[u.tur] = deger;
        if (u.tur === "unvan") c.kozmetik.unvanBitis = u.sureGun > 0 ? now + u.sureGun * 86400_000 : 0;
      }
      const sipRef = db.collection("borsa_siparis").doc();
      tx.set(sipRef, { uid: kim.uid, ad: kim.ad, urunId: ek.u.id, urunAd: u.ad + (u.tur === "unvan" ? ` ("${deger}")` : ""), emoji: u.emoji || "🎁", fiyat: f, ms: now, tarih: FieldValue.serverTimestamp(), durum: dijital ? "teslim" : "bekliyor", dijital });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "market", detay: `${u.emoji || "🎁"} ${u.ad}${u.tur === "unvan" ? ` ("${deger}")` : ""} aldı (${f} BERKAY)`, bkc: -f, btl: 0 });
      mesaj = dijital ? `${u.emoji || "🎁"} ${u.ad} hesabına uygulandı!` : `${u.emoji || "🎁"} ${u.ad} senin! Admin teslim edecek.`;
    } else {
      throw new Hata("Bilinmeyen işlem.");
    }

    if (tur === "marketAl") oyuncuOlay(c, "market", {}, now);
    else if (["spotAl", "spotSat", "pozAc", "pozKapat"].includes(tur)) oyuncuOlay(c, "islem", { tur, coin: sym, kar: ekCevap.sonuc ? ekCevap.sonuc.pnl : null }, now);
    tx.set(ek.c.ref, c);
    return { ok: true, mesaj, cuzdan: cuzdanCevap(c), ...ekCevap };
  }, sym, def);
}

// ---------------- Oyuncu: seviye (XP), günlük görevler, haftalık lig, yıllık özet ----------------
// Hepsi cüzdanda tutulur, ek okuma gerekmez:
//   c.xp (toplam), c.hafta {k: haftanın pazartesisi, xp}, c.gorev {g: gün, s: {id: ilerleme}, al: [alınanlar]},
//   c.xpGun {g, kumar} (kumardan günlük XP sınırı), c.yil {"2026": {...sayaçlar}} (Berkay Wrapped için).
const XP_ODUL = { islem: 5, market: 10, gunluk: 20, oyun: 5, cark: 5, tahmin: 10, duello: 10, kumar: 2, kumarKazanc: 3, gorev: 25, turnuva: 15 };
const KUMAR_XP_GUNLUK = 150; // kumar spamıyla seviye kasılmasın
function seviyeHesap(xp) { return Math.floor(Math.sqrt(Math.max(0, xp || 0) / 50)) + 1; } // 2:50, 3:200, 5:800, 10:4050 XP
function seviyeCarkBonus(sv) { return (sv >= 5 ? 1 : 0) + (sv >= 10 ? 1 : 0) + (sv >= 20 ? 1 : 0); } // seviyeyle bedava çark hakkı
// Haftanın pazartesisi (İstanbul saatiyle) → "2026-11-16"
function haftaAnahtari(now) {
  const t = new Date(now + 3 * 3600_000);
  const gun = (t.getUTCDay() + 6) % 7; // pazartesi = 0
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - gun)).toISOString().slice(0, 10);
}
const yilAnahtari = (now) => String(new Date(now + 3 * 3600_000).getUTCFullYear());
// Görev havuzu: her gün 3 tanesi (farklı gruplardan) seçilir. esles(tur, v) → ilerlemeye eklenecek miktar.
const GOREVLER = [
  { id: "crash3x", grup: "kumar", ad: "Crash'te 3x ya da üstünde çek", hedef: 1, odul: 40, esles: (t, v) => (t === "crashCek" && v.carpan >= 3 ? 1 : 0) },
  { id: "crash5", grup: "kumar", ad: "5 tur Crash oyna", hedef: 5, odul: 25, esles: (t) => (t === "crash" ? 1 : 0) },
  { id: "mines5", grup: "kumar", ad: "Mines'ta tek oyunda 5 kutu açıp çek", hedef: 1, odul: 40, esles: (t, v) => (t === "mines" && !v.patladi && v.acilan >= 5 ? 1 : 0) },
  { id: "mines3", grup: "kumar", ad: "3 kez Mines oyna", hedef: 3, odul: 25, esles: (t) => (t === "mines" ? 1 : 0) },
  { id: "plinko10", grup: "kumar", ad: "10 kez Plinko at", hedef: 10, odul: 25, esles: (t) => (t === "plinko" ? 1 : 0) },
  { id: "plinko5x", grup: "kumar", ad: "Plinko'da 5x ya da üstü yakala", hedef: 1, odul: 50, esles: (t, v) => (t === "plinko" && v.carpan >= 5 ? 1 : 0) },
  { id: "bj3", grup: "kumar", ad: "Blackjack'te 3 el kazan", hedef: 3, odul: 40, esles: (t, v) => (t === "bj" && v.sonuc > 0 ? 1 : 0) },
  { id: "bj21", grup: "kumar", ad: "Blackjack yap (ilk iki kartta 21)", hedef: 1, odul: 60, esles: (t, v) => (t === "bj" && v.blackjack ? 1 : 0) },
  { id: "duelloKazan", grup: "sosyal", ad: "1 düello kazan", hedef: 1, odul: 40, esles: (t, v) => (t === "duello" && v.kazandi ? 1 : 0) },
  { id: "duelloOyna", grup: "sosyal", ad: "1 düello aç ya da kabul et", hedef: 1, odul: 20, esles: (t) => (t === "duello" || t === "duelloAc" ? 1 : 0) },
  { id: "tahmin1", grup: "sosyal", ad: "Tahmin pazarında bahis yap", hedef: 1, odul: 20, esles: (t) => (t === "tahmin" ? 1 : 0) },
  { id: "cark1", grup: "sosyal", ad: "BERKAY çarkını çevir", hedef: 1, odul: 15, esles: (t) => (t === "cark" ? 1 : 0) },
  { id: "oyun1", grup: "sosyal", ad: "Spor'daki oyunlardan birinde skor yap", hedef: 1, odul: 20, esles: (t) => (t === "oyun" ? 1 : 0) },
  { id: "islem5", grup: "borsa", ad: "Borsada 5 işlem yap", hedef: 5, odul: 30, esles: (t) => (t === "islem" ? 1 : 0) },
  { id: "kaldiracKar", grup: "borsa", ad: "Bir kaldıraç pozisyonunu kârla kapat", hedef: 1, odul: 40, esles: (t, v) => (t === "islem" && v.kar > 0 ? 1 : 0) },
  { id: "coin2", grup: "borsa", ad: "BERKAY dışında bir coin al", hedef: 1, odul: 25, esles: (t, v) => (t === "islem" && v.tur === "spotAl" && v.coin && v.coin !== "BERKAY" ? 1 : 0) },
];
function gunGorevleri(gun) {
  const h = createHmac("sha256", "gorev").update(gun).digest();
  const gruplar = ["kumar", "sosyal", "borsa"];
  return gruplar.map((g, i) => { const l = GOREVLER.filter((x) => x.grup === g); return l[h[i] % l.length]; });
}
// Bir olay oldu: XP, haftalık XP, görev ilerlemesi ve yıllık sayaçlar güncellenir.
function oyuncuOlay(c, tur, v, now) {
  v = v || {};
  const gun = gunAnahtari(now);
  // XP
  let xp = 0;
  if (["crash", "mines", "plinko", "bj", "rulet", "slot"].includes(tur)) {
    c.xpGun = c.xpGun && c.xpGun.g === gun ? { ...c.xpGun } : { g: gun, kumar: 0 };
    const istenen = XP_ODUL.kumar + (v.kazanc > (v.bahis || 0) ? XP_ODUL.kumarKazanc : 0);
    xp = Math.max(0, Math.min(istenen, KUMAR_XP_GUNLUK - c.xpGun.kumar));
    c.xpGun.kumar += xp;
  } else if (tur === "crashCek") xp = 0; // "crash" olayında sayıldı
  else xp = XP_ODUL[tur === "duelloAc" ? "duello" : tur] || 0;
  if (v.ekXp) xp += v.ekXp;
  if (xp) {
    const once = seviyeHesap(c.xp);
    c.xp = (c.xp || 0) + xp;
    const hk = haftaAnahtari(now);
    c.hafta = c.hafta && c.hafta.k === hk ? { k: hk, xp: c.hafta.xp + xp } : { k: hk, xp };
    if (seviyeHesap(c.xp) > once) c.seviyeAtladi = { sv: seviyeHesap(c.xp), t: now };
  }
  // Görevler
  c.gorev = c.gorev && c.gorev.g === gun ? { g: gun, s: { ...(c.gorev.s || {}) }, al: [...(c.gorev.al || [])] } : { g: gun, s: {}, al: [] };
  for (const g of gunGorevleri(gun)) {
    const n = g.esles(tur, v);
    if (n) c.gorev.s[g.id] = Math.min(g.hedef, (c.gorev.s[g.id] || 0) + n);
  }
  // Yıllık sayaçlar (Berkay Wrapped)
  const yk = yilAnahtari(now);
  c.yil = Object.assign({}, c.yil || {});
  const y = (c.yil[yk] = Object.assign({}, c.yil[yk] || {}));
  const art = (ad, n = 1) => { y[ad] = r2((y[ad] || 0) + n); };
  const enb = (ad, x) => { if (x > (y[ad] || 0)) y[ad] = r2(x); };
  art("xp", xp);
  if (y.sonGun !== gun) { y.sonGun = gun; art("gun"); }
  if (tur === "islem") { art("islem"); if (v.coin) { y.coinler = Object.assign({}, y.coinler || {}); y.coinler[v.coin] = (y.coinler[v.coin] || 0) + 1; } }
  if (["crash", "mines", "plinko", "bj", "rulet", "slot"].includes(tur)) { art("kumarOyun"); art(tur + "Oyun"); art("kumarBahis", v.bahis || 0); if (v.kazanc != null) art("kumarKazanc", v.kazanc); }
  if (tur === "crashCek") { art("kumarKazanc", v.odeme || 0); enb("crashEnYuksek", v.carpan || 0); }
  if (tur === "mines" && !v.patladi) enb("minesEnCok", v.acilan || 0);
  if (tur === "plinko") enb("plinkoEnYuksek", v.carpan || 0);
  if (tur === "bj") { if (v.sonuc > 0) art("bjKazan"); if (v.blackjack) art("bjBlackjack"); }
  if (["crash", "mines", "plinko", "bj", "rulet", "slot"].includes(tur) || tur === "crashCek") enb("enBuyukKazanc", (v.kazanc || v.odeme || 0) - (v.bahis || 0));
  if (tur === "duello") { art(v.kazandi ? "duelloG" : "duelloM"); if (v.rakip) { y.rakipler = Object.assign({}, y.rakipler || {}); const r = (y.rakipler[v.rakip] ||= { g: 0, m: 0 }); y.rakipler[v.rakip] = { g: r.g + (v.kazandi ? 1 : 0), m: r.m + (v.kazandi ? 0 : 1) }; } }
  if (tur === "tahmin") art("tahmin");
  if (tur === "cark") { art("cark"); art("carkKazanc", v.miktar || 0); }
  if (tur === "gunluk") enb("enUzunSeri", v.seri || 0);
  if (tur === "oyun") { y.oyunlar = Object.assign({}, y.oyunlar || {}); y.oyunlar[v.oyun] = (y.oyunlar[v.oyun] || 0) + 1; }
  if (tur === "market") art("market");
  if (tur === "gorev") art("gorev");
  if (tur === "slot" && v.jackpot) art("slotJackpot");
  if (tur === "rulet" && v.kazanc >= v.bahis * 10) art("ruletSayi");
  if (tur === "turnuva") art("turnuva");
  if (tur === "turnuvaKupa") { art("turnuvaKupa"); enb("turnuvaEnIyi", 4 - (v.sira || 3)); }
}

// ---------------- Kumarhane: Crash + Düello ----------------
// Para her zaman KASA ile kullanıcı arasında gider gelir (arz korunur). Kasa BERKAY durum belgesinde
// (kasaBKC); bunlar borsa transaction'ını kilitlemesin diye kasaya FieldValue.increment ile yazılır.
//
// CRASH: 30 sn'lik turlar. İlk 7 sn bahis, sonra çarpan e^(0.15·sn) ile yükselir. Çöküş noktası
// sunucunun gizli anahtarıyla (HMAC) turdan hesaplanır: önceden kimse bilemez, veritabanı gerekmez.
// Dağılım: P(çöküş ≥ x) = 0,97 / x → hangi hedefi seçersen seç beklenen getiri %97 (kasa %3 kazanır).
// Bahis cüzdanda tutulur (c.crash); "çek" sunucu saatine göre değerlendirilir.
const CRASH = { TUR_MS: 30_000, BAHIS_MS: 7_000, HIZ: 0.15, EV: 0.97, MIN: 1, MAX: 1e15 };
const CRASH_UST = Math.floor(Math.exp((CRASH.HIZ * (CRASH.TUR_MS - CRASH.BAHIS_MS)) / 1000) * 100) / 100;
function crashGizli() { return process.env.CRASH_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT || "yerel-test-anahtari"; }
function crashNoktasi(tur) {
  const h = createHmac("sha256", crashGizli()).update("crash:" + tur).digest();
  const x = h.readUIntBE(0, 6) / 2 ** 48; // [0,1)
  return Math.min(CRASH_UST, Math.max(1, Math.floor((CRASH.EV / (1 - x)) * 100) / 100));
}
function crashCarpan(ucusMs) { return ucusMs <= 0 ? 1 : Math.floor(Math.exp((CRASH.HIZ * ucusMs) / 1000) * 100) / 100; }
function crashAn(now) {
  const tur = Math.floor(now / CRASH.TUR_MS);
  const bas = tur * CRASH.TUR_MS;
  const ucus = now - bas - CRASH.BAHIS_MS;
  const nokta = crashNoktasi(tur);
  const dusus = (Math.log(nokta) / CRASH.HIZ) * 1000; // kalkıştan kaç ms sonra düşer
  const carpan = crashCarpan(ucus);
  const faz = ucus < 0 ? "bahis" : ucus >= dusus || carpan >= nokta ? "dustu" : "ucus";
  return { tur, bas, ucus, nokta, dusus, carpan: faz === "dustu" ? nokta : carpan, faz };
}
// Eski (biten) turdaki bahsi sonuçlandır: hedef koyduysa ve uçak hedefe ulaştıysa hedeften öder
function crashKapat(c, now, kasaDegis) {
  const b = c.crash;
  if (!b || b.durum !== "acik") return null;
  const an = crashAn(now);
  if (b.tur === an.tur && an.faz !== "dustu") return null; // tur sürüyor
  const nokta = crashNoktasi(b.tur);
  const kazandi = b.hedef && nokta >= b.hedef;
  const odeme = kazandi ? r2(b.miktar * b.hedef) : 0;
  if (odeme) { c.bkc = r6((c.bkc || 0) + odeme); kasaDegis.v -= odeme; oyuncuOlay(c, "crashCek", { carpan: b.hedef, odeme, bahis: b.miktar }, now); }
  const sonuc = { tur: b.tur, miktar: b.miktar, carpan: kazandi ? b.hedef : 0, nokta, odeme, t: now };
  c.crash = { ...b, durum: kazandi ? "kazandi" : "kaybetti", odeme, nokta };
  c.crashGecmis = [sonuc, ...(c.crashGecmis || [])].slice(0, 10);
  return sonuc;
}

// ---- Mines / Plinko / Blackjack yardımcıları ----
// Kumarhanede para sınırı yok: tek sınır kişinin bakiyesi. (JSON'da Infinity olmadığı için çok büyük bir sayı.)
const SINIRSIZ = 1e15;
const KUMAR_MAX = SINIRSIZ, KUMAR_MAX_ODEME = SINIRSIZ;
function hmacSayilar(etiket, n) {
  // gizli anahtardan n adet 0..1 arası sayı (aynı oyun kimliği → hep aynı sonuç)
  const out = [];
  for (let i = 0; out.length < n; i++) {
    const h = createHmac("sha256", crashGizli()).update(etiket + ":" + i).digest();
    for (let j = 0; j + 6 <= h.length && out.length < n; j += 6) out.push(h.readUIntBE(j, 6) / 2 ** 48);
  }
  return out;
}
function karistir(n, etiket) {
  const a = Array.from({ length: n }, (_, i) => i), r = hmacSayilar(etiket, n);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r[i] * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function minesBombalar(g, uid) { return karistir(25, `mines:${uid}:${g.id}`).slice(0, g.bomba); }
// Adil çarpan × %97: k güvenli kutu açınca
function minesCarpan(bomba, k) {
  let x = 0.97;
  for (let i = 0; i < k; i++) x *= (25 - i) / (25 - i - bomba);
  return Math.floor(x * 100) / 100;
}
function minesGorunum(g, uid) {
  if (!g) return null;
  const bitti = g.durum !== "acik";
  return { miktar: g.miktar, bomba: g.bomba, acilan: g.acilan, durum: g.durum, patlayan: g.patlayan ?? null, odeme: g.odeme || 0,
    carpan: g.acilan.length ? minesCarpan(g.bomba, g.acilan.length) : 1, sonraki: g.acilan.length < 25 - g.bomba ? minesCarpan(g.bomba, g.acilan.length + 1) : null,
    bombalar: bitti ? minesBombalar(g, uid) : null };
}
const PLINKO_SIRA = 12;
// 13 kutu; beklenen getiri: düşük ≈ %97,9 · orta ≈ %98,3 · yüksek ≈ %96,6
const PLINKO = {
  dusuk: [10, 3, 1.6, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.6, 3, 10],
  orta: [30, 10, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 10, 30],
  yuksek: [100, 20, 8, 2.2, 0.6, 0.3, 0.2, 0.3, 0.6, 2.2, 8, 20, 100],
};
// RULET (canlı, herkes aynı turda): 30 sn'lik turlar, ilk 20 sn bahis, sonra 6 sn çark döner.
// Sonuç turun numarasından gizli anahtarla (HMAC) çıkar, bahis kapanmadan kimse bilemez. Avrupa ruleti (tek sıfır = "Berkay sıfırı").
const RULET = { TUR_MS: 30_000, BAHIS_MS: 20_000, DONUS_MS: 6_000, MAX: 1e15, MAX_ADET: 37 + 9 };
const RULET_KIRMIZI = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function ruletSonuc(tur) { return Math.floor(hmacSayilar("rulet:" + tur, 1)[0] * 37); }
function ruletAn(now) {
  const tur = Math.floor(now / RULET.TUR_MS), bas = tur * RULET.TUR_MS, gecen = now - bas;
  const faz = gecen < RULET.BAHIS_MS ? "bahis" : gecen < RULET.BAHIS_MS + RULET.DONUS_MS ? "donus" : "sonuc";
  return { tur, bas, faz, sonuc: faz === "bahis" ? null : ruletSonuc(tur) };
}
// Bahis çeşitleri → kazanınca bahsin kaç katı geri döner
function ruletCarpan(b, n) {
  const d = String(b.deger);
  if (b.tip === "sayi") return Number(d) === n ? 36 : 0;
  if (n === 0) return 0;
  if (b.tip === "renk") return (RULET_KIRMIZI.has(n) ? "kirmizi" : "siyah") === d ? 2 : 0;
  if (b.tip === "tekcift") return (n % 2 ? "tek" : "cift") === d ? 2 : 0;
  if (b.tip === "yarim") return (n <= 18 ? "1" : "2") === d ? 2 : 0;
  if (b.tip === "duzine") return String(Math.ceil(n / 12)) === d ? 3 : 0;
  return 0;
}
function ruletGecerli(b) {
  const d = String(b && b.deger);
  if (b.tip === "sayi") return /^\d{1,2}$/.test(d) && Number(d) <= 36;
  return ({ renk: ["kirmizi", "siyah"], tekcift: ["tek", "cift"], yarim: ["1", "2"], duzine: ["1", "2", "3"] })[b.tip]?.includes(d) || false;
}
// Turu biten açık bahisleri sonuçlandır
function ruletKapat(c, now, ode) {
  const r = c.rulet;
  if (!r || r.durum !== "acik") return null;
  const an = ruletAn(now);
  if (r.tur === an.tur && an.faz === "bahis") return null;
  const n = ruletSonuc(r.tur);
  let odeme = 0;
  for (const b of r.bahisler) odeme += b.miktar * ruletCarpan(b, n);
  odeme = ode(odeme);
  const bahis = r2(r.bahisler.reduce((t, b) => t + b.miktar, 0));
  c.rulet = { ...r, durum: "bitti", sonuc: n, odeme };
  const ozet = { tur: r.tur, sonuc: n, bahis, odeme, t: now };
  c.ruletGecmis = [ozet, ...(c.ruletGecmis || [])].slice(0, 10);
  oyuncuOlay(c, "rulet", { bahis, kazanc: odeme, sayi: n }, now);
  return ozet;
}

// SLOT: 3 makara, her makarada aynı ağırlıklar (toplam 28). Ortalama geri ödeme ≈ %94 + jackpot payı (%2).
// Üç Berkay = JACKPOT (her çevirmenin %2'si birikir). Ödemeler kasadan.
const SLOT_SEMBOL = ["kiraz", "limon", "burger", "at", "para", "yedi", "berkay"];
const SLOT_AGIRLIK = [8, 7, 5, 4, 2, 1, 1];
const SLOT_UC = { kiraz: 6, limon: 10, burger: 18, at: 30, para: 80, yedi: 250 };
const SLOT_JACKPOT_TABAN = 1000, SLOT_JACKPOT_PAY = 0.02, SLOT_MAX = 1e15;
function slotSembol(x) {
  let t = x * 28;
  for (let i = 0; i < SLOT_SEMBOL.length; i++) { if (t < SLOT_AGIRLIK[i]) return SLOT_SEMBOL[i]; t -= SLOT_AGIRLIK[i]; }
  return SLOT_SEMBOL[0];
}
function slotDegerlendir(s) {
  const [a, b, c] = s;
  if (a === b && b === c) return a === "berkay" ? { jackpot: true, carpan: 0, ad: "JACKPOT" } : { carpan: SLOT_UC[a], ad: "Üçlü " + a };
  const bk = s.filter((x) => x === "berkay").length;
  if (bk === 2) return { carpan: 15, ad: "İki Berkay" };
  if (s.filter((x) => x === "kiraz").length === 2) return { carpan: 1.8, ad: "İki kiraz" };
  if (bk === 1) return { carpan: 0.5, ad: "Bir Berkay" };
  return { carpan: 0, ad: null };
}

// TURNUVA: haftalık, oyunu haftaya göre değişir (Spor sayfası: Boks → Penaltı → Kasksız 85). Giriş ücreti kasaya girer; hafta bitince
// havuz (girişler + en az 3 kişi katıldıysa kasadan bonus) ilk 3'e %60/%25/%15 dağıtılır.
const TURNUVA = { GIRIS: 50, BONUS: 250, PAY: [0.6, 0.25, 0.15], UST: { boks: 999, penalti: 1000, motor: 1500 } };
const TURNUVA_SIRA = ["boks", "penalti", "motor"];
function turnuvaOyunu(hk) { return TURNUVA_SIRA[Math.floor(Date.parse(hk + "T00:00:00Z") / (7 * 86400_000)) % 3]; }
function turnuvaListe(t) {
  return Object.entries((t && t.katilimci) || {}).map(([uid, x]) => ({ uid, ad: x.ad, skor: x.skor || 0, t: x.t || 0 }))
    .sort((a, b) => b.skor - a.skor || a.t - b.t);
}
function turnuvaOdulleri(t) {
  const l = turnuvaListe(t).filter((x) => x.skor > 0);
  const havuz = r2((t.havuz || 0) + (Object.keys(t.katilimci || {}).length >= 3 ? TURNUVA.BONUS : 0));
  const kazananlar = l.slice(0, 3);
  const paylar = kazananlar.map((_, i) => TURNUVA.PAY[i]);
  const artan = TURNUVA.PAY.slice(kazananlar.length).reduce((a, b) => a + b, 0);
  if (paylar.length) paylar[0] += artan;
  return { havuz, kazananlar: kazananlar.map((k, i) => ({ ...k, odul: Math.floor(havuz * paylar[i]) })) };
}

// Kart: 0..51 → değer = i % 13 (0 = As, 9..12 = 10/J/Q/K)
function bjDeste(g, uid) { return karistir(52, `bj:${uid}:${g.id}`); }
function bjToplam(kartlar) {
  let t = 0, as = 0;
  for (const k of kartlar) { const v = k % 13; if (v === 0) { as++; t += 11; } else t += Math.min(10, v + 1); }
  while (t > 21 && as) { t -= 10; as--; }
  return t;
}
const g2 = (g, ek) => Object.assign({}, g, ek);
// Eli bitir: kasa açar ve 17'ye kadar çeker, ödeme yapılır
function bjBitir(c, uid, ode, now, zorla) {
  const g = c.bj, deste = bjDeste(g, uid);
  let kasa = [g.kasa[0], deste[3]], sira = g.sira;
  const ot = bjToplam(g.oyuncu);
  let sonuc = zorla;
  if (!sonuc) {
    while (bjToplam(kasa) < 17) kasa.push(deste[sira++]);
    const kt = bjToplam(kasa);
    sonuc = kt > 21 || ot > kt ? "kazandi" : ot === kt ? "berabere" : "kaybetti";
  }
  const carpan = { blackjack: 2.5, kazandi: 2, berabere: 1, patladi: 0, kaybetti: 0, kasaBJ: 0 }[sonuc];
  const odeme = ode(g.miktar * carpan);
  c.bj = g2(g, { kasa, sira, durum: "bitti", sonuc, odeme });
  oyuncuOlay(c, "bj", { bahis: g.miktar, kazanc: odeme, sonuc: carpan > 1 ? 1 : carpan === 1 ? 0 : -1, blackjack: sonuc === "blackjack" }, now);
}
function bjGorunum(g, uid) {
  if (!g) return null;
  const bitti = g.durum !== "oyun";
  return { miktar: g.miktar, oyuncu: g.oyuncu, kasa: g.kasa, durum: g.durum, sonuc: g.sonuc || null, odeme: g.odeme || 0, ikiye: !!g.ikiye,
    oyuncuToplam: bjToplam(g.oyuncu), kasaToplam: bitti ? bjToplam(g.kasa) : bjToplam([g.kasa[0]]) };
}

async function kumarIslem(db, kim, govde, now) {
  const tur = govde.islem;

  if (tur === "crashDurum") {
    // Veritabanına dokunmaz: sadece saat + gizli anahtar
    const an = crashAn(now);
    const gecmis = [];
    for (let i = 1; i <= 15; i++) gecmis.push({ tur: an.tur - i, nokta: crashNoktasi(an.tur - i) });
    return { ok: true, sunucu: now, tur: an.tur, bas: an.bas, faz: an.faz, carpan: an.carpan, nokta: an.faz === "dustu" ? an.nokta : null, gecmis, ayar: { ...CRASH, UST: CRASH_UST } };
  }
  if (tur === "ruletDurum") {
    // Veritabanına dokunmaz. Sonuç sadece bahisler kapandıktan sonra verilir.
    const an = ruletAn(now);
    const gecmis = [];
    for (let i = 1; i <= 15; i++) gecmis.push({ tur: an.tur - i, sonuc: ruletSonuc(an.tur - i) });
    return { ok: true, sunucu: now, tur: an.tur, bas: an.bas, faz: an.faz, sonuc: an.sonuc, gecmis, ayar: RULET };
  }

  const cuzRef = db.collection("borsa_cuzdan").doc(kim.uid);
  const kumarRef = db.collection("borsa").doc("kumar");
  const kasaYaz = (tx, x, ek) => { if (x || ek) tx.set(kumarRef, { ...(x ? { bekleyen: FieldValue.increment(r6(x)) } : {}), ...(ek || {}) }, { merge: true }); };
  if (tur === "crashBahis" || tur === "crashCek") {
    return db.runTransaction(async (tx) => {
      const s = await tx.get(cuzRef);
      if (!s.exists) throw new Hata("Önce borsaya bir kez gir (cüzdanın açılsın).");
      const c = s.data();
      const kasa = { v: 0 };
      const an = crashAn(now);
      let cevap;
      if (tur === "crashBahis") {
        crashKapat(c, now, kasa);
        if (an.faz !== "bahis") throw new Hata("Bahisler kapandı, bir sonraki turu bekle.");
        if (c.crash && c.crash.tur === an.tur) throw new Hata("Bu tura zaten girdin.");
        const m = Math.round(sayi(govde.miktar) * 100) / 100;
        if (!(m >= CRASH.MIN && m <= CRASH.MAX)) throw new Hata(`Bahis en az ${CRASH.MIN} BERKAY olmalı.`);
        if (m > (c.bkc || 0) + 1e-9) throw new Hata("Yeterli BERKAY'ın yok.");
        let hedef = sayi(govde.hedef);
        hedef = hedef >= 1.01 ? Math.min(CRASH_UST, Math.floor(hedef * 100) / 100) : null;
        c.bkc = r6(c.bkc - m); kasa.v += m;
        c.crash = { tur: an.tur, miktar: m, hedef, durum: "acik", t: now };
        oyuncuOlay(c, "crash", { bahis: m }, now);
        cevap = { ok: true, mesaj: `${m} BERKAY ile tura girdin${hedef ? ` (otomatik çek: ${hedef}x)` : ""}.` };
      } else {
        const b = c.crash;
        if (!b || b.durum !== "acik") throw new Hata("Açık bahsin yok.");
        if (b.tur !== an.tur || an.faz === "dustu") {
          const son = crashKapat(c, now, kasa);
          tx.set(cuzRef, c);
          kasaYaz(tx, kasa.v);
          return { ok: true, gec: true, sonuc: son, mesaj: son && son.odeme ? `Otomatik çekildi: +${son.odeme} BERKAY` : `💥 Geç kaldın, ${son ? son.nokta : ""}x'te düştü.`, cuzdan: cuzdanCevap(c) };
        }
        if (an.faz === "bahis") throw new Hata("Uçak daha kalkmadı.");
        const carpan = b.hedef && an.carpan > b.hedef ? b.hedef : an.carpan;
        const odeme = r2(b.miktar * carpan);
        c.bkc = r6((c.bkc || 0) + odeme); kasa.v -= odeme;
        c.crash = { ...b, durum: "kazandi", odeme, carpan };
        oyuncuOlay(c, "crashCek", { carpan, odeme, bahis: b.miktar }, now);
        c.crashGecmis = [{ tur: b.tur, miktar: b.miktar, carpan, nokta: null, odeme, t: now }, ...(c.crashGecmis || [])].slice(0, 10);
        cevap = { ok: true, carpan, odeme, mesaj: `${carpan}x'te çektin: +${odeme} BERKAY 🤑` };
      }
      tx.set(cuzRef, c);
      kasaYaz(tx, kasa.v);
      tx.set(db.collection("borsa_log").doc(), { coin: ANA, uid: kim.uid, ad: kim.ad, tur: "kumar", detay: tur === "crashBahis" ? `Crash: ${c.crash.miktar} BERKAY bahis${c.crash.hedef ? " (oto " + c.crash.hedef + "x)" : ""}` : `Crash: ${cevap.carpan}x çekti +${cevap.odeme}`, bkc: r6(-kasa.v), btl: 0, ms: now, tarih: FieldValue.serverTimestamp() });
      cevap.cuzdan = cuzdanCevap(c);
      return cevap;
    });
  }


  // ---------------- MINES / PLINKO / BLACKJACK ----------------
  // Bomba yerleri ve deste, oyun kimliğinden sunucunun gizli anahtarıyla (HMAC) üretilir: cüzdanda sadece
  // kimlik ve açılan kutular/kartlar durur, cüzdanı okuyan biri bile bombaları ya da sıradaki kartı göremez.
  if (["minesBasla", "minesAc", "minesCek", "plinko", "slot", "bjBasla", "bjKart", "bjDur", "bjIkiye"].includes(tur)) {
    return db.runTransaction(async (tx) => {
      const s = await tx.get(cuzRef);
      const kumarSnap = tur === "slot" ? await tx.get(kumarRef) : null;
      let kumarEk = null;
      if (!s.exists) throw new Hata("Önce borsaya bir kez gir (cüzdanın açılsın).");
      const c = s.data();
      if (now - (c.sonKumar || 0) < 300) throw new Hata("Biraz yavaş 🙂");
      c.sonKumar = now;
      const kasa = { v: 0 };
      const bahisAl = (m, ust = KUMAR_MAX) => {
        m = Math.round(sayi(m) * 100) / 100;
        if (!(m >= 1 && m <= ust)) throw new Hata("Bahis en az 1 BERKAY olmalı.");
        if (m > (c.bkc || 0) + 1e-9) throw new Hata("Yeterli BERKAY'ın yok.");
        c.bkc = r6(c.bkc - m); kasa.v += m;
        return m;
      };
      const ode = (x) => { x = Math.min(KUMAR_MAX_ODEME, r2(x)); if (x > 0) { c.bkc = r6((c.bkc || 0) + x); kasa.v -= x; } return x; };
      let cevap;

      if (tur === "minesBasla") {
        if (c.mines && c.mines.durum === "acik") throw new Hata("Önce açık Mines oyununu bitir (çek ya da devam et).");
        const bomba = Math.round(sayi(govde.bomba));
        if (!(bomba >= 1 && bomba <= 24)) throw new Hata("Bomba sayısı 1–24 arası olmalı.");
        const m = bahisAl(govde.miktar);
        c.mines = { id: randomUUID().slice(0, 12), miktar: m, bomba, acilan: [], durum: "acik", t: now };
        cevap = { ok: true, mines: minesGorunum(c.mines, kim.uid) };
      } else if (tur === "minesAc" || tur === "minesCek") {
        const g = c.mines;
        if (!g || g.durum !== "acik") throw new Hata("Açık Mines oyunun yok.");
        if (tur === "minesAc") {
          const kutu = Math.round(sayi(govde.kutu));
          if (!(kutu >= 0 && kutu < 25)) throw new Hata("Geçersiz kutu.");
          if (g.acilan.includes(kutu)) throw new Hata("Bu kutu zaten açık.");
          const bombalar = minesBombalar(g, kim.uid);
          if (bombalar.includes(kutu)) {
            c.mines = { ...g, durum: "patladi", patlayan: kutu };
            oyuncuOlay(c, "mines", { bahis: g.miktar, kazanc: 0, acilan: g.acilan.length, patladi: true }, now);
          } else {
            c.mines = { ...g, acilan: [...g.acilan, kutu] };
            if (c.mines.acilan.length >= 25 - g.bomba) { // hepsini açtı: otomatik çek
              const odeme = ode(g.miktar * minesCarpan(g.bomba, c.mines.acilan.length));
              c.mines = { ...c.mines, durum: "cekildi", odeme };
              oyuncuOlay(c, "mines", { bahis: g.miktar, kazanc: odeme, acilan: c.mines.acilan.length }, now);
            }
          }
        } else {
          if (!g.acilan.length) throw new Hata("En az bir kutu açmadan çekemezsin.");
          const odeme = ode(g.miktar * minesCarpan(g.bomba, g.acilan.length));
          c.mines = { ...g, durum: "cekildi", odeme };
          oyuncuOlay(c, "mines", { bahis: g.miktar, kazanc: odeme, acilan: g.acilan.length }, now);
        }
        cevap = { ok: true, mines: minesGorunum(c.mines, kim.uid) };
      } else if (tur === "slot") {
        const m = bahisAl(govde.miktar, SLOT_MAX);
        const sayilar = [0, 1, 2].map(() => randomInt(0, 2 ** 47) / 2 ** 47);
        const semboller = sayilar.map(slotSembol);
        const sonuc = slotDegerlendir(semboller);
        let jackpot = kumarSnap && kumarSnap.exists && kumarSnap.data().jackpot > 0 ? kumarSnap.data().jackpot : SLOT_JACKPOT_TABAN;
        jackpot = r2(jackpot + m * SLOT_JACKPOT_PAY);
        let odeme = 0, jackpotKazandi = 0;
        if (sonuc.jackpot) { jackpotKazandi = ode(jackpot); odeme = jackpotKazandi; jackpot = SLOT_JACKPOT_TABAN; }
        else odeme = ode(m * sonuc.carpan);
        kumarEk = { jackpot, ...(jackpotKazandi ? { sonJackpot: { ad: kim.ad, miktar: jackpotKazandi, t: now } } : {}) };
        oyuncuOlay(c, "slot", { bahis: m, kazanc: odeme, jackpot: !!jackpotKazandi }, now);
        cevap = { ok: true, semboller, carpan: sonuc.jackpot ? r2(odeme / m) : sonuc.carpan, ad: sonuc.ad, odeme, jackpot, jackpotKazandi };
      } else if (tur === "plinko") {
        const risk = ["dusuk", "orta", "yuksek"].includes(govde.risk) ? govde.risk : "orta";
        const m = bahisAl(govde.miktar);
        const yol = [];
        for (let i = 0; i < PLINKO_SIRA; i++) yol.push(randomInt(0, 2));
        const kutu = yol.reduce((a, b) => a + b, 0);
        const carpan = PLINKO[risk][kutu];
        const odeme = ode(m * carpan);
        oyuncuOlay(c, "plinko", { bahis: m, kazanc: odeme, carpan }, now);
        cevap = { ok: true, yol, kutu, carpan, odeme, risk };
      } else {
        // BLACKJACK: tek deste, kasa 17'de durur, blackjack 3:2, beraberlikte para iade, ilk iki kartta ikiye katlama
        if (tur === "bjBasla") {
          if (c.bj && c.bj.durum === "oyun") throw new Hata("Önce açık Blackjack elini bitir.");
          const m = bahisAl(govde.miktar);
          const g = { id: randomUUID().slice(0, 12), miktar: m, durum: "oyun", t: now };
          const deste = bjDeste(g, kim.uid);
          g.oyuncu = [deste[0], deste[2]]; g.kasa = [deste[1]]; g.sira = 4; // deste[3] = kasanın kapalı kartı
          c.bj = g;
          const ob = bjToplam(g.oyuncu) === 21, kb = bjToplam([deste[1], deste[3]]) === 21;
          if (ob || kb) bjBitir(c, kim.uid, ode, now, ob && !kb ? "blackjack" : ob && kb ? "berabere" : "kasaBJ");
        } else {
          const g = c.bj;
          if (!g || g.durum !== "oyun") throw new Hata("Açık Blackjack elin yok.");
          const deste = bjDeste(g, kim.uid);
          if (tur === "bjKart") {
            c.bj = g2(g, { oyuncu: [...g.oyuncu, deste[g.sira]], sira: g.sira + 1 });
            const t = bjToplam(c.bj.oyuncu);
            if (t > 21) bjBitir(c, kim.uid, ode, now, "patladi");
            else if (t === 21) bjBitir(c, kim.uid, ode, now);
          } else if (tur === "bjIkiye") {
            if (g.oyuncu.length !== 2) throw new Hata("Sadece ilk iki kartta ikiye katlanır.");
            bahisAl(g.miktar, KUMAR_MAX * 2);
            c.bj = g2(g, { miktar: g.miktar * 2, ikiye: true, oyuncu: [...g.oyuncu, deste[g.sira]], sira: g.sira + 1 });
            bjBitir(c, kim.uid, ode, now, bjToplam(c.bj.oyuncu) > 21 ? "patladi" : null);
          } else bjBitir(c, kim.uid, ode, now);
        }
        cevap = { ok: true, bj: bjGorunum(c.bj, kim.uid) };
      }
      tx.set(cuzRef, c);
      kasaYaz(tx, kasa.v, kumarEk);
      cevap.cuzdan = cuzdanCevap(c);
      return cevap;
    });
  }

  // RULET: bahisler cüzdanda (c.rulet) tutulur; tur bitince "ruletTopla" ya da bir sonraki bahis sonuçlandırır.
  if (tur === "ruletBahis" || tur === "ruletTopla") {
    return db.runTransaction(async (tx) => {
      const s = await tx.get(cuzRef);
      if (!s.exists) throw new Hata("Önce borsaya bir kez gir (cüzdanın açılsın).");
      const c = s.data();
      if (now - (c.sonKumar || 0) < 300) throw new Hata("Biraz yavaş 🙂");
      c.sonKumar = now;
      const kasa = { v: 0 };
      const ode = (x) => { x = Math.min(KUMAR_MAX_ODEME, r2(x)); if (x > 0) { c.bkc = r6((c.bkc || 0) + x); kasa.v -= x; } return x; };
      const kapanan = ruletKapat(c, now, ode);
      const an = ruletAn(now);
      if (tur === "ruletBahis") {
        if (an.faz !== "bahis") throw new Hata("Bahisler kapandı, çark dönüyor. Sonraki turu bekle.");
        const yeni = (Array.isArray(govde.bahisler) ? govde.bahisler : []).map((b) => ({ tip: String(b.tip), deger: String(b.deger), miktar: Math.round(sayi(b.miktar) * 100) / 100 }));
        if (!yeni.length) throw new Hata("Önce masaya fiş koy.");
        for (const b of yeni) { if (!ruletGecerli(b)) throw new Hata("Geçersiz bahis."); if (!(b.miktar >= 1)) throw new Hata("Fiş en az 1 BERKAY."); }
        const r = c.rulet && c.rulet.tur === an.tur && c.rulet.durum === "acik" ? { ...c.rulet, bahisler: [...c.rulet.bahisler] } : { tur: an.tur, bahisler: [], durum: "acik", t: now };
        // aynı yere konan fişleri birleştir
        for (const b of yeni) {
          const v = r.bahisler.find((x) => x.tip === b.tip && x.deger === b.deger);
          if (v) v.miktar = r2(v.miktar + b.miktar); else r.bahisler.push(b);
        }
        if (r.bahisler.length > RULET.MAX_ADET) throw new Hata(`Bir turda en fazla ${RULET.MAX_ADET} farklı yere bahis.`);
        const ek = r2(yeni.reduce((t, b) => t + b.miktar, 0));
        const toplam = r2(r.bahisler.reduce((t, b) => t + b.miktar, 0));
        if (toplam > RULET.MAX) throw new Hata(`Bir turda toplam en fazla ${RULET.MAX} BERKAY.`);
        if (ek > (c.bkc || 0) + 1e-9) throw new Hata("Yeterli BERKAY'ın yok.");
        c.bkc = r6(c.bkc - ek); kasa.v += ek;
        c.rulet = r;
      }
      tx.set(cuzRef, c);
      kasaYaz(tx, kasa.v);
      return { ok: true, kapanan, rulet: c.rulet || null, gecmis: c.ruletGecmis || [], cuzdan: cuzdanCevap(c) };
    });
  }

  // TURNUVA (haftalık 2048 / Yılan)
  if (tur === "turnuvaDurum" || tur === "turnuvaKatil" || tur === "turnuvaSkor") {
    const hk = haftaAnahtari(now), oyun = turnuvaOyunu(hk);
    const tRef = db.collection("borsa_turnuva").doc(hk);
    if (tur === "turnuvaDurum") {
      const onceki = haftaAnahtari(now - 7 * 86400_000);
      const [ts, os] = await Promise.all([tRef.get(), db.collection("borsa_turnuva").doc(onceki).get()]);
      const t = ts.exists ? ts.data() : { havuz: 0, katilimci: {} };
      const liste = turnuvaListe(t);
      const sira = liste.findIndex((x) => x.uid === kim.uid);
      const o = os.exists ? os.data() : null;
      return { ok: true, k: hk, oyun, bitis: Date.parse(hk + "T00:00:00Z") - 3 * 3600_000 + 7 * 86400_000, giris: TURNUVA.GIRIS, bonus: TURNUVA.BONUS, pay: TURNUVA.PAY,
        havuz: r2(t.havuz || 0), kisi: liste.length, liste: liste.slice(0, 20).map(({ ad, skor }) => ({ ad, skor })),
        ben: sira >= 0 ? { sira: sira + 1, skor: liste[sira].skor } : null,
        gecen: o ? { k: onceki, oyun: o.oyun || turnuvaOyunu(onceki), odendi: !!o.odendi, kazananlar: o.kazananlar || turnuvaOdulleri(o).kazananlar.map(({ ad, skor, odul }) => ({ ad, skor, odul })) } : null };
    }
    return db.runTransaction(async (tx) => {
      const [s, ts] = await Promise.all([tx.get(cuzRef), tx.get(tRef)]);
      if (!s.exists) throw new Hata("Önce borsaya bir kez gir (cüzdanın açılsın).");
      const c = s.data();
      const t = ts.exists ? ts.data() : { k: hk, oyun, havuz: 0, katilimci: {} };
      t.katilimci = { ...(t.katilimci || {}) };
      const ben = t.katilimci[kim.uid];
      let cevap = { ok: true };
      if (tur === "turnuvaKatil") {
        if (ben) throw new Hata("Bu haftaki turnuvaya zaten katıldın.");
        if (TURNUVA.GIRIS > (c.bkc || 0) + 1e-9) throw new Hata(`Giriş ${TURNUVA.GIRIS} BERKAY, yeterli BERKAY'ın yok.`);
        c.bkc = r6(c.bkc - TURNUVA.GIRIS);
        t.havuz = r2((t.havuz || 0) + TURNUVA.GIRIS);
        t.katilimci[kim.uid] = { ad: kim.ad, skor: 0, t: now };
        c.turnuva = { k: hk, oyun };
        oyuncuOlay(c, "turnuva", {}, now);
        kasaYaz(tx, TURNUVA.GIRIS);
        tx.set(cuzRef, c);
        cevap.katildi = true;
      } else {
        if (!ben) return { ok: true, katilmadi: true };
        if (String(govde.oyun) !== oyun) return { ok: true, baskaOyun: true };
        const skor = Math.max(0, Math.min(TURNUVA.UST[oyun], Math.round(sayi(govde.skor) || 0)));
        if (skor <= (ben.skor || 0)) return { ok: true, rekorDegil: true, skor: ben.skor };
        t.katilimci[kim.uid] = { ...ben, ad: kim.ad, skor, t: now };
        cevap.skor = skor;
      }
      tx.set(tRef, t);
      const liste = turnuvaListe(t);
      cevap.sira = liste.findIndex((x) => x.uid === kim.uid) + 1;
      cevap.kisi = liste.length;
      cevap.cuzdan = cuzdanCevap(c);
      return cevap;
    });
  }

  // DÜELLO: biri meydan okur (BERKAY kasaya emanet), diğeri kabul eder, sunucu zar atar. Kazanan 2×miktarın %98'ini alır.
  if (tur === "duelloAc") {
    const ref = db.collection("duello").doc();
    return db.runTransaction(async (tx) => {
      const s = await tx.get(cuzRef);
      if (!s.exists) throw new Hata("Önce borsaya bir kez gir (cüzdanın açılsın).");
      const c = s.data();
      const oyun = govde.oyun === "zar" ? "zar" : "yazitura";
      const m = Math.round(sayi(govde.miktar));
      if (!(m >= 1)) throw new Hata("Miktar en az 1 BERKAY olmalı.");
      if (m > (c.bkc || 0) + 1e-9) throw new Hata("Yeterli BERKAY'ın yok.");
      if ((c.duelloAcik || 0) >= 3) throw new Hata("En fazla 3 açık düellon olabilir. Birini iptal et.");
      const rakip = String(govde.rakip || "").trim().slice(0, 20);
      if (rakip && rakip.toLowerCase() === String(kim.ad).toLowerCase()) throw new Hata("Kendine meydan okuyamazsın 😅");
      let secim = null;
      if (oyun === "yazitura") secim = govde.secim === "tura" ? "tura" : "yazi";
      c.bkc = r6(c.bkc - m); c.duelloAcik = (c.duelloAcik || 0) + 1;
      oyuncuOlay(c, "duelloAc", {}, now);
      tx.set(cuzRef, c);
      kasaYaz(tx, m);
      tx.set(ref, { id: ref.id, oyun, miktar: m, secim, acan: kim.ad, acanUid: kim.uid, rakip: rakip || null, durum: "acik", t: now });
      tx.set(db.collection("borsa_log").doc(), { coin: ANA, uid: kim.uid, ad: kim.ad, tur: "kumar", detay: `Düello açtı: ${oyun === "zar" ? "🎲 zar" : "🪙 yazı-tura"} ${m} BERKAY${rakip ? " → " + rakip : ""}`, bkc: -m, btl: 0, ms: now, tarih: FieldValue.serverTimestamp() });
      return { ok: true, id: ref.id, mesaj: "Düello açıldı! Linki paylaş, biri kabul edince sonuç çıkar.", cuzdan: cuzdanCevap(c) };
    });
  }
  if (tur === "duelloKabul" || tur === "duelloIptal") {
    const ref = db.collection("duello").doc(String(govde.id || "-"));
    return db.runTransaction(async (tx) => {
      const ds = await tx.get(ref);
      if (!ds.exists) throw new Hata("Düello bulunamadı.");
      const du = ds.data();
      if (du.durum !== "acik") throw new Hata(du.durum === "bitti" ? "Bu düello çoktan bitti." : "Bu düello iptal edilmiş.");
      const acanRef = db.collection("borsa_cuzdan").doc(du.acanUid);
      if (tur === "duelloIptal") {
        if (du.acanUid !== kim.uid && !kim.admin) throw new Hata("Sadece açan kişi iptal edebilir.");
        const as = await tx.get(acanRef);
        const a = as.exists ? as.data() : null;
        if (a) { a.bkc = r6((a.bkc || 0) + du.miktar); a.duelloAcik = Math.max(0, (a.duelloAcik || 1) - 1); tx.set(acanRef, a); kasaYaz(tx, -du.miktar); }
        tx.update(ref, { durum: "iptal", bitis: now });
        return { ok: true, mesaj: `İptal edildi, ${du.miktar} BERKAY iade.` };
      }
      if (du.acanUid === kim.uid) throw new Hata("Kendi düellonu kabul edemezsin.");
      if (du.rakip && du.rakip.toLowerCase() !== String(kim.ad).toLowerCase()) throw new Hata(`Bu düello sadece ${du.rakip} için.`);
      const [as, bs] = await Promise.all([tx.get(acanRef), tx.get(cuzRef)]);
      if (!bs.exists) throw new Hata("Önce borsaya bir kez gir (cüzdanın açılsın).");
      const a = as.exists ? as.data() : null, b = bs.data();
      if (du.miktar > (b.bkc || 0) + 1e-9) throw new Hata(`Kabul etmek için ${du.miktar} BERKAY lazım.`);
      b.bkc = r6(b.bkc - du.miktar);
      // Sonuç (kriptografik rastgele)
      let kazananAcan, detay;
      if (du.oyun === "zar") {
        let za, zb;
        do { za = randomInt(1, 7); zb = randomInt(1, 7); } while (za === zb);
        kazananAcan = za > zb; detay = { zarAcan: za, zarKabul: zb };
      } else {
        const atis = randomInt(0, 2) === 0 ? "yazi" : "tura";
        kazananAcan = atis === du.secim; detay = { atis };
      }
      const odul = Math.floor(du.miktar * 2 * 0.98 * 100) / 100;
      const kazanan = kazananAcan ? { ad: du.acan, uid: du.acanUid } : { ad: kim.ad, uid: kim.uid };
      if (kazananAcan && a) a.bkc = r6((a.bkc || 0) + odul);
      if (!kazananAcan) b.bkc = r6(b.bkc + odul);
      if (a) a.duelloAcik = Math.max(0, (a.duelloAcik || 1) - 1);
      oyuncuOlay(b, "duello", { kazandi: !kazananAcan, rakip: du.acan }, now);
      if (a) oyuncuOlay(a, "duello", { kazandi: kazananAcan, rakip: kim.ad }, now);
      if (a) tx.set(acanRef, a);
      tx.set(cuzRef, b);
      kasaYaz(tx, du.miktar - odul); // kabul edenin parası kasaya girdi, ödül kasadan çıktı
      tx.update(ref, { durum: "bitti", kabul: kim.ad, kabulUid: kim.uid, kazanan: kazanan.ad, kazananUid: kazanan.uid, odul, ...detay, bitis: now });
      tx.set(db.collection("borsa_log").doc(), { coin: ANA, uid: kim.uid, ad: kim.ad, tur: "kumar", detay: `Düello: ${du.acan} vs ${kim.ad} (${du.miktar}) → kazanan ${kazanan.ad} +${odul}`, bkc: 0, btl: 0, ms: now, tarih: FieldValue.serverTimestamp() });
      return { ok: true, kazandin: !kazananAcan, kazanan: kazanan.ad, odul, ...detay, mesaj: !kazananAcan ? `Kazandın! +${odul} BERKAY 🏆` : `Kaybettin, ${du.acan} kazandı 😬` };
    });
  }
  return null;
}
const KUMAR_ISLEMLERI = ["crashDurum", "ruletDurum", "ruletBahis", "ruletTopla", "slot", "turnuvaDurum", "turnuvaKatil", "turnuvaSkor", "crashBahis", "crashCek", "duelloAc", "duelloKabul", "duelloIptal", "minesBasla", "minesAc", "minesCek", "plinko", "bjBasla", "bjKart", "bjDur", "bjIkiye"];

// ---------------- Ekonomi: kullanıcı işlemleri ----------------
const EKONOMI_ISLEMLERI = ["gorevAl", "gunluk", "oyunSkor", "carkCevir", "tahminBahis"];
async function ekonomiIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const bugun = gunAnahtari(now);
  const cuzRef = db.collection("borsa_cuzdan").doc(kim.uid);
  const ekoRef = db.collection("borsa").doc("ekonomi");
  const okumalar = { c: cuzRef, e: ekoRef };
  let tRef = null, bRef = null;
  if (tur === "tahminBahis") {
    const sec = Math.round(sayi(govde.secenek));
    tRef = db.collection("tahmin").doc(String(govde.id || "-"));
    bRef = db.collection("tahmin_bahis").doc(`${String(govde.id || "-")}_${kim.uid}_${sec}`);
    Object.assign(okumalar, { t: tRef, b: bRef });
  }
  return islem(db, now, okumalar, async ({ tx, d, ek, k }) => {
    const e = ekonomiAyar(ek.e);
    let c = ek.c.exists ? ek.c.data() : null;
    let yeniCuz = false;
    if (!c) { c = cuzdanOlustur(kim, d, now, k); yeniCuz = true; }
    if (tur !== "gunluk" && now - (c.sonIslem || 0) < 700) throw new Hata("Biraz yavaş, çok hızlı işlem yapıyorsun.");
    c.sonIslem = now;
    let cevap = { ok: true };

    if (tur === "gunluk") {
      if (!e.acik) return { ok: true, kapali: true };
      if (c.gunlukSon === bugun) { if (yeniCuz) tx.set(cuzRef, c); return { ok: true, zaten: true, seri: c.seri || 0, cuzdan: cuzdanCevap(c) }; }
      c.seri = c.gunlukSon === oncekiGun(bugun) ? (c.seri || 0) + 1 : 1;
      c.gunlukSon = bugun;
      const seriGun = Math.max(2, Math.round(e.seriGun) || 7);
      const bonus = c.seri % seriGun === 0 ? Math.max(0, e.seriBonus) : 0;
      const odul = kasaTransfer(d, c, Math.max(0, e.gunlukMiktar) + bonus);
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "gunluk", detay: `Günlük ödül +${odul} BERKAY (${c.seri}. gün${bonus ? `, seri bonusu +${bonus}` : ""})`, bkc: odul, btl: 0 });
      cevap = { ok: true, odul, seri: c.seri, bonus, seriGun, yeniCuzdan: yeniCuz, kayitBonusu: yeniCuz ? c.bonus : 0 };
    } else if (tur === "oyunSkor") {
      const oyun = String(govde.oyun || "");
      if (!(oyun in OYUN_UST)) throw new Hata("Bilinmeyen oyun.");
      const skor = Math.max(0, Math.min(OYUN_UST[oyun], Math.round(sayi(govde.skor) || 0)));
      c.rekorlar = Object.assign({}, c.rekorlar || {});
      const eski = c.rekorlar[oyun] || 0;
      let odul = 0;
      if (skor > eski) {
        c.rekorlar[oyun] = skor;
        if (e.acik) {
          c.oyunGun = c.oyunGun && c.oyunGun.tarih === bugun ? Object.assign({}, c.oyunGun) : { tarih: bugun, oyunlar: {} };
          c.oyunGun.oyunlar = Object.assign({}, c.oyunGun.oyunlar || {});
          const kazanilan = c.oyunGun.oyunlar[oyun] || 0;
          const istenen = Math.max(0, Math.min(e.rekorOdul, e.oyunGunlukLimit - kazanilan));
          odul = kasaTransfer(d, c, istenen);
          c.oyunGun.oyunlar[oyun] = kazanilan + odul;
          if (odul > 0) k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "oyun", detay: `${oyun} rekoru ${skor} → +${odul} BERKAY`, bkc: odul, btl: 0 });
        }
      }
      cevap = { ok: true, rekor: skor > eski, eski, skor, odul, limitDoldu: skor > eski && odul === 0 && e.acik };
    } else if (tur === "carkCevir") {
      if (!e.acik) throw new Hata("BERKAY çarkı şu an kapalı.");
      const dilimler = e.carkDilimler;
      if (!dilimler.length) throw new Hata("Çarkta dilim yok (admin).");
      c.carkGun = c.carkGun && c.carkGun.tarih === bugun ? Object.assign({}, c.carkGun) : { tarih: bugun, sayi: 0 };
      const bedavaHak = Math.max(0, e.carkGunlukBedava) + seviyeCarkBonus(seviyeHesap(c.xp));
      const bedava = c.carkGun.sayi < bedavaHak;
      const ucret = bedava ? 0 : Math.max(0, e.carkUcret);
      if (ucret > (c.bkc || 0) + 1e-9) throw new Hata(`Bugünkü bedava hakkın bitti. Çevirmek ${ucret} BERKAY.`);
      kasaTransfer(d, c, -ucret);
      c.carkGun.sayi += 1;
      const toplam = dilimler.reduce((t, x) => t + x.agirlik, 0);
      let r = Math.random() * toplam, index = 0;
      for (; index < dilimler.length - 1; index++) { r -= dilimler[index].agirlik; if (r < 0) break; }
      const dilim = dilimler[index];
      const net = kasaTransfer(d, c, Math.round(sayi(dilim.miktar) || 0));
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "cark", detay: `BERKAY çarkı: "${dilim.ad}" (${net >= 0 ? "+" : ""}${net}${ucret ? `, ücret ${ucret}` : ", bedava"})`, bkc: r6(net - ucret), btl: 0 });
      cevap = { ok: true, index, dilim, miktar: net, ucret, bedavaKalan: Math.max(0, bedavaHak - c.carkGun.sayi) };
    } else if (tur === "gorevAl") {
      // Günlük görev ödülü: bugün seçili görevlerden biri tamamlandıysa ve alınmadıysa
      const gun = gunAnahtari(now);
      const g = gunGorevleri(gun).find((x) => x.id === String(govde.id || ""));
      if (!g) throw new Hata("Bu görev bugün yok.");
      const gv = c.gorev && c.gorev.g === gun ? c.gorev : { g: gun, s: {}, al: [] };
      if ((gv.al || []).includes(g.id)) throw new Hata("Bu görevin ödülünü zaten aldın.");
      if ((gv.s && gv.s[g.id] || 0) < g.hedef) throw new Hata("Görev henüz tamamlanmadı.");
      c.gorev = { g: gun, s: { ...(gv.s || {}) }, al: [...(gv.al || []), g.id] };
      const odul = kasaTransfer(d, c, g.odul);
      oyuncuOlay(c, "gorev", {}, now);
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "gorev", detay: `Görev: "${g.ad}" → +${odul} BERKAY`, bkc: odul, btl: 0 });
      cevap = { ok: true, odul, mesaj: `🎯 Görev tamam: +${odul} BERKAY, +${XP_ODUL.gorev} XP` };
    } else if (tur === "tahminBahis") {
      if (!ek.t.exists) throw new Hata("Tahmin bulunamadı.");
      const t = ek.t.data();
      if (t.durum !== "acik" || (t.kapanis && now > t.kapanis)) throw new Hata("Bu tahmine bahis kapandı.");
      const sec = Math.round(sayi(govde.secenek));
      if (!(sec >= 0 && sec < t.secenekler.length)) throw new Hata("Geçersiz seçenek.");
      const m = Math.round(sayi(govde.miktar) * 100) / 100;
      if (!(m >= 1)) throw new Hata("En az 1 BERKAY yatır.");
      if (m > (c.bkc || 0) + 1e-9) throw new Hata("Yeterli BERKAY'ın yok.");
      kasaTransfer(d, c, -m);
      t.secenekler = t.secenekler.map((x, i) => (i === sec ? { ...x, toplam: r2((x.toplam || 0) + m), kisi: (x.kisi || 0) + (ek.b.exists ? 0 : 1) } : x));
      t.havuz = r2((t.havuz || 0) + m);
      tx.set(ek.t.ref, t);
      const b = ek.b.exists ? ek.b.data() : { tahminId: ek.t.id, uid: kim.uid, ad: kim.ad, secenek: sec, miktar: 0, ilk: now };
      b.miktar = r2(b.miktar + m); b.son = now;
      tx.set(ek.b.ref, b);
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "tahmin", detay: `"${t.soru}" → ${t.secenekler[sec].ad}: ${m} BERKAY yatırdı`, bkc: -m, btl: 0 });
      cevap = { ok: true, mesaj: `${t.secenekler[sec].ad} için ${m} BERKAY yatırdın.` };
    }
    if (tur === "gunluk" && cevap.odul != null) oyuncuOlay(c, "gunluk", { seri: c.seri }, now);
    else if (tur === "oyunSkor") oyuncuOlay(c, "oyun", { oyun: govde.oyun }, now);
    else if (tur === "carkCevir") oyuncuOlay(c, "cark", { miktar: cevap.miktar }, now);
    else if (tur === "tahminBahis") oyuncuOlay(c, "tahmin", {}, now);
    tx.set(cuzRef, c);
    cevap.cuzdan = cuzdanCevap(c);
    return cevap;
  });
}

// ---------------- Ekonomi: admin işlemleri ----------------
async function ekonomiAdminIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const log = (k, detay, ek = {}) => k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "admin", detay, bkc: 0, btl: 0, ...ek });
  const ekoRef = db.collection("borsa").doc("ekonomi");

  if (tur === "adminEkonomi") {
    return islem(db, now, { e: ekoRef }, async ({ tx, ek, k }) => {
      const e = ekonomiAyar(ek.e);
      const sayiAl = (ad, min, max) => {
        if (govde[ad] == null) return;
        const v = sayi(govde[ad]);
        if (!(v >= min && v <= max)) throw new Hata(`${ad} ${min}–${max} arası olmalı.`);
        e[ad] = v;
      };
      if (govde.acik != null) e.acik = !!govde.acik;
      sayiAl("gunlukMiktar", 0, 100000); sayiAl("seriGun", 2, 365); sayiAl("seriBonus", 0, 100000);
      sayiAl("rekorOdul", 0, 100000); sayiAl("oyunGunlukLimit", 0, 1000000);
      sayiAl("carkUcret", 0, 100000); sayiAl("carkGunlukBedava", 0, 100);
      if (Array.isArray(govde.carkDilimler)) {
        const l = govde.carkDilimler.map((x) => ({ ad: String(x.ad || "").trim().slice(0, 20), miktar: Math.round(sayi(x.miktar) || 0), agirlik: Math.max(0, Math.min(1000, sayi(x.agirlik) || 0)) }))
          .filter((x) => x.ad && x.agirlik > 0);
        if (l.length < 2) throw new Hata("Çarka en az 2 dilim ekle (ağırlığı 0'dan büyük).");
        if (l.length > 16) throw new Hata("En fazla 16 dilim.");
        e.carkDilimler = l;
      }
      tx.set(ekoRef, e);
      log(k, `Ekonomi ayarları güncellendi (günlük ${e.gunlukMiktar}, seri ${e.seriGun}. gün +${e.seriBonus}, rekor ${e.rekorOdul}/gün ${e.oyunGunlukLimit}, çark ${e.carkUcret} · ${e.carkDilimler.length} dilim)`);
      return { ok: true, mesaj: "Ekonomi ayarları kaydedildi." };
    });
  }

  if (tur === "adminKozmetik") {
    const cRef = db.collection("borsa_cuzdan").doc(String(govde.uid || "-"));
    return islem(db, now, { c: cRef }, async ({ tx, ek, k }) => {
      if (!ek.c.exists) throw new Hata("Cüzdan yok.");
      const c = ek.c.data();
      c.kozmetik = {};
      tx.set(cRef, c);
      log(k, `${c.ad} kişisinin isim süsleri (renk/rozet/unvan) silindi`);
      return { ok: true, mesaj: `${c.ad}: süsler silindi.` };
    });
  }

  if (tur === "adminTahmin") {
    const alt = govde.alt;
    if (alt === "olustur") {
      const soru = String(govde.soru || "").trim().slice(0, 160);
      const secenekler = (Array.isArray(govde.secenekler) ? govde.secenekler : []).map((x) => String(x || "").trim().slice(0, 40)).filter(Boolean).slice(0, 6);
      const kapanis = Math.round(sayi(govde.kapanis) || 0);
      if (soru.length < 4) throw new Hata("Soruyu yaz.");
      if (secenekler.length < 2) throw new Hata("En az 2 seçenek (ör. Evet, Hayır).");
      if (kapanis && kapanis < now + 60_000) throw new Hata("Kapanış en az 1 dakika sonra olmalı.");
      const ref = db.collection("tahmin").doc();
      return islem(db, now, {}, async ({ tx, k }) => {
        tx.set(ref, { soru, secenekler: secenekler.map((ad) => ({ ad, toplam: 0, kisi: 0 })), havuz: 0, durum: "acik", kapanis: kapanis || 0, olusturma: now, olusturan: kim.ad });
        log(k, `Tahmin açtı: "${soru}" (${secenekler.join(" / ")})`);
        return { ok: true, mesaj: "Tahmin açıldı." };
      });
    }
    const tRef = db.collection("tahmin").doc(String(govde.id || "-"));
    const bahisler = db.collection("tahmin_bahis").where("tahminId", "==", String(govde.id || "-"));
    return islem(db, now, { t: tRef }, async ({ tx, d, ek, k }) => {
      if (!ek.t.exists) throw new Hata("Tahmin bulunamadı.");
      const t = ek.t.data();
      if (alt === "kapat") {
        if (t.durum !== "acik") throw new Hata("Zaten kapalı.");
        t.durum = "kapali"; tx.set(ek.t.ref, t);
        log(k, `Tahmine bahisleri kapattı: "${t.soru}"`);
        return { ok: true, mesaj: "Bahisler kapandı. Sonucu girebilirsin." };
      }
      if (alt === "sil") {
        if (t.durum === "acik" || t.durum === "kapali") throw new Hata("Önce sonuçlandır ya da iptal et (bahisler iade edilmeli).");
        tx.delete(ek.t.ref);
        log(k, `Tahmini sildi: "${t.soru}"`);
        return { ok: true, mesaj: "Silindi." };
      }
      if (alt !== "sonuc" && alt !== "iptal") throw new Hata("Bilinmeyen tahmin işlemi.");
      if (t.durum === "sonuclandi" || t.durum === "iptal") throw new Hata("Bu tahmin zaten bitti.");
      const bs = await tx.get(bahisler);
      const liste = bs.docs.map((x) => ({ ref: x.ref, ...x.data() }));
      const kisiler = [...new Set(liste.map((b) => b.uid))];
      const cuz = {};
      for (const u of kisiler) { const s2 = await tx.get(db.collection("borsa_cuzdan").doc(u)); if (s2.exists) cuz[u] = s2.data(); }
      const kazanan = alt === "sonuc" ? Math.round(sayi(govde.kazanan)) : -1;
      if (alt === "sonuc" && !(kazanan >= 0 && kazanan < t.secenekler.length)) throw new Hata("Kazanan seçeneği seç.");
      const havuz = liste.reduce((s3, b) => s3 + b.miktar, 0);
      const kazananToplam = liste.filter((b) => b.secenek === kazanan).reduce((s3, b) => s3 + b.miktar, 0);
      const iade = alt === "iptal" || kazananToplam <= 0;
      for (const b of liste) {
        let ode = 0;
        if (iade) ode = b.miktar;
        else if (b.secenek === kazanan) ode = r2((b.miktar / kazananToplam) * havuz);
        if (ode > 0 && cuz[b.uid]) kasaTransfer(d, cuz[b.uid], ode);
        tx.update(b.ref, { odenen: ode, sonuc: iade ? "iade" : b.secenek === kazanan ? "kazandi" : "kaybetti" });
      }
      for (const [u, c] of Object.entries(cuz)) tx.set(db.collection("borsa_cuzdan").doc(u), c);
      t.durum = alt === "iptal" ? "iptal" : "sonuclandi";
      t.kazanan = kazanan; t.bitis = now; t.iade = iade;
      tx.set(ek.t.ref, t);
      log(k, alt === "iptal" ? `Tahmini iptal etti, ${r2(havuz)} BERKAY iade: "${t.soru}"` : `Tahmin sonucu: "${t.soru}" → ${t.secenekler[kazanan].ad}${iade ? " (kimse bilemedi, iade)" : `, ${r2(havuz)} BERKAY dağıtıldı`}`);
      return { ok: true, mesaj: alt === "iptal" ? "İptal edildi, herkese iade." : iade ? "Kimse bilemedi, herkese iade edildi." : `Sonuçlandı, ${r2(havuz)} BERKAY kazananlara dağıtıldı.` };
    });
  }

  return null;
}

// ---------------- Admin işlemleri ----------------
async function adminIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const sym = symTemiz(govde.coin);
  const log = (k, detay, ekAlan = {}) => k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "admin", detay: (sym !== ANA ? `[${sym}] ` : "") + detay, bkc: 0, btl: 0, ...ekAlan });
  const { def } = await coinBul(db, sym);

  // Coin ekle / düzenle / kaldır (kayıt: borsa/coinler)
  if (tur === "adminCoin") {
    const ref = db.collection("borsa").doc("coinler");
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const kayitli = snap.exists && Array.isArray(snap.data().liste) ? snap.data().liste : [];
      const yeniSym = symTemiz(govde.sym);
      if (!/^[A-Z0-9]{2,10}$/.test(yeniSym)) throw new Hata("Sembol 2–10 harf/rakam olmalı (ör. KURBAN).");
      const varsayilan = VARSAYILAN_COINLER.find((c) => c.sym === yeniSym);
      const mevcut = coinListesi(snap).find((c) => c.sym === yeniSym);
      let kayit = kayitli.find((c) => c.sym === yeniSym);
      if (govde.sil) {
        if (yeniSym === ANA) throw new Hata("BERKAY silinemez.");
        if (!mevcut) throw new Hata("Böyle bir coin yok.");
        if (kayit) kayit.silindi = true; else kayitli.push({ sym: yeniSym, silindi: true });
        tx.set(ref, { liste: kayitli });
        coinOnbellek = { t: 0, liste: null };
        tx.set(db.collection("borsa_log").doc(), { uid: kim.uid, ad: kim.ad, tur: "admin", detay: `Coin listeden kaldırıldı: ${yeniSym}`, bkc: 0, btl: 0, coin: yeniSym, ms: now, tarih: FieldValue.serverTimestamp() });
        return { ok: true, mesaj: `${yeniSym} listeden kaldırıldı (bakiyeler cüzdanlarda durur, geri eklenince görünür).` };
      }
      const ad = String(govde.ad || "").trim().slice(0, 24);
      const emoji = String(govde.emoji || "").trim().slice(0, 4);
      const renk = /^#[0-9a-fA-F]{6}$/.test(String(govde.renk || "")) ? govde.renk : null;
      const fiyat = sayi(govde.fiyat), derinlik = sayi(govde.derinlik);
      if (!mevcut) {
        if (!ad) throw new Hata("Coin adını yaz.");
        if (!(fiyat > 0 && fiyat < 1e6)) throw new Hata("Başlangıç fiyatı 0 ile 1.000.000 arası olmalı.");
      }
      if (!kayit) { kayit = { sym: yeniSym }; kayitli.push(kayit); }
      delete kayit.silindi;
      if (ad) kayit.ad = ad;
      if (emoji) kayit.emoji = emoji;
      if (renk) kayit.renk = renk;
      if (!mevcut && !varsayilan) {
        kayit.fiyat = fiyat;
        kayit.derinlik = derinlik >= 100 && derinlik <= 1e8 ? derinlik : 10_000;
        kayit.sira = coinListesi(snap).length + 1;
      }
      tx.set(ref, { liste: kayitli });
      coinOnbellek = { t: 0, liste: null };
      tx.set(db.collection("borsa_log").doc(), { uid: kim.uid, ad: kim.ad, tur: "admin", detay: `Coin ${mevcut ? "düzenlendi" : "eklendi"}: ${yeniSym}${ad ? " (" + ad + ")" : ""}`, bkc: 0, btl: 0, coin: yeniSym, ms: now, tarih: FieldValue.serverTimestamp() });
      return { ok: true, mesaj: mevcut ? `${yeniSym} güncellendi.` : `${yeniSym} eklendi! Borsada aranınca çıkar.` };
    });
  }

  if (tur === "adminTransfer") {
    const hedef = String(govde.uid || "");
    if (!hedef) throw new Hata("Kullanıcı seç.");
    const cRef = db.collection("borsa_cuzdan").doc(hedef);
    const kRef = db.collection("kullanicilar").doc(hedef);
    return islem(db, now, { c: cRef, kul: kRef }, async ({ tx, d, ek, k }) => {
      const bkc = r6(sayi(govde.bkc) || 0), btl = r6(sayi(govde.btl) || 0);
      if (!bkc && !btl) throw new Hata("Miktar yaz.");
      let c = ek.c.exists ? ek.c.data() : null;
      if (!c) {
        if (!ek.kul.exists) throw new Hata("Böyle bir kullanıcı yok.");
        c = { uid: hedef, ad: ek.kul.data().kullaniciAdi || "?", bkc: 0, btl: 0, bonus: 0, gerceklesen: 0, olusturma: now, sonIslem: 0 };
      }
      const elde = bakiye(c, sym);
      if (bkc > 0 && bkc > d.kasaBKC) throw new Hata(`Kasada o kadar ${sym} yok. Önce arzı artır.`);
      if (bkc < 0 && -bkc > elde + 1e-9) throw new Hata(`${c.ad} kişisinde o kadar ${sym} yok.`);
      if (btl < 0 && -btl > c.btl + 1e-9) throw new Hata(`${c.ad} kişisinde o kadar USDT yok.`);
      bakiyeYaz(c, sym, elde + bkc); c.btl = r6(c.btl + btl);
      d.kasaBKC = r6(d.kasaBKC - bkc);
      tx.set(cRef, c);
      k.loglar.push({ uid: hedef, ad: c.ad, tur: "admin-transfer", detay: `Admin ${bkc ? (bkc > 0 ? "+" : "") + bkc + " " + sym + " " : ""}${btl ? (btl > 0 ? "+" : "") + btl + " USDT" : ""}`.trim(), bkc: sym === ANA ? bkc : 0, btl });
      return { ok: true, mesaj: `${c.ad}: ${r6(bakiye(c, sym))} ${sym} / ${c.btl} USDT` };
    }, sym, def);
  }

  return islem(db, now, {}, async ({ tx, d, gizli, k }) => {
    if (d.gercek && ["adminGrafikSifirla", "adminFiyat", "adminRota", "adminMM"].includes(tur)) {
      throw new Hata(`${sym} gerçek piyasa fiyatını izliyor: fiyat verme, rota, MM ve grafik sıfırlama bu coinde kapalı.`);
    }
    if (tur === "adminOlay") {
      // Son dakika: başlık + yüzde etki. Fiyat anında değişir, kaldıraçtakiler etkilenir, herkese bant çıkar.
      if (d.gercek) throw new Hata(`${sym} gerçek fiyatlı, olayla oynatılamaz.`);
      const baslik = String(govde.baslik || "").replace(/[<>]/g, "").trim().slice(0, 120);
      const etki = sayi(govde.etki);
      if (baslik.length < 3) throw new Hata("Haberin başlığını yaz.");
      if (!(etki >= -90 && etki <= 500) || !etki) throw new Hata("Etki −90 ile +500 arası (0 olmaz) bir yüzde olmalı.");
      const p0 = d.fiyat;
      d.fiyat = Math.max(1e-6, p0 * (1 + etki / 100));
      mumYaz(d, now, d.fiyat, 0, k.tasanlar);
      if (gizli.mm) { gizli.mm.ort = r6(d.fiyat); k.gizliDegisti = true; } // serbest MM yeni seviyeyi kabul etsin, geri çekmesin
      const olay = { t: now, baslik, etki: r2(etki), sym, f0: r6(p0), f1: r6(d.fiyat) };
      d.olay = olay;
      d.olaylar = [olay, ...(d.olaylar || [])].slice(0, 10);
      akisEkle(d, { t: now, ad: "📰 SON DAKİKA", tur: "olay", m: 0, f: r6(d.fiyat), baslik, etki: r2(etki) });
      tx.set(db.collection("borsa").doc("ozet"), { olay }, { merge: true });
      log(k, `Son dakika: "${baslik}" → ${sym} ${etki > 0 ? "+" : ""}${etki}% (${r6(p0)} → ${r6(d.fiyat)})`);
      return { ok: true, mesaj: `Yayınlandı: ${sym} ${etki > 0 ? "+" : ""}${etki}%` };
    }
    if (tur === "adminGrafikSifirla") {
      // Grafik geçmişini siler, fiyatı başlangıca (varsayılan 1 USDT) çeker.
      // Bakiyeler (BERKAY/USDT adetleri) aynen kalır. Açık pozisyonlar da kalır ama giriş ve
      // büyüklükleri aynı oranda ölçeklenir: herkesin K/Z'si sıfırlamadan önce neyse sonra da odur
      // (long'lar bedava kâra geçmez, short'lar boşuna likide olmaz).
      const yeni = sayi(govde.fiyat ?? BASLANGIC_FIYAT);
      if (!(yeni > 0 && yeni < 1e6)) throw new Hata("Başlangıç fiyatı 0 ile 1.000.000 arası olmalı.");
      const kat = yeni / d.fiyat;
      for (const poz of Object.values(d.poz)) {
        poz.giris = r6(poz.giris * kat);
        poz.boyut = r6(poz.boyut / kat);
        poz.lik = r6(poz.v === 2 ? (poz.yon === "long" ? Math.max(0, poz.giris - (LIK_ORAN * poz.teminat) / poz.boyut) : poz.giris + (LIK_ORAN * poz.teminat) / poz.boyut) : likFiyati(poz, d.derinlik));
      }
      if (gizli.mm && gizli.mm.hedef > 0) gizli.mm.hedef = r6(yeni); // MM yeni başlangıç fiyatını korusun
      if (gizli.mm) gizli.mm.ort = r6(yeni);
      gizli.rota = null;
      k.gizliDegisti = true;
      d.fiyat = yeni;
      d.son = [{ t: Math.floor(now / MUM_MS) * MUM_MS, o: yeni, h: yeni, l: yeni, c: yeni, v: 0 }];
      d.akis = [];
      d.sifirlama = now;
      k.tasanlar.length = 0; // eski mumları gün belgelerine yazma
      k.grafikSil = true;
      log(k, `Grafiği sıfırladı: fiyat ${yeni} USDT (açık ${Object.keys(d.poz).length} pozisyon ×${r6(kat)} ölçeklendi)`);
      return { ok: true, mesaj: `Grafik sıfırlandı, fiyat ${yeni} USDT. Bakiyeler ve pozisyonlar korundu.` };
    }
    if (tur === "adminArz") {
      // Hedef arz: yazılan sayı yeni toplam arz olur. Fazlası önce kasadan, kasa yetmezse
      // kullanıcılardan (ellerindekiyle orantılı) yakılır. Hedef büyükse fark basılıp kasaya eklenir.
      const cuzSnap = await tx.get(db.collection("borsa_cuzdan"));
      const cuz = cuzSnap.docs.map((x) => ({ ref: x.ref, c: x.data() })).filter((x) => bakiye(x.c, sym) > 1e-9);
      const kullanicilarda = r6(cuz.reduce((t, x) => t + bakiye(x.c, sym), 0));
      const gercekArz = r6(d.kasaBKC + kullanicilarda);
      let hedef;
      if (govde.hedef != null && govde.hedef !== "") hedef = r6(sayi(govde.hedef));
      else if (govde.degisim != null) hedef = r6(gercekArz + sayi(govde.degisim)); // eski +/− kutusu
      if (!(hedef >= 0) || !isFinite(hedef)) throw new Hata("Hedef arzı yaz (0 ya da daha büyük).");
      const fark = r6(hedef - gercekArz);
      let kasadan = 0, kullanicidan = 0;
      if (fark > 0) {
        d.kasaBKC = r6(d.kasaBKC + fark);
      } else if (fark < 0) {
        const yak = -fark;
        kasadan = r6(Math.min(Math.max(0, d.kasaBKC), yak));
        d.kasaBKC = r6(d.kasaBKC - kasadan);
        kullanicidan = r6(yak - kasadan);
        if (kullanicidan > 0) {
          if (kullanicidan > kullanicilarda + 1e-6) throw new Hata("Yakılacak kadar coin yok.");
          const oran = kullanicilarda > 0 ? kullanicidan / kullanicilarda : 0;
          let kalan = kullanicidan;
          cuz.sort((a, b) => bakiye(b.c, sym) - bakiye(a.c, sym));
          cuz.forEach((x, i) => {
            const elde = bakiye(x.c, sym);
            const kes = i === cuz.length - 1 ? Math.min(elde, r6(kalan)) : Math.min(elde, r6(elde * oran));
            if (kes <= 0) return;
            kalan = r6(kalan - kes);
            bakiyeYaz(x.c, sym, elde - kes);
            tx.set(x.ref, x.c);
            k.loglar.push({ uid: x.c.uid || x.ref.id, ad: x.c.ad || "?", tur: "admin-yakim", detay: `Arz yakımı: −${r6(kes)} ${sym}`, bkc: sym === ANA ? -r6(kes) : 0, btl: 0 });
          });
        }
      }
      d.toplamArz = hedef;
      log(k, `Arz ${gercekArz} → ${hedef} ${sym}` + (kasadan ? ` · kasadan yakılan ${kasadan}` : "") + (kullanicidan ? ` · kullanıcılardan yakılan ${kullanicidan}` : "") + (fark > 0 ? ` · basılan ${fark}` : ""));
      return { ok: true, mesaj: fark === 0 ? `Arz zaten ${hedef} ${sym}.` : fark > 0 ? `${fark} ${sym} basıldı, toplam arz ${hedef}.` : `${-fark} ${sym} yakıldı (kasadan ${kasadan}${kullanicidan ? ", kullanıcılardan " + kullanicidan : ""}). Toplam arz ${hedef}.` };
    }
    if (tur === "adminCoinSifirla") {
      // Coini komple sıfırla: herkesin elindeki adet 0, açık pozisyonlar kapanır (teminat + K/Z sahibine
      // USDT olarak döner), fiyat başlangıca, arz varsayılana, kasa = arz, grafik silinir.
      if (String(govde.onay || "") !== sym) throw new Hata(`Onay için coin adını (${sym}) yaz.`);
      const cuzSnap = await tx.get(db.collection("borsa_cuzdan"));
      const cuz = new Map(cuzSnap.docs.map((x) => [x.id, { ref: x.ref, c: x.data(), degisti: false }]));
      let kapanan = 0, silinen = 0, kisi = 0;
      for (const poz of Object.values(d.poz)) {
        const kayit = pozKapatIc(d, poz, now, "kapat", k);
        const x = cuz.get(poz.uid);
        if (x) { x.c.btl = r6((x.c.btl || 0) + kayit.iade); x.c.gerceklesen = r2((x.c.gerceklesen || 0) + kayit.pnl); x.degisti = true; }
        kapanan++;
      }
      d.poz = {};
      for (const x of cuz.values()) {
        const elde = bakiye(x.c, sym);
        if (elde > 1e-9) { silinen = r6(silinen + elde); kisi++; bakiyeYaz(x.c, sym, 0); x.degisti = true; }
        if (x.degisti) tx.set(x.ref, x.c);
      }
      const yeni = yeniDurum(now, def);
      const fiyat = govde.fiyat != null && govde.fiyat !== "" ? sayi(govde.fiyat) : yeni.fiyat;
      if (!(fiyat > 0 && fiyat < 1e9)) throw new Hata("Başlangıç fiyatı geçersiz.");
      if (!d.gercek) {
        d.fiyat = fiyat;
        d.son = [{ t: Math.floor(now / MUM_MS) * MUM_MS, o: fiyat, h: fiyat, l: fiyat, c: fiyat, v: 0 }];
        d.saat = [];
        k.tasanlar.length = 0;
        k.grafikSil = true;
        gizli.rota = null; gizli.mm = null; k.gizliDegisti = true;
      }
      d.akis = [];
      d.toplamArz = yeni.toplamArz;
      d.kasaBKC = yeni.toplamArz;
      d.sifirlama = now;
      log(k, `COIN SIFIRLANDI: ${kisi} kişiden ${silinen} ${sym} silindi, ${kapanan} pozisyon kapatıldı, arz ${d.toplamArz}, fiyat ${d.fiyat}`);
      return { ok: true, mesaj: `${sym} sıfırlandı: ${kisi} kişinin ${silinen} ${sym}'ı silindi, ${kapanan} pozisyon kapatıldı. Arz ${d.toplamArz}, fiyat ${d.fiyat}.` };
    }
    if (tur === "adminAyar") {
      if (govde.derinlik != null) {
        const v = sayi(govde.derinlik);
        if (!(v >= 100 && v <= 1e8)) throw new Hata("Derinlik 100 ile 100.000.000 arası olmalı.");
        d.derinlik = v;
      }
      if (govde.oynaklik != null) {
        const v = sayi(govde.oynaklik);
        if (!(v >= 0 && v <= 0.05)) throw new Hata("Oynaklık 0 ile 0.05 arası olmalı.");
        d.oynaklik = v;
      }
      if (govde.maxKaldirac != null) {
        const v = Math.round(sayi(govde.maxKaldirac));
        if (!(v >= 1 && v <= MAX_KALDIRAC)) throw new Hata(`Maksimum kaldıraç 1–${MAX_KALDIRAC} arası olmalı.`);
        d.maxKaldirac = v;
      }
      if (govde.acik != null) d.acik = !!govde.acik;
      for (const p of Object.values(d.poz)) if (p.v !== 2) p.lik = r6(likFiyati(p, d.derinlik));
      log(k, `Ayarlar: derinlik ${d.derinlik}, oynaklık ${d.oynaklik}, max ${d.maxKaldirac}x, piyasa ${d.acik ? "açık" : "kapalı"}`);
      return { ok: true, mesaj: "Ayarlar kaydedildi." };
    }
    if (tur === "adminFiyat") {
      const f = sayi(govde.fiyat);
      if (!(f > 0 && f < 1e9)) throw new Hata("Geçerli bir fiyat yaz.");
      d.fiyat = f;
      mumYaz(d, now, f, 0, k.tasanlar);
      if (gizli.rota) gizli.rota = null;
      if (gizli.mm) gizli.mm.ort = r6(f); // serbest MM yeni fiyattan devam etsin, eskisine çekmesin
      k.gizliDegisti = true;
      log(k, `Fiyatı elle ${f} yaptı`);
      return { ok: true, mesaj: `Fiyat ${f} oldu.` };
    }
    if (tur === "adminRota") {
      if (!govde.noktalar) {
        gizli.rota = null; k.gizliDegisti = true;
        log(k, "Çizilen rotayı sildi");
        return { ok: true, mesaj: "Rota silindi, fiyat serbest." };
      }
      const n = (Array.isArray(govde.noktalar) ? govde.noktalar : [])
        .map((x) => ({ t: Math.round(sayi(x.t)), p: r6(sayi(x.p)) }))
        .filter((x) => x.t > 0 && x.p > 0 && x.p < 1e9)
        .sort((a, b) => a.t - b.t);
      if (n.length < 2) throw new Hata("Rota için en az 2 nokta çiz.");
      if (n.length > 600) throw new Hata("Çok fazla nokta.");
      if (n[n.length - 1].t < now) throw new Hata("Rota geleceğe doğru çizilmeli.");
      if (n[n.length - 1].t - now > 7 * 86400_000) throw new Hata("Rota en fazla 7 gün ileriye çizilebilir.");
      gizli.rota = { noktalar: n, olusturma: now };
      k.gizliDegisti = true;
      log(k, `Fiyat rotası çizdi: ${n[0].p} → ${n[n.length - 1].p} (${Math.round((n[n.length - 1].t - now) / 60000)} dk)`);
      return { ok: true, mesaj: "Rota kaydedildi, fiyat çizgiyi izleyecek." };
    }
    if (tur === "adminMM") {
      const eski = gizli.mm || {};
      const mod = ["serbest", "denge", "al", "sat"].includes(govde.mod) ? govde.mod : "serbest";
      const dakikalik = sayi(govde.dakikalik), hedef = sayi(govde.hedef), bant = sayi(govde.bant);
      const sure = Math.max(5, Math.min(1440, Math.round(sayi(govde.sure) || 60)));
      if (!(dakikalik >= 0 && dakikalik <= 1e7)) throw new Hata("Dakikalık miktar 0 ile 10.000.000 USDT arası olmalı.");
      if (mod === "denge" && !(hedef > 0)) throw new Hata("Denge modu için hedef fiyat yaz.");
      if ((mod === "denge" || mod === "serbest") && !(bant >= 0 && bant <= 90)) throw new Hata("Bant %0 ile %90 arası olmalı.");
      gizli.mm = {
        acik: !!govde.acik, mod, dakikalik, hedef: hedef > 0 ? hedef : null, bant: bant >= 0 ? bant : 2, sure,
        ort: eski.mod === "serbest" && eski.ort > 0 ? eski.ort : r6(d.fiyat),
        alinan: govde.sifirla ? 0 : eski.alinan || 0, satilan: govde.sifirla ? 0 : eski.satilan || 0,
        sonIslem: govde.sifirla ? null : eski.sonIslem || null, guncelleme: now,
      };
      k.gizliDegisti = true;
      const ozet = !govde.acik ? "kapalı" : mod === "serbest" ? `serbest: son ${sure} dk ortalamasından ±%${bant} kopunca törpüler, dakikada en fazla ${dakikalik} USDT` : mod === "denge" ? `denge: hedef ${hedef} ±%${bant}, dakikada en fazla ${dakikalik} USDT` : `her dakika ${dakikalik} USDT ${mod === "al" ? "alım" : "satış"}`;
      log(k, `Piyasa yapıcı: ${ozet}`);
      return { ok: true, mesaj: `Piyasa yapıcı ${ozet}.` };
    }
    if (tur === "adminPozKapat") {
      const poz = d.poz[String(govde.id || "")];
      if (!poz) throw new Hata("Pozisyon bulunamadı.");
      const mod = govde.mod === "likide" ? "likide" : "kapat";
      const cRef = db.collection("borsa_cuzdan").doc(poz.uid);
      const cSnap = await tx.get(cRef).catch(() => null);
      // Not: transaction'da yazmadan önce okumalar bitmeli; buraya kadar yazma yok.
      const kayit = pozKapatIc(d, poz, now, mod, k);
      if (mod === "kapat" && cSnap && cSnap.exists) {
        const c = cSnap.data();
        c.btl = r6((c.btl || 0) + kayit.iade);
        c.gerceklesen = r2((c.gerceklesen || 0) + kayit.pnl);
        tx.set(cRef, c);
      }
      log(k, `${poz.ad} kişisinin ${poz.kaldirac}x ${poz.yon.toUpperCase()} pozisyonunu ${mod === "likide" ? "likide etti" : "kapattı"} (K/Z ${kayit.pnl} USDT)`);
      return { ok: true, mesaj: mod === "likide" ? "Likide edildi." : "Kapatıldı, para sahibine döndü." };
    }
    if (["adminUrun", "adminUrunSil", "adminSiparis"].includes(tur) && sym !== ANA) throw new Hata("Market işlemleri BERKAY ile yapılır.");
    if (tur === "adminUrun") {
      const id = String(govde.id || "").trim() || randomUUID().slice(0, 8);
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) throw new Hata("Geçersiz ürün kimliği.");
      const ad = String(govde.ad || "").trim().slice(0, 80);
      const fiyat = r6(sayi(govde.fiyat));
      const stok = Math.round(sayi(govde.stok ?? -1));
      if (!ad) throw new Hata("Ürün adı yaz.");
      if (!(fiyat > 0)) throw new Hata("Fiyat 0'dan büyük olmalı.");
      if (!(stok >= -1)) throw new Hata("Stok −1 (sınırsız) ya da 0 ve üstü olmalı.");
      if (govde.tur === "renk" && !/^#[0-9a-fA-F]{6}$/.test(String(govde.deger || ""))) throw new Hata("Renk ürünü için değer #RRGGBB olmalı (ör. #e0a100).");
      tx.set(db.collection("borsa_market").doc(id), {
        id, ad, fiyat, stok,
        aciklama: String(govde.aciklama || "").trim().slice(0, 200),
        emoji: String(govde.emoji || "🎁").trim().slice(0, 8) || "🎁",
        aktif: govde.aktif !== false,
        sira: Math.round(sayi(govde.sira) || 99),
        tur: ["renk", "rozet", "unvan"].includes(govde.tur) ? govde.tur : "fiziksel",
        deger: String(govde.deger || "").trim().slice(0, 24),
        sureGun: Math.max(0, Math.round(sayi(govde.sureGun) || 0)),
        olusturma: now,
      }, { merge: true });
      log(k, `Market: ${ad} (${fiyat} BERKAY, stok ${stok < 0 ? "∞" : stok}) kaydedildi`);
      return { ok: true, mesaj: "Ürün kaydedildi." };
    }
    if (tur === "adminUrunSil") {
      const id = String(govde.id || "");
      if (!id) throw new Hata("Ürün seç.");
      tx.delete(db.collection("borsa_market").doc(id));
      log(k, `Market: ${id} silindi`);
      return { ok: true, mesaj: "Ürün silindi." };
    }
    if (tur === "adminSiparis") {
      const ref = db.collection("borsa_siparis").doc(String(govde.id || "-"));
      const s = await tx.get(ref);
      if (!s.exists) throw new Hata("Sipariş bulunamadı.");
      const sip = s.data();
      const yeniDurumu = ["teslim", "bekliyor", "iptal"].includes(govde.durum) ? govde.durum : "teslim";
      if (sip.durum === "iptal") throw new Hata("İptal edilmiş sipariş değiştirilemez.");
      if (yeniDurumu === "iptal") {
        const cRef = db.collection("borsa_cuzdan").doc(sip.uid);
        const cSnap = await tx.get(cRef);
        if (cSnap.exists) {
          const c = cSnap.data();
          c.bkc = r6((c.bkc || 0) + sip.fiyat);
          d.kasaBKC = r6(d.kasaBKC - sip.fiyat);
          tx.set(cRef, c);
        }
      }
      tx.update(ref, { durum: yeniDurumu, guncelleme: now });
      log(k, `Sipariş ${sip.ad} · ${sip.urunAd}: ${yeniDurumu}${yeniDurumu === "iptal" ? ` (${sip.fiyat} BERKAY iade)` : ""}`);
      return { ok: true, mesaj: yeniDurumu === "iptal" ? "İptal edildi, BERKAY iade edildi." : "Güncellendi." };
    }
    throw new Hata("Bilinmeyen admin işlemi.");
  }, sym, def);
}

// ---------------- İtiraf duvarı ----------------
// Anonim: itirafta yazanın uid'si TUTULMAZ. Sadece günlük sınır için gizli anahtarla üretilmiş, geri
// çevrilemeyen bir kısa iz (hash) kullanılır; admin dahil kimse kimin yazdığını göremez.
// itiraf_bekleyen (admin okur) → onaylanınca itiraf_yayin (herkes okur).
const ITIRAF = { MIN: 5, MAX: 280, GUNLUK: 3, TEPKILER: ["😂", "💀", "😳", "🔥", "🤡", "❤️"] };

// =====================================================================
// KOLEKSİYON KARTLARI — paket aç (BERKAY kasaya gider), fazlaları boz, arkadaşla takas et.
//   kart_koleksiyon/{uid} { uid, ad, kartlar: {id: adet}, acilan, setOdul: {set: true} }  (sadece sunucu yazar)
//   kart_teklif/{id} { veren, verenAd, alan, alanAd, ver, iste, durum, t }                (sadece sunucu yazar)
// Görsel katalog js/kart-katalog.js'de; buradaki liste sadece id → nadirlik ve setler (ikisi aynı kaynaktan üretildi).
// =====================================================================
const KART_NADIR = {"85": "efsanevi", "qr": "epik", "3lig": "nadir", "izmir": "nadir", "popeyes": "siradan", "izin": "siradan", "26k": "nadir", "kule": "siradan", "12tl": "efsanevi", "corbaci": "epik", "labanzubu": "nadir", "bayburt": "siradan", "kpss91": "siradan", "cekran": "siradan", "0517": "epik", "100madde": "efsanevi", "aquapark": "nadir", "durum": "siradan", "hasamele": "nadir", "galileo": "siradan", "35saat": "nadir", "201": "siradan", "awuaqoark": "epik", "50video": "siradan", "enver": "nadir", "1ekmek": "efsanevi", "6saat": "nadir", "gelcem": "epik", "kadayif": "siradan", "baskin": "nadir", "8kceket": "epik", "kofteekmek": "nadir", "depoyatma": "siradan", "zanaat": "nadir", "beat": "epik", "zula600": "nadir", "iban": "siradan"};
const KART_SET = {"berkay": ["85", "qr", "3lig", "izmir", "popeyes", "izin", "26k", "kule"], "kurban": ["12tl", "corbaci", "labanzubu", "bayburt", "kpss91", "cekran"], "halil": ["0517", "100madde", "aquapark", "durum", "hasamele", "galileo"], "burger": ["35saat", "201", "awuaqoark", "50video", "enver"], "salih": ["1ekmek", "6saat", "gelcem", "kadayif", "baskin"], "alihan": ["8kceket", "kofteekmek", "depoyatma"], "cem": ["zanaat", "beat"], "alpaslan": ["zula600", "iban"]};
const KART_PAKET = {
  normal: { fiyat: 50, adet: 4, agirlik: { siradan: 62, nadir: 28, epik: 8.5, efsanevi: 1.5 }, garanti: null },
  altin: { fiyat: 250, adet: 4, agirlik: { siradan: 30, nadir: 45, epik: 20, efsanevi: 5 }, garanti: "epik" },
};
const KART_BOZ = { siradan: 5, nadir: 15, epik: 60, efsanevi: 300 };
const KART_SET_ODUL = 200;
const KART_ISLEMLERI = ["kartPaket", "kartBoz", "kartTeklif", "kartKabul", "kartReddet", "kartIptal"];
function kartCek(agirlik, enAz) {
  const sira = ["siradan", "nadir", "epik", "efsanevi"];
  let havuz = sira.filter((n) => !enAz || sira.indexOf(n) >= sira.indexOf(enAz));
  const top = havuz.reduce((t, n) => t + agirlik[n], 0);
  let r = randomInt(0, 1_000_000) / 1_000_000 * top, nadir = havuz[havuz.length - 1];
  for (const n of havuz) { if (r < agirlik[n]) { nadir = n; break; } r -= agirlik[n]; }
  const adaylar = Object.keys(KART_NADIR).filter((id) => KART_NADIR[id] === nadir);
  return adaylar[randomInt(0, adaylar.length)];
}
function kartSetKontrol(kol) {
  // yeni tamamlanan setler için ödül (bir kez)
  kol.setOdul = kol.setOdul || {};
  const yeni = [];
  for (const [set, idler] of Object.entries(KART_SET)) if (!kol.setOdul[set] && idler.every((id) => (kol.kartlar[id] || 0) > 0)) { kol.setOdul[set] = true; yeni.push(set); }
  return yeni;
}
async function kartIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const cuzRef = db.collection("borsa_cuzdan").doc(kim.uid);
  const kolRef = db.collection("kart_koleksiyon").doc(kim.uid);
  const kumarRef = db.collection("borsa").doc("kumar");
  const kasaYaz = (tx, x) => { if (x) tx.set(kumarRef, { bekleyen: FieldValue.increment(r6(x)) }, { merge: true }); };
  const logYaz = (tx, detay, bkc) => tx.set(db.collection("borsa_log").doc(), { coin: ANA, uid: kim.uid, ad: kim.ad, tur: "kart", detay, bkc: r6(bkc), btl: 0, ms: now, tarih: FieldValue.serverTimestamp() });
  const kolBos = () => ({ uid: kim.uid, ad: kim.ad, kartlar: {}, acilan: 0, setOdul: {} });

  if (tur === "kartPaket") {
    const P = KART_PAKET[govde.tip] || KART_PAKET.normal, tip = KART_PAKET[govde.tip] ? govde.tip : "normal";
    return db.runTransaction(async (tx) => {
      const [cs, ks] = await Promise.all([tx.get(cuzRef), tx.get(kolRef)]);
      if (!cs.exists) throw new Hata("Önce borsaya bir kez gir (cüzdanın açılsın).");
      const c = cs.data(), kol = ks.exists ? ks.data() : kolBos();
      kol.ad = kim.ad; kol.kartlar = kol.kartlar || {};
      if ((c.bkc || 0) + 1e-9 < P.fiyat) throw new Hata(`Paket ${P.fiyat} BERKAY, yeterli BERKAY'ın yok.`);
      c.bkc = r6(c.bkc - P.fiyat);
      const cikan = [];
      for (let i = 0; i < P.adet; i++) cikan.push(kartCek(P.agirlik, i === 0 ? P.garanti : null));
      cikan.sort((a, b) => ["siradan", "nadir", "epik", "efsanevi"].indexOf(KART_NADIR[a]) - ["siradan", "nadir", "epik", "efsanevi"].indexOf(KART_NADIR[b]));
      const yeniler = cikan.filter((id) => !(kol.kartlar[id] > 0));
      for (const id of cikan) kol.kartlar[id] = (kol.kartlar[id] || 0) + 1;
      kol.acilan = (kol.acilan || 0) + 1; kol.son = now;
      const setler = kartSetKontrol(kol), odul = setler.length * KART_SET_ODUL;
      c.bkc = r6(c.bkc + odul);
      tx.set(cuzRef, c); tx.set(kolRef, kol);
      kasaYaz(tx, P.fiyat - odul);
      logYaz(tx, `Kart paketi (${tip}): ${cikan.join(", ")}` + (odul ? ` · set ödülü +${odul}` : ""), odul - P.fiyat);
      return { ok: true, cikan, yeniler: [...new Set(yeniler)], setler, odul, kol, cuzdan: cuzdanCevap(c) };
    });
  }
  if (tur === "kartBoz") {
    // fazlalığı boz: 1'den fazla olan kartın bir kopyasını kasaya sat
    const id = String(govde.kart || "");
    if (!KART_NADIR[id]) throw new Hata("Böyle bir kart yok.");
    return db.runTransaction(async (tx) => {
      const [cs, ks] = await Promise.all([tx.get(cuzRef), tx.get(kolRef)]);
      if (!cs.exists || !ks.exists) throw new Hata("Önce bir paket aç.");
      const c = cs.data(), kol = ks.data();
      const adet = Math.max(1, Math.min(99, Math.floor(sayi(govde.adet) || 1)));
      if ((kol.kartlar[id] || 0) - adet < 1) throw new Hata("Sadece fazlalıkları bozabilirsin (en az 1 tane kalmalı).");
      const deger = KART_BOZ[KART_NADIR[id]] * adet;
      kol.kartlar[id] -= adet; c.bkc = r6((c.bkc || 0) + deger);
      tx.set(cuzRef, c); tx.set(kolRef, kol); kasaYaz(tx, -deger);
      logYaz(tx, `Kart bozuldu: ${adet}× ${id} → +${deger}`, deger);
      return { ok: true, deger, kol, cuzdan: cuzdanCevap(c), mesaj: `+${deger} BERKAY` };
    });
  }
  if (tur === "kartTeklif") {
    const ver = String(govde.ver || ""), iste = String(govde.iste || ""), alan = String(govde.alan || "");
    if (!KART_NADIR[ver] || !KART_NADIR[iste]) throw new Hata("Kart seçimi hatalı.");
    if (!alan || alan === kim.uid) throw new Hata("Kime teklif edeceğini seç.");
    const [ks, as] = await Promise.all([kolRef.get(), db.collection("kart_koleksiyon").doc(alan).get()]);
    if (!ks.exists || !((ks.data().kartlar || {})[ver] > 0)) throw new Hata("Vereceğin kart sende yok.");
    if (!as.exists || !((as.data().kartlar || {})[iste] > 0)) throw new Hata("İstediğin kart onda yok.");
    const acik = await db.collection("kart_teklif").where("veren", "==", kim.uid).where("durum", "==", "acik").get();
    if (acik.size >= 10) throw new Hata("En fazla 10 açık teklifin olabilir.");
    const ref = db.collection("kart_teklif").doc();
    await ref.set({ veren: kim.uid, verenAd: kim.ad, alan, alanAd: as.data().ad || "?", ver, iste, durum: "acik", t: now });
    return { ok: true, mesaj: "Teklif gönderildi." };
  }
  if (tur === "kartKabul" || tur === "kartReddet" || tur === "kartIptal") {
    const ref = db.collection("kart_teklif").doc(String(govde.id || "x"));
    return db.runTransaction(async (tx) => {
      const ts = await tx.get(ref);
      if (!ts.exists) throw new Hata("Teklif bulunamadı.");
      const t = ts.data();
      if (t.durum !== "acik") throw new Hata("Bu teklif artık açık değil.");
      if (tur === "kartIptal") { if (t.veren !== kim.uid) throw new Hata("Bu teklif senin değil."); tx.update(ref, { durum: "iptal", bitis: now }); return { ok: true, mesaj: "Teklif geri çekildi." }; }
      if (t.alan !== kim.uid) throw new Hata("Bu teklif sana değil.");
      if (tur === "kartReddet") { tx.update(ref, { durum: "red", bitis: now }); return { ok: true, mesaj: "Reddedildi." }; }
      const vRef = db.collection("kart_koleksiyon").doc(t.veren);
      const vcRef = db.collection("borsa_cuzdan").doc(t.veren);
      const [vs, as, cs, vcs] = await Promise.all([tx.get(vRef), tx.get(kolRef), tx.get(cuzRef), tx.get(vcRef)]);
      const v = vs.exists ? vs.data() : null, a = as.exists ? as.data() : null;
      if (!v || !((v.kartlar || {})[t.ver] > 0)) { tx.update(ref, { durum: "gecersiz", bitis: now }); return { ok: false, hata: "Teklif eden kişide o kart artık yok." }; }
      if (!a || !((a.kartlar || {})[t.iste] > 0)) throw new Hata("İstenen kart sende yok.");
      v.kartlar[t.ver]--; a.kartlar[t.ver] = (a.kartlar[t.ver] || 0) + 1;
      a.kartlar[t.iste]--; v.kartlar[t.iste] = (v.kartlar[t.iste] || 0) + 1;
      const odulA = kartSetKontrol(a).length * KART_SET_ODUL, odulV = kartSetKontrol(v).length * KART_SET_ODUL;
      if (odulA && cs.exists) { const c = cs.data(); c.bkc = r6((c.bkc || 0) + odulA); tx.set(cuzRef, c); }
      if (odulV && vcs.exists) { const c2 = vcs.data(); c2.bkc = r6((c2.bkc || 0) + odulV); tx.set(vcRef, c2); }
      kasaYaz(tx, -(odulA + odulV));
      tx.set(vRef, v); tx.set(kolRef, a); tx.update(ref, { durum: "tamam", bitis: now });
      return { ok: true, mesaj: "Takas tamam! 🤝" + (odulA ? ` Set tamamlandı: +${odulA} BERKAY` : ""), kol: a };
    });
  }
  throw new Hata("Bilinmeyen kart işlemi.");
}

const ITIRAF_ISLEMLERI = ["itirafGonder", "itirafTepki", "adminItiraf"];
function itirafIz(uid) { return createHmac("sha256", crashGizli()).update("itiraf:" + uid).digest("hex").slice(0, 16); }
async function itirafIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const iz = itirafIz(kim.uid);
  if (tur === "itirafGonder") {
    const metin = String(govde.metin || "").replace(/\s+/g, " ").trim();
    if (metin.length < ITIRAF.MIN) throw new Hata("Biraz daha yaz, en az 5 karakter.");
    if (metin.length > ITIRAF.MAX) throw new Hata(`En fazla ${ITIRAF.MAX} karakter.`);
    const limRef = db.collection("itiraf_limit").doc(iz);
    const gun = gunAnahtari(now);
    return db.runTransaction(async (tx) => {
      const l = await tx.get(limRef);
      const v = l.exists && l.data().g === gun ? l.data() : { g: gun, n: 0 };
      if (v.n >= ITIRAF.GUNLUK) throw new Hata(`Günde en fazla ${ITIRAF.GUNLUK} itiraf. Yarın gel 🤐`);
      tx.set(limRef, { g: gun, n: v.n + 1 });
      tx.set(db.collection("itiraf_bekleyen").doc(), { metin, t: now });
      return { ok: true, kalan: ITIRAF.GUNLUK - v.n - 1 };
    });
  }
  if (tur === "itirafTepki") {
    const emoji = String(govde.emoji || "");
    if (!ITIRAF.TEPKILER.includes(emoji)) throw new Hata("Bilinmeyen tepki.");
    const ref = db.collection("itiraf_yayin").doc(String(govde.id || "-"));
    return db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists) throw new Hata("İtiraf bulunamadı.");
      const d = s.data();
      const veren = { ...(d.veren || {}) }, tepki = { ...(d.tepki || {}) };
      const eski = veren[iz];
      if (eski) tepki[eski] = Math.max(0, (tepki[eski] || 0) - 1);
      if (eski === emoji) delete veren[iz]; // aynı tepkiye tekrar basınca geri al
      else { veren[iz] = emoji; tepki[emoji] = (tepki[emoji] || 0) + 1; }
      for (const k of Object.keys(tepki)) if (!tepki[k]) delete tepki[k];
      tx.update(ref, { tepki, veren });
      return { ok: true, tepki, benim: veren[iz] || null };
    });
  }
  if (tur === "adminItiraf") {
    if (!kim.admin) throw new Hata("Bu işlem sadece admin içindir.", 403);
    const id = String(govde.id || "-"), karar = String(govde.karar || "");
    if (karar === "onayla" || karar === "reddet") {
      const bRef = db.collection("itiraf_bekleyen").doc(id);
      return db.runTransaction(async (tx) => {
        const s = await tx.get(bRef);
        if (!s.exists) throw new Hata("Bekleyen itiraf bulunamadı (başka admin karar vermiş olabilir).");
        if (karar === "onayla") {
          const metin = String(govde.metin || s.data().metin).replace(/\s+/g, " ").trim().slice(0, ITIRAF.MAX); // admin küçük düzeltme yapabilir
          tx.set(db.collection("itiraf_yayin").doc(id), { metin, t: s.data().t, yayin: now, tepki: {}, veren: {} });
        }
        tx.delete(bRef);
        return { ok: true };
      });
    }
    if (karar === "sil") { await db.collection("itiraf_yayin").doc(id).delete(); return { ok: true }; }
    throw new Hata("Bilinmeyen karar.");
  }
  throw new Hata("Bilinmeyen işlem.");
}

// ---------------- Admin: oyun rekorlarını sıfırla ----------------
// Spor oyunlarının BERKAY ödülü cüzdandaki kişisel rekora (c.rekorlar[oyun]) bakar; puanlama değişince
// (ör. boksta herkesin 999'u) eski rekorlar sıfırlanmazsa kimse bir daha ödül alamaz.
async function rekorSifirla(db, kim, govde) {
  if (!kim.admin) throw new Hata("Bu işlem sadece admin içindir.", 403);
  const oyun = String(govde.oyun || "");
  if (!(oyun in OYUN_UST)) throw new Hata("Bilinmeyen oyun.");
  const cs = await db.collection("borsa_cuzdan").get();
  let n = 0;
  for (const d of cs.docs) {
    const r = d.data().rekorlar;
    if (r && r[oyun] != null) {
      const yeni = { ...r }; delete yeni[oyun];
      await d.ref.update({ rekorlar: yeni });
      n++;
    }
  }
  return { ok: true, cuzdan: n };
}

// ---------------- Giriş noktası ----------------
const profilOnbellek = new Map();
export default async function handler(req, res) {
  // Crash durumu: GET + Vercel CDN'de 1 sn önbellek → kaç kişi bakarsa baksın saniyede en fazla 1 çalışma.
  // Cevap sadece o anki durumu söyler (düşmeden çöküş noktasını vermez), 1 sn bayat olması bir şey sızdırmaz.
  const getIslem = req.method === "GET" ? String((req.query && req.query.islem) || "") : "";
  if (getIslem === "crashDurum" || getIslem === "ruletDurum") {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=1");
    return res.status(200).json(await kumarIslem(null, null, { islem: getIslem }, Date.now()));
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, hata: "Sadece POST." });
  try {
    let govde = req.body;
    if (typeof govde === "string") { try { govde = JSON.parse(govde); } catch { govde = {}; } }
    govde = govde || {};
    const now = Date.now();
    const tur = String(govde.islem || "");
    // Crash durumu herkese açık ve veritabanına dokunmaz (sık sorulur, kota harcamasın)
    if (tur === "crashDurum" || tur === "ruletDurum") return res.status(200).json(await kumarIslem(null, null, govde, now));

    const { db, auth } = firebase();
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new Hata("Giriş yapmalısın.", 401);
    let karar;
    try { karar = await auth.verifyIdToken(token); } catch { throw new Hata("Oturum süresi dolmuş, sayfayı yenile.", 401); }
    if (karar.firebase && karar.firebase.sign_in_provider === "anonymous") throw new Hata("Borsa için kayıt olman gerekiyor.", 403);
    // Profil (kullanıcı adı + rol) 5 dk önbellekte: her istekte 1 okuma harcanmasın
    let p = profilOnbellek.get(karar.uid);
    if (!p || now - p.t > 300_000) {
      const prof = await db.collection("kullanicilar").doc(karar.uid).get();
      if (!prof.exists) throw new Hata("Borsa için kayıt olman gerekiyor.", 403);
      p = { t: now, ad: prof.data().kullaniciAdi || "?", admin: prof.data().rol === "admin" };
      profilOnbellek.set(karar.uid, p);
    }
    const kim = { uid: karar.uid, ad: p.ad, admin: p.admin };

    let sonuc;
    if (tur === "adminRekorSifirla") {
      sonuc = await rekorSifirla(db, kim, govde);
    } else if (ITIRAF_ISLEMLERI.includes(tur)) {
      sonuc = await itirafIslem(db, kim, govde, now);
    } else if (KART_ISLEMLERI.includes(tur)) {
      sonuc = await kartIslem(db, kim, govde, now);
    } else if (KUMAR_ISLEMLERI.includes(tur)) {
      sonuc = await kumarIslem(db, kim, govde, now);
    } else if (EKONOMI_ISLEMLERI.includes(tur)) {
      sonuc = await ekonomiIslem(db, kim, govde, now);
    } else if (["adminEkonomi", "adminKozmetik", "adminTahmin"].includes(tur)) {
      if (!kim.admin) throw new Hata("Bu işlem sadece admin içindir.", 403);
      sonuc = await ekonomiAdminIslem(db, kim, govde, now);
    } else if (tur.startsWith("admin")) {
      if (!kim.admin) throw new Hata("Bu işlem sadece admin içindir.", 403);
      sonuc = await adminIslem(db, kim, govde, now);
      if (sonuc && sonuc.__grafikSil) { delete sonuc.__grafikSil; await grafikGunleriniSil(db, symTemiz(govde.coin)); }
    } else {
      sonuc = await kullaniciIslem(db, kim, govde, now);
    }
    return res.status(200).json(sonuc);
  } catch (err) {
    if (err instanceof Hata) return res.status(err.kod).json({ ok: false, hata: err.message });
    if (err && (err.code === 8 || /RESOURCE_EXHAUSTED|quota/i.test(String(err.message || err.details || "")))) {
      return res.status(503).json({ ok: false, kota: true, hata: "😴 Site bugünlük ücretsiz veri sınırına ulaştı. Türkiye saatiyle sabah 10:00–11:00 arası geri gelir." });
    }
    console.error("borsa hatası:", err);
    // Gerçek sebebi de göster (hata ayıklamak için; gizli bilgi içermez)
    const neden = String((err && (err.details || err.message)) || err).slice(0, 180);
    return res.status(500).json({ ok: false, hata: "Sunucu hatası: " + neden });
  }
}

// Testler için dışa açık matematik
export const _ic = { kartIslem, KART_NADIR, KART_SET, rekorSifirla, itirafIslem, itirafIz, ruletAn, ruletSonuc, ruletCarpan, slotDegerlendir, SLOT_SEMBOL, SLOT_AGIRLIK, turnuvaOyunu, TURNUVA, minesCarpan, minesBombalar, bjToplam, bjDeste, PLINKO, oyuncuOlay, seviyeHesap, gunGorevleri, haftaAnahtari, GOREVLER, kumarIslem, crashAn, crashNoktasi, CRASH, ozetBelki, ozetHesapla, coinListesi, VARSAYILAN_COINLER, bakiye, ekonomiIslem, ekonomiAdminIslem, EKONOMI_VARSAYILAN, mmAdim, kullaniciIslem, adminIslem, egriAl, egriSat, egriShortAc, egriGeriAl, pozPnl, likFiyati, ilerlet, yeniDurum, mumYaz, likidasyonlar, pozKapatIc, rotaHedef };
