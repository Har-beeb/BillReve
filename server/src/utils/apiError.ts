export class ApiError extends Error {
  statusCode: number;
  details: Record<string, unknown>;

  constructor(message: string, statusCode = 500, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = "ApiError";
  }
}
