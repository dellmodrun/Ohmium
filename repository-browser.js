(() => {
  const one = (selector, root = document) => root.querySelector(selector);
  const set = (selector, value) => { const node = one(selector); if (node) node.textContent = value; };
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const formatBytes = (bytes = 0) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '<img class="readme-badge" src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<span class="readme-link" title="$2">$1</span>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function markdown(source) {
    const output = []; let inCode = false, listOpen = false;
    for (const line of source.split(/\r?\n/)) {
      if (line.startsWith("```")) { if (listOpen) { output.push("</ul>"); listOpen = false; } output.push(inCode ? "</code></pre>" : "<pre><code>"); inCode = !inCode; continue; }
      if (inCode) { output.push(`${escapeHtml(line)}\n`); continue; }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) { if (listOpen) { output.push("</ul>"); listOpen = false; } const level = Math.min(heading[1].length + 1, 5); output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
      const item = line.match(/^[-*]\s+(.+)$/);
      if (item) { if (!listOpen) { output.push("<ul>"); listOpen = true; } output.push(`<li>${inlineMarkdown(item[1])}</li>`); continue; }
      if (listOpen) { output.push("</ul>"); listOpen = false; }
      if (line.trim()) output.push(`<p>${inlineMarkdown(line)}</p>`);
    }
    if (listOpen) output.push("</ul>");
    return output.join("");
  }

  function nested(files) {
    const root = {};
    for (const file of files) {
      const parts = file.path.split("/"); let cursor = root;
      parts.forEach((part, index) => { if (index === parts.length - 1) cursor[part] = file; else cursor = cursor[part] ||= {}; });
    }
    return root;
  }

  function treeMarkup(node, prefix = "") {
    return Object.entries(node).sort(([left, a], [right, b]) => {
      const aFolder = !a.path, bFolder = !b.path;
      return aFolder === bFolder ? left.localeCompare(right) : aFolder ? -1 : 1;
    }).map(([name, value]) => {
      const path = prefix ? `${prefix}/${name}` : name;
      if (!value.path) return `<details open><summary><i>+</i><span>${escapeHtml(name)}</span></summary><div>${treeMarkup(value, path)}</div></details>`;
      return `<button type="button" data-source-path="${escapeHtml(value.path)}"><i>${value.content === null ? "◇" : "·"}</i><span>${escapeHtml(name)}</span><em>${formatBytes(value.size)}</em></button>`;
    }).join("");
  }

  function sourceLines(file) {
    if (file.content === null) return `<li><code>Binary asset · ${formatBytes(file.size)} · source preview is not applicable.</code></li>`;
    return file.content.split(/\r?\n/).map((line) => `<li><code>${escapeHtml(line) || " "}</code></li>`).join("");
  }

  async function mount() {
    const host = one("[data-repository-tree]");
    if (!host) return;
    try {
      const response = await fetch("./source-index.json?v=1", { cache: "no-store" });
      if (!response.ok) throw new Error(`Source index returned HTTP ${response.status}`);
      const manifest = await response.json(), files = manifest.files || [], byPath = new Map(files.map((file) => [file.path, file]));
      set("[data-repo-description]", manifest.description);
      set("[data-repo-branch]", "main");
      set("[data-repo-revision]", String(manifest.revision || "unknown").slice(0, 7));
      set("[data-repo-count]", `${files.length} files`);
      set("[data-repo-status]", `Source mounted · ${String(manifest.revision || "unknown").slice(0, 7)}`);
      host.innerHTML = treeMarkup(nested(files));
      const readme = byPath.get("README.md"), readmeHost = one("[data-repository-readme]");
      if (readmeHost) readmeHost.innerHTML = readme?.content ? markdown(readme.content) : "<p>README.md is not present in this release.</p>";

      const show = (file) => {
        host.querySelectorAll("button.selected").forEach((button) => button.classList.remove("selected"));
        host.querySelector(`[data-source-path="${CSS.escape(file.path)}"]`)?.classList.add("selected");
        set("[data-code-path]", file.path);
        set("[data-code-size]", formatBytes(file.size));
        set("[data-code-language]", file.language);
        set("[data-code-state]", file.content === null ? "Binary asset metadata" : `${file.content.split(/\r?\n/).length} lines · release source`);
        set("[data-code-updated]", `Revision ${String(manifest.revision || "unknown").slice(0, 7)}`);
        const lines = one("[data-code-lines]");
        if (lines) { lines.innerHTML = sourceLines(file); lines.scrollTop = 0; }
      };
      host.addEventListener("click", (event) => { const button = event.target.closest("[data-source-path]"); const file = button && byPath.get(button.dataset.sourcePath); if (file) show(file); });
      if (readme) show(readme); else if (files[0]) show(files[0]);
    } catch (error) {
      host.innerHTML = `<p>${escapeHtml(error.message)}. No substitute source was rendered.</p>`;
      set("[data-repo-status]", "Source index unavailable");
      set("[data-code-state]", "Source unavailable");
    }
  }
  mount();
})();
