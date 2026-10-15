(() => {
  if (window.__ohmiumHomeMonitorMounted) return;
  window.__ohmiumHomeMonitorMounted = true;
  const one = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const set = (selector, value) => { all(selector).forEach((node) => { node.textContent = value; }); };
  const short = (value, size = 7) => value ? `${String(value).slice(0, size)}…${String(value).slice(-4)}` : "—";
  const clock = (value) => value ? new Date(value).toLocaleTimeString([], { hour12: false }) : "—";
  const duration = (seconds = 0) => { const value = Math.max(0, Number(seconds) || 0), hours = Math.floor(value / 3600), minutes = Math.floor((value % 3600) / 60); return hours ? `${hours}h ${minutes}m` : `${minutes}m ${Math.floor(value % 60)}s`; };
  const stages = ["sensor", "filter", "oracle", "guard", "router", "memory", "archive", "verify"];
  const sampleBuffer = { requests: [], memory: [], proofs: [] };
  let previousRequests = null;

  function hashText(value) {
    return [...String(value || "")].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) >>> 0, 2166136261);
  }

  function sample(name, value) {
    const series = sampleBuffer[name];
    series.push(Number.isFinite(Number(value)) ? Number(value) : 0);
    if (series.length > 28) series.shift();
  }

  function wavePath(values) {
    if (!values.length) return "M0 14H220";
    const padded = values.length < 28 ? Array(28 - values.length).fill(values[0]).concat(values) : values.slice(-28);
    const low = Math.min(...padded), high = Math.max(...padded), span = high - low || Math.max(1, Math.abs(high));
    return padded.map((value, index) => {
      const x = index * (220 / (padded.length - 1));
      const y = 24 - ((value - low) / span) * 20;
      return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  }

  function renderWaves(telemetry) {
    const coreSamples = Array.isArray(telemetry.samples) ? telemetry.samples : [];
    if (coreSamples.length > 1) {
      sampleBuffer.requests = coreSamples.map((item, index) => index ? Math.max(0, Number(item.requests) - Number(coreSamples[index - 1].requests)) : 0).slice(-28);
      sampleBuffer.memory = coreSamples.map((item) => Number(item.rssMb) || 0).slice(-28);
      sampleBuffer.proofs = coreSamples.map((item) => (Number(item.verifying) || 0) + (Number(item.generations) || 0)).slice(-28);
      previousRequests = Number(telemetry.requests) || 0;
    } else {
    const requests = Number(telemetry.requests) || 0;
    const requestRate = previousRequests == null ? 0 : Math.max(0, requests - previousRequests);
    previousRequests = requests;
    sample("requests", requestRate);
    sample("memory", telemetry.rssMb);
    sample("proofs", (Number(telemetry.verifying) || 0) + (Number(telemetry.generations) || 0));
    }
    Object.entries(sampleBuffer).forEach(([name, values]) => {
      const path = one(`[data-wave="${name}"]`);
      if (path) path.setAttribute("d", wavePath(values));
    });
  }

  function renderParticleField(telemetry) {
    const svg = one("[data-particle-field]");
    if (!svg) return;
    const requestPhase = (Number(telemetry.requests) || 0) * 0.031;
    const uptimePhase = (Number(telemetry.uptimeSec) || 0) * 0.006;
    const memoryPhase = (Number(telemetry.rssMb) || 0) * 0.013;
    const vectors = [];
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 18; column += 1) {
        const x = 10 + column * 17.7, y = 11 + row * 16;
        const angle = Math.sin(column * 0.46 + uptimePhase) * 0.72 + Math.cos(row * 0.83 + requestPhase) * 0.48 + memoryPhase * 0.08;
        const length = 5.5 + ((column + row + Math.floor(requestPhase)) % 5) * 0.75;
        const dx = Math.cos(angle) * length, dy = Math.sin(angle) * length;
        const opacity = (0.28 + ((column * 3 + row * 5 + Math.floor(requestPhase)) % 7) * 0.07).toFixed(2);
        vectors.push(`<path class="flow-vector" style="opacity:${opacity}" d="M${x.toFixed(1)} ${y.toFixed(1)}l${dx.toFixed(1)} ${dy.toFixed(1)}"/>`);
      }
    }
    svg.innerHTML = `<defs><marker id="flow-tip" viewBox="0 0 4 4" refX="3" refY="2" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0L4 2L0 4Z"/></marker></defs>${vectors.join("")}`;
  }

  function fieldValues(items, size, salt) {
    const values = Array(size).fill(0);
    items.forEach((item, itemIndex) => {
      const source = typeof item === "string" ? item : JSON.stringify(item);
      let seed = hashText(`${salt}:${source}:${itemIndex}`);
      for (let step = 0; step < 9; step += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        values[seed % size] = Math.max(values[seed % size], 0.32 + ((seed >>> 8) % 68) / 100);
      }
    });
    return values;
  }

  function renderDifferenceField(state) {
    const agents = Array.isArray(state.officialAgents) ? state.officialAgents : [];
    const events = Array.isArray(state.events) ? state.events.slice(0, 16) : [];
    const reference = fieldValues(agents.map((agent) => `${agent.id}:${agent.role}:${agent.status}`), 126, "registry");
    const live = fieldValues(events.map((event) => `${event.id}:${event.type}:${event.at}`), 126, "events");
    [["reference", reference], ["event", live]].forEach(([name, values]) => {
      const field = one(`[data-field-matrix="${name}"]`);
      if (!field) return;
      field.innerHTML = values.map((value) => `<span style="--level:${value.toFixed(2)}"></span>`).join("");
    });
    const bars = one("[data-field-bars]");
    if (bars) {
      bars.innerHTML = Array.from({ length: 18 }, (_, index) => {
        const start = Math.floor(index * 7), difference = reference.slice(start, start + 7).reduce((total, value, offset) => total + Math.abs(value - live[start + offset]), 0) / 7;
        return `<i style="height:${Math.max(8, difference * 100).toFixed(1)}%"></i>`;
      }).join("");
    }
    set("[data-field-mode]", events.length ? "LIVE DELTA" : "REFERENCE ONLY");
    set("[data-field-delta]", events.length ? `${events.length} recorded events` : "No event sample");
  }

  function renderAgentIndex(state) {
    const index = one("[data-component-index]");
    if (!index) return;
    const agents = Array.isArray(state.officialAgents) ? state.officialAgents : [];
    const machines = Array.isArray(state.machines) ? state.machines : [];
    index.innerHTML = agents.map((agent, row) => {
      const machine = machines.find((item) => item.id === agent.machineId);
      const samples = Array.isArray(machine?.samples) ? machine.samples.slice(-16) : [];
      const signature = hashText(`${agent.id}:${agent.role}:${agent.responsibility}`);
      const cells = Array.from({ length: 16 }, (_, column) => {
        const registryBit = ((signature >>> (column % 24)) & 1) === 1;
        const runtime = samples[column - (16 - samples.length)];
        const className = runtime ? `is-${runtime.status === "busy" ? "busy" : "live"}` : registryBit ? "is-reference" : "";
        return `<i class="${className}"></i>`;
      }).join("");
      return `<div class="index-row"><b>${String(row + 1).padStart(2, "0")} ${agent.role || agent.id}</b><span class="index-cells">${cells}</span><em>${agent.status || "ready"}</em></div>`;
    }).join("");
  }

  function clearTrace() {
    all("[data-stage]").forEach((row) => {
      row.classList.remove("is-active", "is-complete");
      const status = row.querySelector("em");
      if (status) status.textContent = "idle";
    });
  }

  window.addEventListener("ohmium:inspection-step", (event) => {
    const { component, index } = event.detail;
    set("[data-trace-mode]", "SCHEMATIC TRACE");
    set("[data-trace-id]", "Local circuit inspection");
    set("[data-trace-result]", `${index + 1} of ${stages.length} paths shown`);
    all("[data-stage]").forEach((row, position) => {
      row.classList.toggle("is-active", row.dataset.stage === component);
      row.classList.toggle("is-complete", position < index);
      const status = row.querySelector("em");
      if (status && row.dataset.stage === component) status.textContent = "inspect";
    });
  });
  window.addEventListener("ohmium:inspection-complete", () => {
    clearTrace();
    set("[data-trace-mode]", "STANDBY");
    set("[data-trace-id]", "No execution selected");
    set("[data-trace-result]", "Awaiting verified event");
  });

  function empty(reason = "Core endpoint unavailable") {
    document.body.dataset.monitor = "offline";
    document.body.dataset.signal = "empty";
    set("[data-input-mode]", "NO SOURCE");
    set("[data-input-gateway]", "Disconnected");
    set("[data-input-queue]", "—");
    set("[data-input-last]", "—");
    set("[data-network-mode]", "OFFLINE");
    set("[data-network-components]", "—");
    set("[data-network-treasury]", "—");
    set("[data-network-foot]", reason);
    set("[data-core-mode]", "OFFLINE");
    set("[data-core-uptime]", "—");
    set("[data-core-memory]", "—");
    set("[data-core-heap]", "—");
    set("[data-core-requests]", "—");
    set("[data-core-clients]", "—");
    set("[data-core-events]", "—");
    set("[data-network-online]", "0");
    set("[data-network-verifying]", "0");
    set("[data-network-generations]", "0");
    set("[data-proof-mode]", "EMPTY");
    set("[data-proof-id]", "Proof —");
    set("[data-proof-hash]", "Hash —");
    set("[data-proof-verifiers]", "0 verifiers");
    set("[data-proof-time]", "—");
    set("[data-solver-mode]", "OFFLINE");
    set("[data-field-mode]", "OFFLINE");
    set("[data-field-delta]", "No Core sample");
    set(".cell-status em", `Core offline · ${clock(new Date())}`);
  }

  function render({ online, state, telemetry, error }) {
    if (!online || !state || !telemetry) { empty(error || "Core endpoint unavailable"); return; }
    document.body.dataset.monitor = "online";
    const events = Array.isArray(state.events) ? state.events : [];
    const lastEvent = events[0];
    document.body.dataset.signal = lastEvent ? "live" : "empty";
    const onlineMachines = (state.machines || []).filter((machine) => machine.status !== "offline");
    const officialAgents = Array.isArray(state.officialAgents) ? state.officialAgents : [];
    set("[data-input-mode]", lastEvent ? "LIVE" : "EMPTY");
    set("[data-input-gateway]", "Connected");
    set("[data-input-queue]", String(telemetry.openTasks));
    set("[data-input-last]", lastEvent ? `${lastEvent.type} · ${clock(lastEvent.at)}` : "—");
    set("[data-network-mode]", "CONNECTED");
    set("[data-network-components]", String(telemetry.totalMachines));
    set("[data-network-treasury]", state.treasury?.initialized && state.treasury.balanceSol != null ? `${state.treasury.balanceSol} SOL` : "—");
    set("[data-network-foot]", `Core verified · ${clock(telemetry.at)}`);
    set("[data-core-mode]", "CONNECTED");
    set("[data-core-uptime]", duration(telemetry.uptimeSec));
    set("[data-core-memory]", `${telemetry.rssMb} MB`);
    set("[data-core-heap]", `${telemetry.heapMb} MB`);
    set("[data-core-requests]", String(telemetry.requests));
    set("[data-core-clients]", String(telemetry.sseClients));
    set("[data-core-events]", String(telemetry.events));
    set("[data-network-online]", String(telemetry.onlineMachines));
    set("[data-network-verifying]", String(telemetry.verifying));
    set("[data-network-generations]", String(telemetry.generations));
    set(".cell-status em", `Core online · ${onlineMachines.length} active · ${clock(telemetry.at)}`);
    set("[data-solver-mode]", "LIVE CORE");
    renderParticleField(telemetry);
    renderDifferenceField(state);
    renderWaves(telemetry);
    renderAgentIndex(state);

    const dispatchRows = all(".dispatch-grid [data-stage]").filter((row) => row.dataset.stage !== "core");
    dispatchRows.forEach((row, index) => {
      const agent = officialAgents[index];
      if (!agent) return;
      row.dataset.agent = agent.id;
      row.querySelector("b").textContent = agent.slot;
      row.querySelector("span").textContent = agent.role;
      row.querySelector("em").textContent = agent.status;
      row.classList.toggle("is-online", agent.status === "online" || agent.status === "busy");
      row.title = `${agent.id}: ${agent.responsibility}`;
    });
    set("[data-trace-id]", `${officialAgents.length} official agents`);
    set("[data-trace-result]", onlineMachines.length ? `${onlineMachines.length} connected` : "Ready · 0 connected");
    set("[data-trace-mode]", `${onlineMachines.length}/${officialAgents.length} ONLINE`);

    const proof = state.lineage?.at?.(-1);
    if (proof) {
      set("[data-proof-mode]", "VERIFIED");
      set("[data-proof-id]", `Proof ${short(proof.mutationId)}`);
      set("[data-proof-hash]", `Hash ${short(proof.artifact)}`);
      set("[data-proof-verifiers]", `${proof.verifiers?.length || 0} verifiers`);
      set("[data-proof-time]", clock(proof.acceptedAt));
    } else {
      set("[data-proof-mode]", "EMPTY");
      set("[data-proof-id]", "Proof —");
      set("[data-proof-hash]", "Hash —");
      set("[data-proof-verifiers]", "0 verifiers");
      set("[data-proof-time]", "—");
    }
  }

  document.addEventListener("ohmium:data", (event) => render(event.detail));
  if (window.OhmiumData?.checkedAt) render(window.OhmiumData);
  else empty();
})();
