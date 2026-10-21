#!/usr/bin/env python3
"""Release assistant for the New Tab Dashboard Chrome extension.

This script does the local, reversible half of a release and prints the exact
commands for the half a human must run. It never commits, tags, pushes or
publishes on its own unless you pass --run and confirm each command.

What it automates
  1. typecheck + build (bun run typecheck, bun run zip)
  2. calls scripts/zip-extension.py, then stages the archive as
     release/new-tab-dashboard-v<version>.zip (the rename the raw script
     still does not do)
  3. verifies the archive: flat root, manifest.json at root, version matches,
     every entry byte-identical to dist/
  4. verifies manifest permissions against the chrome.* APIs used in src/
     (this is the check that catches a dead feature like note reminders)
  5. generates release/v<version>-notes.md from the CHANGELOG section

What it prints for you to run
  commit -> review -> push main -> tag -> push tag -> confirm -> gh release
  create -> verify published asset -> optional branch cleanup

Usage
  python3 scripts/release.py                 # package + print the plan
  python3 scripts/release.py package         # build + zip + verify only
  python3 scripts/release.py plan            # print the plan, touch nothing
  python3 scripts/release.py check           # read-only state verification
  python3 scripts/release.py all --run       # run the git/gh steps (interactive)

Exit codes
  0  everything asked for succeeded / nothing to do
  1  a check failed (broken local state, archive mismatch, missing permission)
  2  bad invocation or missing tool
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "manifest.json"
PACKAGE_JSON = ROOT / "package.json"
CHANGELOG = ROOT / "CHANGELOG.md"
DIST = ROOT / "dist"
RELEASE_DIR = ROOT / "release"
ASSET_FMT = "new-tab-dashboard-v{version}.zip"

# chrome.<api> -> manifest permission it requires (only APIs that need one).
API_PERMISSIONS = {
    "alarms": "alarms",
    "notifications": "notifications",
    "storage": "storage",
    "tabs": "tabs",
    "scripting": "scripting",
    "contextMenus": "contextMenus",
    "bookmarks": "bookmarks",
    "history": "history",
    "downloads": "downloads",
    "cookies": "cookies",
    "identity": "identity",
    "idle": "idle",
    "management": "management",
    "webNavigation": "webNavigation",
    "sessions": "sessions",
    "tabGroups": "tabGroups",
    "topSites": "topSites",
    "favicon": "favicon",  # needed for the _favicon/ URL, not a chrome.favicon call
}

# APIs that work without any declared permission; listed so we do not warn.
NO_PERMISSION_NEEDED = {
    "runtime",
    "action",
    "browserAction",
    "pageAction",
    "i18n",
    "extension",
    "windows",
    "omnibox",
    "declarativeNetRequest",
    "offscreen",
    "search",
}


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def say(msg: str = "") -> None:
    print(msg, flush=True)


def step(n: str, title: str) -> None:
    say(f"\n\033[1m[{n}] {title}\033[0m")


def ok(msg: str) -> None:
    say(f"  \033[32mOK\033[0m   {msg}")


def warn(msg: str) -> None:
    say(f"  \033[33mWARN\033[0m {msg}")


def bad(msg: str) -> None:
    say(f"  \033[31mFAIL\033[0m {msg}")


def info(msg: str) -> None:
    say(f"       {msg}")


def die(msg: str, code: int = 2) -> "NoReturn":  # type: ignore[valid-type]
    bad(msg)
    sys.exit(code)


def run(
    cmd: list[str],
    *,
    cwd: Path = ROOT,
    check: bool = True,
    quiet: bool = False,
) -> subprocess.CompletedProcess[str]:
    if not quiet:
        info(f"$ {shlex.join(cmd)}")
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0 and check:
        if proc.stdout:
            say(proc.stdout.rstrip())
        if proc.stderr:
            say(proc.stderr.rstrip())
        die(f"command failed (exit {proc.returncode}): {shlex.join(cmd)}", 1)
    return proc


def git(*args: str, check: bool = True) -> str:
    return run(["git", *args], check=check, quiet=True).stdout.strip()


SHELL_META = re.compile(r"[|&;<>()$`]")


def is_shell_form(cmd: str) -> bool:
    """True when a planned command needs a shell (pipes, redirects, globs)."""
    return bool(SHELL_META.search(cmd))


def run_shell(cmd: str, *, check: bool = False) -> subprocess.CompletedProcess[str]:
    """Run a command exactly as the human would paste it into their shell."""
    info(f"$ {cmd}")
    proc = subprocess.run(cmd, cwd=str(ROOT), shell=True, text=True,
                          capture_output=True)
    if proc.stdout:
        for line in proc.stdout.rstrip().splitlines()[-10:]:
            info(line)
    if proc.returncode != 0:
        if proc.stderr:
            bad(proc.stderr.strip().splitlines()[-1])
        if check:
            die(f"command failed (exit {proc.returncode}): {cmd}", 1)
    return proc


def prefix(prefix_: str) -> None:
    say(f"\033[2m{prefix_}\033[0m")


# --------------------------------------------------------------------------- #
# versioning
# --------------------------------------------------------------------------- #
def read_manifest() -> dict:
    try:
        return json.loads(MANIFEST.read_text())
    except FileNotFoundError:
        die(f"{MANIFEST} not found")


def read_version() -> str:
    """manifest.json is the single source of truth; package.json must agree."""
    version = read_manifest().get("version", "")
    if not version:
        die("manifest.json has no version field")
    pkg_version = json.loads(PACKAGE_JSON.read_text()).get("version", "")
    if pkg_version != version:
        bad(f"version drift: manifest.json={version} package.json={pkg_version}")
        info("both must match; bump them together before releasing")
        sys.exit(1)
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        die(f"manifest version {version!r} is not bare semver (no leading 'v')")
    return version


def repo_slug() -> str:
    url = git("remote", "get-url", "origin", check=False)
    m = re.search(r"github\.com[:/]([^/]+/[^/.]+)", url)
    return m.group(1) if m else ""


# --------------------------------------------------------------------------- #
# checks
# --------------------------------------------------------------------------- #
def permission_problems() -> list[str]:
    """Compare chrome.* APIs used in src/ against declared manifest permissions."""
    manifest = read_manifest()
    declared = set(manifest.get("permissions", []))
    optional = set(manifest.get("optional_permissions", []))
    declared_all = {p for p in declared | optional}

    used: dict[str, set[str]] = {}
    for path in sorted((ROOT / "src").rglob("*")):
        if path.suffix not in {".ts", ".tsx", ".js"}:
            continue
        text = path.read_text(errors="replace")
        for api in set(re.findall(r"\bchrome\.([A-Za-z]+)\.", text)):
            if api in NO_PERMISSION_NEEDED:
                continue
            perm = API_PERMISSIONS.get(api)
            if perm:
                used.setdefault(perm, set()).add(path.relative_to(ROOT).as_posix())
        if "_favicon/" in text or "_favicon?" in text:
            used.setdefault("favicon", set()).add(path.relative_to(ROOT).as_posix())

    problems = []
    for perm, files in sorted(used.items()):
        if perm not in declared_all:
            where = ", ".join(sorted(files))
            problems.append(f'permission "{perm}" is used by {where} but missing from manifest.json')
    return problems


def build(skip_typecheck: bool) -> None:
    if not skip_typecheck:
        step("1", "Typecheck")
        run(["bun", "run", "typecheck"])
        ok("tsc clean")

    step("2", "Build + zip (bun run zip -> scripts/zip-extension.py)")
    proc = run(["bun", "run", "zip"])
    tail = [line for line in proc.stdout.splitlines() if line.strip()]
    for line in tail[-12:]:
        info(line)
    root_zip = ROOT / "extension.zip"
    if not root_zip.is_file():
        die("bun run zip did not produce extension.zip", 1)
    ok("extension.zip produced")


def stage_archive(version: str, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / ASSET_FMT.format(version=version)
    if target.exists():
        target.unlink()
    shutil.move(str(ROOT / "extension.zip"), str(target))
    step("3", "Stage archive")
    ok(f"{target.relative_to(ROOT) if target.is_relative_to(ROOT) else target} "
       f"({target.stat().st_size / 1024:.1f} KB)")
    return target


def verify_dist_manifest(version: str) -> list[str]:
    problems = []
    dist_manifest = DIST / "manifest.json"
    if not dist_manifest.is_file():
        return [f"{dist_manifest.relative_to(ROOT)} missing"]
    if dist_manifest.read_bytes() != MANIFEST.read_bytes():
        problems.append("dist/manifest.json differs from the source manifest.json")
    else:
        ok("dist/manifest.json matches the source manifest")
    dist_version = json.loads(dist_manifest.read_text()).get("version", "")
    if dist_version != version:
        problems.append(f"dist/manifest.json says {dist_version}, expected {version}")

    bg = read_manifest().get("background", {})
    worker = bg.get("service_worker") or bg.get("page")
    if worker and not (DIST / worker).is_file():
        problems.append(f"background entry {worker} missing from dist/")
    return problems


def verify_archive(zip_path: Path, version: str) -> list[str]:
    problems = []
    with zipfile.ZipFile(zip_path) as zf:
        names = sorted(zf.namelist())
        if "manifest.json" not in names:
            problems.append("manifest.json is not at the archive root")
            return problems
        nested = [n for n in names if n.startswith("dist/")]
        if nested:
            problems.append(f"{len(nested)} entries still carry the dist/ prefix")

        manifest = json.loads(zf.read("manifest.json"))
        if manifest.get("version") != version:
            problems.append(
                f'zipped manifest.json says {manifest.get("version")!r}, expected {version!r}'
            )
        perms = manifest.get("permissions", [])
        info(f"version {manifest.get('version')}, permissions {json.dumps(perms)}")

        for name in names:
            source = DIST / name
            if not source.is_file():
                problems.append(f"{name} is in the archive but not in dist/")
                continue
            if source.read_bytes() != zf.read(name):
                problems.append(f"{name} differs between archive and dist/")

    if not problems:
        ok(f"archive verified: {len(names)} files, flat root, byte-identical to dist/")
    return problems


# --------------------------------------------------------------------------- #
# release notes
# --------------------------------------------------------------------------- #
def changelog_section(version: str) -> str:
    if not CHANGELOG.is_file():
        return ""
    text = CHANGELOG.read_text()
    pattern = re.compile(
        rf"^## \[{re.escape(version)}\][^\n]*\n(.*?)(?=^## \[|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    m = pattern.search(text)
    return m.group(1).strip() if m else ""


def build_notes(version: str, asset_name: str, slug: str) -> str:
    section = changelog_section(version)
    included = section if section else "- (no CHANGELOG section found for this version)"
    download = f"https://github.com/{slug or 'OWNER/REPO'}/releases/download/v{version}/{asset_name}"
    repo_flag = f" --repo {slug}" if slug else ""
    return f"""Early access release for developer mode installation.

