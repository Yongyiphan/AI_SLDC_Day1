# Snip Frontend

Angular 22 client for the Snip URL shortener. The client calls the same-origin
`/api/links` endpoint. `ng serve` proxies API requests to the local backend at
`http://localhost:3000`; the bundled app uses the API served by the same host.

Run the backend in one terminal with `bun start`, then run this app with:

```sh
npm install
npm start
```

Open `http://localhost:4200`. Create HTTP(S) short links and view link hit counts. Links are held in backend memory and clear when that server restarts.
