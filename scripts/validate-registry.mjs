// Validates registry/modules.json against the MODULES.md schema.
// CI runs this, so a malformed module entry fails the PR before review.
//
// Rules: version === 1; modules is an array; each entry has a name,
// a known type, a real description, an https URL, an author, an ISO date.
//
// verified is event-aware: a REGISTRATION PR must carry verified === false
// (the operator flips it to true on main after review). Enforcing strict
// false on every CI run would make the operator's own flip permanently fail
// main, so the strict check applies only when running as a pull_request.
// Locally (no GITHUB_EVENT_NAME) both values validate — the PR gate is the
// strict one.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'registry', 'modules.json');

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

// DATE_RE proves the shape; this proves the shape is a real day — 2026-02-30
// and 2026-99-99 must both fail. Day 0 of month m+1 is the last day of month m.
function isCalendarDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

if (data.version !== 1) fail(`version must be 1, got ${JSON.stringify(data.version)}`);
if (!Array.isArray(data.modules)) fail('modules must be an array');

const seen = new Set();
for (const [i, e] of data.modules.entries()) {
  const at = `modules[${i}]`;
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
  if (typeof e?.addedAt !== 'string' || !DATE_RE.test(e.addedAt) || !isCalendarDate(e.addedAt)) {
    fail(`${at}: addedAt must be a real calendar date (YYYY-MM-DD)`);
  }
  // Strict only on pull_request: registration PRs must carry verified ===
  // false; the operator's post-review flip (true, on main) must not fail CI.
  if (e?.verified !== false && process.env.GITHUB_EVENT_NAME === 'pull_request') {
    fail(`${at}: verified must be false in a registration PR (the operator flips it to true after review)`);
  }
}

console.log(`OK: registry valid — ${data.modules.length} module(s)`);
