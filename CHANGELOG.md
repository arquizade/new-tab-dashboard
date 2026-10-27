# Changelog

All notable changes to New Tab Dashboard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on versions before 0.4.0:** releases up to `v0.3.1` were tagged in Git
> without bumping `manifest.json`, so the packaged extension reported `0.2.0`
> regardless of the tag. This was corrected in `v0.4.0`; the tag remains the
> source of truth for those earlier releases.

## [Unreleased]

### Added

- Notebooks: notes can be grouped into flat, user-named notebooks, with an
  `All notes` / `Unfiled` / notebook chip filter above the notes list and a
  notebook selector in the add and edit forms. Deleting a notebook moves its
  notes to `Unfiled` instead of deleting them.
- Backup export and import now carry notebooks and each note's `notebookId`;
  older backups without notebooks still import as unfiled notes.
- To-do buckets: tasks can be shelved under Active, Backlog or Parked, with
  multi-select filter chips above both views, grouped list sections in that
  order, a collapsible Parked group, drag onto a group header to move a task,
  and a per-card move select on the Kanban board. The add form has a bucket
  select that defaults to the visible bucket.
- Backup export and import now carry each task's `bucket`; older backups and
  stored tasks without one read as Active.
- Version badge in the bottom-right corner of the main panel, showing the
  extension version from `manifest.json`.

## [0.4.1] - 2026-10-21

### Changed

- Development, build, and lint commands now run through Vite+ 1.3
  (`vite-plus`): `bun run dev` calls `vp dev`, `bun run build` calls
  `vp build`, and `bun run lint` runs Oxlint. Vite remains the bundler through
  Vite+'s `@voidzero-dev/vite-plus-core` alias.
- Bun is pinned in `package.json` as the single package manager
  (`"packageManager": "bun@1.3.14"`); there is still only one lockfile
  (`bun.lock`).
- Formatting is now enforced with Oxfmt: `vp fmt` writes it and `vp check`
  verifies formatting, lint, and types together.

### Fixed

- Chrome API calls and async save handlers no longer leave promise rejections
  unhandled; failures are logged instead of being dropped.
- Note color swatches no longer use inline `style` attributes, which the
  extension CSP blocked; colors now come from `data-color` CSS rules.

## [0.4.0] - 2026-10-21

### Added

- Kanban board view for the to-do list, alongside the existing list view.
- Reminders for notes, including due-date handling and reminder state that
  persists through backup/restore.
- Toggle for link open mode (open in a new tab vs. the current tab).

### Fixed

- Note reminders actually work: `manifest.json` now declares the `alarms` and
  `notifications` permissions the feature needs. Without them `chrome.alarms`
  was undefined and scheduling silently no-opped.
- `manifest.json` and `package.json` now report the version that is actually
  released. Both had been left at `0.2.0` since the v0.2.0 tag, which made every
  later package look like a stale build.

### Changed

- `src/background.ts` gained the message plumbing and `chrome.alarms` listener
  required by note reminders.
- Backup export/import covers the new note and to-do fields.

## [0.3.1] - 2026-05-25

### Added

- Light and dark theme toggle, with theme tokens applied across the dashboard.

### Fixed

- Favicon rendering repaired by tightening the extension pages CSP and adding a
  `chrome-extension://` `_favicon` fallback.
- Tailwind configuration adjusted to silence LSP warnings.

## [0.3.0] - 2026-05-25

### Changed

- Split the monolithic `app.ts` into a modular `src/` structure.
- Migrated from npm to Bun as package manager and script runner.

### Documentation

- README updated with Bun installation and development workflow.

## [0.2.2] - 2026-05-24

### Added

- Keyboard navigation for links, plus styling adjustments.

### Fixed

- Link favicons migrated to the native Chrome extension favicon API.

### Removed

- Stopped tracking the local `.vite` cache directory.

## [0.2.0] - 2026-05-24

### Changed

- Project migrated to TypeScript and Tailwind CSS.

## [0.1.0] - 2026-05-23

### Added

- Initial release: link saver, quick notes, to-do list, and the minimal
  light/dark dashboard UI, with all data stored in `chrome.storage.local`.

### Removed

- Committed `.DS_Store` files removed and ignored.

[0.4.0]: https://github.com/arquizade/new-tab-dashboard/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/arquizade/new-tab-dashboard/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/arquizade/new-tab-dashboard/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/arquizade/new-tab-dashboard/compare/v0.2.0...v0.2.2
[0.2.0]: https://github.com/arquizade/new-tab-dashboard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/arquizade/new-tab-dashboard/releases/tag/v0.1.0
