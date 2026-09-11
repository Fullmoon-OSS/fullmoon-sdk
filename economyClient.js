// economyClient.js — 풀문 공유 경제 API 공식 클라이언트 (복사해서 봇 프로젝트에 넣으세요)
// 최신 버전과 문서: https://github.com/fullmoon-network/fullmoon-sdk
//
// 의존성 없음. Node 18+ (전역 fetch). ESM.
//   import { EconomyClient } from './economyClient.js';
//   const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });
//
// **읽기 전용입니다.** 2026-07-12부로 API에서 지급/차감/송금과 설정 쓰기가
// 사라졌습니다. 잔액을 움직이는 건 코인브릿지 봇과 마크 플러그인뿐입니다.
// 이 킷으로는 잔액·거래내역·랭킹·집계·설정값을 읽어서 여러분 봇의 UI를 만들 수
// 있습니다. (예전 grant/revoke/transfer를 호출하면 API가 405를 돌려줍니다.)
//
// 규칙:
//  - 잔액은 절대 로컬 캐시하지 않음 — 표시 직전에 읽기
//  - 설정(economy_config)만 30초 캐시 — 운영자가 값을 바꾸면 곧 반영

export class EconomyApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'EconomyApiError';
    this.status = status ?? null;
    this.body = body ?? null;
  }
}

export class EconomyClient {
  /**
   * @param {object} opts
   * @param {string} opts.key      발급받은 bearer 키 (필수)
   * @param {string} [opts.baseUrl] 기본 https://api.fullmoon.ink/economy
   * @param {number} [opts.timeoutMs] 요청 타임아웃 (기본 5000)
   */
  // The API itself binds 127.0.0.1 and is only reachable through the nginx
  // /economy path, so the public URL is the right default: it is what an
  // integrating bot on another host must use, and it also works from the API
  // host. Operator-side batch tools should pass http://127.0.0.1:8790 instead —
  // the proxy rate-limits per IP and a bulk loop will hit 429.
  constructor({ key, baseUrl = 'https://api.fullmoon.ink/economy', timeoutMs = 5000 }) {
    if (!key) throw new Error('EconomyClient: key is required');
    this.key = key;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this._configCache = null; // { at, map }
  }

  async _get(path) {
    let res;
    try {
      res = await fetch(this.baseUrl + path, {
        method: 'GET',
        headers: { authorization: `Bearer ${this.key}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new EconomyApiError(`economy-api unreachable: ${err.message}`);
    }
    let json;
    try {
      json = await res.json();
    } catch {
      throw new EconomyApiError(`economy-api returned non-JSON (HTTP ${res.status})`, { status: res.status });
    }
    // 401/403/429/5xx = 설정·운영 문제 → 예외로 크게 실패시켜서 바로 눈에 띄게.
    // 404 = 정상적인 업무 결과(그런 계정 없음) → body 반환.
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500) {
      throw new EconomyApiError(`economy-api ${res.status}: ${json.error ?? 'error'}`, { status: res.status, body: json });
    }
    return json;
  }

  // -- 읽기 -------------------------------------------------------------------

  /** 계정+잔액. 계정이 아직 없으면 null. */
  async getAccount(discordId) {
    const r = await this._get(`/v1/accounts/${discordId}`);
    return r.ok ? r : null;
  }

  async getTransactions(discordId, limit = 10) {
    const r = await this._get(`/v1/accounts/${discordId}/transactions?limit=${limit}`);
    return r.ok ? r.transactions : [];
  }

  async getLeaderboard(limit = 10) {
    const r = await this._get(`/v1/leaderboard?limit=${limit}`);
    return r.ok ? r.leaderboard : [];
  }

  async getEvents() {
    const r = await this._get('/v1/events');
    return r.ok ? r.events : [];
  }

  async getGuilds() {
    const r = await this._get('/v1/guilds');
    return r.ok ? r.guilds : [];
  }

  async getCasinoHistory(days = 30) {
    const r = await this._get(`/v1/casino/history?days=${days}`);
    return r.ok ? r.days : [];
  }

  /**
   * 거래 내역을 페이지 단위로 조회해요 (id 커서). 다음 페이지는 반환값의
   * nextBefore를 before로 넘기면 돼요. 더 없으면 nextBefore가 null이에요.
   */
  async getTransactionsPage(discordId, { limit = 10, before } = {}) {
    const q = new URLSearchParams({ limit: String(limit) });
    if (before) q.set('before', String(before));
    const r = await this._get(`/v1/accounts/${discordId}/transactions?${q}`);
    return r.ok ? { transactions: r.transactions, nextBefore: r.nextBefore ?? null } : null;
  }

  // 대시보드용 집계
  async getOverview() { return this._get('/v1/overview'); }
  async getDailyStats(days = 14) { return this._get(`/v1/stats/daily?days=${days}`); }
  async getRecentTransactions(limit = 20) { return this._get(`/v1/transactions/recent?limit=${limit}`); }
  async getCasinoToday() { return this._get('/v1/casino/today'); }

  /**
   * MC 사용자명 기반 지갑 조회 (런처·게임 클라이언트용). 연동 계정이 없으면 null.
   * 응답: { wallet: { currency, balance, updatedAt }, transactions: [{ delta, reason, label, ... }] }
   * label은 원장 vocabulary가 붙여준 한글 표시명이다.
   */
  async getWalletByMc(mcUsername) {
    const r = await this._get(`/v1/accounts/by-mc/${encodeURIComponent(mcUsername)}`);
    return r.ok ? r : null;
  }

  // -- 공유 설정 (economy_config) — 읽기 전용 ------------------------------------

  /** 전체 설정을 Map<key, value>로. 30초 캐시. */
  async getConfigMap({ fresh = false } = {}) {
    if (!fresh && this._configCache && Date.now() - this._configCache.at < 30_000) {
      return this._configCache.map;
    }
    const r = await this._get('/v1/config');
    const map = new Map((r.config ?? []).map((c) => [c.key, c.value]));
    this._configCache = { at: Date.now(), map };
    return map;
  }

  /**
   * 설정 값 하나 (없으면 fallback). 주의 — 읽기 실패(401·429·네트워크 오류 포함)도
   * 예외가 아니라 fallback으로 삼킨다. 설정은 부가 정보라 봇이 죽지 않는 쪽을 택한
   * 것인데, 대신 값이 오래됐을 수 있다. 운영 문제를 눈에 띄게 보려면 이 메서드 대신
   * getConfigMap()을 직접 써라(이쪽은 던진다).
   */
  async getConfigValue(key, fallback) {
    const map = await this.getConfigMap().catch(() => new Map());
    return map.has(key) ? map.get(key) : fallback;
  }
}
