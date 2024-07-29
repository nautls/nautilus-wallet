import yaml from "yaml";
import { safeFetch } from "@/common/networking";

const SIGMANAUTS_BLACKLIST_URL =
  "https://raw.githubusercontent.com/sigmanauts/token-id-blacklist/main/blacklist.yaml";

type SigmanautsBlackList = { NSFW: string[]; Scam: string[] };

export type ErgoTokenBlacklist = {
  nsfw: string[];
  scam: string[];
};

class ErgoTokensBlacklist {
  async fetch(): Promise<ErgoTokenBlacklist> {
    const data = await safeFetch<SigmanautsBlackList>(SIGMANAUTS_BLACKLIST_URL, { parser: yaml });
    return { nsfw: data?.NSFW || [], scam: data?.Scam || [] };
  }
}

export const ergoTokenBlacklistService = new ErgoTokensBlacklist();
