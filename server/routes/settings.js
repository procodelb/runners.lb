const express = require('express');
const { query, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userQuery = 'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?';
    const result = await query(userQuery, [req.user.id]);
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user profile',
      error: error.message 
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { email, full_name } = req.body;
    const updateData = {};

    if (email) updateData.email = email;
    if (full_name) updateData.full_name = full_name;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No fields to update' 
      });
    }

    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const updateQuery = `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    values.push(req.user.id);
    await run(updateQuery, values);

    // Fetch the updated user
    const userQuery = 'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?';
    const userResult = await query(userQuery, [req.user.id]);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userResult[0]
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user profile',
      error: error.message 
    });
  }
});

// Get system settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get basic system info
    const systemInfo = {
      database: 'PostgreSQL',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch system settings',
      error: error.message 
    });
  }
});

// Get all users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const usersQuery = 'SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC';
    const result = await query(usersQuery);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users',
      error: error.message 
    });
  }
});

// Create new user
router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { email, full_name, role = 'user', password } = req.body;

    if (!email || !full_name || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, full name, and password are required' 
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
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const insertQuery = `
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `;

    const result = await run(insertQuery, [email, hashedPassword, full_name, role]);

    // Fetch the created user
    const userQuery = 'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?';
    const userResult = await query(userQuery, [result.id]);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResult[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create user',
      error: error.message 
    });
  }
});

// Delete user
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete your own account' 
      });
    }

    const deleteQuery = 'DELETE FROM users WHERE id = ?';
    const result = await run(deleteQuery, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user',
      error: error.message 
    });
  }
});

module.exports = router;
// Additional settings endpoints

// Get language
router.get('/i18n', authenticateToken, async (req, res) => {
  try {
    const rows = await query('SELECT language FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, data: rows[0] || { language: 'en' } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to get language' });
  }
});

// Update language
router.patch('/i18n', authenticateToken, async (req, res) => {
  try {
    const { language } = req.body;
    if (!language || !['en','ar'].includes(language)) return res.status(400).json({ success: false, message: 'Invalid language' });
    await run('UPDATE users SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [language, req.user.id]);
    res.json({ success: true, data: { language } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update language' });
  }
});

// Get theme
router.get('/theme', authenticateToken, async (req, res) => {
  try {
    const rows = await query('SELECT theme FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, data: rows[0] || { theme: 'light' } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to get theme' });
  }
});

// Update theme
router.patch('/theme', authenticateToken, async (req, res) => {
  try {
    const { theme } = req.body;
    if (!theme || !['light','dark'].includes(theme)) return res.status(400).json({ success: false, message: 'Invalid theme' });
    await run('UPDATE users SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [theme, req.user.id]);
    res.json({ success: true, data: { theme } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update theme' });
  }
});

// Change password under settings namespace
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Missing fields' });
    const rows = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(currentPassword, rows[0]?.password_hash || '');
    if (!ok) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

