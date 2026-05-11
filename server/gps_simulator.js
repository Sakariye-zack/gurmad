const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
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
      // 2. Get the latest two positions to determine direction
      const lastPosRes = await pool.query(
        "SELECT lat, lng FROM truck_location_history WHERE task_id = $1 ORDER BY created_at DESC LIMIT 2",
        [task.id]
      );
      
      let lat, lng, prevLat, prevLng;
      
      if (lastPosRes.rows.length === 0) {
        lat = 9.524; lng = 45.535;
        prevLat = lat; prevLng = lng;
      } else {
        lat = parseFloat(lastPosRes.rows[0].lat);
        lng = parseFloat(lastPosRes.rows[0].lng);
        prevLat = lastPosRes.rows[1] ? parseFloat(lastPosRes.rows[1].lat) : lat;
        prevLng = lastPosRes.rows[1] ? parseFloat(lastPosRes.rows[1].lng) : lng;
      }

      // 3. Determine direction and continue it, with slight random deviation
      let dLat = lat - prevLat;
      let dLng = lng - prevLng;
      
      // If no movement yet, pick a random starting direction
      if (dLat === 0 && dLng === 0) {
        const angle = Math.random() * Math.PI * 2;
        dLat = Math.cos(angle) * 0.0003;
        dLng = Math.sin(angle) * 0.0003;
      }

      // 10% chance to change direction significantly
      if (Math.random() < 0.1) {
        const angle = Math.random() * Math.PI * 2;
        dLat = Math.cos(angle) * 0.0004;
        dLng = Math.sin(angle) * 0.0004;
      } else {
        // Add tiny jitter to simulate road curves
        dLat += (Math.random() - 0.5) * 0.0001;
        dLng += (Math.random() - 0.5) * 0.0001;
      }

      // Normalize speed (keep it around 0.0004 units per tick)
      const speed = Math.sqrt(dLat*dLat + dLng*dLng);
      if (speed > 0) {
        dLat = (dLat / speed) * 0.0004;
        dLng = (dLng / speed) * 0.0004;
      }
      
      const newLat = lat + dLat;
      const newLng = lng + dLng;

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
