---
name: new-method
description: Add a Meteor 3 server method (mutation / server action) to the Scorekeeper app, enforcing the org security contract. Use when asked to add a method, mutation, server action, or write/update/delete handler — a member action (any org member, e.g. add match/player) goes in app/imports/api/methods.js; an admin action (owner/maintainer only, e.g. manage members/players) goes in app/imports/api/org-methods.js.
disable-model-invocation: true
argument-hint: "[method_name] [member|owner|maintainer]"
allowed-tools: Read, Edit
---

# new-method

Add a Meteor 3 method to the Scorekeeper app. Pick the file by the gate helper it
needs — the helper is defined locally in that file:

- **Member action** (any org member): add to `app/imports/api/methods.js`. Gate with
  `await requireOrgMember(doc.org_id)` (defined there).
- **Admin action** (owner / maintainer): add to `app/imports/api/org-methods.js`. Gate
  with `await requireOrgRole(doc.org_id, ['owner','maintainer'])` or `['owner']`
  (defined there).

`templates/method.js.tmpl` holds both variants plus the client snippet.

## Security-critical ordering: check -> gate -> data

Inside every method body, in this exact order. Skipping or reordering is a security bug.

1. **check()** the doc shape with `meteor/check` (validate untrusted input first).
2. **gate** access: `requireOrgMember` / `requireOrgRole` — BEFORE any DB access.
3. **data**: business rules + Mongo. Server Mongo is **async only**
   (`findOneAsync`/`insertAsync`/`updateAsync`/`removeAsync`/`fetchAsync`/`countAsync`),
   every call `await`ed. Re-scope every query/write to `doc.org_id`.

A method takes exactly **one** `doc` arg. `org_id` is always `String`.

## Member template (methods.js)

```js
async <name>(doc) {
  check(doc, {
    org_id: String,
    name: String,                                         // String
    note: Match.Optional(String),                         // optional
    count: Match.Integer,                                 // integer
    kind: Match.Where((x) => ['a', 'b'].includes(x)),     // enum
    parent_id: Match.OneOf(String, null),                 // nullable id
  });
  await requireOrgMember(doc.org_id);

  await SomeCollection.insertAsync({
    org_id: doc.org_id,
    date_time: Date.now(),
    name: doc.name,
  });
},
```

## Admin template (org-methods.js)

```js
async <name>(doc) {
  check(doc, { org_id: String, target_id: String });
  await requireOrgRole(doc.org_id, ['owner', 'maintainer']); // or ['owner']

  const target = await SomeCollection.findOneAsync({
    _id: doc.target_id,
    org_id: doc.org_id,
  });
  if (!target) throw new Meteor.Error('not-found', 'Not found in this organization');
  await SomeCollection.removeAsync(target._id);
},
```

Match patterns used in-repo: `String`, `Match.Optional(String)`, `Match.Integer`,
`Match.Where((x) => [...].includes(x))`, `Match.OneOf(String, null)`. Throw
`new Meteor.Error('code', 'message')` for business-rule failures.

## Steps

1. Read the chosen file (`methods.js` or `org-methods.js`).
2. Add the new `async <name>(doc) { ... }` inside the existing `Meteor.methods({ ... })`
   block, matching surrounding style (no new import needed — `check`/`Match`/`Meteor`
   are already imported in both files).
3. Confirm ordering is check -> gate -> data and every Mongo call is `await`ed.

## Client call

```js
await Meteor.callAsync('<name>', { org_id: activeOrgId.value, /* ...fields */ });
```

Call from a Vue page (`defineComponent` with a `setup()` and a `template:` string)
or composable; wrap in try/catch and surface `e.reason` (falling back to `e.message`)
from the thrown `Meteor.Error`.
