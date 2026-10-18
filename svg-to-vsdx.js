/**
 * SVG to Visio (.vsdx) Transpiler & Open Packaging Conventions (OPC) Builder
 *
 * Converts SVG DOM hierarchy (<g>, <path>, <rect>, <circle>, <ellipse>,
 * <line>, <polyline>, <polygon>, <text>) into native Visio 2013+ ShapeSheet XML
 * while maintaining nested group structure, styling, smart multi-line text boxes,
 * and 1D connectors.
 */

import {
  multiplyMatrix,
  applyMatrixToPoint,
  parseTransformAttribute,
  shapeElementToPathCommands,
  transformPathCommands,
  computePathBoundingBox
} from './svg-path-parser.js';

const NAMED_COLORS = {
  black: '#000000',
  white: '#ffffff',
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  cyan: '#06b6d4',
  magenta: '#d946ef',
  gray: '#6b7280',
  grey: '#6b7280',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
  indigo: '#6366f1',
  navy: '#1e3a8a',
  silver: '#cbd5e1',
  maroon: '#7f1d1d',
  olive: '#84cc16',
  lime: '#84cc16',
  aqua: '#06b6d4',
  fuchsia: '#d946ef'
};

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmt(num) {
  if (!Number.isFinite(num)) return '0';
  return Number(num.toFixed(6)).toString();
}

/**
 * Normalize any CSS color (#rgb, #rrggbb, rgb(), rgba(), named, url(#grad))
 */
function parseSvgColor(rawVal, defsMap, defaultHex = '#000000') {
  if (!rawVal) return { hex: defaultHex, opacity: 1, isNone: false };
  const val = rawVal.trim();
  if (val === 'none' || val === 'transparent') {
    return { hex: '#000000', opacity: 0, isNone: true };
  }

  const urlMatch = val.match(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/i);
  if (urlMatch) {
    const gradId = urlMatch[1];
    const grad = defsMap.get(gradId);
    if (grad && grad.stops.length > 0) {
      const first = grad.stops[0];
      const last = grad.stops[grad.stops.length - 1];
      return {
        hex: first.hex,
        opacity: first.opacity,
        isNone: false,
        gradientEndHex: last.hex
      };
    }
    return { hex: '#6366f1', opacity: 1, isNone: false };
  }

  const lower = val.toLowerCase();
  if (NAMED_COLORS[lower]) {
    return { hex: NAMED_COLORS[lower], opacity: 1, isNone: false };
  }

  if (lower.startsWith('#')) {
    if (lower.length === 4) {
      const r = lower[1];
      const g = lower[2];
      const b = lower[3];
      return { hex: `#${r}${r}${g}${g}${b}${b}`, opacity: 1, isNone: false };
    }
    if (lower.length >= 7) {
      return { hex: lower.slice(0, 7), opacity: 1, isNone: false };
    }
  }

  const rgbMatch = lower.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Math.round(Number(rgbMatch[1]))));
    const g = Math.min(255, Math.max(0, Math.round(Number(rgbMatch[2]))));
    const b = Math.min(255, Math.max(0, Math.round(Number(rgbMatch[3]))));
    const a = rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, Number(rgbMatch[4]))) : 1;
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return {
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      opacity: a,
      isNone: a === 0
    };
  }

  return { hex: defaultHex, opacity: 1, isNone: false };
}

/**
 * Extract <linearGradient> and <radialGradient> stops from <defs>
 */
