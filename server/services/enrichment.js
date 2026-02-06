const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'crm_data.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      source TEXT,
      status TEXT DEFAULT 'new',
      enriched INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function importContacts(contacts) {
  const insert = getDb().prepare(`
    INSERT INTO contacts (name, email, phone, company, source)
    VALUES (@name, @email, @phone, @company, @source)
  `);

  const insertMany = getDb().transaction((items) => {
    const results = [];
    for (const item of items) {
      const result = insert.run({
        name: item.name || '',
        email: item.email || '',
        phone: item.phone || '',
        company: item.company || '',
        source: item.source || 'import',
      });
      results.push(result);
    }
    return results;
  });

  return insertMany(contacts);
}

function getAllContacts(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const contacts = getDb()
    .prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  const total = getDb().prepare('SELECT COUNT(*) as count FROM contacts').get();
  return { contacts, total: total.count, page, limit };
}

function enrichContact(id, data) {
  const fields = Object.keys(data)
    .map((key) => `${key} = @${key}`)
    .join(', ');

  const stmt = getDb().prepare(`
    UPDATE contacts SET ${fields}, enriched = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  return stmt.run({ ...data, id });
}

function getStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const enriched = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE enriched = 1').get().count;
  const sources = db.prepare('SELECT source, COUNT(*) as count FROM contacts GROUP BY source').all();
  return { total, enriched, pending: total - enriched, sources };
}

module.exports = {
  getDb,
  importContacts,
  getAllContacts,
  enrichContact,
  getStats,
};
