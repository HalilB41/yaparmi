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
import { randomUUID } from "node:crypto";

const BASLANGIC_ARZ = 1_000_000;
const KAYIT_BONUSU = 200; // BERKAY
const BASLANGIC_FIYAT = 1; // 1 BERKAY = 1 USDT
const ADIM_MS = 10_000; // fiyat her 10 saniyede bir adım atar
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
    const [dSnap, gSnap] = await Promise.all([tx.get(durumRef), tx.get(gizliRef)]);
    const ek = {};
    for (const [ad, ref] of Object.entries(ekOkumalar || {})) ek[ad] = await tx.get(ref);
    const yeni = !dSnap.exists;
    const d = yeni ? yeniDurum(now, def) : dSnap.data();
    d.sym = sym;
    if (yeni && def && def.gercek) { d.gercek = true; d.son = []; d.sonTick = now - SON_MUM * MUM_MS; }
    d.poz = d.poz || {};
    d.akis = d.akis || [];
    d.son = d.son || [];
    const gizli = gSnap.exists ? gSnap.data() : { rota: null, mm: null };
    const k = { tasanlar: [], liste: [], gizliDegisti: false, loglar: [], grafikSil: false, dis };
    if (d.gercek && !dis && yeni) throw new Hata(`${sym} gerçek fiyatı şu an alınamadı, birazdan tekrar dene.`, 503);
    ilerlet(d, gizli, now, k);
    const sonuc = await hesapla({ tx, d, gizli, ek, k });
    likidasyonlar(d, now, k);
    d.rotaVar = !!(gizli && gizli.rota);

    // yazmalar
    tx.set(durumRef, d);
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
async function coinBul(db, sym) {
  const liste = coinListesi(await db.collection("borsa").doc("coinler").get());
  const def = liste.find((c) => c.sym === sym);
  if (!def) throw new Hata(`${sym} diye bir coin yok.`);
  return { def, liste };
}
function pozOzet(p) { return { ...p }; }

// ---------------- Kullanıcı işlemleri ----------------
async function kullaniciIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const cuzRef = db.collection("borsa_cuzdan").doc(kim.uid);

  if (tur === "tick" || tur === "tickHepsi") {
    // tick: tek coin · tickHepsi: listedeki bütün coinler (coin listesi sayfası açıkken)
    const liste = coinListesi(await db.collection("borsa").doc("coinler").get());
    const hedefler = tur === "tick" ? liste.filter((c) => c.sym === symTemiz(govde.coin)) : liste;
    // Sırayla (paralel değil): gerçek coinlere geçiş bütün cüzdanları kilitliyor, aynı anda koşarsa birbirini kilitler
    const hatalar = [];
    for (const def of hedefler) {
      const snap = await db.collection("borsa").doc(durumId(def.sym)).get();
      if (snap.exists && now - (snap.data().sonTick || 0) < ADIM_MS) continue;
      await islem(db, now, {}, async () => null, def.sym, def).catch((e) => { hatalar.push(def.sym + ": " + (e && e.message)); console.error("tick " + def.sym, e); });
    }
    return hatalar.length ? { ok: true, hatalar } : { ok: true };
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

    tx.set(ek.c.ref, c);
    return { ok: true, mesaj, cuzdan: cuzdanCevap(c), ...ekCevap };
  }, sym, def);
}

// ---------------- Ekonomi: kullanıcı işlemleri ----------------
const EKONOMI_ISLEMLERI = ["gunluk", "oyunSkor", "carkCevir", "tahminBahis"];
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
      const bedava = c.carkGun.sayi < Math.max(0, e.carkGunlukBedava);
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
      cevap = { ok: true, index, dilim, miktar: net, ucret, bedavaKalan: Math.max(0, e.carkGunlukBedava - c.carkGun.sayi) };
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
      const deg = r6(sayi(govde.degisim));
      if (!deg) throw new Hata("Değişim miktarı yaz.");
      if (d.kasaBKC + deg < 0) throw new Hata(`Kasada yakılacak kadar ${sym} yok.`);
      d.toplamArz = r6(d.toplamArz + deg);
      d.kasaBKC = r6(d.kasaBKC + deg);
      log(k, `Arz ${deg > 0 ? "artırıldı" : "yakıldı"}: ${deg > 0 ? "+" : ""}${deg} ${sym} → toplam ${d.toplamArz}`);
      return { ok: true, mesaj: `Toplam arz: ${d.toplamArz} ${sym}` };
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

// ---------------- Giriş noktası ----------------
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, hata: "Sadece POST." });
  try {
    const { db, auth } = firebase();
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new Hata("Giriş yapmalısın.", 401);
    let karar;
    try { karar = await auth.verifyIdToken(token); } catch { throw new Hata("Oturum süresi dolmuş, sayfayı yenile.", 401); }
    if (karar.firebase && karar.firebase.sign_in_provider === "anonymous") throw new Hata("Borsa için kayıt olman gerekiyor.", 403);
    const prof = await db.collection("kullanicilar").doc(karar.uid).get();
    if (!prof.exists) throw new Hata("Borsa için kayıt olman gerekiyor.", 403);
    const kim = { uid: karar.uid, ad: prof.data().kullaniciAdi || "?", admin: prof.data().rol === "admin" };

    let govde = req.body;
    if (typeof govde === "string") { try { govde = JSON.parse(govde); } catch { govde = {}; } }
    govde = govde || {};
    const now = Date.now();
    const tur = String(govde.islem || "");

    let sonuc;
    if (EKONOMI_ISLEMLERI.includes(tur)) {
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
    console.error("borsa hatası:", err);
    // Gerçek sebebi de göster (hata ayıklamak için; gizli bilgi içermez)
    const neden = String((err && (err.details || err.message)) || err).slice(0, 180);
    return res.status(500).json({ ok: false, hata: "Sunucu hatası: " + neden });
  }
}

// Testler için dışa açık matematik
export const _ic = { coinListesi, VARSAYILAN_COINLER, bakiye, ekonomiIslem, ekonomiAdminIslem, EKONOMI_VARSAYILAN, mmAdim, kullaniciIslem, adminIslem, egriAl, egriSat, egriShortAc, egriGeriAl, pozPnl, likFiyati, ilerlet, yeniDurum, mumYaz, likidasyonlar, pozKapatIc, rotaHedef };
