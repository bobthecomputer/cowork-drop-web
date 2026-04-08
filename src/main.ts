type AssetKind = "image" | "video" | "file";

type StoredAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  mime: string;
  size: number;
  note: string;
  createdAt: string;
  dataUrl: string;
};

type StagedAsset = {
  id: string;
  file: File;
  kind: AssetKind;
  previewUrl: string;
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
  stagingSummary: byId("staging-summary"),
  stagingGrid: byId("staging-grid"),
  gallerySummary: byId("gallery-summary"),
  galleryGrid: byId("gallery-grid"),
  previewFrame: byId("preview-frame"),
  metaGrid: byId("meta-grid"),
  downloadButton: byId<HTMLButtonElement>("download-button"),
  shareButton: byId<HTMLButtonElement>("share-button"),
  deleteButton: byId<HTMLButtonElement>("delete-button"),
};

let stagedAssets: StagedAsset[] = [];
let assets: StoredAsset[] = loadAssets();
let selectedAssetId = assets[0]?.id ?? "";

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
    resetStaging();
    stagedAssets = Array.from(els.assetInput.files ?? []).map((file, index) => ({
      id: `stage-${Date.now()}-${index}`,
      file,
      kind: classify(file.type),
      previewUrl: URL.createObjectURL(file),
    }));
    render();
  });
  els.saveButton.addEventListener("click", () => void saveFiles());
  els.clearButton.addEventListener("click", () => {
    resetStaging();
    assets = [];
    selectedAssetId = "";
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
  els.downloadButton.addEventListener("click", () => downloadSelected());
  els.shareButton.addEventListener("click", () => void shareSelected());
  els.deleteButton.addEventListener("click", () => deleteSelected());
}

async function saveFiles(): Promise<void> {
  if (!stagedAssets.length && !els.shareNote.value.trim()) {
    els.saveStatus.textContent = "Add files or a note first.";
    return;
  }

  const newAssets: StoredAsset[] = [];
  for (const staged of stagedAssets) {
    newAssets.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: staged.file.name,
      kind: staged.kind,
      mime: staged.file.type || "application/octet-stream",
      size: staged.file.size,
      note: els.shareNote.value.trim(),
      createdAt: new Date().toISOString(),
      dataUrl: await fileToDataUrl(staged.file),
    });
  }

  assets = [...newAssets, ...assets];
  if (newAssets[0]) {
    selectedAssetId = newAssets[0].id;
  }
  persistAssets(assets);
  localStorage.setItem(NOTE_KEY, els.shareNote.value);
  els.assetInput.value = "";
  resetStaging();
  els.saveStatus.textContent = newAssets.length
    ? `Saved ${newAssets.length} item(s) into the browser gallery.`
    : "Saved the share note for this browser session.";
  activateTab("gallery");
  render();
}

function render(): void {
  renderPills();
  renderStaging();
  renderSessionFeed();
  renderGallery();
  renderSelectedAsset();
}

function renderPills(): void {
  const note = localStorage.getItem(NOTE_KEY)?.trim() ?? "";
  els.devicePill.textContent = mobileLabel();
  els.assetPill.textContent = `${assets.length} items`;
  els.notePill.textContent = note ? "Share note saved" : "No share note";
}

