/**
 * Complete SVG Path Parser, Normalizer (to Cubic Beziers & Lines),
 * Affine Matrix Transformer, and Bounding Box Calculator.
 */

/**
 * Multiply two 2D affine matrices [a, b, c, d, e, f]
 * representing:
 * [ a  c  e ]
 * [ b  d  f ]
 * [ 0  0  1 ]
 */
export function multiplyMatrix(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

export function applyMatrixToPoint(m, x, y) {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5]
  };
}

/**
 * Parse an SVG transform="..." string into a 6-element matrix [a, b, c, d, e, f]
 */
export function parseTransformAttribute(transformStr) {
  let matrix = [1, 0, 0, 1, 0, 0];
  if (!transformStr || !transformStr.trim()) return matrix;

  const regex = /(\w+)\s*\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(transformStr)) !== null) {
    const type = match[1].toLowerCase();
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    let m = [1, 0, 0, 1, 0, 0];
    if (type === 'translate') {
      const tx = args[0] || 0;
      const ty = args[1] || 0;
      m = [1, 0, 0, 1, tx, ty];
    } else if (type === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      m = [sx, 0, 0, sy, 0, 0];
    } else if (type === 'rotate') {
      const angle = ((args[0] || 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cx = args[1] || 0;
      const cy = args[2] || 0;
      if (cx || cy) {
        m = multiplyMatrix(
          [1, 0, 0, 1, cx, cy],
          multiplyMatrix([cos, sin, -sin, cos, 0, 0], [1, 0, 0, 1, -cx, -cy])
        );
      } else {
        m = [cos, sin, -sin, cos, 0, 0];
      }
    } else if (type === 'skewx') {
      const tan = Math.tan(((args[0] || 0) * Math.PI) / 180);
      m = [1, 0, tan, 1, 0, 0];
    } else if (type === 'skewy') {
      const tan = Math.tan(((args[0] || 0) * Math.PI) / 180);
      m = [1, tan, 0, 1, 0, 0];
    } else if (type === 'matrix' && args.length === 6) {
      m = args;
    }
    matrix = multiplyMatrix(matrix, m);
  }
  return matrix;
}

/**
 * Convert an SVG elliptical arc (x1, y1) -> (x2, y2) into 1..4 Cubic Bezier segments
 * Each returned segment is { x1, y1, x2, y2, x, y }
 */
function arcToCubicBeziers(x1, y1, rx, ry, angleDeg, largeArcFlag, sweepFlag, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  if (rx === 0 || ry === 0) {
    return [{ type: 'L', x: x2, y: y2 }];
  }

  const phi = (angleDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rx *= sqrtLambda;
    ry *= sqrtLambda;
  }

  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  let radicand = Math.max(0, rxSq * rySq - rxSq * y1pSq - rySq * x1pSq);
  radicand /= rxSq * y1pSq + rySq * x1pSq;
  let coef = Math.sqrt(radicand) * (largeArcFlag === sweepFlag ? -1 : 1);

  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const vectorAngle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vectorAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );

  if (!sweepFlag && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweepFlag && dTheta < 0) dTheta += 2 * Math.PI;

  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segments;
  const t = (8 / 3) * Math.sin(delta / 4) * Math.sin(delta / 4) / Math.sin(delta / 2);

  const curves = [];
  let curTheta = theta1;

  for (let i = 0; i < segments; i++) {
    const cos1 = Math.cos(curTheta);
    const sin1 = Math.sin(curTheta);
    const nextTheta = curTheta + delta;
    const cos2 = Math.cos(nextTheta);
    const sin2 = Math.sin(nextTheta);

    const e1x = cos1 - t * sin1;
    const e1y = sin1 + t * cos1;
    const e2x = cos2 + t * sin2;
    const e2y = sin2 - t * cos2;

    const mapPt = (px, py) => ({
      x: cx + rx * (cosPhi * px - sinPhi * py),
      y: cy + ry * (sinPhi * px + cosPhi * py)
    });

    const cp1 = mapPt(e1x, e1y);
    const cp2 = mapPt(e2x, e2y);
    const end = mapPt(cos2, sin2);

    curves.push({
      type: 'C',
      x1: cp1.x,
      y1: cp1.y,
      x2: cp2.x,
      y2: cp2.y,
      x: end.x,
      y: end.y
    });

    curTheta = nextTheta;
  }

  return curves;
}

