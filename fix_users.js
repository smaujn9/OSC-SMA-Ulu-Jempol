import fs from 'fs';
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
/      allow update: if isAdminUtama\(\) \|\| \([\s\S]*?allow delete: if isAdminUtama\(\);/,
`      allow update: if isAdminUtama() || (
        isSignedIn() && (
          getUserData().role == 'Setiausaha' ||
          getUserData().role == 'Naib Setiausaha'
        ) && (
          !('role' in request.resource.data) || request.resource.data.role == resource.data.role
        ) && (
          !('isSuperAdmin' in request.resource.data) || request.resource.data.isSuperAdmin == resource.data.isSuperAdmin
        )
      ) || (
        isOwner(userId) && 
        (!('role' in request.resource.data) || request.resource.data.role == resource.data.role) && 
        (!('isSuperAdmin' in request.resource.data) || request.resource.data.isSuperAdmin == resource.data.isSuperAdmin)
      );
      allow delete: if isAdminUtama();`
);

fs.writeFileSync('firestore.rules', content);
