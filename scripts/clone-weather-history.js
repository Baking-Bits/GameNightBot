const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');

// Usage: node scripts/clone-weather-history.js <sourceUserId> <targetUserId> [days]
// Clones weather_history, daily_weather_points, and shitty_weather_awards for the last N days (default 60)
// and aligns shitty_weather_scores.total_points to the source user's total.

const [,, sourceUserId, targetUserId, daysArg] = process.argv;
const days = Number(daysArg) || 60;

if (!sourceUserId || !targetUserId) {
  console.error('Usage: node scripts/clone-weather-history.js <sourceUserId> <targetUserId> [days]');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const pool = mariadb.createPool({
  host: config.mariadb.host,
  user: config.mariadb.user,
  password: config.mariadb.password,
  database: config.mariadb.database,
  connectionLimit: 5
});

async function cloneData() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    console.log(`Cloning last ${days} days from ${sourceUserId} -> ${targetUserId}`);

    // Clone weather_history basic columns
    const historyInsert = await conn.query(
      `INSERT INTO weather_history (
         user_id, timestamp, temperature, feels_like, humidity, wind_speed,
         weather_main, weather_description, city, country
       )
       SELECT ?, timestamp, temperature, feels_like, humidity, wind_speed,
              weather_main, weather_description, city, country
       FROM weather_history
       WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [targetUserId, sourceUserId, days]
    );
    console.log(`Inserted ${historyInsert.affectedRows || 0} weather_history rows.`);

    // Clone daily_weather_points if table exists
    try {
      const dailyInsert = await conn.query(
        `INSERT INTO daily_weather_points (
           user_id, date, total_points, points_breakdown, weather_summary
         )
         SELECT ?, date, total_points, points_breakdown, weather_summary
         FROM daily_weather_points
         WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ON DUPLICATE KEY UPDATE
           total_points = VALUES(total_points),
           points_breakdown = VALUES(points_breakdown),
           weather_summary = VALUES(weather_summary)`,
        [targetUserId, sourceUserId, days]
      );
      console.log(`Upserted ${dailyInsert.affectedRows || 0} daily_weather_points rows.`);
    } catch (err) {
      console.warn('daily_weather_points copy skipped (table missing?):', err.message);
    }

    // Clone shitty_weather_awards
    const awardsInsert = await conn.query(
      `INSERT INTO shitty_weather_awards (
         user_id, timestamp, score, points_awarded, temperature,
         weather_description, wind_speed, humidity, breakdown
       )
       SELECT ?, timestamp, score, points_awarded, temperature,
              weather_description, wind_speed, humidity, breakdown
       FROM shitty_weather_awards
       WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [targetUserId, sourceUserId, days]
    );
    console.log(`Inserted ${awardsInsert.affectedRows || 0} shitty_weather_awards rows.`);

    // Align total_points to source user's current total
    const [sourceScore] = await conn.query(
      'SELECT COALESCE(total_points,0) AS total_points FROM shitty_weather_scores WHERE user_id = ?',
      [sourceUserId]
    );
    const sourceTotal = sourceScore ? Number(sourceScore.total_points || 0) : 0;
    await conn.query(
      `INSERT INTO shitty_weather_scores (user_id, total_points, last_award_date)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE total_points = VALUES(total_points), last_award_date = NOW()`,
      [targetUserId, sourceTotal]
    );
    console.log(`Set target total_points to ${sourceTotal}.`);

    await conn.commit();
    console.log('Clone completed successfully.');
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Clone failed:', error);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

cloneData();
