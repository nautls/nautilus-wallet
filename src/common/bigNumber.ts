import { BigNumber } from "bignumber.js";

export function decimalize(value: BigNumber, decimals?: number): BigNumber;
export function decimalize(value: BigNumber | undefined, decimal?: number): BigNumber | undefined;
export function decimalize(value: BigNumber | undefined, decimals = 0): BigNumber | undefined {
  if (!decimals || value === undefined) return value;
  return value.shiftedBy(decimals * -1);
}

export function undecimalize(value: BigNumber, decimals?: number): BigNumber {
  if (!decimals) return value;
  return value.shiftedBy(decimals);
}

export function bn(value: BigNumber.Value): BigNumber;
export function bn(value: BigNumber.Value | undefined): BigNumber | undefined;
export function bn(value?: BigNumber.Value): BigNumber | undefined {
  if (value === undefined) return undefined;
  return BigNumber(value);
}

export function sumBy<T>(collection: T[], iteratee: (value: T) => BigNumber.Value): BigNumber {
  let acc = bn(0);
  for (const item of collection) acc = acc.plus(iteratee(item));

  return acc;
}
