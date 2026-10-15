(() => {
  const mount = document.querySelector("[data-ohmium-core]");
  if (!mount) return;

  const title = mount.querySelector("[data-core-title]");
  const detail = mount.querySelector("[data-core-detail]");
  const count = mount.querySelector("[data-core-count]");
  const networkState = mount.querySelector("[data-core-network-state]");
  const inspect = mount.querySelector("[data-core-inspect]");
  const states = {
    core: ["Conductor core", "Coordinates verified signals across the component circuit."],
    sensor: ["Sense / 01", "Observes an approved source and converts it into a bounded signal."],
    filter: ["Filter / 02", "Removes duplicate, malformed and low-confidence observations."],
    memory: ["Memory / 03", "Stores accepted context with source and verification lineage."],
    router: ["Route / 04", "Dispatches signals to the component qualified to process them."],
    oracle: ["Oracle / 05", "Bridges deterministic external data into the circuit."],
    guard: ["Guard / 06", "Enforces permissions, budgets and execution constraints."],
    archive: ["Archive / 07", "Preserves reproducible traces for inspection and replay."],
    verify: ["Verify / 08", "Checks output evidence before the shared model can accept it."],
  };

  fetch("./assets/ohmium-circuit-core.svg?v=5")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((markup) => {
      const slot = mount.querySelector("[data-core-svg]");
      slot.innerHTML = markup;
      const modeledParts = slot.querySelectorAll(".part").length;
      count.textContent = `${modeledParts} parts`;
      let inspection = 0;
      const clear = () => slot.querySelectorAll(".is-active").forEach((item) => item.classList.remove("is-active"));
      const activate = (key, mode = "inspect") => {
        clear();
        slot.querySelector(`[data-component="${key}"]`)?.classList.add("is-active");
        slot.querySelector(`.route-${key}`)?.classList.add("is-active");
        title.textContent = states[key][0];
        detail.textContent = states[key][1];
        networkState.textContent = mode === "event" ? "Processing verified event" : "Local route inspection";
      };
      slot.querySelectorAll("[data-component]").forEach((node) => {
        const inspectNode = () => activate(node.dataset.component);
        node.addEventListener("pointerenter", inspectNode);
        node.addEventListener("focus", inspectNode);
        node.addEventListener("click", inspectNode);
      });
      inspect.addEventListener("click", async () => {
        if (inspection) return;
        const run = ++inspection;
        inspect.disabled = true;
        inspect.textContent = "Inspecting 0 / 8";
        const route = ["sensor", "filter", "oracle", "guard", "router", "memory", "archive", "verify", "core"];
        for (let index = 0; index < route.length && run === inspection; index++) {
          activate(route[index]);
          window.dispatchEvent(new CustomEvent("ohmium:inspection-step", { detail: { component: route[index], index, total: route.length } }));
          inspect.textContent = index < 8 ? `Inspecting ${index + 1} / 8` : "Route verified";
          await new Promise((resolve) => setTimeout(resolve, matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 520));
        }
        await new Promise((resolve) => setTimeout(resolve, 650));
        clear();
        title.textContent = "Agent silicon floorplan";
        detail.textContent = "Inspect a macro to trace its execution path.";
        networkState.textContent = "Awaiting first verified signal";
        inspect.textContent = "Inspect execution path";
        inspect.disabled = false;
        inspection = 0;
        window.dispatchEvent(new CustomEvent("ohmium:inspection-complete"));
      });
      window.addEventListener("ohmium:signal", (event) => {
        const key = event.detail?.component;
        if (states[key]) activate(key, "event");
      });
      document.addEventListener("ohmium:data", (event) => {
        if (inspection || !event.detail?.online) return;
        const telemetry = event.detail.telemetry || {};
        const lineage = event.detail.state?.lineage || [];
        networkState.textContent = lineage.length ? `Generation ${lineage.length} verified` : `${telemetry.onlineMachines || 0} agents online · awaiting first task`;
      });
      if (window.OhmiumData?.online) {
        const lineage = window.OhmiumData.state?.lineage || [];
        networkState.textContent = lineage.length ? `Generation ${lineage.length} verified` : `${window.OhmiumData.telemetry?.onlineMachines || 0} agents online · awaiting first task`;
      }
    })
    .catch(() => {
      title.textContent = "Circuit renderer unavailable";
      detail.textContent = "The component topology could not be loaded.";
    });
})();
