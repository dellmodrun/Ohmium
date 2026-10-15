#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const args = process.argv.slice(2), commandName = args.shift(), configPath = resolve(process.env.OHMIUM_WORKER_CONFIG || ".ohmium-worker.json");
const option = (name) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const server = option("server") || "http://127.0.0.1:4210";
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : null;

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (config?.secret && !headers.authorization) headers.authorization = `Bearer ${config.secret}`;
  const response = await fetch(`${server}${path}`, { ...options, headers });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function executable(program) {
  const docker = "C:/Program Files/Docker/Docker/resources/bin/docker.exe";
  return process.platform === "win32" && program === "docker" && existsSync(docker) ? docker : program;
}

function run(program, argv, { cwd, timeout = 900000 } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable(program), argv, { cwd, windowsHide: true }), stdout = [], stderr = [];
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${program} timed out`)); }, timeout);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8"), error = Buffer.concat(stderr).toString("utf8");
      if (code !== 0) reject(new Error(`${program} failed (${code})\n${error.slice(-4000)}`));
      else resolveRun({ stdout: out, stderr: error });
    });
  });
}

function parseMetric(stdout) {
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) throw new Error("benchmark produced no output");
  try { const value = JSON.parse(line); if (Number.isFinite(Number(value.metric))) return Number(value.metric); } catch {}
  const value = Number(line);
  if (!Number.isFinite(value)) throw new Error('benchmark final line must be a number or {"metric": number}');
  return value;
}

async function sandbox(task, patch) {
  const runRoot = resolve(process.env.OHMIUM_RUN_ROOT || tmpdir());
  mkdirSync(runRoot, { recursive: true });
  const work = mkdtempSync(join(runRoot, "ohmium-run-")), source = join(work, "source"), patchFile = join(work, "mutation.patch");
  try {
    await run("git", ["clone", "--quiet", "--no-checkout", "--filter=blob:none", task.repository, source], { timeout: 300000 });
    await run("git", ["-C", source, "checkout", "--quiet", task.baseCommit], { timeout: 120000 });
    const dockerBase = ["run", "--rm", "--network", "none", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "256", "--cpus", String(config?.machine?.resources?.cpu || 2), "--memory", `${config?.machine?.resources?.memoryGb || 4}g`, "-v", `${source}:/workspace`, "-w", "/workspace", task.dockerImage];
    const execute = (command) => run("docker", [...dockerBase, ...command], { timeout: 900000 });
    await execute(task.testCommand);
    const baselineMetric = parseMetric((await execute(task.benchmarkCommand)).stdout);
    writeFileSync(patchFile, patch);
    await run("git", ["-C", source, "apply", "--whitespace=nowarn", patchFile]);
    await execute(task.testCommand);
    const candidateMetric = parseMetric((await execute(task.benchmarkCommand)).stdout);
    return { baselineMetric, candidateMetric, testsPassed: true };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

function requireConfig() { if (!config) throw new Error("register this worker first"); }

try {
  if (commandName === "doctor") {
    for (const tool of ["git", "docker"]) console.log(`${tool}: ${(await run(tool, ["--version"], { timeout: 15000 })).stdout.trim()}`);
    console.log(`server: ${(await api("/api/health")).service} online`);
  } else if (commandName === "register") {
    const name = option("name");
    if (!name) throw new Error("usage: worker register --name <name> [--target rust]");
    const result = await api("/api/machines/register", { method: "POST", body: JSON.stringify({ name, target: option("target") || "general", repository: option("repository") || "", cpu: option("cpu") || 2, memoryGb: option("memory") || 4, registrationKey: option("registration-key") }) });
    writeFileSync(configPath, JSON.stringify({ server, machine: result.machine, secret: result.secret }, null, 2), { mode: 0o600 });
    console.log(`registered ${result.machine.name} (${result.machine.id})`);
    console.log(`credentials saved to ${configPath}`);
  } else if (commandName === "start") {
    requireConfig();
    const automatic = args.includes("--auto") || option("role") === "verifier";
    let verifying = false, jobsCompleted = 0, failures = 0, previousCpu = process.cpuUsage(), previousCpuAt = process.hrtime.bigint();
    const runtimeTelemetry = () => {
      const currentCpu = process.cpuUsage(), currentAt = process.hrtime.bigint(), memory = process.memoryUsage();
      const elapsedUs = Number(currentAt - previousCpuAt) / 1000;
      const usedUs = (currentCpu.user - previousCpu.user) + (currentCpu.system - previousCpu.system);
      previousCpu = currentCpu; previousCpuAt = currentAt;
      return { cpuPct: Number(Math.max(0, Math.min(100, elapsedUs > 0 ? (usedUs / elapsedUs) * 100 : 0)).toFixed(2)), rssMb: Number((memory.rss / 1048576).toFixed(2)), heapMb: Number((memory.heapUsed / 1048576).toFixed(2)), uptimeSec: Math.floor(process.uptime()), jobsCompleted, failures };
    };
    const heartbeat = async (status, activity = process.env.OHMIUM_ACTIVITY || "idle; polling verification queue") => {
      const result = await api("/api/machines/heartbeat", { method: "POST", body: JSON.stringify({ status: status || "online", activity, telemetry: runtimeTelemetry() }) });
      console.log(`${new Date().toISOString()} heartbeat ${result.machine.id} ${result.machine.status}`);
    };
    const verifyQueue = async () => {
      if (!automatic || verifying) return;
      verifying = true;
      try {
        const current = await api("/api/state");
        const queue = current.mutations.filter((item) => item.status === "verifying" && item.machineId !== config.machine.id && !item.verifications.some((vote) => vote.machineId === config.machine.id));
        for (const mutation of queue) {
          const task = current.tasks.find((item) => item.id === mutation.taskId);
          if (!task) continue;
          await heartbeat("busy", `verifying ${mutation.id}`);
          const full = await api(`/api/mutations/${mutation.id}`), result = await sandbox(task, full.mutation.patch);
          await api(`/api/mutations/${mutation.id}/verify`, { method: "POST", body: JSON.stringify({ observedBaselineMetric: result.baselineMetric, observedMetric: result.candidateMetric, testsPassed: result.testsPassed }) });
          jobsCompleted += 1;
        }
      } catch (error) { failures += 1; console.error(`${new Date().toISOString()} auto-verify: ${error.message}`); }
      finally { verifying = false; await heartbeat("online").catch(() => {}); }
    };
    await heartbeat("online"); await verifyQueue();
    setInterval(() => heartbeat("online").catch((error) => console.error(error.message)), 20000);
    setInterval(verifyQueue, 12000);
  } else if (commandName === "tasks") {
    const result = await api("/api/tasks");
    if (!result.tasks.length) console.log("no tasks available");
    for (const task of result.tasks) console.log(`${task.id}\t${task.status}\t${task.title}\t${task.repository}@${task.baseCommit.slice(0, 8)}`);
  } else if (commandName === "publish") {
    const file = args[0], admin = option("admin");
    if (!file || !admin) throw new Error("usage: worker publish <task.json> --admin <token>");
    console.log(JSON.stringify(await api("/api/tasks", { method: "POST", headers: { authorization: `Bearer ${admin}` }, body: readFileSync(resolve(file), "utf8") }), null, 2));
  } else if (commandName === "claim") {
    requireConfig(); const taskId = args[0]; if (!taskId) throw new Error("usage: worker claim <task-id>");
    console.log(JSON.stringify(await api(`/api/tasks/${taskId}/claim`, { method: "POST", body: "{}" }), null, 2));
  } else if (commandName === "evaluate") {
    requireConfig(); const taskId = args[0], patchPath = option("patch"); if (!taskId || !patchPath) throw new Error("usage: worker evaluate <task-id> --patch <file.patch>");
    const current = await api("/api/state"), task = current.tasks.find((item) => item.id === taskId); if (!task) throw new Error("task not found");
    const patch = readFileSync(resolve(patchPath), "utf8"), result = await sandbox(task, patch), patchDigest = createHash("sha256").update(patch).digest("hex");
    console.log(JSON.stringify(await api("/api/mutations", { method: "POST", body: JSON.stringify({ taskId, patch, patchDigest, summary: option("summary") || basename(patchPath), ...result }) }), null, 2));
  } else if (commandName === "verify") {
    requireConfig(); const mutationId = args[0]; if (!mutationId) throw new Error("usage: worker verify <mutation-id>");
    const [{ mutation }, current] = await Promise.all([api(`/api/mutations/${mutationId}`), api("/api/state")]), task = current.tasks.find((item) => item.id === mutation.taskId); if (!task) throw new Error("task not found");
    const result = await sandbox(task, mutation.patch);
    console.log(JSON.stringify(await api(`/api/mutations/${mutationId}/verify`, { method: "POST", body: JSON.stringify({ observedBaselineMetric: result.baselineMetric, observedMetric: result.candidateMetric, testsPassed: result.testsPassed }) }), null, 2));
  } else console.log("Ohmium worker\n\n  doctor\n  register --name <name>\n  start [--auto]\n  tasks\n  publish <task.json> --admin <token>\n  claim <task-id>\n  evaluate <task-id> --patch <file.patch>\n  verify <mutation-id>");
} catch (error) { console.error(`ohmium-worker: ${error.message}`); process.exitCode = 1; }
