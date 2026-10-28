import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Missing article ID" });
  }

  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM blogs WHERE id = $1 AND is_published = true', [numericId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Article not found." });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: "Failed to read from the vault." });
  } finally {
    if (client) client.release();
  }
}
