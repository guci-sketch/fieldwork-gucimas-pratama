import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let poolInitFailed = false;

export function getPool(): pg.Pool | null {
  if (poolInitFailed) return null;
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('[db] DATABASE_URL is not set — in-memory mock fallback active');
      poolInitFailed = true;
      return null;
    }

    try {
      const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
      const requiresSsl =
        process.env.DB_SSL === 'true' ||
        /supabase\.(co|com)/.test(connectionString) ||
        (!isLocal && process.env.DB_SSL !== 'false');

      pool = new Pool({
        connectionString,
        ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
        max: process.env.VERCEL ? 1 : 10,
        connectionTimeoutMillis: 5000,
      });

      pool.on('error', err => {
        console.error('[db] unexpected error on idle client', err);
      });
    } catch (err) {
      console.warn('[db] Failed to initialize Pool — mock active', err);
      poolInitFailed = true;
      return null;
    }
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const currentPool = getPool();
  if (!currentPool) {
    return [] as T[];
  }
  try {
    const result = await currentPool.query(text, params as any[]);
    return (result.rows || []) as T[];
  } catch (err) {
    console.warn('[db query error — mock fallback returning empty array]', err);
    return [] as T[];
  }
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const currentPool = getPool();
  if (!currentPool) {
    const mockClient = {
      query: async () => ({ rows: [] }),
      release: () => {},
    } as unknown as pg.PoolClient;
    return await fn(mockClient);
  }

  try {
    const client = await currentPool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[db transaction error — fallback to mock client]', err);
    const mockClient = {
      query: async () => ({ rows: [] }),
      release: () => {},
    } as unknown as pg.PoolClient;
    return await fn(mockClient);
  }
}