/**
 * Tokenize & normalize an SVG path `d` attribute into absolute M, L, C, Z commands.
 */
export function parseAndNormalizePath(dString) {
  if (!dString || !dString.trim()) return [];

  const commandRegex = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;
  const numberRegex = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

  const normalized = [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let lastControlX = 0;
  let lastControlY = 0;
  let lastCmd = '';

  let match;
  while ((match = commandRegex.exec(dString)) !== null) {
    const cmd = match[1];
    const isRel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();
    const args = (match[2].match(numberRegex) || []).map(Number);

    if (upper === 'Z') {
      normalized.push({ type: 'Z', x: startX, y: startY });
      curX = startX;
      curY = startY;
      lastCmd = 'Z';
      continue;
    }

    let idx = 0;
    while (idx < args.length) {
      if (upper === 'M') {
        const x = (isRel ? curX : 0) + args[idx++];
        const y = (isRel ? curY : 0) + args[idx++];
        if (idx === 2) {
          normalized.push({ type: 'M', x, y });
          startX = x;
          startY = y;
        } else {
          // Subsequent pairs after M are implicit LineTo
          normalized.push({ type: 'L', x, y });
        }
        curX = x;
        curY = y;
        lastCmd = 'M';
      } else if (upper === 'L') {
        const x = (isRel ? curX : 0) + args[idx++];
        const y = (isRel ? curY : 0) + args[idx++];
        normalized.push({ type: 'L', x, y });
        curX = x;
        curY = y;
        lastCmd = 'L';
      } else if (upper === 'H') {
        const x = (isRel ? curX : 0) + args[idx++];
        normalized.push({ type: 'L', x, y: curY });
        curX = x;
        lastCmd = 'H';
      } else if (upper === 'V') {
        const y = (isRel ? curY : 0) + args[idx++];
        normalized.push({ type: 'L', x: curX, y });
        curY = y;
        lastCmd = 'V';
      } else if (upper === 'C') {
        const x1 = (isRel ? curX : 0) + args[idx++];
        const y1 = (isRel ? curY : 0) + args[idx++];
        const x2 = (isRel ? curX : 0) + args[idx++];
        const y2 = (isRel ? curY : 0) + args[idx++];
        const x = (isRel ? curX : 0) + args[idx++];
        const y = (isRel ? curY : 0) + args[idx++];
        normalized.push({ type: 'C', x1, y1, x2, y2, x, y });
        lastControlX = x2;
        lastControlY = y2;
        curX = x;
        curY = y;
        lastCmd = 'C';
      } else if (upper === 'S') {
        let x1 = curX;
        let y1 = curY;
        if (lastCmd === 'C' || lastCmd === 'S') {
          x1 = 2 * curX - lastControlX;
          y1 = 2 * curY - lastControlY;
        }
        const x2 = (isRel ? curX : 0) + args[idx++];
        const y2 = (isRel ? curY : 0) + args[idx++];
        const x = (isRel ? curX : 0) + args[idx++];
        const y = (isRel ? curY : 0) + args[idx++];
        normalized.push({ type: 'C', x1, y1, x2, y2, x, y });
        lastControlX = x2;
        lastControlY = y2;
        curX = x;
        curY = y;
        lastCmd = 'S';
      } else if (upper === 'Q') {
        const qx1 = (isRel ? curX : 0) + args[idx++];
        const qy1 = (isRel ? curY : 0) + args[idx++];
        const x = (isRel ? curX : 0) + args[idx++];
        const y = (isRel ? curY : 0) + args[idx++];
        // Degree elevation: Quadratic -> Cubic
        const x1 = curX + (2 / 3) * (qx1 - curX);
        const y1 = curY + (2 / 3) * (qy1 - curY);
        const x2 = x + (2 / 3) * (qx1 - x);
        const y2 = y + (2 / 3) * (qy1 - y);
        normalized.push({ type: 'C', x1, y1, x2, y2, x, y });
        lastControlX = qx1;
        lastControlY = qy1;
        curX = x;
        curY = y;
        lastCmd = 'Q';
      } else if (upper === 'T') {
        let qx1 = curX;
        let qy1 = curY;
        if (lastCmd === 'Q' || lastCmd === 'T') {
          qx1 = 2 * curX - lastControlX;
          qy1 = 2 * curY - lastControlY;
        }
        const x = (isRel ? curX : 0) + args[idx++];
        const y = (isRel ? curY : 0) + args[idx++];
        const x1 = curX + (2 / 3) * (qx1 - curX);
        const y1 = curY + (2 / 3) * (qy1 - curY);
        const x2 = x + (2 / 3) * (qx1 - x);
        const y2 = y + (2 / 3) * (qy1 - y);
        normalized.push({ type: 'C', x1, y1, x2, y2, x, y });
        lastControlX = qx1;
        lastControlY = qy1;
        curX = x;
        curY = y;
        lastCmd = 'T';
      } else if (upper === 'A') {
        const rx = args[idx++];
        const ry = args[idx++];
        const xAxisRotation = args[idx++];
        const largeArcFlag = args[idx++];
        const sweepFlag = args[idx++];
        const x = (isRel ? curX : 0) + args[idx++];
        const y = (isRel ? curY : 0) + args[idx++];
        const cubics = arcToCubicBeziers(
          curX,
          curY,
          rx,
          ry,
          xAxisRotation,
          largeArcFlag,
          sweepFlag,
          x,
          y
        );
        for (const seg of cubics) {
          normalized.push(seg);
        }
        curX = x;
        curY = y;
        lastCmd = 'A';
      } else {
        break;
      }
    }
  }

  return normalized;
}

/**
 * Transform normalized path commands by a 2D affine matrix [a, b, c, d, e, f]
 */
export function transformPathCommands(commands, matrix) {
  if (!matrix) return commands;
  return commands.map((cmd) => {
    if (cmd.type === 'M' || cmd.type === 'L' || cmd.type === 'Z') {
      const pt = applyMatrixToPoint(matrix, cmd.x, cmd.y);
      return { type: cmd.type, x: pt.x, y: pt.y };
    }
    if (cmd.type === 'C') {
      const p1 = applyMatrixToPoint(matrix, cmd.x1, cmd.y1);
      const p2 = applyMatrixToPoint(matrix, cmd.x2, cmd.y2);
      const p = applyMatrixToPoint(matrix, cmd.x, cmd.y);
      return {
        type: 'C',
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        x: p.x,
        y: p.y
      };
    }
    return cmd;
  });
}

/**
 * Compute accurate bounding box { minX, minY, maxX, maxY, width, height }
 * for normalized path commands (evaluating cubic Bezier extrema).
 */
export function computePathBoundingBox(commands) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const includePt = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  const evalCubic = (p0, p1, p2, p3, t) => {
    const mt = 1 - t;
    return (
      mt * mt * mt * p0 +
      3 * mt * mt * t * p1 +
      3 * mt * t * t * p2 +
      t * t * t * p3
    );
  };

  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    if (cmd.type === 'M' || cmd.type === 'L' || cmd.type === 'Z') {
      includePt(cmd.x, cmd.y);
      curX = cmd.x;
      curY = cmd.y;
    } else if (cmd.type === 'C') {
      includePt(curX, curY);
      includePt(cmd.x, cmd.y);

      // Check cubic extrema along X and Y
      const checkExtrema = (p0, p1, p2, p3, isX) => {
        const a = -p0 + 3 * p1 - 3 * p2 + p3;
        const b = 2 * (p0 - 2 * p1 + p2);
        const c = -p0 + p1;
        const roots = [];
        if (Math.abs(a) < 1e-9) {
          if (Math.abs(b) > 1e-9) roots.push(-c / b);
        } else {
          const disc = b * b - 4 * a * c;
          if (disc >= 0) {
            const sqrtD = Math.sqrt(disc);
            roots.push((-b + sqrtD) / (2 * a));
            roots.push((-b - sqrtD) / (2 * a));
          }
        }
        for (const t of roots) {
          if (t > 0 && t < 1) {
            const val = evalCubic(p0, p1, p2, p3, t);
            if (isX) includePt(val, curY);
            else includePt(curX, val);
          }
        }
      };

      checkExtrema(curX, cmd.x1, cmd.x2, cmd.x, true);
      checkExtrema(curY, cmd.y1, cmd.y2, cmd.y, false);

      curX = cmd.x;
      curY = cmd.y;
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 0),
    height: Math.max(maxY - minY, 0)
  };
}