function extractDefsGradients(svgEl) {
  const defsMap = new Map();
  const grads = svgEl.querySelectorAll('linearGradient, radialGradient');
  grads.forEach((g) => {
    const id = g.getAttribute('id');
    if (!id) return;
    const stops = [];
    g.querySelectorAll('stop').forEach((stop) => {
      let stopColor = stop.getAttribute('stop-color') || '';
      let stopOpacity = parseFloat(stop.getAttribute('stop-opacity') ?? '1');
      const styleAttr = stop.getAttribute('style') || '';
      styleAttr.split(';').forEach((decl) => {
        const [k, v] = decl.split(':').map((s) => s && s.trim());
        if (k === 'stop-color' && v) stopColor = v;
        if (k === 'stop-opacity' && v) stopOpacity = parseFloat(v);
      });
      const parsed = parseSvgColor(stopColor, new Map(), '#6366f1');
      stops.push({
        hex: parsed.hex,
        opacity: parsed.opacity * (Number.isFinite(stopOpacity) ? stopOpacity : 1)
      });
    });

    const href = (g.getAttribute('href') || g.getAttribute('xlink:href') || '').replace(/^#/, '');
    defsMap.set(id, { id, href, stops });
  });

  for (const [, grad] of defsMap) {
    if (grad.stops.length === 0 && grad.href && defsMap.has(grad.href)) {
      grad.stops = defsMap.get(grad.href).stops;
    }
  }
  return defsMap;
}

/**
 * Read effective style attribute / presentation attribute / inherited style for an SVG element
 */
function resolveElementStyle(el, inheritedStyle, defsMap) {
  const inlineMap = {};
  const styleAttr = el.getAttribute('style') || '';
  styleAttr.split(';').forEach((pair) => {
    const idx = pair.indexOf(':');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim().toLowerCase();
      const v = pair.slice(idx + 1).trim();
      inlineMap[k] = v;
    }
  });

  const getProp = (name, fallback) => {
    if (inlineMap[name] !== undefined) return inlineMap[name];
    const attr = el.getAttribute(name);
    if (attr !== null && attr !== '') return attr;
    if (inheritedStyle[name] !== undefined) return inheritedStyle[name];
    return fallback;
  };

  const tag = el.tagName.toLowerCase();
  const defaultFill = tag === 'line' || tag === 'polyline' ? 'none' : '#000000';

  const rawFill = getProp('fill', defaultFill);
  const rawStroke = getProp('stroke', 'none');
  const rawStrokeWidth = parseFloat(getProp('stroke-width', '1')) || 1;
  const rawOpacity = parseFloat(getProp('opacity', '1'));
  const rawFillOpacity = parseFloat(getProp('fill-opacity', '1'));
  const rawStrokeOpacity = parseFloat(getProp('stroke-opacity', '1'));
  const strokeDasharray = getProp('stroke-dasharray', 'none');
  const strokeLinecap = getProp('stroke-linecap', 'butt');
  const markerEnd = getProp('marker-end', 'none');
  const markerStart = getProp('marker-start', 'none');
  const fontSize = getProp('font-size', '14');
  const fontFamily = getProp('font-family', 'Segoe UI, Arial, sans-serif');
  const fontWeight = getProp('font-weight', 'normal');
  const textAnchor = getProp('text-anchor', 'start');

  const fillParsed = parseSvgColor(rawFill, defsMap, defaultFill === 'none' ? '#000000' : '#1e293b');
  if (rawFill === 'none') fillParsed.isNone = true;

  const strokeParsed = parseSvgColor(rawStroke, defsMap, '#000000');
  if (rawStroke === 'none') strokeParsed.isNone = true;

  const opacity = Number.isFinite(rawOpacity) ? rawOpacity : 1;
  const fillOpacity = Math.min(
    1,
    Math.max(0, fillParsed.opacity * (Number.isFinite(rawFillOpacity) ? rawFillOpacity : 1) * opacity)
  );
  const strokeOpacity = Math.min(
    1,
    Math.max(0, strokeParsed.opacity * (Number.isFinite(rawStrokeOpacity) ? rawStrokeOpacity : 1) * opacity)
  );

  return {
    raw: {
      fill: rawFill,
      stroke: rawStroke,
      'stroke-width': String(rawStrokeWidth),
      'fill-opacity': String(rawFillOpacity),
      'stroke-opacity': String(rawStrokeOpacity),
      'stroke-dasharray': strokeDasharray,
      'stroke-linecap': strokeLinecap,
      'font-size': fontSize,
      'font-family': fontFamily,
      'font-weight': fontWeight,
      'text-anchor': textAnchor
    },
    fillHex: fillParsed.hex,
    fillGradientEndHex: fillParsed.gradientEndHex || null,
    noFill: fillParsed.isNone || fillOpacity === 0,
    fillTrans: Number((1 - fillOpacity).toFixed(4)),
    strokeHex: strokeParsed.hex,
    noStroke: strokeParsed.isNone || strokeOpacity === 0 || rawStrokeWidth <= 0,
    strokeTrans: Number((1 - strokeOpacity).toFixed(4)),
    strokeWidthPx: rawStrokeWidth,
    isDashed: strokeDasharray && strokeDasharray !== 'none' && strokeDasharray !== '0',
    lineCap: strokeLinecap === 'round' ? '1' : strokeLinecap === 'square' ? '2' : '0',
    hasEndArrow:
      (markerEnd && markerEnd !== 'none') ||
      el.getAttribute('data-arrow') === 'end' ||
      el.getAttribute('data-arrow') === 'both',
    hasStartArrow:
      (markerStart && markerStart !== 'none') ||
      el.getAttribute('data-arrow') === 'start' ||
      el.getAttribute('data-arrow') === 'both',
    fontSizePx: parseFloat(fontSize) || 14,
    fontFamily: String(fontFamily).split(',')[0].replace(/['"]/g, '').trim() || 'Segoe UI',
    isBold: fontWeight === 'bold' || Number(fontWeight) >= 600,
    textAnchor
  };
}

/**
 * Extract one or more lines from a <text> element (handling <tspan> line breaks via y or dy).
 */
function extractTextLinesFromElement(el, ctm, style, defsMap) {
  const scaleFactor = Math.hypot(ctm[0], ctm[1]);
  const baseX = parseFloat(el.getAttribute('x') || '0');
  const baseY = parseFloat(el.getAttribute('y') || '0');

  const tspans = Array.from(el.querySelectorAll('tspan'));
  const rawLines = [];

  if (tspans.length === 0) {
    const textContent = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!textContent) return [];
    const pt = applyMatrixToPoint(ctm, baseX, baseY);
    const fontSizePx = style.fontSizePx * scaleFactor;
    rawLines.push({
      text: textContent,
      anchorX: pt.x,
      baselineY: pt.y,
      fontSizePx,
      fontSizePt: Number(((fontSizePx * 72) / 96).toFixed(2)),
      textColorHex: style.noFill ? '#0f172a' : style.fillHex,
      isBold: style.isBold,
      fontFamily: style.fontFamily,
      textAnchor: style.textAnchor
    });
  } else {
    let curX = baseX;
    let curY = baseY;

    tspans.forEach((ts, idx) => {
      const content = (ts.textContent || '').replace(/\s+/g, ' ').trim();
      if (!content) return;

      const tsStyle = resolveElementStyle(ts, style.raw, defsMap);
      const hasExplicitX = ts.getAttribute('x') !== null;
      const hasExplicitY = ts.getAttribute('y') !== null;
      const dyAttr = ts.getAttribute('dy');
      const dxAttr = ts.getAttribute('dx');

      let dy = 0;
      if (dyAttr) {
        if (dyAttr.endsWith('em')) {
          dy = parseFloat(dyAttr) * tsStyle.fontSizePx;
        } else {
          dy = parseFloat(dyAttr) || 0;
        }
      }

      let dx = 0;
      if (dxAttr) {
        dx = parseFloat(dxAttr) || 0;
      }

      const nextX = hasExplicitX ? parseFloat(ts.getAttribute('x')) : curX + dx;
      const nextY = hasExplicitY ? parseFloat(ts.getAttribute('y')) : curY + dy;

      const isNewLine =
        idx === 0 ||
        Math.abs(nextY - curY) > 1.5;

      curX = nextX;
      curY = nextY;

      const pt = applyMatrixToPoint(ctm, curX, curY);
      const fontSizePx = tsStyle.fontSizePx * scaleFactor;

      if (!isNewLine && rawLines.length > 0) {
        // Inline continuation on the same baseline
        rawLines[rawLines.length - 1].text += ' ' + content;
      } else {
        rawLines.push({
          text: content,
          anchorX: pt.x,
          baselineY: pt.y,
          fontSizePx,
          fontSizePt: Number(((fontSizePx * 72) / 96).toFixed(2)),
          textColorHex: tsStyle.noFill ? '#0f172a' : tsStyle.fillHex,
          isBold: tsStyle.isBold,
          fontFamily: tsStyle.fontFamily,
          textAnchor: tsStyle.textAnchor
        });
      }
    });
  }

  return rawLines;
}

/**
 * Compute bounding box for a multi-line text node from its constituent lines.
 * Adds horizontal breathing room so Visio does not wrap lines unintentionally.
 */
function computeTextLinesBBox(lines) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const line of lines) {
    // Generous character width factor (0.68) so Visio never auto-wraps single lines
    const estWidth = Math.max(line.text.length * line.fontSizePx * 0.68 + 8, line.fontSizePx * 1.8);
    const estHeight = line.fontSizePx * 1.32;

    let lineMinX = line.anchorX;
    if (line.textAnchor === 'middle') lineMinX = line.anchorX - estWidth / 2;
    else if (line.textAnchor === 'end') lineMinX = line.anchorX - estWidth;

    const lineMaxX = lineMinX + estWidth;
    const lineMinY = line.baselineY - line.fontSizePx * 0.88;
    const lineMaxY = lineMinY + estHeight;

    if (lineMinX < minX) minX = lineMinX;
    if (lineMinY < minY) minY = lineMinY;
    if (lineMaxX > maxX) maxX = lineMaxX;
    if (lineMaxY > maxY) maxY = lineMaxY;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1)
  };
}

