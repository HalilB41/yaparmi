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
//   TL     → nakit. BERKAY'ın fiyatı TL cinsinden. Spot'ta BERKAY satınca TL
//          gelir, TL ile BERKAY alınır. Kaldıraçta teminat TL'dir.
//
// ---------------- Fiyat nasıl oluşur? ----------------
//   Her alım fiyatı yükseltir, her satış düşürür:  fiyat × e^(±TL / derinlik)
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
//             dakikada en fazla "dakikalık" TL kadar alır/satar
//     al / sat → her dakika "dakikalık" TL kadar alır / satar
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
// ============================================================

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";

const BASLANGIC_ARZ = 1_000_000;
const KAYIT_BONUSU = 200; // BERKAY
const BASLANGIC_FIYAT = 1; // 1 BERKAY = 1 TL
const ADIM_MS = 10_000; // fiyat her 10 saniyede bir adım atar
const MUM_MS = 60_000; // 1 dakikalık mumlar
const SON_MUM = 240; // durum belgesinde tutulan son mum sayısı (4 saat)
const MAX_GERI_MS = 6 * 3600_000; // kimse yokken en fazla 6 saati geriye dönük hesapla
const LIK_ORAN = 0.9; // teminatın %90'ı erirse likidasyon
const MAX_ACIK_POZ = 5; // kişi başı aynı anda açık pozisyon
const MAX_KALDIRAC = 20;
const MAX_POZ_ORAN = 0.5; // tek pozisyon en fazla derinliğin yarısı kadar büyüklükte (fiyatı en fazla ~%65 iter)
const AKIS_SAY = 25;

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
// N TL harcayıp BERKAY almak: gelen BERKAY ve yeni fiyat
function egriAl(p, N, D) { return { q: (D / p) * (1 - Math.exp(-N / D)), p1: p * Math.exp(N / D) }; }
// q BERKAY satmak: gelen TL ve yeni fiyat
function egriSat(p, q, D) { const x = (q * p) / D; return { N: D * Math.log1p(x), p1: p / (1 + x) }; }
// N TL'lik short açmak: satılan (ödünç) BERKAY ve yeni fiyat
function egriShortAc(p, N, D) { return { q: (D / p) * Math.expm1(N / D), p1: p * Math.exp(-N / D) }; }
// q BERKAY'ı geri almak (short kapatma): ödenen TL ve yeni fiyat
function egriGeriAl(p, q, D) { const x = Math.min((q * p) / D, 0.98); return { N: -D * Math.log1p(-x), p1: p / (1 - x) }; }

// Pozisyon şu an kapatılsa kâr/zarar (TL) — kapanışın fiyatı itmesini de hesaba katar
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
function yeniDurum(now) {
  return {
    fiyat: BASLANGIC_FIYAT,
    toplamArz: BASLANGIC_ARZ,
    kasaBKC: BASLANGIC_ARZ,
    derinlik: 10_000,
    oynaklik: 0.003,
    maxKaldirac: MAX_KALDIRAC,
    acik: true,
    sonTick: now,
    son: [{ t: Math.floor(now / MUM_MS) * MUM_MS, o: BASLANGIC_FIYAT, h: BASLANGIC_FIYAT, l: BASLANGIC_FIYAT, c: BASLANGIC_FIYAT, v: 0 }],
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

// Pozisyonu eğri üzerinden kapat (fiyatı iter); kullanıcıya dönecek TL'yi döndürür
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
    id: poz.id, uid: poz.uid, ad: poz.ad, yon: poz.yon, kaldirac: poz.kaldirac, teminat: r2(poz.teminat),
    notional: r2(poz.notional), boyut: r6(poz.boyut), giris: r6(poz.giris), cikis: r6(cikis),
    pnl: r2(gercekPnl), yuzde: r2((gercekPnl / poz.teminat) * 100), iade: r2(iade),
    acilis: poz.acilis, kapanis: t, sebep,
  };
  kapananlar.liste.push(kayit);
  return kayit;
}

