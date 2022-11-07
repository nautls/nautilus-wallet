import { BigNumberType } from "@/types/internal";
import BigNumber from "bignumber.js";

export function decimalize(value: BigNumberType, decimals: number): BigNumber;
export function decimalize(
  value: BigNumberType | undefined,
  decimals: number
): BigNumber | undefined;
export function decimalize(
  value: BigNumberType | undefined,
  decimals: number
): BigNumber | undefined {
  if (!decimals || value === undefined) {
    return value as BigNumber;
  }

  return value.shiftedBy(decimals * -1);
}

export function undecimalize(value: BigNumberType, decimals?: number): BigNumber {
  if (!decimals) {
    return value as BigNumber;
  }

  return value.shiftedBy(decimals);
}

export function toBigNumber(value: string | number | bigint | BigNumberType): BigNumber;
export function toBigNumber(
  value?: string | number | bigint | BigNumberType
): BigNumber | undefined;
export function toBigNumber(
  value?: string | number | bigint | BigNumberType
): BigNumber | undefined {
  if (value === undefined) {
    return value;
  }

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

export function sumBigNumberBy<T>(
  collection: T[],
  iteratee: (value: T) => BigNumberType
): BigNumber {
  let acc = new BigNumber(0);
  for (const item of collection) {
    acc = acc.plus(iteratee(item));
  }
  return acc;
}

export function isZero(value?: string | number | BigNumberType): boolean {
  if (value === undefined) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "number") {
    return value === 0;
  } else if (valueType === "string") {
    return new BigNumber(value).isZero();
  }

  return (value as BigNumberType).isZero();
}
