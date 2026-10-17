import { UserError } from 'fastmcp';

/**
 * Turns a googleapis/gaxios error into a UserError that carries Google's own message and the
 * HTTP status. The default "Request failed with status code 400" hides the one line that says
 * which request in a batch was wrong, so the caller could not fix it.
 */
export function toGoogleUserError(prefix: string, error: any): UserError {
  const status = error?.response?.status ?? error?.code;
  const data = error?.response?.data;
  let detail: string | undefined;
  if (data && typeof data === 'object') {
    detail = data.error?.message ?? data.error_description ?? JSON.stringify(data).slice(0, 2000);
  } else if (data) {
    detail = Buffer.isBuffer(data)
      ? data.toString('utf8').slice(0, 2000)
      : String(data).slice(0, 2000);
  }
  const message = detail || error?.message || 'Unknown error';
  return new UserError(`${prefix}: ${status ? `HTTP ${status}: ` : ''}${message}`);
}
