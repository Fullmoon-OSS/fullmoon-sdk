// Contract tests for EconomyClient against an in-process stub of the
// read-only API. The stub pins the protocol shapes (the authoritative
// implementation is fullmoon-economy-api/src/server.js), so the client's
// promises stay testable without a database or a network:
//
//   - business results come back as data (404 → null / empty array)
//   - operator problems (401/429/5xx) throw — they must be loud
//   - every non-GET meets the 405 wall, with Allow: GET
//
// The rate-limit route 429s on its second hit, which is all the client needs
// to prove it refuses to swallow 429.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { EconomyClient } from '../economyClient.js';

const KEY = 'sdk-contract-key-0123456789abcdefghijkl';

const configHits = { count: 0 };
const casinoHits = { count: 0 };

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  // The real server refuses non-GET before authentication, before the body is
  // even read — the stub mirrors that order so the 405 contract is exact.
  if (req.method !== 'GET') {
    return send(res, 405, {
      ok: false,
      error: 'economy-api is read-only — grant/revoke/transfer and config writes were removed on 2026-07-12',
      hint: 'balances move only through the Discord bot and the MC plugin',
    }, { allow: 'GET' });
  }
  if (path === '/v1/health') {
    return send(res, 200, { ok: true, service: 'economy-api', readOnly: true });
  }

  const auth = req.headers.authorization ?? '';
  if (auth !== `Bearer ${KEY}`) return send(res, 401, { ok: false, error: 'unauthorized' });

  if (path === '/v1/accounts/123456789') {
    return send(res, 200, { ok: true, discordId: '123456789', balance: 500, linked: false, mcUsername: null });
  }
  if (path === '/v1/accounts/999999999') {
    return send(res, 404, { ok: false, error: 'no such account' });
  }
  if (path === '/v1/accounts/123456789/transactions') {
    return send(res, 200, {
      ok: true,
      transactions: [{
        delta: 10, balanceAfter: 510, reason: 'discord.daily', source: 'bot',
        refId: 'daily:2026-09-08', createdAt: '2026-09-08T00:00:00.000Z',
      }],
    });
  }
  if (path === '/v1/accounts/by-mc/SteveMan') {
    return send(res, 200, {
      ok: true,
      wallet: { currency: '원', balance: 300, updatedAt: '2026-09-08T00:00:00.000Z' },
      transactions: [{ delta: 5, reason: 'economy.playtime', label: '플레이타임', balanceAfter: 300, at: '2026-09-08T00:00:00.000Z' }],
    });
  }
  if (path === '/v1/accounts/by-mc/Nobody') {
    return send(res, 404, { ok: false, error: 'no linked account for that username' });
  }
  if (path === '/v1/leaderboard') {
    return send(res, 200, {
      ok: true,
      leaderboard: [{ rank: 1, discordId: '123456789', mcUsername: null, balance: 500 }],
    });
  }
  if (path === '/v1/config') {
    configHits.count += 1;
    return send(res, 200, {
      ok: true,
      config: [
        { key: 'reward.multiplier', value: 2, description: null, updatedBy: null, updatedAt: null },
        { key: 'mybot.fishing.multiplier', value: 1.5, description: null, updatedBy: null, updatedAt: null },
      ],
    });
  }
  if (path === '/v1/overview') {
    return send(res, 200, { ok: true, totalSupply: 5000, accounts: 42, today: {}, bySource: [] });
  }
  if (path === '/v1/casino/today') {
    casinoHits.count += 1;
    if (casinoHits.count > 1) return send(res, 429, { ok: false, error: 'rate limited' });
    return send(res, 200, { ok: true, games: [] });
  }

  return send(res, 404, { ok: false, error: 'not found' });
});

let eco;
let badEco;
before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  eco = new EconomyClient({ key: KEY, baseUrl });
  badEco = new EconomyClient({ key: 'x'.repeat(32), baseUrl });
});
after(() => new Promise((r) => server.close(r)));

test('getAccount returns the business result', async () => {
  const acc = await eco.getAccount('123456789');
  assert.equal(acc.balance, 500);
  assert.equal(acc.linked, false);
});

test('getAccount returns null when there is no account yet (404 is business, not error)', async () => {
  assert.equal(await eco.getAccount('999999999'), null);
});

test('getTransactions maps to the transactions array', async () => {
  const tx = await eco.getTransactions('123456789');
  assert.equal(tx.length, 1);
  assert.equal(tx[0].delta, 10);
  assert.equal(tx[0].reason, 'discord.daily');
});

test('getLeaderboard maps to the leaderboard array', async () => {
  const top = await eco.getLeaderboard(10);
  assert.equal(top[0].rank, 1);
  assert.equal(top[0].balance, 500);
});

test('getWalletByMc reads the launcher-shaped endpoint and nulls on 404', async () => {
  const wal = await eco.getWalletByMc('SteveMan');
  assert.equal(wal.wallet.balance, 300);
  assert.equal(wal.wallet.currency, '원');
  assert.equal(await eco.getWalletByMc('Nobody'), null);
});

test('config is cached for 30s unless fresh', async () => {
  await eco.getConfigMap();
  await eco.getConfigMap();
  assert.equal(configHits.count, 1, 'second read must come from the cache');
  await eco.getConfigMap({ fresh: true });
  assert.equal(configHits.count, 2, 'fresh: true must bypass the cache');
});

test('getConfigValue reads numbers and honors the fallback', async () => {
  assert.equal(await eco.getConfigValue('reward.multiplier', 1), 2);
  assert.equal(await eco.getConfigValue('mybot.fishing.multiplier', 1), 1.5);
  assert.equal(await eco.getConfigValue('nope.missing', 7), 7);
});

test('auth failures throw loudly — an operator problem, not a business result', async () => {
  await assert.rejects(() => badEco.getAccount('123456789'), /401/);
});

test('429 throws — the client refuses to swallow a rate limit', async () => {
  await eco.getCasinoToday(); // first hit: 200, warms nothing
  await assert.rejects(() => eco.getCasinoToday(), /429/);
});

test('no write methods survive on the client', () => {
  for (const gone of ['grant', 'revoke', 'transfer', 'setConfigValue', 'deleteConfigValue', 'scaledAmount']) {
    assert.equal(typeof eco[gone], 'undefined', `EconomyClient.${gone} must not exist`);
  }
});

test('a legacy write call meets the 405 wall, not silence', async () => {
  const res = await fetch(`${eco.baseUrl}/v1/grant`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ discordId: '123456789', amount: 10, refId: 'x' }),
  });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET');
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /read-only/);
});
