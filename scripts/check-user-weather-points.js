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

const userId = process.argv[2] || '97133775074390016';

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();

    console.log(`Checking weather points for user: ${userId}`);

    const [sws] = await conn.query(`SELECT * FROM shitty_weather_scores WHERE user_id = ?`, [userId]);
    console.log('\nshitty_weather_scores row:');
    console.log(sws || 'No row');

    const [dailySum] = await conn.query(`SELECT COALESCE(SUM(total_points),0) as sum_daily FROM daily_weather_points WHERE user_id = ?`, [userId]);
    console.log('\nSum of daily_weather_points.total_points for user:');
    console.log(dailySum.sum_daily);

    const [awardsSum] = await conn.query(`SELECT COALESCE(SUM(points_awarded),0) as sum_awards, COUNT(*) as awards_count FROM shitty_weather_awards WHERE user_id = ?`, [userId]);
    console.log('\nSum of shitty_weather_awards.points_awarded and count:');
    console.log(awardsSum);

    const [historyCount] = await conn.query(`SELECT COUNT(*) as history_rows FROM weather_history WHERE user_id = ?`, [userId]);
    console.log('\nWeather history rows for user:');
    console.log(historyCount.history_rows);

    // Compare totals
    const totalFromTables = Number(dailySum.sum_daily) || 0;
    console.log(`\nComputed total from daily_weather_points: ${totalFromTables}`);
    console.log(`Shitty_weather_scores.total_points (database): ${sws ? sws.total_points : 'N/A'}`);

  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    if (conn) try { await conn.end(); } catch(e){}
    process.exit(0);
  }
}

run();
