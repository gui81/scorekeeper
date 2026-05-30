# scorekeeper

A simple web app for tracking foosball scores, player/team statistics, and
Bonzini USA Elo ratings. It's multi-tenant: players and matches are scoped to
the organization you log into.

Built with **Meteor 3 + Vue 3 + MongoDB**. All app code lives in
[`app/`](app/); common tasks are wrapped in the top-level `Makefile` (run `make`
to list them).

## Features

- Record 1v1, 2v2, and 2v1 matches — ties included
- Per-player and per-team records: win %, streaks, head-to-head, partners
- Elo ratings for combined, singles, offense, defense, and team play
- Multiple organizations, with accounts and role-based access

## Quick start

Install [Meteor 3](https://www.meteor.com/) (it bundles Node 22), then:

```sh
git clone https://github.com/gui81/scorekeeper.git
cd scorekeeper
make install   # meteor npm install
make dev       # serves http://localhost:3000 (bundled MongoDB on :3001)
```

## Development

```sh
make lint       # eslint + prettier check  (make lint-fix to auto-fix)
make test       # run the test suite once
```

## Deployment

A multi-stage `Dockerfile` (built on Red Hat's hardened Node 22 images) and
`docker-compose.yml` run the app alongside MongoDB:

```sh
make up     # build + start app and MongoDB on http://localhost:3000
make logs   # follow logs
make down   # stop
```
