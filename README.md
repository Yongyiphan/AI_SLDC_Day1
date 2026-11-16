# Snip CLI

A zero-dependency Node.js command-line client for the Snip API. Requires Node.js 20 or newer.

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open ABC123
```

Set `SNIP_API` to the backend base URL to use another server; it defaults to `http://localhost:3000`.

The `snip`, `snip.cmd`, and `snip.ps1` wrappers launch `cli.js` on POSIX shells, Command Prompt, and PowerShell respectively. `npm link` installs the `snip` command from this directory.