// Piyasa yapıcı: dakikada bir işlem. Döndürdüğü TL: + alım, − satım
function mmAdim(d, mm) {
  if (!mm || !mm.acik) return 0;
  const D = d.derinlik, p = d.fiyat, max = Math.max(0, sayi(mm.dakikalik) || 0);
  if (!max) return 0;
  let N = 0;
  if (mm.mod === "al") N = max;
  else if (mm.mod === "sat") N = -max;
  else {
    const h = sayi(mm.hedef), bant = Math.max(0, sayi(mm.bant) || 0) / 100;
    if (!(h > 0)) return 0;
    if (p < h * (1 - bant)) N = Math.min(max, D * Math.log(h / p)); // hedefe çıkmak için gereken alım
    else if (p > h * (1 + bant)) N = -Math.min(max, D * Math.log(p / h));
  }
  if (Math.abs(N) < 1e-6) return 0;
  if (N > 0) d.fiyat = egriAl(p, N, D).p1;
  else { const q = (D / p) * Math.expm1(-N / D); d.fiyat = Math.max(1e-6, egriSat(p, q, D).p1); }
  return N;
}

// Zamanı "şimdi"ye kadar ilerlet: oynaklık + rota + likidasyonlar
function ilerlet(d, gizli, now, kapananlar) {
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

// ---------------- İşlem çatısı ----------------
// Her işlem bir Firestore transaction içinde: önce okumalar, sonra hesap, sonra yazmalar.
async function islem(db, now, ekOkumalar, hesapla) {
  const durumRef = db.collection("borsa").doc("durum");
  const gizliRef = db.collection("borsa").doc("gizli");
  return db.runTransaction(async (tx) => {
    const [dSnap, gSnap] = await Promise.all([tx.get(durumRef), tx.get(gizliRef)]);
    const ek = {};
    for (const [ad, ref] of Object.entries(ekOkumalar || {})) ek[ad] = await tx.get(ref);
    const yeni = !dSnap.exists;
    const d = yeni ? yeniDurum(now) : dSnap.data();
    d.poz = d.poz || {};
    d.akis = d.akis || [];
    d.son = d.son || [];
    const gizli = gSnap.exists ? gSnap.data() : { rota: null, mm: null };
    const k = { tasanlar: [], liste: [], gizliDegisti: false, loglar: [] };
    ilerlet(d, gizli, now, k);
    const sonuc = await hesapla({ tx, d, gizli, ek, k });
    likidasyonlar(d, now, k);
    d.rotaVar = !!(gizli && gizli.rota);

    // yazmalar
    tx.set(durumRef, d);
    if (k.gizliDegisti || !gSnap.exists) tx.set(gizliRef, { rota: gizli.rota || null, mm: gizli.mm || null });
    if (yeni) for (const u of BASLANGIC_URUNLER) tx.set(db.collection("borsa_market").doc(u.id), { ...u, olusturma: now });
    const gunler = {};
    for (const m of k.tasanlar) (gunler[gunAnahtari(m.t)] ||= []).push(m);
    for (const [gun, mumlar] of Object.entries(gunler)) {
      tx.set(db.collection("borsa_grafik").doc(gun), { m: FieldValue.arrayUnion(...mumlar) }, { merge: true });
    }
    for (const kayit of k.liste) {
      tx.set(db.collection("borsa_gecmis").doc(kayit.id), kayit);
      if (kayit.sebep === "likide") {
        k.loglar.push({ uid: kayit.uid, ad: kayit.ad, tur: "likidasyon", detay: `${kayit.kaldirac}x ${kayit.yon.toUpperCase()} likide oldu (−${kayit.teminat} TL teminat)`, btl: 0, bkc: 0 });
      }
    }
    for (const l of k.loglar) tx.set(db.collection("borsa_log").doc(), { ...l, ms: now, tarih: FieldValue.serverTimestamp() });
    return sonuc;
  });
}

function cuzdanCevap(c) {
  return c ? { bkc: r6(c.bkc || 0), btl: r6(c.btl || 0), gerceklesen: r2(c.gerceklesen || 0), bonus: c.bonus || 0 } : null;
}
function pozOzet(p) { return { ...p }; }

// ---------------- Kullanıcı işlemleri ----------------
async function kullaniciIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const cuzRef = db.collection("borsa_cuzdan").doc(kim.uid);

  if (tur === "tick") {
    const snap = await db.collection("borsa").doc("durum").get();
    if (snap.exists && now - (snap.data().sonTick || 0) < ADIM_MS) return { ok: true };
    await islem(db, now, {}, async () => null);
    return { ok: true };
  }

  if (tur === "baslat") {
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
  return islem(db, now, urunRef ? { c: cuzRef, u: urunRef } : { c: cuzRef }, async ({ tx, d, ek, k }) => {
    if (!ek.c.exists) throw new Hata("Önce borsaya giriş yap (cüzdanın yok).");
    const c = ek.c.data();
    if (now - (c.sonIslem || 0) < 700) throw new Hata("Biraz yavaş, çok hızlı işlem yapıyorsun.");
    c.sonIslem = now;
    const D = d.derinlik;
    let mesaj = "", ekCevap = {};

    if (tur !== "marketAl" && !d.acik) throw new Hata("Piyasa şu an kapalı.");

    if (tur === "spotAl") {
      const N = r6(sayi(govde.btl));
      if (!(N > 0)) throw new Hata("Geçerli bir TL miktarı yaz.");
      if (N > c.btl + 1e-9) throw new Hata("Yeterli TL'n yok.");
      const r = egriAl(d.fiyat, N, D);
      if (r.q > d.kasaBKC) throw new Hata("Kasada bu kadar BERKAY kalmadı.");
      c.btl = r6(c.btl - N); c.bkc = r6(c.bkc + r.q);
      d.kasaBKC = r6(d.kasaBKC - r.q);
      d.fiyat = r.p1;
      mumYaz(d, now, d.fiyat, N, k.tasanlar);
      akisEkle(d, { t: now, ad: kim.ad, tur: "al", m: r2(N), q: r6(r.q), f: r6(d.fiyat) });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "spot-al", detay: `${r6(r.q)} BERKAY aldı (${r2(N)} TL)`, bkc: r6(r.q), btl: -N });
      mesaj = `${r.q.toFixed(4)} BERKAY aldın.`;
      ekCevap = { q: r6(r.q), ort: r6(N / r.q) };
    } else if (tur === "spotSat") {
      const q = r6(sayi(govde.bkc));
      if (!(q > 0)) throw new Hata("Geçerli bir BERKAY miktarı yaz.");
      if (q > c.bkc + 1e-9) throw new Hata("Yeterli BERKAY'ın yok.");
      const r = egriSat(d.fiyat, q, D);
      c.bkc = r6(c.bkc - q); c.btl = r6(c.btl + r.N);
      d.kasaBKC = r6(d.kasaBKC + q);
      d.fiyat = Math.max(1e-6, r.p1);
      mumYaz(d, now, d.fiyat, r.N, k.tasanlar);
      akisEkle(d, { t: now, ad: kim.ad, tur: "sat", m: r2(r.N), q, f: r6(d.fiyat) });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "spot-sat", detay: `${q} BERKAY sattı (${r2(r.N)} TL)`, bkc: -q, btl: r6(r.N) });
      mesaj = `${q} BERKAY sattın, ${r.N.toFixed(2)} TL geldi.`;
      ekCevap = { N: r6(r.N), ort: r6(r.N / q) };
    } else if (tur === "pozAc") {
      const yon = govde.yon === "short" ? "short" : "long";
      const x = Math.round(sayi(govde.kaldirac));
      const M = r6(sayi(govde.teminat));
      const maxX = Math.min(MAX_KALDIRAC, d.maxKaldirac || MAX_KALDIRAC);
      if (!(x >= 1 && x <= maxX)) throw new Hata(`Kaldıraç 1x ile ${maxX}x arası olmalı.`);
      if (!(M >= 1)) throw new Hata("Teminat en az 1 TL olmalı.");
      if (M > c.btl + 1e-9) throw new Hata("Yeterli TL'n yok. Spot'tan BERKAY satıp TL alabilirsin.");
      const acik = Object.values(d.poz).filter((p) => p.uid === kim.uid).length;
      if (acik >= MAX_ACIK_POZ) throw new Hata(`Aynı anda en fazla ${MAX_ACIK_POZ} pozisyon açabilirsin.`);
      const N = M * x;
      if (N > D * MAX_POZ_ORAN) throw new Hata(`Pozisyon büyüklüğü (teminat × kaldıraç) en fazla ${Math.floor(D * MAX_POZ_ORAN)} TL olabilir. Teminatı ya da kaldıracı düşür.`);
      const r = yon === "long" ? egriAl(d.fiyat, N, D) : egriShortAc(d.fiyat, N, D);
      const id = randomUUID().replace(/-/g, "").slice(0, 16);
      const poz = { id, uid: kim.uid, ad: kim.ad, yon, kaldirac: x, teminat: M, notional: r6(N), boyut: r6(r.q), giris: r6(N / r.q), acilis: now };
      poz.lik = r6(likFiyati(poz, D));
      d.poz[id] = poz;
      c.btl = r6(c.btl - M);
      d.fiyat = Math.max(1e-6, r.p1);
      mumYaz(d, now, d.fiyat, N, k.tasanlar);
      akisEkle(d, { t: now, ad: kim.ad, tur: yon, x, m: r2(N), f: r6(d.fiyat) });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "poz-ac", detay: `${x}x ${yon.toUpperCase()} açtı · teminat ${M} TL · büyüklük ${r2(N)} TL`, bkc: 0, btl: -M });
      mesaj = `${x}x ${yon.toUpperCase()} açıldı. Ortalama giriş ${poz.giris.toFixed(4)}`;
      ekCevap = { poz: pozOzet(poz) };
    } else if (tur === "pozKapat") {
      const poz = d.poz[String(govde.id || "")];
      if (!poz || poz.uid !== kim.uid) throw new Hata("Pozisyon bulunamadı (likide olmuş olabilir).");
      const kayit = pozKapatIc(d, poz, now, "kapat", k);
      c.btl = r6(c.btl + kayit.iade);
      c.gerceklesen = r2((c.gerceklesen || 0) + kayit.pnl);
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "poz-kapat", detay: `${poz.kaldirac}x ${poz.yon.toUpperCase()} kapattı · K/Z ${kayit.pnl >= 0 ? "+" : ""}${kayit.pnl} TL (%${kayit.yuzde})`, bkc: 0, btl: kayit.iade });
      mesaj = `Pozisyon kapandı: ${kayit.pnl >= 0 ? "+" : ""}${kayit.pnl.toFixed(2)} TL`;
      ekCevap = { sonuc: kayit };
    } else if (tur === "marketAl") {
      if (!ek.u.exists) throw new Hata("Ürün bulunamadı.");
      const u = ek.u.data();
      if (!u.aktif) throw new Hata("Bu ürün şu an satışta değil.");
      if (u.stok === 0) throw new Hata("Stokta kalmadı.");
      const f = r6(sayi(u.fiyat));
      if (c.bkc + 1e-9 < f) throw new Hata(`Yeterli BERKAY'ın yok (${f} BERKAY gerekiyor).`);
      c.bkc = r6(c.bkc - f);
      d.kasaBKC = r6(d.kasaBKC + f);
      if (typeof u.stok === "number" && u.stok > 0) tx.update(ek.u.ref, { stok: u.stok - 1 });
      const sipRef = db.collection("borsa_siparis").doc();
      tx.set(sipRef, { uid: kim.uid, ad: kim.ad, urunId: ek.u.id, urunAd: u.ad, emoji: u.emoji || "🎁", fiyat: f, ms: now, tarih: FieldValue.serverTimestamp(), durum: "bekliyor" });
      k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "market", detay: `${u.emoji || "🎁"} ${u.ad} aldı (${f} BERKAY)`, bkc: -f, btl: 0 });
      mesaj = `${u.emoji || "🎁"} ${u.ad} senin! Admin teslim edecek.`;
    } else {
      throw new Hata("Bilinmeyen işlem.");
    }

    tx.set(ek.c.ref, c);
    return { ok: true, mesaj, cuzdan: cuzdanCevap(c), ...ekCevap };
  });
}

