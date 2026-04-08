type AssetKind = "image" | "video" | "file";
type SourceKind = "imported";
type TabId = "photos" | "albums" | "import";
type AlbumId = "all" | "favorites" | "videos" | "received" | "notes" | "recent";

type StoredAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  mime: string;
  size: number;
  note: string;
  addedAt: string;
  capturedAt: string | null;
  favorite: boolean;
  source: SourceKind;
  width: number | null;
  height: number | null;
  duration: number | null;
  dataUrl: string;
};

type StagedAsset = {
  id: string;
  file: File;
  kind: AssetKind;
  previewUrl: string;
  width: number | null;
  height: number | null;
  duration: number | null;
};

type AlbumDefinition = {
  id: AlbumId;
  title: string;
  subtitle: string;
  count: number;
  cover: StoredAsset | null;
};

type PersistedUiState = {
  activeTab: TabId;
  activeAlbum: AlbumId;
  focusedAssetId: string | null;
};

const STORAGE_KEY = "cowork-drop-web-assets-v2";
const LEGACY_STORAGE_KEY = "cowork-drop-web-assets";
const NOTE_KEY = "cowork-drop-web-note";
const UI_KEY = "cowork-drop-web-ui";

const els = {
  devicePill: byId("device-pill"),
  countPill: byId("count-pill"),
  albumPill: byId("album-pill"),
  selectionPill: byId("selection-pill"),
  selectionToolbar: byId("selection-toolbar"),
  selectionCopy: byId("selection-copy"),
  selectionDetail: byId("selection-detail"),
  selectToggleButton: byId<HTMLButtonElement>("select-toggle-button"),
  favoriteSelectedButton: byId<HTMLButtonElement>("favorite-selected-button"),
  downloadSelectedButton: byId<HTMLButtonElement>("download-selected-button"),
  shareSelectedButton: byId<HTMLButtonElement>("share-selected-button"),
  deleteSelectedButton: byId<HTMLButtonElement>("delete-selected-button"),
  clearSelectionButton: byId<HTMLButtonElement>("clear-selection-button"),
  allPhotosFilter: byId<HTMLButtonElement>("all-photos-filter"),
  favoritesFilter: byId<HTMLButtonElement>("favorites-filter"),
  videosFilter: byId<HTMLButtonElement>("videos-filter"),
  recentFilter: byId<HTMLButtonElement>("recent-filter"),
  photosSummary: byId("photos-summary"),
  recentSummary: byId("recent-summary"),
  recentStrip: byId("recent-strip"),
  timeline: byId("timeline"),
  previewFrame: byId("preview-frame"),
  metaGrid: byId("meta-grid"),
  viewerOpenButton: byId<HTMLButtonElement>("viewer-open-button"),
  favoriteButton: byId<HTMLButtonElement>("favorite-button"),
  downloadButton: byId<HTMLButtonElement>("download-button"),
  shareButton: byId<HTMLButtonElement>("share-button"),
  deleteButton: byId<HTMLButtonElement>("delete-button"),
  albumGrid: byId("album-grid"),
  albumTitle: byId("album-title"),
  albumSummary: byId("album-summary"),
  albumGridFrame: byId("album-grid-frame"),
  shareNote: byId<HTMLTextAreaElement>("share-note"),
  assetInput: byId<HTMLInputElement>("asset-input"),
  saveButton: byId<HTMLButtonElement>("save-button"),
  clearImportButton: byId<HTMLButtonElement>("clear-import-button"),
  clearLibraryButton: byId<HTMLButtonElement>("clear-library-button"),
  saveStatus: byId("save-status"),
  stagingSummary: byId("staging-summary"),
  stagingGrid: byId("staging-grid"),
  viewerShell: byId("viewer-shell"),
  viewerCloseButton: byId<HTMLButtonElement>("viewer-close-button"),
  viewerName: byId("viewer-name"),
  viewerMeta: byId("viewer-meta"),
  viewerFavoriteButton: byId<HTMLButtonElement>("viewer-favorite-button"),
  viewerShareButton: byId<HTMLButtonElement>("viewer-share-button"),
  viewerDownloadButton: byId<HTMLButtonElement>("viewer-download-button"),
  viewerPrevButton: byId<HTMLButtonElement>("viewer-prev-button"),
  viewerNextButton: byId<HTMLButtonElement>("viewer-next-button"),
  viewerMedia: byId("viewer-media"),
  viewerStrip: byId("viewer-strip"),
  viewerStage: byId("viewer-stage"),
};

