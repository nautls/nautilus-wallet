export function parseRegister(input: string): string | undefined {
  if (!input || typeof input !== "string" || !input.startsWith("0e") || input.length < 4) {
    return;
  }

  let body = input.slice(2);
  let len = 0;
  let readNext = true;
  do {
    const lenChunk = parseInt(body.slice(0, 2), 16);
    body = body.slice(2);
    if (isNaN(lenChunk)) {
      return;
    }
    readNext = (lenChunk & 0x80) !== 0;
    len = 128 * len + (lenChunk & 0x7f);
  } while (readNext);

  if (2 * len < body.length) {
    return;
  }

  return Buffer.from(body.slice(0, 2 * len), "hex").toString("utf8");
}
