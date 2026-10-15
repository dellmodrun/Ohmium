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
    text("[data-circuit-online]", `${online.length} / ${official.length || 8}`, view);
    text("[data-circuit-accepted]", String(lineage.length), view);
    text("[data-circuit-quorum]", lineage.length ? "2 / 2" : "0 / 2", view);
    text("[data-circuit-registered]", `${official.length || 8} profiles`, view);
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
      if (bar) bar.style.setProperty("--scan", active && Number.isFinite(Number(agent.telemetry?.cpuPct)) ? `${Math.max(8, Math.min(100, Number(agent.telemetry.cpuPct)))}%` : "12%");
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
    if (empty) empty.innerHTML = `<span>GENERATION ${latest.generation}</span><strong>${escapeHtml(short(latest.artifact, 12))}</strong><p>Accepted ${escapeHtml(when(latest.acceptedAt))} by ${latest.verifiers?.length || 0} independent verifiers.</p>`;
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
    if (policy?.agentActivation) text("[data-policy-burn]", `${Number(policy.agentActivation.burnTokens).toLocaleString()} $${policy.symbol}`);
    if (policy?.creatorRewards?.allocation) text("[data-policy-incentive]", `${policy.creatorRewards.allocation.agentIncentivesPct}%`);
    if (!treasury?.initialized) {
      text(".treasury-workstation .work-command em", data.online ? "Core online · treasury not configured" : "Core unavailable · treasury not configured");
      text(".treasury-summary .subhead b", "Solana · TBA");
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

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function render(data) { renderComponents(data); renderLineage(data); renderTreasury(data); renderDeploy(data); }
  document.addEventListener("ohmium:data", (event) => render(event.detail));
  if (window.OhmiumData?.checkedAt) render(window.OhmiumData);
})();
