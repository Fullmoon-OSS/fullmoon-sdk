# Fullmoon Economy SDK

> 풀문(Fullmoon) 네트워크 공유 경제 API의 공식 클라이언트예요. 의존성 0, Node 18+, ESM.
>
> 목표: **각 봇이 자기 화폐를 만들지 않고**, 마크 경제서버의 원장 하나를 같이 보는 거예요.

| 관련 레포 | 내용 |
|---|---|
| [fullmoon-docs](https://github.com/Fullmoon-OSS/fullmoon-docs) | 시작 가이드·정책 등 전체 문서예요 |
| [fullmoon-economy-api](https://github.com/Fullmoon-OSS/fullmoon-economy-api) | 읽기 전용 API 서버 소스예요 |
| [fullmoon-market](https://github.com/Fullmoon-OSS/fullmoon-market) | 통합 카탈로그 사이트 — [market.fullmoon.ink](https://market.fullmoon.ink) |
| [fullmoon-client](https://github.com/RedHatOnTop/fullmoon-client) | 풀문 전용 마인크래프트 클라이언트예요 |

## 무엇을 할 수 있나요? (그리고 없나요?)

경제의 단일 진실 원천은 마크 경제서버의 PostgreSQL이에요. 여기에 **쓰는** 주체는
코인브릿지 봇과 마크 플러그인 둘뿐이고, 외부 봇은 economy-api로 **읽어요**.

```
 당신의 봇 ──HTTP GET──┐
 대시보드   ──HTTP GET──┤→ economy-api ──읽기만──→ PostgreSQL
                        │                          ↑ 쓰기: 코인브릿지 봇 / MC 플러그인
```

- ✅ 잔액·거래내역·랭킹·집계(총공급량, 일별 mint/burn, 카지노 순소각)·설정값·
  MC 사용자명 기반 지갑을 조회할 수 있어요
- ❌ 지급/차감/송금, 설정 변경 — **2026-07-12부로 API에서 제거됐어요.**
  호출하면 `405 { error: "economy-api is read-only ..." }`가 돌아와요.

재화를 지급해야 하는 기획이 있으면 API를 뚫으려 하지 말고 운영자에게 말해 주세요.
지급 경로는 봇/플러그인 안에 있어요.

## 시작하기 (5분)

1. **키 발급을 요청해요** — 운영자에게 봇 이름을 알려주면 bearer 키를 줘요.
   스코프는 없어요(키 하나 = 읽기 전부).
2. `economyClient.js`를 봇 프로젝트에 복사해요 (의존성 0, Node 18+). 이 파일 하나가
   SDK 전부예요 — 패키지 설치도 필요 없어요.
3. 환경변수 `ECONOMY_API_KEY`를 설정해요. 접속 주소 기본값은
   **`https://api.fullmoon.ink/economy`** — 어느 호스트에서 돌리든 이거 하나면 돼요.
4. `examples/`를 참고해서 화면을 붙여요.

접속 확인:

```bash
curl -s https://api.fullmoon.ink/economy/v1/health
curl -s -H "Authorization: Bearer $ECONOMY_API_KEY" \
     https://api.fullmoon.ink/economy/v1/overview
```

`429`가 오면 레이트리밋에 걸린 거예요 — 두 계층이 있어요: nginx(IP당 10 req/s,
burst 40)와 앱(키당 기본 60req/10s). 정상 봇 트래픽으로는 닿을 일이 없고, 루프
돌려 긁을 때만 걸려요. 백오프하고 재시도하면 돼요.

```js
import { EconomyClient } from './economyClient.js';
const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });

const acc = await eco.getAccount(userId);          // { balance, linked, mcUsername } | null
const top = await eco.getLeaderboard(10);          // [{ rank, discordId, balance }]
const wal = await eco.getWalletByMc('SteveMan');   // 런처/클라이언트용 — MC 사용자명 기반
```

## 3가지 철칙

1. **잔액을 캐시하지 마세요.** 그 값을 바꾸는 건 여러분 프로세스가 아니에요(코인브릿지
   봇과 마크 플러그인이에요). 캐시하면 반드시 틀려져요 — 표시 직전에 `getAccount()`를
   호출하세요.
2. **자체 화폐/잔액 테이블을 새로 만들지 마세요.** 그 순간 단일 경제가 깨져요.
   여러분 DB에는 돈이 아닌 것(미니게임 상태, 쿨다운, 봇 설정)만 남겨요.
3. **숫자를 하드코딩하지 마세요.** 보여줄 배수·캡이 필요하면 `getConfigValue()`로
   `economy_config`에서 읽어요 (30초 캐시). 운영자가 값을 바꾸면 같이 움직여요.

자세한 근거와 키 발급·보안 정책: [fullmoon-docs/docs/policies.md](https://github.com/Fullmoon-OSS/fullmoon-docs/blob/main/docs/policies.md)

## API 요약 (자세한 스펙: fullmoon-economy-api README)

전부 `GET`이에요. 다른 메서드는 405가 돌아와요.

| 엔드포인트 | 용도 |
|---|---|
| `/v1/accounts/:id` (+`/transactions`) | 잔액·거래내역이에요 |
| `/v1/accounts/by-mc/:username` | MC 사용자명 기반 지갑 (런처용)이에요 |
| `/v1/leaderboard` | 순위예요 |
| `/v1/config` | 공유 밸런스 값 (배수·캡) — 읽기 전용이에요 |
| `/v1/overview` `/v1/stats/daily` `/v1/transactions/recent` `/v1/casino/today` | 대시보드 집계예요 |

에러 코드: `401` 키 문제(운영자 문의) · `404` 없음 · `405` 쓰기 시도 ·
`429` 레이트리밋(기본 60req/10s — 필요하면 상향을 요청하세요).

클라이언트 예외 모델: `401/403/429/5xx`는 **던져요**(운영 문제라 크게 실패해야
눈에 봐요), `404`는 `null`/빈 배열로 돌려줘요(정상적인 업무 결과).

예외가 하나 있어요: `getConfigValue()`는 읽기 실패(401·429·네트워크 오류 포함)를
삼키고 fallback을 돌려줘요 — 설정은 부가 정보라 봇이 죽지 않는 쪽을 택했어요.
대신 값이 오래됐을 수 있어요. 운영 문제를 크게 보고 싶으면 `getConfigMap()`을
직접 쓰세요(이쪽은 정상적으로 던져요).

## 통합 등록 — 플러그인 마켓

이 SDK·API 위에 만든 봇·대시보드·도구는
[market.fullmoon.ink](https://market.fullmoon.ink) 카탈로그에 등록할 수 있어요.
카탈로그 데이터는 이 레포의 [INTEGRATIONS.md](./INTEGRATIONS.md)와
[registry/integrations.json](./registry/integrations.json)이 관리하고, 등록 절차는
[CONTRIBUTING.md](./CONTRIBUTING.md)에 있어요.

## 파일 안내

| 파일 | 내용 |
|---|---|
| `economyClient.js` | 복붙용 읽기 클라이언트예요 (설정 캐시, 에러 구분 내장) |
| `examples/balance-and-ranking.js` | 잔액·거래내역·랭킹 표시 예제예요 |
| `examples/dashboard-poller.js` | 경제 대시보드 데이터 수집 예제예요 (키 하나로 전부) |
| `test/client.test.js` | 클라이언트 계약 테스트예요 (스텁 서버 기반, 무DB) |
| `registry/integrations.json` | 통합 카탈로그 데이터예요 — 마켓 사이트가 이걸 읽어요 |
| `registry/integrations.schema.json` | 카탈로그 항목의 JSON Schema예요 — 도구·LLM이 등록 PR 전 검증에 써요 |
| `INTEGRATIONS.md` | 통합 등록 절차·카탈로그예요 |
| `AGENTS.md` | 에이전트(LLM) 기여자용 불변식 요약이에요 |

## FAQ

- **Q. 내 봇 DB는 이제 뭘 저장하나요?** 돈이 아닌 것 전부요 — 미니게임 상태,
  쿨다운, 봇 설정 같은 것들이요.
- **Q. 유저가 우리 봇에서 번 걸 코인으로 주고 싶어요.** API로는 못 줘요. 운영자와
  합의해서 코인브릿지 봇 안에 수급처를 만드는 방식으로 가요.
- **Q. 원장이 방금 바뀌었는데 내 화면은 언제 반영되나요?** 즉시예요. 캐시가 없고
  전부 같은 DB의 같은 행이거든요.

## 개발

```bash
npm test                 # node --test — 스텁 서버 기반 계약 테스트예요
npm run validate:registry # 통합 카탈로그 스키마 검증이에요 — CI도 돌려요
```

## 라이선스

[MIT](./LICENSE)예요.
