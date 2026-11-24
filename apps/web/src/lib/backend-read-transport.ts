// Only the plain list has a Data API transport. Keep custom Edge gateways as configured.
export async function fetchBackendOperation(
  functionsUrl: string,
  operation: string,
  request: object,
  init: Omit<RequestInit, "headers"> & { headers: Record<string, string> },
): Promise<Response> {
  const body = JSON.stringify(request);
  const edgeUrl = functionsUrl.replace(/\/$/, "");
  const nativePath = "/functions/v1/backend-v1";
  const edge = () => {
    init.signal?.throwIfAborted();
    return fetch(`${edgeUrl}/${operation}`, { ...init, body });
  };
  // JSONB adds separator whitespace. Keep requests near the original body limit on Edge.
  if (
    operation !== "centers_list_v1" ||
    !edgeUrl.endsWith(nativePath) ||
    typeof body !== "string" ||
    body.length > 2_097_152 - 64 ||
    (request &&
      typeof request === "object" &&
      "include_setup_status" in request &&
      request.include_setup_status === true)
  )
    return edge();

  let response: Response;
  try {
    response = await fetch(`${edgeUrl.slice(0, -nativePath.length)}/rest/v1/rpc/centers_list_v1`, {
      ...init,
      headers: { ...init.headers, "Content-Profile": "api_read" },
      body: `{"p_request":${body}}`,
    });
  } catch (error) {
    if (init.signal?.aborted || (error instanceof Error && error.name === "AbortError"))
      throw error;
    return edge();
  }
  if (response.ok) return response;

  const result: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  // Edge owns gateway/auth errors and keeps clients compatible with older deployments.
  if (
    response.status === 401 ||
    response.status === 403 ||
    !result ||
    typeof result !== "object" ||
    !("ok" in result) ||
    typeof result.ok !== "boolean"
  )
    return edge();
  return response;
}
