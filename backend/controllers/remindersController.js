const db = require('../config/db');

// GET ALL REMINDERS
const getReminders = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT * FROM reminders WHERE user_id = ?',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// SAVE REMINDER
const saveReminder = (req, res) => {
  const user_id = req.user.id;
  const { reminder_type, reminder_time, is_active } = req.body;

  db.query(
    `INSERT INTO reminders (user_id, reminder_type, reminder_time, is_active)
     VALUES (?,?,?,?)`,
    [user_id, reminder_type, reminder_time, is_active ?? true],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error saving reminder' });
      res.status(201).json({
        message: 'Reminder saved! 🌸',
        id: result.insertId
      });
    }
  );
};

// UPDATE REMINDER
const updateReminder = (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { reminder_time, is_active } = req.body;

  db.query(
    'UPDATE reminders SET reminder_time=?, is_active=? WHERE id=? AND user_id=?',
    [reminder_time, is_active, id, user_id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error updating reminder' });
      res.json({ message: 'Reminder updated! 🌸' });
    }
  );
};

// DELETE REMINDER
const deleteReminder = (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  db.query(
    'DELETE FROM reminders WHERE id=? AND user_id=?',
    [id, user_id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error deleting reminder' });
      res.json({ message: 'Reminder deleted! 🌸' });
    }
  );
};

// SETUP DEFAULT REMINDERS FOR NEW USER
const setupDefaultReminders = (req, res) => {
  const user_id = req.user.id;

  const defaultReminders = [
    { type: 'breakfast', time: '08:00:00', active: true },
    { type: 'lunch', time: '12:30:00', active: true },
    { type: 'dinner', time: '19:00:00', active: true },
    { type: 'period_warning', time: '09:00:00', active: true },
    { type: 'period_today', time: '09:00:00', active: true },
    { type: 'monthly_assessment', time: '09:00:00', active: true },
    { type: 'weight_update', time: '09:00:00', active: true },
    { type: 'height_update', time: '09:00:00', active: false }
  ];

  // Delete existing reminders first
  db.query('DELETE FROM reminders WHERE user_id = ?', [user_id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    let inserted = 0;
    defaultReminders.forEach((reminder) => {
      db.query(
        'INSERT INTO reminders (user_id, reminder_type, reminder_time, is_active) VALUES (?,?,?,?)',
        [user_id, reminder.type, reminder.time, reminder.active],
        (err) => {
          if (err) return;
          inserted++;
          if (inserted === defaultReminders.length) {
            res.status(201).json({ message: 'Default reminders set up! 🌸' });
          }
        }
      );
    });
  });
};

module.exports = {
  getReminders,
  saveReminder,
  updateReminder,
  deleteReminder,
  setupDefaultReminders
};