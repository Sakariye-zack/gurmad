import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { Camera, Clock, LogIn, LogOut, User, Calendar, CheckCircle, XCircle, Video } from 'lucide-react';
import { toast } from 'react-hot-toast';

const AttendanceView = () => {
  const [employees, setEmployees] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('clock'); // 'clock' | 'log'
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraAction, setCameraAction] = useState(null); // 'in' | 'out'
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [emps, today, all] = await Promise.all([
        api.getEmployees(),
        api.getAttendanceToday(),
        api.getAttendance()
      ]);
      setEmployees(emps);
      setTodayLogs(today);
      setAllLogs(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = useCallback(async (empId, action) => {
    setSelectedEmpId(empId);
    setCameraAction(action);
    setCapturedImage(null);
    setShowCamera(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      toast.error('Camera access denied. Please enable camera permissions.');
      setShowCamera(false);
    }
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
  };

  const submitAttendance = async () => {
    if (!capturedImage || !selectedEmpId) return;

    // Convert data URL to Blob
    const res = await fetch(capturedImage);
    const blob = await res.blob();
    
    const formData = new FormData();
    formData.append('employee_id', selectedEmpId);
    
    const photoField = cameraAction === 'in' ? 'clock_in_photo' : 'clock_out_photo';
    formData.append(photoField, blob, `attendance_${Date.now()}.jpg`);

    const loadingToast = toast.loading(cameraAction === 'in' ? 'Clocking in...' : 'Clocking out...');
    try {
      const result = cameraAction === 'in' 
        ? await api.clockIn(formData) 
        : await api.clockOut(formData);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(cameraAction === 'in' ? 'Clocked In Successfully! ✅' : 'Clocked Out! See you tomorrow 👋');
        loadData();
      }
    } catch (err) {
      toast.error('Failed to record attendance');
    } finally {
      toast.dismiss(loadingToast);
      closeCamera();
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCapturedImage(null);
    setSelectedEmpId(null);
    setCameraAction(null);
  };

  const getEmployeeStatus = (empId) => {
    const log = todayLogs.find(l => l.employee_id === empId);
    if (!log) return { status: 'absent', label: 'Not Checked In', color: '#ef4444' };
    if (log.clock_out) return { status: 'out', label: 'Checked Out', color: '#6b7280' };
    return { status: 'in', label: 'On Duty', color: '#22c55e' };
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="card glass">Loading attendance system...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        <button 
          onClick={() => setActiveView('clock')}
          style={{
            padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem',
            backgroundColor: activeView === 'clock' ? 'white' : 'transparent',
            color: activeView === 'clock' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: activeView === 'clock' ? 'var(--shadow-sm)' : 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
          <Clock size={18} /> Clock In / Out
        </button>
        <button 
          onClick={() => setActiveView('log')}
          style={{
            padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem',
            backgroundColor: activeView === 'log' ? 'white' : 'transparent',
            color: activeView === 'log' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: activeView === 'log' ? 'var(--shadow-sm)' : 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
          <Calendar size={18} /> Attendance Log
        </button>
      </div>

      {/* ====== Camera Modal ====== */}
      {showCamera && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(6px)'
        }}>
          <div className="card" style={{ width: '480px', textAlign: 'center', borderTop: `4px solid ${cameraAction === 'in' ? '#22c55e' : '#ef4444'}` }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {cameraAction === 'in' ? <LogIn color="#22c55e" /> : <LogOut color="#ef4444" />}
              {cameraAction === 'in' ? 'Clock In Verification' : 'Clock Out Verification'}
            </h3>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Position your face in the camera and click Capture.
            </p>

            <div style={{ 
              width: '100%', height: '300px', borderRadius: '12px', overflow: 'hidden', 
              backgroundColor: '#111', marginBottom: '1rem', position: 'relative'
            }}>
              {!capturedImage ? (
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              ) : (
                <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={closeCamera} style={{ 
                padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid var(--border-color)', 
                fontWeight: 600, cursor: 'pointer', backgroundColor: 'white' 
              }}>
                Cancel
              </button>
              
              {!capturedImage ? (
                <button onClick={capturePhoto} style={{ 
                  padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', 
                  fontWeight: 600, cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Camera size={18} /> Capture
                </button>
              ) : (
                <>
                  <button onClick={() => setCapturedImage(null)} style={{ 
                    padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid var(--border-color)', 
                    fontWeight: 600, cursor: 'pointer', backgroundColor: 'white' 
                  }}>
                    Retake
                  </button>
                  <button onClick={submitAttendance} style={{ 
                    padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', 
                    fontWeight: 600, cursor: 'pointer', 
                    backgroundColor: cameraAction === 'in' ? '#22c55e' : '#ef4444', color: 'white',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <CheckCircle size={18} /> Confirm {cameraAction === 'in' ? 'Clock In' : 'Clock Out'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== Clock In / Out View ====== */}
      {activeView === 'clock' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontWeight: 700, margin: 0 }}>Today's Attendance</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '0.5rem 1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '1.2rem' }}>
                  {employees.filter(e => getEmployeeStatus(e.id).status === 'in').length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>On Duty</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.5rem 1rem', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '1.2rem' }}>
                  {employees.filter(e => getEmployeeStatus(e.id).status === 'absent').length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Absent</div>
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>EMPLOYEE</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>CLOCK IN</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>CLOCK OUT</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const empStatus = getEmployeeStatus(emp.id);
                const todayLog = todayLogs.find(l => l.employee_id === emp.id);
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden',
                          backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, color: '#3b82f6', border: `2px solid ${empStatus.color}`
                        }}>
                          {emp.photo 
                            ? <img src={`/uploads/${emp.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : emp.name[0].toUpperCase()
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{emp.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.role}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ 
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                        backgroundColor: empStatus.color + '15', color: empStatus.color
                      }}>
                        {empStatus.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                      {formatTime(todayLog?.clock_in)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                      {formatTime(todayLog?.clock_out)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {empStatus.status === 'absent' && (
                        <button onClick={() => startCamera(emp.id, 'in')} style={{
                          padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          backgroundColor: '#22c55e', color: 'white', fontWeight: 600, fontSize: '0.85rem',
                          display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}>
                          <LogIn size={16} /> Clock In
                        </button>
                      )}
                      {empStatus.status === 'in' && (
                        <button onClick={() => startCamera(emp.id, 'out')} style={{
                          padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          backgroundColor: '#ef4444', color: 'white', fontWeight: 600, fontSize: '0.85rem',
                          display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}>
                          <LogOut size={16} /> Clock Out
                        </button>
                      )}
                      {empStatus.status === 'out' && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Completed ✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ====== Attendance Log View ====== */}
      {activeView === 'log' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontWeight: 700, margin: 0 }}>Full Attendance History</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>EMPLOYEE</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>DATE</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>CLOCK IN</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>CLOCK OUT</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>HOURS</th>
                <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>VERIFICATION</th>
              </tr>
            </thead>
            <tbody>
              {allLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No attendance records yet.
                  </td>
                </tr>
              ) : allLogs.map(log => {
                const hours = log.clock_in && log.clock_out 
                  ? ((new Date(log.clock_out) - new Date(log.clock_in)) / 3600000).toFixed(1) 
                  : '—';
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#3b82f6', overflow: 'hidden', fontSize: '0.85rem' }}>
                          {log.employee_photo 
                            ? <img src={`/uploads/${log.employee_photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : log.employee_name?.[0]?.toUpperCase()
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.employee_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.employee_role}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500, fontSize: '0.9rem' }}>
                      {new Date(log.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                      {formatTime(log.clock_in)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                      {formatTime(log.clock_out)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {hours !== '—' ? `${hours} hrs` : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {log.clock_in_photo && (
                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #22c55e' }}>
                            <img src={`/uploads/${log.clock_in_photo}`} alt="In" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        {log.clock_out_photo && (
                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #ef4444' }}>
                            <img src={`/uploads/${log.clock_out_photo}`} alt="Out" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        {!log.clock_in_photo && !log.clock_out_photo && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No photos</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceView;
