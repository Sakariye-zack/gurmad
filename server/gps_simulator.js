const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function simulateMovement() {
  console.log('--- STARTING GURMAD GPS SIMULATION ---');
  
  try {
    // 1. Find all active tasks (In Progress)
    const activeTasksRes = await pool.query("SELECT * FROM tasks WHERE status = 'In Progress'");
    const tasks = activeTasksRes.rows;
    
    if (tasks.length === 0) {
      console.log('No active tasks found. Simulation idling...');
      return;
    }

    for (const task of tasks) {
      // 2. Get the latest position
      const lastPosRes = await pool.query(
        "SELECT lat, lng FROM truck_location_history WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1",
        [task.id]
      );
      
      let lat, lng;
      
      if (lastPosRes.rows.length === 0) {
        // Start near Burao center if no history
        lat = 9.524;
        lng = 45.535;
      } else {
        lat = parseFloat(lastPosRes.rows[0].lat);
        lng = parseFloat(lastPosRes.rows[0].lng);
      }

      // 3. Move slightly (random walk)
      const deltaLat = (Math.random() - 0.5) * 0.0008;
      const deltaLng = (Math.random() - 0.5) * 0.0008;
      
      const newLat = lat + deltaLat;
      const newLng = lng + deltaLng;

      // 4. Save new position
      await pool.query(
        "INSERT INTO truck_location_history (task_id, lat, lng) VALUES ($1, $2, $3)",
        [task.id, newLat, newLng]
      );
      
      console.log(`[TASK ${task.id}] Moved to: ${newLat.toFixed(6)}, ${newLng.toFixed(6)} (${task.driver_name})`);
    }
    
  } catch (err) {
    console.error('Simulation Error:', err.message);
  }
}

// Run every 5 seconds
setInterval(simulateMovement, 5000);
simulateMovement();
