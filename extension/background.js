// background.js — Service Worker
// Calls our Vercel proxy instead of Gemini directly.
// No API key lives here anymore.

// --- CONFIG ---
// Replace with your actual Vercel deployment URL after deploying
const PROXY_URL = "https://eduadapt67.vercel.app/api/rewrite";

// Shared secret — must match EXTENSION_SECRET in your Vercel env vars
const EXTENSION_SECRET = "eduadapt-secret-123";

const cache = new Map(); // Simple in-memory cache

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "REWRITE") {
    handleRewrite(message).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleRewrite({ text, settings }) {
  const { grade, profile, level } = settings;

  // Cache key — no API key needed in the hash anymore
  const cacheKey = `${grade}-${profile}-${level}-${hashText(text)}`;
  if (cache.has(cacheKey)) {
    return { success: true, rewritten: cache.get(cacheKey) };
  }

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-extension-secret": EXTENSION_SECRET,  // Abuse protection
      },
      body: JSON.stringify({ text, grade, profile, level }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Proxy error:", data);
      return { success: false };
    }

    cache.set(cacheKey, data.rewritten);
    return { success: true, rewritten: data.rewritten };

  } catch (err) {
    console.error("Fetch error:", err);
    return { success: false };
  }
}

// Simple hash for cache keys
function hashText(str) {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 200); i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}