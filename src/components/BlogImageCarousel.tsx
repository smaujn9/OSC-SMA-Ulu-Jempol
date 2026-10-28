import React, { useState, useEffect, useMemo } from 'react';
import { BlogItem } from '../types';
import { Images, ChevronLeft, ChevronRight, Play, Pause, Maximize2, X, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const FALLBACK_PROGRAM_REPORTS = [
  {
    id: 'prg-1',
    title: 'Candat Sotong Bachok Kelantan 2026',
    startDate: '2026-07-09',
    label: 'Aktiviti',
    description: 'Program Candat Sotong Bachok Kelantan 2026 ini merupakan inisiatif komuniti Taman Musytari Fasa 2 bagi mengeratkan silaturahim.',
    images: [
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1489659639091-8b687bc4386e?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=800'
    ]
  },
  {
    id: 'prg-2',
    title: 'Mesyuarat Penaja Penubuhan Persatuan Penduduk Taman Musytari',
    startDate: '2026-06-19',
    label: 'Mesyuarat',
    description: 'Mesyuarat Penaja Penubuhan Persatuan Penduduk Taman Musytari telah diadakan dengan jayanya bagi membincangkan langkah awal penubuhan persatuan rasmi.',
    images: [
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=800'
    ]
  },
  {
    id: 'prg-3',
    title: 'Program Jamuan Hari Raya Aidilfitri 2026',
    startDate: '2026-04-04',
    label: 'Jamuan',
    description: 'Program Jamuan Hari Raya Aidilfitri 2026 merupakan acara tahunan yang dianjurkan khas untuk semua penduduk Taman Musytari Fasa 2.',
    images: [
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800'
    ]
  },
  {
    id: 'prg-4',
    title: 'Gotong-Royong Mencari Buluh Lemang Sempena Hari Raya Aidilfitri 2026',
    startDate: '2026-04-02',
    label: 'Aktiviti',
    description: 'Program Gotong-Royong Mencari Buluh Lemang Sempena Hari Raya Aidilfitri 2026 telah berjaya dianjurkan oleh Persatuan Penduduk.',
    images: [
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1489659639091-8b687bc4386e?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=800'
    ]
  }
];

// Global image cache set to track preloaded image URLs across renders
const globalImageCache = new Set<string>();

const preloadImages = (urls: string[]) => {
  urls.forEach((url) => {
    if (url && typeof url === 'string' && !globalImageCache.has(url)) {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        globalImageCache.add(url);
      };
      img.onerror = () => {
        globalImageCache.add(url); // prevent repeated retry loops
      };
      img.src = url;
    }
  });
};

interface ProgramImageItem {
  id: string;
  imageUrl: string;
  title: string;
  date: string;
  label: string;
  imageIndexNumber: number;
  reportObj?: any;
}

interface BlogImageCarouselProps {
  programReports?: any[];
  blogs?: BlogItem[];
  onSelectBlog?: (blog: BlogItem) => void;
  onNavigateToBlog?: () => void;
  onNavigateToLaporan?: () => void;
  className?: string;
  isMobile?: boolean;
}

