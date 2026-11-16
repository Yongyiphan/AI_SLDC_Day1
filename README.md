# Snip backend

A zero-dependency Bun API for creating and listing short links, redirecting to
their destinations, and optionally serving static files from `PUBLIC_DIR`.
Links are held in memory and are cleared when the server restarts.

## Run

Requires Bun 1.x.

```powershell
bun start
```

The server listens on port `3000` by default. Set `PORT` to change it.
`BASE_URL` controls the origin in returned `shortUrl` values; otherwise the
server uses `https://$RAILWAY_PUBLIC_DOMAIN` when set, or
`http://localhost:$PORT`. Set `PUBLIC_DIR` to serve files from a directory,
with `/` mapped to `index.html`.

## API

- `POST /api/links` with `{"url":"https://example.com"}` returns a link object.
- `GET /api/links` returns all link objects.
- `GET /:code` redirects to the destination and increments its hit count.
