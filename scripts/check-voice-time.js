const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const pool = mariadb.createPool({
  host: config.mariadb.host,
  user: config.mariadb.user,
  password: config.mariadb.password,
  database: config.mariadb.database,
  connectionLimit: 5
});

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/check-voice-time.js <userId> [guildId]');
  process.exit(1);
}

const guildId = process.argv[3] || null;

(async () => {
  let conn;
  try {
    conn = await pool.getConnection();

    let query = 'SELECT COALESCE(SUM(total_time), 0) AS total_ms FROM voice_times WHERE user_id = ?';
    const params = [userId];
    if (guildId) {
      query += ' AND guild_id = ?';
      params.push(guildId);
    }

    const [row] = await conn.query(query, params);
    const totalMs = Number(row.total_ms || 0);
    const totalHours = totalMs / (1000 * 60 * 60);
    const totalMinutes = totalMs / (1000 * 60);

    console.log(`Voice time totals for user ${userId}${guildId ? ` in guild ${guildId}` : ''}:`);
    console.log(`  Total milliseconds: ${totalMs}`);
    console.log(`  Total minutes: ${totalMinutes.toFixed(2)}`);
    console.log(`  Total hours: ${totalHours.toFixed(2)}`);
  } catch (err) {
    console.error('Error fetching voice time totals:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
})();
