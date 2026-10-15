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
