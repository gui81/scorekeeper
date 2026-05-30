---
name: gen-meteor-test
description: Scaffold a Meteor 3 test for the Scorekeeper app and wire the test driver. Use when asked to add tests, test a method, test the Elo / rating math, test add_match / add_player, set up mocha, or "the project has no tests". Installs meteortesting:mocha + chai and writes a *.tests.js file next to the target.
disable-model-invocation: true
argument-hint: [target-file or "elo math"]
allowed-tools: Read, Write, Edit, Bash(meteor add:*), Bash(meteor npm i:*), Bash(meteor npm install:*), Bash(meteor test:*)
---

# gen-meteor-test

Scaffolds the FIRST test in the Scorekeeper app and wires the driver. The project
currently has ZERO tests, no driver package, and no test scripts. Run every command
from the Meteor project dir `app/`.

Verified against Meteor 3 / `meteortesting:mocha` (Meteor Guide testing, packosphere):
- Driver added with `meteor add meteortesting:mocha`; chai is an npm dev dependency.
- `meteor test --driver-package meteortesting:mocha` runs in test mode.
- In plain `meteor test` mode (NOT `--full-app`) Meteor eagerly loads only files
  matching `*.test[s].*` / `*.spec[s].*`, anywhere including `imports/`. So name the
  file `<name>.tests.js`. (Files inside a `tests/` directory are ignored — use the
  filename glob, not a folder.) App code is NOT auto-loaded in this mode, so each test
  file must `import` whatever it exercises.

## Step 1 — First-run wiring (skip any part already present)

Check `app/package.json` for a `test` script and `app/.meteor/packages` for
`meteortesting:mocha`. If missing, from `app/`:

```bash
meteor add meteortesting:mocha
meteor npm i --save-dev chai
```

Then add these scripts to `app/package.json` (`scripts` block):

```json
"test": "meteor test --once --driver-package meteortesting:mocha",
"test-watch": "TEST_WATCH=1 meteor test --driver-package meteortesting:mocha"
```

## Step 2 — Generate the test file

Write `<name>.tests.js` next to the target from a bundled template:

- `templates/pure-fn.tests.js.tmpl` — for the Elo math (RECOMMEND STARTING HERE).
- `templates/method.tests.js.tmpl` — for a server method + collection state.

Conventions baked into the templates: use **non-arrow** `function () {}` mocha
callbacks wherever `this` matters (e.g. `this.timeout(...)`), `async` `it()` for
anything touching Mongo (server Mongo is async-only: `insertAsync` / `findOneAsync` /
`removeAsync`), and clean the DB in `beforeEach` (`removeAsync({})`) for a known state.

### IMPORTANT — the Elo functions are not exported

In `app/imports/api/methods.js` **only `addPlayer` is exported** (`export { addPlayer };`).
The pure Elo functions — `winExpectancy`, `updateRating`, `getLastTeamRating`,
`updateAllRatings` — are NOT exported. To use `templates/pure-fn.tests.js.tmpl` you must
FIRST add to `methods.js`:

```js
export { winExpectancy, updateRating };
```

(Add only what your test imports.) The math, for assertions:
`winExpectancy(r, o) = 1 / (10^(-(r - o) / 1000) + 1)` with `K = 50`, `F = 1000`.
Equal ratings → `winExpectancy === 0.5`. A win delta is `K * (S - We)`; for equal
ratings a win adds `50 * (1 - 0.5) = 25`.

Alternatively, exercise the math end-to-end WITHOUT editing exports by calling
`Meteor.callAsync('add_match', { ro, bo, rs, bs, org_id })` with a logged-in user and an
org-member fixture, then asserting the rating collections — see the method template.

## Step 3 — Run once and confirm green

From `app/`:

```bash
meteor npm test
```

(equivalently `meteor test --once --driver-package meteortesting:mocha`). It must exit 0
with the new test passing. To run only server tests: prefix `TEST_CLIENT=0`.

## Real signatures (match these — do not invent)

- `add_match(doc)` — `doc = { ro:String, rd?:String, bo:String, bd?:String, rs:Int, bs:Int, org_id:String }`,
  gated by `await requireOrgMember(doc.org_id)`. Scores 0–10, no ties.
- `add_player(doc)` — `doc = { playername:String, rating:250|750|1250|1750|2250, org_id:String }`.
- `addPlayer(playerName, rating, orgId, userId?)` — exported helper; seeds the player +
  initial rows in CombinedRatings / SinglesRatings / OffenseRatings / DefenseRatings.
- Org membership fixture: insert into `OrganizationMembers` (from
  `app/imports/api/organizations.js`) `{ org_id, user_id, role }`. `requireOrgMember`
  reads `Meteor.userId()`, so stub it (see method template).
