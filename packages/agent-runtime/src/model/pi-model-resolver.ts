import {
  ModelRegistry,
  ModelRuntime,
} from "@earendil-works/pi-coding-agent";

export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

/** A resolved Pi model, derived from the registry method signature. */
export type ResolvedPiModel = NonNullable<ReturnType<ModelRegistry["find"]>>;

export type ModelResolutionResult =
  | { ok: true; provider: string; modelId: string; model: ResolvedPiModel; runtime: ModelRuntime }
  | { ok: false; provider: string; modelId: string; reason: typeof MODEL_NOT_FOUND };

/**
 * Resolves a runtime (provider, model id) pair to a concrete Pi Model through
 * Pi's Model Registry.
 *
 * This centralizes all Pi registry access: callers pass a provider/model id
 * and receive a Model (or MODEL_NOT_FOUND). Nothing in the business layer
 * reads process.env or assembles Pi Model objects itself.
 *
 * Fail closed: when the provider or model id does not exist in the registry,
 * the resolver returns MODEL_NOT_FOUND. It never falls back to OpenAI, Claude,
 * or any other model, because an automatic fallback would break auditability.
 */
export class PiModelResolver {
  private constructor(
    private readonly runtime: ModelRuntime,
    private readonly registry: ModelRegistry,
  ) {}

  /** Build a resolver over a fresh Pi model runtime (no network refresh). */
  static async create(): Promise<PiModelResolver> {
    const runtime = await ModelRuntime.create({ refreshOnCreate: false });
    return new PiModelResolver(runtime, new ModelRegistry(runtime));
  }

  resolveConfiguredModel(provider: string, modelId: string): ModelResolutionResult {
    const model = this.registry.find(provider, modelId);
    if (!model) {
      return { ok: false, provider, modelId, reason: MODEL_NOT_FOUND };
    }
    return { ok: true, provider, modelId, model, runtime: this.runtime };
  }
}
