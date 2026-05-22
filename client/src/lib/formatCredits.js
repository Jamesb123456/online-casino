export const CURRENCY_NAME = import.meta.env.VITE_CURRENCY_NAME || 'Credits';

export function formatCredits(n, { withUnit = true } = {}) {
  const num = typeof n === 'string' ? Number(n) : n;

  if (num === null || num === undefined || Number.isNaN(num)) {
    return withUnit ? `0 ${CURRENCY_NAME}` : '0';
  }

  const isInteger = Number.isInteger(num);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  });

  return withUnit ? `${formatted} ${CURRENCY_NAME}` : formatted;
}
