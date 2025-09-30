const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, run } = require('../config/database');
const router = express.Router();

// Register new user
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const insertQuery = `
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (?, ?, ?, 'admin')
    `;

    const result = await run(insertQuery, [email, hashedPassword, full_name || email]);

    // Fetch the created user
    const userQuery = 'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?';
    const userResult = await query(userQuery, [result.id]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: userResult[0].id, 
        email: userResult[0].email,
        role: userResult[0].role 
      },
      process.env.JWT_SECRET || 'soufian_erp_secret_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Set secure HTTP-only cookie with environment-aware SameSite/Secure
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd, // true only in production (requires HTTPS)
      sameSite: isProd ? 'none' : 'lax', // allow cross-site XHR in prod, workable in dev
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResult[0],
        token // Keep token in response for localStorage fallback
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error.message
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const userQuery = 'SELECT * FROM users WHERE email = ?';
    const userResult = await query(userQuery, [email]);

    if (userResult.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = userResult[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash || user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET || 'soufian_erp_secret_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Set secure HTTP-only cookie with environment-aware SameSite/Secure
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd, // true only in production (requires HTTPS)
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token // Keep token in response for localStorage fallback
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error.message
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies.authToken;
    
    if (!token) {
      token = req.headers.authorization?.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'soufian_erp_secret_key_change_in_production'
    );

    // Get user from database with full_name
    const userQuery = 'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?';
    const userResult = await query(userQuery, [decoded.id]);

    if (userResult.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: userResult[0]
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to get current user',
      error: error.message
    });
  }
});

// Logout user (clear both cookie and client-side token)
router.post('/logout', (req, res) => {
  // Clear the HTTP-only cookie
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/'
  });
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Change password
const changePasswordHandler = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'soufian_erp_secret_key_change_in_production'
    );

    // Get user from database
    const userQuery = 'SELECT * FROM users WHERE id = ?';
    const userResult = await query(userQuery, [decoded.id]);

    if (userResult.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash || user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updateQuery = 'UPDATE users SET password_hash = ? WHERE id = ?';
    await run(updateQuery, [hashedNewPassword, user.id]);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

router.post('/change-password', changePasswordHandler);
router.put('/change-password', changePasswordHandler);

module.exports = router;
