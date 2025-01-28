// syncUserPoints.js
const mysql = require('mysql2/promise');

async function syncUserData(dbConfig, client) {
  let connection;
  try {
    // Connect to the database
    connection = await mysql.createConnection(dbConfig);

    // Sync user points from memory (client.userPoints) to database
    console.log('Starting to sync user points from memory to database...');
    for (const [userId, points] of client.userPoints.entries()) {
      // Check if the user exists in the database
      const [rows] = await connection.execute('SELECT user_id FROM user_points WHERE user_id = ?', [userId]);
      if (rows.length === 0) {
        // Insert new user if not found
        await connection.execute('INSERT INTO user_points (user_id, points) VALUES (?, ?)', [userId, points]);
      } else {
        // Update existing user's points
        await connection.execute('UPDATE user_points SET points = ? WHERE user_id = ?', [points, userId]);
      }
    }
    console.log('User points synchronized successfully.');

  } catch (error) {
    console.error('Error synchronizing user data:', error.message);
    console.error('Detailed Error:', error.stack);
  } finally {
    // Close database connection
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

module.exports = { syncUserData };
