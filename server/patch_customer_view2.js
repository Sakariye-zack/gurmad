const fs = require('fs');
const filePath = 'c:/Users/abuus/Downloads/gurmad/gurmad system/src/components/CustomerView.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF to LF for processing
content = content.replace(/\r\n/g, '\n');

// 1. Replace the messy collector optgroups with a clean simple ID-based list
// Lines 739-758: Replace from <option value="">-- Dooro Collector --</option> to </select>
const oldOptions = `                    <option value="">-- Dooro Collector --</option>
                    {/* Priority: Collector assigned to the selected zone */}
                    {newCustomer.zone && zones.find(z => z.name === newCustomer.zone)?.collector_id && (
                       <optgroup label="Zone Assigned Collector (Recommended)">
                          <option value={zones.find(z => z.name === newCustomer.zone).collector_id}>
                             {zones.find(z => z.name === newCustomer.zone).collector_id}
                          </option>
                       </optgroup>
                    )}
                    
                    {/* All other available collectors */}
                    <optgroup label="All Available Collectors">
                      {employees.filter(emp => emp.role === 'Waste Collector' || emp.role === 'Collector').map(emp => (
                         <option key={emp.id} value={emp.name}>{emp.name}</option>
                      ))}
                      {/* Fallback for zones that have collectors not in employee list */}
                      {zones.map(z => z.collector_id).filter((v, i, a) => v && a.indexOf(v) === i).map(c => (
                         <option key={\`zone-list-\${c}\`} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>`;

const newOptions = `                    <option value="">-- Select Collector --</option>
                    {employees.filter(emp => emp.role === 'Waste Collector' || emp.role === 'Collector').map(emp => (
                       <option key={emp.id} value={emp.id}>{emp.id} - {emp.name}</option>
                    ))}
                  </select>`;

if (content.includes(oldOptions)) {
  content = content.replace(oldOptions, newOptions);
  console.log('✅ Collector options replaced successfully!');
} else {
  // try simpler match
  const simpleOld = '                    <option value="">-- Dooro Collector --</option>';
  const idx = content.indexOf(simpleOld);
  if (idx !== -1) {
    const closeTag = content.indexOf('</select>', idx);
    const oldBlock = content.substring(idx, closeTag + '</select>'.length);
    content = content.replace(oldBlock, newOptions);
    console.log('✅ Collector options replaced via simple match!');
  } else {
    console.log('❌ Could not find collector options to replace!');
  }
}

// 2. Insert enterprise fields between the 2-col row closing </div></div> and the Google Maps section
const googleMapsDivider = `              <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '24px', border: '1px solid #f1f5f9' }}>`;

const enterpriseRowInsert = `              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Route Priority (Order)</label>
                  <input type="number" placeholder="1" value={newCustomer.route_order} onChange={e => setNewCustomer({...newCustomer, route_order: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Collection Freq.</label>
                  <select value={newCustomer.collection_frequency} onChange={e => setNewCustomer({...newCustomer, collection_frequency: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }}>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="On-Call">On-Call</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Payment Status</label>
                  <select value={newCustomer.payment_status} onChange={e => setNewCustomer({...newCustomer, payment_status: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600, color: newCustomer.payment_status === 'Paid' ? '#10b981' : '#f43f5e' }}>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              ${googleMapsDivider}`;

if (content.includes(googleMapsDivider) && !content.includes('Route Priority')) {
  content = content.replace(googleMapsDivider, enterpriseRowInsert);
  console.log('✅ Enterprise fields inserted before Google Maps section!');
} else if (content.includes('Route Priority')) {
  console.log('ℹ️  Enterprise fields already present, skipping.');
} else {
  console.log('❌ Could not find Google Maps divider to insert enterprise fields!');
}

// Write back with CRLF line endings (Windows)
fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'));
console.log('✅ CustomerView.jsx saved successfully!');
process.exit(0);
