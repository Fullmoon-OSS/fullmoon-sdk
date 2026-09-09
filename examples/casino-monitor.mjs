// 시나리오 5 — "카지노 건전성 모니터".
//
// 카지노가 경제에서 돈을 태우는지(디플레이션) 아니면 화폐를 뿌리는지
// 매일 추적한다. casino/today 만 있어서 일별 추이를 못 보던 갭을
// GET /v1/casino/history 로 메꿨다.
//
// 판정 기준: netBurn >= 0 이면 정상(카지노가 돈을 태움). 음수면 인플레이션
// 신호라 운영자 확인이 필요하다.
//
// 실행: ECONOMY_API_KEY=... node casino-monitor.mjs [일수, 기본 30]

import { EconomyClient } from '../economyClient.js';

const days = Number(process.argv[2]) || 30;

if (!process.env.ECONOMY_API_KEY) {
  console.error('ECONOMY_API_KEY 가 없어요. [API 키 발급 이슈]로 신청하세요.');
  process.exit(1);
}

const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });
const history = await eco.getCasinoHistory(Math.min(days, 90)).catch((err) => {
  console.error('조회 실패:', err.message);
  process.exit(1);
});

if (history.length === 0) {
  console.log('최근 카지노 기록이 없어요.');
  process.exit(0);
}

let badDays = 0;
console.log('날짜         베팅       지급       순소각   판정');
console.log('-'.repeat(56));
for (const d of history) {
  const ok = d.netBurn >= 0;
  if (!ok) badDays += 1;
  console.log(
    `${d.date}  ${d.wagered.toLocaleString('ko-KR').padStart(9)}  ` +
    `${d.paidOut.toLocaleString('ko-KR').padStart(9)}  ` +
    `${d.netBurn.toLocaleString('ko-KR').padStart(7)}  ${ok ? 'OK' : '적자!'}`
  );
}
console.log('-'.repeat(56));
console.log(`최근 ${history.length}일 중 적자 ${badDays}일 — ` +
  (badDays === 0 ? '카지노가 정상적으로 돈을 태우고 있어요.' : '운영자 확인이 필요해요.'));
