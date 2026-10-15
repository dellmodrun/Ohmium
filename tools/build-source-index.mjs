import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "source-index.json");
const excludedDirectories = new Set([".git", ".edge-qa", "data", "node_modules"]);
const excludedFiles = new Set(["source-index.json", ".ohmium-worker.json"]);
const visibleDotfiles = new Set([".dockerignore", ".env.example", ".github", ".gitignore"]);
const textExtensions = new Set(["", ".css", ".example", ".html", ".js", ".json", ".md", ".mjs", ".svg", ".txt", ".yml", ".yaml"]);
const languageNames = { ".css": "CSS", ".html": "HTML", ".js": "JavaScript", ".json": "JSON", ".md": "Markdown", ".mjs": "JavaScript", ".svg": "SVG", ".yml": "YAML", ".yaml": "YAML" };

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") && !visibleDotfiles.has(entry.name)) return [];
    if (excludedDirectories.has(entry.name) || excludedFiles.has(entry.name)) return [];
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    const path = relative(root, absolute).replaceAll("\\", "/"), extension = extname(entry.name).toLowerCase(), size = statSync(absolute).size;
    return [{ path, size, language: languageNames[extension] || (textExtensions.has(extension) ? "Text" : "Binary"), content: textExtensions.has(extension) ? readFileSync(absolute, "utf8") : null }];
  });
}

function localRevision() {
  try {
    const gitDirectory = resolve(root, ".git"), head = readFileSync(resolve(gitDirectory, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref: ")) return head;
    const reference = head.slice(5), loose = resolve(gitDirectory, reference);
    try { return readFileSync(loose, "utf8").trim(); } catch {
      const packed = readFileSync(resolve(gitDirectory, "packed-refs"), "utf8").split(/\r?\n/).find((line) => line.endsWith(` ${reference}`));
      return packed ? packed.split(" ")[0] : "local";
    }
  } catch { return "local"; }
}

const revision = process.env.GITHUB_SHA || localRevision();
const files = walk(root).sort((left, right) => left.path.localeCompare(right.path));
const manifest = { schema: 1, project: "Ohmium", description: "Deterministic, independently replayed code-improvement network.", revision, generatedAt: new Date().toISOString(), files };
writeFileSync(output, `${JSON.stringify(manifest)}\n`);
console.log(`Source index: ${files.length} files, ${statSync(output).size} bytes, revision ${revision.slice(0, 7)}`);
