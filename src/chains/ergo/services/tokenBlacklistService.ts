import yaml from "yaml";

const BLACKLIST_URI =
  "https://raw.githubusercontent.com/sigmanauts/token-id-blacklist/main/blacklist.yaml";

export type ErgoTokenBlacklist = {
  nsfw: string[];
  scam: string[];
};

class ErgoTokensBlacklist {
  async fetch(): Promise<ErgoTokenBlacklist> {
    const response = await fetch(BLACKLIST_URI);
    const data = yaml.parse(await response.text());
    return { nsfw: data.NSFW || [], scam: data.Scam || [] };
  }
}

export const ergoTokenBlacklistService = new ErgoTokensBlacklist();