const state = {
  assets: loadAssets(),
  stagedAssets: [] as StagedAsset[],
  activeTab: "photos" as TabId,
  activeAlbum: "all" as AlbumId,
  focusedAssetId: null as string | null,
  viewerOpen: false,
  viewerAssetId: null as string | null,
  selectionMode: false,
  selectedIds: new Set<string>(),
  swipeStartX: 0,
};

hydrateUiState();
wireTabs();
wireActions();
normalizeFocusedAsset();
render();

function wireTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab-button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab as TabId));
  });
}

function wireActions(): void {
  els.shareNote.value = localStorage.getItem(NOTE_KEY) ?? "";

  els.assetInput.addEventListener("change", async () => {
    resetStaging();
    const files = Array.from(els.assetInput.files ?? []);
    state.stagedAssets = await Promise.all(files.map((file, index) => createStagedAsset(file, index)));
    els.saveStatus.textContent = state.stagedAssets.length
      ? `${state.stagedAssets.length} file(s) staged for import.`
      : "Choose files to start building the photo library.";
    renderImport();
  });

  els.shareNote.addEventListener("input", () => {
    localStorage.setItem(NOTE_KEY, els.shareNote.value);
  });

  els.saveButton.addEventListener("click", () => void saveImportQueue());
  els.clearImportButton.addEventListener("click", () => clearImportQueue());
  els.clearLibraryButton.addEventListener("click", () => resetLibrary());

  els.selectToggleButton.addEventListener("click", () => toggleSelectionMode());
  els.favoriteSelectedButton.addEventListener("click", () => toggleFavoriteSelected());
  els.downloadSelectedButton.addEventListener("click", () => downloadAssets(getSelectedAssets()));
  els.shareSelectedButton.addEventListener("click", () => void shareAssets(getSelectedAssets()));
  els.deleteSelectedButton.addEventListener("click", () => deleteAssets(getSelectedAssets()));
  els.clearSelectionButton.addEventListener("click", () => clearSelection());

  els.favoriteButton.addEventListener("click", () => toggleFavoriteFocused());
  els.downloadButton.addEventListener("click", () => downloadAssets(getFocusedAssetList()));
  els.shareButton.addEventListener("click", () => void shareAssets(getFocusedAssetList()));
  els.deleteButton.addEventListener("click", () => deleteAssets(getFocusedAssetList()));
  els.viewerOpenButton.addEventListener("click", () => openViewer(state.focusedAssetId));

  els.viewerCloseButton.addEventListener("click", closeViewer);
  els.viewerPrevButton.addEventListener("click", () => stepViewer(-1));
  els.viewerNextButton.addEventListener("click", () => stepViewer(1));
  els.viewerFavoriteButton.addEventListener("click", () => toggleFavoriteViewer());
  els.viewerShareButton.addEventListener("click", () => void shareAssets(getViewerAssetList()));
  els.viewerDownloadButton.addEventListener("click", () => downloadAssets(getViewerAssetList()));

  els.allPhotosFilter.addEventListener("click", () => setAlbum("all", "photos"));
  els.favoritesFilter.addEventListener("click", () => setAlbum("favorites", "photos"));
  els.videosFilter.addEventListener("click", () => setAlbum("videos", "photos"));
  els.recentFilter.addEventListener("click", () => setAlbum("recent", "photos"));

  els.viewerStage.addEventListener("touchstart", (event) => {
    state.swipeStartX = event.changedTouches[0]?.clientX ?? 0;
  });
  els.viewerStage.addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const diff = endX - state.swipeStartX;
    if (Math.abs(diff) >= 40) {
      stepViewer(diff < 0 ? 1 : -1);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!state.viewerOpen) {
      return;
    }
    if (event.key === "Escape") {
      closeViewer();
    } else if (event.key === "ArrowLeft") {
      stepViewer(-1);
    } else if (event.key === "ArrowRight") {
      stepViewer(1);
    }
  });

  window.addEventListener("beforeunload", () => {
    resetStaging();
  });
}

