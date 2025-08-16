const express = require('express');
const db = require('../db');
const { verifyToken, isAdmin, isSubscribed } = require('../middleware/auth');

const router = express.Router();

// GET /api/signals - Get all signals (Subscribed users and Admins only)
router.get('/', [verifyToken, isSubscribed], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM signals ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/signals - Create a new signal (Admin only)
router.post('/', [verifyToken, isAdmin], async (req, res) => {
  const { asset, type, entry_price, target_price, stop_loss } = req.body;

  if (!asset || !type) {
    return res.status(400).json({ error: 'Asset and type are required.' });
  }

  try {
    const { rows } = await db.query(
      'INSERT INTO signals (asset, type, entry_price, target_price, stop_loss) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [asset, type, entry_price, target_price, stop_loss]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/signals/:id - Update a signal (Admin only)
router.put('/:id', [verifyToken, isAdmin], async (req, res) => {
  const { id } = req.params;
  const { asset, type, entry_price, target_price, stop_loss, status } = req.body;

  if (!asset || !type || !status) {
    return res.status(400).json({ error: 'Asset, type, and status are required.' });
  }

  try {
    const { rows } = await db.query(
      'UPDATE signals SET asset = $1, type = $2, entry_price = $3, target_price = $4, stop_loss = $5, status = $6 WHERE id = $7 RETURNING *',
      [asset, type, entry_price, target_price, stop_loss, status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Signal not found.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/signals/:id - Delete a signal (Admin only)
router.delete('/:id', [verifyToken, isAdmin], async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM signals WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Signal not found.' });
    }

    res.status(204).send(); // No Content
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
