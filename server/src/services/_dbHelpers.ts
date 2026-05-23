/**
 * Shared database-result helpers.
 *
 * The Drizzle `db.execute(...)` typing leaks the underlying driver shape.
 * For mysql2 today the resolved value is the `[rows, fields]` tuple, but
 * different driver/Drizzle configurations are known to return any of:
 *
 *   1. A plain row array `Array<T>` (some mocks / future drivers)
 *   2. The mysql2 tuple `[Array<T>, fields]`
 *   3. A `{ rows: Array<T>, fields }` envelope (e.g. node-postgres style)
 *   4. `null` / `undefined` (defensive)
 *
 * Centralising the unwrap behind one helper means we can defend against a
 * silent driver swap without each call-site re-implementing the brittle
 * `Array.isArray(result) && Array.isArray(result[0])` ladder. Any unknown
 * shape is logged via LoggingService and treated as empty, so an
 * accidental driver shift surfaces as a warning rather than as
 * "everything is suddenly zero" in production dashboards.
 */
import LoggingService from './loggingService.js';

/**
 * Normalise a `db.execute()` result into a plain `T[]` regardless of which
 * envelope the driver hands back.
 */
export function unwrapRows<T = unknown>(result: unknown): T[] {
  if (result === null || result === undefined) {
    return [];
  }

  // Plain row array (the simplest mock / future-driver shape).
  if (Array.isArray(result)) {
    // mysql2 [rows, fields] tuple — rows live at index 0.
    if (Array.isArray(result[0])) {
      return result[0] as T[];
    }
    // Could be a plain row array OR a tuple whose rows[] is empty. An
    // empty array is indistinguishable from an empty row set, so either
    // interpretation is correct — return it directly.
    return result as T[];
  }

  // `{ rows, fields }` envelope (node-postgres style or future Drizzle
  // configurations).
  if (typeof result === 'object' && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }

  // Unknown shape — surface as a warning so a future driver change does
  // not silently corrupt analytics output, and return [] to keep the
  // caller's downstream maths safe (instead of crashing or leaking the
  // raw envelope to consumers).
  void LoggingService.logSystemEvent(
    'db_unwrap_rows_unknown_shape',
    {
      typeofResult: typeof result,
      // Avoid serialising arbitrarily large payloads — just enumerate
      // the top-level keys when we have an object.
      keys: typeof result === 'object' && result !== null ? Object.keys(result as object) : null,
    },
    'warn',
  );
  return [];
}
