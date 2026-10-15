import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const server = String(process.env.OHMIUM_API_URL || "http://ohmium:4210").replace(/\/$/, "");
const configPath = process.env.OHMIUM_WORKER_CONFIG || "/opt/ohmium/data/worker/config.json";
const release = process.env.OHMIUM_RELEASE_COMMIT;
if (!release || !/^[a-f0-9]{40}$/i.test(release)) throw new Error("OHMIUM_RELEASE_COMMIT is required");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(path, options = {}) {
  const response = await fetch(`${server}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `${path} returned ${response.status}`);
  return result;
}
async function run(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["/app/worker.mjs", ...args], { stdio: "inherit", env: { ...process.env, OHMIUM_WORKER_CONFIG: configPath } });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`worker command failed (${code})`)));
  });
}

for (let attempt = 0; attempt < 30 && !existsSync(configPath); attempt += 1) await sleep(1000);
if (!existsSync(configPath)) throw new Error("route agent configuration was not created");

const title = "Genesis deterministic route queue optimization";
let state = await request("/api/state");
let task = state.tasks.find((item) => item.title === title);
if (!task) {
  task = (await request("/api/tasks", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OHMIUM_ADMIN_TOKEN}` },
    body: JSON.stringify({
      title,
      repository: "https://github.com/nuttumrunit/Ohmium",
      baseCommit: release,
      target: "benchmarks/route-queue.mjs",
      dockerImage: "node:22-alpine",
      testCommand: ["node", "benchmarks/route-queue.test.mjs"],
      benchmarkCommand: ["node", "benchmarks/route-queue.bench.mjs"],
      metric: "deterministic_queue_operations",
      lowerIsBetter: true,
      minGainPct: 25
    })
  })).task;
  console.log(`Published ${task.id}`);
}
if (task.status === "complete" || task.status === "verifying") {
  console.log(`Genesis task is ${task.status}; no new submission required`);
  process.exit(0);
}
await run(["claim", task.id, "--server", server]);
await run(["evaluate", task.id, "--server", server, "--patch", "/app/genesis/route-queue.patch", "--summary", "Replace quadratic minimum scans with a stable binary heap"]);
console.log("Genesis mutation submitted for independent replay");
