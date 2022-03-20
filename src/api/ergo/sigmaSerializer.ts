const COLL_PREFIX = "0e";
const TUPLE_PREFIX = "3c";

export function decodeColl(input: string): string | undefined {
  if (!input || !input.startsWith(COLL_PREFIX) || input.length < 4) {
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
  if (!input || !input.startsWith(TUPLE_PREFIX) || input.length < 4) {
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
