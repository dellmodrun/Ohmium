import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const configPath = resolve(process.env.OHMIUM_WORKER_CONFIG || "/opt/ohmium/data/worker/config.json");
const server = String(process.env.OHMIUM_API_URL || "http://ohmium:4210").replace(/\/$/, "");
if (existsSync(configPath)) process.exit(0);

const name = process.env.OHMIUM_WORKER_NAME || "ohm-verify";
const response = await fetch(`${server}/api/machines/register`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-ohmium-registration-key": process.env.OHMIUM_REGISTRATION_KEY || "" },
  body: JSON.stringify({ name, target: "independent-verification", repository: "https://github.com/nuttumrunit/Ohmium", cpu: 1, memoryGb: 2 })
});
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(result.error || `worker registration failed (${response.status})`);
mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(configPath, JSON.stringify({ server, machine: result.machine, secret: result.secret }, null, 2), { mode: 0o600 });
console.log(`Registered production worker ${result.machine.name}`);
