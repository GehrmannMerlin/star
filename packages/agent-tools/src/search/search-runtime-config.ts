/**
 * Server-side search provider configuration.
 *
 * The provider name comes exclusively from the server runtime environment
 * (WEB_SEARCH_PROVIDER) — never from a hardcoded default in business code.
 * This is deliberately provider-neutral: the first provider wired in happens
 * to be Bocha, but nothing here knows that name.
 */
export type SearchRuntimeEnv = {
  WEB_SEARCH_PROVIDER?: string;
  /** Remaining runtime environment; provider adapters read their own keys. */
  [key: string]: string | undefined;
};

export const WEB_SEARCH_PROVIDER_ENV = "WEB_SEARCH_PROVIDER";

export type SearchRuntimeConfig = {
  provider: string;
};

/**
 * Parse the runtime search configuration from the environment.
 *
 * Fail closed: when no provider is configured, returns undefined so the caller
 * can report SEARCH_PROVIDER_NOT_CONFIGURED. No default provider is invented.
 */
export function resolveSearchRuntimeConfig(
  env: SearchRuntimeEnv = process.env as SearchRuntimeEnv,
): SearchRuntimeConfig | undefined {
  const provider = env.WEB_SEARCH_PROVIDER;
  if (!provider) {
    return undefined;
  }
  return { provider };
}
