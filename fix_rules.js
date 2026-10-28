import fs from 'fs';
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
/    match \/users\/\{userId\} \{[\s\S]*?allow update: if isAdmin\(\) \|\| \([\s\S]*?allow delete: if isAdminUtama\(\);\n    \}/,
`    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isAdminUtama() || (
        isOwner(userId) && 
        (!('role' in request.resource.data) || request.resource.data.role == 'Ahli Biasa') && 
        (!('isSuperAdmin' in request.resource.data) || request.resource.data.isSuperAdmin != true)
      );
      allow update: if isAdminUtama() || (
        isOwner(userId) && 
        (!('role' in request.resource.data) || request.resource.data.role == resource.data.role) && 
        (!('isSuperAdmin' in request.resource.data) || request.resource.data.isSuperAdmin == resource.data.isSuperAdmin)
      );
      allow delete: if isAdminUtama();
    }`
);

content = content.replace(
/    match \/membershipApplications\/\{appId\} \{\n      allow read: if isSignedIn\(\);\n      allow create: if isSignedIn\(\);\n      allow update, delete: if isAdmin\(\);\n    \}/,
`    match /membershipApplications/{appId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isAdminUtama() || (
        isSignedIn() && (
          getUserData().role == 'Setiausaha' ||
          getUserData().role == 'Naib Setiausaha'
        )
      );
    }`
);

content = content.replace(
/    match \/auditLogs\/\{logId\} \{\n      allow read: if isAdmin\(\);/,
`    match /auditLogs/{logId} {
      allow read: if isAdminUtama();`
);

content = content.replace(
/    match \/roles\/\{logId\} \{\n      allow read, write: if isAdmin\(\);\n    \}/,
`    match /roles/{logId} {
      allow read, write: if isAdminUtama();
    }`
);

content = content.replace(
/    match \/system\/\{docId\} \{\n      allow read: if true;\n      allow write: if isAdmin\(\);\n    \}/,
`    match /system/{docId} {
      allow read: if true;
      allow write: if isAdminUtama();
    }`
);

fs.writeFileSync('firestore.rules', content);
