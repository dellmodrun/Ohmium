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
  const walletEntries = new Map();
  let walletEventOff = null;
  let restoreAttempted = false;
  const safe = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const walletFooter = one("[data-wallet-status]");
  const walletDisconnect = one("[data-wallet-disconnect]");

  function walletMessage(message, mode = "idle") {
    if (!walletFooter) return;
    walletFooter.dataset.mode = mode;
    const text = one("span", walletFooter);
    if (text) text.textContent = message;
  }

  function openModal() {
    renderWallets();
    modal?.classList.add("open");
    modal?.setAttribute("aria-hidden", "false");
  }
  function closeModal() { modal?.classList.remove("open"); modal?.setAttribute("aria-hidden", "true"); }
  connectButton?.addEventListener("click", openModal);
  one(".modal-close")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

  const legacyWallets = [
    { id: "phantom", name: "Phantom", icon: "./assets/wallet-phantom.svg", get: () => window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null) },
    { id: "solflare", name: "Solflare", icon: "./assets/wallet-solflare.svg", get: () => window.solflare || null },
    { id: "backpack", name: "Backpack", icon: "./assets/wallet-backpack.png", get: () => window.backpack?.solana || null },
    { id: "okx", name: "OKX Wallet", icon: "", get: () => window.okxwallet?.solana || null },
    { id: "coinbase", name: "Coinbase Wallet", icon: "", get: () => window.coinbaseSolana || window.coinbaseWalletExtension?.solana || null }
  ];

  function registerLegacyWallets() {
    legacyWallets.forEach((entry) => {
      const provider = entry.get();
      walletEntries.set(`legacy:${entry.id}`, { ...entry, key: `legacy:${entry.id}`, kind: "legacy", available: Boolean(provider), provider });
    });
    const providers = Array.isArray(window.solana?.providers) ? window.solana.providers : [];
    providers.forEach((provider, index) => {
      const name = provider?.name || provider?.walletName || `Solana Wallet ${index + 1}`;
      const key = `legacy:injected:${name}`;
      walletEntries.set(key, { id: `injected-${index}`, key, name, icon: provider?.icon || "", kind: "legacy", available: true, provider });
    });
  }

  function registerStandardWallets(...wallets) {
    wallets.forEach((wallet) => {
      if (!wallet?.features?.["standard:connect"] || !wallet.chains?.some((chain) => String(chain).startsWith("solana:"))) return;
      const key = `standard:${wallet.name}`;
      walletEntries.set(key, { id: wallet.name, key, name: wallet.name, icon: wallet.icon || "", kind: "standard", available: true, wallet });
    });
    renderWallets();
    restoreWallet();
    return () => {
      wallets.forEach((wallet) => walletEntries.delete(`standard:${wallet.name}`));
      renderWallets();
    };
  }

  const walletStandardApi = Object.freeze({ register: registerStandardWallets });
  addEventListener("wallet-standard:register-wallet", (event) => {
    try { event.detail(walletStandardApi); } catch (error) { console.warn("Wallet Standard registration failed", error); }
  });
  try { dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: walletStandardApi })); } catch (error) { console.warn("Wallet Standard discovery failed", error); }

  function uniqueEntries() {
    registerLegacyWallets();
    const chosen = new Map();
    [...walletEntries.values()].forEach((entry) => {
      const key = entry.name.toLowerCase();
      const current = chosen.get(key);
      if (!current || entry.kind === "standard" || (!current.available && entry.available)) chosen.set(key, entry);
    });
    return [...chosen.values()].sort((left, right) => Number(right.available) - Number(left.available) || left.name.localeCompare(right.name));
  }

  function iconFor(entry) {
    if (entry.icon && (/^data:image\//.test(entry.icon) || /^\.\//.test(entry.icon))) return `<img src="${safe(entry.icon)}" alt="">`;
    return `<span>${safe(entry.name.slice(0, 1).toUpperCase())}</span>`;
  }

  function renderWallets() {
    const list = one(".wallet-list");
    if (!list) return;
    const entries = uniqueEntries();
    list.innerHTML = entries.map((entry) => `<button class="wallet-choice" type="button" data-wallet-key="${safe(entry.key || `${entry.kind}:${entry.id}`)}" ${entry.available ? "" : "aria-disabled=\"true\""}><i class="wallet-brand">${iconFor(entry)}</i><span>${safe(entry.name)}<small>${entry.kind === "standard" ? "Wallet Standard · Solana" : entry.available ? "Injected Solana provider" : "Not detected in this browser"}</small></span><b>${state.wallet && window.OhmiumWallet?.provider === entry.name ? "Connected" : entry.available ? "Connect" : "Unavailable"}</b></button>`).join("");
    all("[data-wallet-key]", list).forEach((button) => button.addEventListener("click", () => connectWallet(walletEntries.get(button.dataset.walletKey), button)));
  }

  function setWallet(publicKey, entry, account = null) {
    state.wallet = publicKey;
    window.OhmiumWallet = { publicKey, provider: entry.name, standard: entry.kind === "standard", account, entry };
    localStorage.setItem("ohmium.wallet", JSON.stringify({ kind: entry.kind, id: entry.id, name: entry.name }));
    const label = one("span", connectButton);
    if (label) label.textContent = `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
    if (connectButton) connectButton.dataset.connected = "true";
    if (walletDisconnect) walletDisconnect.hidden = false;
    walletMessage(`${entry.name} connected · ${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`, "connected");
    document.dispatchEvent(new CustomEvent("ohmium:wallet", { detail: window.OhmiumWallet }));
    renderWallets();
  }

  function clearWallet(message = "Wallet disconnected") {
    walletEventOff?.();
    walletEventOff = null;
    state.wallet = null;
    window.OhmiumWallet = null;
    localStorage.removeItem("ohmium.wallet");
    const label = one("span", connectButton);
    if (label) label.textContent = "Connect wallet";
    if (connectButton) delete connectButton.dataset.connected;
    if (walletDisconnect) walletDisconnect.hidden = true;
    walletMessage(message);
    document.dispatchEvent(new CustomEvent("ohmium:wallet", { detail: null }));
    renderWallets();
  }

  function bindWalletEvents(entry) {
    walletEventOff?.();
    walletEventOff = null;
    if (entry.kind === "standard") {
      const events = entry.wallet.features?.["standard:events"];
      if (events?.on) walletEventOff = events.on("change", ({ accounts } = {}) => {
        const account = accounts?.find((candidate) => candidate.chains?.some((chain) => String(chain).startsWith("solana:")));
        if (account?.address) setWallet(account.address, entry, account); else clearWallet("Wallet account disconnected");
      });
    } else if (entry.provider?.on) {
      const accountChanged = (publicKey) => publicKey ? setWallet(String(publicKey), entry) : clearWallet("Wallet account disconnected");
      const disconnected = () => clearWallet();
      entry.provider.on("accountChanged", accountChanged);
      entry.provider.on("disconnect", disconnected);
      walletEventOff = () => { entry.provider.removeListener?.("accountChanged", accountChanged); entry.provider.removeListener?.("disconnect", disconnected); };
    }
  }

  async function connectWallet(entry, button, silent = false) {
    if (!entry?.available) { walletMessage(`${entry?.name || "Wallet"} is not installed in this browser`, "error"); return false; }
    const status = button ? one("b", button) : null;
    if (status) status.textContent = "Connecting…";
    try {
      let publicKey = "", account = null;
      if (entry.kind === "standard") {
        const result = await entry.wallet.features["standard:connect"].connect(silent ? { silent: true } : undefined);
        account = (result?.accounts || entry.wallet.accounts || []).find((candidate) => candidate.chains?.some((chain) => String(chain).startsWith("solana:")));
        publicKey = String(account?.address || "");
      } else {
        const result = await entry.provider.connect(silent ? { onlyIfTrusted: true } : undefined);
        publicKey = String(result?.publicKey || entry.provider.publicKey || "");
      }
      if (!publicKey) throw new Error("Wallet returned no Solana account");
      bindWalletEvents(entry);
      setWallet(publicKey, entry, account);
      if (status) status.textContent = "Connected";
      if (!silent) setTimeout(closeModal, 300);
      return true;
    } catch (error) {
      if (status) status.textContent = silent ? "Connect" : "Retry";
      if (!silent) walletMessage(error?.message || "Wallet connection was rejected", "error");
      return false;
    }
  }

  async function restoreWallet() {
    if (restoreAttempted || state.wallet) return;
    let saved;
    try { saved = JSON.parse(localStorage.getItem("ohmium.wallet") || "null"); } catch { saved = null; }
    if (!saved) { restoreAttempted = true; return; }
    const entry = uniqueEntries().find((candidate) => candidate.kind === saved.kind && (candidate.id === saved.id || candidate.name === saved.name));
    if (!entry?.available) return;
    restoreAttempted = true;
    await connectWallet(entry, null, true);
  }

  walletDisconnect?.addEventListener("click", async () => {
    const active = window.OhmiumWallet?.entry;
    try {
      if (active?.kind === "standard") await active.wallet.features?.["standard:disconnect"]?.disconnect?.();
      else await active?.provider?.disconnect?.();
    } catch {}
    clearWallet();
  });
  renderWallets();
  setTimeout(() => { renderWallets(); restoreWallet(); }, 700);
  setTimeout(() => { renderWallets(); restoreWallet(); }, 1800);

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
  if (deployDescription) deployDescription.textContent = "Owner activation permanently burns 10,000 $OHM per Agent. The amount is defined; the on-chain burn step remains disabled until the verified mint and burn program are published.";
  const activationValue = one(".deploy-rack-readout dl div:last-child dd");
  if (activationValue) activationValue.textContent = "10,000 $OHM";

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
