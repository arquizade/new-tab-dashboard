# New Tab Dashboard

A lightweight, distraction-free Chrome extension that transforms your default "New Tab" page into a sleek, personal productivity hub. Designed to help you stay organized, focused, and efficient every time you open a new tab.

## Screenshots

<table align="center">
    <tr>
        <td align="center">
            <img src="./assets/dashboard-preview-dark-mode.png" alt="Dashboard in Dark Mode" width="450">
        </td>
        <td align="center">
            <img src="./assets/dashboard-preview-light-mode.png" alt="Dashboard in Light Mode" width="450">
        </td>
    </tr>
    <tr>
        <td>Dark Mode</td>
        <td>Light Mode</td>
    </tr>
</table>

## Features

*   **Link Saver:** Bookmark and organize your favorite or frequently visited websites for quick access.
*   **Quick Notes:** Jot down ideas, thoughts, or scratchpad text instantly without leaving your tab.
*   **To-Do List:** Manage daily tasks, track progress, and check off items to stay on top of your workflow.
*   **Clean UI:** Minimalist and modern design crafted to reduce clutter and cognitive overload.

## Built With

*   HTML5
*   CSS3
*   TypeScript
*   Vite
*   Bun
*   Chrome Extension APIs (`storage` for saving data locally)

## Prerequisites

This project uses [Bun](https://bun.sh) as the package manager and script runner.

**Install Bun via Homebrew (recommended if you use Homebrew):**
```bash
brew install oven-sh/bun/bun
```

**Or install directly via the official installer:**
```bash
curl -fsSL https://bun.sh/install | bash
```

Verify the installation:
```bash
bun --version
```

## Local Development Setup

1. **Clone the repository:**
```bash
git clone https://github.com/arquizade/new-tab-dashboard.git
cd new-tab-dashboard
```

2. **Install dependencies:**
```bash
bun install
```

3. **Start the dev server:**
```bash
bun run dev
```

The dev server runs at `http://localhost:5000` by default.

## Building for Production

```bash
bun run build
```

Output lands in the `dist/` folder. This is the folder you load into Chrome as an unpacked extension.

## Type Checking

```bash
bun run typecheck
```

Run this before submitting a pull request to catch any TypeScript errors.

## Updating Bun

```bash
bun upgrade
```

Or if installed via Homebrew:
```bash
brew upgrade bun
```

## Installation & Loading the Extension

1. Run `bun run build` to generate the `dist/` folder.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle switch in the top right corner).
4. Click **Load unpacked** in the top left corner.
5. Select the `dist/` folder inside your project directory.
6. Open a new tab and enjoy your dashboard.

## Security & Privacy Notice

> **Important:** Please be mindful of the information you store in this dashboard.

* **Not an Encrypted Vault:** This extension is designed for quick notes, daily to-dos, and browser bookmarks. It **does not** encrypt data and is not a secure password manager or credential vault.
* **Sensitive Data:** Avoid storing sensitive or highly private information such as passwords, credit card numbers, or API keys in the text fields.
* **Local Storage:** All data is saved directly to your local browser storage (`chrome.storage.local`). Your information never leaves your computer or passes through external servers, but anyone with physical access to your logged-in browser can see your dashboard.

## Developer Contribution & Workflow

We welcome contributions from the developer community. To maintain clean code and version control, please follow our standard pipeline:

### Branch Rules & Releases
* **`main` Branch:** Represents the stable, working production branch. Do not commit directly to `main`.
* **Feature Branches:** Create a branch for your task: `feature/your-feature-name` or `bugfix/issue-name`.
* **Release Isolation:** Official release preparation happens in a dedicated branch format (e.g., `release/v0.1`), which is then explicitly tagged to mark immutable historical milestones (e.g., `v0.1.0`).

### AI-Assisted Contributions
If you are developing features using an AI editor or coding agent (such as Cursor, Copilot, or Windsurf), please ensure your tooling reads the instructions outlined in our [AGENT.md](./AGENT.md) file to prevent architectural regressions or privacy violations.

### Pull Request Checklist
1. Run `bun run typecheck` and confirm zero TypeScript errors.
2. Run `bun run build` and confirm the `dist/` folder builds cleanly.
3. Verify that your changes do **NOT** commit `.DS_Store` or cache directories (ensure your `.gitignore` is active).
4. Test both **Light Mode** and **Dark Mode** to guarantee styling consistency.
5. Ensure all Chrome Storage calls are completely asynchronous.

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
