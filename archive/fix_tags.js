const fs = require('fs');
let c = fs.readFileSync('src/app/holdings/page.js', 'utf8');

// Fix the corrupted tags caused by PowerShell variable expansion
c = c.replace(/<td-3/g, '<td className="px-6 py-3');
c = c.replace(/<td className="px-6 py-3 text-center">/, '<td colSpan="5" className="px-6 py-3 text-center">');
c = c.replace(/<td className="px-6 py-3 text-right">/, '<td className="px-6 py-3 text-right">');
// Check for template literals that might have been corrupted 
c = c.replace(/<td className=\{`px-6 py-3/g, '<td className={`px-6 py-3');

// Wait, the safest way is to replace ALL <td-3 with <td className="px-6 py-3, 
// then restore the colSpan="5" where needed
c = c.replace(/<td colSpan="5" className="px-6 py-3 text-center">/, '<td colSpan="5" className="px-6 py-3 text-center">');
fs.writeFileSync('src/app/holdings/page.js', c, 'utf8');
console.log('Fixed syntax errors');
