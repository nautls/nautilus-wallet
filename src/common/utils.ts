import { ERG_TOKEN_ID } from "@/constants/ergo";

export function isErg(tokenId: string): boolean {
  return tokenId === ERG_TOKEN_ID;
}

type ErrorLike = { message: string };

export function extractErrorMessage(error: unknown, fallback = "Unknown error"): string {
  return typeof error === "string"
    ? error
    : typeof (error as ErrorLike).message === "string"
      ? (error as ErrorLike).message
      : fallback;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * Generates an array of n unique random integers between start and end (inclusive).
 * Note: This function is not cryptographically secure and should not be used for security-sensitive applications.
 */
export function unsafeDistinctRand(n: number, start: number, end: number): number[] {
  if (n > end - start + 1) {
    throw new Error("Cannot generate more unique numbers than the range allows");
  }

  const numbers = new Set<number>();
  while (numbers.size < n) {
    const num = Math.floor(Math.random() * (end - start + 1)) + start;
    numbers.add(num);
  }

  return Array.from(numbers);
}

export { cn } from "cn";
