import { ToolFailureCode, ToolFailureError } from "../contracts/tool-failure-codes.js";
import type { SearchProvider } from "./search-provider.js";

/**
 * Minimal provider registry.
 *
 * The registry is provider-agnostic: it maps a configured provider name to a
 * concrete adapter. Unknown providers fail closed with
 * SEARCH_PROVIDER_NOT_FOUND — there is never an automatic fallback.
 */
export class SearchProviderRegistry {
  private readonly providers = new Map<string, SearchProvider>();

  register(provider: SearchProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): SearchProvider | undefined {
    return this.providers.get(name);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  list(): SearchProvider[] {
    return [...this.providers.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  /** Fail closed: an unknown provider is an error, never a fallback. */
  resolve(name: string): SearchProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ToolFailureError({
        code: ToolFailureCode.SEARCH_PROVIDER_NOT_FOUND,
        message: `Search provider not found: ${name}`,
        retryable: false,
      });
    }
    return provider;
  }
}
