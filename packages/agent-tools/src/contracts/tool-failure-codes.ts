export const ToolFailureCode = {
  INVALID_INPUT: "INVALID_INPUT",
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  ABORTED: "ABORTED",
  TIMEOUT: "TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DNS_ERROR: "DNS_ERROR",
  TLS_ERROR: "TLS_ERROR",
  HTTP_403: "HTTP_403",
  HTTP_412: "HTTP_412",
  WAF_BLOCKED: "WAF_BLOCKED",
  ACCESS_DENIED: "ACCESS_DENIED",
  STATIC_CONTENT_EMPTY: "STATIC_CONTENT_EMPTY",
  DYNAMIC_RENDER_REQUIRED: "DYNAMIC_RENDER_REQUIRED",
  REGION_NOT_FOUND: "REGION_NOT_FOUND",
  SEARCH_PROVIDER_NOT_CONFIGURED: "SEARCH_PROVIDER_NOT_CONFIGURED",
  SEARCH_PROVIDER_NOT_FOUND: "SEARCH_PROVIDER_NOT_FOUND",
  SEARCH_AUTH_FAILED: "SEARCH_AUTH_FAILED",
  SEARCH_RATE_LIMITED: "SEARCH_RATE_LIMITED",
  SEARCH_REQUEST_FAILED: "SEARCH_REQUEST_FAILED",
  BROWSER_LAUNCH_FAILED: "BROWSER_LAUNCH_FAILED",
  BROWSER_NAVIGATION_FAILED: "BROWSER_NAVIGATION_FAILED",
} as const;

export type ToolFailureCode = (typeof ToolFailureCode)[keyof typeof ToolFailureCode];

export type ToolFailure = {
  code: ToolFailureCode;
  message: string;
  retryable: boolean;
};

export class ToolFailureError extends Error {
  readonly code: ToolFailureCode;
  readonly retryable: boolean;

  constructor(failure: ToolFailure) {
    super(failure.message);
    this.name = "ToolFailureError";
    this.code = failure.code;
    this.retryable = failure.retryable;
  }

  toFailure(): ToolFailure {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}
