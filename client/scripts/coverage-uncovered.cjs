const fs = require('fs');
const lcov = fs.readFileSync('coverage/lcov.info', 'utf8');
const blocks = lcov.split('end_of_record');
const targets = [
  'TournamentsAdminPage', 'TransactionsPage', 'RewardsPage', 'AlertsPage',
  'HousePage', 'SettingsPage', 'GamesConfigPage', 'ChatModerationPage',
  'HouseTrendsPage', 'LoginRewardsConfigPage', 'ProfilePage', 'VerifyPage',
  'GamesPage', 'LeaderboardPage', 'LoginPage', 'TournamentsPage'
];
for (const b of blocks) {
  const sfLine = b.split('\n').find((l) => l.startsWith('SF:'));
  if (!sfLine) continue;
  const sf = sfLine.slice(3).trim();
  const base = sf.split(/[\\/]/).pop();
  const stem = base.replace(/\.jsx$/, '');
  if (!targets.includes(stem)) continue;
  const uncov = [];
  for (const ln of b.split('\n')) {
    const m = ln.match(/^DA:(\d+),0$/);
    if (m) uncov.push(m[1]);
  }
  const buncov = [];
  for (const ln of b.split('\n')) {
    const m = ln.match(/^BRDA:(\d+),(\d+),(\d+),(\d+|-)$/);
    if (m && (m[4] === '0' || m[4] === '-')) buncov.push(`${m[1]}b${m[2]}.${m[3]}`);
  }
  console.log(stem, '| uncov-lines:', uncov.join(',') || 'NONE');
  console.log('  uncov-branches:', buncov.join(',') || 'NONE');
}
