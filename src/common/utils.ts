import { ERG_TOKEN_ID } from "@/constants/ergo";

export function isErg(tokenId: string): boolean {
  return tokenId === ERG_TOKEN_ID;
}
