(() => {
  const one = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const short = (value, size = 7) => value ? `${String(value).slice(0, size)}…${String(value).slice(-4)}` : "—";
  const clock = (value) => value ? new Date(value).toLocaleTimeString([], { hour12: false }) : "—";

  function resetTrace() {
    all("[data-stage]").forEach((row) => {
      row.classList.remove("is-active", "is-complete");
      row.querySelector("em").textContent = "—";
    });
  }

  window.addEventListener("ohmium:inspection-step", (event) => {
    const { component, index } = event.detail;
    one("[data-trace-mode]").textContent = "LOCAL INSPECTION";
    one("[data-trace-id]").textContent = "Deterministic route diagnostic";
    one("[data-trace-result]").textContent = `${index + 1} stages inspected`;
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
    one("[data-trace-result]").textContent = "Route structure valid";
    setTimeout(() => {
      resetTrace();
      one("[data-trace-mode]").textContent = "STANDBY";
      one("[data-trace-id]").textContent = "No execution selected";
      one("[data-trace-result]").textContent = "Awaiting signal";
    }, 2400);
  });

  async function loadNetwork() {
    try {
      const [stateResponse, telemetryResponse] = await Promise.all([fetch("./api/state"), fetch("./api/telemetry")]);
      if (!stateResponse.ok || !telemetryResponse.ok) throw new Error("backend unavailable");
      const [state, telemetry] = await Promise.all([stateResponse.json(), telemetryResponse.json()]);
      const events = Array.isArray(state.events) ? state.events : [];
      const lastEvent = events[0];
      one("[data-input-mode]").textContent = lastEvent ? "LIVE" : "EMPTY";
      one("[data-input-gateway]").textContent = "Connected";
      one("[data-input-queue]").textContent = String(telemetry.openTasks ?? "—");
      one("[data-input-last]").textContent = lastEvent ? `${lastEvent.type} · ${clock(lastEvent.at)}` : "—";
      one("[data-input-empty] strong").textContent = lastEvent ? lastEvent.type : "No verified event in queue";
      one("[data-input-empty] span").textContent = lastEvent ? `Event ${short(lastEvent.id || lastEvent.at)}` : "Gateway is connected and waiting for a signed source.";
      one("[data-network-mode]").textContent = "CONNECTED";
      one("[data-network-components]").textContent = String(state.machines?.length ?? "—");
      one("[data-network-treasury]").textContent = state.treasury?.balanceSol == null ? "—" : `${state.treasury.balanceSol} SOL`;
      one("[data-network-foot]").textContent = `Backend heartbeat · ${clock(telemetry.at)}`;
      const proof = state.lineage?.at?.(-1);
      if (proof) {
        one("[data-proof-mode]").textContent = "VERIFIED";
        one("[data-proof-zero] strong").textContent = `Generation ${proof.generation}`;
        one("[data-proof-zero] p").textContent = "Deterministic verification record available.";
        one("[data-proof-id]").textContent = short(proof.mutationId);
        one("[data-proof-hash]").textContent = short(proof.artifact);
        one("[data-proof-verifiers]").textContent = String(proof.verifiers?.length ?? "—");
        one("[data-proof-time]").textContent = clock(proof.acceptedAt);
      }
    } catch {
      document.body.dataset.monitor = "offline";
    }
  }

  loadNetwork();
})();
