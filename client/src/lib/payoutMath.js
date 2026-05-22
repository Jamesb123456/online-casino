// Pure RTP preview helpers for the admin payout-table editor.
// All functions return RTP as a fraction (0.96 = 96%). Approximate by design.

export const MIN_HOUSE_EDGE_FRACTION = 0.01;

// Resolve the effective house-edge floor. Pass in a `floor` (number) to
// override the hardcoded default (e.g. read from /api/admin/settings/min_house_edge_floor).
// Falls back to MIN_HOUSE_EDGE_FRACTION when the argument is missing or invalid.
export function resolveHouseEdgeFloor(floor) {
  const n = Number(floor);
  if (!Number.isFinite(n) || n < 0 || n > 1) return MIN_HOUSE_EDGE_FRACTION;
  return n;
}

// Win probability of each known bet type on a 37-slot European wheel.
const betTypeWins = (betType) => {
  switch (betType) {
    case 'STRAIGHT': return 1 / 37;
    case 'SPLIT':    return 2 / 37;
    case 'STREET':   return 3 / 37;
    case 'CORNER':   return 4 / 37;
    case 'FIVE':     return 5 / 37;
    case 'LINE':     return 6 / 37;
    case 'COLUMN':   return 12 / 37;
    case 'DOZEN':    return 12 / 37;
    case 'RED':      return 18 / 37;
    case 'BLACK':    return 18 / 37;
    case 'ODD':      return 18 / 37;
    case 'EVEN':     return 18 / 37;
    case 'LOW':      return 18 / 37;
    case 'HIGH':     return 18 / 37;
    default:         return null;
  }
};

// Average RTP across all bet types in payoutTable. Each bet's RTP =
// winProbability * (multiplier + 1). Unknown bet types use 1/37 (single-number)
// as a conservative default.
export function rouletteRtp(payoutTable, _houseEdge) {
  const keys = Object.keys(payoutTable || {});
  if (keys.length === 0) return 0;
  let total = 0;
  let counted = 0;
  for (const key of keys) {
    const multiplier = Number(payoutTable[key]);
    if (!Number.isFinite(multiplier)) continue;
    const p = betTypeWins(key) ?? (1 / 37);
    total += p * (multiplier + 1);
    counted += 1;
  }
  if (counted === 0) return 0;
  return total / counted;
}

// Wheel: each segment is equally likely; RTP = mean(segment multipliers).
// houseEdge is encoded directly into segments — param kept for API symmetry.
export function wheelRtp(payoutTable, difficulty, _houseEdge) {
  const segments = payoutTable?.[difficulty];
  if (!Array.isArray(segments) || segments.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const v of segments) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    sum += n;
    count += 1;
  }
  if (count === 0) return 0;
  return sum / count;
}

// Plinko: weighted mean of bucket multipliers via binomial probabilities
// for `rows` independent left/right deflections.
export function plinkoRtp(payoutTable, risk, rows, _houseEdge) {
  const buckets = payoutTable?.[risk]?.[String(rows)];
  if (!Array.isArray(buckets) || buckets.length === 0) return 0;
  const n = rows;
  // Build binomial pmf P(X=k) for k=0..n, X~Binomial(n, 0.5).
  // pmf[k] = C(n,k) / 2^n
  const pmf = new Array(n + 1);
  // Compute C(n,k) iteratively to avoid floating issues.
  let c = 1;
  pmf[0] = 1;
  for (let k = 1; k <= n; k += 1) {
    c = (c * (n - k + 1)) / k;
    pmf[k] = c;
  }
  const denom = 2 ** n;
  let rtp = 0;
  // Buckets are indexed 0..n (n+1 buckets). If buckets.length !== n+1, use whichever
  // is smaller — defensive.
  const m = Math.min(buckets.length, n + 1);
  for (let k = 0; k < m; k += 1) {
    const mult = Number(buckets[k]);
    if (!Number.isFinite(mult)) continue;
    rtp += (pmf[k] / denom) * mult;
  }
  return rtp;
}

// Blackjack: rough heuristic. Assumes a typical mix of win/blackjack/push outcomes.
export function blackjackRtp(payoutTable, _houseEdge) {
  const win = Number(payoutTable?.win ?? 0);
  const blackjack = Number(payoutTable?.blackjack ?? 0);
  const push = Number(payoutTable?.push ?? 0);
  // Outcome probabilities (approximate): win ~42%, blackjack ~4.8%, push ~8.5%, loss ~44.7%
  // RTP = 0.42*win + 0.048*blackjack + 0.085*push (loss contributes 0)
  return 0.42 * win + 0.048 * blackjack + 0.085 * push;
}

export function rtpToHouseEdge(rtp) {
  return 1 - rtp;
}
