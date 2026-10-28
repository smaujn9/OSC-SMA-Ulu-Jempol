import fs from 'fs';
let content = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

content = content.replace(
/if \(currentUserDoc\.role !== 'Setiausaha' && currentUserDoc\.role !== 'Admin Utama'\) \{/g,
`if (currentUserDoc.role !== 'Setiausaha' && currentUserDoc.role !== 'Naib Setiausaha' && currentUserDoc.role !== 'Admin Utama') {`
);

fs.writeFileSync('src/context/AuthContext.tsx', content);
