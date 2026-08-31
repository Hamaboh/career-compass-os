export class MemberError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 404 | 409 | 422 | 503,
    readonly reason: string,
  ) {
    super(code);
    this.name = "MemberError";
  }
}
