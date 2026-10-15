import http from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, normalize, relative, resolve } from "node:path";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const root = resolve(import.meta.dirname);
const dataDir = resolve(process.env.OHMIUM_DATA_DIR || resolve(root, "data"));
const dataFile = resolve(dataDir, "state.json");
const port = Number(process.env.PORT || 4210);
const host = process.env.HOST || "127.0.0.1";
const adminToken = process.env.OHMIUM_ADMIN_TOKEN || "";
const registrationKey = process.env.OHMIUM_REGISTRATION_KEY || "";
const allowedOrigin = process.env.OHMIUM_ALLOWED_ORIGIN || "";
const clients = new Set(), rate = new Map(), metrics = { startedAt: Date.now(), requests: 0, samples: [] };
const officialCatalog = JSON.parse(readFileSync(resolve(root, "official-agents.json"), "utf8"));
const economicPolicy = Object.freeze({
  schema: "ohmium.economics.v1",
  network: "solana",
  symbol: "OHMIUM",
  mint: null,
  treasuryAddress: null,
  agentActivation: { burnTokens: 10000, permanent: true, enabled: false, proofRequired: true },
  creatorRewards: {
    source: "Pump.fun Creator Rewards",
    basis: "actual receipts only",
    allocation: { computePct: 30, verificationPct: 20, infrastructurePct: 10, agentIncentivesPct: 40 }
  },
  contributionWeights: { acceptedWorkPct: 35, availabilityPct: 25, repairPct: 25, peerVerificationPct: 15 },
  guarantees: { fixedYield: false, registrationReward: false, duplicateWorkReward: false }
});

const emptyState = () => ({ version: 4, createdAt: new Date().toISOString(), tasks: [], machines: [], mutations: [], lineage: [], events: [], treasury: { network: "solana", initialized: false, address: null, balanceSol: null, updatedAt: null } });
mkdirSync(dataDir, { recursive: true });
let state = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, "utf8")) : emptyState();
state = { ...emptyState(), ...state, version: 4 };

