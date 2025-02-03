import { ERG_TOKEN_ID } from "@/constants/ergo";

export function isErg(tokenId: string): boolean {
  return tokenId === ERG_TOKEN_ID;
}

type ErrorLike = { message: string };

export function extractErrorMessage(error: unknown): string {
  return typeof error === "string"
    ? error
    : typeof (error as ErrorLike).message === "string"
      ? (error as ErrorLike).message
      : "Unknown error";
}