function activateTab(tab: TabId): void {
  state.activeTab = tab;
  document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("is-active"));
  document.querySelectorAll<HTMLElement>(".panel-grid").forEach((panel) => panel.classList.remove("is-active"));
  bySelector<HTMLElement>(`[data-tab="${tab}"]`).classList.add("is-active");
  bySelector<HTMLElement>(`[data-panel="${tab}"]`).classList.add("is-active");
  persistUiState();
}

function setAlbum(album: AlbumId, tab: TabId = state.activeTab): void {
  state.activeAlbum = album;
  activateTab(tab);
  render();
}

async function saveImportQueue(): Promise<void> {
  if (!state.stagedAssets.length && !els.shareNote.value.trim()) {
    els.saveStatus.textContent = "Add files or a note first.";
    return;
  }

  const note = els.shareNote.value.trim();
  const createdAssets = await Promise.all(
    state.stagedAssets.map(async (staged) => ({
      id: createId(),
      name: staged.file.name,
      kind: staged.kind,
      mime: staged.file.type || "application/octet-stream",
      size: staged.file.size,
      note,
      addedAt: new Date().toISOString(),
      capturedAt: null,
      favorite: false,
      source: "imported" as SourceKind,
      width: staged.width,
      height: staged.height,
      duration: staged.duration,
      dataUrl: await fileToDataUrl(staged.file),
    })),
  );

  state.assets = [...createdAssets, ...state.assets].sort(compareAssetsDesc);
  persistAssets();
  localStorage.setItem(NOTE_KEY, els.shareNote.value);
  els.assetInput.value = "";
  resetStaging();
  state.focusedAssetId = createdAssets[0]?.id ?? state.focusedAssetId;
  state.activeAlbum = "recent";
  activateTab("photos");
  els.saveStatus.textContent = createdAssets.length
    ? `Imported ${createdAssets.length} item(s) into the library.`
    : "Saved the import note.";
  render();
}

function clearImportQueue(): void {
  resetStaging();
  els.assetInput.value = "";
  els.saveStatus.textContent = "Import queue cleared.";
  renderImport();
}

function resetLibrary(): void {
  resetStaging();
  state.assets = [];
  state.focusedAssetId = null;
  state.viewerAssetId = null;
  state.viewerOpen = false;
  state.selectedIds.clear();
  state.selectionMode = false;
  persistAssets();
  localStorage.removeItem(NOTE_KEY);
  els.shareNote.value = "";
  els.assetInput.value = "";
  els.saveStatus.textContent = "Library reset.";
  render();
}

function toggleSelectionMode(): void {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) {
    state.selectedIds.clear();
  }
  renderChrome();
  renderPhotos();
  renderAlbums();
}

function clearSelection(): void {
  state.selectedIds.clear();
  state.selectionMode = false;
  renderChrome();
  renderPhotos();
  renderAlbums();
}

function toggleFavoriteSelected(): void {
  const assets = getSelectedAssets();
  if (!assets.length) {
    return;
  }
  const nextValue = !assets.every((asset) => asset.favorite);
  for (const asset of assets) {
    asset.favorite = nextValue;
  }
  persistAssets();
  render();
}

function toggleFavoriteFocused(): void {
  const asset = getFocusedAsset();
  if (!asset) {
    return;
  }
  asset.favorite = !asset.favorite;
  persistAssets();
  render();
}

function toggleFavoriteViewer(): void {
  const asset = getViewerAsset();
  if (!asset) {
    return;
  }
  asset.favorite = !asset.favorite;
  persistAssets();
  render();
}

