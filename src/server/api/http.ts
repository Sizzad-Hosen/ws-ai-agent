import "server-only";

/**
 * The JSON envelope every REST route answers with.
 *
 * Success and failure are distinguishable without reading the status code, so
 * a client can branch on the body alone.
 */
export interface ApiSuccess<T> {
  readonly data: T;
}

export interface ApiFailure {
  readonly error: {
    readonly message: string;
  };
}

const GENERIC_FAILURE = "Something went wrong. Please try again.";

export function apiData<T>(data: T, status = 200): Response {
  const body: ApiSuccess<T> = { data };
  return Response.json(body, { status });
}

export function apiError(message: string, status: number): Response {
  const body: ApiFailure = { error: { message } };
  return Response.json(body, { status });
}

/**
 * Records the real cause server-side and answers with a generic message.
 *
 * Repository and driver errors carry connection strings, SQL and table names,
 * none of which may reach a client.
 */
export function apiFailure(context: string, error: unknown): Response {
  console.error(context, error);
  return apiError(GENERIC_FAILURE, 500);
}

export type JsonBody =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly response: Response };

/** Reads a request body as JSON, turning a malformed payload into a 400. */
export async function readJsonBody(request: Request): Promise<JsonBody> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError("Send a JSON request body.", 400),
    };
  }
}
