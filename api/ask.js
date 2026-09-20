// Vercel Serverless Function — /api/ask
// Soruyu Gemini AI'ya gönderir, "Berkay" hakkında esprili/olumsuz bir cevap üretmesini ister.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body || {};

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "Geçersiz soru" });
  }
  if (question.length > 300) {
    return res.status(400).json({ error: "Soru çok uzun" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY tanımlı değil" });
  }

  const systemPrompt = `Sen "yaparmi.com" adlı eğlence/şaka sitesindeki şakacı bir kahinsin.
Kullanıcılar "Berkay" adlı bir kişi hakkında sorular soruyor (ör. "Berkay ders çalışır mı?", "Berkay evlenir mi?", "Berkay zengin olur mu?").

Kurallar:
- Cevabın HER ZAMAN olumsuz olmalı: Berkay başaramaz, yapamaz, beceremez, olmaz tarzında.
- Sorunun içeriğine gönderme yaparak yaratıcı ve esprili bir cevap üret, genel geçme cümleler kurma.
- Türkçe yaz. Tek cümle, en fazla 20-25 kelime.
- Küfür, hakaret veya gerçekten kırıcı/aşağılayıcı ifade KULLANMA. Sadece hafif, arkadaşça dalga geçen bir ton kullan.
- Sadece cevabın kendisini yaz, başka hiçbir açıklama, tırnak işareti veya ön ek ekleme.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 100,
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
      console.error("Gemini API hatası:", response.status, errText);
      return res.status(500).json({
        error: "Gemini API hatası",
        detail: `HTTP ${response.status}: ${errText.slice(0, 300)}`,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.error("Boş cevap döndü, ham veri:", JSON.stringify(data).slice(0, 500));
      return res.status(500).json({
        error: "Boş cevap döndü",
        detail: JSON.stringify(data).slice(0, 300),
      });
    }

    return res.status(200).json({ answer: text });
  } catch (err) {
    console.error("AI cevap hatası:", err.message);
    return res.status(500).json({ error: "AI cevap üretemedi", detail: err.message });
  }
}
