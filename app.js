import {
  parseSvgToIntermediateTree,
  buildVsdxXmlPackage,
  generateVsdxBlob
} from './svg-to-vsdx.js';
import { SVG_SAMPLES } from './samples.js';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB limit

const state = {
  baseFilename: 'diagram',
  svgText: '',
  hasLoadedFile: false,
  preserveGroups: true,
  mergeTextLines: true,
  zoom: 1,
  parsedTree: null,
  xmlPackage: null
};

// DOM Elements
const fileInput = document.getElementById('svg-file-input');
const navUploadBtn = document.getElementById('nav-upload-btn');
const workspaceSection = document.getElementById('workspace');
const workspaceCard = document.getElementById('workspace-card');

const emptyWorkspaceState = document.getElementById('empty-workspace-state');
const emptyBrowseBtn = document.getElementById('empty-browse-btn');
const loadedWorkspaceState = document.getElementById('loaded-workspace-state');

const replaceFileBtn = document.getElementById('replace-file-btn');
const clearWorkspaceBtn = document.getElementById('clear-workspace-btn');

const downloadBtn = document.getElementById('download-vsdx-btn');
const filenameInput = document.getElementById('output-filename');
const preserveGroupsToggle = document.getElementById('opt-preserve-groups');
const mergeTextToggle = document.getElementById('opt-merge-text');
const errorBanner = document.getElementById('error-banner');
const svgStageContainer = document.getElementById('svg-stage-container');

// Zoom controls
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const zoomLabel = document.getElementById('zoom-label');

const BLOCKED_SVG_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas',
  'applet',
  'meta',
  'link'
]);

/**
 * Sanitize an SVG string into a safe <svg> DOM element (preventing XSS via <script>,
 * <foreignObject>, or inline on* event handlers). Optionally prefixes internal IDs
 * so thumbnail <defs> never collide with the main preview stage.
 */
