import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const appsSnapshot = await getDocs(collection(db, "membershipApplications"));
  const usersSnapshot = await getDocs(collection(db, "users"));
  
  const usersByUid = new Map();
  const usersByEmail = new Map();
  const usersByIc = new Map();

  usersSnapshot.forEach(d => {
    const data = d.data();
    usersByUid.set(d.id, data);
    if (data.email) usersByEmail.set(data.email.toLowerCase().trim(), { id: d.id, ...data });
    if (data.icNumber) usersByIc.set(data.icNumber.trim(), { id: d.id, ...data });
  });

  const discrepancies = [];

  appsSnapshot.forEach(d => {
    const app = d.data();
    if (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian' || app.status === 'Approved') {
      const emailLower = (app.email || '').toLowerCase().trim();
      const userByUid = app.uid ? usersByUid.get(app.uid) : null;
      const userByEmail = emailLower ? usersByEmail.get(emailLower) : null;
      const userByIc = app.icNumber ? usersByIc.get(app.icNumber.trim()) : null;

      const user = userByUid || userByEmail || userByIc;

      if (!user) {
        discrepancies.push({
          type: 'MISSING_USER_DOC',
          appId: d.id,
          appEmail: app.email,
          appName: app.name,
          appUid: app.uid
        });
      } else if (user.membershipStatus !== 'Aktif' || user.approvalStatus !== 'Approved') {
        discrepancies.push({
          type: 'STATUS_MISMATCH',
          appId: d.id,
          userUid: user.id || app.uid,
          appEmail: app.email,
          userEmail: user.email,
          appName: app.name,
          userName: user.displayName,
          userStatus: user.membershipStatus,
          userAppStatus: user.approvalStatus,
          userRole: user.role
        });
      }
    }
  });

  console.log("DISCREPANCIES:", JSON.stringify(discrepancies, null, 2));
  process.exit(0);
}

main().catch(console.error);
