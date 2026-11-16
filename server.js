const { randomInt } = require("node:crypto"); // AI-Gen
const { stat } = require("node:fs/promises"); // AI-Gen
const { isAbsolute, relative, resolve, sep } = require("node:path"); // AI-Gen
const links = new Map(); // AI-Gen
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // AI-Gen
const port = Number(process.env.PORT ?? "3000"); // AI-Gen
if (!Number.isInteger(port) || port < 1 || port > 65535) { // AI-Gen
  throw new Error("PORT must be an integer between 1 and 65535"); // AI-Gen
} // AI-Gen
const publicDir = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : null; // AI-Gen

// AI-Gen - Resolves the public origin used when constructing short URLs.
function getBaseUrl() { // AI-Gen
  const configured = process.env.BASE_URL?.trim(); // AI-Gen
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim(); // AI-Gen
  const value = configured || (railwayDomain ? `https://${railwayDomain}` : `http://localhost:${port}`); // AI-Gen
  const parsed = new URL(value); // AI-Gen
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") { // AI-Gen
    throw new Error("BASE_URL must use http or https"); // AI-Gen
  } // AI-Gen
  return parsed.origin; // AI-Gen
} // AI-Gen

const baseUrl = getBaseUrl(); // AI-Gen

// AI-Gen - Builds permissive CORS headers for browser clients.
function corsHeaders() { // AI-Gen
  return { // AI-Gen
    "Access-Control-Allow-Origin": "*", // AI-Gen
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", // AI-Gen
    "Access-Control-Allow-Headers": "Content-Type", // AI-Gen
  }; // AI-Gen
} // AI-Gen

// AI-Gen - Returns a JSON response with CORS headers.
function jsonResponse(body, status = 200) { // AI-Gen
  return new Response(JSON.stringify(body), { // AI-Gen
    status, // AI-Gen
    headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }, // AI-Gen
  }); // AI-Gen
} // AI-Gen

// AI-Gen - Generates an unused six-character base62 code.
function createCode() { // AI-Gen
  let code; // AI-Gen
  do { // AI-Gen
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(""); // AI-Gen
  } while (links.has(code)); // AI-Gen
  return code; // AI-Gen
} // AI-Gen

// AI-Gen - Serves a safe, existing file from PUBLIC_DIR when configured.
async function serveStatic(pathname) { // AI-Gen
  if (!publicDir) { // AI-Gen
    return null; // AI-Gen
  } // AI-Gen
  let decodedPath; // AI-Gen
  try { // AI-Gen
    decodedPath = decodeURIComponent(pathname); // AI-Gen
  } catch { // AI-Gen
    return new Response("Bad Request", { status: 400, headers: corsHeaders() }); // AI-Gen
  } // AI-Gen
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, ""); // AI-Gen
  const filePath = resolve(publicDir, relativePath); // AI-Gen
  const fileRelativePath = relative(publicDir, filePath); // AI-Gen
  if (fileRelativePath === ".." || fileRelativePath.startsWith(`..${sep}`) || isAbsolute(fileRelativePath)) { // AI-Gen
    return null; // AI-Gen
  } // AI-Gen
  let fileInfo; // AI-Gen
  try { // AI-Gen
    fileInfo = await stat(filePath); // AI-Gen
  } catch (error) { // AI-Gen
    if (error.code === "ENOENT" || error.code === "ENOTDIR") { // AI-Gen
      return null; // AI-Gen
    } // AI-Gen
    throw error; // AI-Gen
  } // AI-Gen
  if (!fileInfo.isFile()) { // AI-Gen
    return null; // AI-Gen
  } // AI-Gen
  return new Response(Bun.file(filePath), { headers: corsHeaders() }); // AI-Gen
} // AI-Gen

// AI-Gen - Implements the shared link API, redirects, CORS, and optional static hosting.
async function handleRequest(request) { // AI-Gen
  const requestUrl = new URL(request.url); // AI-Gen
  const pathname = requestUrl.pathname; // AI-Gen
  if (request.method === "OPTIONS") { // AI-Gen
    return new Response(null, { status: 204, headers: corsHeaders() }); // AI-Gen
  } // AI-Gen
  if (pathname === "/api/links") { // AI-Gen
    if (request.method === "GET") { // AI-Gen
      return jsonResponse(Array.from(links.values())); // AI-Gen
    } // AI-Gen
    if (request.method === "POST") { // AI-Gen
      let payload; // AI-Gen
      try { // AI-Gen
        payload = await request.json(); // AI-Gen
      } catch { // AI-Gen
        return jsonResponse({ error: "Request body must be valid JSON" }, 400); // AI-Gen
      } // AI-Gen
      if (!payload || typeof payload.url !== "string") { // AI-Gen
        return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400); // AI-Gen
      } // AI-Gen
      let parsedUrl; // AI-Gen
      try { // AI-Gen
        parsedUrl = new URL(payload.url); // AI-Gen
      } catch { // AI-Gen
        return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400); // AI-Gen
      } // AI-Gen
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") { // AI-Gen
        return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400); // AI-Gen
      } // AI-Gen
      const code = createCode(); // AI-Gen
      const link = { // AI-Gen
        code, // AI-Gen
        url: parsedUrl.href, // AI-Gen
        shortUrl: `${baseUrl}/${code}`, // AI-Gen
        hits: 0, // AI-Gen
        createdAt: new Date().toISOString(), // AI-Gen
      }; // AI-Gen
      links.set(link.code, link); // AI-Gen
      return jsonResponse(link, 201); // AI-Gen
    } // AI-Gen
    return jsonResponse({ error: "Method not allowed" }, 405); // AI-Gen
  } // AI-Gen
  if (request.method !== "GET") { // AI-Gen
    return jsonResponse({ error: "Method not allowed" }, 405); // AI-Gen
  } // AI-Gen
  const staticResponse = await serveStatic(pathname); // AI-Gen
  if (staticResponse) { // AI-Gen
    return staticResponse; // AI-Gen
  } // AI-Gen
  const code = pathname.startsWith("/") ? pathname.slice(1) : pathname; // AI-Gen
  if (code.includes("/")) { // AI-Gen
    return jsonResponse({ error: "Link not found" }, 404); // AI-Gen
  } // AI-Gen
  const link = links.get(code); // AI-Gen
  if (!link) { // AI-Gen
    return jsonResponse({ error: "Link not found" }, 404); // AI-Gen
  } // AI-Gen
  link.hits += 1; // AI-Gen
  return new Response(null, { // AI-Gen
    status: 302, // AI-Gen
    headers: { ...corsHeaders(), Location: link.url }, // AI-Gen
  }); // AI-Gen
} // AI-Gen

const server = Bun.serve({ port, fetch: handleRequest }); // AI-Gen
console.log(`Snip backend listening on ${server.url}`); // AI-Gen
