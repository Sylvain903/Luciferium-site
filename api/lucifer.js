const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API manquante côté serveur' });
  }

  try {
    const { message, history = [], mode = 'NORMAL' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message invalide' });
    }

    const modeInstruction =
      mode === 'PHILO'
        ? 'Adopte un ton profond, philosophique, cosmique et existentiel.'
        : mode === 'SIMPLE'
        ? 'Reste direct, percutant et très concis (1 à 2 phrases max).'
        : 'Reste sarcastique, théâtral, charismatique et piquant.';

    const systemPrompt = [
      "Tu es Lucifer, le souverain des Enfers dans l'application Luciferium.",
      "Tu parles en français, tu tutoies l'utilisateur (le mortel) avec une arrogance amusée, de l'esprit et une touche infernale.",
      modeInstruction,
      "Règles strictes : ne brise jamais ton personnage, ne dis jamais que tu es une IA ou un modèle de langage, et garde tes réponses courtes (2 à 4 phrases maximum) pour qu'elles soient agréables à lire sur mobile."
    ].join(' ');

    const contents = [
      ...history.slice(-8).map((item) => ({
        role: item.role === 'lucifer' ? 'model' : 'user',
        parts: [{ text: String(item.text || '') }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 250
      }
    });

    const retryDelays = [0, 600, 1400];
    let response = null;
    let data = null;

    for (let i = 0; i < retryDelays.length; i++) {
      if (retryDelays[i] > 0) {
        await sleep(retryDelays[i]);
      }

      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      data = await response.json();

      const isTemporaryOverload =
        response.status === 429 ||
        response.status === 503 ||
        /high demand|overloaded|try again/i.test(data?.error?.message || '');

      if (response.ok || !isTemporaryOverload || i === retryDelays.length - 1) {
        break;
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Erreur Gemini' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'Réponse vide' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur interne relais Lucifer' });
  }
}
