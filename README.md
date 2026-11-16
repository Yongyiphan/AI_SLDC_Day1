# Snip

Snip is a small URL shortener: one Bun API serves both an Angular web client and
a Node.js CLI. The backend stores links in memory, so a restart clears them.

## API

| Method | Path | Request | Result |
| --- | --- | --- | --- |
| POST | `/api/links` | `{"url":"https://example.com"}` | `201` link object; `400` for invalid JSON or URL |
| GET | `/api/links` | — | `200` array of link objects |
| GET | `/:code` | — | `302` redirect and hit increment; `404` for an unknown code |

A link object contains `code`, `url`, `shortUrl`, `hits`, and `createdAt`.

## Repository layout

`backend`, `frontend`, `cli`, and generated `bundle` are independent branches
mounted as submodules on `main`. The gitlink in `main` pins the exact commit used
for each component. Always clone recursively:

```powershell
git clone --recurse-submodules https://github.com/Yongyiphan/AI_SLDC_Day1.git
```

## Run locally

Requirements: Bun 1.x, Node.js 20+ with npm. From the `main` checkout, use three
terminals:

```powershell
cd backend
bun start
```

```powershell
cd frontend
npm install
npx ng serve
```

```powershell
cd cli
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

The web app is at `http://localhost:4200`; the API defaults to
`http://localhost:3000`. The CLI accepts `SNIP_API` to override its API origin.

## Build and release

From `main`, run `node scripts/build-bundle.mjs` to update source submodules,
build the Angular app, and assemble `bundle/`. Running it again with no source
changes is a no-op. Add `--push` to publish the generated `bundle` branch and
the updated `main` pointers.

The Docker image is built from the pinned `bundle` submodule and published to
`ghcr.io/yongyiphan/ai_sldc_day1` as `latest` and a short-SHA tag after CI
dependency and image scans pass. The bundle can also be deployed to Railway:
it listens on `PORT`, builds with its Dockerfile, and uses
`RAILWAY_PUBLIC_DOMAIN` for public short URLs.

## Updating a component

Commit and push changes from inside that component's branch first. Then, from
`main`, run `git submodule update --remote <path>`, stage that submodule path,
and commit the pointer update. Rebuild and publish the bundle after source
changes. Never hand-edit `bundle/`; it is generated output.
