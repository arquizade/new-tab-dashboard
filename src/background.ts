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
        chrome.storage.local
          .set({
            "ntd-config": {
              theme: "dark",
              linksLayout: "grid",
              linkOpenMode: "newTab",
              todosView: "list",
            },
          })
          .catch((err) => console.error("[ntd] Failed to write default config:", err));
      }
    });

    /* Open the new-tab page automatically on first install so the */
    /* user immediately sees the dashboard.                         */
    chrome.tabs
      .create({ url: "chrome://newtab" })
      .catch((err) => console.error("[ntd] Failed to open the new-tab page:", err));
  }

  if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log(`[New Tab Dashboard] Updated to v${chrome.runtime.getManifest().version}`);
  }
});

/* ─── onStartup ─────────────────────────────────────────────── */
/* Fires each time the browser starts with the extension active. */

chrome.runtime.onStartup.addListener(() => {
  console.log("[New Tab Dashboard] Browser started – service worker active.");
});

/* ─── Note Reminders ─────────────────────────────────────────── */
/* Reminders are scheduled as chrome.alarms (created from the new-tab */
/* page when a note is saved with a reminderAt). chrome.alarms persist */
/* across browser restarts, so no rescheduling is needed here — we    */
/* just react when one fires and surface an OS notification.          */

const NOTE_ALARM_PREFIX = "note-reminder-";

interface StoredNote {
  id: string;
  text: string;
  reminderAt?: string;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(NOTE_ALARM_PREFIX)) return;
  const noteId = alarm.name.slice(NOTE_ALARM_PREFIX.length);

  chrome.storage.local.get(["ntd-notes"], (result) => {
    const notes = (result["ntd-notes"] as StoredNote[] | undefined) ?? [];
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    chrome.notifications
      .create(`note-${noteId}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Note reminder",
        message: note.text,
      })
      .catch((err) => console.error("[ntd] Failed to show note reminder:", err));

    /* Clear the reminder so the badge/scheduling doesn't linger. */
    const updated = notes.map((n) => (n.id === noteId ? { ...n, reminderAt: undefined } : n));
    chrome.storage.local
      .set({ "ntd-notes": updated })
      .catch((err) => console.error("[ntd] Failed to clear note reminder:", err));
  });
});