/**
 * Smart Merger: Combines vertically stacked sibling <text> nodes that share alignment
 * and belong to the same box/group into a single unified multi-line Visio text box.
 */
function mergeStackedTextNodes(nodes) {
  const nonTextNodes = [];
  const textNodes = [];

  for (const n of nodes) {
    if (n.type === 'text') {
      textNodes.push(n);
    } else {
      nonTextNodes.push(n);
    }
  }

  if (textNodes.length <= 1) return nodes;

  // Sort text nodes top-to-bottom by top baselineY
  textNodes.sort((a, b) => a.lines[0].baselineY - b.lines[0].baselineY);

  // Helper: Find which enclosing 2D shape (e.g. flowchart <rect>) contains a point (x, y)
  const findEnclosingShapeId = (x, y) => {
    for (let i = nonTextNodes.length - 1; i >= 0; i--) {
      const s = nonTextNodes[i];
      if (s.type !== 'shape') continue;
      if (
        x >= s.bbox.minX - 4 &&
        x <= s.bbox.maxX + 4 &&
        y >= s.bbox.minY - 4 &&
        y <= s.bbox.maxY + 4
      ) {
        return s.id;
      }
    }
    return null;
  };

  const mergedClusters = [];

  for (const candidate of textNodes) {
    const candFirstLine = candidate.lines[0];
    const candCenterY = (candidate.bbox.minY + candidate.bbox.maxY) / 2;
    const candCenterX = (candidate.bbox.minX + candidate.bbox.maxX) / 2;
    const candBoxId = findEnclosingShapeId(candCenterX, candCenterY);

    let mergedIntoExisting = false;

    for (const cluster of mergedClusters) {
      const lastLine = cluster.lines[cluster.lines.length - 1];
      const maxFs = Math.max(lastLine.fontSizePx, candFirstLine.fontSizePx);

      // 1. Must have compatible alignment and font family
      const sameAnchor = lastLine.textAnchor === candFirstLine.textAnchor;
      const sameFontFamily =
        lastLine.fontFamily.toLowerCase() === candFirstLine.fontFamily.toLowerCase();

      // 2. Check horizontal alignment (same anchorX within tolerance)
      const anchorXDelta = Math.abs(lastLine.anchorX - candFirstLine.anchorX);
      const horizontallyAligned = anchorXDelta <= Math.max(maxFs * 0.9, 10);

      // 3. Check vertical line-break spacing (consecutive lines stacked vertically)
      const baselineDelta = candFirstLine.baselineY - lastLine.baselineY;
      const verticallyStacked = baselineDelta >= maxFs * 0.65 && baselineDelta <= maxFs * 2.65;

      // 4. Must reside in the same enclosing container shape (e.g. same flowchart box)
      const sameContainerBox = cluster.enclosingBoxId === candBoxId;

      if (
        sameAnchor &&
        sameFontFamily &&
        horizontallyAligned &&
        verticallyStacked &&
        sameContainerBox
      ) {
        cluster.lines.push(...candidate.lines);
        cluster.text = cluster.lines.map((l) => l.text).join('\n');
        cluster.bbox = computeTextLinesBBox(cluster.lines);
        mergedIntoExisting = true;
        break;
      }
    }

    if (!mergedIntoExisting) {
      mergedClusters.push({
        ...candidate,
        enclosingBoxId: candBoxId
      });
    }
  }

  return [...nonTextNodes, ...mergedClusters];
}

