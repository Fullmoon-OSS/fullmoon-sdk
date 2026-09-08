// 예시 2 — 경제 대시보드 데이터 수집 (키 하나면 충분)
// 웹 대시보드/모니터링 봇이 이 5개만 폴링하면 봇 내부 /경제현황과
// 정의상 같은 숫자를 얻는다 (서버가 같은 분류 SQL을 쓰기 때문).

import { EconomyClient } from '../economyClient.js';

const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });

export async function collectDashboardSnapshot() {
  const [overview, daily, feed, casino, config] = await Promise.all([
    eco.getOverview(),            // 총공급량·계정수·오늘 mint/burn/casinoNet + 봇별 분해
    eco.getDailyStats(30),        // 30일 시계열 → 차트
    eco.getRecentTransactions(50),// 라이브 거래 피드 (폴링 ≥ 5s 권장)
    eco.getCasinoToday(),         // 게임별 베팅/지급/순소각
    eco.getConfigMap(),           // 현재 밸런스 노브 (배수·캡)
  ]);

  return {
    supply: overview.totalSupply,
    accounts: overview.accounts,
    today: overview.today,               // { mint, burn, casinoNet, net }
    perBot: overview.bySource,           // [{ source: 'bot:달빛'..., faucet, sink, net }]
    series: daily.days,                  // [{ date, mint, burn, net, activeAccounts }]
    liveFeed: feed.transactions,
    casino: casino.games,
    knobs: Object.fromEntries(config),   // { 'reward.multiplier': 1, ... }
  };
}

// 배수(reward.multiplier) 같은 노브는 읽기만 됩니다. 값을 바꾸는 건 운영자가
// 코인브릿지 봇 쪽에서 하고, 여기 폴러는 30초 안에 새 값을 보게 됩니다.