const now = () => new Date().toISOString();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const id = (prefix) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const finite = (value) => Number.isFinite(Number(value));
const command = (value) => Array.isArray(value) && value.length > 0 && value.length <= 24 && value.every((part) => typeof part === "string" && part.length > 0 && part.length <= 240);
const validName = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{2,23}$/.test(value);
function equal(left, right) { const a = Buffer.from(left || ""), b = Buffer.from(right || ""); return a.length === b.length && timingSafeEqual(a, b); }
function persist() { const temp = `${dataFile}.tmp`; writeFileSync(temp, JSON.stringify(state, null, 2)); renameSync(temp, dataFile); }
function cleanMachine(machine) { const { secretHash, ...publicMachine } = machine; return { ...publicMachine, status: Date.now() - Date.parse(machine.lastSeenAt) < 45000 ? machine.status : "offline" }; }
function cleanMutation(mutation) { const { patch, ...publicMutation } = mutation; return { ...publicMutation, patchBytes: patch ? Buffer.byteLength(patch) : 0 }; }
function officialAgents() {
  const machines = state.machines.map(cleanMachine);
  return officialCatalog.agents.map((agent) => {
    const machine = machines.find((item) => item.name === agent.id);
    return { ...agent, official: true, status: machine?.status || "ready", machineId: machine?.id || null, lastSeenAt: machine?.lastSeenAt || null, activity: machine?.activity || "Role profile published; no worker connected" };
  });
}
function publicState() { return { ...state, machines: state.machines.map(cleanMachine), mutations: state.mutations.map(cleanMutation), officialAgents: officialAgents(), economics: economicPolicy }; }
function emit(type, payload) { const event = { id: id("event"), type, at: now(), payload }; state.events.unshift(event); state.events = state.events.slice(0, 500); persist(); const frame = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`; for (const client of clients) client.write(frame); }
function json(response, status, value) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(value)); }
function recordCoreSample() {
  const memory = process.memoryUsage();
  const machines = state.machines.map(cleanMachine);
  metrics.samples.push({ at: now(), requests: metrics.requests, rssMb: Number((memory.rss / 1048576).toFixed(1)), heapMb: Number((memory.heapUsed / 1048576).toFixed(1)), verifying: state.mutations.filter((item) => item.status === "verifying").length, generations: state.lineage.length, openTasks: state.tasks.filter((task) => task.status === "open").length, onlineMachines: machines.filter((machine) => machine.status !== "offline").length, events: state.events.length });
  metrics.samples = metrics.samples.slice(-140);
}
recordCoreSample();
setInterval(recordCoreSample, 2000).unref();
async function body(request) { const chunks = []; let bytes = 0; for await (const chunk of request) { bytes += chunk.length; if (bytes > 600000) throw new Error("request body exceeds 600KB"); chunks.push(chunk); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
function machineAuth(request) { const token = request.headers.authorization?.replace(/^Bearer\s+/i, ""); return token ? state.machines.find((machine) => equal(machine.secretHash, hash(token))) || null : null; }
function loopback(request) { return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress); }
function adminAuth(request) { return adminToken ? equal(request.headers.authorization?.replace(/^Bearer\s+/i, ""), adminToken) : loopback(request); }
function withinLimit(request) { const key = request.socket.remoteAddress || "unknown", minute = Math.floor(Date.now() / 60000), current = rate.get(key); if (!current || current.minute !== minute) { rate.set(key, { minute, count: 1 }); return true; } current.count += 1; return current.count <= 600; }

function staticFile(response, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const files = new Set(["index.html", "styles.css", "app.js", "data-client.js", "home-monitor.js", "repository-browser.js", "network-pages.js", "agent-models.js", "live-network.js", "ohmium-core.js", "circuit-rig.js", "source-index.json"]);
  if (!files.has(requested) && !requested.startsWith("assets/")) return false;
  const file = resolve(root, normalize(requested)), rel = relative(root, file);
  if (rel.startsWith("..") || isAbsolute(rel) || !existsSync(file)) return false;
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };
  response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-cache", "x-content-type-options": "nosniff" });
  createReadStream(file).pipe(response);
  return true;
}

function repositories() {
  const urls = [...state.tasks.map((item) => item.repository), ...state.machines.map((item) => item.repository)].filter(Boolean);
  return [...new Set(urls)].map((repository) => ({ repository, source: "registered-runtime", observedAt: now() }));
}

const server = http.createServer(async (request, response) => {
  metrics.requests += 1;
  if (allowedOrigin) response.setHeader("access-control-allow-origin", allowedOrigin);
  response.setHeader("access-control-allow-headers", "content-type, authorization, x-ohmium-registration-key");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  if (request.method === "OPTIONS") { response.writeHead(204); return response.end(); }
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`), path = url.pathname;
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "no-referrer");
  try {
    if (!withinLimit(request)) return json(response, 429, { error: "rate limit exceeded" });
    if (request.method === "GET" && path === "/api/health") return json(response, 200, { ok: true, service: "ohmium-core", version: state.version, time: now(), uptimeSec: Math.floor(process.uptime()) });
    if (request.method === "GET" && path === "/api/economics") return json(response, 200, economicPolicy);
    if (request.method === "GET" && path === "/api/agents") return json(response, 200, { schema: officialCatalog.schema, label: officialCatalog.label, agents: officialAgents() });
    if (request.method === "GET" && (path === "/api/sources" || path === "/api/github-stream")) return json(response, 200, { at: now(), sources: repositories(), channels: [] });
    if (request.method === "GET" && path === "/api/telemetry") { const memory = process.memoryUsage(), machines = state.machines.map(cleanMachine); return json(response, 200, { at: now(), startedAt: new Date(metrics.startedAt).toISOString(), uptimeSec: Math.floor(process.uptime()), pid: process.pid, rssMb: Number((memory.rss / 1048576).toFixed(1)), heapMb: Number((memory.heapUsed / 1048576).toFixed(1)), requests: metrics.requests, sseClients: clients.size, onlineMachines: machines.filter((machine) => machine.status !== "offline").length, totalMachines: machines.length, openTasks: state.tasks.filter((task) => task.status === "open").length, verifying: state.mutations.filter((item) => item.status === "verifying").length, generations: state.lineage.length, events: state.events.length, samples: metrics.samples.slice(-98) }); }
    if (request.method === "GET" && path === "/api/state") return json(response, 200, publicState());
    if (request.method === "GET" && path === "/api/events") { response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" }); response.write(`event: snapshot\ndata: ${JSON.stringify(publicState())}\n\n`); clients.add(response); request.on("close", () => clients.delete(response)); return; }
    if (request.method === "GET" && path === "/api/tasks") return json(response, 200, { tasks: state.tasks });
    const mutationRead = path.match(/^\/api\/mutations\/([^/]+)$/);
    if (request.method === "GET" && mutationRead) { const machine = machineAuth(request); if (!machine) return json(response, 401, { error: "valid machine bearer token required" }); const mutation = state.mutations.find((item) => item.id === mutationRead[1]); return mutation ? json(response, 200, { mutation }) : json(response, 404, { error: "mutation not found" }); }
    if (request.method === "POST" && path === "/api/tasks") {
      if (!adminAuth(request)) return json(response, 401, { error: "admin bearer token required" });
      const input = await body(request);
      if (!/^https:\/\/.+/i.test(input.repository || "") || !/^[a-f0-9]{7,64}$/i.test(input.baseCommit || "")) return json(response, 422, { error: "valid HTTPS repository and baseCommit are required" });
      if (!command(input.testCommand) || !command(input.benchmarkCommand)) return json(response, 422, { error: "testCommand and benchmarkCommand must be argument arrays" });
      if (!/^[a-z0-9][a-z0-9._/:@-]{0,127}$/i.test(input.dockerImage || "")) return json(response, 422, { error: "valid dockerImage is required" });
      const task = { id: id("task"), title: String(input.title || "Untitled optimization").slice(0, 120), repository: String(input.repository).slice(0, 300), baseCommit: String(input.baseCommit), target: String(input.target || "repository").slice(0, 180), dockerImage: String(input.dockerImage), testCommand: input.testCommand, benchmarkCommand: input.benchmarkCommand, metric: String(input.metric || "metric").slice(0, 80), lowerIsBetter: input.lowerIsBetter !== false, minGainPct: Math.max(0, Number(input.minGainPct) || 0), status: "open", createdAt: now(), claimedBy: null };
      state.tasks.unshift(task); emit("task.created", { task }); return json(response, 201, { task });
    }
    const claim = path.match(/^\/api\/tasks\/([^/]+)\/claim$/);
    if (request.method === "POST" && claim) { const machine = machineAuth(request); if (!machine) return json(response, 401, { error: "valid machine bearer token required" }); const task = state.tasks.find((item) => item.id === claim[1]); if (!task) return json(response, 404, { error: "task not found" }); if (task.status !== "open" && task.claimedBy !== machine.id) return json(response, 409, { error: "task already claimed" }); task.status = "claimed"; task.claimedBy = machine.id; task.claimedAt = now(); emit("task.claimed", { task, machine: cleanMachine(machine) }); return json(response, 200, { task }); }
    if (request.method === "POST" && path === "/api/machines/register") {
      const input = await body(request), supplied = String(input.registrationKey || request.headers["x-ohmium-registration-key"] || "");
      if (registrationKey && !equal(supplied, registrationKey)) return json(response, 403, { error: "valid registration key required" });
      if (!validName(input.name)) return json(response, 422, { error: "name must be 3-24 lowercase letters, numbers or hyphens" });
      if (state.machines.some((machine) => machine.name === input.name)) return json(response, 409, { error: "machine name already registered" });
      const secret = `ohm_sk_${randomBytes(24).toString("base64url")}`, machine = { id: id("machine"), name: input.name, target: String(input.target || "general").slice(0, 80), repository: String(input.repository || "").slice(0, 240), wallet: input.wallet ? String(input.wallet).slice(0, 64) : null, resources: { cpu: Math.max(1, Math.min(128, Number(input.cpu) || 1)), memoryGb: Math.max(1, Math.min(512, Number(input.memoryGb) || 1)) }, status: "online", activity: "registered; awaiting worker heartbeat", telemetry: null, samples: [], createdAt: now(), lastSeenAt: now(), secretHash: hash(secret) };
      state.machines.push(machine); emit("machine.registered", { machine: cleanMachine(machine) }); return json(response, 201, { machine: cleanMachine(machine), secret, warning: "Store this secret now. It is never returned again." });
    }
    if (request.method === "POST" && path === "/api/machines/heartbeat") {
      const machine = machineAuth(request); if (!machine) return json(response, 401, { error: "valid machine bearer token required" });
      const input = await body(request), at = now(), reported = input.telemetry && typeof input.telemetry === "object" ? input.telemetry : {};
      machine.lastSeenAt = at;
      machine.status = input.status === "busy" ? "busy" : "online";
      machine.activity = String(input.activity || machine.activity || "idle").slice(0, 120);
      machine.telemetry = {
        cpuPct: finite(reported.cpuPct) ? Math.max(0, Math.min(100, Number(reported.cpuPct))) : null,
        rssMb: finite(reported.rssMb) ? Math.max(0, Math.min(1048576, Number(reported.rssMb))) : null,
        heapMb: finite(reported.heapMb) ? Math.max(0, Math.min(1048576, Number(reported.heapMb))) : null,
        uptimeSec: finite(reported.uptimeSec) ? Math.max(0, Number(reported.uptimeSec)) : null,
        jobsCompleted: finite(reported.jobsCompleted) ? Math.max(0, Math.floor(Number(reported.jobsCompleted))) : 0,
        failures: finite(reported.failures) ? Math.max(0, Math.floor(Number(reported.failures))) : 0
      };
      if (finite(input.load)) machine.load = Math.max(0, Math.min(1, Number(input.load)));
      machine.samples = Array.isArray(machine.samples) ? machine.samples : [];
      machine.samples.push({ at, status: machine.status, activity: machine.activity, ...machine.telemetry });
      machine.samples = machine.samples.slice(-36);
      persist();
      return json(response, 200, { ok: true, machine: cleanMachine(machine) });
    }
    if (request.method === "POST" && path === "/api/mutations") {
      const machine = machineAuth(request); if (!machine) return json(response, 401, { error: "valid machine bearer token required" });
      const input = await body(request), task = state.tasks.find((item) => item.id === input.taskId); if (!task) return json(response, 422, { error: "valid taskId required" }); if (task.claimedBy !== machine.id) return json(response, 409, { error: "machine must claim this task first" });
      if (typeof input.patch !== "string" || !input.patch.trim() || Buffer.byteLength(input.patch) > 400000) return json(response, 422, { error: "non-empty unified patch under 400KB required" });
      const patchDigest = hash(input.patch); if (input.patchDigest && input.patchDigest !== patchDigest) return json(response, 422, { error: "patchDigest does not match patch content" });
      if (!finite(input.baselineMetric) || !finite(input.candidateMetric) || Number(input.baselineMetric) <= 0) return json(response, 422, { error: "positive baselineMetric and candidateMetric required" });
      const baseline = Number(input.baselineMetric), candidate = Number(input.candidateMetric), gain = task.lowerIsBetter ? ((baseline - candidate) / baseline) * 100 : ((candidate - baseline) / baseline) * 100;
      if (gain <= task.minGainPct) return json(response, 422, { error: `gain must exceed ${task.minGainPct}%` });
      const mutation = { id: id("mutation"), taskId: task.id, machineId: machine.id, machineName: machine.name, repository: task.repository, target: task.target, baseCommit: task.baseCommit, patchDigest, patch: input.patch, summary: String(input.summary || "").slice(0, 500), metric: task.metric, baselineMetric: baseline, candidateMetric: candidate, lowerIsBetter: task.lowerIsBetter, claimedGainPct: Number(gain.toFixed(4)), testsPassed: input.testsPassed === true, status: input.testsPassed === true ? "verifying" : "rejected", createdAt: now(), verifications: [] };
      state.mutations.unshift(mutation); task.status = mutation.status === "verifying" ? "verifying" : "open"; emit(`mutation.${mutation.status}`, { mutation: cleanMutation(mutation) }); return json(response, 201, { mutation: cleanMutation(mutation) });
    }
    const verify = path.match(/^\/api\/mutations\/([^/]+)\/verify$/);
    if (request.method === "POST" && verify) {
      const machine = machineAuth(request); if (!machine) return json(response, 401, { error: "valid machine bearer token required" }); const mutation = state.mutations.find((item) => item.id === verify[1]); if (!mutation) return json(response, 404, { error: "mutation not found" }); if (mutation.machineId === machine.id) return json(response, 409, { error: "author machine cannot verify its own mutation" }); if (mutation.status !== "verifying") return json(response, 409, { error: `mutation is ${mutation.status}` }); if (mutation.verifications.some((item) => item.machineId === machine.id)) return json(response, 409, { error: "machine already verified this mutation" });
      const input = await body(request); if (!finite(input.observedMetric) || !finite(input.observedBaselineMetric)) return json(response, 422, { error: "observedBaselineMetric and observedMetric are required" });
      const observed = Number(input.observedMetric), observedBaseline = Number(input.observedBaselineMetric), candidateDrift = Math.abs(observed - mutation.candidateMetric) / Math.max(Math.abs(mutation.candidateMetric), 1e-9), baselineDrift = Math.abs(observedBaseline - mutation.baselineMetric) / Math.max(Math.abs(mutation.baselineMetric), 1e-9), passed = input.testsPassed === true && candidateDrift <= .05 && baselineDrift <= .05;
      mutation.verifications.push({ machineId: machine.id, machineName: machine.name, testsPassed: input.testsPassed === true, observedBaselineMetric: observedBaseline, observedMetric: observed, candidateDrift: Number(candidateDrift.toFixed(6)), baselineDrift: Number(baselineDrift.toFixed(6)), passed, at: now() });
      const task = state.tasks.find((item) => item.id === mutation.taskId); if (!passed) { mutation.status = "rejected"; if (task) { task.status = "open"; task.claimedBy = null; } } else if (mutation.verifications.filter((item) => item.passed).length >= 2) { mutation.status = "accepted"; mutation.acceptedAt = now(); mutation.generation = state.lineage.length + 1; if (task) task.status = "complete"; state.lineage.push({ generation: mutation.generation, taskId: mutation.taskId, mutationId: mutation.id, baseCommit: mutation.baseCommit, artifact: mutation.patchDigest, gainPct: mutation.claimedGainPct, acceptedAt: mutation.acceptedAt, verifiers: mutation.verifications.map((item) => item.machineId) }); }
      emit(`mutation.${mutation.status}`, { mutation: cleanMutation(mutation) }); return json(response, 200, { mutation: cleanMutation(mutation) });
    }
    if (path.startsWith("/api/")) return json(response, 404, { error: "api route not found" });
    if (!staticFile(response, path)) return json(response, 404, { error: "not found" });
  } catch (error) { console.error(error); return json(response, error instanceof SyntaxError ? 400 : 500, { error: error.message || "internal server error" }); }
});

setInterval(() => { for (const response of clients) response.write(`: keepalive ${Date.now()}\n\n`); }, 20000).unref();
server.listen(port, host, () => console.log(`Ohmium Core listening on http://${host}:${port}`));
