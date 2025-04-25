const enum PluralForm {
  Zero = 0,
  Singular = 1,
  Paucal = 2,
  Plural = 3
}

/**
 * Russian pluralization rules
 */
export function russianPluralRules(value: number, optsLength: 3 | 4): number {
  if (value === 0) return resolve(PluralForm.Zero, optsLength);

  const teen = value > 10 && value < 20;
  if (!teen && value % 10 === 1) return resolve(PluralForm.Singular, optsLength);
  if (!teen && value % 10 >= 2 && value % 10 <= 4) return resolve(PluralForm.Paucal, optsLength);
  return resolve(PluralForm.Plural, optsLength);
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
