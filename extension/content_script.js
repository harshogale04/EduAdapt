// content_script.js
// Runs on every page. Extracts paragraphs, sends to background for rewriting,
// then injects the transformed text back into the DOM.

let originalContents = new Map(); // paragraphElement -> original innerHTML
let isTransformed = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "TRANSFORM") {
    handleTransform(message.settings).then(sendResponse);
    return true;
  }

  if (message.action === "RESTORE") {
    restoreOriginal();
    sendResponse({ success: true });
  }
});

async function handleTransform(settings) {
  // If already transformed, restore first
  if (isTransformed) restoreOriginal();

  // Get all meaningful paragraphs on the page
  // Prioritise above-the-fold first (better perceived performance)
  const paragraphs = getParagraphs();

  if (paragraphs.length === 0) {
    return { success: false, error: "No readable text found on this page." };
  }

  let anyFailed = false;

  for (const p of paragraphs) {
    const originalText = p.innerText.trim();
    if (originalText.length < 40) continue; // Skip very short snippets

    // Save original so we can restore later
    originalContents.set(p, p.innerHTML);

    // Show a loading shimmer while waiting for Gemini
    p.style.opacity = "0.4";
    p.style.transition = "opacity 0.3s";

    // Send text to background service worker for Gemini rewrite
    const response = await chrome.runtime.sendMessage({
      action: "REWRITE",
      text: originalText,
      settings,
    });

    if (response?.success && response.rewritten) {
      // Render the rewritten text with a highlight border
      p.innerHTML = formatRewritten(response.rewritten, settings.profile);
      p.style.opacity = "1";
      p.style.borderLeft = "3px solid #4f46e5";
      p.style.paddingLeft = "10px";
      p.style.transition = "all 0.3s";
    } else {
      // Restore this paragraph if Gemini failed
      p.innerHTML = originalContents.get(p);
      p.style.opacity = "1";
      anyFailed = true;
    }
  }

  isTransformed = true;
  return { success: !anyFailed };
}

function restoreOriginal() {
  originalContents.forEach((html, el) => {
    el.innerHTML = html;
    el.style.borderLeft = "";
    el.style.paddingLeft = "";
    el.style.opacity = "1";
  });
  originalContents.clear();
  isTransformed = false;
}

// --- Paragraph Extraction ---
// Targets <p> tags with real content. Skips nav, footer, script, etc.
function getParagraphs() {
  const skipTags = new Set(["SCRIPT", "STYLE", "NAV", "FOOTER", "HEADER", "ASIDE"]);

  const allP = Array.from(document.querySelectorAll("p, li, td"));

  return allP.filter((el) => {
    // Skip if inside a blocked element
    let parent = el.parentElement;
    while (parent) {
      if (skipTags.has(parent.tagName)) return false;
      parent = parent.parentElement;
    }
    // Must have enough text to be worth rewriting
    return el.innerText.trim().length > 40;
  });
}

// --- Format rewritten text nicely ---
// For ADHD mode, Gemini returns markdown-ish bullet points — we render them as HTML
function formatRewritten(text, profile) {
  if (profile === "adhd") {
    // Convert markdown bullet points to <ul><li>
    const lines = text.split("\n").filter((l) => l.trim());
    const items = lines.map((line) => {
      line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"); // bold
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return `<li>${line.slice(2)}</li>`;
      }
      if (/^\d+\.\s/.test(line)) {
        return `<li>${line.replace(/^\d+\.\s/, "")}</li>`;
      }
      return `<p>${line}</p>`;
    });

    // Wrap consecutive <li> in <ul>
    const html = items
      .join("")
      .replace(/(<\/li>)(<p>|$)/g, "$1</ul>$2")
      .replace(/(<p>|^)(<li>)/g, "$1<ul>$2");

    return html;
  }

  // Dyslexia mode: just clean paragraphs
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p>${l}</p>`)
    .join("");
}