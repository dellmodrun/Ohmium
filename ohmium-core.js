(() => {
  const mount = document.querySelector("[data-ohmium-core]");
  if (!mount) return;

  const title = mount.querySelector("[data-core-title]");
  const detail = mount.querySelector("[data-core-detail]");
  const count = mount.querySelector("[data-core-count]");
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

  fetch("./assets/ohmium-circuit-core.svg?v=3")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((markup) => {
      const slot = mount.querySelector("[data-core-svg]");
      slot.innerHTML = markup;
      const modeledParts = slot.querySelectorAll(".part").length;
      count.textContent = `${modeledParts} parts`;
      slot.querySelectorAll("[data-component]").forEach((node) => {
        const activate = () => {
          const key = node.dataset.component;
          slot.querySelectorAll(".is-active").forEach((item) => item.classList.remove("is-active"));
          node.classList.add("is-active");
          slot.querySelector(`.route-${key}`)?.classList.add("is-active");
          title.textContent = states[key][0];
          detail.textContent = states[key][1];
        };
        node.addEventListener("pointerenter", activate);
        node.addEventListener("focus", activate);
        node.addEventListener("click", activate);
      });
    })
    .catch(() => {
      title.textContent = "Circuit renderer unavailable";
      detail.textContent = "The component topology could not be loaded.";
    });
})();
