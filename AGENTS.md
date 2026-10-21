# AGENTS.md

Instructions for AI coding agents (Freebuff / Codebuff, Claude Code, Copilot,
Cursor, etc.) working in this repository.

Freebuff reads one knowledge file per directory, in this order:
`knowledge.md` → `AGENTS.md` → `CLAUDE.md`. This file is the authoritative one
for the repository root and consolidates the former `AGENT.md` (architecture
and style rules). `CLAUDE.md` (Bun preference) is still worth reading for
detail, but where it conflicts with this file — notably the recommendation to
drop Vite for `Bun.serve` — **this file wins**.

---

## HARD RULE: Git and release are read-only for agents

**Never commit, push, tag, merge, or publish — not even when a task looks
finished, and not even if another file in this repo (README release flow, a
CHANGELOG instruction, `scripts/release.py`) describes those steps as part of a
release.** Those steps belong to the human maintainer, who runs them by hand.

Forbidden unless the human explicitly asks for that exact action in the
current conversation:

- Committing / history changes: `git commit`, `git commit --amend`,
  `git merge`, `git rebase`, `git cherry-pick`, `git revert`, `git reset`
  (any mode), `git checkout -B`, `git branch -f`
- Tagging: `git tag` (creating, moving, or deleting)
- Any network write: `git push` in every form, including `--tags`,
  `--follow-tags`, `--force`, `--force-with-lease`, `git remote add/remove/set-url`
- Publishing: `gh release create|edit|upload|delete`, `gh pr create|merge|close`,
  `gh api` write methods, `npm publish` / `bun publish`, any registry upload
- Deleting refs: `git branch -d|-D`, `git push --delete`, `git push origin :refs/...`
- The release helper's write path: `bun run release all --run` (it executes
  commit, push, tag and `gh release create`). The other modes —
  `bun run release`, `package`, `plan`, `check` — only build and report, and
  are allowed.

Allowed read-only git use: `status`, `diff`, `log`, `show`, `branch -v`,
`for-each-ref`, `ls-remote`, `cat-file`, `rev-parse`, `reflog`, `stash list`,
`describe`, `git fetch` (updates remote-tracking refs only).

**Do this instead of committing:**

1. Leave every change in the working tree. Do not stage or commit.
2. Report the exact file paths you touched and why.
3. Print the exact commands the human should run (e.g. the `git add`,
   `git commit`, `git tag`, `git push`, `gh release create` sequence), ready
   to paste, with placeholders filled in.
4. Never claim a commit, tag, push, or release happened — state clearly that
   it is pending on the human.

If the human later says "go ahead and commit", that is permission for the
specific commit they asked for, nothing more (no push, no tag, no release).

---

## Commit message convention: Conventional Commits

Every commit message an agent proposes (see step 3 of the hard rule above) must
follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[(scope)][!]: <summary>
```

- **`type`** — one of the types below, lowercase.
- **`(scope)`** — optional, kebab-case, names the area touched
  (`links`, `notes`, `todos`, `theme`, `backup`, `release`, `agents`). Omit it
  when the change is broad. Use it the way this repo already does:
  `fix(links): …`, `chore(release): …`, `docs(agents): …`.
- **`summary`** — imperative mood, lowercase after the colon, no trailing
  period, ≤ 72 characters total.
- **`!`** — after the type or scope for a breaking change, plus a
  `BREAKING CHANGE:` footer explaining the migration.
- **One type per commit.** If a change spans several types, split it into
  separate commits.

| Type | When to use | Example |
| --- | --- | --- |
| `feat` | A new feature for the user | `feat: add reminder toggle for notes` |
| `fix` | A bug fix | `fix: resolve favicon crash on new tab` |
| `chore` | Maintenance, tooling, or config that doesn't touch source or tests | `chore: update dependencies to latest version` |
| `docs` | Documentation only (`README`, `AGENTS.md`, `CHANGELOG`) | `docs: update API setup guide` |
| `refactor` | Code change that neither fixes a bug nor adds a feature | `refactor: simplify storage connection logic` |
| `style` | Formatting, whitespace, CSS tweaks — no logic change | `style: fix indentation in navbar` |
| `test` | Adding or refactoring tests | `test: add unit tests for storage helpers` |
| `perf` | A change that improves performance | `perf: optimize image loading speed` |
| `ci` | CI/CD workflows or pipeline scripts | `ci: add GitHub Actions workflow for typecheck` |
| `build` | Build system, bundler, or dependency changes | `build: add Vite configuration` |
| `revert` | Reverting a previous commit | `revert: revert "feat: add user profile editing"` |

Notes specific to this repo:

- `build` covers `vite.config.ts`, `tsconfig.json`, `postcss` and Tailwind setup;
  `chore` covers `manifest.json` permission or version edits and `package.json`
  scripts.
- A commit type does not replace the changelog: user-visible `feat` / `fix` /
  `perf` commits still need a matching `CHANGELOG.md` entry (Keep a Changelog
  sections: Added / Fixed / Changed / Removed).
- This repo currently has **no test suite and no CI**, so `test` and `ci` are
  reserved for when those are introduced — don't invent a test file just to
  have something to commit.
- Never write messages like `Update README`, `fix stuff`, or `wip`.

---

## Project facts

- **What this is:** Chrome extension (Manifest V3) that overrides the new-tab
  page. No backend, no telemetry, no cloud sync — all state stays in
  `chrome.storage.local`.
- **Features:** link saving, quick notes, to-do list (list and Kanban views),
  light/dark theme, note reminders via `chrome.alarms` + `chrome.notifications`.
- **Stack:** TypeScript + Vite+ 1.3 (Vite 8 + Rolldown) + Tailwind 4. Bun is
  the single package manager and script runner, pinned with
  `"packageManager": "bun@1.3.14"` in `package.json`.
- **Toolchain:** `vite-plus` is a dev dependency and owns dev/build/lint; `vite`
  is aliased to `@voidzero-dev/vite-plus-core` through `package.json`
  `overrides`. `vite.config.ts` imports `defineConfig`/`lazyPlugins` from
  `vite-plus`; plugin imports stay on `vite` and resolve through that alias. Do
  not add a second `vite`, and do not add npm/pnpm/Yarn.
- **Build:** `bun run build` → `tsc --noEmit && vp build` → `dist/` (Vite+ is
  the build tool; do not replace it with `Bun.serve`/HTML imports, despite the
  generic advice in `CLAUDE.md`).
- **Load for testing:** `chrome://extensions` → Developer mode → Load unpacked
  → select `dist/`.