function deleteAssets(assetsToDelete: StoredAsset[]): void {
  if (!assetsToDelete.length) {
    return;
  }
  const ids = new Set(assetsToDelete.map((asset) => asset.id));
  state.assets = state.assets.filter((asset) => !ids.has(asset.id));
  state.selectedIds.forEach((id) => {
    if (ids.has(id)) {
      state.selectedIds.delete(id);
    }
  });
  if (state.focusedAssetId && ids.has(state.focusedAssetId)) {
    state.focusedAssetId = null;
  }
  if (state.viewerAssetId && ids.has(state.viewerAssetId)) {
    state.viewerAssetId = null;
    state.viewerOpen = false;
  }
  normalizeFocusedAsset();
  persistAssets();
  render();
  els.saveStatus.textContent = `Deleted ${assetsToDelete.length} item(s) from the library.`;
}

function downloadAssets(assetsToDownload: StoredAsset[]): void {
  if (!assetsToDownload.length) {
    return;
  }
  assetsToDownload.forEach((asset, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = asset.dataUrl;
      link.download = asset.name;
      link.click();
    }, index * 120);
  });
}

async function shareAssets(assetsToShare: StoredAsset[]): Promise<void> {
  if (!assetsToShare.length) {
    return;
  }
  if (!navigator.share) {
    els.saveStatus.textContent = "This browser does not support direct share. Use Download instead.";
    return;
  }

  const files = assetsToShare.map((asset) => dataUrlToFile(asset.dataUrl, asset.name, asset.mime));
  const text = assetsToShare.find((asset) => asset.note)?.note ?? assetsToShare[0]?.name ?? "Photo share";
  try {
    if (navigator.canShare?.({ files })) {
      await navigator.share({
        title: assetsToShare.length === 1 ? assetsToShare[0].name : `${assetsToShare.length} items`,
        text,
        files,
      });
    } else {
      await navigator.share({
        title: assetsToShare.length === 1 ? assetsToShare[0].name : `${assetsToShare.length} items`,
        text,
      });
    }
  } catch {
    els.saveStatus.textContent = "Share was cancelled or unavailable.";
  }
}

function openViewer(assetId: string | null): void {
  if (!assetId) {
    return;
  }
  state.viewerAssetId = assetId;
  state.viewerOpen = true;
  renderViewer();
}

function closeViewer(): void {
  state.viewerOpen = false;
  renderViewer();
}

function stepViewer(direction: -1 | 1): void {
  const assets = getVisibleAssets();
  if (!assets.length) {
    return;
  }
  const currentId = state.viewerAssetId ?? state.focusedAssetId;
  const index = Math.max(0, assets.findIndex((asset) => asset.id === currentId));
  const nextIndex = (index + direction + assets.length) % assets.length;
  state.viewerAssetId = assets[nextIndex]?.id ?? currentId;
  state.focusedAssetId = state.viewerAssetId;
  persistUiState();
  renderViewer();
  renderPreview();
}

function render(): void {
  normalizeFocusedAsset();
  renderChrome();
  renderPhotos();
  renderAlbums();
  renderImport();
  renderPreview();
  renderViewer();
}

function renderChrome(): void {
  const album = getAlbumDefinitions().find((entry) => entry.id === state.activeAlbum);
  els.devicePill.textContent = mobileLabel();
  els.countPill.textContent = `${state.assets.length} items`;
  els.albumPill.textContent = album?.title ?? "All Photos";
  els.selectionPill.textContent = state.selectionMode ? `${state.selectedIds.size} selected` : "Selection off";
  els.selectionCopy.textContent = state.selectionMode ? "Selection mode on" : "Selection mode off";
  els.selectionDetail.textContent = state.selectionMode
    ? `${state.selectedIds.size} item(s) ready for batch actions.`
    : "Tap Select to batch-share, batch-download, or remove multiple items.";
  els.selectToggleButton.textContent = state.selectionMode ? "Done" : "Select";

  const hasSelection = state.selectedIds.size > 0;
  els.favoriteSelectedButton.disabled = !hasSelection;
  els.downloadSelectedButton.disabled = !hasSelection;
  els.shareSelectedButton.disabled = !hasSelection;
  els.deleteSelectedButton.disabled = !hasSelection;
  els.clearSelectionButton.disabled = !hasSelection;
}

