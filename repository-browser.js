(() => {
  const owner = "nuttumrunit", repository = "Ohmium";
  const api = `https://api.github.com/repos/${owner}/${repository}`;
  const one = (selector, root = document) => root.querySelector(selector);
  const set = (selector, value) => { const node = one(selector); if (node) node.textContent = value; };
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const formatBytes = (bytes = 0) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  const binary = (path) => /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|mp4|zip|pdf)$/i.test(path);
  const request = async (url, json = true) => { const response = await fetch(url, { headers: { accept: json ? "application/vnd.github+json" : "text/plain" }, cache: "no-store" }); if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`); return json ? response.json() : response.text(); };

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
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
    if (inCode) output.push("</code></pre>");
    return output.join("");
  }

  function buildTree(items) {
    const root = { children: new Map() };
    for (const item of items) {
      const parts = item.path.split("/"); let cursor = root;
      parts.forEach((part, index) => {
        if (!cursor.children.has(part)) cursor.children.set(part, { name: part, path: parts.slice(0, index + 1).join("/"), type: index === parts.length - 1 ? item.type : "tree", size: item.size || 0, children: new Map() });
        cursor = cursor.children.get(part);
      });
    }
    return root;
  }

  function treeMarkup(node, depth = 0) {
    const children = [...node.children.values()].sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name) : left.type === "tree" ? -1 : 1);
    return children.map((child) => {
      if (child.type === "tree") return `<details ${depth < 1 ? "open" : ""}><summary><i>⌄</i><span>${escapeHtml(child.name)}</span></summary><div>${treeMarkup(child, depth + 1)}</div></details>`;
      return `<button type="button" data-repo-file="${escapeHtml(child.path)}" data-repo-size="${child.size}"><i>·</i><span>${escapeHtml(child.name)}</span><em>${formatBytes(child.size)}</em></button>`;
    }).join("");
  }

  function showCode(path, source, size, branch, updatedAt) {
    set("[data-code-path]", path);
    set("[data-code-size]", formatBytes(size));
    set("[data-code-state]", "Source loaded from GitHub");
    set("[data-code-updated]", updatedAt ? `Repository updated ${new Date(updatedAt).toLocaleString([], { hour12: false })}` : "Current public revision");
    const link = one("[data-code-source]");
    if (link) link.href = `https://github.com/${owner}/${repository}/blob/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const lines = one("[data-code-lines]");
    if (!lines) return;
    lines.replaceChildren();
    source.split(/\r?\n/).forEach((line) => { const item = document.createElement("li"), code = document.createElement("code"); code.textContent = line || " "; item.append(code); lines.append(item); });
    one("[data-repository-tree] .selected")?.classList.remove("selected");
    one(`[data-repo-file="${CSS.escape(path)}"]`)?.classList.add("selected");
  }

  async function loadFile(path, size, branch, updatedAt) {
    set("[data-code-state]", "Fetching source from GitHub…");
    if (binary(path) || size > 500000) { showCode(path, "Binary or oversized file. Open it on GitHub to inspect the original asset.", size, branch, updatedAt); set("[data-code-state]", "Source preview unavailable"); return; }
    try {
      const source = await request(`https://raw.githubusercontent.com/${owner}/${repository}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`, false);
      showCode(path, source, size || new Blob([source]).size, branch, updatedAt);
    } catch (error) { set("[data-code-state]", error.message); }
  }

  async function mount() {
    const host = one("[data-repository-tree]");
    if (!host) return;
    try {
      const metadata = await request(api), branch = metadata.default_branch;
      const [tree, commit, readme] = await Promise.all([
        request(`${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`),
        request(`${api}/commits/${encodeURIComponent(branch)}`),
        request(`https://raw.githubusercontent.com/${owner}/${repository}/${encodeURIComponent(branch)}/README.md`, false).catch(() => "README unavailable.")
      ]);
      const files = (tree.tree || []).filter((item) => item.type === "blob" || item.type === "tree");
      set("[data-repo-description]", metadata.description || "Public Ohmium source code and runtime.");
      set("[data-repo-branch]", branch);
      set("[data-repo-revision]", String(commit.sha || tree.sha).slice(0, 7));
      set("[data-repo-count]", `${files.filter((item) => item.type === "blob").length} files`);
      set("[data-repo-status]", `GitHub connected · ${String(commit.sha || tree.sha).slice(0, 7)}`);
      host.innerHTML = treeMarkup(buildTree(files));
      const readmeHost = one("[data-repository-readme]");
      if (readmeHost) readmeHost.innerHTML = markdown(readme);
      host.addEventListener("click", (event) => { const button = event.target.closest("[data-repo-file]"); if (button) loadFile(button.dataset.repoFile, Number(button.dataset.repoSize), branch, metadata.pushed_at); });
      const defaultFile = files.find((item) => item.path === "README.md") || files.find((item) => item.type === "blob");
      if (defaultFile) await loadFile(defaultFile.path, defaultFile.size, branch, metadata.pushed_at);
    } catch (error) {
      host.innerHTML = `<p>${escapeHtml(error.message)}. No repository data was substituted.</p>`;
      set("[data-repo-status]", "GitHub unavailable");
      set("[data-code-state]", "Source unavailable");
    }
  }
  mount();
})();
