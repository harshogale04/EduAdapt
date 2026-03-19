// popup.js

let selectedProfile = "dyslexia";
let selectedLevel = "moderate";

// --- On Load: restore saved settings ---
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["grade", "profile", "level"], (data) => {
    if (data.grade) document.getElementById("grade").value = data.grade;
    if (data.profile) setProfile(data.profile);
    if (data.level) setLevel(data.level);
  });
});

// --- Profile Toggle ---
document.querySelectorAll(".profile-toggle button").forEach((btn) => {
  btn.addEventListener("click", () => setProfile(btn.dataset.profile));
});

function setProfile(profile) {
  selectedProfile = profile;
  document.querySelectorAll(".profile-toggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.profile === profile);
  });
}

// --- Support Level Toggle ---
document.querySelectorAll(".support-levels button").forEach((btn) => {
  btn.addEventListener("click", () => setLevel(btn.dataset.level));
});

function setLevel(level) {
  selectedLevel = level;
  document.querySelectorAll(".support-levels button").forEach((b) => {
    b.classList.toggle("active", b.dataset.level === level);
  });
}

// --- Transform Button ---
document.getElementById("transform-btn").addEventListener("click", async () => {
  const grade = document.getElementById("grade").value;

  chrome.storage.local.set({ grade, profile: selectedProfile, level: selectedLevel });

  const btn = document.getElementById("transform-btn");
  btn.disabled = true;
  btn.textContent = "⏳ Transforming...";
  showStatus("");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(
    tab.id,
    {
      action: "TRANSFORM",
      settings: { grade, profile: selectedProfile, level: selectedLevel },
    },
    (response) => {
      btn.disabled = false;
      btn.textContent = "✨ Transform Page";
      if (response?.success) {
        showStatus("✅ Page transformed!", "#10b981");
      } else {
        showStatus("❌ Something went wrong.", "red");
      }
    }
  );
});

// --- Restore Button ---
document.getElementById("restore-btn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "RESTORE" }, () => {
    showStatus("↩ Original page restored.", "#888");
  });
});

function showStatus(msg, color = "#10b981") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = color;
}