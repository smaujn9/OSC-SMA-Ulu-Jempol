import React, { useState, useEffect } from 'react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { 
  Bell, Send, Calendar, Settings, ShieldAlert, CheckCircle2, 
  AlertCircle, Clock, Trash2, Smartphone, RefreshCw, Sparkles, 
  Users, UserCheck, Megaphone, FileText, Check, X, Link as LinkIcon,
  MessageSquare, Mail, Key, Server, Lock, UserPlus, ShieldCheck
} from 'lucide-react';
import { 
  sendTargetedPushNotification, 
  schedulePushNotification, 
  fetchScheduledNotifications, 
  cancelScheduledNotification, 
  fetchNotificationSettings, 
  saveNotificationSettings,
  registerServiceWorkerAndSubscribe,
  triggerYuranReminderNow,
  fetchEmailConfig,
  saveEmailConfig,
  sendTestEmail
} from '../utils/notificationHelper';

interface AdminPushNotificationSectionProps {
  currentUserDoc: any;
  triggerSnackbar: (msg: string, type: 'success' | 'error') => void;
}

export default function AdminPushNotificationSection({
  currentUserDoc,
  triggerSnackbar
}: AdminPushNotificationSectionProps) {
  const [activeTab, setActiveTab] = useState<'segera' | 'jadual' | 'tetapan' | 'emel'>('segera');

  // Direct Push Form State
  const [directTitle, setDirectTitle] = useState('');
  const [directBody, setDirectBody] = useState('');
  const [directAudience, setDirectAudience] = useState<'all' | 'ajk' | 'members' | 'leadership'>('all');
  const [directUrl, setDirectUrl] = useState('/pengumuman');
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; successful: number; failed: number } | null>(null);

  // Scheduled Push Form State
  const [schedTitle, setSchedTitle] = useState('');
  const [schedBody, setSchedBody] = useState('');
  const [schedAudience, setSchedAudience] = useState<'all' | 'ajk' | 'members'>('all');
  const [schedDateTime, setSchedDateTime] = useState(() => {
    const future = new Date(Date.now() + 3600000); // 1 hour ahead
    return future.toISOString().slice(0, 16);
  });
  const [schedUrl, setSchedUrl] = useState('/pengumuman');
  const [isScheduling, setIsScheduling] = useState(false);

  // Scheduled List State
  const [scheduledItems, setScheduledItems] = useState<any[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);

  // Auto Settings State
  const [settings, setSettings] = useState({
    notifyMemberApproval: true,
    notifyNewAnnouncement: true,
    notifySafetyCases: true,
    notifyTakwimEvents: true,
    notifyReports: true,
    notifyDailyEvents: true,
    notifyYuran26th: true,
    notifyChatPost: true,
    notifyNewMemberRegistration: true
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTriggeringYuran26, setIsTriggeringYuran26] = useState(false);
  const [yuran26Result, setYuran26Result] = useState<any>(null);

  // Email Config State
  const [emailConfig, setEmailConfig] = useState({
    enabled: true,
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    fromName: 'Sekolah Menengah Agama Ulu Jempol (SMAUJ)',
    fromEmail: 'smaujn9@gmail.com',
    replyTo: 'smaujn9@gmail.com',
    autoSendOnApproval: true
  });
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Test Notification State
  const [isTestingDevice, setIsTestingDevice] = useState(false);

  // Load Data
  const loadScheduledList = async () => {
    setIsLoadingScheduled(true);
    try {
      const items = await fetchScheduledNotifications();
      setScheduledItems(items);
    } catch (err) {
      console.error('Ralat muat jadual:', err);
    } finally {
      setIsLoadingScheduled(false);
    }
  };

  const loadSettingsData = async () => {
    try {
      const st = await fetchNotificationSettings();
      setSettings(prev => ({ ...prev, ...st }));
      const em = await fetchEmailConfig();
      setEmailConfig(prev => ({ ...prev, ...em }));
      if (em.fromEmail) {
        setTestEmailAddress(em.fromEmail);
      }
    } catch (err) {
      console.error('Ralat muat tetapan:', err);
    }
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailConfig(true);
    try {
      await saveEmailConfig(emailConfig);
      triggerSnackbar('Konfigurasi emel SMTP berjaya disimpan!', 'success');
    } catch (err: any) {
      triggerSnackbar(err.message || 'Gagal menyimpan konfigurasi emel.', 'error');
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  const handleTestEmailSend = async () => {
    if (!testEmailAddress || !testEmailAddress.trim()) {
      triggerSnackbar('Sila masukkan alamat emel penerima ujian.', 'error');
      return;
    }
    setIsSendingTestEmail(true);
    try {
      const res = await sendTestEmail(testEmailAddress.trim());
      if (res.success) {
        triggerSnackbar(`Emel ujian berjaya dihantar ke ${testEmailAddress}!`, 'success');
      } else {
        triggerSnackbar(res.error || 'Gagal menghantar emel ujian.', 'error');
      }
    } catch (err: any) {
      triggerSnackbar(err.message || 'Ralat penghantaran emel ujian.', 'error');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  useEffect(() => {
    loadScheduledList();
    loadSettingsData();
  }, []);

  // Quick Template Handlers
  const applyTemplate = (title: string, body: string, url: string, target: 'all' | 'ajk' | 'members') => {
    setDirectTitle(title);
    setDirectBody(body);
    setDirectUrl(url);
    setDirectAudience(target);
    triggerSnackbar('Templat mesej berjaya dimasukkan!', 'success');
  };

  // Handle Direct Send
  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTitle.trim() || !directBody.trim()) {
      triggerSnackbar('Sila lengkapkan tajuk dan kandungan mesej.', 'error');
      return;
    }

    setIsSendingDirect(true);
    setSendResult(null);

    try {
      const result = await sendTargetedPushNotification({
        title: directTitle.trim(),
        body: directBody.trim(),
        targetAudience: directAudience,
        url: directUrl.trim() || '/pengumuman'
      });

      if (result.success) {
        setSendResult({
          sent: result.sent || 0,
          successful: result.successful || 0,
          failed: result.failed || 0
        });
        triggerSnackbar(`Notifikasi berjaya dihantar ke ${result.successful || 0} peranti!`, 'success');
        setDirectTitle('');
        setDirectBody('');
      } else {
        triggerSnackbar(result.error || 'Gagal menghantar notifikasi.', 'error');
      }
    } catch (err: any) {
      triggerSnackbar(err.message || 'Gagal menghantar notifikasi.', 'error');
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Handle Create Schedule
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim() || !schedBody.trim() || !schedDateTime) {
      triggerSnackbar('Sila lengkapkan tajuk, mesej, dan masa jadual.', 'error');
      return;
    }

    setIsScheduling(true);
    try {
      const isoDate = new Date(schedDateTime).toISOString();
      await schedulePushNotification({
        title: schedTitle.trim(),
        body: schedBody.trim(),
        targetAudience: schedAudience,
        scheduledAt: isoDate,
        url: schedUrl.trim() || '/pengumuman'
      });

      triggerSnackbar('Mesej push notification berjaya dijadualkan!', 'success');
      setSchedTitle('');
      setSchedBody('');
      loadScheduledList();
    } catch (err: any) {
      triggerSnackbar(err.message || 'Gagal menjadualkan notifikasi.', 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  // Handle Delete Schedule
  const handleDeleteSchedule = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteSchedule = async () => {
    if (!deleteTargetId) return;
    setIsDeletingSchedule(true);
    try {
      await cancelScheduledNotification(deleteTargetId);
      triggerSnackbar('Jadual notifikasi dipadam.', 'success');
      loadScheduledList();
      setDeleteTargetId(null);
    } catch (err: any) {
      triggerSnackbar('Gagal memadam jadual.', 'error');
    } finally {
      setIsDeletingSchedule(false);
    }
  };

  // Handle Save Settings
  const handleToggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await saveNotificationSettings(settings);
      triggerSnackbar('Tetapan trigger notifikasi otomatik berjaya disimpan!', 'success');
    } catch (err: any) {
      triggerSnackbar('Gagal menyimpan tetapan.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTriggerYuran26Now = async () => {
    setIsTriggeringYuran26(true);
    setYuran26Result(null);
    try {
      const res = await triggerYuranReminderNow();
      if (res.success) {
        setYuran26Result(res);
        triggerSnackbar(`Semakan Selesai! ${res.usersNotifiedCount} ahli telah dihantar peringatan yuran sasaran.`, 'success');
      } else {
        triggerSnackbar(res.error || res.reason || 'Gagal menjalankan semakan yuran.', 'error');
      }
    } catch (err: any) {
      triggerSnackbar(err.message || 'Ralat semasa menjalankan semakan yuran.', 'error');
    } finally {
      setIsTriggeringYuran26(false);
    }
  };

  // Handle Device Test
  const handleTestDevice = async () => {
    setIsTestingDevice(true);
    try {
      const subRes = await registerServiceWorkerAndSubscribe();
      if (!subRes?.subscription) {
        triggerSnackbar('Gagal melanggan notifikasi pada peranti ini. Pastikan anda membenarkan notifikasi di browser.', 'error');
        return;
      }

      const res = await sendTargetedPushNotification({
        title: '🔔 Ujian Push Notification PTMF2',
        body: 'Sistem Server FCM / Web Push berfungsi dengan cemerlang pada peranti ini!',
        targetAudience: 'all',
        url: '/admin'
      });

      if (res.success) {
        triggerSnackbar(`Ujian berjaya! Dihantar ke ${res.successful || 1} peranti.`, 'success');
      } else {
        triggerSnackbar(res.error || 'Ujian gagal.', 'error');
      }
    } catch (err: any) {
      triggerSnackbar(err.message || 'Ralat ujian peranti.', 'error');
    } finally {
      setIsTestingDevice(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Device Status Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Bell size={22} className="animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ⚡ FCM Server Active
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Background Cron Enabled
              </span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Pusat Kawalan Push Notification</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              Urus penghantaran mesej push, penjadualan notifikasi automatik, dan tetapan pemicu kes atau kelulusan ahli secara berpusat.
            </p>
          </div>
        </div>

        <button
          onClick={handleTestDevice}
          disabled={isTestingDevice}
          className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 self-start md:self-center"
        >
          {isTestingDevice ? (
            <RefreshCw size={15} className="animate-spin text-emerald-400" />
          ) : (
            <Smartphone size={15} className="text-emerald-400" />
          )}
          Uji Notifikasi Peranti Ini
        </button>
      </div>

      {/* Main Navigation Sub-Tabs */}
      <div className="bg-slate-100/80 p-1 rounded-xl flex flex-wrap gap-1 border border-slate-200/60">
        <button
          onClick={() => setActiveTab('segera')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition ${
            activeTab === 'segera'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          <Send size={14} />
          Hantar Mesej Segera
        </button>

        <button
          onClick={() => setActiveTab('jadual')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition ${
            activeTab === 'jadual'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          <Clock size={14} />
          Mesej Dijadualkan ({scheduledItems.length})
        </button>

        <button
          onClick={() => setActiveTab('tetapan')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition ${
            activeTab === 'tetapan'
              ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          <Settings size={14} />
          Tetapan Notifikasi Auto
        </button>

        <button
          onClick={() => setActiveTab('emel')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition ${
            activeTab === 'emel'
              ? 'bg-white text-indigo-800 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          <Mail size={14} className={activeTab === 'emel' ? 'text-indigo-600' : ''} />
          Konfigurasi Emel (SMTP)
        </button>
      </div>

      {/* TAB 1: HANTAR MESEJ SEGERA */}
      {activeTab === 'segera' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Megaphone size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Borang Hantar Notifikasi Broadcast</h3>
                <p className="text-[11px] text-slate-500">Penghantaran serta-merta ke skrin telefon & desktop pengguna.</p>
              </div>
            </div>

            <form onSubmit={handleSendDirect} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Sasaran Penerima <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirectAudience('all')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-extrabold transition ${
                      directAudience === 'all'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Users size={15} />
                    Semua Ahli & Pelawat
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirectAudience('leadership')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-extrabold transition ${
                      directAudience === 'leadership'
                        ? 'border-purple-500 bg-purple-50 text-purple-800 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Admin, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha & Bendahari"
                  >
                    <ShieldCheck size={15} />
                    Pimpinan & Pentadbir
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirectAudience('ajk')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-extrabold transition ${
                      directAudience === 'ajk'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck size={15} />
                    Barisan AJK Sahaja
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirectAudience('members')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-extrabold transition ${
                      directAudience === 'members'
                        ? 'border-teal-500 bg-teal-50 text-teal-800 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Users size={15} />
                    Ahli Biasa Sahaja
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  Tajuk Notifikasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  placeholder="Contoh: Mesyuarat Agung Tahunan PTMF2"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  Mesej / Kandungan Notifikasi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={directBody}
                  onChange={(e) => setDirectBody(e.target.value)}
                  rows={3}
                  placeholder="Sila tulis mesej notifikasi yang jelas dan padat..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  Pautan / URL Sasaran (Optional)
                </label>
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={directUrl}
                    onChange={(e) => setDirectUrl(e.target.value)}
                    placeholder="/pengumuman"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Pengguna akan terus dibuka pautan ini apabila menekan notifikasi.
                </p>
              </div>

              {sendResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>
                      Notifikasi berjaya dihantar ke <strong>{sendResult.successful}</strong> peranti (Gagal/Tamat: {sendResult.failed}).
                    </span>
                  </div>
                  <button onClick={() => setSendResult(null)} className="text-emerald-700 hover:underline font-bold text-[11px]">
                    Tutup
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingDirect}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSendingDirect ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Menghantar Notifikasi FCM...
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Hantar Notifikasi Sekarang
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Side Templat Chips */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3 h-fit">
            <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs uppercase tracking-wider">
              <Sparkles size={15} />
              Templat Draf Pantas
            </div>
            <p className="text-xs text-slate-500">
              Klik salah satu templat di bawah untuk mengisi borang dengan pantas.
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => applyTemplate(
                  '📢 Peringatan Mesyuarat KRT PTMF2',
                  'Peringatan mesyuarat jawatankuasa akan berlangsung malam ini jam 8:30 malam di Balai Raya PTMF2. Kehadiran AJK adalah diwajibkan.',
                  '/pengumuman',
                  'ajk'
                )}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/60 hover:border-emerald-200 text-left transition group"
              >
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">Peringatan Mesyuarat AJK</div>
                <div className="text-[11px] text-slate-500 truncate">Untuk Barisan AJK</div>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate(
                  '🧹 Program Gotong-Royong Perdana',
                  'Jemputan kepada semua penduduk PTMF2 untuk bersama-sama dalam Program Gotong-Royong Kebersihan pada Sabtu ini jam 7.30 pagi.',
                  '/takwim',
                  'all'
                )}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/60 hover:border-emerald-200 text-left transition group"
              >
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">Gotong-Royong Perdana</div>
                <div className="text-[11px] text-slate-500 truncate">Untuk Semua Ahli</div>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate(
                  '💳 Peringatan Pembayaran Yuran Tahunan',
                  'Peringatan mesra: Sila jelaskan yuran keahlian tahunan persatuan anda melalui menu Pembayaran Yuran.',
                  '/yuran',
                  'members'
                )}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/60 hover:border-emerald-200 text-left transition group"
              >
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">Peringatan Yuran Tahunan</div>
                <div className="text-[11px] text-slate-500 truncate">Untuk Ahli Biasa</div>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate(
                  '🚨 Amaran Keselamatan Taman',
                  'Makluman keselamatan: Sila pastikan pintu pagar utama kediaman dan kenderaan anda dikunci dengan selamat.',
                  '/laporan-kes',
                  'all'
                )}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/60 hover:border-emerald-200 text-left transition group"
              >
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">Amaran Keselamatan</div>
                <div className="text-[11px] text-slate-500 truncate">Peringatan Amaran</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MESEJ DIJADUALKAN */}
      {activeTab === 'jadual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Create Schedule Form */}
          <div className="lg:col-span-1 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock size={18} />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Jadualkan Notifikasi Baharu</h3>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-3 text-xs">
              <div>
                <label className="block font-extrabold text-slate-600 mb-1">
                  Tarikh & Masa Penghantaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={schedDateTime}
                  onChange={(e) => setSchedDateTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-extrabold text-slate-600 mb-1">Sasaran Penerima</label>
                <select
                  value={schedAudience}
                  onChange={(e) => setSchedAudience(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="all">Semua Ahli & Pelawat</option>
                  <option value="ajk">Barisan AJK Sahaja</option>
                  <option value="members">Ahli Biasa Sahaja</option>
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-slate-600 mb-1">Tajuk Mesej</label>
                <input
                  type="text"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="Tajuk Notifikasi..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-extrabold text-slate-600 mb-1">Mesej / Kandungan</label>
                <textarea
                  value={schedBody}
                  onChange={(e) => setSchedBody(e.target.value)}
                  rows={3}
                  placeholder="Kandungan notifikasi..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-extrabold text-slate-600 mb-1">Pautan URL</label>
                <input
                  type="text"
                  value={schedUrl}
                  onChange={(e) => setSchedUrl(e.target.value)}
                  placeholder="/pengumuman"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isScheduling}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2"
              >
                {isScheduling ? <RefreshCw size={14} className="animate-spin" /> : <Calendar size={14} />}
                Simpan & Jadualkan
              </button>
            </form>
          </div>

          {/* List of Scheduled Items */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">Senarai Mesej Dalam Jadual Cron</h3>
              <button
                onClick={loadScheduledList}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                title="Muat Semula"
              >
                <RefreshCw size={15} className={isLoadingScheduled ? 'animate-spin' : ''} />
              </button>
            </div>

            {scheduledItems.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <Clock size={32} className="mx-auto text-slate-300" />
                <p>Tiada mesej terjadual buat masa ini.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {scheduledItems.map((item) => {
                  const isSent = item.status === 'sent';
                  const isPending = item.status === 'pending';

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isSent
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {isSent ? 'Dihantar' : isPending ? 'Menunggu' : 'Gagal'}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            📅 {new Date(item.scheduledAt).toLocaleString('ms-MY')}
                          </span>
                          <span className="text-[10px] uppercase font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-md">
                            {item.targetAudience}
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900">{item.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2">{item.body}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => handleDeleteSchedule(item.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Padam Jadual"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TETAPAN NOTIFIKASI AUTO */}
      {activeTab === 'tetapan' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Konfigurasi Pemicu Notifikasi Otomatik (Auto-Triggers)</h3>
              <p className="text-xs text-slate-500">
                Pilih senario yang akan menghantar push notification secara automatik tanpa perlu tindakan manual admin.
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isSavingSettings ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Simpan Tetapan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 0. Pendaftaran Ahli Baharu (Admin, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, Bendahari) */}
            <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/40 flex items-start justify-between gap-3 hover:border-purple-300 hover:bg-purple-50/70 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <UserPlus size={16} className="text-purple-600" />
                  <span className="font-extrabold text-xs text-slate-900">Pendaftaran Ahli Baharu</span>
                  <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 text-[9px] font-bold rounded">Pimpinan</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Hantar notifikasi push automatik kepada Admin, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sebaik sahaja borang pendaftaran ahli dihantar.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyNewMemberRegistration}
                onChange={() => handleToggleSetting('notifyNewMemberRegistration')}
                className="w-4 h-4 accent-purple-600 cursor-pointer mt-1"
              />
            </div>

            {/* 1. Kelulusan Ahli */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <UserCheck size={16} className="text-emerald-600" />
                  <span className="font-extrabold text-xs text-slate-900">Kelulusan Permohonan Ahli</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hantar notifikasi automatik terus ke peranti pemohon apabila permohonan keahlian mereka DILULUSKAN.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyMemberApproval}
                onChange={() => handleToggleSetting('notifyMemberApproval')}
                className="w-4 h-4 accent-emerald-600 cursor-pointer mt-1"
              />
            </div>

            {/* 2. Pengumuman Baru */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Megaphone size={16} className="text-emerald-600" />
                  <span className="font-extrabold text-xs text-slate-900">Pengumuman Rasmi Baharu</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hantar notifikasi automatik kepada semua penduduk apabila pengumuman baharu diterbitkan.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyNewAnnouncement}
                onChange={() => handleToggleSetting('notifyNewAnnouncement')}
                className="w-4 h-4 accent-emerald-600 cursor-pointer mt-1"
              />
            </div>

            {/* 3. Aduan & Kes Keselamatan */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-600" />
                  <span className="font-extrabold text-xs text-slate-900">Aduan & Kes Keselamatan Baharu</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hantar notifikasi amaran serta-merta kepada Barisan AJK apabila terdapat kes atau aduan baharu dilaporkan.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifySafetyCases}
                onChange={() => handleToggleSetting('notifySafetyCases')}
                className="w-4 h-4 accent-emerald-600 cursor-pointer mt-1"
              />
            </div>

            {/* 4. Takwim & Program Baru */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-600" />
                  <span className="font-extrabold text-xs text-slate-900">Aktiviti Takwim Baharu</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hantar notifikasi automatik kepada ahli apabila terdapat acara atau program baharu ditambah dalam Takwim.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyTakwimEvents}
                onChange={() => handleToggleSetting('notifyTakwimEvents')}
                className="w-4 h-4 accent-emerald-600 cursor-pointer mt-1"
              />
            </div>

            {/* 5. Laporan / Minit / Kertas Kerja */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-amber-600" />
                  <span className="font-extrabold text-xs text-slate-900">Dokumen / Laporan / Kertas Kerja Dijana</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Maklumkan kepada AJK apabila minit mesyuarat, laporan program, atau kertas kerja baharu dimuat naik.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyReports}
                onChange={() => handleToggleSetting('notifyReports')}
                className="w-4 h-4 accent-emerald-600 cursor-pointer mt-1"
              />
            </div>

            {/* 6. Peringatan Program Hari Semasa */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-purple-600" />
                  <span className="font-extrabold text-xs text-slate-900">Peringatan Event Hari Semasa (Cron)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Server akan secara automatik menyemak Takwim setiap pagi dan menghantar peringatan push jika terdapat program pada hari tersebut.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyDailyEvents}
                onChange={() => handleToggleSetting('notifyDailyEvents')}
                className="w-4 h-4 accent-emerald-600 cursor-pointer mt-1"
              />
            </div>

            {/* 7. Mesej Baharu Chat Komuniti */}
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-600" />
                  <span className="font-extrabold text-xs text-slate-900">Mesej Baharu Chat Komuniti</span>
                  <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded">
                    Sembang
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hantar notifikasi push automatik kepada penduduk/ahli setiap kali ada pengguna yang membuat hantaran baharu di Chat Komuniti.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyChatPost !== false}
                onChange={() => handleToggleSetting('notifyChatPost')}
                className="w-4 h-4 accent-indigo-600 cursor-pointer mt-1 shrink-0"
              />
            </div>

            {/* 8. Peringatan Automatik Yuran Bulanan 26hb */}
            <div className="p-3.5 rounded-xl border border-teal-200/80 bg-teal-50/40 flex items-start justify-between gap-3 hover:border-teal-300 transition md:col-span-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-teal-700" />
                  <span className="font-extrabold text-xs text-slate-900">Peringatan Automatik Yuran Bulanan (Setiap 26 Haribulan)</span>
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-black rounded-md uppercase tracking-wider border border-teal-200">
                    Sistem 26hb
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Setiap 26 haribulan, server akan secara automatik menyemak rekod bayaran setiap ahli yang telah diluluskan. Jika ahli belum melunaskan Yuran Bulan Semasa dan Tunggakan Bulan Sebelumnya (beserta baki yuran lain), notifikasi push khusus akan dihantar terus kepada ahli berkenaan sahaja. Ahli yang telah lunas tidak akan menerima sebarang notifikasi.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyYuran26th}
                onChange={() => handleToggleSetting('notifyYuran26th')}
                className="w-4 h-4 accent-teal-600 cursor-pointer mt-1 shrink-0"
              />
            </div>
          </div>

          {/* MANUAL TRIGGER BUTTON FOR 26HB YURAN REMINDER */}
          <div className="mt-4 p-4 rounded-xl border border-indigo-150 bg-indigo-50/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600" />
                  Semakan & Ujian Manual Peringatan Yuran 26hb
                </h4>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Jalankan imbasan segera untuk menyemak ahli dengan tunggakan yuran bulan semasa/sebelumnya dan hantar notifikasi sasaran secara langsung tanpa menunggu 26hb.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerYuran26Now}
                disabled={isTriggeringYuran26}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
              >
                {isTriggeringYuran26 ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {isTriggeringYuran26 ? 'Sedang Menyemak & Menghantar...' : 'Jana & Hantar Peringatan Yuran Sekarang'}
              </button>
            </div>

            {yuran26Result && (
              <div className="p-3 bg-white rounded-lg border border-indigo-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>Keputusan Semakan Yuran ({yuran26Result.currentMonthStr}):</span>
                  <span className="text-emerald-700">✓ Selesai</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                  <div className="p-2 bg-slate-50 rounded-md border border-slate-100">
                    <span className="block text-slate-400 font-sans text-[10px]">Jumlah Ahli</span>
                    <strong className="text-slate-800 text-sm">{yuran26Result.totalApprovedUsers}</strong>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-md border border-emerald-100">
                    <span className="block text-emerald-600 font-sans text-[10px]">Lunas (Tiada Notif)</span>
                    <strong className="text-emerald-800 text-sm">{yuran26Result.usersFullyPaidCount}</strong>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-md border border-amber-100">
                    <span className="block text-amber-700 font-sans text-[10px]">Notifikasi Dihantar</span>
                    <strong className="text-amber-900 text-sm">{yuran26Result.usersNotifiedCount}</strong>
                  </div>
                </div>

                {yuran26Result.notifiedDetails && yuran26Result.notifiedDetails.length > 0 && (
                  <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-100 max-h-40 overflow-y-auto pr-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Senarai Ahli Yang Dihantar Notifikasi:</p>
                    {yuran26Result.notifiedDetails.map((det: any, idx: number) => (
                      <div key={idx} className="p-1.5 bg-slate-50 rounded border border-slate-100 flex flex-col text-[11px] gap-0.5">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{det.name} ({det.noRumah})</span>
                          <span className="text-rose-600 text-[10px]">
                            {!det.currentMonthPaid && !det.prevMonthPaid ? 'Tunggakan Semasa & Terdahulu' : !det.currentMonthPaid ? 'Tunggakan Semasa' : !det.prevMonthPaid ? 'Tunggakan Terdahulu' : 'Baki Yuran Lain'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 italic">"{det.messageText}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: KONFIGURASI EMEL & SMTP */}
      {activeTab === 'emel' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main SMTP Config Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Mail size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Tetapan Pelayan Emel (SMTP)</h3>
                <p className="text-[11px] text-slate-500">Konfigurasikan pelayan emel untuk penghantaran surat kelulusan keahlian automatik.</p>
              </div>
            </div>

            <form onSubmit={handleSaveEmailConfig} className="space-y-4">
              {/* Feature Toggle */}
              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-indigo-600" />
                    Hantar Emel Rasmi Automatik Semasa Kelulusan
                  </span>
                  <p className="text-[11px] text-indigo-700/80">
                    Setiap pemohon yang diluluskan akan menerima emel rasmi berserta Nombor Ahli PTMF2 dan pautan portal.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={emailConfig.autoSendOnApproval !== false}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, autoSendOnApproval: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Service Preset Picker */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  Penyedia Perkhidmatan Emel (Provider)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'gmail', label: 'Gmail (App Password)', host: 'smtp.gmail.com', port: 465, secure: true },
                    { id: 'custom', label: 'Custom SMTP / cPanel', host: 'mail.yourdomain.com', port: 465, secure: true },
                    { id: 'brevo', label: 'Brevo (Sendinblue)', host: 'smtp-relay.brevo.com', port: 587, secure: false }
                  ].map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setEmailConfig(prev => ({
                        ...prev,
                        service: srv.id,
                        host: srv.host,
                        port: srv.port,
                        secure: srv.secure
                      }))}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        emailConfig.service === srv.id
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{srv.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SMTP Host */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={emailConfig.host || ''}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* SMTP Port */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Port & Keselamatan
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={emailConfig.port || 465}
                      onChange={(e) => setEmailConfig(prev => ({ ...prev, port: parseInt(e.target.value, 10) || 465 }))}
                      placeholder="465 / 587"
                      className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailConfig.secure !== false}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, secure: e.target.checked }))}
                        className="rounded text-indigo-600"
                      />
                      <span>SSL/TLS (Secure)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SMTP Username */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Emel Pengguna / SMTP User
                  </label>
                  <input
                    type="email"
                    value={emailConfig.user || ''}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, user: e.target.value }))}
                    placeholder="smaujn9@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* SMTP Password */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Kata Laluan Aplikasi (App Password)
                  </label>
                  <input
                    type="password"
                    value={emailConfig.pass || ''}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, pass: e.target.value }))}
                    placeholder="cth: abcd efgh ijkl mnop"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Untuk Gmail: Guna 16-digit App Password dari akaun Google.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sender Name */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Nama Penghantar (Sender Name)
                  </label>
                  <input
                    type="text"
                    value={emailConfig.fromName || ''}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, fromName: e.target.value }))}
                    placeholder="Sekolah Menengah Agama Ulu Jempol (SMAUJ)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Sender Email */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Alamat Emel Penghantar (From Email)
                  </label>
                  <input
                    type="email"
                    value={emailConfig.fromEmail || ''}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                    placeholder="smaujn9@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingEmailConfig}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEmailConfig ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{isSavingEmailConfig ? 'Menyimpan...' : 'Simpan Konfigurasi Emel'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel: Test Email & Preview */}
          <div className="space-y-4">
            {/* Test Email Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Send size={15} className="text-indigo-600" />
                <h4 className="font-extrabold text-slate-900 text-xs">Uji Penghantaran Emel</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Hantar satu emel ujian untuk memastikan sambungan SMTP ke pelayan berfungsi.
              </p>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Alamat Emel Ujian
                </label>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="emel-anda@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleTestEmailSend}
                disabled={isSendingTestEmail}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSendingTestEmail ? <RefreshCw size={13} className="animate-spin text-emerald-400" /> : <Send size={13} />}
                <span>{isSendingTestEmail ? 'Menghantar Emel Ujian...' : 'Hantar Emel Ujian'}</span>
              </button>
            </div>

            {/* Template Info Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2 text-xs">
              <span className="font-extrabold text-slate-800 text-[11px] block uppercase tracking-wider">
                📄 Format Emel Kelulusan PTMF2:
              </span>
              <ul className="space-y-1.5 text-slate-600 text-[11px] list-disc list-inside">
                <li>Tajuk rasmi berserta Nombor Ahli PTMF2 yang dijana.</li>
                <li>Jadual butiran peribadi, nombor rumah & tarikh lulus.</li>
                <li>Panduan muat turun Sijil & Kad Keahlian Digital.</li>
                <li>Pautan terus ke Portal Penduduk PTMF2.</li>
                <li>Maklumat hubungan rasmi Setiausaha Persatuan.</li>
              </ul>
            </div>

            {/* Quick Gmail Setup Guide Card */}
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-indigo-950 text-[11px] block uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={13} className="text-indigo-600" />
                  Panduan Dapatkan App Password Gmail:
                </span>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition"
                >
                  Buka Google App Passwords ↗
                </a>
              </div>
              <ol className="space-y-1.5 text-slate-700 text-[11px] list-decimal list-inside font-medium leading-relaxed">
                <li>Buka pautan di atas atau pergi ke <strong>myaccount.google.com/apppasswords</strong>.</li>
                <li>Pastikan <strong>2-Step Verification (2FA)</strong> akaun Google anda telah diaktifkan.</li>
                <li>Taipkan nama aplikasi contohnya: <code>Portal PTMF2</code> dan klik <strong>Create</strong>.</li>
                <li>Salin <strong>16-digit kod rahsia</strong> (contoh: <code>abcd efgh ijkl mnop</code>).</li>
                <li>Masukkan kod 16-digit tersebut ke ruangan <strong>Kata Laluan Aplikasi</strong> di sebelah dan klik <strong>Simpan Konfigurasi Emel</strong>.</li>
              </ol>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[10px] leading-relaxed">
                ⚠️ <em>Nota Penting:</em> Google tidak membenarkan kata laluan login Gmail biasa untuk SMTP. Wajib gunakan 16-digit App Password ini.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        itemName={scheduledItems.find(item => item.id === deleteTargetId)?.title || "jadual notifikasi ini"}
        isLoading={isDeletingSchedule}
        onConfirm={confirmDeleteSchedule}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
