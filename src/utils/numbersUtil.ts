import BigNumber from "bignumber.js";

export function setDecimals(value: BigNumber | undefined, decimals: number): BigNumber | undefined {
  if (!decimals || value === undefined) {
    return value;
  }

  return value.multipliedBy(Math.pow(10, decimals * -1));
}

export function toBigNumber(value?: string | number | BigNumber): BigNumber | undefined {
  if (value === undefined) {
    return value;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "number") {
    return new BigNumber(value);
  }

  return value as BigNumber;
}

export function sumBigNumberBy<T>(collection: T[], iteratee: (value: T) => BigNumber): BigNumber {
  let acc = new BigNumber(0);
  for (const item of collection) {
    acc = acc.plus(iteratee(item));
  }
  return acc;
}
