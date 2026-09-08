# AGENTS.md — 이 레포에서 일하는 에이전트용 (짧은 불변식)

- `economyClient.js`는 의존성 0을 유지한다. Node 18+ 전역 API만(fetch,
  AbortSignal.timeout). 패키지 추가 금지.
- 쓰기 메서드는 존재하지 않는다(grant/revoke/transfer/setConfigValue 등은
  `test/client.test.js`가 부재를 핀다). API가 읽기 전용이라 재도입 불가.
- 동작을 바꾸면 `test/client.test.js` 계약 테스트를 함께 갱신한다.
  `npm test` + `npm run validate:registry`가 CI 게이트다.
- `registry/modules.json` 수정 시 `registry/modules.schema.json`과
  `MODULES.md`의 규칙을 따른다. 등록 PR의 `verified`는 항상 false.
- 이 레포의 공개 문서(README, MODULES, 카탈로그 소개)는 친절한 해요체
  (별도 지시 없으면 무조건). 표·코드 블록은 예외.
- 커밋: Conventional Commits. 브랜치: `<type>/<slug>`.
- 정확한 근거: README.md, CONTRIBUTING.md, policies(fullmoon-docs).
