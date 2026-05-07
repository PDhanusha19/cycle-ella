const express = require('express');
const router = express.Router();
const { signUp, login, forgotPassword, resetPassword } = require('../controllers/authController');

// Sign Up
router.post('/signup', signUp);

// Login
router.post('/login', login);

// Forgot Password
router.post('/forgot-password', forgotPassword);

// Reset Password
router.post('/reset-password', resetPassword);

module.exports = router;