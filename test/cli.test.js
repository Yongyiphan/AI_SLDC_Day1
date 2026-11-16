"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const {
  execute,
  getBrowserCommand,
  openInBrowser,
} = require("../cli.js");

function response(status, body, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
  });
}

test("help prints usage without calling the API", async () => {
  const output = [];
  let requested = false;
  await execute(["help"], {
    output: (text) => output.push(text),
    apiUrl: "not a URL",
    fetchImpl: async () => {
      requested = true;
      throw new Error("unexpected request");
    },
  });
  assert.match(output[0], /snip add <url>/);
  assert.equal(requested, false);
});

test("add validates input before POST and prints the returned short URL", async () => {
  const output = [];
  let requestOptions;
  await assert.rejects(
    execute(["add", "javascript:alert(1)"], {
      output: (text) => output.push(text),
      fetchImpl: async () => {
        throw new Error("invalid URL reached the API");
      },
    }),
    /valid absolute HTTP or HTTPS URL/,
  );
  await execute(["add", "https://example.com/path"], {
    apiUrl: "http://localhost:4321",
    output: (text) => output.push(text),
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://localhost:4321/api/links");
      requestOptions = options;
      return response(201, { shortUrl: "http://localhost:4321/ABC123" });
    },
  });
  assert.equal(JSON.parse(requestOptions.body).url, "https://example.com/path");
  assert.equal(output[0], "http://localhost:4321/ABC123");
});

test("ls handles empty and populated link lists", async () => {
  const output = [];
  await execute(["ls"], {
    output: (text) => output.push(text),
    fetchImpl: async () => response(200, []),
  });
  await execute(["ls"], {
    output: (text) => output.push(text),
    fetchImpl: async () =>
      response(200, [
        { code: "ABC123", hits: 9, url: "https://example.com/a" },
        { code: "XYZ789", hits: 0, url: "https://example.org/" },
      ]),
  });
  assert.equal(output[0], "No links yet.");
  assert.match(output[1], /CODE\s+HITS\s+URL/);
  assert.match(output[1], /ABC123\s+9\s+https:\/\/example.com\/a/);
  assert.match(output[1], /XYZ789\s+0\s+https:\/\/example.org\//);
});

test("open checks redirects manually, reports missing codes, and opens Location", async () => {
  const output = [];
  const opened = [];
  let requestOptions;
  await execute(["open", "ABC123"], {
    output: (text) => output.push(text),
    launchBrowser: async (url) => opened.push(url),
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return response(302, undefined, { Location: "https://example.com/a" });
    },
  });
  assert.equal(requestOptions.redirect, "manual");
  assert.deepEqual(opened, ["https://example.com/a"]);
  assert.match(output[0], /Opened https:\/\/example.com\/a/);
  await assert.rejects(
    execute(["open", "ZZZ999"], {
      fetchImpl: async () => response(404, { error: "Link not found" }),
    }),
    /not found/,
  );
});

test("API errors and invalid command arguments are explicit", async () => {
  await assert.rejects(
    execute(["open", "short"], {
      fetchImpl: async () => {
        throw new Error("request should not run");
      },
    }),
    /six-character short code/,
  );
  await assert.rejects(
    execute(["ls"], { fetchImpl: async () => response(503, { error: "Unavailable" }) }),
    /Unavailable/,
  );
});

test("browser launch command matches supported operating systems", () => {
  assert.equal(getBrowserCommand("https://example.com", "win32").command, "powershell.exe");
  assert.equal(getBrowserCommand("https://example.com", "darwin").command, "open");
  assert.equal(getBrowserCommand("https://example.com", "linux").command, "xdg-open");
});

test("browser launch starts the selected OS command and reports spawn failures", async () => {
  let invocation;
  const child = new EventEmitter();
  child.unref = () => {};
  const opening = openInBrowser("https://example.com", "linux", (command, args, options) => {
    invocation = { command, args, options };
    process.nextTick(() => child.emit("spawn"));
    return child;
  });
  await opening;
  assert.equal(invocation.command, "xdg-open");
  assert.deepEqual(invocation.args, ["https://example.com/"]);
  assert.equal(invocation.options.detached, true);

  await assert.rejects(
    openInBrowser("https://example.com", "darwin", () => {
      const failedChild = new EventEmitter();
      failedChild.unref = () => {};
      process.nextTick(() => failedChild.emit("error", new Error("browser missing")));
      return failedChild;
    }),
    /browser missing/,
  );
});

test("process exits with a nonzero code for invalid arguments", () => {
  const result = spawnSync(process.execPath, [require.resolve("../cli.js"), "open", "bad"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /six-character short code/);
});
