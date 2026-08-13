/**
 * Server-side runtime model configuration.
 *
 * The provider and model id come exclusively from the server runtime
 * environment (AGENT_MODEL_PROVIDER / AGENT_MODEL_ID) — never from a hardcoded
 * default in business code. This is deliberately provider-neutral: the first
 * provider wired in happens to be DeepSeek, but nothing here knows that name.
 */
export type RuntimeModelConfig = {
  provider: string;
  model: string;
};

/** The subset of process.env this module reads. */
export type RuntimeModelEnv = {
  AGENT_MODEL_PROVIDER?: string;
  AGENT_MODEL_ID?: string;
};

export const AGENT_MODEL_PROVIDER_ENV = "AGENT_MODEL_PROVIDER";
export const AGENT_MODEL_ID_ENV = "AGENT_MODEL_ID";

/**
 * Parse the runtime model configuration from the environment.
 *
 * Fail closed: when either variable is missing, returns undefined so the
 * caller can report MODEL_NOT_CONFIGURED. No default provider or model is
 * invented here.
 */
export function resolveRuntimeModelConfig(
  env: RuntimeModelEnv = process.env as RuntimeModelEnv,
): RuntimeModelConfig | undefined {
  const provider = env.AGENT_MODEL_PROVIDER;
  const model = env.AGENT_MODEL_ID;
  if (!provider || !model) {
    return undefined;
  }
  return { provider, model };
}
