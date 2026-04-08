type StoredAsset = {
  id: string;
  name: string;
  kind: "image" | "video" | "file";
  mime: string;
  size: number;
  note: string;
  createdAt: string;
  dataUrl: string;
};

const STORAGE_KEY = "cowork-drop-web-assets";
const NOTE_KEY = "cowork-drop-web-note";

const els = {
  devicePill: byId("device-pill"),
  assetPill: byId("asset-pill"),
  notePill: byId("note-pill"),
  shareNote: byId<HTMLTextAreaElement>("share-note"),
  assetInput: byId<HTMLInputElement>("asset-input"),
  saveButton: byId<HTMLButtonElement>("save-button"),
  clearButton: byId<HTMLButtonElement>("clear-button"),
  saveStatus: byId("save-status"),
  sessionFeed: byId("session-feed"),
  stagingGrid: byId("staging-grid"),
  gallerySummary: byId("gallery-summary"),
  galleryGrid: byId("gallery-grid"),
  previewFrame: byId("preview-frame"),
  metaGrid: byId("meta-grid"),
};

let stagedFiles: File[] = [];
let assets: StoredAsset[] = loadAssets();

wireTabs();
wireActions();
render();

function wireTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll<HTMLElement>(".panel-grid").forEach((panel) => panel.classList.remove("is-active"));
      button.classList.add("is-active");
      bySelector<HTMLElement>(`[data-panel="${button.dataset.tab}"]`).classList.add("is-active");
    });
  });
}

function wireActions(): void {
  els.shareNote.value = localStorage.getItem(NOTE_KEY) ?? "";
  els.assetInput.addEventListener("change", () => {
    stagedFiles = Array.from(els.assetInput.files ?? []);
    renderStaging();
  });
  els.saveButton.addEventListener("click", () => void saveFiles());
  els.clearButton.addEventListener("click", () => {
    stagedFiles = [];
    assets = [];
    els.assetInput.value = "";
    els.shareNote.value = "";
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NOTE_KEY);
    render();
  });
  els.shareNote.addEventListener("input", () => {
    localStorage.setItem(NOTE_KEY, els.shareNote.value);
    renderPills();
  });
}

async function saveFiles(): Promise<void> {
  if (!stagedFiles.length && !els.shareNote.value.trim()) {
    els.saveStatus.textContent = "Add files or a note first.";
    return;
  }

  const newAssets: StoredAsset[] = [];
  for (const file of stagedFiles) {
    newAssets.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: file.name,
      kind: classify(file.type),
      mime: file.type || "application/octet-stream",
      size: file.size,
      note: els.shareNote.value.trim(),
      createdAt: new Date().toISOString(),
      dataUrl: await fileToDataUrl(file),
    });
  }

  assets = [...newAssets, ...assets];
  persistAssets(assets);
  localStorage.setItem(NOTE_KEY, els.shareNote.value);
  stagedFiles = [];
  els.assetInput.value = "";
  els.saveStatus.textContent = newAssets.length
    ? `Saved ${newAssets.length} item(s) into the browser gallery.`
    : "Saved the share note for this browser session.";
  render();
}

function render(): void {
  renderPills();
  renderStaging();
  renderSessionFeed();
  renderGallery();
}

function renderPills(): void {
  const note = localStorage.getItem(NOTE_KEY)?.trim() ?? "";
  els.devicePill.textContent = mobileLabel();
  els.assetPill.textContent = `${assets.length} items`;
  els.notePill.textContent = note ? "Share note saved" : "No share note";
}

function renderStaging(): void {
  els.stagingGrid.innerHTML = stagedFiles.length
    ? stagedFiles
        .map(
          (file) => `
            <article class="asset-card">
              <div class="asset-body">
                <span class="asset-name">${escapeHtml(file.name)}</span>
                <span class="asset-meta">${formatBytes(file.size)} • ${escapeHtml(classify(file.type))}</span>
              </div>
            </article>`,
        )
        .join("")
    : `<article class="list-row">No staged files yet.</article>`;
}

function renderSessionFeed(): void {
  const note = localStorage.getItem(NOTE_KEY)?.trim() ?? "";
  const rows = [];
  if (note) {
    rows.push(`
      <article class="list-row">
        <strong>Saved note</strong>
        <span>${escapeHtml(note)}</span>
      </article>`);
  }
  rows.push(
    ...assets.slice(0, 8).map(
      (asset) => `
        <article class="list-row">
          <strong>${escapeHtml(asset.name)}</strong>
          <span>${formatBytes(asset.size)} • ${escapeHtml(asset.kind)} • ${formatDate(asset.createdAt)}</span>
        </article>`,
    ),
  );
  els.sessionFeed.innerHTML = rows.length ? rows.join("") : `<article class="list-row">No saved demo session yet.</article>`;
}

function renderGallery(): void {
  els.gallerySummary.textContent = assets.length
    ? `${assets.length} item(s) saved in this browser.`
    : "No saved items yet.";
  els.galleryGrid.innerHTML = assets.length
    ? assets
        .map(
          (asset) => `
            <article class="asset-card">
              <button data-asset-id="${asset.id}">
                ${renderAssetMedia(asset)}
                <div class="asset-body">
                  <span class="asset-name">${escapeHtml(asset.name)}</span>
                  <span class="asset-meta">${formatBytes(asset.size)} • ${escapeHtml(asset.kind)}</span>
                </div>
              </button>
            </article>`,
        )
        .join("")
    : `<article class="list-row">Save files from the Nearby tab to populate the demo gallery.</article>`;

  els.galleryGrid.querySelectorAll<HTMLButtonElement>("[data-asset-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.assetId;
      const asset = assets.find((entry) => entry.id === id);
      if (!asset) {
        return;
      }
      renderPreview(asset);
    });
  });
}

function renderPreview(asset: StoredAsset): void {
  els.previewFrame.innerHTML = renderAssetMedia(asset);
  els.metaGrid.innerHTML = [
    metaRow("Name", asset.name),
    metaRow("Kind", asset.kind),
    metaRow("Type", asset.mime),
    metaRow("Size", formatBytes(asset.size)),
    metaRow("Saved", formatDate(asset.createdAt)),
    metaRow("Note", asset.note || "No note"),
  ].join("");
}

function renderAssetMedia(asset: StoredAsset): string {
  if (asset.kind === "image") {
    return `<img src="${asset.dataUrl}" alt="${escapeHtml(asset.name)}" />`;
  }
  if (asset.kind === "video") {
    return `<video src="${asset.dataUrl}" controls playsinline muted></video>`;
  }
  return `<div class="list-row">Preview unavailable.</div>`;
}

function persistAssets(nextAssets: StoredAsset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAssets));
}

function loadAssets(): StoredAsset[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as StoredAsset[];
  } catch {
    return [];
  }
}

function classify(mime: string): "image" | "video" | "file" {
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  return "file";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function mobileLabel(): string {
  const ua = navigator.userAgent;
  if (ua.includes("iPhone")) {
    return "iPhone browser";
  }
  if (ua.includes("Android")) {
    return "Android browser";
  }
  if (ua.includes("iPad")) {
    return "iPad browser";
  }
  return "Browser mode";
}

function metaRow(label: string, value: string): string {
  return `<article class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function formatBytes(size: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing element #${id}`);
  }
  return node as T;
}

function bySelector<T extends Element = Element>(selector: string): T {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Missing selector ${selector}`);
  }
  return node as T;
}
