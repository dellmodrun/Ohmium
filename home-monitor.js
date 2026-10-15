(() => {
  const one = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const set = (selector, value) => { const node = one(selector); if (node) node.textContent = value; };
  const short = (value, size = 7) => value ? `${String(value).slice(0, size)}…${String(value).slice(-4)}` : "—";
  const clock = (value) => value ? new Date(value).toLocaleTimeString([], { hour12: false }) : "—";

  function resetTrace() {
    all("[data-stage]").forEach((row) => {
      row.classList.remove("is-active", "is-complete");
      row.querySelector("em").textContent = "idle";
    });
  }

  window.addEventListener("ohmium:inspection-step", (event) => {
    const { component, index } = event.detail;
    set("[data-trace-mode]", "LOCAL INSPECTION");
    set("[data-trace-id]", "Deterministic route diagnostic");
    set("[data-trace-result]", `${index + 1} stages inspected`);
    all("[data-stage]").forEach((row, at) => {
      row.classList.toggle("is-active", row.dataset.stage === component);
      if (at < index) row.classList.add("is-complete");
      if (row.dataset.stage === component) row.querySelector("em").textContent = "inspect";
    });
  });

  window.addEventListener("ohmium:inspection-complete", () => {
    all("[data-stage]").forEach((row) => {
      row.classList.remove("is-active");
      row.classList.add("is-complete");
      row.querySelector("em").textContent = "checked";
    });
    set("[data-trace-result]", "Route structure valid");
    setTimeout(() => {
      resetTrace();
      set("[data-trace-mode]", "STANDBY");
      set("[data-trace-id]", "No execution selected");
      set("[data-trace-result]", "Awaiting signal");
    }, 2400);
  });

  async function loadNetwork() {
    try {
      const [stateResponse, telemetryResponse] = await Promise.all([fetch("./api/state"), fetch("./api/telemetry")]);
      if (!stateResponse.ok || !telemetryResponse.ok) throw new Error("backend unavailable");
      const [state, telemetry] = await Promise.all([stateResponse.json(), telemetryResponse.json()]);
      const events = Array.isArray(state.events) ? state.events : [];
      const lastEvent = events[0];
      set("[data-input-mode]", lastEvent ? "LIVE" : "EMPTY");
      set("[data-input-gateway]", "Connected");
      set("[data-input-queue]", String(telemetry.openTasks ?? "—"));
      set("[data-input-last]", lastEvent ? `${lastEvent.type} · ${clock(lastEvent.at)}` : "—");
      set("[data-network-mode]", "CONNECTED");
      set("[data-network-components]", String(state.machines?.length ?? "—"));
      set("[data-network-treasury]", state.treasury?.balanceSol == null ? "—" : `${state.treasury.balanceSol} SOL`);
      set("[data-network-foot]", `Backend heartbeat · ${clock(telemetry.at)}`);
      const proof = state.lineage?.at?.(-1);
      if (proof) {
        set("[data-proof-mode]", "VERIFIED");
        set("[data-proof-id]", `Proof ${short(proof.mutationId)}`);
        set("[data-proof-hash]", `Hash ${short(proof.artifact)}`);
        set("[data-proof-verifiers]", `${proof.verifiers?.length ?? "—"} verifiers`);
        set("[data-proof-time]", clock(proof.acceptedAt));
      }
    } catch {
      document.body.dataset.monitor = "offline";
    }
  }

  const index = one("[data-component-index]");
  if (index) {
    ["SENSE", "FILTER", "ORACLE", "GUARD", "ROUTE", "MEMORY", "ARCHIVE", "VERIFY"].forEach((name, row) => {
      const item = document.createElement("div");
      item.className = "index-row";
      const cells = Array.from({ length: 16 }, (_, column) => `<i style="opacity:${.28 + ((row * 7 + column * 3) % 8) / 14}"></i>`).join("");
      item.innerHTML = `<b>${String(row + 1).padStart(2, "0")} ${name}</b><span class="index-cells">${cells}</span><em>idle</em>`;
      index.append(item);
    });
  }
  loadNetwork();
})();