function renderPhotos(): void {
  const visibleAssets = getVisibleAssets();
  els.photosSummary.textContent = visibleAssets.length
    ? `${visibleAssets.length} item(s) in ${albumTitle(state.activeAlbum)}.`
    : `No items in ${albumTitle(state.activeAlbum)} yet.`;

  const recentAssets = state.assets.slice(0, 8);
  els.recentSummary.textContent = recentAssets.length ? `${recentAssets.length} newest item(s)` : "Nothing imported yet.";
  els.recentStrip.innerHTML = recentAssets.length
    ? recentAssets.map((asset) => renderAssetCard(asset)).join("")
    : `<article class="empty-state">Import photos or videos to populate the recent strip.</article>`;

  const sections = groupAssetsByDay(visibleAssets);
  els.timeline.innerHTML = sections.length
    ? sections
        .map(
          (section) => `
            <section class="timeline-section">
              <div class="section-head">
                <h3>${escapeHtml(section.label)}</h3>
                <span>${section.assets.length} item(s)</span>
              </div>
              <div class="timeline-grid">
                ${section.assets.map((asset) => renderAssetCard(asset)).join("")}
              </div>
            </section>`,
        )
        .join("")
    : `<article class="empty-state">No photos in this view yet.</article>`;

  wireAssetCards(els.recentStrip);
  wireAssetCards(els.timeline);
}

function renderAlbums(): void {
  const albums = getAlbumDefinitions();
  els.albumGrid.innerHTML = albums
    .map(
      (album) => `
        <button class="album-card ${album.id === state.activeAlbum ? "is-active" : ""}" data-album-id="${album.id}">
          <strong>${escapeHtml(album.title)}</strong>
          <span>${escapeHtml(album.subtitle)}</span>
          <span>${album.count} item(s)</span>
        </button>`,
    )
    .join("");

  els.albumGrid.querySelectorAll<HTMLElement>("[data-album-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const albumId = button.dataset.albumId as AlbumId | undefined;
      if (!albumId) {
        return;
      }
      state.activeAlbum = albumId;
      persistUiState();
      renderChrome();
      renderPhotos();
      renderAlbums();
    });
  });

  const albumAssets = getVisibleAssets();
  els.albumTitle.textContent = albumTitle(state.activeAlbum);
  els.albumSummary.textContent = albumAssets.length
    ? `${albumAssets.length} item(s) inside ${albumTitle(state.activeAlbum)}.`
    : `No items inside ${albumTitle(state.activeAlbum)} yet.`;
  els.albumGridFrame.innerHTML = albumAssets.length
    ? albumAssets.map((asset) => renderAssetCard(asset)).join("")
    : `<article class="empty-state">No assets in this album yet.</article>`;
  wireAssetCards(els.albumGridFrame);
}

function renderImport(): void {
  els.stagingSummary.textContent = state.stagedAssets.length
    ? `${state.stagedAssets.length} file(s) ready to import.`
    : "No staged files yet.";
  els.stagingGrid.innerHTML = state.stagedAssets.length
    ? state.stagedAssets.map((asset) => renderStagedCard(asset)).join("")
    : `<article class="empty-state">Choose files above to preview them before saving.</article>`;

  els.stagingGrid.querySelectorAll<HTMLElement>("[data-stage-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.stageRemove;
      if (!id) {
        return;
      }
      const asset = state.stagedAssets.find((entry) => entry.id === id);
      if (asset) {
        URL.revokeObjectURL(asset.previewUrl);
      }
      state.stagedAssets = state.stagedAssets.filter((entry) => entry.id !== id);
      renderImport();
    });
  });
}

function renderPreview(): void {
  const asset = getFocusedAsset();
  if (!asset) {
    els.previewFrame.textContent = "Tap an item to preview it here.";
    els.metaGrid.innerHTML = "";
    els.viewerOpenButton.disabled = true;
    els.favoriteButton.disabled = true;
    els.downloadButton.disabled = true;
    els.shareButton.disabled = true;
    els.deleteButton.disabled = true;
    return;
  }

  els.previewFrame.innerHTML = renderStoredMedia(asset, true);
  els.metaGrid.innerHTML = [
    metaRow("Name", asset.name),
    metaRow("Kind", asset.kind),
    metaRow("Size", formatBytes(asset.size)),
    metaRow("Added", formatDate(asset.addedAt)),
    metaRow("Dimensions", formatDimensions(asset.width, asset.height)),
    metaRow("Duration", asset.duration ? formatDuration(asset.duration) : "Still image"),
    metaRow("Favorite", asset.favorite ? "Yes" : "No"),
    metaRow("Note", asset.note || "No note"),
  ].join("");
  els.viewerOpenButton.disabled = false;
  els.favoriteButton.disabled = false;
  els.downloadButton.disabled = false;
  els.shareButton.disabled = false;
  els.deleteButton.disabled = false;
  els.favoriteButton.textContent = asset.favorite ? "Unfavorite" : "Favorite";
}

