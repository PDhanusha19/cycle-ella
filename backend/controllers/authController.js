const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// SIGN UP
const signUp = (req, res) => {
  const { full_name, gender, date_of_birth, phone, email, password } = req.body;

  if (!full_name || !phone || !email || !password) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ message: 'Database error', error: err.message });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = `INSERT INTO users (full_name, gender, date_of_birth, phone, email, password, is_verified) 
                 VALUES (?, ?, ?, ?, ?, ?, true)`;

    db.query(sql, [full_name, gender || null, date_of_birth || null, phone, email, hashedPassword], (err, result) => {
      if (err) {
        console.error('DB Insert Error:', err);
        return res.status(500).json({ message: 'Error creating user', error: err.message });
      }

      const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, {
        expiresIn: '7d'
      });

      res.status(201).json({
        message: 'Account created successfully! 🌸',
        token,
        user: {
          id: result.insertId,
          full_name,
          email,
          phone
        }
      });
    });
  });
};

// LOGIN
const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter email and password' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (results.length === 0) {
      return res.status(400).json({ message: 'Email not found' });
    }

    const user = results[0];

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      message: 'Login successful! 🌸',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone
      }
    });
  });
};

// FORGOT PASSWORD
// The response never contains the OTP and never reveals whether the email
// is registered — returning either one let anyone reset the password of
// any account just by asking for it.
const GENERIC_RESET_RESPONSE = { message: 'If this email is registered, an OTP has been sent.' };

const forgotPassword = (req, res) => {
  const { email } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    // Unknown email: same response as the success path, no OTP issued.
    if (results.length === 0) {
      return res.json(GENERIC_RESET_RESPONSE);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    db.query('UPDATE users SET otp = ?, otp_expires = ? WHERE email = ?',
      [otp, otpExpires, email], (err) => {
        if (err) return res.status(500).json({ message: 'Error saving OTP' });

        // TODO: send by email/SMS in production. Printing the OTP to the
        // server console is a development-only delivery channel.
        console.log(`[DEV] Password reset OTP for ${email}: ${otp} (valid 10 min)`);

        res.json(GENERIC_RESET_RESPONSE);
      });
  });
};

// RESET PASSWORD
const resetPassword = (req, res) => {
  const { email, otp, new_password } = req.body;

  db.query('SELECT * FROM users WHERE email = ? AND otp = ?', [email, otp], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (results.length === 0) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const user = results[0];

    if (new Date() > new Date(user.otp_expires)) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);

    db.query('UPDATE users SET password = ?, otp = NULL WHERE email = ?',
      [hashedPassword, email], (err) => {
        if (err) return res.status(500).json({ message: 'Error resetting password' });

        res.json({ message: 'Password reset successfully! 🌸' });
      });
  });
};

module.exports = { signUp, login, forgotPassword, resetPassword };