# Fullmoon Economy SDK

> 풀문(Fullmoon) 네트워크 공유 경제 API의 공식 클라이언트. 의존성 0, Node 18+, ESM.
>
> 목표: **각 봇이 자기 화폐를 만들지 않고**, 마크 경제서버의 원장 하나를 같이 본다.

| 관련 레포 | 내용 |
|---|---|
| [fullmoon-docs](https://github.com/Fullmoon-OSS/fullmoon-docs) | 시작 가이드·정책 등 전체 문서 |
| [fullmoon-economy-api](https://github.com/Fullmoon-OSS/fullmoon-economy-api) | 읽기 전용 API 서버 소스 |
| [fullmoon-client](https://github.com/Fullmoon-OSS/fullmoon-client) | 풀문 전용 마인크래프트 클라이언트 |

## 무엇을 할 수 있나 (그리고 없나)

경제의 단일 진실 원천은 마크 경제서버의 PostgreSQL이다. 여기에 **쓰는** 주체는
코인브릿지 봇과 마크 플러그인 둘뿐이고, 외부 봇은 economy-api로 **읽는다**.

```
 당신의 봇 ──HTTP GET──┐
 대시보드   ──HTTP GET──┤→ economy-api ──읽기만──→ PostgreSQL
                        │                          ↑ 쓰기: 코인브릿지 봇 / MC 플러그인
```

- ✅ 잔액·거래내역·랭킹·집계(총공급량, 일별 mint/burn, 카지노 순소각)·설정값·
  MC 사용자명 기반 지갑 조회
- ❌ 지급/차감/송금, 설정 변경 — **2026-07-12부로 API에서 제거됐다.**
  호출하면 `405 { error: "economy-api is read-only ..." }`.

재화를 지급해야 하는 기획이 있으면 API를 뚫으려 하지 말고 운영자에게 말하면 된다.
지급 경로는 봇/플러그인 안에 있다.

## 시작하기 (5분)

1. **키 발급 요청** — 운영자에게 봇 이름을 알려주면 bearer 키를 준다. 스코프는
   없다(키 하나 = 읽기 전부).
2. `economyClient.js`를 봇 프로젝트에 복사 (의존성 0, Node 18+). 이 파일 하나가
   SDK 전부다 — 패키지 설치도 필요 없다.
3. 환경변수 `ECONOMY_API_KEY` 설정. 접속 주소 기본값은
   **`https://api.fullmoon.ink/economy`** — 어느 호스트에서 돌든 이거 하나면 된다.
4. `examples/`를 참고해 화면을 붙인다.

접속 확인:

```bash
curl -s https://api.fullmoon.ink/economy/v1/health
curl -s -H "Authorization: Bearer $ECONOMY_API_KEY" \
     https://api.fullmoon.ink/economy/v1/overview
```

`429`가 오면 rate limit(IP당 10 req/s, burst 40)에 걸린 거다. 정상 봇 트래픽으로는
닿을 일이 없고, 루프 돌려 긁을 때만 걸린다. 백오프하고 재시도하면 된다.

```js
import { EconomyClient } from './economyClient.js';
const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });

const acc = await eco.getAccount(userId);          // { balance, linked, mcUsername } | null
const top = await eco.getLeaderboard(10);          // [{ rank, discordId, balance }]
const wal = await eco.getWalletByMc('SteveMan');   // 런처/클라이언트용 — MC 사용자명 기반
```

## 3가지 철칙

1. **잔액을 캐시하지 말 것.** 그 값을 바꾸는 건 여러분 프로세스가 아니다(코인브릿지
   봇과 마크 플러그인이다). 캐시하면 반드시 틀려진다 — 표시 직전에 `getAccount()`.
2. **자체 화폐/잔액 테이블을 새로 만들지 말 것.** 그 순간 단일 경제가 깨진다.
   여러분 DB에는 돈이 아닌 것(미니게임 상태, 쿨다운, 봇 설정)만 남긴다.
3. **숫자를 하드코딩하지 말 것.** 보여줄 배수·캡이 필요하면 `getConfigValue()`로
   `economy_config`에서 읽어라 (30초 캐시). 운영자가 값을 바꾸면 같이 움직인다.

자세한 근거와 키 발급·보안 정책: [fullmoon-docs/docs/policies.md](https://github.com/Fullmoon-OSS/fullmoon-docs/blob/main/docs/policies.md)

## API 요약 (자세한 스펙: fullmoon-economy-api README)

전부 `GET`이다. 다른 메서드는 405.

| 엔드포인트 | 용도 |
|---|---|
| `/v1/accounts/:id` (+`/transactions`) | 잔액·거래내역 |
| `/v1/accounts/by-mc/:username` | MC 사용자명 기반 지갑 (런처용) |
| `/v1/leaderboard` | 순위 |
| `/v1/config` | 공유 밸런스 값 (배수·캡) — 읽기 전용 |
| `/v1/overview` `/v1/stats/daily` `/v1/transactions/recent` `/v1/casino/today` | 대시보드 집계 |

에러 코드: `401` 키 문제(운영자 문의) · `404` 없음 · `405` 쓰기 시도 ·
`429` 레이트리밋(기본 60req/10s — 필요하면 상향 요청).

클라이언트 예외 모델: `401/403/429/5xx`는 **던진다**(운영 문제라 크게 실패해야
눈에 띈다), `404`는 `null`/빈 배열로 돌려준다(정상적인 업무 결과).

## 통합 등록 — 플러그인 마켓

이 SDK·API 위에 만든 봇·대시보드·도구는
[INTEGRATIONS.md](./INTEGRATIONS.md) 카탈로그에 등록할 수 있다. 풀문 생태계의
공식 목록이며, 등록 절차는 [CONTRIBUTING.md](./CONTRIBUTING.md)에 있다.

## 파일 안내

| 파일 | 내용 |
|---|---|
| `economyClient.js` | 복붙용 읽기 클라이언트 (설정 캐시, 에러 구분 내장) |
| `examples/balance-and-ranking.js` | 잔액·거래내역·랭킹 표시 |
| `examples/dashboard-poller.js` | 경제 대시보드 데이터 수집 (키 하나로 전부) |
| `test/client.test.js` | 클라이언트 계약 테스트 (스텁 서버 기반, 무DB) |
| `registry/integrations.json` | 통합 카탈로그 데이터 |
| `INTEGRATIONS.md` | 통합 등록 절차·카탈로그 |

## FAQ

- **Q. 내 봇 DB는 이제 뭘 저장하나?** 돈이 아닌 것 전부 — 미니게임 상태, 쿨다운,
  봇 설정 등.
- **Q. 유저가 우리 봇에서 번 걸 코인으로 주고 싶다.** API로는 못 준다. 운영자와
  합의해서 코인브릿지 봇 안에 수급처를 만드는 방식으로 간다.
- **Q. 원장이 방금 바뀌었는데 내 화면은 언제 반영되나?** 즉시. 캐시가 없고 전부
  같은 DB의 같은 행이다.

## 개발

```bash
npm test                 # node --test — 스텁 서버 기반 계약 테스트
npm run validate:registry # 통합 카탈로그 스키마 검증 (CI도 돌린다)
```

## 라이선스

[MIT](./LICENSE)
