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

const SAFE_FETCH_DEFAULTS: FetchOptions = {
  parser: JSON
};

export async function safeFetch<T>(
  path: string,
  options?: Partial<FetchOptions>
): Promise<T | undefined> {
  const { query, parser, baseURL } = ensureDefaults(options, SAFE_FETCH_DEFAULTS);
  const url = new URL(path, baseURL);

  if (isDefined(query) && some(query)) {
    for (const key in query) url.searchParams.append(key, String(query[key]));
  }

  try {
    const response = await fetch(url);
    return parser.parse(await response.text()) as T;
  } catch (e) {
    log.error(`Failed to fetch '${path}'`, e);
  }
}
