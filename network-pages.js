(() => {
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const text = (selector, value, root = document) => { const node = one(selector, root); if (node) node.textContent = value; };
  const short = (value, size = 8) => value ? `${String(value).slice(0, size)}…${String(value).slice(-4)}` : "—";
  const when = (value) => value ? new Date(value).toLocaleString([], { hour12: false }) : "—";

  function renderComponents(data) {
    const wall = one(".component-registry");
    if (!wall) return;
    if (!data.online) {
      all("article", wall).forEach((card) => {
        const footer = one("footer", card);
        if (footer) footer.textContent = "REFERENCE CLASS · NOT DEPLOYED";
      });
      text(".machine-wall-status em", "Core unavailable · no runtime status");
      return;
    }
    const machines = data.state?.machines || [];
    if (!machines.length) {
      wall.innerHTML = '<div class="task-board-empty">No components are registered on this Core.</div>';
    } else {
      wall.innerHTML = machines.map((machine, index) => `<article class="machine-tile"><header>${String(index + 1).padStart(2, "0")} / ${escapeHtml(machine.name)}</header><div><span class="mini-cell"><i></i><i></i><b></b></span><em>${escapeHtml(machine.target || "unassigned")}</em></div><footer>${escapeHtml(machine.status.toUpperCase())} · ${escapeHtml(when(machine.lastSeenAt))}</footer></article>`).join("");
    }
    text(".machine-command em", `# ${machines.length} registered component${machines.length === 1 ? "" : "s"}`);
    text(".machine-wall-status em", `${data.telemetry.onlineMachines} online · ${when(data.telemetry.at)}`);
  }

  function renderLineage(data) {
    const view = one(".lineage-workstation");
    if (!view) return;
    const lineage = data.online ? data.state?.lineage || [] : [];
    const official = data.online ? data.state?.officialAgents || [] : [];
    const online = official.filter((agent) => agent.status === "online" || agent.status === "busy");
    text("[data-circuit-online]", `${online.length} / ${official.length}`, view);
    text("[data-circuit-accepted]", String(lineage.length), view);
    text("[data-circuit-quorum]", lineage.length ? "2 / 2" : "0 / 2", view);
    text("[data-circuit-registered]", `${official.length} profiles`, view);
    text("[data-circuit-core-online]", `${online.length} workers`, view);
    text("[data-circuit-generation]", String(lineage.length), view);
    text("[data-circuit-core-state]", data.online ? (lineage.length ? `Generation ${lineage.length} accepted` : "Connected / no accepted signal") : "Core unavailable", view);
    text("[data-circuit-sync]", data.online ? `Core synchronized · ${when(data.telemetry?.at)}` : "Core unavailable", view);
    official.forEach((agent) => {
      const node = one(`[data-circuit-agent="${agent.id}"]`, view);
      if (!node) return;
      const active = agent.status === "online" || agent.status === "busy";
      node.classList.toggle("is-online", active);
      const code = one("code", node), label = one("small", node), bar = one("u em", node);
      if (code) code.textContent = String(agent.status || "ready").toUpperCase();
      if (label) label.textContent = active ? "HEARTBEAT" : "PROFILE";
      if (bar) bar.style.setProperty("--scan", active && Number.isFinite(Number(agent.telemetry?.cpuPct)) ? `${Math.max(1, Math.min(100, Number(agent.telemetry.cpuPct)))}%` : "0%");
    });
    const registry = one("[data-circuit-registry]", view);
    if (registry && official.length) registry.innerHTML = official.map((agent, index) => `<a href="#live"><i>${String(index + 1).padStart(2, "0")}</i><span><b>${escapeHtml(agent.role)}</b><small>${escapeHtml(agent.component)} · ${escapeHtml(agent.status === "online" || agent.status === "busy" ? agent.activity || "worker connected" : "role profile published")}</small></span><code>${escapeHtml(String(agent.status || "ready").toUpperCase())}</code><em>${agent.status === "online" || agent.status === "busy" ? "LIVE" : "READY"}</em></a>`).join("");
    text(".lineage-canvas .subhead b", data.online ? `${lineage.length} proofs · epoch ${lineage.length}` : "Core unavailable", view);
    const empty = one(".lineage-empty", view);
    const ledgerEmpty = one(".lineage-ledger .ledger-empty", view);
    if (!data.online) {
      if (empty) empty.innerHTML = "<span>NO DATA SOURCE</span><strong>The Core endpoint is unavailable.</strong><p>No circuit state is rendered without verified backend data.</p>";
      if (ledgerEmpty) ledgerEmpty.textContent = "accepted output data unavailable";
      return;
    }
    if (!lineage.length) {
      if (empty) empty.innerHTML = "<span>CONDUCTOR</span><strong>No verified signal has been accepted.</strong><p>The ledger is empty; no generation is implied.</p>";
      if (ledgerEmpty) ledgerEmpty.textContent = "no accepted outputs yet";
      return;
    }
    const latest = lineage.at(-1);
    const mutation = (data.state?.mutations || []).find((item) => item.id === latest.mutationId);
    const verifierCount = latest.verifiers?.length || 0;
    if (empty) empty.innerHTML = `<span>GENERATION ${latest.generation}</span><strong>${escapeHtml(short(latest.artifact, 12))}</strong><p>Accepted ${escapeHtml(when(latest.acceptedAt))} by ${latest.verifiers?.length || 0} independent verifiers.</p>`;
    text("[data-generation-epoch]", `epoch ${latest.generation}`, view);
    text("[data-generation-state]", "ACCEPTED", view);
    text("[data-generation-signal]", short(latest.mutationId, 12), view);
    text("[data-generation-source]", short(latest.baseCommit, 12), view);
    text("[data-generation-accepted]", when(latest.acceptedAt), view);
    text("[data-generation-consensus]", `${verifierCount} independent replays`, view);
    text("[data-generation-confidence]", `${Number(latest.gainPct || 0).toFixed(2)}% measured gain`, view);
    text("[data-generation-component]", mutation?.machineName || short(mutation?.machineId), view);
    text("[data-proof-status]", "VERIFIED", view);
    text("[data-proof-detail]", `Artifact ${short(latest.artifact, 14)} is retained in accepted lineage.`, view);
    const proofCard = one("[data-proof-card]", view);
    proofCard?.classList.remove("pending");
    ["artifact", "baseline"].forEach((gate) => text(`[data-gate-${gate}]`, "PASSED", view));
    text("[data-gate-a]", verifierCount >= 1 ? "PASSED" : "PENDING", view);
    text("[data-gate-b]", verifierCount >= 2 ? "PASSED" : "PENDING", view);
    const ledger = one(".lineage-ledger", view);
    all(".ledger-row:not(.head)", ledger).forEach((row) => row.remove());
    lineage.slice().reverse().forEach((entry) => {
      const row = document.createElement("div");
      row.className = "ledger-row";
      row.innerHTML = `<span>${entry.generation}</span><span>${escapeHtml(short(entry.mutationId))}</span><span>${escapeHtml(short(entry.baseCommit))}</span><span>${Number(entry.gainPct).toFixed(2)}%</span><span>${entry.verifiers?.length || 0}</span><span>${escapeHtml(short(entry.artifact))}</span>`;
      ledger?.insertBefore(row, ledgerEmpty);
    });
    if (ledgerEmpty) ledgerEmpty.hidden = true;
  }

  function renderTreasury(data) {
    const cards = all(".treasury-grid article");
    const treasury = data.online ? data.state?.treasury : null;
    const policy = data.online ? data.state?.economics : null;
    if (policy?.agentActivation) {
      const burn = `${Number(policy.agentActivation.burnTokens).toLocaleString()} $${policy.symbol}`;
      text("[data-policy-burn]", burn);
      text("[data-activation-burn]", burn);
      text("[data-activation-state]", policy.agentActivation.enabled ? "ON-CHAIN ACTIVATION ENABLED" : "ON-CHAIN GATE PENDING CA");
    }
    text("[data-policy-source]", policy?.creatorRewards?.source || "—");
    text("[data-policy-mint]", policy?.mint || "TBA");
    text("[data-policy-yield]", policy ? (policy.guarantees?.fixedYield ? "ENABLED" : "NONE") : "—");
    if (policy?.creatorRewards?.allocation) {
      text("[data-policy-incentive]", `${policy.creatorRewards.allocation.agentIncentivesPct}%`);
      Object.entries(policy.creatorRewards.allocation).forEach(([key, value]) => {
        const row = one(`[data-allocation-row="${key}"]`);
        if (!row) return;
        text("strong", `${value}%`, row);
        one("i em", row)?.style.setProperty("--allocation", `${value}%`);
      });
    }
    if (!treasury?.initialized) {
      text(".treasury-workstation .work-command em", data.online ? "Core online · treasury not configured" : "Core unavailable · treasury not configured");
      text(".treasury-summary .subhead b", "Solana · TBA");
      text("[data-policy-treasury]", "TBA");
      text("[data-policy-treasury-note]", data.online ? "Core confirms treasury is not configured" : "Core unavailable; address not verified");
      return;
    }
    const treasuryCard = cards[3];
    if (treasuryCard) {
      text("small", "treasury address", treasuryCard);
      text("strong", treasury.address || "—", treasuryCard);
      text("span", treasury.balanceSol == null ? `configured · verified ${when(treasury.updatedAt)}` : `${treasury.balanceSol} SOL · verified ${when(treasury.updatedAt)}`, treasuryCard);
    }
    text(".treasury-workstation .work-command em", `On-chain state · ${when(treasury.updatedAt)}`);
    text(".treasury-summary .subhead b", "Solana · Core verified");
  }

  function renderDeploy(data) {
    document.body.dataset.backend = data.online ? "online" : "offline";
    text(".deploy-rack-head > b", data.online ? "CORE CONNECTED" : "CORE UNAVAILABLE");
    const button = one(".spawn-submit");
    if (button && !button.disabled) button.textContent = data.online ? "Register component" : "Core unavailable";
  }

  function renderProtocol(data) {
    const view = one('[data-view="manual"]');
    if (!view) return;
    const official = data.online ? data.state?.officialAgents || [] : [];
    const online = official.filter((agent) => agent.status === "online" || agent.status === "busy");
    const proofs = data.online ? data.state?.lineage?.length || 0 : 0;
    text("[data-protocol-profiles]", data.online ? String(official.length) : "Unavailable", view);
    text("[data-protocol-online]", data.online ? String(online.length) : "Unavailable", view);
    text("[data-protocol-proofs]", data.online ? String(proofs) : "Unavailable", view);
    text("[data-protocol-core]", data.online ? "Online" : "Unavailable", view);
    text("[data-protocol-current]", data.online
      ? `The public Core is online. ${official.length} official role profiles are published, ${online.length} worker${online.length === 1 ? " is" : "s are"} currently connected, ${data.state?.machines?.length || 0} owner Agent${data.state?.machines?.length === 1 ? " is" : "s are"} registered, and ${proofs} proof${proofs === 1 ? " has" : "s have"} entered accepted lineage. State verified ${when(data.telemetry?.at)}.`
      : `The Core endpoint is unavailable. Runtime counts and operating claims are withheld until a verified response is received. Last check: ${when(data.checkedAt)}.`, view);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function render(data) { renderComponents(data); renderLineage(data); renderTreasury(data); renderDeploy(data); renderProtocol(data); }
  document.addEventListener("ohmium:data", (event) => render(event.detail));
  if (window.OhmiumData?.checkedAt) render(window.OhmiumData);
})();
