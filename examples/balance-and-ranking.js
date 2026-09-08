// 예시 1 — 잔액/거래내역/랭킹을 여러분 봇에서 보여주기
// 핵심 규칙: 잔액을 봇 메모리/DB에 캐시하지 말 것. 표시 직전에 읽는다.
// 잔액을 움직이는 건 코인브릿지 봇과 마크 플러그인뿐이라, 캐시는 반드시 틀려진다.

import { EconomyClient } from '../economyClient.js';

const eco = new EconomyClient({ key: process.env.ECONOMY_API_KEY });

export async function handleBalanceCommand(interaction) {
  const acc = await eco.getAccount(interaction.user.id);
  if (!acc) {
    return interaction.reply({ content: '아직 지갑이 없어요. 활동하면 자동으로 생겨요!', ephemeral: true });
  }
  const recent = await eco.getTransactions(interaction.user.id, 5);
  const lines = recent.map((t) => `\`${t.createdAt.slice(0, 16)}\` ${t.delta >= 0 ? '+' : ''}${t.delta} — ${t.reason}`);
  return interaction.reply({
    content: `💰 잔액: **${acc.balance}**${acc.linked ? ` (MC: ${acc.mcUsername})` : ''}\n${lines.join('\n')}`,
    ephemeral: true,
  });
}

export async function handleRankingCommand(interaction) {
  const top = await eco.getLeaderboard(10);
  const medal = (rank) => ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}.`;
  const lines = top.map((e) => `${medal(e.rank)} <@${e.discordId}> — **${e.balance}**`);
  return interaction.reply({ content: `🏆 부자 순위\n${lines.join('\n')}` });
}
