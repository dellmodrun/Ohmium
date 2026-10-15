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
    set("[data-network-components]", String(onlineMachines.length));
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

  const index = one("[data-component-index]");
  if (index) {
    ["SENSE", "FILTER", "MEASURE", "GUARD", "ROUTE", "MEMORY", "ARCHIVE", "VERIFY"].forEach((name, row) => {
      const item = document.createElement("div");
      item.className = "index-row";
      item.innerHTML = `<b>${String(row + 1).padStart(2, "0")} ${name}</b><span class="index-cells">${"<i></i>".repeat(16)}</span><em>idle</em>`;
      index.append(item);
    });
  }
  document.addEventListener("ohmium:data", (event) => render(event.detail));
  if (window.OhmiumData?.checkedAt) render(window.OhmiumData);
  else empty();
})();
