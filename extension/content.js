const APP_SOURCE = "prospector-ai";
const EXTENSION_SOURCE = "prospector-whatsapp-extension";

function notifyReady() {
  window.postMessage({ source: EXTENSION_SOURCE, type: "READY" }, window.location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== APP_SOURCE) return;

  if (event.data.type === "PING") {
    notifyReady();
    return;
  }

  if (event.data.type !== "OPEN_WHATSAPP") return;

  chrome.runtime.sendMessage(
    { type: "OPEN_WHATSAPP", url: event.data.url },
    (response) => {
      window.postMessage({
        source: EXTENSION_SOURCE,
        type: "OPEN_WHATSAPP_RESULT",
        requestId: event.data.requestId,
        ok: response?.ok === true,
        error: response?.error,
      }, window.location.origin);
    },
  );
});

notifyReady();