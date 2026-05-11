const db = require('./db');
db.query("UPDATE settings SET setting_value = 'Gurmad Waste Management' WHERE setting_key = 'landing_hero_title'")
  .then(() => console.log('Hero title fixed!'))
  .catch(e => console.error(e))
  .finally(() => process.exit());