// ---------------- Admin işlemleri ----------------
async function adminIslem(db, kim, govde, now) {
  const tur = govde.islem;
  const log = (k, detay, ekAlan = {}) => k.loglar.push({ uid: kim.uid, ad: kim.ad, tur: "admin", detay, bkc: 0, btl: 0, ...ekAlan });

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
      if (bkc > 0 && bkc > d.kasaBKC) throw new Hata("Kasada o kadar BERKAY yok. Önce arzı artır.");
      if (bkc < 0 && -bkc > c.bkc + 1e-9) throw new Hata(`${c.ad} kişisinde o kadar BERKAY yok.`);
      if (btl < 0 && -btl > c.btl + 1e-9) throw new Hata(`${c.ad} kişisinde o kadar TL yok.`);
      c.bkc = r6(c.bkc + bkc); c.btl = r6(c.btl + btl);
      d.kasaBKC = r6(d.kasaBKC - bkc);
      tx.set(cRef, c);
      k.loglar.push({ uid: hedef, ad: c.ad, tur: "admin-transfer", detay: `Admin ${bkc ? (bkc > 0 ? "+" : "") + bkc + " BERKAY " : ""}${btl ? (btl > 0 ? "+" : "") + btl + " TL" : ""}`.trim(), bkc, btl });
      return { ok: true, mesaj: `${c.ad}: ${c.bkc} BERKAY / ${c.btl} TL` };
    });
  }

  return islem(db, now, {}, async ({ tx, d, gizli, k }) => {
    if (tur === "adminArz") {
      const deg = r6(sayi(govde.degisim));
      if (!deg) throw new Hata("Değişim miktarı yaz.");
      if (d.kasaBKC + deg < 0) throw new Hata("Kasada yakılacak kadar BERKAY yok.");
      d.toplamArz = r6(d.toplamArz + deg);
      d.kasaBKC = r6(d.kasaBKC + deg);
      log(k, `Arz ${deg > 0 ? "artırıldı" : "yakıldı"}: ${deg > 0 ? "+" : ""}${deg} BERKAY → toplam ${d.toplamArz}`);
      return { ok: true, mesaj: `Toplam arz: ${d.toplamArz} BERKAY` };
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
      if (gizli.rota) { gizli.rota = null; k.gizliDegisti = true; }
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
      const mod = ["denge", "al", "sat"].includes(govde.mod) ? govde.mod : "denge";
      const dakikalik = sayi(govde.dakikalik), hedef = sayi(govde.hedef), bant = sayi(govde.bant);
      if (!(dakikalik >= 0 && dakikalik <= 1e7)) throw new Hata("Dakikalık miktar 0 ile 10.000.000 TL arası olmalı.");
      if (mod === "denge" && !(hedef > 0)) throw new Hata("Denge modu için hedef fiyat yaz.");
      if (mod === "denge" && !(bant >= 0 && bant <= 90)) throw new Hata("Bant %0 ile %90 arası olmalı.");
      gizli.mm = {
        acik: !!govde.acik, mod, dakikalik, hedef: hedef > 0 ? hedef : null, bant: bant >= 0 ? bant : 2,
        alinan: govde.sifirla ? 0 : eski.alinan || 0, satilan: govde.sifirla ? 0 : eski.satilan || 0,
        sonIslem: govde.sifirla ? null : eski.sonIslem || null, guncelleme: now,
      };
      k.gizliDegisti = true;
      const ozet = !govde.acik ? "kapalı" : mod === "denge" ? `denge: hedef ${hedef} ±%${bant}, dakikada en fazla ${dakikalik} TL` : `her dakika ${dakikalik} TL ${mod === "al" ? "alım" : "satış"}`;
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
      log(k, `${poz.ad} kişisinin ${poz.kaldirac}x ${poz.yon.toUpperCase()} pozisyonunu ${mod === "likide" ? "likide etti" : "kapattı"} (K/Z ${kayit.pnl} TL)`);
      return { ok: true, mesaj: mod === "likide" ? "Likide edildi." : "Kapatıldı, para sahibine döndü." };
    }
    if (tur === "adminUrun") {
      const id = String(govde.id || "").trim() || randomUUID().slice(0, 8);
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) throw new Hata("Geçersiz ürün kimliği.");
      const ad = String(govde.ad || "").trim().slice(0, 80);
      const fiyat = r6(sayi(govde.fiyat));
      const stok = Math.round(sayi(govde.stok ?? -1));
      if (!ad) throw new Hata("Ürün adı yaz.");
      if (!(fiyat > 0)) throw new Hata("Fiyat 0'dan büyük olmalı.");
      if (!(stok >= -1)) throw new Hata("Stok −1 (sınırsız) ya da 0 ve üstü olmalı.");
      tx.set(db.collection("borsa_market").doc(id), {
        id, ad, fiyat, stok,
        aciklama: String(govde.aciklama || "").trim().slice(0, 200),
        emoji: String(govde.emoji || "🎁").trim().slice(0, 8) || "🎁",
        aktif: govde.aktif !== false,
        sira: Math.round(sayi(govde.sira) || 99),
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
  });
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
    if (tur.startsWith("admin")) {
      if (!kim.admin) throw new Hata("Bu işlem sadece admin içindir.", 403);
      sonuc = await adminIslem(db, kim, govde, now);
    } else {
      sonuc = await kullaniciIslem(db, kim, govde, now);
    }
    return res.status(200).json(sonuc);
  } catch (err) {
    if (err instanceof Hata) return res.status(err.kod).json({ ok: false, hata: err.message });
    console.error("borsa hatası:", err);
    return res.status(500).json({ ok: false, hata: "Sunucu hatası, tekrar dene." });
  }
}

// Testler için dışa açık matematik
export const _ic = { mmAdim, kullaniciIslem, adminIslem, egriAl, egriSat, egriShortAc, egriGeriAl, pozPnl, likFiyati, ilerlet, yeniDurum, mumYaz, likidasyonlar, pozKapatIc, rotaHedef };
