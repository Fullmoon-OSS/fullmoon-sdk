# 기여하기

풀문 경제 SDK에 기여하는 방법. 짧게 정리한다.

## 무엇에 기여할 수 있나

- **버그 리포트·기능 제안** — Issues에 올린다. 재현 방법과 기대 동작을 함께.
- **예제 추가** — `examples/`에 실행 가능한 예제로 PR. `node --check`를 통과하고,
  3가지 철칙(README 참고)을 어기면 안 된다.
- **통합 등록** — `INTEGRATIONS.md`의 절차대로 `registry/integrations.json`에 PR.
- **문서 개선** — 틀리거나 빠진 부분은 언제나 환영한다.

## 클라이언트 코드를 고칠 때

- `economyClient.js`는 의존성 0을 유지한다. Node 18+ 전역 API만 쓴다
  (`fetch`, `AbortSignal.timeout`). 패키지를 추가하는 PR은 받지 않는다.
- 에러 모델을 바꾸는 제안(무엇을 던지고 무엇을 null로 돌려주는지)은 기존 통합을
  깨뜨릴 수 있으니, Issue로 먼저 논의한다.
- `test/client.test.js`의 계약 테스트가 원장과 클라이언트의 약속이다. 동작을
  바꾸면 테스트도 같이 갱신한다.

## PR 규칙

- 브랜치 이름: `feat/...`, `fix/...`, `docs/...` 등.
- 커밋은 Conventional Commits 형식.
- CI(클라이언트 테스트 + 레지스트리 검증)가 초록이어야 병합한다.

## 라이선스

MIT를 쓴다. PR을 보내는 순간 기여 내용이 MIT로 공개되는 것에 동의한 것으로 본다.
