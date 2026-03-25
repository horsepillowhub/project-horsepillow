const express = require('express');
const path = require('path');
const db = require('./database');

// Node 18+ has native fetch, fallback for older versions
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── HEALTH ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Project HorsePillow' });
});

// ── TODAY ──
app.get('/api/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const events = db.prepare(`
    SELECT * FROM events 
    WHERE date = ? 
    ORDER BY time ASC
  `).all(today);
  res.json(events);
});

// ── UPCOMING ──
app.get('/api/upcoming', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const events = db.prepare(`
    SELECT * FROM events 
    WHERE date > ? 
    ORDER BY date ASC, time ASC
    LIMIT 5
  `).all(today);
  res.json(events);
});

// ── EVENTS CRUD ──
app.get('/api/events', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY date ASC, time ASC').all();
  res.json(events);
});

app.post('/api/events', (req, res) => {
  const { title, date, time, person, note, type } = req.body;
  const result = db.prepare(`
    INSERT INTO events (title, date, time, person, note, type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, date, time || null, person || 'family', note || null, type || 'event');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.patch('/api/events/:id', (req, res) => {
  const { title, date, time, person, type, note, location } = req.body;
  db.prepare(`
    UPDATE events SET title=?, date=?, time=?, person=?, type=?, note=?, location=?
    WHERE id=?
  `).run(title, date, time||null, person, type, note||null, location||null, req.params.id);
  res.json({ success: true });
});

app.delete('/api/events/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── TASKS ──
app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE done = 0 ORDER BY created_at DESC').all();
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { title, person, due_date, note } = req.body;
  const result = db.prepare(`
    INSERT INTO tasks (title, person, due_date, note)
    VALUES (?, ?, ?, ?)
  `).run(title, person || 'jeff', due_date || null, note || null);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.patch('/api/tasks/:id', (req, res) => {
  const { title, person, due_date, note } = req.body;
  db.prepare(`UPDATE tasks SET title=?, person=?, due_date=?, note=? WHERE id=?`)
    .run(title, person, due_date||null, note||null, req.params.id);
  res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/tasks/:id/done', (req, res) => {
  db.prepare('UPDATE tasks SET done = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── DISPATCHES ──
app.get('/api/dispatches', (req, res) => {
  const dispatches = db.prepare(`
    SELECT * FROM dispatches 
    WHERE to_person = 'jeff' AND done = 0 
    ORDER BY created_at DESC
  `).all();
  res.json(dispatches);
});

app.post('/api/dispatches', (req, res) => {
  const { title, note, type, from_person, to_person } = req.body;
  const result = db.prepare(`
    INSERT INTO dispatches (title, note, type, from_person, to_person)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, note || null, type || 'task', from_person || 'jenn', to_person || 'jeff');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.patch('/api/dispatches/:id', (req, res) => {
  const { title, note, type } = req.body;
  db.prepare(`UPDATE dispatches SET title=?, note=?, type=? WHERE id=?`)
    .run(title, note||null, type, req.params.id);
  res.json({ success: true });
});

app.delete('/api/dispatches/:id', (req, res) => {
  db.prepare('DELETE FROM dispatches WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/dispatches/:id/done', (req, res) => {
  db.prepare('UPDATE dispatches SET done = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── DROP ZONE ──
app.post('/api/drop', async (req, res) => {
  const { raw, localDate } = req.body;

  // Save raw drop immediately
  const result = db.prepare(`
    INSERT INTO drops (raw, status)
    VALUES (?, 'processing')
  `).run(raw);

  // Call Claude to extract structured data
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are HorsePillow, a family planning assistant. Extract structured data from this family drop:

"${raw}"

Today's date is ${localDate || new Date().toISOString().split('T')[0]}. Use this exact date for 'today'. Tomorrow is the next day after this date.

Respond with ONLY a JSON object. No explanation. No markdown. Just raw JSON.

The JSON should have:
{
  "items": [
    {
      "type": "event" | "task" | "dispatch" | "note" | "fireside" | "watchlist",
      "title": "clean title",
      "date": "YYYY-MM-DD or null",
      "time": "HH:MM (24hr) or null",
      "person": "jeff" | "jenn" | "jj" | "family",
      "note": "any extra context or null",
      "category": "activity" | "appointment" | "work" | "fun" | "event",
      "dispatch_type": "task" | "note" | "remember" or null,
      "to_person": "jeff" | "jenn" or null
    }
  ],
  "scout_response": "A warm, direct 1-2 sentence response from HorsePillow acknowledging what was dropped. Be specific. Be real. Hype Jeff up when appropriate."
}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text.trim();
    const parsed = JSON.parse(text);

    // Process each extracted item
    const created = [];
    for (const item of parsed.items) {
      if (item.type === 'event' && item.date) {
        const ev = db.prepare(`
          INSERT INTO events (title, date, time, person, type, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(item.title, item.date, item.time || null, item.person || 'family', item.category || 'event', item.note || null);
        created.push({ type: 'event', title: item.title });
      } else if (item.type === 'task') {
        db.prepare(`
          INSERT INTO tasks (title, person, note)
          VALUES (?, ?, ?)
        `).run(item.title, item.person || 'jeff', item.note || null);
        created.push({ type: 'task', title: item.title });
      } else if (item.type === 'dispatch') {
        db.prepare(`
          INSERT INTO dispatches (title, note, type, from_person, to_person)
          VALUES (?, ?, ?, ?, ?)
        `).run(item.title, item.note || null, item.dispatch_type || 'task', item.person || 'jeff', item.to_person || 'jenn');
        created.push({ type: 'dispatch', title: item.title });
      } else if (item.type === 'fireside') {
        db.prepare(`
          INSERT INTO fireside (title, note, added_by)
          VALUES (?, ?, ?)
        `).run(item.title, item.note || null, 'jeff');
        created.push({ type: 'fireside', title: item.title });
      } else if (item.type === 'watchlist') {
        db.prepare(`
          INSERT INTO watchlist (title, status)
          VALUES (?, 'up_next')
        `).run(item.title);
        created.push({ type: 'watchlist', title: item.title });
      } else if (item.type === 'note' || !item.date) {
        // No date = task or note
        db.prepare(`
          INSERT INTO tasks (title, person, note)
          VALUES (?, ?, ?)
        `).run(item.title, item.person || 'jeff', item.note || null);
        created.push({ type: 'task', title: item.title });
      }
    }

    // Update drop status
    db.prepare(`UPDATE drops SET status='done', extracted=? WHERE id=?`)
      .run(JSON.stringify(created), result.lastInsertRowid);

    res.json({
      id: result.lastInsertRowid,
      raw,
      status: 'done',
      created,
      message: parsed.scout_response
    });

  } catch (err) {
    console.error('Claude extraction error:', err);
    db.prepare(`UPDATE drops SET status='error' WHERE id=?`).run(result.lastInsertRowid);
    res.json({
      id: result.lastInsertRowid,
      raw,
      status: 'saved',
      message: "Got it. Saved for later."
    });
  }
});

app.get('/api/drops', (req, res) => {
  const drops = db.prepare('SELECT * FROM drops ORDER BY created_at DESC LIMIT 20').all();
  res.json(drops);
});

// ── FIRESIDE ──
app.get('/api/fireside', (req, res) => {
  const items = db.prepare('SELECT * FROM fireside WHERE done = 0 ORDER BY created_at DESC').all();
  res.json(items);
});

app.post('/api/fireside', (req, res) => {
  const { title, note, added_by, scheduled_date } = req.body;
  const result = db.prepare(`
    INSERT INTO fireside (title, note, added_by, scheduled_date)
    VALUES (?, ?, ?, ?)
  `).run(title, note || null, added_by || 'jeff', scheduled_date || null);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.patch('/api/fireside/:id', (req, res) => {
  const { title, note, scheduled_date } = req.body;
  db.prepare(`UPDATE fireside SET title=?, note=?, scheduled_date=? WHERE id=?`)
    .run(title, note||null, scheduled_date||null, req.params.id);
  res.json({ success: true });
});

app.delete('/api/fireside/:id', (req, res) => {
  db.prepare('DELETE FROM fireside WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/fireside/:id/done', (req, res) => {
  db.prepare('UPDATE fireside SET done = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── WATCH LIST ──
app.get('/api/watchlist', (req, res) => {
  const shows = db.prepare('SELECT * FROM watchlist ORDER BY status ASC, updated_at DESC').all();
  res.json(shows);
});

app.post('/api/watchlist', (req, res) => {
  const { title, platform, season, episode, status, note } = req.body;
  const result = db.prepare(`
    INSERT INTO watchlist (title, platform, season, episode, status, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, platform || null, season || 1, episode || 1, status || 'watching', note || null);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.delete('/api/watchlist/:id', (req, res) => {
  db.prepare('DELETE FROM watchlist WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/watchlist/:id', (req, res) => {
  const { season, episode, status, note } = req.body;
  db.prepare(`
    UPDATE watchlist SET season=?, episode=?, status=?, note=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(season, episode, status, note, req.params.id);
  res.json({ success: true });
});

// ── PINS ──
app.get('/api/pins', (req, res) => {
  const pins = db.prepare('SELECT * FROM pins ORDER BY created_at DESC LIMIT 10').all();
  res.json(pins);
});

app.post('/api/pins', (req, res) => {
  const { text, from_person, to_person } = req.body;
  const result = db.prepare('INSERT INTO pins (text, from_person, to_person) VALUES (?, ?, ?)').run(text, from_person || 'jeff', to_person || 'jeff');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.delete('/api/pins/:id', (req, res) => {
  db.prepare('DELETE FROM pins WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── MEALS ──
app.get('/api/meals', (req, res) => {
  const meals = db.prepare('SELECT * FROM meals ORDER BY CASE day WHEN "Mon" THEN 1 WHEN "Tue" THEN 2 WHEN "Wed" THEN 3 WHEN "Thu" THEN 4 WHEN "Fri" THEN 5 WHEN "Sat" THEN 6 WHEN "Sun" THEN 7 END').all();
  res.json(meals);
});

app.post('/api/meals', (req, res) => {
  const { day, name, note } = req.body;
  const result = db.prepare('INSERT INTO meals (day, name, note) VALUES (?, ?, ?)').run(day, name, note || null);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.delete('/api/meals/:id', (req, res) => {
  db.prepare('DELETE FROM meals WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/meals/suggest', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const events = db.prepare('SELECT * FROM events WHERE date >= ? ORDER BY date ASC LIMIT 7').all(today);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are HorsePillow, a warm family planning assistant. Suggest a simple meal plan for this week based on these family events: ${JSON.stringify(events.map(e => ({ title: e.title, date: e.date, person: e.person })))}

Consider: busy nights need easy meals, soccer nights need quick dinners, fun nights can be something special.

Respond ONLY with raw JSON — no markdown, no explanation:
{
  "meals": [
    {"day": "Mon", "name": "meal name", "note": "short reason or tip"},
    ...one per day Mon-Sun...
  ],
  "message": "One warm sentence from HorsePillow about this week's plan"
}`
        }]
      })
    });
    const data = await response.json();
    const parsed = JSON.parse(data.content[0].text.trim());
    db.prepare('DELETE FROM meals').run();
    const insert = db.prepare('INSERT INTO meals (day, name, note) VALUES (?, ?, ?)');
    parsed.meals.forEach(m => insert.run(m.day, m.name, m.note || null));
    res.json({ message: parsed.message });
  } catch (err) {
    console.error('Meal suggest error:', err);
    res.json({ message: 'Could not generate suggestions right now. Try again.' });
  }
});


app.get('/api/food', (req, res) => {
  const places = db.prepare('SELECT * FROM food_places WHERE active = 1 ORDER BY name ASC').all();
  res.json(places);
});

app.get('/api/food/spin', (req, res) => {
  const places = db.prepare('SELECT * FROM food_places WHERE active = 1').all();
  if (!places.length) return res.json({ error: 'No places added yet' });
  const pick = places[Math.floor(Math.random() * places.length)];
  res.json(pick);
});

app.post('/api/food', (req, res) => {
  const { name, type } = req.body;
  const result = db.prepare('INSERT INTO food_places (name, type) VALUES (?, ?)').run(name, type || 'restaurant');
  res.json({ id: result.lastInsertRowid, ...req.body });
});

// ── SCOUT MOMENT ──
app.get('/api/scout', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = db.prepare('SELECT * FROM events WHERE date = ?').all(today);
  const pendingDispatches = db.prepare("SELECT COUNT(*) as count FROM dispatches WHERE to_person='jeff' AND done=0").get();
  const pendingTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE person='jeff' AND done=0").get();

  let message = "You're all clear today, Commander. Good day to get ahead.";
  let type = 'clear';

  if (pendingDispatches.count > 0) {
    message = `Jenn sent you ${pendingDispatches.count} dispatch${pendingDispatches.count > 1 ? 'es' : ''}. Don't leave her hanging.`;
    type = 'dispatch';
  } else if (todayEvents.length > 0) {
    const next = todayEvents[0];
    message = `${next.title} is on the board today${next.time ? ' at ' + formatTime(next.time) : ''}. You've got this.`;
    type = 'event';
  } else if (pendingTasks.count > 0) {
    message = `${pendingTasks.count} task${pendingTasks.count > 1 ? 's' : ''} waiting on you. Small steps, big results.`;
    type = 'task';
  }

  res.json({ message, type });
});

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

app.listen(PORT, () => {
  console.log(`🐴 Project HorsePillow running on port ${PORT}`);
});