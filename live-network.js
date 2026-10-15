(() => {
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const officialIds = new Set(["ohm-sense", "ohm-filter", "ohm-oracle", "ohm-guard", "ohm-router", "ohm-memory", "ohm-archive", "ohm-verify"]);
  let filter = "all";
  let selectedId = null;
  let lastData = null;

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const short = (value, size = 6) => value ? `${String(value).slice(0, size)}…${String(value).slice(-4)}` : "—";
  const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour12: false }) : "—";
  const age = (value) => {
    if (!value) return "No heartbeat";
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
    if (seconds < 5) return "Heartbeat now";
    if (seconds < 60) return `Heartbeat ${seconds}s ago`;
    return `Heartbeat ${Math.floor(seconds / 60)}m ago`;
  };

  function agentsFrom(data) {
    const machines = data.state?.machines || [];
    const byName = new Map(machines.map((machine) => [machine.name, machine]));
    const official = (data.state?.officialAgents || []).map((profile) => ({
      ...profile,
      ...(byName.get(profile.id) || {}),
      id: profile.id,
      name: profile.id,
      role: profile.role,
      component: profile.component,
      responsibility: profile.responsibility,
      official: true
    }));
    const community = machines.filter((machine) => !officialIds.has(machine.name)).map((machine) => ({
      ...machine,
      role: machine.name,
      component: String(machine.target || "Owner component").split(" /")[0],
      responsibility: machine.target || "Owner-deployed circuit worker",
      official: false
    }));
    return [...official, ...community];
  }

  function card(agent, index) {
    const status = agent.status || "ready";
    const active = status === "online" || status === "busy";
    const owner = agent.official ? "OHMIUM GENESIS" : (agent.wallet ? short(agent.wallet) : "OWNER WALLET UNPUBLISHED");
    const load = Number.isFinite(Number(agent.load)) ? `${Math.round(Number(agent.load) * 100)}% load` : "Load not reported";
    return `<button class="live-agent-card ${active ? "is-online" : "is-offline"} ${selectedId === agent.id ? "is-selected" : ""}" type="button" data-live-agent="${escapeHtml(agent.id)}" data-kind="${agent.official ? "official" : "community"}">
      <header><span>${agent.official ? `GENESIS / ${escapeHtml(agent.slot || String(index + 1).padStart(2, "0"))}` : "OWNER DEPLOYED"}</span><b>${escapeHtml(status.toUpperCase())}</b></header>
      <div class="live-agent-scope">
        <div class="live-component-symbol" data-component="${escapeHtml(String(agent.component || "component").toLowerCase())}"><i></i><i></i><b></b><em></em></div>
        <div class="live-signal-path"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <span>${escapeHtml(active ? "HEARTBEAT LOCKED" : "SIGNAL OPEN")}</span>
      </div>
      <section><small>${escapeHtml(agent.component || "Component")}</small><strong>${escapeHtml(agent.role || agent.name)}</strong><p>${escapeHtml(agent.activity || agent.responsibility || "Awaiting worker activity")}</p></section>
      <footer><span>${escapeHtml(owner)}</span><time datetime="${escapeHtml(agent.lastSeenAt || "")}" title="${escapeHtml(agent.lastSeenAt || "No heartbeat received")}">${escapeHtml(age(agent.lastSeenAt))}</time><em>${escapeHtml(load)}</em></footer>
    </button>`;
  }

  function eventSummary(event) {
    const payload = event.payload || {};
    const subject = payload.machine?.name || payload.task?.title || payload.mutation?.machineName || payload.mutation?.id || "Core state changed";
    return String(subject);
  }

  function renderSelected(agent) {
    const target = one("[data-live-selected]");
    if (!target || !agent) return;
    const status = String(agent.status || "ready").toUpperCase();
    one("[data-live-selected-state]").textContent = status;
    target.innerHTML = `<span>${agent.official ? "OFFICIAL GENESIS AGENT" : "OWNER-DEPLOYED AGENT"}</span><strong>${escapeHtml(agent.role || agent.name)}</strong><p>${escapeHtml(agent.responsibility || agent.target || "Registered circuit worker")}</p><dl><dt>Runtime ID</dt><dd>${escapeHtml(agent.name || agent.id)}</dd><dt>Component</dt><dd>${escapeHtml(agent.component || "General")}</dd><dt>Current work</dt><dd>${escapeHtml(agent.activity || "Awaiting heartbeat")}</dd><dt>Repository</dt><dd>${escapeHtml(agent.repository || "Not assigned")}</dd><dt>Owner</dt><dd>${escapeHtml(agent.official ? "Ohmium Genesis" : (agent.wallet || "Not published"))}</dd><dt>Last heartbeat</dt><dd>${escapeHtml(agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString([], { hour12: false }) : "Not received")}</dd></dl>`;
  }

  function render(data) {
    lastData = data;
    const grid = one("[data-live-agent-grid]");
    if (!grid) return;
    if (!data.online || !data.state || !data.telemetry) {
      grid.innerHTML = '<div class="live-loading is-offline"><i></i><b>Ohmium Core unavailable</b><span>No Agent activity is simulated while the runtime endpoint is offline.</span></div>';
      one("[data-live-core]").textContent = "Offline";
      one("[data-live-foot-state]").textContent = "Disconnected";
      return;
    }

    const agents = agentsFrom(data);
    const official = agents.filter((agent) => agent.official);
    const community = agents.filter((agent) => !agent.official);
    const online = agents.filter((agent) => agent.status === "online" || agent.status === "busy");
    const visible = agents.filter((agent) => filter === "all" || (filter === "official" ? agent.official : !agent.official));
    if (!selectedId || !agents.some((agent) => agent.id === selectedId)) selectedId = visible[0]?.id || agents[0]?.id || null;

    one("[data-live-core]").textContent = "Online";
    one("[data-live-online]").textContent = `${online.length} / ${agents.length}`;
    one("[data-live-official]").textContent = `${official.filter((agent) => agent.status === "online" || agent.status === "busy").length} / ${official.length}`;
    one("[data-live-community]").textContent = String(community.length);
    one("[data-live-foot-state]").textContent = "Synchronized";
    one("[data-live-foot-time]").textContent = `Last sync ${time(data.telemetry.at)}`;

    if (visible.length) grid.innerHTML = visible.map(card).join("");
    else grid.innerHTML = '<div class="live-loading live-community-empty"><i></i><b>No owner-deployed Agents yet</b><span>This surface will populate from the Core registry after token burn activation is live and the first owner Agent is created.</span><a href="#spawn" data-route="spawn">View deployment protocol</a></div>';

    const events = data.state.events || [];
    one("[data-live-event-count]").textContent = String(events.length);
    const list = one("[data-live-events]");
    list.innerHTML = events.length ? events.slice(0, 12).map((event) => `<li><time>${escapeHtml(time(event.at))}</time><b>${escapeHtml(String(event.type || "event").replaceAll(".", " / "))}</b><span>${escapeHtml(eventSummary(event))}</span></li>`).join("") : '<li><time>—</time><b>CORE</b><span>No verified events recorded</span></li>';

    renderSelected(agents.find((agent) => agent.id === selectedId) || agents[0]);
    all("[data-live-agent]").forEach((node) => node.addEventListener("click", () => { selectedId = node.dataset.liveAgent; render(data); }));
  }

  all("[data-live-filter]").forEach((button) => button.addEventListener("click", () => {
    filter = button.dataset.liveFilter;
    all("[data-live-filter]").forEach((item) => item.classList.toggle("active", item === button));
    selectedId = null;
    if (lastData) render(lastData);
  }));
  document.addEventListener("ohmium:data", (event) => render(event.detail));
  if (window.OhmiumData?.checkedAt) render(window.OhmiumData);
})();
