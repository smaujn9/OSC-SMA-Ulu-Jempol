import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const collections = [
  "users",
  "membershipApplications",
  "auditLogs",
  "roles",
  "posts",
  "fees",
  "blogs",
  "programReports",
  "events",
  "announcements",
  "kewanganTransactions",
  "kewanganBalanceSheet",
  "kewanganVerification",
  "system",
  "cases",
  "complaints",
  "notisPanggilan",
  "kehadiran",
  "minitMesyuarat",
  "qurbanRegistrations",
  "surat_rasmi",
  "folders",
  "kertasKerja",
  "paymentVouchers",
  "perbelanjaanProgram",
  "loginLogs",
  "admins",
  "donations",
  "sumbangan",
  "chat",
  "comments"
];

async function clearData() {
  console.log("Checking database:", config.firestoreDatabaseId);
  let totalDeleted = 0;
  for (const coll of collections) {
    try {
      const snapshot = await getDocs(collection(db, coll));
      if (!snapshot.empty) {
        console.log(`Clearing ${coll}: found ${snapshot.size} documents...`);
        for (const d of snapshot.docs) {
          await deleteDoc(doc(db, coll, d.id));
          totalDeleted++;
        }
      }
    } catch (e: any) {
      console.warn(`Error checking collection ${coll}:`, e.message);
    }
  }
  console.log(`Database clear complete. Total deleted: ${totalDeleted} documents.`);
  process.exit(0);
}

clearData().catch(console.error);
