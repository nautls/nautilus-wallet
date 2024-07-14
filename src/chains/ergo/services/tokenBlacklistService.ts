import yaml from "yaml";
import { log } from "@/common/logger";

const SIGMANAUTS_BLACKLIST_URL =
  "https://raw.githubusercontent.com/sigmanauts/token-id-blacklist/main/blacklist.yaml";

type SigmanautsBlackList = { NSFW: string[]; Scam: string[] };
type ParserLike = { parse: (text: string) => unknown };

async function safeFetch<T>(url: string, parser: ParserLike = JSON): Promise<T | undefined> {
  try {
    const response = await fetch(url);
    return parser.parse(await response.text()) as T;
  } catch (e) {
    log.error(`Failed to fetch '${url}'`, e);
  }
}

export type ErgoTokenBlacklist = {
  lastUpdated?: number;
  nsfw: string[];
  scam: string[];
};

class ErgoTokensBlacklist {
  async fetch(): Promise<ErgoTokenBlacklist> {
    const data = await safeFetch<SigmanautsBlackList>(SIGMANAUTS_BLACKLIST_URL, yaml);
    return { nsfw: data?.NSFW || [], scam: data?.Scam || [] };
  }
}

export const ergoTokenBlacklistService = new ErgoTokensBlacklist();
