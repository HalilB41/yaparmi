// Vercel Serverless Function — /api/ask
// Soruyu bir AI'ya gönderir, "Berkay" hakkında esprili/olumsuz bir cevap
// üretmesini ister. Önce Nous Research (varsa NOUS_API_KEY), o başarısız
// olursa Gemini (varsa GEMINI_API_KEY) dener. İkisi de yoksa/başarısız
// olursa hata döner, istemci (script.js) kendi yedek cevaplarına geçer.

const CATEGORY_HINTS = {
  genel: "Soru Berkay'ın hayatının herhangi bir alanıyla ilgili olabilir.",
  ders: "Soru okul, ders çalışma, sınav, ödev gibi eğitim hayatıyla ilgili. Cevabında okul/ders temalı esprili bir başarısızlık senaryosu kur.",
  spor: "Soru spor, antrenman, maç, fitness gibi konularla ilgili. Cevabında spor temalı esprili bir başarısızlık senaryosu kur.",
  oyun: "Soru video oyunları, bilgisayar/telefon oyunları, e-spor gibi konularla ilgili. Cevabında oyun temalı esprili bir başarısızlık senaryosu kur.",
  sosyal: "Soru arkadaşlık, sosyal hayat, aşk, çıkma teklifi, parti gibi konularla ilgili. Cevabında sosyal hayatla ilgili esprili bir başarısızlık senaryosu kur.",
};

function buildSystemPrompt(category) {
  const hint = CATEGORY_HINTS[category] || CATEGORY_HINTS.genel;
  return `Sen "yaparmi.com" adlı eğlence/şaka sitesindeki şakacı bir kahinsin.
Kullanıcılar "Berkay" adlı bir kişi hakkında sorular soruyor (ör. "Berkay ders çalışır mı?", "Berkay evlenir mi?").

${hint}

Kurallar:
- Cevabın HER ZAMAN olumsuz olmalı: Berkay başaramaz, yapamaz, beceremez, olmaz tarzında.
- Sorunun içeriğine gönderme yaparak yaratıcı ve esprili bir cevap üret, genel geçme cümleler kurma.
- Türkçe yaz. Tek cümle, en fazla 20-25 kelime.
- Küfür, hakaret veya gerçekten kırıcı/aşağılayıcı ifade KULLANMA. Sadece hafif, arkadaşça dalga geçen bir ton kullan.
- Sadece cevabın kendisini yaz, başka hiçbir açıklama, tırnak işareti veya ön ek ekleme.`;
}

// ---------------- Nous Research (Hermes) ----------------

// Nous zaman zaman modelleri emekliye ayırıp yeni sürümler çıkarıyor
// (ör. Hermes-4-70B → Hermes-4.3-36B). Bu yüzden tek bir model adına
// güvenmek yerine sırayla birkaç adayı deniyoruz; biri "retired/emekli"
// ya da 404 dönerse otomatik bir sonrakine geçiyoruz.
const NOUS_MODEL_CANDIDATES = [
  process.env.NOUS_MODEL,
  "Hermes-4.3-36B",
  "Hermes-4-405B",
  "Hermes-4-70B",
].filter(Boolean);

async function askNousWithModel(model, apiKey, messages, maxTokens) {
  const response = await fetch("https://inference-api.nousresearch.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 1.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return {
      ok: false,
      retryable: response.status === 404 || /retired/i.test(errText),
      detail: `Nous (${model}) HTTP ${response.status}: ${errText.slice(0, 300)}`,
    };
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return {
      ok: false,
      retryable: false,
      detail: `Nous (${model}) boş cevap döndü: ` + JSON.stringify(data).slice(0, 300),
    };
  }
  return { ok: true, answer: text };
}

async function askNous(question, systemPrompt) {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Nous atlandı: NOUS_API_KEY tanımlı değil" };

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  const tried = [];
  for (const model of NOUS_MODEL_CANDIDATES) {
    if (tried.includes(model)) continue;
    tried.push(model);
    const result = await askNousWithModel(model, apiKey, messages, 150);
    if (result.ok) return result;
    if (!result.retryable) return result;
    // "retired"/404 ise sıradaki modeli dene
  }
  return { ok: false, detail: `Nous: denenen modellerin hepsi başarısız (${tried.join(", ")})` };
}

// ---------------- Google Gemini ----------------

async function askGemini(question, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, detail: "Gemini atlandı: GEMINI_API_KEY tanımlı değil" };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nSoru: ${question}` }],
          },
        ],
        generationConfig: {
          temperature: 1.1,
          maxOutputTokens: 500,
          thinkingConfig: { thinkingBudget: 0 },
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    return { ok: false, detail: `Gemini HTTP ${response.status}: ${errText.slice(0, 300)}` };
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    return { ok: false, detail: "Gemini boş cevap döndü: " + JSON.stringify(data).slice(0, 300) };
  }
  return { ok: true, answer: text };
}

// ---------------- Handler ----------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, category } = req.body || {};

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "Geçersiz soru" });
  }
  if (question.length > 300) {
    return res.status(400).json({ error: "Soru çok uzun" });
  }

  const systemPrompt = buildSystemPrompt(typeof category === "string" ? category : "genel");
  const attempts = [];

  try {
    const nous = await askNous(question, systemPrompt);
    if (nous.ok) return res.status(200).json({ answer: nous.answer, provider: "nous" });
    attempts.push(nous.detail || "Nous: bilinmeyen hata");
  } catch (err) {
    attempts.push("Nous hata: " + err.message);
  }

  try {
    const gemini = await askGemini(question, systemPrompt);
    if (gemini.ok) return res.status(200).json({ answer: gemini.answer, provider: "gemini" });
    attempts.push(gemini.detail || "Gemini: bilinmeyen hata");
  } catch (err) {
    attempts.push("Gemini hata: " + err.message);
  }

  console.error("Tüm AI sağlayıcıları başarısız:", attempts);
  return res.status(500).json({
    error: "AI cevap üretemedi",
    detail: attempts.join(" | "),
  });
}