function renderViewer(): void {
  const assets = getVisibleAssets();
  if (!state.viewerOpen || !assets.length) {
    els.viewerShell.classList.add("is-hidden");
    return;
  }

  const asset = assets.find((entry) => entry.id === state.viewerAssetId) ?? assets[0];
  state.viewerAssetId = asset.id;
  els.viewerShell.classList.remove("is-hidden");
  els.viewerName.textContent = asset.name;
  els.viewerMeta.textContent = `${assets.findIndex((entry) => entry.id === asset.id) + 1} / ${assets.length}`;
  els.viewerFavoriteButton.textContent = asset.favorite ? "Unfavorite" : "Favorite";
  els.viewerMedia.innerHTML = renderStoredMedia(asset, true, true);
  els.viewerStrip.innerHTML = assets
    .slice(0, 18)
    .map(
      (entry) => `
        <button class="viewer-thumb ${entry.id === asset.id ? "is-active" : ""}" data-viewer-id="${entry.id}">
          ${renderStoredMedia(entry, false)}
        </button>`,
    )
    .join("");
  els.viewerStrip.querySelectorAll<HTMLElement>("[data-viewer-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.viewerId;
      if (!id) {
        return;
      }
      state.viewerAssetId = id;
      state.focusedAssetId = id;
      persistUiState();
      renderViewer();
      renderPreview();
    });
  });
}

function wireAssetCards(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>("[data-asset-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.assetId;
      if (!id) {
        return;
      }
      if (state.selectionMode) {
        if (state.selectedIds.has(id)) {
          state.selectedIds.delete(id);
        } else {
          state.selectedIds.add(id);
        }
        renderChrome();
        renderPhotos();
        renderAlbums();
        return;
      }
      state.focusedAssetId = id;
      persistUiState();
      renderPreview();
      renderPhotos();
      renderAlbums();
      if (window.matchMedia("(max-width: 720px)").matches) {
        openViewer(id);
      }
    });
  });

  container.querySelectorAll<HTMLElement>("[data-favorite-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.favoriteId;
      const asset = state.assets.find((entry) => entry.id === id);
      if (!asset) {
        return;
      }
      asset.favorite = !asset.favorite;
      persistAssets();
      render();
    });
  });
}

function renderAssetCard(asset: StoredAsset): string {
  const selected = state.selectedIds.has(asset.id);
  return `
    <article class="asset-card ${selected ? "is-selected" : ""}">
      <button class="asset-favorite" data-favorite-id="${asset.id}">${asset.favorite ? "★" : "☆"}</button>
      <button class="media-button" data-asset-id="${asset.id}">
        ${renderStoredMedia(asset, false)}
        <div class="asset-meta-block">
          <span class="asset-name">${escapeHtml(asset.name)}</span>
          <span class="asset-subcopy">
            ${formatBytes(asset.size)} • ${escapeHtml(asset.kind)}${asset.duration ? ` • ${formatDuration(asset.duration)}` : ""}
          </span>
          ${asset.note ? `<span class="favorite-chip">${escapeHtml(asset.note)}</span>` : ""}
        </div>
      </button>
    </article>`;
}

function renderStagedCard(asset: StagedAsset): string {
  return `
    <article class="asset-card">
      <button class="asset-remove" data-stage-remove="${asset.id}">Remove</button>
      ${renderStagedMedia(asset)}
      <div class="asset-meta-block">
        <span class="asset-name">${escapeHtml(asset.file.name)}</span>
        <span class="asset-subcopy">
          ${formatBytes(asset.file.size)} • ${escapeHtml(asset.kind)}${asset.duration ? ` • ${formatDuration(asset.duration)}` : ""}
        </span>
        <span class="asset-subcopy">${formatDimensions(asset.width, asset.height)}</span>
      </div>
    </article>`;
}

