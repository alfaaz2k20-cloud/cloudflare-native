import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite');
import * as fs from 'node:fs';
import * as path from 'node:path';

export function createMockD1(schemaPath?: string, seedPath?: string) {
  const sqlite = new DatabaseSync(':memory:');

  const defaultSchemaPath = schemaPath || path.resolve(process.cwd(), 'database/migrations/0001_initial_schema.sql');
  if (fs.existsSync(defaultSchemaPath)) {
    const schemaSql = fs.readFileSync(defaultSchemaPath, 'utf8');
    sqlite.exec(schemaSql);
  }

  const defaultSeedPath = seedPath || path.resolve(process.cwd(), 'database/seeds/0001_dev_seed.sql');
  if (fs.existsSync(defaultSeedPath)) {
    const seedSql = fs.readFileSync(defaultSeedPath, 'utf8');
    sqlite.exec(seedSql);
  }

  function sanitizeParam(v: any): any {
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    return v;
  }

  function prepare(sql: string) {
    let boundValues: any[] = [];
    return {
      bind(...vals: any[]) {
        boundValues = vals.map(sanitizeParam);
        return this;
      },
      async first<T = any>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row: any = stmt.get(...boundValues);
        if (!row) return null;
        if (colName) return row[colName] ?? null;
        return row;
      },
      async all<T = any>(): Promise<{ results: T[]; success: boolean; meta: any }> {
        const stmt = sqlite.prepare(sql);
        const rows: any = stmt.all(...boundValues);
        return { results: rows || [], success: true, meta: {} };
      },
      async run(): Promise<{ success: boolean; meta: any; results: any[] }> {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...boundValues);
        return {
          success: true,
          meta: {
            changes: info.changes,
            last_row_id: Number(info.lastInsertRowid)
          },
          results: []
        };
      },
      async raw(): Promise<any[]> {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...boundValues);
        return rows.map((r: any) => Object.values(r));
      }
    };
  }

  async function batch(stmts: any[]): Promise<any[]> {
    const results = [];
    sqlite.exec('BEGIN TRANSACTION');
    try {
      for (const s of stmts) {
        results.push(await s.run());
      }
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
    return results;
  }

  async function exec(query: string): Promise<any> {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  }

  return {
    prepare,
    batch,
    exec,
    _sqlite: sqlite
  };
}

export function createMockR2() {
  const store = new Map<string, { body: Uint8Array; metadata?: any }>();
  return {
    async put(key: string, value: any, options?: any) {
      let buffer: Uint8Array;
      if (typeof value === 'string') {
        buffer = new TextEncoder().encode(value);
      } else if (value instanceof ArrayBuffer) {
        buffer = new Uint8Array(value);
      } else if (value instanceof Uint8Array) {
        buffer = value;
      } else if (value && typeof value === 'object' && 'arrayBuffer' in value) {
        buffer = new Uint8Array(await value.arrayBuffer());
      } else {
        buffer = new TextEncoder().encode(String(value));
      }
      store.set(key, { body: buffer, metadata: options?.httpMetadata });
      return { key, size: buffer.length };
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      return {
        key,
        body: item.body,
        httpEtag: 'W/"mock-etag-r2"',
        arrayBuffer: async () => item.body.buffer,
        text: async () => new TextDecoder().decode(item.body),
        httpMetadata: item.metadata,
        writeHttpMetadata(headers: Headers) {
          if (item.metadata?.contentType) {
            headers.set('content-type', item.metadata.contentType);
          }
        }
      };
    },
    async delete(key: string) {
      store.delete(key);
    },
    async head(key: string) {
      const item = store.get(key);
      if (!item) return null;
      return { key, size: item.body.length, httpMetadata: item.metadata };
    }
  };
}

export function createMockKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    }
  };
}
