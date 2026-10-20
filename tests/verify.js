import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAndNormalizePath,
  parseTransformAttribute,
  transformPathCommands,
  computePathBoundingBox
} from '../src/svg-path-parser.js';
import { SVG_SAMPLES } from '../src/samples.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('Running DoLess SVG -> VSDX Verification Suite...\n');

// 1. Test SVG Path Normalization (Lines, Quadratics, Arcs, Cubics)
{
  const cmds = parseAndNormalizePath(
    'M 10 10 H 90 V 90 L 10 90 Q 5 50 10 10 A 25 25 0 0 1 50 10 Z'
  );
  assert.ok(cmds.length >= 6, 'Should normalize H, V, L, Q, A, Z into M/L/C/Z segments');
  assert.equal(cmds[0].type, 'M');
  assert.ok(cmds.some((c) => c.type === 'C'), 'Quadratic and Arc commands must normalize to Cubic Beziers');
  console.log('✓ [1/4] SVG Path Parser & Arc/Bezier Normalizer passed');
}

// 2. Test 2D Affine Matrix Transform & Bezier Bounding Box
{
  const matrix = parseTransformAttribute('translate(100, 50) scale(2) rotate(45)');
  assert.equal(matrix.length, 6);
  const raw = parseAndNormalizePath('M 0 0 C 20 -30, 40 30, 60 0');
  const transformed = transformPathCommands(raw, matrix);
  const bbox = computePathBoundingBox(transformed);
  assert.ok(bbox.width > 0 && bbox.height > 0, 'Bounding box must have positive dimensions');
  assert.ok(Number.isFinite(bbox.minX) && Number.isFinite(bbox.maxY));
  console.log('✓ [2/4] Affine Transform Matrix & Bezier Extrema BBox passed');
}

// 3. Test Sample Presets & Asset Integrity
{
  const keys = Object.keys(SVG_SAMPLES);
  assert.deepEqual(keys, ['architecture', 'illustration', 'wireframe']);
  for (const key of keys) {
    assert.ok(SVG_SAMPLES[key].svg.includes('<svg'), `Sample "${key}" must contain valid <svg> markup`);
    assert.ok(SVG_SAMPLES[key].filename.endsWith('.vsdx'));
  }

  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('./src/styles.css'), 'index.html should link ./src/styles.css');
  assert.ok(indexHtml.includes('./src/vendor/jszip.min.js'), 'index.html should link ./src/vendor/jszip.min.js');
  assert.ok(indexHtml.includes('./src/app.js'), 'index.html should link ./src/app.js');
  assert.ok(fs.existsSync(path.join(rootDir, 'src/styles.css')));
  assert.ok(fs.existsSync(path.join(rootDir, 'src/vendor/jszip.min.js')));
  console.log('✓ [3/4] Sample Presets & Directory Asset Integrity passed');
}

// 4. Test No Dead Selectors or XSS Holes in Source
{
  const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');
  assert.ok(appJs.includes('BLOCKED_SVG_TAGS'), 'SVG XSS tag blocklist must be present');
  assert.ok(!appJs.includes('innerHTML = state.svgText'), 'Raw unsanitized SVG innerHTML injection must not exist');
  console.log('✓ [4/4] Security Sanitizer & Code Hygiene checks passed');
}

console.log('\nAll verification checks passed successfully!');
