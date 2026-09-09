// 시나리오 4 — "길드 랭킹 게시판" 데이터 소스.
//
// 길드 기금 랭킹 + 멤버 수를 표로 그려주는 도구. 길드 페이지를 만들다가
// 발견한 갭이 GET /v1/guilds — guilds/guild_members 테이블은 원래 있었는데
// API가 비어 있었음.
//
// 실행: ECONOMY_API_KEY=... node guild-board.mjs

import { EconomyClient } from '../economyClient.js';

if (!process.env.ECONOMY_API_KEY) {
  console.error('ECONOMY_API_KEY 가 없어요. [API 키 발급 이슈]로 신청하세요.');
  process.exit(1);
}

const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });
const guilds = await eco.getGuilds().catch((err) => {
  console.error('조회 실패:', err.message);
  process.exit(1);
});

console.log(`길드 ${guilds.length}개 (기금 순)\n`);
console.log('순위  길드 이름            기금          멤버');
console.log('-'.repeat(52));
guilds.forEach((g, i) => {
  const name = g.name.padEnd(16, ' ');
  const fund = g.fund.toLocaleString('ko-KR').padStart(12, ' ');
  console.log(`${String(i + 1).padStart(3)}  ${name}  ${fund}원  ${String(g.members).padStart(4)}명`);
});
console.log('\n데이터: 풀문 공유 경제 원장 (읽기 전용)');
