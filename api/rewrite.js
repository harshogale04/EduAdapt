// api/rewrite.js
// Vercel serverless function — proxies requests to Gemini API
// Environment variables needed in Vercel dashboard:
//   GEMINI_API_KEY   → your Gemini API key
//   EXTENSION_SECRET → a random string you make up e.g. "eduadapt-2024-xyz"

export default async function handler(req, res) {

  // CORS headers — required for Chrome extensions
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-extension-secret");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Abuse protection: check shared secret ---
  const secret = req.headers["x-extension-secret"];
  if (secret !== process.env.EXTENSION_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { text, grade, profile, level } = req.body;

  // Basic input validation
  if (!text || !grade || !profile || !level) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (text.length > 4000) {
    return res.status(400).json({ error: "Text too long" });
  }

  const prompt = buildPrompt(text, grade, profile, level);

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini error:", data);
      return res.status(502).json({ error: "Gemini API error" });
    }

    const rewritten = data.candidates?.[0]?.content?.parts?.[0]?.text || text;
    return res.status(200).json({ rewritten });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// --- Prompt Engineering ---
function buildPrompt(text, grade, profile, level) {
  const gradeLabel = gradeToLabel(grade);

  if (profile === "dyslexia") {
    const intensity = {
      light: "Simplify slightly. Use shorter sentences (max 15 words). Avoid jargon.",
      moderate: "Simplify significantly. Use short sentences (max 12 words). Use common everyday words. Break long paragraphs into smaller ones of 2-3 sentences.",
      full: "Rewrite completely for a student who struggles with reading. Use very short sentences (max 8 words). Use only the simplest words possible. One idea per sentence.",
    }[level];

    return `You are an assistive reading tool helping a ${gradeLabel} student with dyslexia.
Rewrite the following text so it is easier to read.
Rules:
- ${intensity}
- Keep the meaning exactly the same.
- Do NOT add any commentary, headers, or notes.
- Return ONLY the rewritten text, nothing else.

Text to rewrite:
"""
${text}
"""`;
  }

  if (profile === "adhd") {
    const intensity = {
      light: "Add bold to key terms. Break into shorter paragraphs.",
      moderate: "Convert into a structured format: start with a 2-sentence TL;DR summary, then use bullet points for the main ideas. Bold key terms.",
      full: "Convert into a highly structured format: a 1-sentence summary, then a numbered checklist of all key points, each point no longer than one line. Remove all filler words.",
    }[level];

    return `You are an assistive reading tool helping a ${gradeLabel} student with ADHD.
Rewrite the following text to improve focus and comprehension.
Rules:
- ${intensity}
- Keep all important information.
- Do NOT add any commentary or notes explaining what you did.
- Return ONLY the rewritten content, nothing else.

Text to rewrite:
"""
${text}
"""`;
  }

  return text;
}

function gradeToLabel(grade) {
  const map = {
    "1": "Grade 1-2 (age 6-8)",
    "3": "Grade 3-4 (age 8-10)",
    "5": "Grade 5-6 (age 10-12)",
    "7": "Grade 7-8 (age 12-14)",
    "9": "Grade 9-10 (age 14-16)",
  };
  return map[grade] || "elementary school";
}