function renderStaging(): void {
  els.stagingSummary.textContent = stagedAssets.length
    ? `${stagedAssets.length} file(s) ready to save into the demo gallery.`
    : "No staged files yet.";
  els.stagingGrid.innerHTML = stagedAssets.length
    ? stagedAssets
        .map(
          (asset) => `
            <article class="asset-card">
              <button class="asset-remove" data-stage-remove="${asset.id}">Remove</button>
              <button data-stage-id="${asset.id}">
                ${renderStagedMedia(asset)}
                <div class="asset-body">
                  <span class="asset-name">${escapeHtml(asset.file.name)}</span>
                  <span class="asset-meta">${formatBytes(asset.file.size)} • ${escapeHtml(asset.kind)}</span>
                </div>
              </button>
            </article>`,
        )
        .join("")
    : `<article class="list-row">No staged files yet.</article>`;

  els.stagingGrid.querySelectorAll<HTMLElement>("[data-stage-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.stageRemove;
      if (!id) {
        return;
      }
      const asset = stagedAssets.find((entry) => entry.id === id);
      if (asset) {
        URL.revokeObjectURL(asset.previewUrl);
      }
      stagedAssets = stagedAssets.filter((entry) => entry.id !== id);
      render();
    });
  });
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
    ? `${assets.length} item(s) saved in this browser. Tap one for a full preview.`
    : "No saved items yet.";
  els.galleryGrid.innerHTML = assets.length
    ? assets
        .map(
          (asset) => `
            <article class="asset-card ${asset.id === selectedAssetId ? "is-selected" : ""}">
              <button data-asset-id="${asset.id}">
                ${renderStoredMedia(asset)}
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
      if (!id) {
        return;
      }
      selectedAssetId = id;
      renderSelectedAsset();
      renderGallery();
    });
  });
}

function renderSelectedAsset(): void {
  const asset = assets.find((entry) => entry.id === selectedAssetId);
  if (!asset) {
    els.previewFrame.textContent = "Tap a saved item to preview it here.";
    els.metaGrid.innerHTML = "";
    els.downloadButton.disabled = true;
    els.shareButton.disabled = true;
    els.deleteButton.disabled = true;
    return;
  }

  els.previewFrame.innerHTML = renderStoredMedia(asset, true);
  els.metaGrid.innerHTML = [
    metaRow("Name", asset.name),
    metaRow("Kind", asset.kind),
    metaRow("Type", asset.mime),
    metaRow("Size", formatBytes(asset.size)),
    metaRow("Saved", formatDate(asset.createdAt)),
    metaRow("Note", asset.note || "No note"),
  ].join("");
  els.downloadButton.disabled = false;
  els.shareButton.disabled = false;
  els.deleteButton.disabled = false;
}

function renderStagedMedia(asset: StagedAsset): string {
  if (asset.kind === "image") {
    return `<img src="${asset.previewUrl}" alt="${escapeHtml(asset.file.name)}" />`;
  }
  if (asset.kind === "video") {
    return `<video src="${asset.previewUrl}" playsinline muted></video>`;
  }
  return `<div class="list-row">Preview unavailable.</div>`;
}

function renderStoredMedia(asset: StoredAsset, withControls = false): string {
  if (asset.kind === "image") {
    return `<img src="${asset.dataUrl}" alt="${escapeHtml(asset.name)}" />`;
  }
  if (asset.kind === "video") {
    return `<video src="${asset.dataUrl}" ${withControls ? "controls" : ""} playsinline muted></video>`;
  }
  return `<div class="list-row">Preview unavailable.</div>`;
}

function downloadSelected(): void {
  const asset = assets.find((entry) => entry.id === selectedAssetId);
  if (!asset) {
    return;
  }
  const link = document.createElement("a");
  link.href = asset.dataUrl;
  link.download = asset.name;
  link.click();
}

async function shareSelected(): Promise<void> {
  const asset = assets.find((entry) => entry.id === selectedAssetId);
  if (!asset) {
    return;
  }
  if (!navigator.share) {
    els.saveStatus.textContent = "This browser does not support direct share. Use Download instead.";
    return;
  }
  try {
    const file = dataUrlToFile(asset.dataUrl, asset.name, asset.mime);
    await navigator.share({
      title: asset.name,
      text: asset.note || asset.name,
      files: [file],
    });
  } catch {
    els.saveStatus.textContent = "Share was cancelled or unavailable for this file.";
  }
}

function deleteSelected(): void {
  const asset = assets.find((entry) => entry.id === selectedAssetId);
  if (!asset) {
    return;
  }
  assets = assets.filter((entry) => entry.id !== asset.id);
  persistAssets(assets);
  selectedAssetId = assets[0]?.id ?? "";
  els.saveStatus.textContent = `Deleted ${asset.name} from the demo gallery.`;
  render();
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

function classify(mime: string): AssetKind {
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  return "file";
}

function resetStaging(): void {
  stagedAssets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
  stagedAssets = [];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, name: string, mime: string): File {
  const [header, body] = dataUrl.split(",");
  const encoded = header.includes(";base64");
  const raw = encoded ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return new File([bytes], name, { type: mime });
}

function activateTab(tab: string): void {
  document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("is-active"));
  document.querySelectorAll<HTMLElement>(".panel-grid").forEach((panel) => panel.classList.remove("is-active"));
  bySelector<HTMLElement>(`[data-tab="${tab}"]`).classList.add("is-active");
  bySelector<HTMLElement>(`[data-panel="${tab}"]`).classList.add("is-active");
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

window.addEventListener("beforeunload", () => {
  resetStaging();
});
