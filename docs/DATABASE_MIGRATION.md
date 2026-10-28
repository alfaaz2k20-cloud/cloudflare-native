# Alfaaz Collective: Database Migration Guide (PostgreSQL to Cloudflare D1)

This document details the relational schema translation, dialect differences, query migration patterns, and operational procedures for migrating Alfaaz Collective from Render PostgreSQL to Cloudflare D1 (SQLite-compatible).

---

## 1. Dialect & Feature Matrix

| Feature | PostgreSQL / SQLAlchemy Pattern | Cloudflare D1 / SQLite Replacement | Rationale & Migration Action |
| :--- | :--- | :--- | :--- |
| **Primary Keys** | `SERIAL PRIMARY KEY` or `INTEGER PRIMARY KEY` | `INTEGER PRIMARY KEY AUTOINCREMENT` | SQLite uses `AUTOINCREMENT` for 64-bit monotonically increasing integers. |
| **UUIDs** | `UUID` native type or `VARCHAR` | `TEXT` | Store UUID strings (e.g. `crypto.randomUUID()`) directly as text. |
| **Date & Time** | `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` | `DATETIME DEFAULT CURRENT_TIMESTAMP` (ISO 8601 strings) | SQLite has no dedicated timezone-aware type. Standardize all application timestamps on UTC ISO 8601 (`YYYY-MM-DDTHH:MM:SS.SSSZ`). |
| **Booleans** | `BOOLEAN DEFAULT FALSE` | `INTEGER NOT NULL DEFAULT 0` (or `1`) | SQLite stores booleans as 0/1 integers. Application layer casts boolean values. |
| **Row Locking** | `SELECT ... FOR UPDATE` | Atomic D1 transactions (`db.batch([...])`) | D1 operates on an optimistic / serialized single-writer SQLite log. Concurrent writes are batched in atomic transactions. |
| **Case Insensitivity** | `ILIKE` | `LIKE` (case-insensitive for ASCII) or `LOWER(col) = LOWER(?)` | Replaced PostgreSQL `ILIKE` with `LOWER()` comparisons. |
| **JSON Storage** | `JSONB` | `TEXT` with JSON parsing (`JSON_EXTRACT` or application-level `JSON.parse`) | SQLite supports JSON1 extensions (`json_extract`), but application-level serialization is faster and portable. |
| **Distinct Group-By** | `COUNT(DISTINCT col)` | `COUNT(DISTINCT col)` | Fully supported in SQLite. |
| **Array Types** | `VARCHAR[]` | Serialized JSON `TEXT NOT NULL DEFAULT '[]'` | Native arrays are normalized into structured JSON strings. |
| **Unique Indexes** | `CREATE UNIQUE INDEX ...` | `CREATE UNIQUE INDEX ...` | Fully supported in SQLite. |

---

## 2. Incompatible PostgreSQL Features & Replacements

### 2.1 Concurrency & `FOR UPDATE` Row Locks
**Original Pattern:**
In `backend/app/routers/events.py`, the registration endpoint applied:
```python
query = db.query(DBEvent).filter(DBEvent.id == data.event_id)
if db.bind and db.bind.dialect.name == "postgresql":
  query = query.with_for_update()
```
**Cloudflare D1 Replacement:**
D1 does not support `FOR UPDATE`. Instead, D1 guarantees serialized execution for writes. We implement atomic check-and-insert using parameterized conditional queries or D1 batch transactions:
```typescript
const event = await db
  .prepare(
    'SELECT capacity, (SELECT COUNT(*) FROM event_registrations WHERE event_id'
      + ' = ?) as registered FROM events WHERE id = ? AND registration_open = 1'
  )
  .bind(eventId, eventId)
  .first<{ capacity: number; registered: number }>();

if (!event) throw new HTTPException(400, { message: 'Registration closed.' });
if (event.capacity > 0 && event.registered >= event.capacity) {
  throw new HTTPException(400, { message: 'Event full.' });
}
```

