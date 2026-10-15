(() => {
  const configured = document.querySelector('meta[name="ohmium-api-base"]')?.content?.trim() || "";
  const stored = localStorage.getItem("ohmium.apiBase")?.trim() || "";
  const base = (stored || configured).replace(/\/$/, "");
  const data = { online: false, state: null, telemetry: null, error: null, checkedAt: null, stream: "connecting", base };
  let refreshing = null;
  let stream = null;
  let refreshTimer = null;

  async function request(path, options = {}) {
    const response = await fetch(`${base}${path}`, { cache: "no-store", ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || `Core returned HTTP ${response.status}`);
    return value;
  }

  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
    try {
      const [health, state, telemetry] = await Promise.all([request("/api/health"), request("/api/state"), request("/api/telemetry")]);
      if (health.service !== "ohmium-core") throw new Error("Endpoint is not an Ohmium Core");
      Object.assign(data, { online: true, state, telemetry, error: null, checkedAt: new Date().toISOString() });
    } catch (error) {
      Object.assign(data, { online: false, state: null, telemetry: null, error: error.message, checkedAt: new Date().toISOString() });
    }
    document.dispatchEvent(new CustomEvent("ohmium:data", { detail: data }));
    return data;
    })();
    try { return await refreshing; } finally { refreshing = null; }
  }

  function scheduleRefresh(delay = 120) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }

  function connectStream() {
    if (!("EventSource" in window)) { data.stream = "polling"; return; }
    stream?.close();
    stream = new EventSource(`${base}/api/events`);
    stream.onopen = () => { data.stream = "live"; };
    stream.onerror = () => { data.stream = "reconnecting"; };
    ["snapshot", "task.created", "task.claimed", "machine.registered", "mutation.verifying", "mutation.rejected", "mutation.accepted"].forEach((type) => {
      stream.addEventListener(type, () => scheduleRefresh(type === "snapshot" ? 0 : 100));
    });
  }

  window.OhmiumData = Object.assign(data, { request, refresh });
  refresh();
  connectStream();
  setInterval(refresh, 5000);
  addEventListener("online", () => { connectStream(); refresh(); });
  addEventListener("beforeunload", () => stream?.close(), { once: true });
})();
