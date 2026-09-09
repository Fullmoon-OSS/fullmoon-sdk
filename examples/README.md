# 데모 시나리오와 예제

"실제 개발자가 만들고 싶은 것"을 시나리오로 먼저 정의하고, 데모를 직접
만들면서 부족한 API를 발견해 추가하는 방식으로 이 생태계가 자라요.
아래 5개 시나리오가 그 첫 사례고, 시나리오에서 태어난 API도 함께 적어뒀어요.

| # | 시나리오 | 데모 | 데모가 이끌어낸 API |
|---|---|---|---|
| 1 | 서버 사이트에 붙이는 **미니 지갑 위젯** (MC 닉네임으로 잔액·랭킹·최근 내역) | `wallet-widget.html` | 계정 응답에 `rank` 필드 추가 |
| 2 | 플레이어 **거래 내역 CSV 내보내기** (정산·감사) | `ledger-export.mjs` | `before` id 커서 + 항목 `id`/`nextBefore` (페이지네이션) |
| 3 | **이벤트 타이머 봇**의 데이터 소스 (남은 시간 표시) | `event-tracker.mjs` | `GET /v1/events` 신설 |
| 4 | **길드 랭킹 게시판** (기금·멤버 수) | `guild-board.mjs` | `GET /v1/guilds` 신설 |
| 5 | **카지노 건전성 모니터** (일별 순소각) | `casino-monitor.mjs` | `GET /v1/casino/history?days=` 신설 |

모든 데모는 의존성 0이고 부모 디렉터리의 `economyClient.js`를 사용해요.
새 시나리오를 만들다가 API가 부족하면 — 이슈로 제안하세요. 같은 방식으로
반영해요.

## 실행

전부 `ECONOMY_API_KEY` 환경변수가 필요해요 (없으면
[키 발급 이슈](https://github.com/Fullmoon-OSS/fullmoon-sdk/issues/new?template=key-request.yml)로
신청하세요).

```bash
node event-tracker.mjs            # 이벤트 목록 1회 출력
node event-tracker.mjs --watch    # 60초마다 갱신
node guild-board.mjs              # 길드 랭킹 표
node ledger-export.mjs 123456789 out.csv   # 전체 내역 CSV
node casino-monitor.mjs 30        # 최근 30일 카지노 건전성
```

`wallet-widget.html`은 브라우저용이라 그냥 열면 돼요:
`wallet-widget.html?player=MC이름&key=API키`

## 유의사항

- 데모는 교육용 최소 구현이에요. 실서비스에는 재시도·캐시 정책을 상황에
  맞게 더하세요 (단, 3가지 철칙은 그대로).
- `wallet-widget.html`은 API 키가 브라우저에 노출되는 구조예요. 운영자가
  키를 아는 페이지에서만 쓰거나, 리버스 프록시가 헤더를 붙이도록 구성하세요.
