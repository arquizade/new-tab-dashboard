import { el, escapeHtml } from "../utils/dom";
import { genId } from "../utils/id";
import { addDragHandlers, reorderItems, DRAG_HANDLE_SVG } from "../utils/drag";
import { state, saveLinks } from "../state";
import { registerShortcut } from "./keyboard";
import { showToast } from "./toast";
import type { StorageAdapter } from "../types";

/* ─── Favicon ────────────────────────────────────────────────── */

interface FaviconSources {
  primary: string;
  fallback: string;
}

/**
 * Returns a primary URL (Chrome's _favicon API when inside the extension) and
 * a fallback URL (Google S2 favicons) so the caller can swap on error.
 */
function getFavicon(url: string): FaviconSources | null {
  try {
    const { hostname } = new URL(url);
    const googleFallback = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      return {
        primary: `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`,
        fallback: googleFallback,
      };
    }

    // Not running as an installed extension — use Google S2 directly for both
    return { primary: googleFallback, fallback: googleFallback };
  } catch {
    return null;
  }
}

/* ─── Search State ───────────────────────────────────────────── */

let linksQuery = "";

export function resetLinksQuery(): void {
  linksQuery = "";
}

/* ─── Render ─────────────────────────────────────────────────── */

export function renderLinks(storage: StorageAdapter): void {
  const grid = el("linksGrid");
  const empty = el("linksEmpty");
  grid.innerHTML = "";

  const q = linksQuery.trim().toLowerCase();
  const visible = q
    ? state.links.filter(
        (l) =>
          l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q),
      )
    : state.links;

  if (visible.length === 0) {
    empty.classList.remove("hidden");
    empty.textContent =
      state.links.length === 0
        ? "No links yet. Add your first one."
        : `No links match "${linksQuery.trim()}".`;
    return;
  }
  empty.classList.add("hidden");

  visible.forEach((link) => {
    const a = document.createElement("a");
    a.className = "link-card";
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    let displayUrl = "";
    try {
      displayUrl = new URL(link.url).hostname.replace("www.", "");
    } catch {
      displayUrl = link.url;
    }

    // Build text/structure content without favicon (inline onerror violates CSP)
    a.innerHTML = `
      ${DRAG_HANDLE_SVG}
      <span class="link-card-title">${escapeHtml(link.title)}</span>
      <span class="link-card-url">${escapeHtml(displayUrl)}</span>
      <button class="card-delete" data-id="${link.id}" title="Remove">×</button>
    `;

    // Attach favicon via DOM so we can use addEventListener instead of inline onerror.
    // Try the Chrome _favicon API first; fall back to Google S2 on error.
    // Only hide the image if the fallback also fails.
    const favicon = getFavicon(link.url);
    if (favicon) {
      const img = document.createElement("img");
      img.className = "link-card-favicon";
      img.src = favicon.primary;
      img.alt = "";
      let triedFallback = false;
      img.addEventListener("error", () => {
        if (!triedFallback && img.src !== favicon.fallback) {
          triedFallback = true;
          img.src = favicon.fallback;
        } else {
          img.style.display = "none";
        }
      });
      // Insert after the drag handle (index 0), before the title span (index 1)
      a.insertBefore(img, a.children[1]);
    }

    a.querySelector<HTMLButtonElement>(".card-delete")!.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.links = state.links.filter((l) => l.id !== link.id);
        try {
          await saveLinks(storage);
          renderLinks(storage);
        } catch {
          showToast("Failed to delete link", "error");
        }
      },
    );

    addDragHandlers({
      element: a,
      itemId: link.id,
      onDrop: async (draggedId, targetId, insertBefore) => {
        state.links = reorderItems(
          state.links,
          draggedId,
          targetId,
          insertBefore,
        );
        try {
          await saveLinks(storage);
          renderLinks(storage);
        } catch {
          showToast("Failed to reorder links", "error");
        }
      },
    });

    grid.appendChild(a);
  });
}

/* ─── Search ─────────────────────────────────────────────────── */

export function initLinksSearch(storage: StorageAdapter): void {
  const input = el<HTMLInputElement>("linksSearch");
  const clearBtn = el("linksClearSearch");

  input.addEventListener("input", () => {
    linksQuery = input.value;
    clearBtn.classList.toggle("hidden", !input.value);
    renderLinks(storage);
  });

  clearBtn.addEventListener("click", () => {
    linksQuery = "";
    input.value = "";
    clearBtn.classList.add("hidden");
    renderLinks(storage);
    input.focus();
  });

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      linksQuery = "";
      input.value = "";
      clearBtn.classList.add("hidden");
      renderLinks(storage);
      input.blur();
    }
  });

  registerShortcut({
    key: "/",
    requiresSection: "section-links",
    handler: () => input.focus(),
  });
}

/* ─── CRUD ───────────────────────────────────────────────────── */

export function initLinks(storage: StorageAdapter): void {
  const form = el("formLink");
  const inputTitle = el<HTMLInputElement>("linkTitle");
  const inputUrl = el<HTMLInputElement>("linkUrl");
  const btnAdd = el("btnAddLink");
  const btnSave = el("saveLinkBtn");
  const btnCancel = el("cancelLinkBtn");

  function openForm(): void {
    form.classList.remove("hidden");
    form.classList.add("flex");
    inputTitle.focus();
  }

  function closeForm(): void {
    form.classList.add("hidden");
    form.classList.remove("flex");
    inputTitle.value = "";
    inputUrl.value = "";
  }

  async function saveLink(): Promise<void> {
    const title = inputTitle.value.trim();
    const rawUrl = inputUrl.value.trim();
    if (!title || !rawUrl) return;

    let url = rawUrl;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    state.links.push({ id: genId(), title, url });
    try {
      await saveLinks(storage);
      renderLinks(storage);
      closeForm();
    } catch {
      showToast("Failed to save link", "error");
    }
  }

  btnAdd.addEventListener("click", () => {
    if (form.classList.contains("hidden")) openForm();
    else closeForm();
  });

  btnCancel.addEventListener("click", closeForm);
  btnSave.addEventListener("click", saveLink);

  [inputTitle, inputUrl].forEach((input) => {
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") saveLink();
      if (e.key === "Escape") closeForm();
    });
  });

  registerShortcut({
    key: "a",
    requiresSection: "section-links",
    handler: () => openForm(),
  });

  registerShortcut({
    key: "A",
    requiresSection: "section-links",
    handler: () => openForm(),
  });
}
