import BigNumber from "bignumber.js";

type BNInput = BigNumber | string | number | bigint;

export function decimalize(value: BigNumber, decimals?: number): BigNumber;
export function decimalize(value: BigNumber | undefined, decimal?: number): BigNumber | undefined;
export function decimalize(value: BigNumber | undefined, decimals = 0): BigNumber | undefined {
  if (!decimals || value === undefined) return value;
  return value.shiftedBy(decimals * -1);
}

export function undecimalize(value: BigNumber, decimals?: number): BigNumber {
  if (!decimals && !value.decimalPlaces()) return value;
  return value.shiftedBy(decimals ?? value.decimalPlaces() ?? 0);
}

export function bn(value: BNInput): BigNumber;
export function bn(value: BNInput | undefined): BigNumber | undefined;
export function bn(value?: BNInput): BigNumber | undefined {
  const t = typeof value;
  if (t === "undefined") return undefined;
  return BigNumber(t === "bigint" ? String(value) : (value as BigNumber.Value));
}

/**
 * Convert a value to a big number with a specified number of decimals.
 */
export function dbn(value: BNInput | bigint, decimal?: number): BigNumber;
export function dbn(value: BNInput | bigint | undefined, decimal?: number): BigNumber | undefined;
export function dbn(value: BNInput | bigint | undefined, decimal?: number): BigNumber | undefined {
  return decimalize(bn(typeof value === "bigint" ? value.toString() : value), decimal);
}

export function sumBy<T>(collection: T[], iteratee: (value: T) => BigNumber.Value): BigNumber {
  let acc = bn(0);
  for (const item of collection) acc = acc.plus(iteratee(item));

  return acc;
}
