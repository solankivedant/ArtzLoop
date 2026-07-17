// Deploy-time build: copies everything actually served over HTTP into dist/,
// minifying first-party .js/.css along the way (esbuild via npx, no added
// dependency - matches the npx --yes pattern already used by other scripts).
// The repo's own apps/*/script.js stay untouched and unminified so every tool
// still runs by double-clicking index.html with zero build step, per
// technical-defaults.md. dist/ is what a static host (Phase 0 CDN) deploys.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

// Top-level entries that are actually served; everything else (docs, .claude,
// .github, scripts, package.json, dist itself) is dev-only and stays out.
const SERVED_ENTRIES = ["index.html", "manifest.json", "sw.js", "shared", "apps", "gallery"];

// Already-minified third-party bundles - copy verbatim, don't re-minify.
const SKIP_MINIFY = [path.join(root, "shared", "vendor")];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

let minified = 0;
let copied = 0;

function shouldSkipMinify(absPath) {
  return SKIP_MINIFY.some((dir) => absPath.startsWith(dir + path.sep));
}

function copyTree(srcDir, destDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTree(srcPath, destPath);
      continue;
    }
    const ext = path.extname(entry.name);
    if ((ext === ".js" || ext === ".css") && !shouldSkipMinify(srcPath)) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      execSync(`npx --yes esbuild "${srcPath}" --minify --log-level=warning --outfile="${destPath}"`, {
        stdio: "inherit",
      });
      minified++;
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
}

for (const name of SERVED_ENTRIES) {
  const srcPath = path.join(root, name);
  if (!fs.existsSync(srcPath)) continue;
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(path.join(dist, name), { recursive: true });
    copyTree(srcPath, path.join(dist, name));
  } else {
    fs.copyFileSync(srcPath, path.join(dist, name));
    copied++;
  }
}

console.log(`Build complete: ${minified} file(s) minified, ${copied} file(s) copied verbatim -> dist/`);
