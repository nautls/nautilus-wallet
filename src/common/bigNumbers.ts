import { BigNumber } from "bignumber.js";

export function decimalize(value: BigNumber, decimals?: number): BigNumber;
export function decimalize(value: BigNumber | undefined, decimal?: number): BigNumber | undefined;
export function decimalize(value: BigNumber | undefined, decimals = 0): BigNumber | undefined {
  if (!decimals || value === undefined) return value as BigNumber;
  return value.shiftedBy(decimals * -1);
}

export function undecimalize(value: BigNumber, decimals?: number): BigNumber {
  if (!decimals) return value;
  return value.shiftedBy(decimals);
}

export function toBigNumber(value: BigNumber.Value | bigint): BigNumber;
export function toBigNumber(value: BigNumber.Value | bigint | undefined): BigNumber | undefined;
export function toBigNumber(value?: BigNumber.Value | bigint): BigNumber | undefined {
  if (value === undefined) return value;

  const valueType = typeof value;
  if (valueType === "bigint") {
    return new BigNumber(value.toString());
  } else if (valueType === "string") {
    return new BigNumber(value as string);
  } else if (valueType === "number") {
    return new BigNumber(value as number);
  }

  return value as BigNumber;
}

export function sumBy<T>(collection: T[], iteratee: (value: T) => BigNumber.Value): BigNumber {
  let acc = BigNumber(0);
  for (const item of collection) acc = acc.plus(iteratee(item));

  return acc;
}
