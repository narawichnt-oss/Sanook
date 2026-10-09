// A tiny versioned JSON document store. Guilds, wars, and players are each one
// document; writers use compare-and-swap so two people scoring at the same
// moment can't overwrite each other. Memory backs dev and tests; Postgres
// (any driver with a `query(text, params)` function) backs production.

export type Doc<T> = { value: T; version: number };

export interface DocStore {
  get<T>(key: string): Promise<Doc<T> | null>;
  /** Writes only if the stored version still equals `version` (`null` = must not exist yet). */
  put<T>(key: string, value: T, version: number | null): Promise<boolean>;
}

export class MemoryStore implements DocStore {
  private docs = new Map<string, { json: string; version: number }>();

  async get<T>(key: string): Promise<Doc<T> | null> {
    const doc = this.docs.get(key);
    return doc ? { value: JSON.parse(doc.json) as T, version: doc.version } : null;
  }

  async put<T>(key: string, value: T, version: number | null): Promise<boolean> {
    const current = this.docs.get(key);
    if ((current?.version ?? null) !== version) return false;
    this.docs.set(key, { json: JSON.stringify(value), version: (version ?? 0) + 1 });
    return true;
  }
}

export type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

export class PgStore implements DocStore {
  private ready: Promise<unknown> | null = null;

  constructor(private query: Query) {}

  private init() {
    this.ready ??= this.query(
      "create table if not exists guild_docs (key text primary key, value jsonb not null, version integer not null)",
      [],
    ).catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  async get<T>(key: string): Promise<Doc<T> | null> {
    await this.init();
    const [row] = await this.query("select value, version from guild_docs where key = $1", [key]);
    if (!row) return null;
    const value = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    return { value: value as T, version: Number(row.version) };
  }

  async put<T>(key: string, value: T, version: number | null): Promise<boolean> {
    await this.init();
    const json = JSON.stringify(value);
    const rows =
      version === null
        ? await this.query(
            "insert into guild_docs (key, value, version) values ($1, $2::jsonb, 1) on conflict (key) do nothing returning key",
            [key, json],
          )
        : await this.query(
            "update guild_docs set value = $2::jsonb, version = version + 1 where key = $1 and version = $3 returning key",
            [key, json, version],
          );
    return rows.length > 0;
  }
}

export class ConflictError extends Error {
  constructor(key: string) {
    super(`Too many concurrent writes to ${key}`);
  }
}

/**
 * Read-modify-write with retries. `fn` sees the current value (or null) and
 * returns the new value to store (omit `value` to leave it alone) plus a result.
 * It may run more than once, so keep it free of side effects.
 */
export async function mutate<T, R>(
  store: DocStore,
  key: string,
  fn: (current: T | null) => { value?: T; result: R },
): Promise<R> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const doc = await store.get<T>(key);
    const { value, result } = fn(doc ? doc.value : null);
    if (value === undefined) return result;
    if (await store.put(key, value, doc ? doc.version : null)) return result;
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)));
  }
  throw new ConflictError(key);
}
