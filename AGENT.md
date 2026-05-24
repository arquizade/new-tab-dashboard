# AI Agent & Automation Guidelines (AGENT.md)

This file provides context and strict styling rules for AI coding assistants (like Cursor, GitHub Copilot, Windsurf, or custom LLM prompts) interacting with the **New Tab Dashboard** codebase. 

Please read and parse this file before proposing or applying code modifications.

---

## Project Overview & Tech Stack
* **Target Platform:** Google Chrome Extension (Manifest V3)
* **Core Tech:** Vanilla JavaScript, HTML5, CSS3
* **Main Features:** Link Saving, Quick Notes, To-Do Task Management
* **Storage Model:** `chrome.storage.local` (Synchronous-like async local browser state)

---

## Codebase Architecture & Constraints

### 1. Separation of Concerns
* Keep logic completely separated into clear files:
    * `popup.html` / `newtab.html`: Layout structure only. Avoid inline styling or script tags.
    * `styles.css`: All UI styling, dark/light theme tokens, and structural layouts.
    * `app.js` (or file-specific scripts): Event listeners and core DOM manipulations.
* Do **NOT** combine scripts into HTML templates.

### 2. State & Data Persistence
* All user inputs (links, notes, tasks) must be stored locally via the Chrome Storage API.
* **Pattern to use:**
    ```javascript
    // Always use asynchronous chrome.storage patterns
    chrome.storage.local.get(['links', 'notes', 'todos'], (result) => {
        // Hydrate UI elements here safely
    });
    ```
* Do **NOT** implement cloud databases or external telemetry unless explicitly prompted by the user.

### 3. UI/UX & Dark Mode Rules
* The application features a clean toggle between **Light Mode** and **Dark Mode**.
* When adding new HTML components, make sure they utilize CSS variables configured for both modes inside `styles.css`.
* Avoid absolute pixel position metrics that can break text wrapping on varied viewport dimensions.

---

## Security & Privacy Hard-Lines
* **No Telemetry/Analytics:** Do not introduce third-party analytics libraries, tracking pixels, or external fetch hooks without human sign-off.
* **No Cloud Syncing:** Data storage must remain strictly sandboxed in local browser isolation (`chrome.storage.local`).
* **Sensitive Data Warnings:** When writing UI placeholders or code examples, never encourage or hardcode test credentials, real passwords, or production API keys.

---

## Instructions for AI Assistants
1.  **Read-First:** Always search the codebase for existing utility methods before writing duplicate helper routines (e.g., date formats, DOM queries).
2.  **Strict Linting:** Ensure all proposed Javascript code passes modern ES6 standards without introducing unhandled runtime exceptions.
3.  **Local Isolation:** Ensure any modified file structure maintains correct relative path references (`./assets/...`, etc.).
