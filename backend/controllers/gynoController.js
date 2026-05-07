const db = require('../config/db');

// GET ALL DOCTORS
const getAllDoctors = (req, res) => {
  const { district } = req.query;

  let sql = 'SELECT * FROM doctors';
  let params = [];

  if (district && district !== 'all') {
    sql += ' WHERE district = ?';
    params.push(district);
  }

  sql += ' ORDER BY name ASC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
};

// SEARCH DOCTORS
const searchDoctors = (req, res) => {
  const { query, district } = req.query;

  let sql = `SELECT * FROM doctors WHERE 
    (name LIKE ? OR hospital LIKE ? OR specialization LIKE ?)`;
  let params = [`%${query}%`, `%${query}%`, `%${query}%`];

  if (district && district !== 'all') {
    sql += ' AND district = ?';
    params.push(district);
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
};

// GET DOCTOR BY ID
const getDoctorById = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM doctors WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'Doctor not found' });
    res.json(results[0]);
  });
};

// GET ALL DISTRICTS
const getDistricts = (req, res) => {
  db.query(
    'SELECT DISTINCT district FROM doctors ORDER BY district ASC',
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results.map(r => r.district));
    }
  );
};

// SEED DOCTORS DATA
const seedDoctors = (req, res) => {
  const doctors = [
    { name: 'Dr. Priya Fernando', specialization: 'Gynecologist & Obstetrician', hospital: 'Nawaloka Hospital', district: 'Colombo', contact: '0112304444', fee: 1500, is_government: false },
    { name: 'Dr. Sandya Kumari', specialization: 'Reproductive Endocrinologist', hospital: 'Lanka Hospital', district: 'Colombo', contact: '0115430000', fee: 2000, is_government: false },
    { name: 'Dr. Amara Jayasinghe', specialization: 'Gynecologist', hospital: 'National Hospital of Sri Lanka', district: 'Colombo', contact: '0112691111', fee: 0, is_government: true },
    { name: 'Dr. Niluka Perera', specialization: 'Gynecologist', hospital: 'Kandy General Hospital', district: 'Kandy', contact: '0812222261', fee: 0, is_government: true },
    { name: 'Dr. Chamari Silva', specialization: 'Gynecologist & Obstetrician', hospital: 'Asiri Hospital Kandy', district: 'Kandy', contact: '0812222200', fee: 1800, is_government: false },
    { name: 'Dr. Rukshika Mendis', specialization: 'Gynecologist', hospital: 'Gampaha District Hospital', district: 'Gampaha', contact: '0332222261', fee: 0, is_government: true },
    { name: 'Dr. Thilini Rathnayake', specialization: 'Gynecologist & Obstetrician', hospital: 'Durdans Hospital', district: 'Colombo', contact: '0114640000', fee: 2500, is_government: false },
    { name: 'Dr. Madhavi Wickramasinghe', specialization: 'Reproductive Endocrinologist', hospital: 'Ninewells Hospital', district: 'Colombo', contact: '0114526300', fee: 2200, is_government: false },
    { name: 'Dr. Sewwandi Bandara', specialization: 'Gynecologist', hospital: 'Kurunegala Teaching Hospital', district: 'Kurunegala', contact: '0372222261', fee: 0, is_government: true },
    { name: 'Dr. Iresha Dissanayake', specialization: 'Gynecologist', hospital: 'Ratnapura General Hospital', district: 'Ratnapura', contact: '0452222261', fee: 0, is_government: true },
    { name: 'Dr. Dilini Jayawardena', specialization: 'Gynecologist & Obstetrician', hospital: 'Matara Teaching Hospital', district: 'Matara', contact: '0412222261', fee: 0, is_government: true },
    { name: 'Dr. Nadeeka Fernando', specialization: 'Gynecologist', hospital: 'Negombo District Hospital', district: 'Gampaha', contact: '0312222261', fee: 0, is_government: true }
  ];

  // Clear existing doctors
  db.query('DELETE FROM doctors', (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    let inserted = 0;
    doctors.forEach((doc) => {
      db.query(
        'INSERT INTO doctors (name, specialization, hospital, district, contact, fee, is_government) VALUES (?,?,?,?,?,?,?)',
        [doc.name, doc.specialization, doc.hospital, doc.district, doc.contact, doc.fee, doc.is_government],
        (err) => {
          if (err) return;
          inserted++;
          if (inserted === doctors.length) {
            res.status(201).json({
              message: `${doctors.length} doctors added successfully! 🌸`
            });
          }
        }
      );
    });
  });
};

module.exports = {
  getAllDoctors,
  searchDoctors,
  getDoctorById,
  getDistricts,
  seedDoctors
};