const fs = require('fs');

const file = 'c:\\\\Users\\\\abuus\\\\Downloads\\\\gurmad\\\\gurmad system\\\\src\\\\components\\\\FleetView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the view toggles
const toggleBlockSearch = `          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button onClick={() => setViewMode('cards')} style={{ padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'cards' ? 'white' : 'transparent', color: viewMode === 'cards' ? 'var(--gurmad-green)' : '#94a3b8' }}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} style={{ padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'table' ? 'white' : 'transparent', color: viewMode === 'table' ? 'var(--gurmad-green)' : '#94a3b8' }}><List size={18} /></button>
             </div>
             <button onClick={() => openModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
                <Plus size={18} /> New Zone
             </button>
          </div>`;

const toggleBlockReplace = `          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <button onClick={() => openModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
                <Plus size={18} /> New Zone
             </button>
          </div>`;

content = content.replace(toggleBlockSearch, toggleBlockReplace);

// 2. Remove the cards view
const startSearch = "      {activeTab === 'zones' ? (";
const startIdx = content.indexOf(startSearch);

const endSearch = "            <div className=\"card\" style={{ padding: 0, borderRadius: '20px', overflow: 'hidden' }}>";
const endIdx = content.indexOf(endSearch);

const restOfContent = content.substring(endIdx);

// We need to also remove the closing `)}` and `</>`
// Wait, the table ends with:
//               </table>
//             </div>
//           )}
//         </>
//       ) : (

const afterTableSearch = `              </table>
            </div>
          )}
        </>
      ) : (`;

const afterTableReplace = `              </table>
            </div>
      ) : (`;

let updatedRest = restOfContent.replace(afterTableSearch, afterTableReplace);

const newContent = content.substring(0, startIdx + startSearch.length) + "\\n" + updatedRest;

fs.writeFileSync(file, newContent, 'utf8');

console.log("Replaced successfully!");
