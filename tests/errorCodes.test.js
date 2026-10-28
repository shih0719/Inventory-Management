const path = require("path");
const fs = require("fs");

// ADR 0004: backend errors are English plus a code; the frontend shows its own text for each code.
// A code without a translation falls back to English, so every code the backend sends needs one.
const ROOT = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(ROOT, "vite-app/src/lib/i18n.ts"), "utf8");

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return p.endsWith(".js") ? [p] : [];
  });
}

/** Codes passed where the backend builds an error: failure(), new XError(), `code:`, and the per-item helpers. */
const CODE_SITES = [
  /failure\(\s*["']([A-Z_]+)["']/g,
  /Error\(\s*["']([A-Z_]+)["']/g,
  /code:\s*["']([A-Z_]+)["']/g,
  /(?:issue|rowIssue|fail|serialIssue|lineError)\([^)]*?["']([A-Z][A-Z_]+)["']/g,
];

describe("error codes", () => {
  it("every code the backend sends has a frontend translation", () => {
    const translated = new Set([...I18N.matchAll(/^ {2}([A-Z_]+): \{/gm)].map((m) => m[1]));
    const missing = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      const src = fs.readFileSync(file, "utf8");
      for (const re of CODE_SITES) {
        for (const [, code] of src.matchAll(re)) {
          if (!translated.has(code)) missing.push(`${code} (${path.relative(ROOT, file)})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
