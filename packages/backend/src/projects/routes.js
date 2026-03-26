const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authenticate } = require('../auth/middleware');

const router = express.Router();

// POST /api/v1/projects — 创建项目
router.post('/', authenticate, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const apiKey = crypto.randomBytes(32).toString('hex');

  try {
    const result = await db.query(
      `INSERT INTO projects (owner_id, name, description, api_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, api_key, created_at`,
      [req.user.id, name, description || null, apiKey]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('create project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/projects — 获取当前用户的项目列表
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.api_key, p.created_at,
              COUNT(a.id) FILTER (WHERE a.is_resolved = FALSE)::int AS open_annotation_count
       FROM projects p
       LEFT JOIN annotations a ON a.project_id = p.id
       WHERE p.owner_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('list projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/projects/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, description, api_key, created_at FROM projects
       WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('get project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
