const db = require('../config/db');

// GET ALL CATEGORIES
const getCategories = (req, res) => {
  db.query(
    `SELECT DISTINCT category, category_emoji 
     FROM faq ORDER BY category`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// GET QUESTIONS BY CATEGORY
const getByCategory = (req, res) => {
  const { category } = req.params;

  db.query(
    'SELECT * FROM faq WHERE category = ? ORDER BY id',
    [category],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// SEARCH FAQ
const searchFaq = (req, res) => {
  const { q, category } = req.query;
  if (!q) return res.json([]);

  const keywords = q.toLowerCase()
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 3);

  if (keywords.length === 0) return res.json([]);

  // Build scored query - question match scores higher than answer match
  const conditions = keywords.map(() =>
    `(question LIKE ? OR tags LIKE ?)`
  ).join(' OR ');

  const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

  // First try: match in question or tags only
  db.query(
    `SELECT *, 
      (CASE WHEN question LIKE ? THEN 10 ELSE 0 END +
       CASE WHEN tags LIKE ? THEN 5 ELSE 0 END) as score
     FROM faq 
     WHERE ${conditions}
     ORDER BY score DESC
     LIMIT 1`,
    [
      `%${keywords[0]}%`,
      `%${keywords[0]}%`,
      ...params
    ],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (results.length > 0) {
        return res.json(results);
      }

      // Second try: match anywhere including answer
      const fullConditions = keywords.map(() =>
        `(question LIKE ? OR answer LIKE ? OR tags LIKE ?)`
      ).join(' OR ');

      const fullParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`, `%${k}%`]);

      db.query(
        `SELECT * FROM faq WHERE ${fullConditions} LIMIT 1`,
        fullParams,
        (err2, results2) => {
          if (err2) return res.status(500).json({ message: 'Database error' });
          res.json(results2);
        }
      );
    }
  );
};

// GET ALL FAQS
const getAllFaq = (req, res) => {
  db.query(
    'SELECT * FROM faq ORDER BY category, id',
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// MARK HELPFUL
const markHelpful = (req, res) => {
  const { id } = req.params;

  db.query(
    'UPDATE faq SET helpful_count = helpful_count + 1 WHERE id = ?',
    [id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ message: 'Marked as helpful! 🌸' });
    }
  );
};

module.exports = {
  getCategories,
  getByCategory,
  searchFaq,
  getAllFaq,
  markHelpful
};