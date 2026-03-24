const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'horsepillow.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    person TEXT DEFAULT 'family',
    type TEXT DEFAULT 'event',
    note TEXT,
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

  CREATE TABLE IF NOT EXISTS food_places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'restaurant',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed food places if empty
const foodCount = db.prepare('SELECT COUNT(*) as count FROM food_places').get();
if (foodCount.count === 0) {
  const places = [
    'Someburros', 'Cafe Zupas', 'Jersey Mikes', "Culver's",
    'Wingstop', "Barro's Pizza", "Rosie's", "Angie's",
    'Chipotle', 'Mod Pizza', 'Jimmy Johns', "Filiberto's",
    'Popeyes', 'Jack in the Box'
  ];
  const insert = db.prepare('INSERT INTO food_places (name) VALUES (?)');
  places.forEach(p => insert.run(p));
}

// Seed sample data if events empty
const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get();
if (eventCount.count === 0) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const insertEvent = db.prepare('INSERT INTO events (title, date, time, person, type, note) VALUES (?, ?, ?, ?, ?, ?)');
  insertEvent.run('JJ — Soccer Practice', today, '16:00', 'jj', 'activity', 'Riverview Park · Field 3 · Jenn on pickup');
  insertEvent.run('Sprint Review', today, '09:00', 'jeff', 'work', 'Remote · Wrap up before end of week');
  insertEvent.run("Dentist — Jenn", tomorrow, '14:30', 'jenn', 'appointment', 'Dr. Martinez · 30 min');
  insertEvent.run('Family Movie Night', nextWeek, '19:00', 'family', 'fun', 'JJ picks this week');

  const insertTask = db.prepare('INSERT INTO tasks (title, person, note) VALUES (?, ?, ?)');
  insertTask.run("Order JJ's cleats — size 4", 'jeff', 'Before next game');
  insertTask.run('Car registration', 'jeff', 'Due end of month — 10 min online');

  const insertDispatch = db.prepare('INSERT INTO dispatches (title, note, type, from_person, to_person) VALUES (?, ?, ?, ?, ?)');
  insertDispatch.run("Pick up milk on the way home", "We're out — whole milk", 'task', 'jenn', 'jeff');
  insertDispatch.run("You're crushing it this week", "JJ told me you're his favorite. Don't tell him I told you. ❤️", 'note', 'jenn', 'jeff');

  const insertWatch = db.prepare('INSERT INTO watchlist (title, platform, season, episode, status) VALUES (?, ?, ?, ?, ?)');
  insertWatch.run('Severance', 'Apple TV+', 2, 4, 'watching');
  insertWatch.run('The Last of Us', 'HBO', 2, 1, 'watching');
  insertWatch.run('Shogun', 'Hulu', 1, 5, 'forgotten');
  insertWatch.run('White Lotus', 'HBO', 3, 1, 'up_next');

  const insertFireside = db.prepare('INSERT INTO fireside (title, note, added_by) VALUES (?, ?, ?)');
  insertFireside.run("Plan next mini adventure", "Due for one — last was Flagstaff", 'jeff');
  insertFireside.run("JJ's summer schedule", "Camps? Soccer league? Need to decide", 'jeff');
}

module.exports = db;