/**
 * Parse an SVG string into an intermediate scene tree with global bounding boxes,
 * ready for converting into Visio shapes.
 */
export function parseSvgToIntermediateTree(svgText, options = {}) {
  const {
    dpi = 96,
    preserveGroups = true,
    detectConnectors = true,
    mergeTextLines = false
  } = options;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid SVG file: ' + parserError.textContent.slice(0, 140));
  }

  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    throw new Error('No root <svg> element found.');
  }

  let viewBox = [0, 0, 800, 600];
  const vbAttr = svgEl.getAttribute('viewBox');
  const rawW = parseFloat(svgEl.getAttribute('width') || '0');
  const rawH = parseFloat(svgEl.getAttribute('height') || '0');

  if (vbAttr) {
    const parts = vbAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      viewBox = parts;
    }
  } else if (rawW > 0 && rawH > 0) {
    viewBox = [0, 0, rawW, rawH];
  }

  const [vbMinX, vbMinY, vbWidth, vbHeight] = viewBox;
  const rootMatrix = [1, 0, 0, 1, -vbMinX, -vbMinY];
  const defsMap = extractDefsGradients(svgEl);
  let nextShapeId = 1;

  const stats = {
    totalShapes: 0,
    groups: 0,
    pathsAndPrimitives: 0,
    connectors1D: 0,
    textNodes: 0
  };

  function walkNode(el, parentMatrix, inheritedStyle) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (
      !tag ||
      [
        'defs',
        'marker',
        'clippath',
        'mask',
        'style',
        'title',
        'desc',
        'metadata',
        'lineargradient',
        'radialgradient',
        'filter'
      ].includes(tag)
    ) {
      return [];
    }

    const localMatrix = parseTransformAttribute(el.getAttribute('transform') || '');
    const ctm = multiplyMatrix(parentMatrix, localMatrix);
    const style = resolveElementStyle(el, inheritedStyle, defsMap);
    const scaleFactor = Math.hypot(ctm[0], ctm[1]);

    // Handle <g> or nested <svg>
    if (tag === 'g' || tag === 'svg' || tag === 'a') {
      let childNodes = [];
      for (const child of el.children) {
        const res = walkNode(child, ctm, style.raw);
        childNodes.push(...res);
      }
      if (childNodes.length === 0) return [];

      // Merge stacked multi-line text boxes within this group/layer
      if (mergeTextLines) {
        childNodes = mergeStackedTextNodes(childNodes);
      }

      if (tag === 'svg' || !preserveGroups) {
        return childNodes;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const c of childNodes) {
        if (c.bbox.minX < minX) minX = c.bbox.minX;
        if (c.bbox.minY < minY) minY = c.bbox.minY;
        if (c.bbox.maxX > maxX) maxX = c.bbox.maxX;
        if (c.bbox.maxY > maxY) maxY = c.bbox.maxY;
      }

      const id = nextShapeId++;
      const name = el.getAttribute('id') || el.getAttribute('data-name') || `Group-${id}`;

      return [
        {
          id,
          name,
          type: 'group',
          svgTag: 'g',
          bbox: {
            minX,
            minY,
            maxX,
            maxY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1)
          },
          children: childNodes
        }
      ];
    }

    // Handle <text>
    if (tag === 'text') {
      const lines = extractTextLinesFromElement(el, ctm, style, defsMap);
      if (lines.length === 0) return [];

      const bbox = computeTextLinesBBox(lines);
      const id = nextShapeId++;
      const name = el.getAttribute('id') || `Text-${id}`;

      return [
        {
          id,
          name,
          type: 'text',
          svgTag: 'text',
          text: lines.map((l) => l.text).join('\n'),
          lines,
          style: {
            ...style,
            fontSizePt: lines[0].fontSizePt,
            textColorHex: lines[0].textColorHex
          },
          bbox
        }
      ];
    }

    // Handle geometric shapes
    const rawCommands = shapeElementToPathCommands(el);
    if (rawCommands.length === 0) return [];

    const transformedCommands = transformPathCommands(rawCommands, ctm);
    const bbox = computePathBoundingBox(transformedCommands);

    const id = nextShapeId++;
    const name = el.getAttribute('id') || `${tag.charAt(0).toUpperCase() + tag.slice(1)}-${id}`;

    const isTwoPointLine =
      detectConnectors &&
      (tag === 'line' ||
        (transformedCommands.length === 2 &&
          transformedCommands[0].type === 'M' &&
          transformedCommands[1].type === 'L' &&
          (style.noFill || style.hasEndArrow || style.hasStartArrow)));

    if (isTwoPointLine) {
      const p1 = transformedCommands[0];
      const p2 = transformedCommands[1];
      return [
        {
          id,
          name,
          type: 'connector',
          svgTag: tag,
          begin: { x: p1.x, y: p1.y },
          end: { x: p2.x, y: p2.y },
          style: {
            ...style,
            strokeWidthPx: style.strokeWidthPx * scaleFactor
          },
          bbox: {
            minX: Math.min(p1.x, p2.x),
            minY: Math.min(p1.y, p2.y),
            maxX: Math.max(p1.x, p2.x),
            maxY: Math.max(p1.y, p2.y),
            width: Math.max(Math.abs(p2.x - p1.x), 1),
            height: Math.max(Math.abs(p2.y - p1.y), 1)
          }
        }
      ];
    }

    return [
      {
        id,
        name,
        type: 'shape',
        svgTag: tag,
        commands: transformedCommands,
        style: {
          ...style,
          strokeWidthPx: style.strokeWidthPx * scaleFactor
        },
        bbox
      }
    ];
  }

  let rootChildren = walkNode(svgEl, rootMatrix, {});
  if (mergeTextLines) {
    rootChildren = mergeStackedTextNodes(rootChildren);
  }

  // Count final statistics after text merging
  function tallyStats(nodes) {
    for (const n of nodes) {
      stats.totalShapes++;
      if (n.type === 'group') {
        stats.groups++;
        tallyStats(n.children || []);
      } else if (n.type === 'connector') {
        stats.connectors1D++;
      } else if (n.type === 'text') {
        stats.textNodes++;
      } else {
        stats.pathsAndPrimitives++;
      }
    }
  }
  tallyStats(rootChildren);

  return {
    viewBox: { minX: 0, minY: 0, width: vbWidth, height: vbHeight },
    pageWidthIn: Number((vbWidth / dpi).toFixed(4)),
    pageHeightIn: Number((vbHeight / dpi).toFixed(4)),
    dpi,
    shapes: rootChildren,
    stats
  };
}

