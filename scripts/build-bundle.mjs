import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "bundle");
const push = process.argv.includes("--push");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit", windowsHide: true });
}

function git(args, cwd = root) {
  run("git", args, cwd);
}

function commitStagedChanges(cwd, message) {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd,
    stdio: "ignore",
  });
  if (result.status === 0) return false;
  if (result.status !== 1) throw new Error(`Could not inspect staged changes in ${cwd}`);
  git(
    [
      "-c",
      "user.name=github-actions[bot]",
      "-c",
      "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "commit",
      "-m",
      message,
    ],
    cwd,
  );
  return true;
}

for (const path of ["backend/server.js", "frontend/angular.json", "cli/cli.js"]) {
  if (!existsSync(join(root, path))) {
    throw new Error(`Missing initialized source submodule file: ${path}`);
  }
}
if (!existsSync(join(bundle, ".git"))) {
  throw new Error("The bundle submodule is not initialized.");
}

git(["submodule", "update", "--init", "--remote", "backend", "frontend", "cli"]);
run(npm, ["install"], join(root, "frontend"));
run(npx, ["ng", "build"], join(root, "frontend"));

const frontendBuild = join(
  root,
  "frontend",
  "dist",
  "snip-frontend",
  "browser",
);
const indexFile = join(frontendBuild, "index.html");
if (!existsSync(indexFile)) {
  throw new Error(`Angular build output is missing: ${indexFile}`);
}

const publicDir = join(bundle, "public");
rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
cpSync(frontendBuild, publicDir, { recursive: true });
cpSync(join(root, "backend", "server.js"), join(bundle, "server.js"));
cpSync(join(root, "cli", "cli.js"), join(bundle, "cli.js"));
writeFileSync(join(bundle, ".env"), "PUBLIC_DIR=./public\n");
writeFileSync(
  join(bundle, "package.json"),
  `${JSON.stringify({ name: "snip-bundle", scripts: { start: "bun server.js" } }, null, 2)}\n`,
);
writeFileSync(
  join(bundle, "Dockerfile"),
  [
    "FROM oven/bun:1-alpine",
    "WORKDIR /app",
    "COPY . .",
    "ENV PORT=3000",
    "EXPOSE 3000",
    'CMD ["bun", "server.js"]',
    "",
  ].join("\n"),
);
writeFileSync(
  join(bundle, ".dockerignore"),
  ["node_modules", ".git", ".gitmodules", "npm-debug.log*", "coverage", ""].join("\n"),
);
writeFileSync(
  join(bundle, "railway.json"),
  `${JSON.stringify(
    {
      $schema: "https://railway.app/railway.schema.json",
      build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
      deploy: { startCommand: "bun server.js", healthcheckPath: "/api/links" },
    },
    null,
    2,
  )}\n`,
);

git(["add", "-A"], bundle);
const bundleChanged = commitStagedChanges(bundle, "Build generated Snip release bundle");

git(["add", "-A", "--", "README.md", "scripts/build-bundle.mjs", "backend", "frontend", "cli", "bundle"]);
const mainChanged = commitStagedChanges(root, "Update Snip release bundle and source pointers");

if (push) {
  if (bundleChanged || mainChanged) git(["push", "origin", "HEAD:bundle"], bundle);
  git(["push", "origin", "HEAD:main"]);
}

if (!bundleChanged && !mainChanged) {
  console.log("unchanged");
} else {
  console.log(
    `Bundle ${bundleChanged ? "updated" : "unchanged"}; main pointers ${mainChanged ? "updated" : "unchanged"}.`,
  );
}
