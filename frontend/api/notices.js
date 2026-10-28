import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // 1. FORBID ALL CACHING (The Fix)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let client;
  try {
    client = await pool.connect();

    const eventsResult = await client.query(`
      SELECT e.id, e.name, e.event_date, e.description, e.capacity,
             (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as registered_count
      FROM events e
      WHERE e.registration_open = true
    `);

    const events = eventsResult.rows.map(e => {
        const count = parseInt(e.registered_count) || 0;
        return {
            name: e.name,
            event_date: e.event_date,
            description: e.description,
            capacity: e.capacity,
            spots_left: e.capacity > 0 ? e.capacity - count : null,
            full: e.capacity > 0 && count >= e.capacity
        };
    });

    const exhResult = await client.query(`SELECT * FROM exhibitions_list WHERE is_active = true LIMIT 1`);
    let exhibition = null;
    if (exhResult.rows.length > 0) {
        const row = exhResult.rows[0];
        exhibition = {
            is_open: true,
            title: row.title,
            date_text: row.date_text,
            about_text: row.about_text
        };
    }

    res.status(200).json({ events, exhibition });

  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: "Failed to query Neon Vault" });
  } finally {
    if (client) client.release();
  }
}
