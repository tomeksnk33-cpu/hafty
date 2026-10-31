export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wspólna obsługa błędów dla tras API rejestratora: { ok: false, error } z właściwym kodem. */
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
}