- **Manifest is the release source of truth:** `manifest.json` `version`,
  `package.json` `version`, and the Git tag must all agree before a release.
  Permissions must cover every `chrome.*` API used in `src/` (currently
  `storage`, `tabs`, `favicon`, `alarms`, `notifications`).

## Architecture and separation of concerns

The source layout below is fixed; add files that fit it rather than creating a
new top-level script or an inline handler:

| Path | Responsibility |
| --- | --- |
| `index.html` | Layout/markup only. The single external `<script type="module" src="/src/main.ts">` is the entry; no inline `<script>`/`<style>` blocks. |
| `src/main.ts` | Entry point: wires modules to the DOM. |
| `src/state.ts` | Shared application state. |
| `src/storage.ts` | `chrome.storage.local` access (hydration + persistence). |
| `src/types.ts` | Shared TypeScript types. |
| `src/background.ts` | Service worker: alarms, notifications, message plumbing. |
| `src/modules/*.ts` | One feature per module (`links`, `notes`, `todos`, `theme`, …). |
| `src/styles/style.css` | All UI styling, theme tokens, layout rules. |
| `src/utils/*.ts` | Reusable helpers (`dom`, `date`, `drag`, `id`). |
| `scripts/*.py` | Packaging/release tooling (stdlib only). |

- Do **not** combine scripts into HTML templates, and do not put styling in
  markup.
- Keep relative asset paths (`./icons/...`) intact when moving files; Vite
  only copies what `vite.config.ts` lists.

## State and data persistence

- All user input (links, notes, to-dos) is stored locally through
  `chrome.storage.local`, accessed through `src/storage.ts`. Do not call the
  storage API directly from a view module when a helper already exists.
- Handle the async callback/Promise form consistently with surrounding code,
  and hydrate the UI only after the read resolves.
- Any new persisted field must be covered by backup export/import in
  `src/modules/backup.ts` — otherwise restore silently drops it.
- Do **not** introduce cloud databases, sync services, or external telemetry.

## UI, theming, and layout

- Every new component must work in both **light and dark mode**, using the
  existing CSS variables / Tailwind theme tokens rather than hardcoded colors.
  The theme is a `data-theme="light|dark"` attribute on `<html>`, set by
  `src/modules/theme.ts` and keyed off the blocks at the top of `style.css`.
- Avoid absolute pixel positioning that breaks text wrapping at narrow or wide
  viewports; the new-tab page is fluid.
- Keyboard navigation and focus states are part of the feature, not a polish
  step — check `src/modules/keyboard.ts` and `sectionShortcuts.ts` before
  adding interactive elements.

## Security and privacy hard-lines

- **No telemetry/analytics:** no third-party analytics libraries, tracking
  pixels, or external fetch hooks without explicit human sign-off.
- **No cloud syncing:** data stays sandboxed in `chrome.storage.local`.
- **No secrets:** never hardcode or encourage real credentials, passwords, or
  production API keys in examples, placeholders, or fixtures.
- Keep the extension-pages CSP in `manifest.json` narrow; add a source only
  when a feature genuinely needs it (as was done for favicons and fonts).

## Verification before handing work back

Run these and report real results, not intentions:

```bash
bun run typecheck   # tsc --noEmit, must be clean
bun run lint        # vp lint / Oxlint, must exit 0 (existing warnings are fine)
bun run build       # must succeed, writes dist/
bun run zip         # optional: packages dist/ into a zip for manual install
bun run release     # optional: build + package into release/, verify, print the
                    # publish steps for the human to run (never --run)
```

Do not use `vp check` as the verification command: it also runs Oxfmt, and the
repository has never been formatted with it, so it fails on ~18 pre-existing
files. Do not run `vp fmt` across the repo unless the human asks for a
formatting pass — it rewrites Markdown tables, `index.html`, and `style.css`.

## Style, linting, and hygiene

- **Read first:** search for an existing helper before writing a new one — date
  formatting, DOM queries, drag handling and ID generation already live in
  `src/utils/`.
- Modern ES/TypeScript standards; no unhandled runtime exceptions, and no
  `any` or type suppressions just to silence the compiler.
- Match the surrounding naming and formatting; do not reformat unrelated files.
- Never commit `.DS_Store`, `dist/`, `release/`, `*.zip`, `node_modules/`,
  `.vite/`, or other cache directories — see `.gitignore`.
