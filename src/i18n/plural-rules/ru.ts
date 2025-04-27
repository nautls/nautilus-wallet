const enum PluralForm {
  Zero = 0,
  Singular = 1,
  Paucal = 2,
  Plural = 3
}

/**
 * Russian pluralization rules
 *  - 1, 21, 31… → Singular
 *  - 2–4, 22–24… → Paucal
 *  - 0, 5–20, 11–14, … → Plural
 */
export function russianPluralRules(value: number, optsLength: 3 | 4): number {
  const abs = Math.abs(value); // in case of negative numbers
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  let form: PluralForm;

  if (abs === 0) {
    form = PluralForm.Zero;
  } else if (mod100 >= 11 && mod100 <= 14) {
    // 11-14 are always plural
    form = PluralForm.Plural;
  } else if (mod10 === 1) {
    form = PluralForm.Singular;
  } else if (mod10 >= 2 && mod10 <= 4) {
    form = PluralForm.Paucal;
  } else {
    form = PluralForm.Plural;
  }

  return resolve(form, optsLength);
}

/**
 * Resolve the plural form to the correct index based on the length of the key options
 *
 * - If `optsLength` is 3, the pluralization options exclude zero and start with singular.
 * - If `optsLength` is 4, the pluralization options include zero, singular, paucal, and plural.
 *
 * implicit zero handling:            [0] singular | [1] paucal | [2] plural
 * explicit zero handling: [0] zero | [1] singular | [2] paucal | [3] plural
 */
function resolve(form: PluralForm, optsLength: 3 | 4): number {
  const hasZero = optsLength === 4;
  if (form === PluralForm.Zero) return hasZero ? 0 : 2;
  return hasZero ? form : form - 1;
}
