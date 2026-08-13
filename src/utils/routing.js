const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
  const user = JSON.parse(localStorage.getItem('gurmadUser') || '{}');
  const headers = {};
  if (user.role) headers['x-user-role'] = user.role;
  if (user.token) headers['Authorization'] = `Bearer ${user.token}`;
  return headers;
};

/**
 * Fetches a road-following route between two coordinates via the backend's OSRM proxy
 * (/api/route). Routed through our own backend instead of calling the public OSRM demo
 * server directly from the browser, which used to fail/rate-limit silently and fall back
 * to a straight line — making trucks look like they were driving over houses/blocks.
 *
 * @param {Array} start - [lat, lng]
 * @param {Array} end - [lat, lng]
 * @returns {Promise<Array>} - Array of coordinates representing the route path [[lat, lng], [lat, lng], ...]
 */
export const getRoute = async (start, end) => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/route?start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (data.success && data.coordinates) {
      return data.coordinates;
    }
    // Fallback to straight line if routing fails
    return [start, end];
  } catch (error) {
    console.error("Routing Error:", error);
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
 * Snaps a coordinate to the nearest road via the backend's OSRM proxy (/api/snap-to-road).
 * @param {Array} coord - [lat, lng]
 * @returns {Promise<Array>} - Snapped [lat, lng]
 */
export const snapToRoad = async (coord) => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/snap-to-road?lat=${coord[0]}&lng=${coord[1]}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (data.success) {
      return [data.lat, data.lng];
    }
    return coord;
  } catch (error) {
    console.error("Snap-to-road Error:", error);
    return coord;
  }
};
