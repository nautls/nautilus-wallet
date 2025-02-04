import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
