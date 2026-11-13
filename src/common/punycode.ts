const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 0x80;

/** Punycode (RFC 3492) of a label, without the `xn--` prefix. */
export function punycode(label: string): string {
  const codePoints = [...label].map((character) => character.codePointAt(0)!);
  const basic = codePoints.filter((point) => point < INITIAL_N);
  let output = String.fromCharCode(...basic) + (basic.length ? "-" : "");
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  let handled = basic.length;

  while (handled < codePoints.length) {
    const next = Math.min(...codePoints.filter((point) => point >= n));
    delta += (next - n) * (handled + 1);
    n = next;

    for (const point of codePoints) {
      if (point < n) delta++;
      if (point !== n) continue;

      let q = delta;
      for (let k = BASE; ; k += BASE) {
        const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
        if (q < t) break;
        output += digit(t + ((q - t) % (BASE - t)));
        q = Math.floor((q - t) / (BASE - t));
      }

      output += digit(q);
      bias = adapt(delta, handled + 1, handled === basic.length);
      delta = 0;
      handled++;
    }

    delta++;
    n++;
  }

  return output;
}

function digit(value: number): string {
  return String.fromCharCode(value < 26 ? 97 + value : 22 + value);
}

function adapt(delta: number, points: number, first: boolean): number {
  delta = first ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / points);

  let k = 0;
  for (; delta > ((BASE - T_MIN) * T_MAX) >> 1; k += BASE) {
    delta = Math.floor(delta / (BASE - T_MIN));
  }

  return k + Math.floor(((BASE - T_MIN + 1) * delta) / (delta + SKEW));
}
