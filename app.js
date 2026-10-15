(() => {
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { wallet: null };
  const viewForRoute = { home: "home", live: "live", source: "mutations", circuit: "lineage", treasury: "treasury", deploy: "spawn", protocol: "manual", mutations: "mutations", lineage: "lineage", spawn: "spawn", manual: "manual" };
  const routeForView = { home: "home", live: "live", mutations: "source", lineage: "circuit", treasury: "treasury", spawn: "deploy", manual: "protocol" };

  function route(name) {
    const requested = String(name || "home").toLowerCase();
    const next = viewForRoute[requested] && one(`[data-view="${viewForRoute[requested]}"]`) ? viewForRoute[requested] : "home";
    const canonical = routeForView[next];
    if (location.hash !== `#${canonical}`) history.replaceState(null, "", `#${canonical}`);
    all(".app-view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === next));
    all("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === canonical));
    const detail = one("#landingDetail");
    if (detail) detail.hidden = next !== "home";
    document.body.dataset.route = canonical;
    scrollTo(0, 0);
  }

  all("[data-route]").forEach((link) => link.addEventListener("click", (event) => {
    if (!link.dataset.route) return;
    event.preventDefault();
    history.pushState(null, "", `#${link.dataset.route}`);
    route(link.dataset.route);
  }));
  const routeFromLocation = () => route(location.hash.slice(1) || "home");
  addEventListener("popstate", routeFromLocation);
  addEventListener("hashchange", routeFromLocation);
  addEventListener("load", routeFromLocation, { once: true });
  route(location.hash.slice(1) || "home");

  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  function updateClock() {
    const clock = one("#clock");
    if (clock) clock.textContent = `${time.format(new Date())} ET`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  all("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
    if (!button.dataset.copy || button.dataset.copy.toUpperCase() === "TBA") return;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy unavailable";
    }
    setTimeout(() => { button.textContent = original; }, 1200);
  }));

  const modal = one("#walletModal");
  const connectButton = one(".header-actions > button");
  function openModal() { modal?.classList.add("open"); modal?.setAttribute("aria-hidden", "false"); }
  function closeModal() { modal?.classList.remove("open"); modal?.setAttribute("aria-hidden", "true"); }
  connectButton?.addEventListener("click", openModal);
  one(".modal-close")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

  function providerFor(name) {
    if (name === "phantom") return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
    if (name === "solflare") return window.solflare || null;
    if (name === "backpack") return window.backpack?.solana || null;
    return null;
  }

  all(".wallet-choice").forEach((choice) => choice.addEventListener("click", async () => {
    const status = one("b", choice);
    const provider = providerFor(choice.dataset.wallet);
    if (!provider) { status.textContent = "Not installed"; return; }
    status.textContent = "Connecting…";
    try {
      const result = await provider.connect();
      const publicKey = String(result?.publicKey || provider.publicKey || "");
      if (!publicKey) throw new Error("Wallet returned no public key");
      state.wallet = publicKey;
      window.OhmiumWallet = { publicKey, provider: choice.dataset.wallet };
      one("span", connectButton).textContent = `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
      status.textContent = "Connected";
      document.dispatchEvent(new CustomEvent("ohmium:wallet", { detail: window.OhmiumWallet }));
      setTimeout(closeModal, 350);
    } catch { status.textContent = "Connection rejected"; }
  }));

  const cpu = one("#cpuRange"), memory = one("#memRange"), name = one("#machineName"), target = one("#machineTarget");
  function updatePreview() {
    if (cpu) { one("#cpuOut").textContent = cpu.value; one("#previewCpu").textContent = `${cpu.value} vCPU`; }
    if (memory) { one("#memOut").textContent = `${memory.value} GB`; one("#previewMem").textContent = `${memory.value} GB`; }
    if (name) one("#previewName").textContent = name.value || "unnamed-component";
    if (target) one("#previewClass").textContent = target.value.toUpperCase();
  }
  [cpu, memory, name, target].filter(Boolean).forEach((control) => control.addEventListener("input", updatePreview));
  updatePreview();
  const deployDescription = one(".spawn-intro p");
  if (deployDescription) deployDescription.textContent = "Owner activation permanently burns 10,000 $OHMIUM per Agent. The amount is defined; the on-chain burn step remains disabled until the verified mint and burn program are published.";
  const activationValue = one(".deploy-rack-readout dl div:last-child dd");
  if (activationValue) activationValue.textContent = "10,000 $OHMIUM";

  const economicTabs = all(".economic-ledger > .subhead button");
  economicTabs.forEach((button) => button.addEventListener("click", () => {
    const mode = button.textContent.trim().toLowerCase();
    economicTabs.forEach((item) => item.classList.toggle("active", item === button));
    all(".economic-ledger .reward-formula, .economic-ledger .eligibility-console").forEach((panel) => { panel.hidden = mode !== "policy"; });
    const heading = one(".chain-ledger header span"), stateLabel = one(".chain-ledger header b"), empty = one(".chain-ledger .ledger-empty");
    if (heading) heading.textContent = mode === "receipts" ? "CREATOR REWARD RECEIPTS" : mode === "claims" ? "AGENT REWARD CLAIMS" : "ON-CHAIN ACTIVITY";
    if (stateLabel) stateLabel.textContent = "NO VERIFIED ENTRIES";
    if (empty) empty.textContent = mode === "receipts" ? "No verified Pump.fun Creator Rewards receipt has been recorded." : mode === "claims" ? "No verified Agent reward claim has been recorded." : "Mint, treasury address and qualifying transactions are not configured yet.";
  }));

  one("#spawnForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = one(".spawn-submit");
    if (!one("#attest")?.checked) { button.textContent = "Confirm the maintenance attestation"; return; }
    if (!state.wallet) { openModal(); return; }
    if (!window.OhmiumData?.online) { button.textContent = "Core unavailable — deployment not submitted"; return; }
    button.disabled = true;
    button.textContent = "Registering…";
    try {
      const repository = [...event.currentTarget.querySelectorAll("input")].find((input) => input.value.startsWith("https://"))?.value || "";
      const result = await window.OhmiumData.request("/api/machines/register", { method: "POST", body: JSON.stringify({ name: name.value, target: target.value, repository, cpu: Number(cpu.value), memoryGb: Number(memory.value), wallet: state.wallet, registrationKey: one("#registrationKey")?.value || "" }) });
      const output = document.createElement("div");
      output.className = "spawn-result";
      const heading = document.createElement("b"), note = document.createElement("span"), secret = document.createElement("code");
      heading.textContent = "Component registered";
      note.textContent = "Save the one-time worker secret now.";
      secret.textContent = result.secret;
      output.append(heading, note, secret);
      event.currentTarget.append(output);
      button.textContent = "Registered";
      window.OhmiumData.refresh();
    } catch (error) {
      button.disabled = false;
      button.textContent = error.message || "Registration failed";
    }
  });
})();
