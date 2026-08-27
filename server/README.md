# marketplace_olx backend

A self-contained replacement for the course backend that used to live at
`marketplace.node.ed.asmer.org.ua`. That host is gone — its proxy now answers every path
with `404 page not found` behind a default self-signed certificate, while still issuing an
`http → https` redirect. A redirect is not allowed on a CORS preflight, which is where the
original `Access to fetch … has been blocked by CORS policy` error came from.

This server implements exactly the API the frontend in `../src` already speaks, so no
application code had to be rewritten.

## Running it

```bash
cd server
npm install
npm run seed     # optional: 3 demo users, 12 ads, comments, placeholder images
npm start        # http://localhost:4000
```

Then start the frontend in a second terminal:

```bash
cd ..
npm start        # http://localhost:3000
```

`npm run dev` starts the server with `node --watch` if you want reloads on save.

Demo logins after seeding: **demo1**, **demo2**, **demo3** — password **123456**.

## Pointing the frontend somewhere else

`src/config.js` reads `REACT_APP_BACKEND_URL` and falls back to `http://localhost:4000/`.
To use a different backend, create `.env.local` in the project root:

```
REACT_APP_BACKEND_URL=http://localhost:4000/
```

The trailing slash is required — urls are built as `config.backendURL + 'graphql'` and
`config.backendURL + image.url`.

## API

| | |
|---|---|
| `POST /graphql` | queries and mutations |
| `POST /upload` | multipart, single `photo` field, `Authorization: Bearer <token>` required |
| `GET /uploads/<name>` | uploaded and seeded files |
| `GET /` | status and record counts |

**Queries** — `login`, `UserFind`, `UserFindOne`, `UserCount`, `AdFind`, `AdFindOne`,
`AdCount`, `CommentFind`, `CommentFindOne`, `CommentCount`.

**Mutations** — `createUser`, `changePassword`, `UserUpsert`, `AdUpsert`, `AdDelete`,
`CommentUpsert`.

Find/Count take the same Mongo-style query string the existing actions build, a JSON
`[filter, options]` pair:

```js
JSON.stringify([
  {$or: [{title: '/laptop/'}, {description: '/laptop/'}]},
  {sort: [{_id: -1}], limit: [5], skip: [10]}
])
```

Supported in `filter`: `$or`, `$and`, `$nor`, plain equality, `/regex/flags` strings
(case-insensitive by default, so an empty search box matches everything), `$in`, `$nin`,
`$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$exists`, `$regex`. In `options`: `sort`, `skip`,
`limit`. `Count` deliberately ignores `skip`/`limit` so it reports the total number of
matches.

Relations are stored in `___`-prefixed fields, which is why `AdFind` can filter on
`{___owner: userId}` the way `src/actions/userAds` does.

## Rules

- Passwords are hashed with `scrypt` (`node:crypto`) and never leave the server —
  `___password` has no field in the GraphQL schema.
- Tokens are HS256 JWTs valid for 30 days, with the payload
  `{sub: {id, login, nick, acl}}` that `src/reducers/auth` expects.
- `AdUpsert`, `AdDelete`, `CommentUpsert` and `UserUpsert` require a token; you can only
  modify your own ads, comments and profile.
- `changePassword` is reached without a token (the frontend uses `anonGql` for it), so it
  requires the current password instead.
- Logins are compared case-insensitively, so `demo1` and `Demo1` cannot become two
  accounts.
- `UserUpsert` ignores empty-string `login` and `nick` values. The profile form in
  `src/components/profile/about` starts blank and never prefills itself, so it submits
  empty strings for untouched fields — without this guard, saving a nick would erase the
  login and lock the account out.

## Storage

Everything lives in two gitignored directories:

- `data/db.json` — users, ads, comments, images, plus the generated JWT signing secret.
  Plain JSON, safe to read and edit while the server is stopped. Writes are batched and
  atomic (temp file + rename).
- `uploads/` — uploaded and seeded image files.

Delete both and restart for a clean slate. `npm run seed` wipes the database and replaces
the seeded placeholder images, but leaves files you uploaded yourself in place.

Set `JWT_SECRET` or `PORT` in the environment to override the defaults.
