// Shared PWA install handler. Works from the homepage and nested game pages.
let deferredInstallPrompt = null;
const installButton = document.getElementById("installAppButton");
const installScriptUrl = document.currentScript
  ? document.currentScript.src
  : new URL("js/install.js", document.baseURI).href;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const arcadeRoot = new URL("../", installScriptUrl); // install.js is inside /js/
    const swUrl = new URL("service-worker.js", arcadeRoot);
    navigator.serviceWorker
      .register(swUrl.href, { scope: arcadeRoot.pathname })
      .catch((error) => {
        console.warn("App install support needs localhost or HTTPS:", error);
      });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installButton) {
    installButton.textContent = "✓ INSTALLED";
    installButton.disabled = true;
  }
});

if (installButton) {
  installButton.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return;
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;
    if (standalone) {
      installButton.textContent = "✓ INSTALLED";
      installButton.disabled = true;
      return;
    }
    alert(
      "To install Ohm Arcade, open it in Chrome or Edge using localhost or HTTPS, then choose 'Install app' or 'Add to Home screen' from the browser menu.",
    );
  });
}
