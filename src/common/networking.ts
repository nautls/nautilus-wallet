import { ensureDefaults, isDefined, some } from "@fleet-sdk/common";
import { log } from "@/common/logger";

type ParserLike = {
  parse: (text: string) => unknown;
  stringify?: (data: unknown) => string;
};
type FetchOptions = {
  parser: ParserLike;
  query?: Record<string, unknown>;
  baseURL?: string;
};

const DEFAULTS: FetchOptions = {
  parser: JSON
};

export async function safeFetch<T>(
  url: string,
  options?: Partial<FetchOptions>
): Promise<T | undefined> {
  const { query, parser, baseURL } = ensureDefaults(options, DEFAULTS);
  const intUrl = new URL(url, baseURL);

  if (isDefined(query) && some(query)) {
    for (const key in query) intUrl.searchParams.append(key, String(query[key]));
  }

  try {
    const response = await fetch(intUrl);
    return parser.parse(await response.text()) as T;
  } catch (e) {
    log.error(`Failed to fetch '${url}'`, e);
  }
}
