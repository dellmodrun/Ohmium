import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(".");
const output = resolve(root, "dist-pages");
if (!output.startsWith(`${root}\\`) && !output.startsWith(`${root}/`)) throw new Error("invalid Pages output directory");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const files = ["index.html", "styles.css", "app.js", "data-client.js", "home-monitor.js", "repository-browser.js", "network-pages.js", "ohmium-core.js", "source-index.json"];
for (const file of files) cpSync(resolve(root, file), resolve(output, file));
cpSync(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });

const apiOrigin = String(process.env.OHMIUM_API_ORIGIN || "").trim().replace(/\/$/, "");
if (apiOrigin && !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(apiOrigin)) throw new Error("OHMIUM_API_ORIGIN must be an HTTPS origin without a path");
const indexPath = resolve(output, "index.html");
const index = readFileSync(indexPath, "utf8").replace('meta name="ohmium-api-base" content=""', `meta name="ohmium-api-base" content="${apiOrigin}"`);
writeFileSync(indexPath, index);
writeFileSync(resolve(output, ".nojekyll"), "");
console.log(`Pages bundle: ${output}`);
console.log(`API origin: ${apiOrigin || "NOT CONFIGURED"}`);
