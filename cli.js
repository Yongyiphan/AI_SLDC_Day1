#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");

const DEFAULT_API_URL = "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 10000;
const CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

function usage() {
  return [
    "Usage:",
    "  snip add <url>    Create a short link",
    "  snip ls           List links and hit counts",
    "  snip open <code>  Open a short link in the browser",
    "  snip help         Show this help",
    "",
    "Set SNIP_API to use a backend other than http://localhost:3000.",
  ].join("\n");
}

function getApiBaseUrl(value) {
  const rawUrl = value || DEFAULT_API_URL;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SNIP_API must be a valid HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SNIP_API must be a valid HTTP or HTTPS URL.");
  }
  return url.href.replace(/\/+$/, "");
}

function validateTargetUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Please provide a valid absolute HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Please provide a valid absolute HTTP or HTTPS URL.");
  }
  return url.href;
}

function validateCode(value) {
  if (!CODE_PATTERN.test(value || "")) {
    throw new Error("Please provide a valid six-character short code.");
  }
  return value;
}

function getBrowserCommand(target, platform = process.platform) {
  const safeTarget = validateTargetUrl(target);
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(
          `Start-Process -FilePath ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${Buffer.from(safeTarget, "utf8").toString("base64")}')))`,
          "utf16le",
        ).toString("base64"),
      ],
    };
  }
  if (platform === "darwin") {
    return { command: "open", args: [safeTarget] };
  }
  return { command: "xdg-open", args: [safeTarget] };
}

function openInBrowser(target, platform = process.platform, spawnImpl = spawn) {
  const { command, args, ...options } = getBrowserCommand(target, platform);
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      ...options,
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function request(baseUrl, path, options = {}, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error && error.name === "TimeoutError") {
      throw new Error("The API request timed out.");
    }
    throw new Error(`Could not reach the Snip API: ${error.message}`);
  }
  return response;
}

async function readError(response) {
  let message = `API request failed with HTTP ${response.status}.`;
  try {
    const body = await response.json();
    if (body && typeof body.error === "string" && body.error.trim()) {
      message = body.error.trim();
    }
  } catch {
    // Keep the HTTP status when the server does not return JSON.
  }
  return new Error(message);
}

async function execute(argv, options = {}) {
  const {
    apiUrl = process.env.SNIP_API,
    fetchImpl = fetch,
    output = (text) => console.log(text),
    launchBrowser = (target) => openInBrowser(target),
  } = options;
  const [command, ...args] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    if (args.length) {
      throw new Error("Help does not accept additional arguments.");
    }
    output(usage());
    return;
  }

  const baseUrl = getApiBaseUrl(apiUrl);

  if (command === "add") {
    if (args.length !== 1) {
      throw new Error("Usage: snip add <url>");
    }
    const url = validateTargetUrl(args[0]);
    const response = await request(
      baseUrl,
      "/api/links",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      },
      fetchImpl,
    );
    if (!response.ok) {
      throw await readError(response);
    }
    const link = await response.json();
    if (!link || typeof link.shortUrl !== "string" || !link.shortUrl) {
      throw new Error("The API returned an invalid link response.");
    }
    output(link.shortUrl);
    return;
  }

  if (command === "ls") {
    if (args.length) {
      throw new Error("Usage: snip ls");
    }
    const response = await request(baseUrl, "/api/links", {}, fetchImpl);
    if (!response.ok) {
      throw await readError(response);
    }
    const links = await response.json();
    if (!Array.isArray(links)) {
      throw new Error("The API returned an invalid links response.");
    }
    if (links.length === 0) {
      output("No links yet.");
      return;
    }
    const codeWidth = Math.max(4, ...links.map((link) => String(link.code || "").length));
    const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits ?? "").length));
    const rows = [
      `${"CODE".padEnd(codeWidth)}  ${"HITS".padStart(hitsWidth)}  URL`,
      ...links.map((link) =>
        `${String(link.code || "").padEnd(codeWidth)}  ${String(link.hits ?? "").padStart(hitsWidth)}  ${String(link.url || "")}`,
      ),
    ];
    output(rows.join("\n"));
    return;
  }

  if (command === "open") {
    if (args.length !== 1) {
      throw new Error("Usage: snip open <code>");
    }
    const code = validateCode(args[0]);
    const response = await request(
      baseUrl,
      `/${encodeURIComponent(code)}`,
      { redirect: "manual" },
      fetchImpl,
    );
    if (response.status === 404) {
      throw new Error(`Short link "${code}" was not found.`);
    }
    if (response.status < 300) {
      throw new Error(`The API did not redirect this code (HTTP ${response.status}).`);
    }
    if (response.status >= 400) {
      throw await readError(response);
    }
    const location = response.headers.get("location");
    if (!location) {
      throw new Error("The API redirect did not include a destination.");
    }
    const target = validateTargetUrl(new URL(location, baseUrl).href);
    await launchBrowser(target);
    output(`Opened ${target}`);
    return;
  }

  throw new Error(`Unknown command "${command}".\n${usage()}`);
}

async function main(argv = process.argv.slice(2)) {
  try {
    await execute(argv);
    return 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return 1;
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  execute,
  getBrowserCommand,
  main,
  openInBrowser,
  usage,
};
