import { MaybeRefOrGetter, ref, Ref, toValue } from "vue";
import { withMessage, withParams } from "@regle/rules";
import { watchDebounced } from "@vueuse/core";
import type { Score, ZxcvbnFactory } from "@zxcvbn-ts/core";

/** Scores 0 and 1 (under ~10⁶ guesses) are blocked, the rest is only advice. */
export const MIN_PASSWORD_SCORE = 2;

/** Words anyone targeting a Nautilus user would try first. */
const APP_WORDS = ["nautilus", "ergo", "wallet"];

let scorer: Promise<ZxcvbnFactory> | undefined;

function loadScorer(): Promise<ZxcvbnFactory> {
  scorer ??= (async () => {
    const [{ ZxcvbnFactory }, common] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common")
    ]);

    return new ZxcvbnFactory({
      dictionary: common.dictionary,
      graphs: common.adjacencyGraphs
    });
  })();

  return scorer;
}

/**
 * Estimates how guessable `password` is, as a zxcvbn score from 0 to 4. `score` is
 * undefined while the password is empty or the scorer is still loading.
 *
 * @param userInputs words that make a password easy to guess for this user, such as
 * the wallet name.
 */
export function usePasswordStrength(
  password: Ref<string>,
  userInputs: MaybeRefOrGetter<string[]> = []
) {
  const score = ref<Score>();
  let factory: ZxcvbnFactory | undefined;

  function update() {
    if (!factory || !password.value) {
      score.value = undefined;
      return;
    }

    const inputs = [...APP_WORDS, ...toValue(userInputs).filter(Boolean)];
    // score what the key is derived from
    score.value = factory.check(password.value.normalize("NFKC"), inputs).score;
  }

  /** Waits for the scorer and returns the current password's score. */
  async function evaluate(): Promise<Score | undefined> {
    factory ??= await loadScorer();
    update();
    return score.value;
  }

  evaluate();
  watchDebounced([password, () => toValue(userInputs)], update, { debounce: 150 });

  return { score, evaluate };
}

/** A regle rule that fails for passwords below {@link MIN_PASSWORD_SCORE}. */
export function strongPassword(score: Ref<Score | undefined>, message: () => string) {
  return withMessage(
    withParams(
      (_: unknown, current: Score | undefined) =>
        current === undefined || current >= MIN_PASSWORD_SCORE,
      [score]
    ),
    message
  );
}
