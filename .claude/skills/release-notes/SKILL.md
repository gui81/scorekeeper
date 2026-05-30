---
name: release-notes
description: Generate grouped, human-readable release notes / a changelog from git history since the last release tag. Use when the user asks "what changed since the last release", wants release notes, a changelog, or text to paste into a GitHub Release for gui81/scorekeeper. Read-only — never mutates the repo.
allowed-tools: Read, Bash(git log:*), Bash(git tag:*), Bash(git describe:*)
---

# Release Notes

Produce Markdown release notes for the GitHub repo `gui81/scorekeeper` from git
history. This project has no CHANGELOG, so derive everything from commit
subjects. This skill is strictly read-only: only `git log`, `git tag`, and
`git describe` are permitted — never write, commit, tag, or push.

## 1. Find the baseline ref

Get the most recent tag:

```
git describe --tags --abbrev=0
```

If that fails (`fatal: No names found` / no tags exist), fall back to the root
commit (using `git log`, which is already permitted):

```
git log --max-parents=0 --pretty=format:%H HEAD
```

Call the resulting value `<ref>`. If a tag was found, the notes cover changes
*since that release*; if you fell back to the root commit, they cover the
*entire history*.

## 2. Collect commits

```
git log <ref>..HEAD --pretty=format:%h %s
```

Each line is `<short-hash> <subject>`. If the output is empty, report that there
are no new commits since `<ref>` and stop.

## 3. Classify each subject

Bucket by the leading verb/keyword of the subject (case-insensitive):

| Bucket  | Leading word(s) |
|---------|-----------------|
| Added   | Add, Added, Adds, New, Introduce, Implement, Create, Support |
| Fixed   | Fix, Fixed, Fixes, Bug, Resolve, Patch, Correct, Hotfix |
| Changed | Change, Update, Modernize, Refactor, Improve, Enhance, Rename, Remove, Removed, Deprecate, Bump, Upgrade, Set, Exclude |
| Chore   | Chore, Docs, Doc, Test, Tests, CI, Build, Config, Lint, Style, Merge, Release, Version |

Anything that matches no keyword goes in **Changed** (the catch-all). Skip empty
merge-noise like bare "Merge branch ..." unless it is the only signal.

## 4. Output

Emit Markdown ready to paste into a GitHub Release. Omit any section that has no
entries. Order sections: Added, Fixed, Changed, Chore. For each commit, keep the
human-readable subject and append the short hash in parentheses.

```markdown
## Release notes

_Changes since `<ref-or-tag>`._

### Added
- Accounts system with org management and UX improvements (9b60764)

### Fixed
- Publication errors on logout when orgId is null (62ea8ec)

### Changed
- Modernize to Meteor 3 + Vue 3 (8e387f1)

### Chore
- Add ESLint + Prettier and fix all lint issues (37946fc)
```

Tidy the subjects lightly for readability (e.g. drop a redundant leading verb so
it reads as a noun phrase under its heading) but never invent changes — every
bullet must trace back to a real commit hash from the log.