export const BlogImageCarousel: React.FC<BlogImageCarouselProps> = ({
  programReports = [],
  blogs = [],
  onSelectBlog,
  onNavigateToBlog,
  onNavigateToLaporan,
  className = '',
  isMobile = false
}) => {
  // Extract images from all program reports (each report contains 4 images)
  const programImageItems = useMemo<ProgramImageItem[]>(() => {
    const list = (programReports && programReports.length > 0) 
      ? programReports 
      : FALLBACK_PROGRAM_REPORTS;

    const items: ProgramImageItem[] = [];

    list.forEach((rpt: any, rptIdx: number) => {
      const rptTitle = rpt.title || rpt.namaProgram || `Program ${rptIdx + 1}`;
      const rptDate = rpt.startDate || rpt.date || rpt.tarikhMula || '2026';
      const rptLabel = rpt.label || rpt.category || 'Aktiviti';
      
      // Determine array of 4 images for this report
      let imgs: string[] = [];
      if (Array.isArray(rpt.images) && rpt.images.length > 0) {
        imgs = rpt.images.filter((img: string) => typeof img === 'string' && img.trim() !== '');
      } else if (rpt.image && typeof rpt.image === 'string' && rpt.image.trim() !== '') {
        imgs = [rpt.image];
      }

      // If less than 4 images, fill in from preset defaults
      const fallbackPreset = FALLBACK_PROGRAM_REPORTS[rptIdx % FALLBACK_PROGRAM_REPORTS.length].images;
      for (let i = 0; i < 4; i++) {
        const imgUrl = imgs[i] || fallbackPreset[i % fallbackPreset.length];
        if (imgUrl) {
          items.push({
            id: `${rpt.id || 'rpt-' + rptIdx}-img-${i}`,
            imageUrl: imgUrl,
            title: rptTitle,
            date: rptDate,
            label: rptLabel,
            imageIndexNumber: i + 1,
            reportObj: rpt
          });
        }
      }
    });

    return items.length > 0 ? items : FALLBACK_PROGRAM_REPORTS.flatMap((rpt, rptIdx) => 
      rpt.images.map((imgUrl, i) => ({
        id: `${rpt.id}-img-${i}`,
        imageUrl: imgUrl,
        title: rpt.title,
        date: rpt.startDate,
        label: rpt.label,
        imageIndexNumber: i + 1,
        reportObj: rpt
      }))
    );
  }, [programReports]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Lightbox Fullscreen Modal State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxAutoplay, setIsLightboxAutoplay] = useState(true);

  // Lightbox Autoplay Cycle (Auto tukar gambar setiap 5 saat)
  useEffect(() => {
    if (!isLightboxOpen || !isLightboxAutoplay || programImageItems.length <= 1) return;

    const interval = setInterval(() => {
      setLightboxIndex((prev) => (prev + 1) % programImageItems.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isLightboxOpen, isLightboxAutoplay, programImageItems.length]);

  // Keyboard navigation for Lightbox (←, →, Space untuk Jeda/Main, Esc untuk Tutup)
  useEffect(() => {
    if (!isLightboxOpen || programImageItems.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % programImageItems.length);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + programImageItems.length) % programImageItems.length);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsLightboxAutoplay((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, programImageItems.length]);

  // Preload all program report images in the background into browser cache for smooth transitions
  useEffect(() => {
    if (programImageItems.length > 0) {
      const urls = programImageItems.map((item) => item.imageUrl).filter(Boolean);
      preloadImages(urls);
    }
  }, [programImageItems]);

  // Keep currentIndex bounded if items count changes in background without interrupting current playback
  useEffect(() => {
    if (currentIndex >= programImageItems.length && programImageItems.length > 0) {
      setCurrentIndex(0);
    }
  }, [programImageItems.length, currentIndex]);

  // Client-side pure JavaScript random selection every 10 seconds (10000ms) - NO AI tokens used
  useEffect(() => {
    if (!isPlaying || programImageItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (programImageItems.length <= 1) return 0;
        // Pick a random next index distinct from current using JS Math.random()
        let nextIdx: number;
        do {
          nextIdx = Math.floor(Math.random() * programImageItems.length);
        } while (nextIdx === prev && programImageItems.length > 1);
        
        return nextIdx;
      });
    }, 10000); // 10 seconds interval as requested

    return () => clearInterval(interval);
  }, [isPlaying, programImageItems.length]);

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (programImageItems.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % programImageItems.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (programImageItems.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + programImageItems.length) % programImageItems.length);
  };

  const handleDotClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  const currentItem = programImageItems[currentIndex] || programImageItems[0];

  if (!currentItem) return null;

  const handleCardClick = (e: React.MouseEvent) => {
    handleNext(e);
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden ${isMobile ? 'p-3.5' : 'p-4.5'} space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <Images size={15} />
          </div>
          <div>
            <h3 className={`${isMobile ? 'text-xs' : 'text-sm'} font-black text-slate-950 tracking-tight leading-none`}>
              Galeri Gambar Program & Laporan
            </h3>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
              4 Gambar / Laporan • Auto 10s (Rawak)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping inline-block" />
            10 sec
          </span>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
            title={isPlaying ? "Jeda Kurasel" : "Mainkan Kurasel"}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
        </div>
      </div>

      {/* Carousel Main Container */}
      <div 
        className="relative group w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-900 border border-slate-100 shadow-3xs cursor-pointer select-none"
        onClick={handleCardClick}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentItem.id + '-' + currentIndex}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full"
          >
            <img
              src={currentItem.imageUrl}
              alt={currentItem.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback image if broken
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800";
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />

        {/* Top Info Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-center z-10 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-indigo-600/90 backdrop-blur-md text-[8px] font-black text-white uppercase tracking-wider shadow-xs">
              {currentItem.label}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-md text-[8px] font-black text-white uppercase tracking-wider shadow-xs border border-white/20">
            {currentIndex + 1} / {programImageItems.length}
          </span>
        </div>

        {/* Navigation Arrows */}
        {programImageItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer border border-white/20"
              title="Gambar Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer border border-white/20"
              title="Gambar Seterusnya"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Bottom Title Banner */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 text-white flex items-end justify-between gap-2 pointer-events-none">
          <div className="space-y-0.5 min-w-0 flex-1">
            <h4 className="font-extrabold text-[11px] sm:text-xs text-white leading-snug line-clamp-1 drop-shadow-sm">
              <span>{currentItem.title}</span>
            </h4>
            <p className="text-[9px] text-slate-300 font-medium line-clamp-1 leading-tight opacity-90 flex items-center gap-1.5">
              <span>📅 {currentItem.date}</span>
              <span>•</span>
              <span className="text-indigo-200 font-semibold">Klik untuk gambar seterusnya</span>
            </p>
          </div>

          {/* Butang Expand di Bawah Kanan */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(currentIndex);
              setIsLightboxOpen(true);
              setIsLightboxAutoplay(true);
            }}
            className="pointer-events-auto shrink-0 p-1.5 sm:p-2 rounded-xl bg-black/60 hover:bg-indigo-600 text-white backdrop-blur-md shadow-lg border border-white/20 transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center gap-1"
            title="Buka Paparan Penuh Skrin (Expand)"
            aria-label="Expand Galeri Gambar"
          >
            <Maximize2 size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Progress bar line for 10 second timer */}
        {isPlaying && (
          <motion.div 
            key={`progress-${currentIndex}`}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 10, ease: "linear" }}
            className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 z-20"
          />
        )}
      </div>

      {/* Pagination Dots */}
      {programImageItems.length > 1 && (
        <div className="flex items-center justify-center gap-1 pt-0.5 flex-wrap max-w-full overflow-hidden">
          {programImageItems.slice(0, 16).map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              onClick={(e) => handleDotClick(idx, e)}
              className={`transition-all cursor-pointer ${
                idx === currentIndex
                  ? 'w-5 h-1.5 bg-indigo-600 rounded-full'
                  : 'w-1.5 h-1.5 bg-slate-200 hover:bg-slate-300 rounded-full'
              }`}
              title={`Gambar ${idx + 1}: ${item.title}`}
            />
          ))}
          {programImageItems.length > 16 && (
            <span className="text-[8px] text-slate-400 font-bold ml-1">+{programImageItems.length - 16}</span>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* POPUP LIGHTBOX BESAR DENGAN AUTOPLAY, NEXT & PREVIOUS   */}
      {/* ======================================================== */}
      {isLightboxOpen && programImageItems.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between px-3 pt-3 pb-24 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-6 sm:pb-6 select-none animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Header Lightbox */}
          <div
            className="flex items-center justify-between text-white w-full max-w-5xl mx-auto z-10 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2.5 py-1 rounded-full bg-indigo-600/90 text-white text-[11px] font-black tracking-wide shadow-md shrink-0">
                {lightboxIndex + 1} / {programImageItems.length}
              </span>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                  {programImageItems[lightboxIndex]?.title || currentItem.title}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-300">
                  <span>📅 {programImageItems[lightboxIndex]?.date || currentItem.date}</span>
                  <span>•</span>
                  <span className="text-indigo-300 font-semibold">{programImageItems[lightboxIndex]?.label || currentItem.label}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Butang Jeda/Main Autoplay */}
              <button
                type="button"
                onClick={() => setIsLightboxAutoplay(!isLightboxAutoplay)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                  isLightboxAutoplay
                    ? 'bg-emerald-600/80 hover:bg-emerald-600 text-white border-emerald-400/40 shadow-emerald-950/20 shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/20'
                }`}
                title={isLightboxAutoplay ? "Jeda Main Automatik" : "Main Automatik (5s)"}
              >
                {isLightboxAutoplay ? (
                  <>
                    <Pause size={13} />
                    <span className="hidden sm:inline text-[11px]">Auto (5s)</span>
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    <span className="hidden sm:inline text-[11px]">Mainkan</span>
                  </>
                )}
              </button>

              {/* Buka Imej Asal */}
              <a
                href={programImageItems[lightboxIndex]?.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center justify-center text-xs"
                title="Buka fail imej asal"
              >
                <ArrowUpRight size={16} />
              </a>

              {/* Tutup Lightbox */}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-full bg-white/15 hover:bg-red-500/80 text-white transition-colors cursor-pointer flex items-center justify-center"
                title="Tutup (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Bahagian Tengah: Gambar Besar + Butang Previous & Next */}
          <div
            className="relative flex-1 flex items-center justify-center my-2 max-w-5xl w-full mx-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Butang Previous */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((prev) => (prev - 1 + programImageItems.length) % programImageItems.length)
              }
              aria-label="Gambar Sebelum (Previous)"
              title="Gambar Sebelum (Anak Panah Kiri)"
              className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-xl border border-white/20 backdrop-blur-md transition-all active:scale-90 hover:scale-105 cursor-pointer"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>

            {/* Gambar Besar dengan Animasi */}
            <div className="relative max-h-[58vh] sm:max-h-[72vh] max-w-full flex items-center justify-center p-1 sm:p-2">
              <AnimatePresence mode="wait">
                <motion.img
                  key={lightboxIndex}
                  src={programImageItems[lightboxIndex]?.imageUrl}
                  alt={programImageItems[lightboxIndex]?.title}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.35 }}
                  className="max-h-[55vh] sm:max-h-[70vh] max-w-full w-auto h-auto object-contain rounded-xl sm:rounded-2xl shadow-2xl ring-1 ring-white/10"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
            </div>

            {/* Butang Next */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((prev) => (prev + 1) % programImageItems.length)
              }
              aria-label="Gambar Seterusnya (Next)"
              title="Gambar Seterusnya (Anak Panah Kanan)"
              className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-xl border border-white/20 backdrop-blur-md transition-all active:scale-90 hover:scale-105 cursor-pointer"
            >
              <ChevronRight size={22} strokeWidth={2.5} />
            </button>
          </div>

          {/* Footer Lightbox: Jalur Thumbnail & Petunjuk */}
          <div
            className="w-full max-w-2xl mx-auto z-10 space-y-2 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bar autoplay (5 saat) */}
            {isLightboxAutoplay && (
              <div className="w-full max-w-md mx-auto h-1 bg-white/10 rounded-full overflow-hidden mb-1">
                <motion.div
                  key={`lightbox-prog-${lightboxIndex}`}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, ease: "linear" }}
                  className="h-full bg-emerald-400"
                />
              </div>
            )}

            {/* Jalur Thumbnail Boleh Skrol */}
            <div className="flex items-center justify-start sm:justify-center gap-2 p-1.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 w-fit mx-auto max-w-full overflow-x-auto shadow-lg">
              {programImageItems.slice(0, 16).map((item, idx) => {
                const isActive = idx === lightboxIndex;
                return (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`shrink-0 relative w-11 h-9 sm:w-13 sm:h-10 rounded-lg overflow-hidden transition-all cursor-pointer ${
                      isActive
                        ? 'ring-2 ring-indigo-400 scale-105 shadow-md shadow-indigo-500/30'
                        : 'opacity-50 hover:opacity-90'
                    }`}
                    title={`Pilih Gambar ${idx + 1}: ${item.title}`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={`thumb-${idx}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/70 text-white font-extrabold px-1 rounded">
                      {idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Auto-mainkan gambar aktif • Tekan <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-white">←</kbd> / <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-white">→</kbd> atau <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-white">Space</kbd> untuk Jeda/Main • Tekan <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-white">Esc</kbd> untuk tutup
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogImageCarousel;