/**
 * Convert basic SVG shapes (<rect>, <circle>, <ellipse>, <line>, <polyline>, <polygon>)
 * into normalized path commands.
 */
export function shapeElementToPathCommands(el) {
  const tag = el.tagName.toLowerCase();

  if (tag === 'path') {
    return parseAndNormalizePath(el.getAttribute('d') || '');
  }

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    let rx = parseFloat(el.getAttribute('rx') || el.getAttribute('ry') || '0');
    let ry = parseFloat(el.getAttribute('ry') || el.getAttribute('rx') || '0');
    if (w <= 0 || h <= 0) return [];

    rx = Math.min(rx, w / 2);
    ry = Math.min(ry, h / 2);

    if (rx <= 0 || ry <= 0) {
      return [
        { type: 'M', x, y },
        { type: 'L', x: x + w, y },
        { type: 'L', x: x + w, y: y + h },
        { type: 'L', x, y: y + h },
        { type: 'Z', x, y }
      ];
    }

    const d = [
      `M ${x + rx} ${y}`,
      `L ${x + w - rx} ${y}`,
      `A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
      `L ${x + w} ${y + h - ry}`,
      `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
      `L ${x + rx} ${y + h}`,
      `A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
      `L ${x} ${y + ry}`,
      `A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
      'Z'
    ].join(' ');
    return parseAndNormalizePath(d);
  }

  if (tag === 'circle' || tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx =
      tag === 'circle'
        ? parseFloat(el.getAttribute('r') || '0')
        : parseFloat(el.getAttribute('rx') || '0');
    const ry =
      tag === 'circle'
        ? rx
        : parseFloat(el.getAttribute('ry') || '0');
    if (rx <= 0 || ry <= 0) return [];

    // 4-quadrant cubic Bezier approximation (kappa = 0.5522847498)
    const k = 0.5522847498307936;
    const ox = rx * k;
    const oy = ry * k;

    return [
      { type: 'M', x: cx - rx, y: cy },
      { type: 'C', x1: cx - rx, y1: cy - oy, x2: cx - ox, y2: cy - ry, x: cx, y: cy - ry },
      { type: 'C', x1: cx + ox, y1: cy - ry, x2: cx + rx, y2: cy - oy, x: cx + rx, y: cy },
      { type: 'C', x1: cx + rx, y1: cy + oy, x2: cx + ox, y2: cy + ry, x: cx, y: cy + ry },
      { type: 'C', x1: cx - ox, y1: cy + ry, x2: cx - rx, y2: cy + oy, x: cx - rx, y: cy },
      { type: 'Z', x: cx - rx, y: cy }
    ];
  }

  if (tag === 'line') {
    const x1 = parseFloat(el.getAttribute('x1') || '0');
    const y1 = parseFloat(el.getAttribute('y1') || '0');
    const x2 = parseFloat(el.getAttribute('x2') || '0');
    const y2 = parseFloat(el.getAttribute('y2') || '0');
    return [
      { type: 'M', x: x1, y: y1 },
      { type: 'L', x: x2, y: y2 }
    ];
  }

  if (tag === 'polyline' || tag === 'polygon') {
    const ptsRaw = (el.getAttribute('points') || '').trim();
    if (!ptsRaw) return [];
    const nums = (ptsRaw.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []).map(Number);
    if (nums.length < 4) return [];
    const cmds = [{ type: 'M', x: nums[0], y: nums[1] }];
    for (let i = 2; i < nums.length - 1; i += 2) {
      cmds.push({ type: 'L', x: nums[i], y: nums[i + 1] });
    }
    if (tag === 'polygon') {
      cmds.push({ type: 'Z', x: nums[0], y: nums[1] });
    }
    return cmds;
  }

  return [];
}
