const WHATSAPP_ORIGIN = "https://web.whatsapp.com";

function sanitizeWhatsAppUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.origin !== WHATSAPP_ORIGIN || url.pathname !== "/send") {
    throw new Error("Only WhatsApp Web send URLs are allowed.");
  }

  const phone = (url.searchParams.get("phone") || "").replace(/\D/g, "");
  if (!phone) throw new Error("Missing WhatsApp phone number.");

  const clean = new URL(`${WHATSAPP_ORIGIN}/send`);
  clean.searchParams.set("phone", phone);

  const text = url.searchParams.get("text");
  if (text) clean.searchParams.set("text", text);

  return clean.href;
}

function focusTab(tab, sendResponse) {
  if (!tab.id) {
    sendResponse({ ok: false, error: "Missing tab id." });
    return;
  }

  chrome.tabs.update(tab.id, { active: true }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (typeof tab.windowId === "number") {
      chrome.windows.update(tab.windowId, { focused: true }, () => {
        sendResponse({ ok: !chrome.runtime.lastError, reused: true });
      });
      return;
    }

    sendResponse({ ok: true, reused: true });
  });
}

function openWhatsApp(rawUrl, sendResponse) {
  let url;
  try {
    url = sanitizeWhatsAppUrl(rawUrl);
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Invalid URL." });
    return;
  }

  chrome.tabs.query({ url: `${WHATSAPP_ORIGIN}/*` }, (tabs) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    const existingTab = tabs.find((tab) => tab.id && (tab.url || tab.pendingUrl || "").startsWith(WHATSAPP_ORIGIN));
    if (existingTab?.id) {
      chrome.tabs.update(existingTab.id, { url, active: true }, () => focusTab(existingTab, sendResponse));
      return;
    }

    chrome.tabs.create({ url, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      focusTab(tab, sendResponse);
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "OPEN_WHATSAPP") return false;
  openWhatsApp(message.url, sendResponse);
  return true;
});