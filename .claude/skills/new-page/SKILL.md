---
name: new-page
description: Scaffold a new Scorekeeper page/screen/route. Use when asked to "add a page", "create a screen", "new route", "make a stats/list page", or wire a new Vue render-function page into the router (and a publication if it reads data). Produces a render-function .js component, a router entry, and an org-guarded publication.
disable-model-invocation: true
argument-hint: "[PageName] [route-path]"
allowed-tools: Read, Write, Edit
---

# new-page

Scaffolds a Scorekeeper page. `$1` = `PageName` (PascalComponentName, e.g. `MatchHistory`). `$2` = `route-path` (e.g. `/matchhistory`). Scorekeeper pages are Vue 3 **render-function `.js` modules**, NOT `.vue` SFCs.

Make exactly these edits (2 files for a static page, 3 if it reads data):

## 1. Component — `app/imports/ui/pages/<PageName>.js`
Copy `templates/page.js.tmpl`. Replace `__PAGE_NAME__`, `__PUB_NAME__`, `__Collection__`. This is a data page: it wires `useActiveOrg() -> activeOrgId`, subscribes via `useSubscribe`, and reads the collection scoped to `org_id: activeOrgId.value` inside `useTracker`. For a form/method page (no data read) instead model `AddPlayer.js`: keep the `useActiveOrg` + `useSubscribe` lines but call `Meteor.callAsync('method', { ...doc, org_id: activeOrgId.value })`; no new publication needed (reuse an existing one or none).

## 2. Route — `app/imports/ui/router.js`
- Add `import <PageName> from './pages/<PageName>.js';` with the other page imports.
- Add the route entry to `routes[]` **ABOVE the catch-all `'/:pathMatch(.*)*'`** (the `notFound` route). If it goes below, the page 404s.
- **Meta: a new DATA page gets NO meta** — no `meta: { public: true }` (that's login only) and no `meta: { authOnly: true }` (org-select/profile only). Omitting meta means the router guard requires an active org, which is what every data page needs. Only set meta if the page must render before an org is chosen.

```js
{ path: '$2', name: '<camelName>', component: <PageName> },
```

## 3. Publication — `app/imports/api/publications.js` (only if the page READS data)
Every new data page MUST have a matching org-guarded publication, or you leak another org's data — a multi-tenancy bug. Copy `templates/publication.js.tmpl`, name it `__PUB_NAME__`, point it at the collection. The block MUST keep all four guards in order:

```js
if (!orgId) return this.ready();          // no org selected
check(orgId, String);                      // validate
if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();  // membership gate
return Collection.find({ org_id: orgId }); // org-scoped query only
```

`requireOrgAccess(userId, orgId)` is the helper already defined at the top of `publications.js` (returns true iff an `OrganizationMembers` doc exists for `{ org_id, user_id }`). For a **ratings** collection there is no `org_id` field — scope by `player_id: { $in: playerIds }` where `playerIds` come from `Players.find({ org_id: orgId }).fetchAsync()` (see the `combined_ratings` publish block).

## Rules
- Server Mongo is async-only: `fetchAsync`/`findOneAsync` (used in publish/methods). Client minimongo in `useTracker` uses sync `find().fetch()`/`findOne()`.
- Subscription names are strings shared between `useSubscribe('<pub>', ...)` and `Meteor.publish('<pub>', ...)` — keep them identical.
- Never query a collection without an `org_id` (or org-derived `player_id`) filter on either client or server.
