const fs = require('fs');
const filePath = './index.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace POST /api/customers route with a more robust version
const postRouteRegex = /app\.post\('\/api\/customers'[\s\S]*?res\.status\(500\)\.json\(\{ error: err\.message \}\);\s*\}\s*\}\);/;

const newPostRoute = `app.post('/api/customers', async (req, res) => {
  try {
    const b = req.body;
    const safeNull = (v) => (v === '' || v === undefined ? null : v);
    const safeInt  = (v) => (v === '' || v === undefined || v === null ? null : parseInt(v, 10) || null);
    const safeNum  = (v) => (v === '' || v === undefined || v === null ? null : parseFloat(v) || null);

    const result = await db.query(
      \`INSERT INTO customers 
        (name, phone, house_no, street, area, lat, lng, whatsapp, neighborhood, zone, category, fee, 
         collector_id, route_order, collection_frequency, collection_mode, payment_status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
       RETURNING *\`,
      [
        safeNull(b.name), safeNull(b.phone), safeNull(b.house_no), safeNull(b.street), safeNull(b.area),
        safeNum(b.lat), safeNum(b.lng),
        safeNull(b.whatsapp), safeNull(b.neighborhood), safeNull(b.zone),
        b.category || 'Guri', safeNum(b.fee) || 10,
        safeInt(b.collector_id),
        safeInt(b.route_order),
        b.collection_frequency || 'Weekly',
        b.collection_mode || 'Monthly',
        b.payment_status || 'Unpaid'
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/customers] ERROR:', err.message, '| DETAIL:', err.detail || '');
    res.status(500).json({ error: err.message, detail: err.detail });
  }
});`;

if (postRouteRegex.test(content)) {
  content = content.replace(postRouteRegex, newPostRoute);
  fs.writeFileSync(filePath, content);
  console.log('POST /api/customers route replaced successfully!');
} else {
  console.log('POST route regex did not match!');
}

process.exit(0);