function renderStoredMedia(asset: StoredAsset, withControls: boolean, fullHeight = false): string {
  if (asset.kind === "image") {
    return `<img class="asset-image" src="${asset.dataUrl}" alt="${escapeHtml(asset.name)}" ${fullHeight ? 'draggable="false"' : ""} />`;
  }
  if (asset.kind === "video") {
    return `<video class="asset-video" src="${asset.dataUrl}" ${withControls ? "controls" : ""} playsinline muted preload="metadata"></video>`;
  }
  return `<div class="empty-state">Preview unavailable.</div>`;
}

function renderStagedMedia(asset: StagedAsset): string {
  if (asset.kind === "image") {
    return `<img class="asset-image" src="${asset.previewUrl}" alt="${escapeHtml(asset.file.name)}" />`;
  }
  if (asset.kind === "video") {
    return `<video class="asset-video" src="${asset.previewUrl}" playsinline muted preload="metadata"></video>`;
  }
  return `<div class="empty-state">Preview unavailable.</div>`;
}

function getVisibleAssets(): StoredAsset[] {
  switch (state.activeAlbum) {
    case "favorites":
      return state.assets.filter((asset) => asset.favorite);
    case "videos":
      return state.assets.filter((asset) => asset.kind === "video");
    case "received":
      return state.assets.filter((asset) => asset.source === "imported");
    case "notes":
      return state.assets.filter((asset) => asset.note.trim().length > 0);
    case "recent":
      return state.assets.slice(0, 24);
    default:
      return [...state.assets];
  }
}

function getAlbumDefinitions(): AlbumDefinition[] {
  return [
    albumFrom("all", "All Photos", "Everything in the library", state.assets),
    albumFrom("favorites", "Favorites", "Starred items you want fast", state.assets.filter((asset) => asset.favorite)),
    albumFrom("videos", "Videos", "Motion clips and live captures", state.assets.filter((asset) => asset.kind === "video")),
    albumFrom("received", "Received", "Everything imported into this app", state.assets.filter((asset) => asset.source === "imported")),
    albumFrom("notes", "Notes Attached", "Imports that carried a note", state.assets.filter((asset) => asset.note.trim().length > 0)),
    albumFrom("recent", "Recently Added", "Newest photos and videos first", state.assets.slice(0, 24)),
  ];
}

function albumFrom(id: AlbumId, title: string, subtitle: string, assets: StoredAsset[]): AlbumDefinition {
  return {
    id,
    title,
    subtitle,
    count: assets.length,
    cover: assets[0] ?? null,
  };
}

function groupAssetsByDay(assets: StoredAsset[]): Array<{ label: string; assets: StoredAsset[] }> {
  const groups = new Map<string, { label: string; assets: StoredAsset[] }>();
  for (const asset of assets) {
    const date = new Date(asset.addedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!groups.has(key)) {
      groups.set(key, { label: dateLabel(date), assets: [] });
    }
    groups.get(key)?.assets.push(asset);
  }
  return Array.from(groups.values());
}

function getSelectedAssets(): StoredAsset[] {
  return state.assets.filter((asset) => state.selectedIds.has(asset.id));
}

function getFocusedAsset(): StoredAsset | null {
  return state.assets.find((asset) => asset.id === state.focusedAssetId) ?? null;
}

function getViewerAsset(): StoredAsset | null {
  return state.assets.find((asset) => asset.id === state.viewerAssetId) ?? null;
}

function getFocusedAssetList(): StoredAsset[] {
  const asset = getFocusedAsset();
  return asset ? [asset] : [];
}

function getViewerAssetList(): StoredAsset[] {
  const asset = getViewerAsset();
  return asset ? [asset] : [];
}

