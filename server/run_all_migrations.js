const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const serverDir = __dirname;
const files = fs.readdirSync(serverDir);
const migrations = files.filter(f => f.startsWith('migrate_') && f.endsWith('.js'));

console.log(`Found ${migrations.length} migrations. Updating SSL and running...`);

// First, make sure db.js is used or SSL is added to each.
// Actually, it's easier to just run them if they use process.env and I've already updated the .env.
// But they all create their own Pool. I need to make sure they have SSL.

migrations.forEach(file => {
  const filePath = path.join(serverDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('new Pool') && !content.includes('ssl:')) {
    console.log(`Adding SSL to ${file}...`);
    content = content.replace(
      /database: process\.env\.DB_NAME,?\n\s*\}\);/g,
      `database: process.env.DB_NAME,\n  ssl: { rejectUnauthorized: false }\n});`
    );
    fs.writeFileSync(filePath, content);
  }
  
  try {
    console.log(`Running ${file}...`);
    const output = execSync(`node ${file}`, { cwd: serverDir, encoding: 'utf8' });
    console.log(output);
  } catch (err) {
    console.error(`Failed to run ${file}:`, err.message);
  }
});

console.log('All migrations processed! ✅');
