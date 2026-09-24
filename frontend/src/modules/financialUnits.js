// Six-decimal accounting. Display rounding must never modify balances.
export const UNIT = 1_000_000n;
export const DAY = 86_400_000;
export function units(value) {
  const text = String(value);
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw new Error('Usa un importe válido con hasta seis decimales.');
  const [whole, fraction = ''] = text.split('.');
  const result = BigInt(whole) * UNIT + BigInt(fraction.padEnd(6, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Importe demasiado grande para esta simulación.');
  return result;
}
export const amount = (value) => Number(value) / Number(UNIT);
export const add = (a, b) => amount(units(a) + units(b));
export const subtract = (a, b) => {
  const result = units(a) - units(b);
  if (result < 0n) throw new Error('Saldo insuficiente.');
  return amount(result);
};
export const feeFor = (principal, bps) => amount(units(principal) * BigInt(bps) / 10_000n);
export const displayAmount = (value) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 'No disponible';
  return number > 0 && number < 0.0001 ? '<0.0001' : number.toFixed(4);
};
