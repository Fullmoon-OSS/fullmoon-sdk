// 시나리오 3 — "서버에서 이벤트 중이면 알려주는 타이머 봇"의 데이터 소스.
//
// EventScheduler가 띄우는 이벤트(드롭 배율, 파우셋 부스트 등)를 폴링해서
// 남은 시간과 함께 보여준다. 이벤트 타이머 봇을 만들다가 발견한 갭이
// GET /v1/events 였다 — events 테이블은 원래 있었는데 API가 비어 있었음.
//
// 실행: ECONOMY_API_KEY=... node event-tracker.mjs [--watch]
//   --watch 를 붙이면 60초마다 갱신한다.

import { EconomyClient } from '../economyClient.js';

if (!process.env.ECONOMY_API_KEY) {
  console.error('ECONOMY_API_KEY 가 없어요. [API 키 발급 이슈]로 신청하세요:');
  console.error('https://github.com/Fullmoon-OSS/fullmoon-sdk/issues/new?template=key-request.yml');
  process.exit(1);
}

const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });

async function print() {
  const events = await eco.getEvents();
  console.clear();
  console.log(`이벤트 ${events.length}건 — ${new Date().toLocaleString('ko-KR')}`);
  console.log('='.repeat(56));
  if (events.length === 0) {
    console.log('진행 중인 이벤트가 없어요.');
    return;
  }
  for (const e of events) {
    const remain = e.endsAt
      ? `~ ${Math.max(0, Math.ceil((new Date(e.endsAt) - Date.now()) / 3600_000))}시간 남음`
      : '종료 시간 미정';
    console.log(`[${e.kind}] ${e.name}  ×${e.multiplier}  (${remain})`);
  }
}

if (process.argv.includes('--watch')) {
  const tick = () => print().catch((err) => console.error('조회 실패:', err.message));
  tick();
  setInterval(tick, 60_000);
} else {
  await print().catch((err) => {
    console.error('조회 실패:', err.message);
    process.exit(1);
  });
}
