/**
 * Fetches a route between two coordinates using the public OSRM API.
 * Note: OSRM expects coordinates in [longitude, latitude] order.
 * 
 * @param {Array} start - [lat, lng]
 * @param {Array} end - [lat, lng]
 * @returns {Promise<Array>} - Array of coordinates representing the route path [[lat, lng], [lat, lng], ...]
 */
export const getRoute = async (start, end) => {
  try {
    const query = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
    );
    const data = await query.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // OSRM returns GeoJSON coordinates as [longitude, latitude]
      // We need to map them back to [latitude, longitude] for Leaflet
      return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
    } else {
      // Fallback to straight line if routing fails
      return [start, end];
    }
  } catch (error) {
    console.error("OSRM Routing Error:", error);
    // Fallback to straight line
    return [start, end];
  }
};

/**
 * Calculates the bearing (angle) between two points
 * @param {Array} start - [lat, lng]
 * @param {Array} end - [lat, lng]
 * @returns {number} - Bearing in degrees
 */
export const calculateBearing = (start, end) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const lat1 = toRad(start[0]);
  const lon1 = toRad(start[1]);
  const lat2 = toRad(end[0]);
  const lon2 = toRad(end[1]);

  const dLon = lon2 - lon1;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
};

/**
 * Snaps a coordinate to the nearest road using OSRM nearest service
 * @param {Array} coord - [lat, lng]
 * @returns {Promise<Array>} - Snapped [lat, lng]
 */
export const snapToRoad = async (coord) => {
  try {
    const query = await fetch(
      `https://router.project-osrm.org/nearest/v1/driving/${coord[1]},${coord[0]}?number=1`
    );
    const data = await query.json();
    
    if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
      const snapped = data.waypoints[0].location;
      return [snapped[1], snapped[0]]; // Return as [lat, lng]
    }
    return coord;
  } catch (error) {
    console.error("OSRM Nearest Error:", error);
    return coord;
  }
};
