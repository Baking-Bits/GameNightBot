const mysql = require('mysql2/promise');

async function getDbConnectionPool(config) {
  return await mysql.createPool(config);
}

module.exports = {
  getDbConnectionPool
};
