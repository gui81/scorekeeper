# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository. The first half is
general behavioral guidance; the second half is Scorekeeper-specific architecture and
conventions you must follow to avoid writing broken code.

---

## Part 1 — Behavioral guidelines

> Adapted from Andrej Karpathy's coding guidelines
> (github.com/multica-ai/andrej-karpathy-skills). They bias toward caution over speed;
> for trivial tasks, use judgment.

### 1. Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused; leave pre-existing
  dead code unless asked.

The test: every changed line should trace directly to the request.

### 4. Goal-driven execution

**Define success criteria. Loop until verified.**

- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."

For multi-step tasks, state a brief plan with a verifiable check per step.

---

## Part 2 — Scorekeeper project conventions

A foosball score + Elo-rating tracker. **Meteor 3 + Vue 3 + MongoDB**, multi-tenant by
organization. ~4000 LOC.

### Layout & commands

- All app code and commands live in **`app/`** (the Meteor project). `cd app` first.
  - `meteor run` — dev server (bundles its own MongoDB on `:3001`, serves on `:3000`).
  - `npm run lint` — `eslint . && prettier --check .` (lint gate; there is no CI).
  - `npm run lint:fix` — `eslint --fix . && prettier --write .`.
  - `npm test` — `meteor test --once --driver-package meteortesting:mocha` (mocha + chai;
    server-only run via `TEST_CLIENT=0 npm test`). Currently covers the Elo math in
    `app/imports/api/methods.tests.js`.
- `app/imports/api/` — server data layer; `app/imports/ui/` — Vue client; `app/client/`,
  `app/server/` — entry points. `app/Dockerfile` + `app/docker-compose.yml` for deploy.
- Code style: ESLint 9 flat config (`app/eslint.config.js`) + Prettier 3 (single quotes,
  trailing commas, width 100). Run lint before considering a change done.

### Meteor 3 is async — this is the #1 source of bugs

- **Server Mongo calls are async-only.** Always use the `*Async` variants and `await`
  them: `findOneAsync`, `find(...).fetchAsync()`, `insertAsync`, `updateAsync`,
  `removeAsync`, `upsertAsync`, `countAsync`. A bare `findOne`/`insert`/… on the server
  throws or is removed; a forgotten `await` silently yields empty data with no error.
- A `Meteor.publish` handler may be `async` to pre-compute, but must ultimately **return
  a cursor** (or array of cursors), never a Promise-of-cursor.
- On the **client**, synchronous minimongo (`Collection.findOne(...)`,
  `find().fetch()`) inside a reactive context is correct and intended — the opposite of
  the server rule.
- Prefer `Meteor.callAsync('name', {...})` over `Meteor.call` on the client.

### Methods: validate, then gate, then touch data (in that order)

Every method takes a **single `doc` object**, validated with `check()` from
`meteor/check`, then authorizes, then accesses collections:

```js
async add_match(doc) {
  check(doc, matchPattern);               // 1. validate (meteor/check)
  await requireOrgMember(doc.org_id);     // 2. authorize BEFORE any data access
  // 3. ... awaited *Async Mongo ops ...
}
```

- Validation uses `Match.Optional`, `Match.Integer`, `Match.Where`, `Match.OneOf`.
- **Authorization helpers** (org isolation is enforced only by these hand-written calls —
  forgetting one leaks data across organizations):
  - `requireOrgMember(orgId)` — member actions — in `app/imports/api/methods.js`.
  - `requireOrgRole(orgId, roles)` — admin actions (e.g. `['owner','maintainer']`) — in
    `app/imports/api/org-methods.js`.
  - `requireOrgAccess(userId, orgId)` (boolean) — for publish handlers — in
    `app/imports/api/publications.js`.
  - Put a new method in the file whose helper it needs.
- **Publications** must gate on membership before returning data, and rating publications
  scope by `player_id` $in the org's player ids:
  ```js
  Meteor.publish('players', async function (orgId) {
    if (!orgId) return this.ready();
    check(orgId, String);
    if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
    return Players.find({ org_id: orgId });
  });
  ```
- Never trust a client-supplied `org_id` / `player_id` / `target_user_id` without
  confirming it belongs to the caller's org.

### UI: Vue 3 render-function modules (NOT .vue SFCs)

Pages under `app/imports/ui/pages/*.js` are plain `.js` Composition-API modules with a
backtick-string template and Bootstrap 5 markup:

```js
import { defineComponent } from 'vue';
export default defineComponent({
  name: 'ExamplePage', // illustrative skeleton — see real pages in app/imports/ui/pages/
  setup() { /* ... */ return { /* exposed to template */ }; },
  template: `<div class="container"> ... </div>`,
});
```

- There are **no `.vue` files** — eslint-plugin-vue can't lint these templates, so be
  careful with `:key` on `v-for`, reactivity, and cleanup.
- Reactivity goes through the **local composables** in `app/imports/ui/composables.js`,
  not a third-party package: `useTracker(fn)`, `useSubscribe(pubName, ...args)`,
  `useUser()`, `useUserId()`, and `useActiveOrg()` → `{ activeOrgId, setActiveOrg,
  syncFromStorage }`. `useTracker`/`useSubscribe` already stop themselves in
  `onUnmounted`; if you create a raw `Meteor.subscribe`/`Tracker.autorun`, stop it in
  `onUnmounted` yourself (see `App.js`'s `orgSubHandle`).
- Active organization is persisted in `localStorage` under key
  `scorekeeper_active_org`.
- **Routing** (`app/imports/ui/router.js`): add the page to the `routes[]` array **above**
  the catch-all `'/:pathMatch(.*)*'`. Route `meta`: `{ public: true }` = login only,
  `{ authOnly: true }` = needs login, **no meta = requires an active org** (the
  `beforeEach` guard auto-selects one). Guards use the return-value style (return a route
  location to redirect, return nothing to allow) — vue-router's `next` callback is
  deprecated.

### Domain: Bonzini USA Elo ratings

The rating math lives in `app/imports/api/methods.js` (`winExpectancy`, `updateRating`,
the `update{2v2,1v1,2v1}Ratings` mode branches). `K = 50`, interval scale `F = 1000`,
`winExpectancy(r, o) = 1 / (10^(-(r-o)/1000) + 1)`, `Rn = ratingToAdjust + K·(S - We)`,
where the Elo score `S` is `1` (win), `0` (loss), or `0.5` (tie). It is asymmetric — be
careful which rating is fed to win-expectancy vs which is adjusted, and that each side gets
the complementary score (`redScore` / `blueScore = 1 - redScore`). A tie is a legitimate
result, handled as an Elo draw (`S = 0.5` for both sides). The math is covered by
`app/imports/api/methods.tests.js` (run `npm test` from `app/`).

### Helpful automations in this repo

- **Subagents** (`.claude/agents/`): `org-authz-reviewer`, `elo-correctness-reviewer`,
  `meteor3-async-reviewer`, `vue-render-fn-reviewer` — read-only reviewers that
  auto-trigger on relevant diffs.
- **Skills** (`.claude/skills/`): `gen-meteor-test`, `new-page`, `new-method`,
  `release-notes`.
