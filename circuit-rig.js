(() => {
  const root = document.querySelector(".circuit-instrument");
  if (!root) return;

  const mount = root.querySelector("[data-circuit-rig-svg]");
  const one = (selector) => root.querySelector(selector);
  const all = (selector) => [...root.querySelectorAll(selector)];
  const set = (selector, value) => { const node = one(selector); if (node) node.textContent = value; };
  const short = (value, size = 10) => value ? `${String(value).slice(0, size)}…${String(value).slice(-4)}` : "—";
  const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour12: false }) : "—";
  const specs = {
    sensor: { id: "ohm-sense", slot: "01", title: "Sense / sensor", detail: "Acquires approved sources and preserves provenance for every observation." },
    filter: { id: "ohm-filter", slot: "02", title: "Filter / resistor", detail: "Rejects duplicate, malformed and low-confidence inputs before routing." },
    oracle: { id: "ohm-oracle", slot: "03", title: "Measure / oscillator", detail: "Produces deterministic metrics for baseline and candidate outputs." },
    guard: { id: "ohm-guard", slot: "04", title: "Guard / fuse", detail: "Enforces permissions, resource limits and execution safety boundaries." },
    router: { id: "ohm-router", slot: "05", title: "Route / transistor", detail: "Dispatches signed work to the component qualified to process it." },
    memory: { id: "ohm-memory", slot: "06", title: "Memory / capacitor", detail: "Retains bounded context with its source and verification lineage." },
    archive: { id: "ohm-archive", slot: "07", title: "Archive / register", detail: "Indexes artifacts, replay evidence and accepted execution history." },
    verify: { id: "ohm-verify", slot: "08", title: "Verify / comparator", detail: "Replays evidence independently before a signal can be accepted." },
    core: { id: "core", slot: "00", title: "Ohmium Core", detail: "Coordinates independently verified component outputs." },
  };
  let selected = "core";
  let latestData = null;

  function statusFor(key) {
    if (!latestData?.online || key === "core") return latestData?.online ? "CONNECTED" : "CORE STATE UNAVAILABLE";
    const agent = (latestData.state?.officialAgents || []).find((entry) => entry.id === specs[key]?.id);
    return String(agent?.status || "ready").toUpperCase();
  }

  function select(key) {
    if (!specs[key]) return;
    selected = key;
    mount.querySelectorAll(".is-active").forEach((node) => node.classList.remove("is-active"));
    mount.querySelector(`[data-component="${key}"]`)?.classList.add("is-active");
    mount.querySelector(`.route-${key}`)?.classList.add("is-active");
    all("[data-model-component]").forEach((button) => button.classList.toggle("is-selected", button.dataset.modelComponent === key));
    set("[data-circuit-rig-slot]", `${specs[key].slot} / ${key === "core" ? "CONDUCTOR" : "COMPONENT"}`);
    set("[data-circuit-rig-title]", specs[key].title);
    set("[data-circuit-rig-detail]", specs[key].detail);
    set("[data-circuit-rig-state]", statusFor(key));
  }

  function render(data) {
    latestData = data;
    const official = data.online ? data.state?.officialAgents || [] : [];
    const lineage = data.online ? data.state?.lineage || [] : [];
    const online = official.filter((agent) => agent.status === "online" || agent.status === "busy");
    const latest = lineage.at(-1);
    set("[data-circuit-rig-online]", `${online.length} / ${official.length || 8}`);
    set("[data-circuit-rig-accepted]", String(lineage.length));
    set("[data-circuit-rig-quorum]", `${Math.min(2, latest?.verifiers?.length || 0)} / 2`);
    set("[data-circuit-rig-sync]", data.online ? `Core synchronized · ${time(data.telemetry?.at)}` : "Core unavailable");
    set("[data-circuit-last-heartbeat]", data.online ? time(data.telemetry?.at) : "—");
    set("[data-circuit-last-signal]", latest ? `Generation ${latest.generation} · ${time(latest.acceptedAt)}` : "None recorded");
    set("[data-circuit-last-artifact]", latest ? short(latest.artifact, 14) : "—");
    set("[data-circuit-last-replays]", String(latest?.verifiers?.length || 0));
    all("[data-circuit-control]").forEach((button) => {
      const agent = official.find((entry) => entry.id === button.dataset.circuitControl);
      const active = agent?.status === "online" || agent?.status === "busy";
      button.classList.toggle("is-online", active);
      const state = button.querySelector("em");
      if (state) state.textContent = String(agent?.status || "ready").toUpperCase();
      const model = mount.querySelector(`[data-component="${button.dataset.modelComponent}"]`);
      model?.classList.toggle("is-runtime-online", active);
    });
    set("[data-circuit-rig-state]", statusFor(selected));
  }

  all("[data-model-component]").forEach((button) => {
    button.addEventListener("click", () => select(button.dataset.modelComponent));
    button.addEventListener("pointerenter", () => select(button.dataset.modelComponent));
  });

  fetch("./assets/ohmium-signal-backplane.svg?v=1")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((markup) => {
      mount.innerHTML = markup;
      set("[data-circuit-part-count]", String(mount.querySelectorAll(".part").length));
      mount.querySelectorAll("[data-component]").forEach((node) => {
        const choose = () => select(node.dataset.component);
        node.addEventListener("click", choose);
        node.addEventListener("focus", choose);
        node.addEventListener("pointerenter", choose);
      });
      select("core");
      if (latestData) render(latestData);
    })
    .catch(() => {
      mount.innerHTML = '<div class="circuit-model-error">Circuit renderer unavailable</div>';
    });

  document.addEventListener("ohmium:data", (event) => render(event.detail));
  if (window.OhmiumData?.checkedAt) render(window.OhmiumData);
})();
