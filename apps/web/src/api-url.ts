function normalizeBase(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export function apiUrl(
  path: string,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  const base = normalizeBase(baseUrl);
  const apiPath = `api/${path.replace(/^\/+/, "")}`;
  return base === "/" ? `/${apiPath}` : `${base}${apiPath}`;
}
