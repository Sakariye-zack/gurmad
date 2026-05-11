const fs = require('fs');

const file = 'c:\\\\Users\\\\abuus\\\\Downloads\\\\gurmad\\\\gurmad system\\\\src\\\\components\\\\FleetView.jsx';
let content = fs.readFileSync(file, 'utf8');

const tabSwitcherCode = `
      {/* Tab Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
          <button 
            onClick={() => setActiveTab('zones')}
            style={{ 
              padding: '0.7rem 1.4rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem',
              backgroundColor: activeTab === 'zones' ? 'white' : 'transparent',
              color: activeTab === 'zones' ? 'var(--gurmad-green)' : '#64748b',
              boxShadow: activeTab === 'zones' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              border: 'none', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <MapPin size={18} /> Zones Management
          </button>
          <button 
            onClick={() => setActiveTab('trucks')}
            style={{ 
              padding: '0.7rem 1.4rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem',
              backgroundColor: activeTab === 'trucks' ? 'white' : 'transparent',
              color: activeTab === 'trucks' ? 'var(--gurmad-green)' : '#64748b',
              boxShadow: activeTab === 'trucks' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              border: 'none', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Truck size={18} /> Trucks & Fleet
          </button>
        </div>

        {activeTab === 'zones' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button onClick={() => setViewMode('cards')} style={{ padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'cards' ? 'white' : 'transparent', color: viewMode === 'cards' ? 'var(--gurmad-green)' : '#94a3b8' }}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} style={{ padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'table' ? 'white' : 'transparent', color: viewMode === 'table' ? 'var(--gurmad-green)' : '#94a3b8' }}><List size={18} /></button>
             </div>
             <button onClick={() => openModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
                <Plus size={18} /> New Zone
             </button>
          </div>
        )}
      </div>

      {activeTab === 'zones' ? (
        <>
          {viewMode === 'cards' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.5rem' }}>
              {Object.entries(areaMetrics).map(([areaName, areaData]) => (
                <div key={areaName} className="card" style={{ padding: 0, borderTop: '5px solid var(--gurmad-green)', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '1.2rem' }}>{areaName}</h4>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <span style={{ fontSize: '0.75rem', fontWeight: 800, backgroundColor: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '25px' }}>{areaData.guri} Gurya</span>
                       <span style={{ fontSize: '0.75rem', fontWeight: 800, backgroundColor: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: '25px' }}>{areaData.meherad} Meherad</span>
                    </div>
                  </div>
                  <div style={{ padding: '1.5rem' }}>
                    {Object.entries(areaData.neighborhoods).map(([nName, nData]) => {
                      const isExpanded = expandedNeighborhoods.includes(nName);
                      return (
                        <div key={nName} style={{ marginBottom: '1rem' }}>
                           <div 
                            onClick={() => toggleNeighborhood(nName)}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '10px', 
                              marginBottom: '12px', 
                              cursor: 'pointer',
                              padding: '8px',
                              borderRadius: '10px',
                              backgroundColor: isExpanded ? '#f1f5f9' : 'transparent',
                              transition: '0.2s'
                            }}
                            onMouseEnter={(e) => !isExpanded && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => !isExpanded && (e.currentTarget.style.backgroundColor = 'transparent')}
                           >
                              <ChevronRight 
                                size={18} 
                                color="var(--gurmad-green)" 
                                style={{ 
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                                  transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} 
                              />
                              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#334155' }}>{nName}</span>
                              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>({nData.total} customers)</span>
                           </div>
                           
                           {isExpanded && (
                             <div style={{ marginLeft: '1.8rem', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'slideDown 0.3s ease-out' }}>
                                {Object.entries(nData.zones).map(([zName, zData]) => (
                                  <div 
                                    key={zName} 
                                    onClick={() => openDetails(zData.info, { total: zData.total, guri: zData.guri, meherad: zData.meherad })}
                                    style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '15px', border: '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', transition: '0.2s', cursor: 'pointer' }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gurmad-green)'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f1f5f9'}
                                  >
                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--gurmad-green)' }}></div>
                                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{zName}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                           <button 
                                            onClick={(e) => { e.stopPropagation(); openDetails(zData.info, { total: zData.total, guri: zData.guri, meherad: zData.meherad }); }} 
                                            style={{ color: '#64748b', background: '#f8fafc', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                           >
                                              <Eye size={16} />
                                           </button>
                                           <button 
                                            onClick={(e) => { e.stopPropagation(); openModal(zData.info); }} 
                                            style={{ color: '#64748b', background: '#f8fafc', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                           >
                                              <Edit3 size={16} />
                                           </button>
                                           <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteZone(zData.info.id); }} 
                                            style={{ color: '#f87171', background: '#fef2f2', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                           >
                                              <Trash2 size={16} />
                                           </button>
                                        </div>
                                     </div>
                                     {zData.info && (
                                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', fontSize: '0.8rem', color: '#64748b', borderTop: '1px dashed #f1f5f9', paddingTop: '10px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} color="#94a3b8" /> <strong>Driver:</strong> {zData.info.assigned_driver || 'None'}</div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Truck size={14} color="#94a3b8" /> <strong>Truck:</strong> {zData.info.assigned_truck || 'None'}</div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} color="#94a3b8" /> <strong>Days:</strong> {zData.info.collection_days || 'None'}</div>
                                       </div>
                                     )}
                                  </div>
                                ))}
                             </div>
                           )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, borderRadius: '20px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <tr>
                    <th style={{ padding: '1.5rem' }}>Zone & Location</th>
                    <th style={{ padding: '1.5rem' }}>Staff & Fleet</th>
                    <th style={{ padding: '1.5rem' }}>Schedule</th>
                    <th style={{ padding: '1.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map(z => (
                    <tr key={z.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1.2rem 1.5rem' }}>
                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{z.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>{z.area} • {z.neighborhood}</div>
                      </td>
                      <td style={{ padding: '1.2rem 1.5rem' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.85rem' }}>
                           <span style={{ backgroundColor: '#f1f5f9', padding: '5px 12px', borderRadius: '8px', color: '#475569', fontWeight: 600 }}>{z.assigned_driver || '-'}</span>
                           <span style={{ backgroundColor: '#f1f5f9', padding: '5px 12px', borderRadius: '8px', color: '#475569', fontWeight: 600 }}>{z.assigned_truck || '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.2rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> {z.collection_days || 'No Days Set'}</div>
                        {z.collection_time && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}><Clock size={14} /> {z.collection_time}</div>}
                      </td>
                      <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>
                        <button onClick={() => openDetails(z, { total: '?', guri: '?', meherad: '?' })} style={{ marginRight: '8px', color: '#64748b', background: '#f1f5f9', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Eye size={18} /></button>
                        <button onClick={() => openModal(z)} style={{ marginRight: '8px', color: '#64748b', background: '#f1f5f9', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Edit3 size={18} /></button>
                        <button onClick={() => handleDeleteZone(z.id)} style={{ color: '#ef4444', background: '#fef2f2', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (`;


const startSearch = "      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>\n        <h2 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>\n           <Truck size={24} color=\"var(--gurmad-green)\" /> Trucks & Fleet\n        </h2>\n      </div>";
const endSearch = "      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>";

const newContent = content.replace(startSearch, tabSwitcherCode.substring(1)).replace(endSearch, endSearch);
let finalContent = newContent.replace("         {/* Add Truck Card */}", "           {/* Add Truck Card */}");

// add the closing parenthesis for the ternary operator before the modal
finalContent = finalContent.replace("{/* Zone Management Modal */}", ")}\\n\\n      {/* Zone Management Modal */}");

fs.writeFileSync(file, finalContent, 'utf8');

console.log("Replaced successfully!");
