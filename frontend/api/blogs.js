import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Universal CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Prevent caching so the new Phantom articles show up immediately
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let client;
  try {
    client = await pool.connect();
    // Grab ALL published blogs (Notice: No ID required here!)
    const result = await client.query(`
      SELECT id, title, excerpt, created_at
      FROM blogs
      WHERE is_published = true
      ORDER BY created_at DESC
    `);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: "Failed to query the archives" });
  } finally {
    if (client) client.release();
  }
}
