/* ─── Background Service Worker ─────────────────────────────── */
/* Runs in the extension background context (not the new-tab page) */

/* ─── onInstalled ───────────────────────────────────────────── */
/* Fires the first time the extension is installed or updated.   */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    /* Set sensible defaults into storage so the dashboard always  */
    /* has a valid baseline config even before the user opens it.  */
    chrome.storage.local.get(["ntd-config"], (result) => {
      if (!result["ntd-config"]) {
        chrome.storage.local.set({
          "ntd-config": {
            theme: "dark",
            linksLayout: "grid",
          },
        });
      }
    });

    /* Open the new-tab page automatically on first install so the */
    /* user immediately sees the dashboard.                         */
    chrome.tabs.create({ url: "chrome://newtab" });
  }

  if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log(
      `[New Tab Dashboard] Updated to v${chrome.runtime.getManifest().version}`,
    );
  }
});

/* ─── onStartup ─────────────────────────────────────────────── */
/* Fires each time the browser starts with the extension active. */

chrome.runtime.onStartup.addListener(() => {
  console.log("[New Tab Dashboard] Browser started – service worker active.");
});
