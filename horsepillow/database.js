const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "horsepillow.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    person TEXT DEFAULT 'family',
    type TEXT DEFAULT 'event',
    note TEXT,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    person TEXT DEFAULT 'jeff',
    due_date TEXT,
    note TEXT,
    done INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    note TEXT,
    type TEXT DEFAULT 'task',
    from_person TEXT DEFAULT 'jenn',
    to_person TEXT DEFAULT 'jeff',
    done INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS drops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    extracted TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fireside (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    note TEXT,
    added_by TEXT DEFAULT 'jeff',
    scheduled_date TEXT,
    done INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    platform TEXT,
    season INTEGER DEFAULT 1,
    episode INTEGER DEFAULT 1,
    status TEXT DEFAULT 'watching',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    from_person TEXT DEFAULT 'jeff',
    to_person TEXT DEFAULT 'jeff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    week TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS food_places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'restaurant',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed food places if empty
const foodCount = db.prepare("SELECT COUNT(*) as count FROM food_places").get();
if (foodCount.count === 0) {
  const places = [
    "Someburros",
    "Cafe Zupas",
    "Jersey Mikes",
    "Culver's",
    "Wingstop",
    "Barro's Pizza",
    "Rosie's",
    "Angie's",
    "Chipotle",
    "Mod Pizza",
    "Jimmy Johns",
    "Filiberto's",
    "Popeyes",
    "Jack in the Box",
  ];
  const insert = db.prepare("INSERT INTO food_places (name) VALUES (?)");
  places.forEach((p) => insert.run(p));
}

module.exports = db;