{included}

## How to install
1. Download `{asset_name}` below
2. Unzip the file
3. Go to chrome://extensions
4. Enable Developer mode (top right toggle)
5. Click Load unpacked and select the unzipped folder
6. Open a new tab

## Download via command line
**curl**
`curl -L -o {asset_name} {download}`

**GitHub CLI**
`gh release download v{version}{repo_flag}`

> [!NOTE]
> - All data is saved locally to your browser only
> - Nothing leaves your device
"""


def write_notes(version: str, notes_path: Path, asset_name: str) -> None:
    step("4", "Release notes")
    if not changelog_section(version):
        warn(f"CHANGELOG.md has no '## [{version}]' section; notes will be generic")
    notes_path.parent.mkdir(parents=True, exist_ok=True)
    notes_path.write_text(build_notes(version, asset_name, repo_slug()))
    ok(f"{notes_path.relative_to(ROOT) if notes_path.is_relative_to(ROOT) else notes_path} "
       f"({len(notes_path.read_text().splitlines())} lines)")


# --------------------------------------------------------------------------- #
# the plan a human runs
# --------------------------------------------------------------------------- #
def dirty_paths() -> list[str]:
    # Read the raw output: git() strips the whole string, which would eat the
    # leading space of " M path" and shift the path by one character.
    out = run(["git", "status", "--porcelain"], check=False, quiet=True).stdout
    paths = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        entry = line[3:].strip()  # porcelain v1: XY<space>PATH
        if " -> " in entry:
            entry = entry.split(" -> ", 1)[1]
        if entry:
            paths.append(entry)
    return paths


def plan_steps(version: str, asset: Path, notes: Path) -> list[tuple[str, list[str], str]]:
    tag = f"v{version}"
    asset_ref = str(asset.relative_to(ROOT)) if asset.is_relative_to(ROOT) else str(asset)
    notes_ref = str(notes.relative_to(ROOT)) if notes.is_relative_to(ROOT) else str(notes)
    dirty = dirty_paths()
    add_cmd = "git add -A" if dirty else "# nothing to stage"

    tag_exists = run(["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag}"],
                     check=False, quiet=True).returncode == 0
    tag_note = (
        f"  (tag {tag} already exists; -f moves it to HEAD)"
        if tag_exists
        else ""
    )

    return [
        (
            "Commit the release",
            [add_cmd, 'git commit -m "chore(release): v%s"' % version],
            "Review `git status --short` first; the tree should hold only the version "
            "bump, the CHANGELOG entry and the feature code.",
        ),
        (
            "Push main",
            ["git push origin main"],
            "Leave --follow-tags off. If the tag is not reachable from main it is "
            "silently skipped.",
        ),
        (
            "Create the annotated tag",
            [
                f'git tag -f -a {tag} -m "{tag} Early Access"',
                f"git show {tag}:manifest.json | grep '\"version\"'",
            ],
            "Expected output: 0.4.0-style version matching the tag." + tag_note,
        ),
        (
            "Push the tag",
            [f"git push origin {tag}"],
            "Use --force instead if you just moved an already-pushed tag.",
        ),
        (
            "Confirm the remote state",
            [
                f"git ls-remote --tags origin {tag}",
                f"git rev-list --left-right --count origin/main...main",
            ],
            "The tag line must print a SHA; the count must be '0 0'.",
        ),
        (
            "Create the GitHub Release",
            [
                f"gh release create {tag} {asset_ref} "
                f'--title "{tag} Early Access" --notes-file {notes_ref}'
            ],
            "Re-run the script with `check` afterwards to verify the asset.",
        ),
        (
            "Verify the published asset",
            [
                f"gh release download {tag} --pattern '*.zip' -O /tmp/{tag}-check.zip",
                f"unzip -p /tmp/{tag}-check.zip manifest.json | "
                f"grep -E '\"version\"|\"permissions\"'",
            ],
            "Confirm the version and that alarms/notifications are present.",
        ),
        (
            "Optional: clean up stale branches",
            ["git branch -d release/v0.2", "git branch -vv"],
            "Only delete branches fully merged into main.",
        ),
    ]


def print_plan(version: str, asset: Path, notes: Path) -> None:
    steps = plan_steps(version, asset, notes)
    say("\n" + "=" * 72)
    say(f"MANUAL RELEASE STEPS - v{version}")
    say("=" * 72)
    prefix("These are yours to run. The agent-rule in AGENTS.md forbids an "
           "automated agent from running them.")
    for i, (title, cmds, note) in enumerate(steps, 1):
        say(f"\n{i}. {title}")
        for cmd in cmds:
            say(f"   {cmd}")
        if note:
            prefix(f"   {note}")
    say("\n" + "-" * 72)
    say("Re-verify at any time:  python3 scripts/release.py check")
    say("-" * 72)


# --------------------------------------------------------------------------- #
# read-only state check
# --------------------------------------------------------------------------- #
def cmd_check(version: str) -> int:
    tag = f"v{version}"
    failures = 0
    pending = 0

    step("check", "Local repository")
    dirty = dirty_paths()
    if dirty:
        pending += 1
        warn(f"{len(dirty)} uncommitted path(s): {', '.join(dirty[:5])}"
             + (" ..." if len(dirty) > 5 else ""))
    else:
        ok("working tree clean")

    branch = git("rev-parse", "--abbrev-ref", "HEAD", check=False)
    if branch != "main":
        warn(f"on branch {branch!r}, releases are cut from main")
    else:
        ok("on main")

    head = git("rev-parse", "HEAD", check=False)
    info(f"HEAD {head[:7]}")

    step("check", "Tag")
    local_tag = run(["git", "rev-parse", "-q", "--verify", f"{tag}^{{commit}}"],
                    check=False, quiet=True)
    if local_tag.returncode != 0:
        pending += 1
        warn(f"{tag} does not exist locally")
    elif local_tag.stdout.strip() != head:
        pending += 1
        warn(f"{tag} points at {local_tag.stdout.strip()[:7]}, not HEAD {head[:7]}")
        info(f"move it with: git tag -f -a {tag} -m \"{tag} Early Access\"")
    else:
        ok(f"{tag} points at HEAD")
        tree_tag = git("rev-parse", f"{tag}^{{tree}}", check=False)
        tree_head = git("rev-parse", "HEAD^{tree}", check=False)
        if tree_tag and tree_tag == tree_head:
            ok("tag tree identical to HEAD tree")

    # Ask for the full tag list: ls-remote omits the ^{} peeled line when you
    # pass a pattern, which would compare a tag object SHA against a commit SHA.
    remote_all = run(["git", "ls-remote", "--tags", "origin"],
                     check=False, quiet=True).stdout.splitlines()
    wanted = {f"refs/tags/{tag}", f"refs/tags/{tag}^{{}}"}
    remote_tags = [l for l in remote_all if l.split("\t")[-1] in wanted]
    peeled = [l for l in remote_tags if l.endswith("^{}")]
    local_tag_obj = git("rev-parse", f"refs/tags/{tag}", check=False)
    if not remote_tags:
        pending += 1
        warn(f"{tag} is not on origin")
    else:
        if peeled:
            sha, what = peeled[0].split()[0], "commit"
        else:
            sha, what = remote_tags[0].split()[0], "tag object"
        if sha == head:
            ok(f"{tag} on origin -> commit {sha[:7]}")
        elif what == "tag object" and sha == local_tag_obj:
            ok(f"{tag} on origin -> tag object {sha[:7]} (same as local)")
        else:
            failures += 1
            bad(f"{tag} on origin -> {what} {sha[:7]}, expected commit {head[:7]}")

    step("check", "Branch sync")
    counts = git("rev-list", "--left-right", "--count", "origin/main...main", check=False)
    if counts:
        behind, ahead = (int(x) for x in counts.split())
        if ahead or behind:
            pending += 1
            warn(f"main is ahead {ahead}, behind {behind} relative to origin/main")
        else:
            ok("main is in sync with origin/main")

    step("check", "GitHub Release")
    slug = repo_slug()
    view = run(["gh", "release", "view", tag] + (["--repo", slug] if slug else []),
               check=False, quiet=True)
    if view.returncode != 0:
        pending += 1
        warn(f"no GitHub Release for {tag} yet")
        info(f'create it with: gh release create {tag} '
             f"release/{ASSET_FMT.format(version=version)} "
             f'--title "{tag} Early Access" --notes-file release/{tag}-notes.md')
    else:
        ok(f"release {tag} published")
        assets = run(["gh", "release", "view", tag, "--json", "assets",
                      "--jq", ".assets[].name"] + (["--repo", slug] if slug else []),
                     check=False, quiet=True).stdout.split()
        expected = ASSET_FMT.format(version=version)
        if expected in assets:
            ok(f"asset present: {expected}")
        else:
            failures += 1
            bad(f"asset {expected} missing (found: {assets or 'none'})")

        with tempfile.TemporaryDirectory() as tmp:
            dl = run(["gh", "release", "download", tag, "--pattern", "*.zip",
                      "-D", tmp] + (["--repo", slug] if slug else []),
                     check=False, quiet=True)
            zips = list(Path(tmp).glob("*.zip"))
            if dl.returncode != 0 or not zips:
                failures += 1
                bad("could not download the published zip to verify it")
            else:
                with zipfile.ZipFile(zips[0]) as zf:
                    m = json.loads(zf.read("manifest.json"))
                if m.get("version") == version:
                    ok(f"published zip manifest.json version {version}")
                else:
                    failures += 1
                    bad(f"published zip manifest.json version {m.get('version')!r}")

    step("check", "Manifest permissions")
    problems = permission_problems()
    if problems:
        for p in problems:
            bad(p)
        failures += len(problems)
    else:
        ok("every chrome.* API in src/ has its permission declared")

    say("")
    if failures:
        bad(f"{failures} failure(s), {pending} step(s) still pending")
        return 1
    if pending:
        warn(f"no failures, {pending} step(s) still pending")
        return 0
    ok("release complete: tag, push and published asset all verified")
    return 0


# --------------------------------------------------------------------------- #
# subcommands
# --------------------------------------------------------------------------- #
def cmd_package(version: str, args: argparse.Namespace) -> tuple[Path, Path]:
    problems = permission_problems()
    step("0", "Preflight")
    if problems:
        for p in problems:
            bad(p)
        info("the packaged extension would ship a dead feature; fix the manifest first")
        sys.exit(1)
    ok("manifest permissions cover the chrome.* APIs used in src/")

    if git("status", "--porcelain"):
        warn("working tree has uncommitted changes (fine to package, but review before commit)")

    if not shutil.which("bun"):
        die("bun not found on PATH")

    build(args.skip_typecheck)

    out_dir = Path(args.out_dir).resolve() if args.out_dir else RELEASE_DIR
    target = stage_archive(version, out_dir)

    step("3b", "Verify archive")
    issues = verify_dist_manifest(version) + verify_archive(target, version)
    if issues:
        for i in issues:
            bad(i)
        sys.exit(1)

    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    info(f"sha256 {digest}")

    notes_path = (out_dir / f"v{version}-notes.md") if args.out_dir else (RELEASE_DIR / f"v{version}-notes.md")
    write_notes(version, notes_path, target.name)
    return target, notes_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Package a New Tab Dashboard release and print the manual publish steps.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="all",
        choices=["all", "package", "plan", "check"],
        help="all = package + plan (default), package = build/zip/verify, "
             "plan = print steps only, check = read-only state verification",
    )
    parser.add_argument("--out-dir", help="stage the archive here instead of release/")
    parser.add_argument("--skip-typecheck", action="store_true", help="skip tsc before building")
    parser.add_argument("--run", action="store_true",
                        help="execute the printed git/gh steps with per-command confirmation")
    args = parser.parse_args(argv)

    if not (ROOT / ".git").exists():
        die("not inside a git repository")

    version = read_version()

    if args.command == "check":
        return cmd_check(version)

    if args.command == "plan":
        asset = (Path(args.out_dir).resolve() if args.out_dir else RELEASE_DIR) / ASSET_FMT.format(version=version)
        notes = (Path(args.out_dir).resolve() if args.out_dir else RELEASE_DIR) / f"v{version}-notes.md"
        print_plan(version, asset, notes)
        return 0

    asset, notes = cmd_package(version, args)
    if args.command == "package":
        say("")
        ok(f"ready to publish: {asset}")
        return 0

    print_plan(version, asset, notes)
    if args.run:
        execute_plan(version, asset, notes)
    return 0


def execute_plan(version: str, asset: Path, notes: Path) -> None:
    if not sys.stdin.isatty():
        die("--run needs an interactive terminal", 2)
    say("")
    warn("--run is interactive: each command is shown and skipped unless you type 'y'")
    for title, cmds, _note in plan_steps(version, asset, notes):
        for cmd in cmds:
            if cmd.startswith("#"):
                continue
            answer = input(f"\nrun this? {cmd}\n  [y/N] ").strip().lower()
            if answer != "y":
                info("skipped")
                continue
            if is_shell_form(cmd):
                run_shell(cmd)          # pipes/redirects need a real shell
            else:
                run(shlex.split(cmd), check=False, quiet=False)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        say("\naborted")
        sys.exit(130)
    except BrokenPipeError:  # e.g. `... | head`, which closes stdout early
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, sys.stdout.fileno())
        sys.exit(0)
