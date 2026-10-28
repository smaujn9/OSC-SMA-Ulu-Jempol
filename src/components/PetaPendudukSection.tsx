import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Map, Compass, ArrowUpRight, Layers } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, MembershipApplication } from '../context/AuthContext';

interface PetaPendudukSectionProps {
  isMobile?: boolean;
}

// Baseline lot statuses for Lots 121-232 (24 Vacant lots & Lot 144 tenant marker)
const VACANT_LOTS = new Set<number>([
  227, 224, 192, 196, 197, 198, 201, 202, 206, 207, 208, 213,
  185, 146, 149, 151, 155, 156, 157, 166, 144, 140, 132, 122
]);

const BASELINE_APPROVED_LOTS = new Set<number>([
  121, 126, 127, 128, 129, 130, 133, 134, 136, 137, 138, 141,
  142, 143, 145, 147, 148, 150, 153, 158, 160, 161, 162, 163,
  164, 168, 169, 170, 171, 172, 175, 176, 177, 180, 181, 186,
  187, 193, 194, 195, 203, 212, 215, 217, 220, 222, 223, 231
]);

const BASELINE_TENANT_LOTS = new Set<number>([
  223, 193, 212, 187, 175, 150, 162, 144
]);

export default function PetaPendudukSection({ isMobile = false }: PetaPendudukSectionProps) {
  const { firebaseUser, allUsers, allApplications, currentUserDoc } = useAuth();
  const [publicApps, setPublicApps] = useState<MembershipApplication[]>([]);

  const effectiveApplications = publicApps.length > 0 ? publicApps : allApplications;

  // Semak sama ada pengguna adalah Ahli yang Diluluskan (Tetamu / Pelawat / Kuiri / Belum Lulus tidak dibenarkan melihat section ini)
  const isApprovedMember = useMemo(() => {
    if (!firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid === 'guest_local') {
      return false;
    }

    const userEmail = (currentUserDoc?.email || firebaseUser?.email || '').toLowerCase().trim();
    const userIc = (currentUserDoc?.icNumber || '').trim();
    const userMemberNo = (currentUserDoc?.memberNo || '').trim();

    const hasKuiriApp = (effectiveApplications || []).some(
      (app) =>
        (app.uid === currentUserDoc?.uid ||
          app.uid === firebaseUser?.uid ||
          app.id === `app-${firebaseUser?.uid}` ||
          app.id === firebaseUser?.uid ||
          (userEmail && app.email && app.email.toLowerCase().trim() === userEmail) ||
          (userIc && app.icNumber && app.icNumber.trim() === userIc) ||
          (userMemberNo && app.memberNo && app.memberNo.trim() === userMemberNo)) &&
        (app.status === 'Kuiri' || app.status === 'Kuiri Permohonan' || app.status === 'Perlu Kemaskini')
    );

    const isKuiriUser = Boolean(
      currentUserDoc?.membershipStatus === 'Kuiri' ||
        currentUserDoc?.approvalStatus === 'Kuiri' ||
        hasKuiriApp
    );

    if (isKuiriUser) return false;

    return Boolean(
      currentUserDoc?.membershipStatus === 'Aktif' ||
        currentUserDoc?.membershipStatus === 'Active' ||
        currentUserDoc?.membershipStatus === 'Diluluskan' ||
        currentUserDoc?.membershipStatus === 'Diluluskan Keahlian' ||
        currentUserDoc?.approvalStatus === 'Approved' ||
        currentUserDoc?.approvalStatus === 'Diluluskan' ||
        currentUserDoc?.approvalStatus === 'Diluluskan Keahlian' ||
        !!currentUserDoc?.memberNo ||
        (currentUserDoc?.role && !['Pelawat', 'Tetamu', 'Tiada', 'Penduduk'].includes(currentUserDoc.role)) ||
        currentUserDoc?.isSuperAdmin === true ||
        (allUsers || []).some(
          (u) =>
            (u.uid === firebaseUser?.uid ||
              (u.email && userEmail && u.email.toLowerCase().trim() === userEmail)) &&
            (u.membershipStatus === 'Aktif' || !!u.memberNo || u.approvalStatus === 'Approved') &&
            u.membershipStatus !== 'Kuiri' &&
            u.approvalStatus !== 'Kuiri'
        ) ||
        (effectiveApplications || []).some(
          (app) =>
            (app.uid === currentUserDoc?.uid ||
              app.uid === firebaseUser?.uid ||
              app.id === `app-${firebaseUser?.uid}` ||
              app.id === firebaseUser?.uid ||
              (app.email && userEmail && app.email.toLowerCase().trim() === userEmail)) &&
            (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian' || app.status === 'Approved') &&
            app.status !== 'Kuiri'
        )
    );
  }, [firebaseUser, currentUserDoc, allUsers, effectiveApplications]);

  // Perubahan maklumat & status lot hanya dibenarkan untuk role Admin Utama dan Setiausaha sahaja
  const canEditLot = Boolean(
    currentUserDoc && (
      currentUserDoc.role === 'Admin Utama' ||
      currentUserDoc.role === 'ADMIN UTAMA' ||
      currentUserDoc.role === 'Setiausaha' ||
      currentUserDoc.isSuperAdmin === true ||
      currentUserDoc.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my' ||
      currentUserDoc.email === 'smaujn9@gmail.com' ||
      currentUserDoc.email === 'firdaushadi442@gmail.com'
    )
  );

  // Listen directly to membershipApplications so approved members see 100% synced lot counts
  useEffect(() => {
    if (!db || !isApprovedMember) return;
    const unsub = onSnapshot(
      collection(db, 'membershipApplications'),
      (snap) => {
        const list: MembershipApplication[] = [];
        const seenEmails = new Set<string>();
        const seenUids = new Set<string>();
        snap.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() } as MembershipApplication;
          if (!data.name && !data.uid && !data.email) return;
          const emailLower = (data.email || '').toLowerCase().trim();
          if (emailLower) {
            if (seenEmails.has(emailLower)) return;
            seenEmails.add(emailLower);
          }
          if (data.uid) {
            if (seenUids.has(data.uid)) return;
            seenUids.add(data.uid);
          }
          list.push(data);
        });
        setPublicApps(list);
      },
      () => {
        // Fallback to allApplications from context if needed
      }
    );
    return () => unsub();
  }, [isApprovedMember]);

  // Build live lot map (Lots 121-232 only; Rumah 001 Admin Utama is explicitly excluded from the map)
  const { liveLotsRecord, stats } = useMemo(() => {
    const record: Record<
      string,
      {
        status: 'APPROVED' | 'QUERY' | 'VACANT' | 'UNREGISTERED';
        isTenant: boolean;
        name?: string;
        memberNo?: string;
        role?: string;
        notes?: string;
      }
    > = {};

    // Initialize 112 physical lots (121 - 232)
    for (let lot = 121; lot <= 232; lot++) {
      let status: 'APPROVED' | 'QUERY' | 'VACANT' | 'UNREGISTERED' = 'UNREGISTERED';
      if (VACANT_LOTS.has(lot)) {
        status = 'VACANT';
      } else if (BASELINE_APPROVED_LOTS.has(lot)) {
        status = 'APPROVED';
      } else if (lot === 218) {
        status = 'QUERY';
      }
      record[String(lot)] = {
        status,
        isTenant: BASELINE_TENANT_LOTS.has(lot)
      };
    }

    // Overlay real-time data from Kelulusan Ahli (membershipApplications & users)
    effectiveApplications.forEach((app) => {
      const applicantUser = allUsers.find((u) => u.uid === app.uid);
      const rawHouse = String(app.noRumah || applicantUser?.noRumah || '').trim();
      if (!rawHouse || rawHouse === '001' || rawHouse === '1') {
        // Rumah 001 (Admin Utama) dikecualikan daripada peta fizikal
        return;
      }

      const lotNum = parseInt(rawHouse.replace(/\D/g, ''), 10);
      if (isNaN(lotNum) || lotNum < 121 || lotNum > 232) {
        return;
      }

      const key = String(lotNum);
      const existing = record[key];
      const statusVal = (app.status || '').trim();
      const statusLower = statusVal.toLowerCase();
      const kediamanVal = (applicantUser?.statusKediaman || app.statusKediaman || '').toLowerCase();
      const isPenyewa = kediamanVal.includes('penyewa');

      let mappedStatus = existing.status;
      if (statusVal === 'Diluluskan' || statusVal === 'Diluluskan Keahlian') {
        mappedStatus = 'APPROVED';
      } else if (
        statusLower.includes('kuiri') ||
        statusVal === 'Perlu Kemaskini' ||
        statusVal === 'Pending' ||
        statusVal === 'Dalam Proses Semakan'
      ) {
        mappedStatus = 'QUERY';
      }

      record[key] = {
        status: mappedStatus,
        // Keep red dot marker aligned with the 8 tenant houses (approved tenants + Lot 144)
        isTenant: mappedStatus === 'QUERY' ? existing.isTenant : isPenyewa || existing.isTenant,
        name: app.name || applicantUser?.displayName || '',
        memberNo: app.memberNo || applicantUser?.memberNo || '',
        role: applicantUser?.role || 'Ahli Biasa',
        notes:
          mappedStatus === 'QUERY'
            ? `Kuiri: ${app.remarks || 'Dalam semakan dokumen keahlian.'}`
            : ''
      };
    });

    let approvedCount = 0;
    let vacantCount = 0;
    let tenantCount = 0;
    let queryCount = 0;

    Object.values(record).forEach((item) => {
      if (item.status === 'APPROVED') approvedCount++;
      if (item.status === 'VACANT') vacantCount++;
      if (item.status === 'QUERY') queryCount++;
      if (item.isTenant) tenantCount++;
    });

    return {
      liveLotsRecord: record,
      stats: {
        approved: approvedCount,
        vacant: vacantCount,
        tenant: tenantCount,
        query: queryCount
      }
    };
  }, [effectiveApplications, allUsers]);

  // Persist permissions & lot records to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tmf2_is_approved_member', isApprovedMember ? '1' : '0');
      localStorage.setItem('tmf2_map_can_edit', canEditLot ? '1' : '0');
      localStorage.setItem('tmf2_live_map_lots', JSON.stringify(liveLotsRecord));
    } catch (e) {}
  }, [liveLotsRecord, canEditLot, isApprovedMember]);

  // Fungsi redirect terus ke halaman Peta 3D Taman Musytari Fasa 2
  const handleOpenMap = () => {
    try {
      localStorage.setItem('tmf2_is_approved_member', isApprovedMember ? '1' : '0');
      localStorage.setItem('tmf2_map_can_edit', canEditLot ? '1' : '0');
      localStorage.setItem('tmf2_live_map_lots', JSON.stringify(liveLotsRecord));
    } catch (e) {}

    // Redirect terus ke halaman Peta 3D
    window.location.href = `/peta-3d?canEdit=${canEditLot ? '1' : '0'}`;
  };

  // Hanya Ahli yang Diluluskan sahaja boleh melihat section ini (Tetamu / Pelawat tidak dibenarkan)
  if (!isApprovedMember) {
    return null;
  }

  return (
    <div className={`bg-white ${isMobile ? 'p-4.5' : 'p-5'} rounded-2xl border border-gray-100 shadow-xs space-y-3.5`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Map size={15} />
          </div>
          <div>
            <h3 className={`${isMobile ? 'text-xs font-black text-slate-950' : 'text-sm font-extrabold text-slate-900'} tracking-tight leading-tight`}>
              Pelan Lokasi & Demografi Komuniti SMAUJ
            </h3>
            <p className="text-[10px] text-gray-400 font-semibold">
              Pelan Interaktif 3D & Pemetaan Komuniti Sekolah
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Preview Card (Redirect to 3D Map Page) */}
      <div
        onClick={handleOpenMap}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenMap(); }}
        className="relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-3.5 border border-slate-800 cursor-pointer group transition-all hover:shadow-md"
      >
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-500/15 blur-xl pointer-events-none group-hover:bg-emerald-500/25 transition-all" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                KAWASAN KOMUNITI SEKOLAH MENENGAH AGAMA ULU JEMPOL
              </span>
            </div>
            <p className="text-xs font-bold text-white leading-snug">
              Terokai kedudukan dan taburan komuniti secara 3D
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/30 transition-all">
            <Compass size={20} />
          </div>
        </div>

        {/* Quick Lot Status Indicators */}
        <div className="relative z-10 grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-white/10 text-center">
          <div
            className="bg-white/5 rounded-lg py-1 px-1.5 border border-white/5"
            title="Diselaraskan dengan Pendaftaran Ahli"
          >
            <div className="flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-black text-white leading-none">{stats.approved}</span>
            </div>
            <span className="text-[8px] text-slate-300 font-semibold block mt-0.5 truncate">Diluluskan</span>
          </div>
          <div className="bg-white/5 rounded-lg py-1 px-1.5 border border-white/5">
            <div className="flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-[11px] font-black text-white leading-none">{stats.vacant}</span>
            </div>
            <span className="text-[8px] text-slate-300 font-semibold block mt-0.5 truncate">Tersedia</span>
          </div>
          <div className="bg-white/5 rounded-lg py-1 px-1.5 border border-white/5">
            <div className="flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-white" />
              <span className="text-[11px] font-black text-white leading-none">{stats.tenant}</span>
            </div>
            <span className="text-[8px] text-slate-300 font-semibold block mt-0.5 truncate">Penjaga</span>
          </div>
          <div className="bg-white/5 rounded-lg py-1 px-1.5 border border-white/5">
            <div className="flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[11px] font-black text-white leading-none">{stats.query}</span>
            </div>
            <span className="text-[8px] text-slate-300 font-semibold block mt-0.5 truncate">Kuiri</span>
          </div>
        </div>
      </div>

      {/* Action Button to Redirect to Full 3D Map Page */}
      <button
        type="button"
        onClick={handleOpenMap}
        className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-extrabold text-xs rounded-xl shadow-sm shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Layers size={14} className="stroke-[2.5]" />
        <span>Buka Pelan 3D Komuniti SMAUJ</span>
        <ArrowUpRight size={14} className="stroke-[2.5]" />
      </button>
    </div>
  );
}
