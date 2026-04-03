const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend', '.tmp', 'data.db');

try {
  const db = new Database(dbPath);
  const users = db.prepare('SELECT id, email, username FROM admin_users').all();
  console.log('Admin users:');
  console.log(JSON.stringify(users, null, 2));
  db.close();
} catch (error) {
  console.error('Error reading database:', error.message);
}