/**
 * Recursively serialize an intermediate shape/group node into Visio <Shape> XML
 */
function renderShapeToVisioXml(node, parentBox, dpi) {
  const safeW = Math.max(node.bbox.width, 0.5);
  const safeH = Math.max(node.bbox.height, 0.5);

  const widthIn = safeW / dpi;
  const heightIn = safeH / dpi;
  const centerX = (node.bbox.minX + node.bbox.maxX) / 2;
  const centerY = (node.bbox.minY + node.bbox.maxY) / 2;

  const pinX = (centerX - parentBox.minX) / dpi;
  const pinY = (parentBox.maxY - centerY) / dpi;
  const locPinX = widthIn / 2;
  const locPinY = heightIn / 2;

  // 1. GROUP SHAPE
  if (node.type === 'group') {
    const childXml = node.children
      .map((child) => renderShapeToVisioXml(child, node.bbox, dpi))
      .join('\n');

    return `<Shape ID="${node.id}" NameU="${escapeXml(node.name)}" Name="${escapeXml(node.name)}" Type="Group">
      <Cell N="PinX" V="${fmt(pinX)}"/>
      <Cell N="PinY" V="${fmt(pinY)}"/>
      <Cell N="Width" V="${fmt(widthIn)}"/>
      <Cell N="Height" V="${fmt(heightIn)}"/>
      <Cell N="LocPinX" V="${fmt(locPinX)}" F="Width*0.5"/>
      <Cell N="LocPinY" V="${fmt(locPinY)}" F="Height*0.5"/>
      <Cell N="SelectMode" V="1"/>
      <Cell N="DisplayMode" V="2"/>
      <Shapes>
${childXml}
      </Shapes>
    </Shape>`;
  }

  // 2. 1D CONNECTOR SHAPE
  if (node.type === 'connector') {
    const beginX = (node.begin.x - parentBox.minX) / dpi;
    const beginY = (parentBox.maxY - node.begin.y) / dpi;
    const endX = (node.end.x - parentBox.minX) / dpi;
    const endY = (parentBox.maxY - node.end.y) / dpi;

    const dx = endX - beginX;
    const dy = endY - beginY;
    const lengthIn = Math.max(Math.hypot(dx, dy), 0.01);
    const angleRad = Math.atan2(dy, dx);
    const midX = (beginX + endX) / 2;
    const midY = (beginY + endY) / 2;

    const st = node.style;
    const lineWeightIn = Math.max(st.strokeWidthPx / dpi, 0.005);
    const linePattern = st.noStroke ? '0' : st.isDashed ? '2' : '1';
    const strokeColor = st.noStroke ? '#334155' : st.strokeHex;

    return `<Shape ID="${node.id}" NameU="${escapeXml(node.name)}" Name="${escapeXml(node.name)}" Type="Shape">
      <Cell N="PinX" V="${fmt(midX)}" F="(BeginX+EndX)/2"/>
      <Cell N="PinY" V="${fmt(midY)}" F="(BeginY+EndY)/2"/>
      <Cell N="Width" V="${fmt(lengthIn)}" F="SQRT((EndX-BeginX)^2+(EndY-BeginY)^2)"/>
      <Cell N="Height" V="0"/>
      <Cell N="LocPinX" V="${fmt(lengthIn / 2)}" F="Width*0.5"/>
      <Cell N="LocPinY" V="0"/>
      <Cell N="Angle" V="${fmt(angleRad)}" F="ATAN2(EndY-BeginY,EndX-BeginX)"/>
      <Cell N="BeginX" V="${fmt(beginX)}"/>
      <Cell N="BeginY" V="${fmt(beginY)}"/>
      <Cell N="EndX" V="${fmt(endX)}"/>
      <Cell N="EndY" V="${fmt(endY)}"/>
      <Cell N="ObjType" V="2"/>
      <Cell N="LineWeight" V="${fmt(lineWeightIn)}"/>
      <Cell N="LineColor" V="${escapeXml(strokeColor)}"/>
      <Cell N="LinePattern" V="${linePattern}"/>
      <Cell N="LineCap" V="${st.lineCap}"/>
      <Cell N="BeginArrow" V="${st.hasStartArrow ? '4' : '0'}"/>
      <Cell N="EndArrow" V="${st.hasEndArrow ? '4' : '0'}"/>
      <Cell N="BeginArrowSize" V="2"/>
      <Cell N="EndArrowSize" V="2"/>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="1"/>
        <Cell N="NoLine" V="0"/>
        <Row T="RelMoveTo" IX="1">
          <Cell N="X" V="0"/>
          <Cell N="Y" V="0"/>
        </Row>
        <Row T="RelLineTo" IX="2">
          <Cell N="X" V="1"/>
          <Cell N="Y" V="0"/>
        </Row>
      </Section>
    </Shape>`;
  }

  // 3. SINGLE OR MULTI-LINE TEXT SHAPE (Supports multiple character formatting runs)
  if (node.type === 'text') {
    const lines = node.lines && node.lines.length > 0
      ? node.lines
      : [
          {
            text: node.text,
            fontSizePt: node.style.fontSizePt,
            textColorHex: node.style.textColorHex,
            isBold: node.style.isBold,
            textAnchor: node.style.textAnchor
          }
        ];

    const firstAnchor = lines[0].textAnchor || 'start';
    const horzAlign = firstAnchor === 'middle' ? '1' : firstAnchor === 'end' ? '2' : '0';

    // Build Character formatting rows & <Text> body with real line breaks
    const charRowsXml = [];
    const textRunsXml = [];

    lines.forEach((line, idx) => {
      const charStyle = line.isBold ? '1' : '0';
      charRowsXml.push(
        `        <Row IX="${idx}">
          <Cell N="Size" V="${fmt(line.fontSizePt / 72)}" U="PT"/>
          <Cell N="Color" V="${escapeXml(line.textColorHex)}"/>
          <Cell N="Style" V="${charStyle}"/>
        </Row>`
      );
      const prefix = idx === 0 ? `<cp IX="0"/><pp IX="0"/>` : `\n<cp IX="${idx}"/>`;
      textRunsXml.push(`${prefix}${escapeXml(line.text)}`);
    });

    return `<Shape ID="${node.id}" NameU="${escapeXml(node.name)}" Name="${escapeXml(node.name)}" Type="Shape">
      <Cell N="PinX" V="${fmt(pinX)}"/>
      <Cell N="PinY" V="${fmt(pinY)}"/>
      <Cell N="Width" V="${fmt(widthIn)}"/>
      <Cell N="Height" V="${fmt(heightIn)}"/>
      <Cell N="LocPinX" V="${fmt(locPinX)}" F="Width*0.5"/>
      <Cell N="LocPinY" V="${fmt(locPinY)}" F="Height*0.5"/>
      <Cell N="FillPattern" V="0"/>
      <Cell N="LinePattern" V="0"/>
      <Cell N="VerticalAlign" V="1"/>
      <Cell N="TopMargin" V="0"/>
      <Cell N="BottomMargin" V="0"/>
      <Cell N="LeftMargin" V="0"/>
      <Cell N="RightMargin" V="0"/>
      <Section N="Character">
${charRowsXml.join('\n')}
      </Section>
      <Section N="Paragraph">
        <Row IX="0">
          <Cell N="HorzAlign" V="${horzAlign}"/>
        </Row>
      </Section>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="1"/>
        <Cell N="NoLine" V="1"/>
        <Row T="RelMoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo" IX="2"><Cell N="X" V="1"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo" IX="3"><Cell N="X" V="1"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
      <Text>${textRunsXml.join('')}</Text>
    </Shape>`;
  }

  // 4. 2D VECTOR PATH / PRIMITIVE SHAPE
  const st = node.style;
  const lineWeightIn = st.noStroke ? 0.01 : Math.max(st.strokeWidthPx / dpi, 0.005);
  const linePattern = st.noStroke ? '0' : st.isDashed ? '2' : '1';
  const fillPattern = st.noFill ? '0' : st.fillGradientEndHex ? '25' : '1';
  const fillBkgndCells = st.fillGradientEndHex
    ? `<Cell N="FillBkgnd" V="${escapeXml(st.fillGradientEndHex)}"/>`
    : '';

  const relX = (svgX) => (svgX - node.bbox.minX) / safeW;
  const relY = (svgY) => (node.bbox.maxY - svgY) / safeH;

  const geomRows = [];
  let rowIx = 1;
  for (const cmd of node.commands) {
    if (cmd.type === 'M') {
      geomRows.push(
        `        <Row T="RelMoveTo" IX="${rowIx++}">
          <Cell N="X" V="${fmt(relX(cmd.x))}"/>
          <Cell N="Y" V="${fmt(relY(cmd.y))}"/>
        </Row>`
      );
    } else if (cmd.type === 'L' || cmd.type === 'Z') {
      geomRows.push(
        `        <Row T="RelLineTo" IX="${rowIx++}">
          <Cell N="X" V="${fmt(relX(cmd.x))}"/>
          <Cell N="Y" V="${fmt(relY(cmd.y))}"/>
        </Row>`
      );
    } else if (cmd.type === 'C') {
      geomRows.push(
        `        <Row T="RelCubBezTo" IX="${rowIx++}">
          <Cell N="X" V="${fmt(relX(cmd.x))}"/>
          <Cell N="Y" V="${fmt(relY(cmd.y))}"/>
          <Cell N="A" V="${fmt(relX(cmd.x1))}"/>
          <Cell N="B" V="${fmt(relY(cmd.y1))}"/>
          <Cell N="C" V="${fmt(relX(cmd.x2))}"/>
          <Cell N="D" V="${fmt(relY(cmd.y2))}"/>
        </Row>`
      );
    }
  }

  return `<Shape ID="${node.id}" NameU="${escapeXml(node.name)}" Name="${escapeXml(node.name)}" Type="Shape">
      <Cell N="PinX" V="${fmt(pinX)}"/>
      <Cell N="PinY" V="${fmt(pinY)}"/>
      <Cell N="Width" V="${fmt(widthIn)}"/>
      <Cell N="Height" V="${fmt(heightIn)}"/>
      <Cell N="LocPinX" V="${fmt(locPinX)}" F="Width*0.5"/>
      <Cell N="LocPinY" V="${fmt(locPinY)}" F="Height*0.5"/>
      <Cell N="FillForegnd" V="${escapeXml(st.fillHex)}"/>
      ${fillBkgndCells}
      <Cell N="FillForegndTrans" V="${fmt(st.fillTrans)}"/>
      <Cell N="FillPattern" V="${fillPattern}"/>
      <Cell N="LineWeight" V="${fmt(lineWeightIn)}"/>
      <Cell N="LineColor" V="${escapeXml(st.strokeHex)}"/>
      <Cell N="LineColorTrans" V="${fmt(st.strokeTrans)}"/>
      <Cell N="LinePattern" V="${linePattern}"/>
      <Cell N="LineCap" V="${st.lineCap}"/>
      <Cell N="BeginArrow" V="${st.hasStartArrow ? '4' : '0'}"/>
      <Cell N="EndArrow" V="${st.hasEndArrow ? '4' : '0'}"/>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="${st.noFill ? '1' : '0'}"/>
        <Cell N="NoLine" V="${st.noStroke ? '1' : '0'}"/>
${geomRows.join('\n')}
      </Section>
    </Shape>`;
}

