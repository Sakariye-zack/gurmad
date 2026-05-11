const db = require('./db');

async function check() {
  try {
    const testFind = await db.query("SELECT id FROM customers LIMIT 1");
    if (testFind.rows.length > 0) {
      const custId = testFind.rows[0].id;
      console.log('Testing update on customer ID:', custId);

      // Replicate the exact server query
      const upd = await db.query(
        `UPDATE customers SET 
          name = $1, phone = $2, house_no = $3, street = $4, area = $5, status = $6, lat = $7, lng = $8, 
          whatsapp = $9, neighborhood = $10, zone = $11, category = $12, fee = $13, 
          collector_id = $14, route_order = $15, collection_frequency = $16, payment_status = $17,
          collection_mode = $19
         WHERE id = $18 RETURNING id, name`,
        [
          'Test Name', '0612345', 'H1', null, 'Burao', 'Unpaid', null, null,
          null, 'Sayidka', null, 'Guri', 10,
          null, null, 'Weekly', 'Unpaid',
          custId,
          'Monthly'
        ]
      );
      console.log('UPDATE SUCCESS:', upd.rows[0]);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('DETAIL:', e.detail || '');
    console.error('HINT:', e.hint || '');
  }
  process.exit(0);
}

check();