function normalizeFocusedAsset(): void {
  if (state.focusedAssetId && state.assets.some((asset) => asset.id === state.focusedAssetId)) {
    return;
  }
  state.focusedAssetId = state.assets[0]?.id ?? null;
  persistUiState();
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function createStagedAsset(file: File, index: number): Promise<StagedAsset> {
  const previewUrl = URL.createObjectURL(file);
  const kind = classify(file.type);
  const meta = await readMediaMeta(previewUrl, kind);
  return {
    id: `stage-${Date.now()}-${index}`,
    file,
    kind,
    previewUrl,
    width: meta.width,
    height: meta.height,
    duration: meta.duration,
  };
}

async function readMediaMeta(
  url: string,
  kind: AssetKind,
): Promise<{ width: number | null; height: number | null; duration: number | null }> {
  if (kind === "image") {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, duration: null });
      image.onerror = () => resolve({ width: null, height: null, duration: null });
      image.src = url;
    });
  }
  if (kind === "video") {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          duration: Number.isFinite(video.duration) ? video.duration : null,
        });
      video.onerror = () => resolve({ width: null, height: null, duration: null });
      video.src = url;
    });
  }
  return { width: null, height: null, duration: null };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function persistAssets(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.assets));
}

function loadAssets(): StoredAsset[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    const migrated = parsed.map(migrateAsset).sort(compareAssetsDesc);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return migrated;
  } catch {
    return [];
  }
}

function migrateAsset(input: Record<string, unknown>): StoredAsset {
  return {
    id: String(input.id ?? createId()),
    name: String(input.name ?? "Untitled"),
    kind: normalizeKind(input.kind),
    mime: String(input.mime ?? "application/octet-stream"),
    size: Number(input.size ?? 0),
    note: String(input.note ?? ""),
    addedAt: String(input.addedAt ?? input.createdAt ?? new Date().toISOString()),
    capturedAt: input.capturedAt ? String(input.capturedAt) : null,
    favorite: Boolean(input.favorite ?? false),
    source: "imported",
    width: numberOrNull(input.width),
    height: numberOrNull(input.height),
    duration: numberOrNull(input.duration),
    dataUrl: String(input.dataUrl ?? ""),
  };
}

function hydrateUiState(): void {
  const raw = localStorage.getItem(UI_KEY);
  if (!raw) {
    state.activeTab = "photos";
    state.activeAlbum = "all";
    activateTab("photos");
    return;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedUiState;
    state.activeTab = parsed.activeTab ?? "photos";
    state.activeAlbum = parsed.activeAlbum ?? "all";
    state.focusedAssetId = parsed.focusedAssetId ?? null;
  } catch {
    state.activeTab = "photos";
    state.activeAlbum = "all";
  }
  activateTab(state.activeTab);
}

function persistUiState(): void {
  const payload: PersistedUiState = {
    activeTab: state.activeTab,
    activeAlbum: state.activeAlbum,
    focusedAssetId: state.focusedAssetId,
  };
  localStorage.setItem(UI_KEY, JSON.stringify(payload));
}

function resetStaging(): void {
  for (const asset of state.stagedAssets) {
    URL.revokeObjectURL(asset.previewUrl);
  }
  state.stagedAssets = [];
}

function dataUrlToFile(dataUrl: string, name: string, mime: string): File {
  const [header, body] = dataUrl.split(",");
  const raw = header.includes(";base64") ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return new File([bytes], name, { type: mime });
}

function normalizeKind(value: unknown): AssetKind {
  if (value === "image" || value === "video" || value === "file") {
    return value;
  }
  return "file";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function compareAssetsDesc(left: StoredAsset, right: StoredAsset): number {
  return new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime();
}

function albumTitle(album: AlbumId): string {
  return getAlbumDefinitions().find((entry) => entry.id === album)?.title ?? "All Photos";
}

function dateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, yesterday)) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function mobileLabel(): string {
  const ua = navigator.userAgent;
  if (ua.includes("iPhone")) {
    return "iPhone photo app";
  }
  if (ua.includes("Android")) {
    return "Android photo app";
  }
  if (ua.includes("iPad")) {
    return "iPad photo app";
  }
  return "Browser photo app";
}

function formatBytes(size: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
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

function formatDuration(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDimensions(width: number | null, height: number | null): string {
  if (!width || !height) {
    return "Unknown size";
  }
  return `${width} × ${height}`;
}

function metaRow(label: string, value: string): string {
  return `<article class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
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
