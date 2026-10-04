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

// Generic interrogatives/fillers that show up in nearly every FAQ
// question ("What is...", "How is...", "Should I...") — left in as search
// keywords they drown out whatever the user actually asked about, since
// almost every row matches them.
const FAQ_STOPWORDS = new Set([
  'what', 'how', 'why', 'who', 'when', 'where', 'which',
  'the', 'and', 'for', 'are', 'was', 'were', 'will', 'would',
  'should', 'could', 'does', 'did', 'take', 'about',
  'with', 'from', 'have', 'has', 'had', 'this', 'that', 'these', 'those',
  'you', 'your', 'yours', 'get', 'got', 'need', 'want',
]);

// SEARCH FAQ
const searchFaq = (req, res) => {
  const { q, category } = req.query;
  if (!q) return res.json([]);

  const keywords = q.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(w => w.length > 2 && !FAQ_STOPWORDS.has(w))
    .slice(0, 3);

  if (keywords.length === 0) return res.json([]);

  // Build scored query - question match scores higher than tag match.
  // Every extracted keyword contributes its own score term (summed), not
  // just the first one — otherwise whichever keyword happened to be first
  // decided the whole ranking regardless of the others.
  const conditions = keywords.map(() =>
    `(question LIKE ? OR tags LIKE ?)`
  ).join(' OR ');

  const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

  const scoreExpr = keywords
    .map(() => `(CASE WHEN question LIKE ? THEN 10 ELSE 0 END + CASE WHEN tags LIKE ? THEN 5 ELSE 0 END)`)
    .join(' + ');
  const scoreParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

  // First try: match in question or tags only
  db.query(
    `SELECT *,
      (${scoreExpr}) as score
     FROM faq
     WHERE ${conditions}
     ORDER BY score DESC
     LIMIT 1`,
    [...scoreParams, ...params],
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