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
  const html = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const samplesOf = (telemetry) => {
    const samples = Array.isArray(telemetry.samples) ? telemetry.samples : [];
    return samples.length ? samples : [{ at: telemetry.at, requests: telemetry.requests, rssMb: telemetry.rssMb, heapMb: telemetry.heapMb, verifying: telemetry.verifying, generations: telemetry.generations, openTasks: telemetry.openTasks, onlineMachines: telemetry.onlineMachines, events: telemetry.events }];
  };
  const requestDelta = (samples, index) => index ? Math.max(0, (Number(samples[index].requests) || 0) - (Number(samples[index - 1].requests) || 0)) : 0;

  function renderThermalMap(telemetry) {
    const svg = one("[data-thermal-map]");
    if (!svg) return;
    const samples = samplesOf(telemetry).slice(-28), memory = samples.map((item) => Number(item.rssMb) || 0);
    const low = Math.min(...memory), high = Math.max(...memory), span = high - low || 1;
    const points = samples.map((item, index) => {
      const x = 28 + (samples.length === 1 ? 152 : index * (304 / (samples.length - 1)));
      const y = 125 - ((Number(item.rssMb) - low) / span) * 93;
      const activity = requestDelta(samples, index) + (Number(item.openTasks) || 0) * 2 + (Number(item.verifying) || 0) * 3;
      const radius = Math.min(38, 19 + activity * 3);
      const opacity = Math.min(.9, .34 + activity * .09);
      return { x, y, radius, opacity };
    });
    const trend = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    svg.innerHTML = `<defs><radialGradient id="thermal-spot"><stop offset="0" stop-color="#b9ff89" stop-opacity=".95"/><stop offset=".34" stop-color="#7fe03a" stop-opacity=".62"/><stop offset="1" stop-color="#7fe03a" stop-opacity="0"/></radialGradient><filter id="thermal-blur"><feGaussianBlur stdDeviation="7"/></filter></defs><g class="thermal-grid"><path d="M22 24H338M22 57H338M22 90H338M22 123H338M62 15V135M112 15V135M162 15V135M212 15V135M262 15V135M312 15V135"/></g><g class="thermal-cloud" filter="url(#thermal-blur)">${points.map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${point.radius}" fill="url(#thermal-spot)" opacity="${point.opacity.toFixed(2)}"/>`).join("")}</g><path class="thermal-contour" d="${trend}"/><g class="thermal-labels"><text x="22" y="146">−${Math.max(0, (samples.length - 1) * 2)}s</text><text x="314" y="146">NOW</text><text x="338" y="20" text-anchor="end">${high.toFixed(1)} MB</text></g>`;
    set("[data-thermal-mode]", `LIVE · ${samples.length} SAMPLES`);
  }

  function renderActivityGrid(telemetry) {
    const grid = one("[data-activity-grid]");
    if (!grid) return;
    const samples = samplesOf(telemetry).slice(-98), padded = Array(Math.max(0, 98 - samples.length)).fill(null).concat(samples);
    const values = samples.map((item, index) => requestDelta(samples, index) + (Number(item.openTasks) || 0) * 2 + (Number(item.verifying) || 0) * 3 + (Number(item.onlineMachines) || 0));
    const peak = Math.max(1, ...values), offset = 98 - samples.length;
    grid.innerHTML = padded.map((item, index) => {
      if (!item) return '<i class="level-0 is-empty"></i>';
      const value = values[index - offset] || 0, level = value === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((value / peak) * 4)));
      return `<i class="level-${level}" title="${html(clock(item.at))} · activity ${value}"></i>`;
    }).join("");
    const active = values.filter((value) => value > 0).length;
    set("[data-activity-mode]", `${active} ACTIVE SAMPLES`);
    set("[data-activity-summary]", `${samples.length} verified samples · 2 second interval`);
  }

  function renderCandles(telemetry) {
    const svg = one("[data-candle-chart]");
    if (!svg) return;
    const samples = samplesOf(telemetry).slice(-56), candles = [];
    for (let index = 0; index < samples.length; index += 4) {
      const group = samples.slice(index, index + 4), values = group.map((item) => Number(item.rssMb) || 0);
      candles.push({ at: group.at?.(-1)?.at, open: values[0], high: Math.max(...values), low: Math.min(...values), close: values.at(-1) });
    }
    const values = candles.flatMap((candle) => [candle.high, candle.low]), rawLow = Math.min(...values), rawHigh = Math.max(...values), padding = Math.max(.35, (rawHigh - rawLow) * .16), low = rawLow - padding, high = rawHigh + padding, span = high - low || 1;
    const y = (value) => 146 - ((value - low) / span) * 118;
    const step = 304 / Math.max(1, candles.length), width = Math.max(4, Math.min(13, step * .52));
    const marks = candles.map((candle, index) => {
      const x = 30 + index * step + step / 2, openY = y(candle.open), closeY = y(candle.close), highY = y(candle.high), lowY = y(candle.low), top = Math.min(openY, closeY), height = Math.max(2, Math.abs(closeY - openY));
      const mode = candle.close > candle.open ? "up" : candle.close < candle.open ? "down" : "flat";
      return `<g class="candle ${mode}"><line x1="${x.toFixed(1)}" y1="${highY.toFixed(1)}" x2="${x.toFixed(1)}" y2="${lowY.toFixed(1)}"/><rect x="${(x - width / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}"/></g>`;
    }).join("");
    svg.innerHTML = `<g class="market-grid"><path d="M25 28H336M25 57H336M25 87H336M25 116H336M25 146H336"/></g>${marks}<g class="market-labels"><text x="337" y="25" text-anchor="end">${rawHigh.toFixed(1)}</text><text x="337" y="144" text-anchor="end">${rawLow.toFixed(1)}</text><text x="25" y="160">${candles.length ? clock(candles[0].at) : "—"}</text><text x="336" y="160" text-anchor="end">${candles.length ? clock(candles.at(-1).at) : "—"}</text></g>`;
    const latest = candles.at(-1);
    if (latest) Object.entries(latest).forEach(([name, value]) => { if (name !== "at") set(`[data-ohlc="${name}"]`, `${Number(value).toFixed(1)}`); });
    set("[data-market-mode]", `${candles.length} CANDLES · RSS MB`);
  }

  function renderUpdates(state, telemetry) {
    const feed = one("[data-update-feed]");
    if (!feed) return;
    const eventRows = (Array.isArray(state.events) ? state.events : []).slice(0, 3).map((event) => ({ at: event.at, channel: "EVENT", message: event.type, state: short(event.id, 5) }));
    const samples = samplesOf(telemetry), sampleRows = samples.slice(-8).reverse().map((item, index, list) => {
      const previous = samples[Math.max(0, samples.length - 2 - index)], delta = previous ? Math.max(0, (Number(item.requests) || 0) - (Number(previous.requests) || 0)) : 0;
      const variants = [{ channel: "REQUEST", message: `${Number(item.requests) || 0} total requests`, state: `+${delta}` }, { channel: "MEMORY", message: `${Number(item.rssMb || 0).toFixed(1)} MB resident`, state: `${Number(item.heapMb || 0).toFixed(1)} heap` }, { channel: "VERIFY", message: `${Number(item.verifying) || 0} checking · ${Number(item.generations) || 0} accepted`, state: Number(item.verifying) ? "ACTIVE" : "IDLE" }, { channel: "NETWORK", message: `${Number(item.onlineMachines) || 0} workers · ${Number(item.openTasks) || 0} tasks`, state: Number(item.onlineMachines) ? "ONLINE" : "READY" }];
      return { at: item.at, ...variants[index % variants.length] };
    });
    const rows = eventRows.concat(sampleRows).sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 9);
    feed.innerHTML = rows.map((row) => `<li><time>${html(clock(row.at))}</time><b>${html(row.channel)}</b><span>${html(row.message)}</span><em>${html(row.state)}</em></li>`).join("");
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
    set("[data-thermal-mode]", "OFFLINE");
    set("[data-activity-mode]", "OFFLINE");
    set("[data-activity-summary]", "No Core sample");
    set("[data-market-mode]", "OFFLINE");
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
    renderThermalMap(telemetry);
    renderActivityGrid(telemetry);
    renderCandles(telemetry);
    renderUpdates(state, telemetry);

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