### 2.2 Date Arithmetic & Interval Functions
**Original Pattern:**
In Python/PostgreSQL, interview slot generation and expiration used:
```python
datetime.now(timezone.utc) - timedelta(days=offset)
```
**Cloudflare D1 Replacement:**
In TypeScript Workers:
```typescript
const now = new Date();
const targetDate = new Date(now.getTime() + offset * 86400000);
const dateStr = targetDate.toISOString().slice(0, 10);
```

### 2.3 Cascading Deletions
**Original Pattern:**
Foreign keys in SQLAlchemy models often relied on application-level cascades.
**Cloudflare D1 Replacement:**
Every child table in D1 defines explicit `ON DELETE CASCADE` constraints:
```sql
FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
```
And migrations enable `PRAGMA foreign_keys = ON;`.

---

## 3. Local Migration & Seed Workflow

### 3.1 Applying Migrations to Local D1
Run via Wrangler:
```bash
npx wrangler d1 migrations apply DB --local
```

### 3.2 Seeding Development Data
Run via Wrangler:
```bash
npx wrangler d1 execute DB --local --file=database/seeds/0001_dev_seed.sql
```

### 3.3 Querying the Local Database
```bash
npx wrangler d1 execute DB --local --command="SELECT email, status FROM users;"
```

---

## 4. Production Migration & Remote Execution (Manual Review)

*Notice: Never execute remote commands during development.*

When explicitly authorized to deploy to Cloudflare:
1. Create the remote D1 database:
   ```bash
   npx wrangler d1 create alfaaz-d1
   ```
2. Paste the assigned `database_id` into `wrangler.jsonc`.
3. Apply migrations remotely:
   ```bash
4. Provision Initial Production Administrator:
   *SECURITY MANDATE: NEVER execute development seed files (`database/seeds/0001_dev_seed.sql`) against any remote or production database.*
   Development seeds contain publicly known testing credentials (`curator2026!`, `alfaaz2026!`). Production provisioning must apply schema migrations only.
   
   To provision the initial production administrator securely, run the standalone bootstrap script:
   ```bash
   npm run bootstrap:admin -- --email="admin@alfaazcollective.org"
   ```
   Or pass credentials via environment variables:
   ```bash
   BOOTSTRAP_ADMIN_EMAIL="admin@alfaazcollective.org" npm run bootstrap:admin
   ```
   This generates a PBKDF2 Web Crypto hash with 100,000 iterations and a 16-byte random salt, outputting a safe SQL migration or inserting via Wrangler D1.

---

## 5. Non-Destructive Migrations & Repeatability Rules

1. **Schema Migrations Only in Production:**
   - Always run `npx wrangler d1 migrations apply DB --remote`.
   - Never apply dev seeds remotely.
2. **Strictly Non-Destructive DDL:**
   - All migrations must use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
   - Never use `DROP TABLE` or destructive altering statements in production migration files.
3. **Foreign Keys Enforcement:**
   - Every migration must begin with `PRAGMA foreign_keys = ON;` to ensure relational integrity.

---

## 6. Backup, Export & Disaster Recovery

### 6.1 Safe Data Migration Plan from Legacy Systems
When migrating existing data from legacy databases (e.g. Render PostgreSQL / Supabase):
1. Export legacy records into normalized JSON or CSV formatted dumps.
2. Transform datetime fields into ISO 8601 UTC strings (`YYYY-MM-DDTHH:MM:SS.SSSZ`).
3. Convert boolean values to `0` or `1`.
4. Run validation checks to ensure foreign key parent records exist before inserting child records.
5. Ingest data using batch SQL statements via `wrangler d1 execute DB --remote --file=legacy_import.sql` or the D1 REST API.

### 6.2 Exporting Database to SQL Dump
Cloudflare D1 supports exporting schema and data directly for automated backups:
```bash
npx wrangler d1 export alfaaz-d1 --remote --output=backup_$(date +%Y%m%d).sql
```

### 6.3 Restoring from SQL Dump
In a disaster recovery scenario:
```bash
npx wrangler d1 execute alfaaz-d1 --remote --file=backup_20261028.sql
```

