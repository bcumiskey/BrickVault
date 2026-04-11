// CRUD API for collection data (sets + minifigures)
// All endpoints use user_id=1 (default user) until auth is added
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './db';

const USER_ID = 1;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = getDb();
  const { type, action, id } = req.query as { type?: string; action?: string; id?: string };

  // type = 'sets' | 'minifigures' | 'settings'
  // action = 'list' | 'get' | 'save' | 'delete' | 'bulk_save' | 'bulk_delete' | 'clear'

  try {
    // --- SETS ---
    if (type === 'sets') {
      if (req.method === 'GET' && action === 'list') {
        const rows = await sql`
          SELECT data FROM collection_sets WHERE user_id = ${USER_ID} ORDER BY updated_at DESC
        `;
        return res.json(rows.map((r: { data: unknown }) => r.data));
      }

      if (req.method === 'GET' && action === 'get' && id) {
        const rows = await sql`
          SELECT data FROM collection_sets WHERE id = ${id} AND user_id = ${USER_ID}
        `;
        return res.json(rows.length ? rows[0].data : null);
      }

      if (req.method === 'POST' && action === 'save') {
        const item = req.body;
        if (!item?.id) return res.status(400).json({ error: 'Missing item id' });
        await sql`
          INSERT INTO collection_sets (id, user_id, set_num, data, updated_at)
          VALUES (${item.id}, ${USER_ID}, ${item.set_num}, ${JSON.stringify(item)}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            set_num = ${item.set_num},
            data = ${JSON.stringify(item)},
            updated_at = NOW()
        `;
        return res.json({ success: true });
      }

      if (req.method === 'POST' && action === 'bulk_save') {
        const items = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
        for (const item of items) {
          await sql`
            INSERT INTO collection_sets (id, user_id, set_num, data, updated_at)
            VALUES (${item.id}, ${USER_ID}, ${item.set_num}, ${JSON.stringify(item)}, NOW())
            ON CONFLICT (id) DO UPDATE SET
              set_num = ${item.set_num},
              data = ${JSON.stringify(item)},
              updated_at = NOW()
          `;
        }
        return res.json({ success: true, count: items.length });
      }

      if (req.method === 'DELETE' && action === 'delete' && id) {
        await sql`DELETE FROM collection_sets WHERE id = ${id} AND user_id = ${USER_ID}`;
        return res.json({ success: true });
      }

      if (req.method === 'POST' && action === 'bulk_delete') {
        const ids = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ error: 'Expected array of ids' });
        for (const delId of ids) {
          await sql`DELETE FROM collection_sets WHERE id = ${delId} AND user_id = ${USER_ID}`;
        }
        return res.json({ success: true, count: ids.length });
      }

      if (req.method === 'DELETE' && action === 'clear') {
        await sql`DELETE FROM collection_sets WHERE user_id = ${USER_ID}`;
        return res.json({ success: true });
      }
    }

    // --- MINIFIGURES ---
    if (type === 'minifigures') {
      if (req.method === 'GET' && action === 'list') {
        const rows = await sql`
          SELECT data FROM collection_minifigures WHERE user_id = ${USER_ID} ORDER BY updated_at DESC
        `;
        return res.json(rows.map((r: { data: unknown }) => r.data));
      }

      if (req.method === 'GET' && action === 'get' && id) {
        const rows = await sql`
          SELECT data FROM collection_minifigures WHERE id = ${id} AND user_id = ${USER_ID}
        `;
        return res.json(rows.length ? rows[0].data : null);
      }

      if (req.method === 'POST' && action === 'save') {
        const item = req.body;
        if (!item?.id) return res.status(400).json({ error: 'Missing item id' });
        await sql`
          INSERT INTO collection_minifigures (id, user_id, fig_num, data, updated_at)
          VALUES (${item.id}, ${USER_ID}, ${item.fig_num}, ${JSON.stringify(item)}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            fig_num = ${item.fig_num},
            data = ${JSON.stringify(item)},
            updated_at = NOW()
        `;
        return res.json({ success: true });
      }

      if (req.method === 'POST' && action === 'bulk_save') {
        const items = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
        for (const item of items) {
          await sql`
            INSERT INTO collection_minifigures (id, user_id, fig_num, data, updated_at)
            VALUES (${item.id}, ${USER_ID}, ${item.fig_num}, ${JSON.stringify(item)}, NOW())
            ON CONFLICT (id) DO UPDATE SET
              fig_num = ${item.fig_num},
              data = ${JSON.stringify(item)},
              updated_at = NOW()
          `;
        }
        return res.json({ success: true, count: items.length });
      }

      if (req.method === 'DELETE' && action === 'delete' && id) {
        await sql`DELETE FROM collection_minifigures WHERE id = ${id} AND user_id = ${USER_ID}`;
        return res.json({ success: true });
      }

      if (req.method === 'DELETE' && action === 'clear') {
        await sql`DELETE FROM collection_minifigures WHERE user_id = ${USER_ID}`;
        return res.json({ success: true });
      }
    }

    // --- SETTINGS (API keys, preferences) ---
    if (type === 'settings') {
      if (req.method === 'GET' && action === 'get') {
        const key = id;
        if (!key) return res.status(400).json({ error: 'Missing key' });
        const rows = await sql`
          SELECT value FROM user_settings WHERE user_id = ${USER_ID} AND key = ${key}
        `;
        return res.json({ value: rows.length ? rows[0].value : null });
      }

      if (req.method === 'POST' && action === 'save') {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Missing key' });
        await sql`
          INSERT INTO user_settings (user_id, key, value)
          VALUES (${USER_ID}, ${key}, ${value})
          ON CONFLICT (user_id, key) DO UPDATE SET value = ${value}
        `;
        return res.json({ success: true });
      }
    }

    return res.status(400).json({ error: 'Invalid request', type, action });
  } catch (err) {
    console.error('Collection API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
