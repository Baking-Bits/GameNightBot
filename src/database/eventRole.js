const { pool } = require('./connection');

async function ensureEventRoleTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_roles (
      event_id VARCHAR(32) PRIMARY KEY,
      role_id VARCHAR(32) NOT NULL
    )
  `);
}

async function setEventRole(eventId, roleId) {
  await ensureEventRoleTable();
  await pool.query(
    'REPLACE INTO event_roles (event_id, role_id) VALUES (?, ?)',
    [eventId, roleId]
  );
}

async function getEventRole(eventId) {
  await ensureEventRoleTable();
  const [rows] = await pool.query(
    'SELECT role_id FROM event_roles WHERE event_id = ?',
    [eventId]
  );
  return rows[0]?.role_id || null;
}

async function removeEventRole(eventId) {
  await ensureEventRoleTable();
  await pool.query(
    'DELETE FROM event_roles WHERE event_id = ?',
    [eventId]
  );
}

async function getAllEventRoles() {
  await ensureEventRoleTable();
  const rows = await pool.query('SELECT event_id, role_id FROM event_roles');
  if (Array.isArray(rows[0])) {
    return rows[0];
  }
  return [];
}

module.exports = {
  ensureEventRoleTable,
  setEventRole,
  getEventRole,
  removeEventRole,
  getAllEventRoles
};
