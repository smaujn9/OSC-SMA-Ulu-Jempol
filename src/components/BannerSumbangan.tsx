import React from 'react';
import { Heart, ChevronRight, Sparkles, Gift } from 'lucide-react';

interface BannerSumbanganProps {
  onClick: () => void;
  isMobile?: boolean;
}

export default function BannerSumbangan({ onClick, isMobile = false }: BannerSumbanganProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative bg-gradient-to-br from-purple-700 via-violet-700 to-indigo-800 rounded-2xl ${
        isMobile ? 'p-4' : 'p-5'
      } overflow-hidden shadow-lg shadow-purple-950/20 cursor-pointer group border border-purple-400/30 transition-all hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-xl hover:border-purple-300/60 select-none`}
    >
      {/* Background Icon Watermark */}
      <div className={`absolute top-0 right-0 ${isMobile ? 'p-3' : 'p-4'} opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none`}>
        <Heart size={isMobile ? 65 : 85} className="text-white transform rotate-12 fill-white/20" />
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className={`space-y-1.5 text-white ${isMobile ? 'pr-8' : 'pr-10'}`}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="px-2 py-0.5 bg-white/20 text-purple-100 font-black text-[9px] uppercase tracking-wider rounded-md backdrop-blur-xs flex items-center gap-1 border border-white/25 shadow-xs">
              <Sparkles size={10} className="text-amber-300" />
              <span>Infaq & Kebajikan</span>
            </span>
            <span className="px-2 py-0.5 bg-purple-950/40 text-purple-200 font-bold text-[9px] rounded-md border border-purple-400/30">
              Dibuka 24 Jam
            </span>
          </div>

          <h3 className={`font-extrabold ${isMobile ? 'text-sm' : 'text-lg'} flex items-center gap-1.5 text-white`}>
            <span>Tabung Pembangunan & Kebajikan Murid SMAUJ</span>
            <ChevronRight size={isMobile ? 15 : 18} className="group-hover:translate-x-1 transition-transform text-purple-200 shrink-0" />
          </h3>

          <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium text-purple-100/90 leading-relaxed max-w-xl`}>
            Salurkan sumbangan ikhlas & infaq kebajikan anda demi manfaat prasarana pembelajaran, surau, dan kebajikan murid Sekolah Menengah Agama Ulu Jempol.
          </p>
        </div>
      </div>
    </div>
  );
}
