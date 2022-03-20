import { COLL_PREFIX, MIN_COLL_LENGTH, MIN_TUPLE_LENGTH, TUPLE_PREFIX } from "@/constants/ergo";
import { isEmpty } from "lodash";

export function isColl(input: string): boolean {
  return !isEmpty(input) && input.startsWith(COLL_PREFIX) && input.length >= MIN_COLL_LENGTH;
}

export function isTuple(input: string): boolean {
  return !isEmpty(input) && input.startsWith(TUPLE_PREFIX) && input.length >= MIN_TUPLE_LENGTH;
}

export function decodeColl(input: string): string | undefined {
  if (!isColl(input)) {
    return;
  }

  return decodeString(input, COLL_PREFIX.length);
}

function decodeString(input: string, position: number): string | undefined {
  const [start, length] = getCollSpan(input, position);
  if (!length) {
    return;
  }

  return Buffer.from(input.slice(start, start + length), "hex").toString("utf8");
}

function getCollSpan(input: string, start: number): [start: number, length: number | undefined] {
  let len = parseInt(input.slice(start, (start += 2)), 16);
  if (isNaN(len) || !len) {
    return [start, undefined];
  }

  return [start, len * 2];
}

export function decodeCollTuple(input: string): (string | undefined)[] {
  if (!isTuple(input)) {
    return [];
  }

  const indexes: number[] = [];
  let cursor = TUPLE_PREFIX.length;
  let readNext = true;

  do {
    readNext = input.startsWith(COLL_PREFIX, cursor);
    if (readNext) {
      cursor += COLL_PREFIX.length;
    }
  } while (readNext);

  let index, length!: number | undefined;
  do {
    [index, length] = getCollSpan(input, cursor);
    if (length) {
      indexes.push(cursor);
      cursor = index + length;
    }
  } while (length);

  return indexes.map((index) => decodeString(input, index));
}
