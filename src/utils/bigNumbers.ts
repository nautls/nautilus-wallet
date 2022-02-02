import BigNumber from "bignumber.js";

export function setDecimals(value: BigNumber, decimals: number): BigNumber;
export function setDecimals(value: BigNumber | undefined, decimals: number): BigNumber | undefined;
export function setDecimals(value: BigNumber | undefined, decimals: number): BigNumber | undefined {
  if (!decimals || value === undefined) {
    return value;
  }
  return value.multipliedBy(Math.pow(10, decimals * -1));
}

export function removeDecimals(value: BigNumber, decimals: number): BigNumber {
  if (!decimals) {
    return value;
  }
  return value.multipliedBy(Math.pow(10, decimals));
}

export function toBigNumber(value?: string | number | bigint | BigNumber): BigNumber | undefined {
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

export function sumBigNumberBy<T>(collection: T[], iteratee: (value: T) => BigNumber): BigNumber {
  let acc = new BigNumber(0);
  for (const item of collection) {
    acc = acc.plus(iteratee(item));
  }
  return acc;
}

export function isZero(value?: string | number | BigNumber): boolean {
  if (value === undefined) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "number") {
    return value === 0;
  } else if (valueType === "string") {
    return new BigNumber(value).isZero();
  }

  return (value as BigNumber).isZero();
}
