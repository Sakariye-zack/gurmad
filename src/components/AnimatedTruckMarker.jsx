import React, { useEffect, useRef, useState } from 'react';
import { Marker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getRoute, calculateBearing, snapToRoad } from '../utils/routing';
import { Cpu } from 'lucide-react';

export const AnimatedTruckMarker = ({ task, isSelected, onSelect, onOptimizeRoute }) => {
  const [currentPos, setCurrentPos] = useState([parseFloat(task.lat), parseFloat(task.lng)]);
  const [bearing, setBearing] = useState(0);
  const markerRef = useRef(null);
  
  // Track the previous target position to detect changes
  const prevTargetPosRef = useRef([parseFloat(task.lat), parseFloat(task.lng)]);
  
  // Animation state
  const animationRef = useRef(null);
  
  // Snap to road on initial mount
  useEffect(() => {
    snapToRoad([parseFloat(task.lat), parseFloat(task.lng)]).then(snapped => {
      setCurrentPos(snapped);
      prevTargetPosRef.current = snapped;
    });
  }, []);
  
  useEffect(() => {
    const newTarget = [parseFloat(task.lat), parseFloat(task.lng)];
    if (isNaN(newTarget[0]) || isNaN(newTarget[1])) return;
    
    const prevTarget = prevTargetPosRef.current;
    
    // If the target position has changed
    if (newTarget[0] !== prevTarget[0] || newTarget[1] !== prevTarget[1]) {
      // Calculate straight line distance (rough check)
      const dist = Math.sqrt(Math.pow(newTarget[0] - prevTarget[0], 2) + Math.pow(newTarget[1] - prevTarget[1], 2));
      
      // If it's a huge jump, just teleport
      if (dist > 0.1) {
        setCurrentPos(newTarget);
        prevTargetPosRef.current = newTarget;
        return;
      }

      // Fetch the road route
      getRoute(currentPos, newTarget).then(routePoints => {
        if (!routePoints || routePoints.length < 2) {
          setCurrentPos(newTarget);
          prevTargetPosRef.current = newTarget;
          return;
        }

        // Animate along the route points
        let startTime = null;
        const DURATION = 1500; // Increased speed (1.5 seconds)
        
        const animate = (timestamp) => {
          if (!startTime) startTime = timestamp;
          const progress = (timestamp - startTime) / DURATION;
          
          if (progress < 1) {
            // Find which segment of the route we are on
            const routeProgress = progress * (routePoints.length - 1);
            const index = Math.floor(routeProgress);
            const nextIndex = Math.min(index + 1, routePoints.length - 1);
            const segmentProgress = routeProgress - index;
            
            const p1 = routePoints[index];
            const p2 = routePoints[nextIndex];
            
            const currentLat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
            const currentLng = p1[1] + (p2[1] - p1[1]) * segmentProgress;
            
            // Calculate bearing between the two current route points
            if (p1[0] !== p2[0] || p1[1] !== p2[1]) {
              const newBearing = calculateBearing(p1, p2);
              setBearing(newBearing);
            }
            
            setCurrentPos([currentLat, currentLng]);
            
            // We use direct DOM manipulation for smoother performance instead of React state if we had a ref
            // But state works fine for a few dozen markers
            animationRef.current = requestAnimationFrame(animate);
          } else {
            setCurrentPos(newTarget);
          }
        };
        
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(animate);
      });
      
      prevTargetPosRef.current = newTarget;
    }
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [task.lat, task.lng]);

  // Create a custom icon that rotates the image inside
  const createRotatedIcon = (b, status) => {
    // Top-down garbage truck SVG
    const color = status === 'In Progress' ? '#3FAE2A' : '#f59e0b';
    
    const svgIcon = `
      <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${b}deg); transition: transform 0.3s; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.4));">
        <!-- Compactor Body -->
        <rect x="14" y="16" width="20" height="26" rx="2" fill="${color}" stroke="#1e293b" stroke-width="1" />
        <!-- Details -->
        <rect x="16" y="20" width="16" height="18" rx="1" fill="rgba(0,0,0,0.15)" />
        <line x1="18" y1="24" x2="30" y2="24" stroke="rgba(0,0,0,0.2)" stroke-width="2" />
        <line x1="18" y1="30" x2="30" y2="30" stroke="rgba(0,0,0,0.2)" stroke-width="2" />
        <line x1="18" y1="36" x2="30" y2="36" stroke="rgba(0,0,0,0.2)" stroke-width="2" />
        <!-- Cabin -->
        <rect x="15" y="6" width="18" height="10" rx="3" fill="#e2e8f0" stroke="#1e293b" stroke-width="1" />
        <!-- Windshield -->
        <rect x="16" y="8" width="16" height="5" rx="1.5" fill="#0f172a" />
        <!-- Headlights -->
        <circle cx="17" cy="5" r="1.5" fill="#fef08a" />
        <circle cx="31" cy="5" r="1.5" fill="#fef08a" />
        <!-- Flashing Beacon -->
        <circle cx="24" cy="14" r="2" fill="#ef4444">
          <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
        </circle>
      </svg>
    `;
    
    return L.divIcon({
      html: svgIcon,
      className: 'rotated-truck-icon',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'In Progress': return '#3FAE2A';
      case 'Pending': return '#f59e0b';
      case 'Completed': return '#3b82f6';
      default: return '#64748b';
    }
  };

  return (
    <Marker 
      position={currentPos} 
      icon={createRotatedIcon(bearing, task.status)}
      eventHandlers={{ click: onSelect }}
      ref={markerRef}
      zIndexOffset={1000}
    >
      <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent={task.status === 'In Progress'}>
        <div style={{ fontWeight: 900, fontSize: '0.8rem', backgroundColor: 'white', padding: '4px 8px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          {task.vehicle_plate || 'TRK-01'}
        </div>
      </Tooltip>
      <Popup>
        <div style={{ padding: '0', minWidth: '260px', borderRadius: '24px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: getStatusColor(task.status), padding: '20px', color: 'white' }}>
            <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>{task.vehicle_plate || 'GAADHI'}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{task.status} • {task.route_name}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>Speed: ~40 km/h</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800, marginBottom: '4px' }}>DRIVER & COLLECTOR</div>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{task.driver_name}</div>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Collector: {task.collector_name || 'N/A'}</div>
            
            <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#f0fdf4', borderRadius: '16px', border: '1px solid #dcfce7' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 900, color: '#166534', marginBottom: '6px' }}>
                  <Cpu size={16} /> AI SMART INSIGHT
               </div>
               <div style={{ fontSize: '0.85rem', color: '#14532d', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {task.status === 'In Progress' ? 'Gaadhigu wuxuu ku socdaa si hufan waddada.' : 'Sugaya in la bilaabo hawsha. Dhammaan agabkii waa diyaar.'}
               </div>
               <button 
                 onClick={(e) => { e.stopPropagation(); if (onOptimizeRoute) onOptimizeRoute(task.id); }}
                 style={{
                   marginTop: '12px', width: '100%', padding: '10px', borderRadius: '12px',
                   backgroundColor: '#3FAE2A', color: 'white', border: 'none', fontWeight: 800,
                   cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                   fontSize: '0.85rem', boxShadow: '0 4px 10px rgba(63, 174, 42, 0.3)'
                 }}
               >
                 <Cpu size={16} /> OPTIMIZE ROUTE (AI)
               </button>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};
