const express = require('express');
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - Get all users (Admin only)
router.get('/', [verifyToken, isAdmin], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, email, is_admin, has_active_subscription, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:id/activate-subscription - Manually activate a user's subscription (Admin only)
router.post('/:id/activate-subscription', [verifyToken, isAdmin], async (req, res) => {
  const { id } = req.params;

  try {
    // Calculate the expiration date (30 days from now)
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    // Use a transaction to ensure data integrity
    await db.query('BEGIN');

    const updateUser = await db.query(
      'UPDATE users SET has_active_subscription = TRUE WHERE id = $1 RETURNING *',
      [id]
    );

    if (updateUser.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found.' });
    }

    // Create or update a subscription record
    await db.query(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, status, current_period_end)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         status = EXCLUDED.status,
         current_period_end = EXCLUDED.current_period_end`,
      [id, `manual_activation_${Date.now()}`, 'active', currentPeriodEnd]
    );

    await db.query('COMMIT');

    res.json(updateUser.rows[0]);

  } catch (error) {
    await db.query('ROLLBACK');
    console.error(`Failed to activate subscription for user ${id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
