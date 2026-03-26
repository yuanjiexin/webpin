const express = require('express');
const db = require('../db');
const { authenticate, optionalAuthenticate } = require('../auth/middleware');

const router = express.Router();

// 验证 API Key 的中间件（供 SDK 使用）
async function resolveProject(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const projectId = req.query.projectId || req.body.projectId;

  if (apiKey) {
    try {
      const result = await db.query(
        'SELECT id FROM projects WHERE api_key = $1',
        [apiKey]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      req.projectId = result.rows[0].id;
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (projectId) {
    req.projectId = projectId;
  }

  next();
}

// GET /api/v1/annotations?projectId=&url=
router.get('/', optionalAuthenticate, resolveProject, async (req, res) => {
  const { url } = req.query;
  const projectId = req.projectId;

  if (!projectId || !url) {
    return res.status(400).json({ error: 'projectId and url are required' });
  }

  try {
    const result = await db.query(
      `SELECT
         a.id, a.target_url, a.selector_xpath, a.selector_css,
         a.selector_text_quote, a.element_rect,
         a.content, a.color, a.is_resolved, a.resolved_at,
         a.created_at, a.updated_at,
         u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar,
         COALESCE(
           json_agg(
             json_build_object(
               'id', r.id,
               'content', r.content,
               'created_at', r.created_at,
               'author_id', ru.id,
               'author_name', ru.name,
               'author_avatar', ru.avatar_url
             ) ORDER BY r.created_at
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) AS replies
       FROM annotations a
       LEFT JOIN users u ON u.id = a.author_id
       LEFT JOIN annotation_replies r ON r.annotation_id = a.id
       LEFT JOIN users ru ON ru.id = r.author_id
       WHERE a.project_id = $1 AND a.target_url = $2
       GROUP BY a.id, u.id
       ORDER BY a.created_at DESC`,
      [projectId, decodeURIComponent(url)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('list annotations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/annotations
router.post('/', optionalAuthenticate, resolveProject, async (req, res) => {
  const {
    projectId: bodyProjectId,
    target_url,
    selector_xpath,
    selector_css,
    selector_text_quote,
    element_rect,
    content,
    color,
  } = req.body;

  const projectId = req.projectId || bodyProjectId;

  if (!projectId || !target_url || !content) {
    return res.status(400).json({ error: 'projectId, target_url, content are required' });
  }

  const authorId = req.user?.id || null;

  try {
    const result = await db.query(
      `INSERT INTO annotations
         (project_id, author_id, target_url, selector_xpath, selector_css,
          selector_text_quote, element_rect, content, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        projectId,
        authorId,
        target_url,
        selector_xpath || null,
        selector_css || null,
        selector_text_quote || null,
        element_rect ? JSON.stringify(element_rect) : null,
        content,
        color || '#FFE082',
      ]
    );

    // 查询作者信息
    const annotation = result.rows[0];
    if (authorId) {
      const userResult = await db.query(
        'SELECT id, name, avatar_url FROM users WHERE id = $1',
        [authorId]
      );
      annotation.author = userResult.rows[0] || null;
    }
    annotation.replies = [];

    res.status(201).json(annotation);
  } catch (err) {
    console.error('create annotation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/annotations/:id — 编辑批注内容
router.put('/:id', authenticate, async (req, res) => {
  const { content, color } = req.body;

  try {
    const result = await db.query(
      `UPDATE annotations
       SET content = COALESCE($1, content),
           color = COALESCE($2, color),
           updated_at = NOW()
       WHERE id = $3 AND author_id = $4
       RETURNING *`,
      [content || null, color || null, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found or not authorized' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('update annotation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/annotations/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM annotations WHERE id = $1 AND author_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found or not authorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('delete annotation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/annotations/:id/resolve — 标记为已解决
router.patch('/:id/resolve', authenticate, async (req, res) => {
  const { resolved } = req.body;
  const isResolved = resolved !== false; // 默认 true

  try {
    const result = await db.query(
      `UPDATE annotations
       SET is_resolved = $1,
           resolved_at = $2,
           resolved_by = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        isResolved,
        isResolved ? new Date() : null,
        isResolved ? req.user.id : null,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('resolve annotation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/annotations/:id/replies
router.post('/:id/replies', optionalAuthenticate, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const authorId = req.user?.id || null;

  try {
    const result = await db.query(
      `INSERT INTO annotation_replies (annotation_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, authorId, content]
    );

    const reply = result.rows[0];
    if (authorId) {
      const userResult = await db.query(
        'SELECT id, name, avatar_url FROM users WHERE id = $1',
        [authorId]
      );
      reply.author = userResult.rows[0] || null;
    }

    res.status(201).json(reply);
  } catch (err) {
    console.error('create reply error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/annotations/:id/replies
router.get('/:id/replies', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.content, r.created_at,
              u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar
       FROM annotation_replies r
       LEFT JOIN users u ON u.id = r.author_id
       WHERE r.annotation_id = $1
       ORDER BY r.created_at`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('list replies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