function createSanitizedSvgNode(svgString, idPrefix = '') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid SVG file.');
  }

  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    throw new Error('No root <svg> element found.');
  }

  const allElements = [svgEl, ...Array.from(svgEl.querySelectorAll('*'))];
  for (const el of allElements) {
    const tag = (el.tagName || el.nodeName || '').toLowerCase();
    if (BLOCKED_SVG_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (tag === 'style' && el.textContent) {
      el.textContent = el.textContent
        .replace(/@import\b[^;]*;?/gi, '')
        .replace(/url\(\s*['"]?\s*(?:https?:|javascript:|data:text\/html)[^)]*\)/gi, 'none');
    }

    for (const attr of Array.from(el.attributes || [])) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();

      if (
        name.startsWith('on') ||
        val.includes('javascript:') ||
        val.includes('vbscript:') ||
        val.includes('data:text/html')
      ) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (idPrefix) {
        if (name === 'id' && attr.value) {
          el.setAttribute('id', `${idPrefix}${attr.value}`);
        } else if (attr.value.includes('url(#')) {
          el.setAttribute(
            attr.name,
            attr.value.replace(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/gi, `url(#${idPrefix}$1)`)
          );
        } else if ((name === 'href' || name === 'xlink:href') && attr.value.startsWith('#')) {
          el.setAttribute(attr.name, `#${idPrefix}${attr.value.slice(1)}`);
        }
      }
    }
  }

  return document.importNode(svgEl, true);
}

// Populate Example Thumbnails in the Separate Examples Section
function renderExampleThumbnails() {
  Object.entries(SVG_SAMPLES).forEach(([key, sample]) => {
    const thumbEl = document.getElementById(`thumb-${key}`);
    if (thumbEl) {
      thumbEl.textContent = '';
      try {
        const safeSvg = createSanitizedSvgNode(sample.svg, `thumb-${key}-`);
        thumbEl.appendChild(safeSvg);
      } catch {
        // Ignore invalid sample
      }
    }
  });
}

function loadDiagramIntoWorkspace({ svgText, baseFilename }) {
  try {
    errorBanner.hidden = true;

    // Validate & parse initial tree
    const parsed = parseSvgToIntermediateTree(svgText, {
      dpi: 96,
      preserveGroups: state.preserveGroups,
      detectConnectors: true,
      mergeTextLines: state.mergeTextLines
    });

    state.svgText = svgText;
    state.baseFilename = baseFilename || 'diagram';
    state.hasLoadedFile = true;
    state.parsedTree = parsed;
    state.xmlPackage = null; // Built lazily on export

    filenameInput.value = state.baseFilename;
    emptyWorkspaceState.hidden = true;
    loadedWorkspaceState.hidden = false;

    updateZoom(1);
    renderSvgPreviewStage(parsed);
  } catch (err) {
    errorBanner.textContent = err.message || 'Could not read SVG file.';
    errorBanner.hidden = false;
  }
}

function resetWorkspaceToBlank() {
  state.svgText = '';
  state.hasLoadedFile = false;
  state.parsedTree = null;
  state.xmlPackage = null;
  errorBanner.hidden = true;

  loadedWorkspaceState.hidden = true;
  emptyWorkspaceState.hidden = false;
  svgStageContainer.textContent = '';
}

function renderSvgPreviewStage(parsed) {
  const { viewBox } = parsed;
  const widthPct = Math.round(state.zoom * 100);

  const wrapper = document.createElement('div');
  wrapper.className = 'canvas-wrapper';
  wrapper.style.width = `${widthPct}%`;

  const renderLayer = document.createElement('div');
  renderLayer.className = 'svg-render-layer';

  const safeSvg = createSanitizedSvgNode(state.svgText);
  if (!safeSvg.getAttribute('viewBox')) {
    safeSvg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`);
  }
  safeSvg.removeAttribute('width');
  safeSvg.removeAttribute('height');
  safeSvg.style.width = '100%';
  safeSvg.style.height = 'auto';
  safeSvg.style.display = 'block';

  renderLayer.appendChild(safeSvg);
  wrapper.appendChild(renderLayer);

  svgStageContainer.textContent = '';
  svgStageContainer.appendChild(wrapper);
}

function updateZoom(newZoom) {
  state.zoom = Math.min(2.5, Math.max(0.5, Number(newZoom.toFixed(2))));
  const widthPct = Math.round(state.zoom * 100);
  zoomLabel.textContent = `${widthPct}%`;
  const wrapper = svgStageContainer.querySelector('.canvas-wrapper');
  if (wrapper) {
    wrapper.style.width = `${widthPct}%`;
  }
}

zoomInBtn.addEventListener('click', () => updateZoom(state.zoom + 0.2));
zoomOutBtn.addEventListener('click', () => updateZoom(state.zoom - 0.2));
zoomResetBtn.addEventListener('click', () => updateZoom(1));

// Trigger file picker
function openFilePicker() {
  fileInput.value = '';
  fileInput.click();
}

navUploadBtn?.addEventListener('click', openFilePicker);
emptyWorkspaceState?.addEventListener('click', (e) => {
  if (e.target.closest('#empty-browse-btn')) return;
  openFilePicker();
});
emptyWorkspaceState?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openFilePicker();
  }
});
emptyBrowseBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  openFilePicker();
});
replaceFileBtn?.addEventListener('click', openFilePicker);
clearWorkspaceBtn?.addEventListener('click', resetWorkspaceToBlank);

// Example Showcase Cards (in the separate #examples section below)
document.querySelectorAll('[data-sample-card]').forEach((card) => {
  card.addEventListener('click', () => {
    const key = card.dataset.sampleCard;
    const sample = SVG_SAMPLES[key];
    if (!sample) return;

    const baseName = sample.filename.replace(/\.vsdx$/i, '');
    loadDiagramIntoWorkspace({
      svgText: sample.svg,
      baseFilename: baseName
    });

    workspaceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Toggles: Only invalidate cached Visio XML package (no need to rebuild visual SVG DOM)
preserveGroupsToggle.addEventListener('change', (e) => {
  state.preserveGroups = e.target.checked;
  state.xmlPackage = null;
});

mergeTextToggle.addEventListener('change', (e) => {
  state.mergeTextLines = e.target.checked;
  state.xmlPackage = null;
});

// File Upload & Drag-and-Drop with Size & Extension Guards
function handleUploadedSvgFile(file) {
  if (!file) return;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errorBanner.textContent = 'File is too large. Please select an SVG file under 20 MB.';
    errorBanner.hidden = false;
    return;
  }

  const isSvgType =
    file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (!isSvgType) {
    errorBanner.textContent = 'Please upload a valid .svg file.';
    errorBanner.hidden = false;
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const content = String(ev.target?.result || '');
    const baseName = file.name.replace(/\.svg$/i, '').replace(/\.vsdx$/i, '') || 'diagram';

    loadDiagramIntoWorkspace({
      svgText: content,
      baseFilename: baseName
    });
  };
  reader.readAsText(file);
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleUploadedSvgFile(file);
});

workspaceCard.addEventListener('dragover', (e) => {
  e.preventDefault();
  workspaceCard.classList.add('drag-over');
});

workspaceCard.addEventListener('dragleave', (e) => {
  if (!workspaceCard.contains(e.relatedTarget)) {
    workspaceCard.classList.remove('drag-over');
  }
});

workspaceCard.addEventListener('drop', (e) => {
  e.preventDefault();
  workspaceCard.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) handleUploadedSvgFile(file);
});

// Download .vsdx handler (compiles Visio XML package on demand)
downloadBtn.addEventListener('click', async () => {
  if (!state.svgText) return;
  const origMainLabel = downloadBtn.innerHTML;
  try {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="btn-slide-label">Packaging .vsdx…</span>';

    if (!state.xmlPackage) {
      const parsed = parseSvgToIntermediateTree(state.svgText, {
        dpi: 96,
        preserveGroups: state.preserveGroups,
        detectConnectors: true,
        mergeTextLines: state.mergeTextLines
      });
      state.parsedTree = parsed;
      state.xmlPackage = buildVsdxXmlPackage(parsed);
    }

    const blob = await generateVsdxBlob(state.xmlPackage);
    const cleanBase =
      (filenameInput.value.trim() || 'diagram')
        .replace(/\.vsdx$/i, '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') || 'diagram';
    const outName = `${cleanBase}.vsdx`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    downloadBtn.innerHTML = '<span class="btn-slide-label">✓ Downloaded</span>';
    setTimeout(() => {
      downloadBtn.innerHTML = origMainLabel;
      downloadBtn.disabled = false;
    }, 1600);
  } catch (err) {
    errorBanner.textContent = 'Export error: ' + err.message;
    errorBanner.hidden = false;
    downloadBtn.innerHTML = origMainLabel;
    downloadBtn.disabled = false;
  }
});

// Initialize example thumbnails
renderExampleThumbnails();
