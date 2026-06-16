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
  const { q } = req.query;

  if (!q) return res.json([]);

  db.query(
    `SELECT * FROM faq 
     WHERE question LIKE ? 
     OR answer LIKE ? 
     OR tags LIKE ?
     LIMIT 5`,
    [`%${q}%`, `%${q}%`, `%${q}%`],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
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