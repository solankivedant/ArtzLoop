// Verifies the root launcher grid and every apps/ folder stay in sync:
// every tool folder has a card, and every card links to a folder that exists.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

const linkedFolders = new Set(
  [...indexHtml.matchAll(/href="apps\/([^/"]+)\/index\.html"/g)].map(m => m[1])
);

const actualFolders = new Set(
  fs.readdirSync(path.join(root, "apps"), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(root, "apps", name, "index.html")))
);

const missingFromGrid = [...actualFolders].filter(f => !linkedFolders.has(f));
const missingFromDisk = [...linkedFolders].filter(f => !actualFolders.has(f));

let ok = true;
if (missingFromGrid.length) {
  ok = false;
  console.error("Tools with no card in index.html:", missingFromGrid.join(", "));
}
if (missingFromDisk.length) {
  ok = false;
  console.error("index.html links to missing tool folders:", missingFromDisk.join(", "));
}

if (!ok) {
  process.exit(1);
}
console.log(`OK: ${actualFolders.size} tools, all linked from index.html.`);
