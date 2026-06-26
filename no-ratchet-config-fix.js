function normalizeNoRatchetModelForConfigFix(model) {
  const text = String(model || "").trim().toUpperCase().replace(/\s+/g, " ");
  const match = text.match(/^(CX|UX)\s*-?\s*(\d+)/);
  if (!match) return text;
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

function isNoRatchetConfigModelForFix() {
  const model = normalizeNoRatchetModelForConfigFix(document.getElementById("confModel")?.value || "");
  return model === "CX-07" || model === "UX-19";
}

function ensureNoRatchetConfigOptionForFix() {
  const select = document.getElementById("sel固鎖");
  if (!select) return null;

  let option = select.querySelector('option[value="-"]');
  if (!option) {
    option = document.createElement("option");
    option.value = "-";
    option.textContent = "無固鎖（-）";
    select.insertBefore(option, select.children[1] || null);
  }

  return select;
}

function applyNoRatchetConfigValueForFix() {
  if (!isNoRatchetConfigModelForFix()) return;

  const select = ensureNoRatchetConfigOptionForFix();
  if (!select) return;

  if (!select.value) {
    select.value = "-";
  }
}

function wrapAddConfigForNoRatchet() {
  if (typeof window.addConfig !== "function") {
    setTimeout(wrapAddConfigForNoRatchet, 100);
    return;
  }

  if (window.addConfig.__noRatchetConfigFixWrapped) return;

  const originalAddConfig = window.addConfig;

  window.addConfig = function () {
    applyNoRatchetConfigValueForFix();
    return originalAddConfig.apply(this, arguments);
  };

  window.addConfig.__noRatchetConfigFixWrapped = true;
}

function installNoRatchetConfigFix() {
  const modelInput = document.getElementById("confModel");
  const select = ensureNoRatchetConfigOptionForFix();

  if (modelInput) {
    modelInput.addEventListener("input", applyNoRatchetConfigValueForFix);
    modelInput.addEventListener("change", applyNoRatchetConfigValueForFix);
  }

  if (select) {
    select.addEventListener("focus", applyNoRatchetConfigValueForFix);
  }

  wrapAddConfigForNoRatchet();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installNoRatchetConfigFix);
} else {
  installNoRatchetConfigFix();
}