/**
 * Generate all Open Packaging Conventions (OPC) XML files required for a valid .vsdx archive
 */
export function buildVsdxXmlPackage(parsedTree) {
  const { viewBox, pageWidthIn, pageHeightIn, dpi, shapes } = parsedTree;
  const pageBox = {
    minX: 0,
    minY: 0,
    maxX: viewBox.width,
    maxY: viewBox.height
  };

  const shapesXml = shapes
    .map((node) => renderShapeToVisioXml(node, pageBox, dpi))
    .join('\n');

  const nowIso = new Date().toISOString();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
  <Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const corePropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Converted SVG Diagram</dc:title>
  <dc:creator>SVG to Visio Converter</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>
</cp:coreProperties>`;

  const appPropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Visio</Application>
  <AppVersion>16.0000</AppVersion>
</Properties>`;

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve">
  <DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"/>
  <Colors>
    <ColorEntry IX="0" RGB="#000000"/>
    <ColorEntry IX="1" RGB="#FFFFFF"/>
  </Colors>
  <FaceNames>
    <FaceName ID="1" NameU="Segoe UI" UnicodeRanges="-536870145 1073786111 1 0" CharSets="1073742335 -65536" Panos="2 11 5 2 4 2 4 2 2 3" Flags="325"/>
  </FaceNames>
  <StyleSheets>
    <StyleSheet ID="0" NameU="No Style" Name="No Style">
      <Cell N="EnableLineProps" V="1"/>
      <Cell N="EnableFillProps" V="1"/>
      <Cell N="EnableTextProps" V="1"/>
    </StyleSheet>
  </StyleSheets>
  <DocumentSheet NameU="TheDoc" Name="TheDoc" LineStyle="0" FillStyle="0" TextStyle="0"/>
</VisioDocument>`;

  const windowsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Windows ClientWidth="1280" ClientHeight="800" xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Window ID="0" WindowType="Drawing" WindowState="1073741824" WindowLeft="0" WindowTop="0" WindowWidth="1280" WindowHeight="800" ContainerType="Page" Page="0" ViewScale="1" ViewCenterX="${fmt(pageWidthIn / 2)}" ViewCenterY="${fmt(pageHeightIn / 2)}"/>
</Windows>`;

  const pagesRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`;

  const pagesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve">
  <Page ID="0" NameU="Page-1" Name="Page-1" ViewScale="-1" ViewCenterX="${fmt(pageWidthIn / 2)}" ViewCenterY="${fmt(pageHeightIn / 2)}">
    <PageSheet LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PageWidth" V="${fmt(pageWidthIn)}"/>
      <Cell N="PageHeight" V="${fmt(pageHeightIn)}"/>
      <Cell N="ShdwOffsetX" V="0.125"/>
      <Cell N="ShdwOffsetY" V="-0.125"/>
      <Cell N="PageScale" V="1" U="IN_F"/>
      <Cell N="DrawingScale" V="1" U="IN_F"/>
      <Cell N="DrawingSizeType" V="0"/>
      <Cell N="DrawingScaleType" V="0"/>
      <Cell N="InhibitSnap" V="0"/>
    </PageSheet>
    <Rel r:id="rId1"/>
  </Page>
</Pages>`;

  const page1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve">
  <Shapes>
${shapesXml}
  </Shapes>
</PageContents>`;

  return {
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': rootRelsXml,
    'docProps/core.xml': corePropsXml,
    'docProps/app.xml': appPropsXml,
    'visio/document.xml': documentXml,
    'visio/_rels/document.xml.rels': documentRelsXml,
    'visio/windows.xml': windowsXml,
    'visio/pages/pages.xml': pagesXml,
    'visio/pages/_rels/pages.xml.rels': pagesRelsXml,
    'visio/pages/page1.xml': page1Xml
  };
}

/**
 * Create a downloadable .vsdx Blob using JSZip
 */
export async function generateVsdxBlob(xmlFilesMap) {
  if (!window.JSZip) {
    throw new Error('JSZip is not loaded.');
  }
  const zip = new window.JSZip();
  for (const [path, content] of Object.entries(xmlFilesMap)) {
    zip.file(path, content);
  }
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-visio.drawing.main+xml',
    compression: 'DEFLATE'
  });
}
