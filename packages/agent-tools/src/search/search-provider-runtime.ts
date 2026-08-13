import { BOCHA_API_KEY_ENV, BochaSearchProvider } from "./providers/bocha-search-provider.js";
import { SearchProviderRegistry } from "./search-provider-registry.js";
import type { SearchRuntimeEnv } from "./search-runtime-config.js";

/**
 * Composition root: build the provider registry from the runtime environment.
 *
 * A future provider is one more register() call here. The registry and every
 * consumer stay provider-agnostic.
 */
export function createSearchProviderRegistryFromEnv(
  env: SearchRuntimeEnv = process.env as SearchRuntimeEnv,
): SearchProviderRegistry {
  const registry = new SearchProviderRegistry();
  const apiKey = env[BOCHA_API_KEY_ENV];
  registry.register(new BochaSearchProvider({ apiKey: apiKey ?? "" }));
  return registry;
}
