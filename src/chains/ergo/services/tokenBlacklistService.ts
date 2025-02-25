import { safeFetch } from "@/common/networking";

const SIGMANAUTS_BLACKLIST_URL =
  "https://raw.githubusercontent.com/sigmanauts/token-id-blacklist/main/blacklist.json";

export type ErgoTokenBlacklist = {
  nsfw: string[];
  scam: string[];
};

class ErgoTokensBlacklist {
  async fetch(): Promise<ErgoTokenBlacklist> {
    const data = await safeFetch<ErgoTokenBlacklist>(SIGMANAUTS_BLACKLIST_URL);
    return data ?? { nsfw: [], scam: [] };
  }
}

export const ergoTokenBlacklistService = new ErgoTokensBlacklist();
