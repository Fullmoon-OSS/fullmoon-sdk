// 시나리오 2 — "거래 내역 CSV 내보내기" (정산·감사 도구).
//
// 한 플레이어의 전체 거래 내역을 CSV로 뽑아주는 도구. 예전 API는 최근
// 50건만 줬기 때문에 전체 내보내기가 불가능했고, 그 갭을 id 커서
// (before 파라미터 + 응답의 nextBefore)로 메꿨다.
//
// 실행: ECONOMY_API_KEY=... node ledger-export.mjs <디스코드ID> [출력.csv]
//
// 페이지네이션: 응답의 nextBefore(이번 페이지에서 가장 오래된 항목 id)를
// 다음 요청의 before로 넘기면 그 앞 페이지가 나온다. null이면 끝.

import { writeFileSync } from 'node:fs';
import { EconomyClient } from '../economyClient.js';

const discordId = process.argv[2];
const outFile = process.argv[3] || `ledger-${discordId}.csv`;

if (!discordId) {
  console.error('사용법: node ledger-export.mjs <디스코드ID> [출력.csv]');
  process.exit(1);
}
if (!process.env.ECONOMY_API_KEY) {
  console.error('ECONOMY_API_KEY 가 없어요. [API 키 발급 이슈]로 신청하세요.');
  process.exit(1);
}

const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });

const rows = [];
let before;
let pages = 0;

// nextBefore가 null이 될 때까지 뒤에서 한 페이지씩 거슬러 올라간다.
for (;;) {
  const page = await eco
    .getTransactionsPage(discordId, { limit: 50, before })
    .catch((err) => {
      console.error('조회 실패:', err.message);
      process.exit(1);
    });
  // null = 그 디스코드 ID의 계정이 없다는 뜻 (빈 CSV를 "성공"으로 저장하지 않는다).
  if (page === null) {
    console.error(`디스코드 ID ${discordId} 의 계정이 없어요. ID를 확인해 주세요.`);
    process.exit(1);
  }
  if (page.transactions.length === 0) break;
  rows.push(...page.transactions);
  pages += 1;
  process.stdout.write(`\r${rows.length}건 읽는 중 (페이지 ${pages})…`);
  if (page.nextBefore === null) break;
  before = page.nextBefore;
}
process.stdout.write('\n');

const header = 'id,일시,금액,잔액,사유,출처,참조ID';
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; // CSV quote-escape
const csv = [
  header,
  ...rows.map((t) =>
    [t.id, q(t.createdAt), t.delta, t.balanceAfter, q(t.reason), q(t.source), q(t.refId ?? '')].join(',')
  ),
].join('\n');

writeFileSync(outFile, '\uFEFF' + csv + '\n', 'utf8'); // BOM: Excel에서 한글 안 깨짐
console.log(`${rows.length}건을 ${outFile} 로 저장했어요 (${pages} 페이지).`);
