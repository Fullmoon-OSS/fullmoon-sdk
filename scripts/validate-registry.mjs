// Validates registry/integrations.json against the INTEGRATIONS.md schema.
// CI runs this, so a malformed registry entry fails the PR before review.
//
// Rules: version === 1; integrations is an array; each entry has a name,
// a known type, a real description, an https URL, an author, an ISO date,
// and verified === false on the way in (flipping verified to true is an
// operator edit, not part of a registration PR).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'registry', 'integrations.json');

const TYPES = new Set(['bot', 'dashboard', 'tool', 'client']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let data;
try {
  data = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`FAIL: ${path} is not valid JSON: ${err.message}`);
  process.exit(1);
}

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

if (data.version !== 1) fail(`version must be 1, got ${JSON.stringify(data.version)}`);
if (!Array.isArray(data.integrations)) fail('integrations must be an array');

const seen = new Set();
for (const [i, e] of data.integrations.entries()) {
  const at = `integrations[${i}]`;
  const name = e?.name;
  if (typeof name !== 'string' || name.length < 1 || name.length > 40) {
    fail(`${at}: name must be a string of 1..40 chars`);
  }
  if (seen.has(name)) fail(`${at}: duplicate name '${name}'`);
  seen.add(name);
  if (!TYPES.has(e?.type)) fail(`${at}: type must be one of ${[...TYPES].join(', ')}`);
  if (typeof e?.description !== 'string' || e.description.length < 5 || e.description.length > 120) {
    fail(`${at}: description must be a string of 5..120 chars`);
  }
  let url;
  try {
    url = new URL(e?.url ?? '');
  } catch {
    fail(`${at}: url is not a valid URL`);
  }
  if (url.protocol !== 'https:') fail(`${at}: url must be https`);
  if (typeof e?.author !== 'string' || e.author.length < 1 || e.author.length > 40) {
    fail(`${at}: author must be a string of 1..40 chars`);
  }
  if (typeof e?.addedAt !== 'string' || !DATE_RE.test(e.addedAt)) {
    fail(`${at}: addedAt must be YYYY-MM-DD`);
  }
  if (e?.verified !== false) fail(`${at}: verified must be false in a registration PR (operator flips it after review)`);
}

console.log(`OK: registry valid — ${data.integrations.length} integration(s)`);
