import React, { useState } from 'react';

interface AssociationLogoProps {
  className?: string;
  size?: number;
  customSrc?: string;
}

export function AssociationLogo({ className = '', size = 40, customSrc }: AssociationLogoProps) {
  const [imgError, setImgError] = useState(false);

  // If a custom image source is passed and hasn't failed, render it
  if (customSrc && !imgError) {
    return (
      <img
        src={customSrc}
        alt="Lencana SMAUJ"
        width={size}
        height={size}
        onError={() => setImgError(true)}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover bg-white border border-emerald-100 shadow-sm ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Official Digital Emblem for Sekolah Menengah Agama Ulu Jempol (SMAUJ)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rounded-full shadow-sm shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <defs>
        <radialGradient id="smaujGold" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </radialGradient>
        <linearGradient id="smaujGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#065f46" />
          <stop offset="50%" stopColor="#047857" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="smaujInner" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#022c22" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
      </defs>

      {/* Outer gold ring */}
      <circle cx="60" cy="60" r="58" fill="url(#smaujGold)" />
      
      {/* Outer emerald border */}
      <circle cx="60" cy="60" r="53" fill="url(#smaujGreen)" stroke="#fef08a" strokeWidth="1.5" />

      {/* Decorative bead dots around perimeter */}
      <circle cx="60" cy="11" r="1.5" fill="#fef08a" />
      <circle cx="78" cy="14" r="1.5" fill="#fef08a" />
      <circle cx="95" cy="24" r="1.5" fill="#fef08a" />
      <circle cx="106" cy="40" r="1.5" fill="#fef08a" />
      <circle cx="109" cy="60" r="1.5" fill="#fef08a" />
      <circle cx="106" cy="80" r="1.5" fill="#fef08a" />
      <circle cx="95" cy="96" r="1.5" fill="#fef08a" />
      <circle cx="78" cy="106" r="1.5" fill="#fef08a" />
      <circle cx="60" cy="109" r="1.5" fill="#fef08a" />
      <circle cx="42" cy="106" r="1.5" fill="#fef08a" />
      <circle cx="25" cy="96" r="1.5" fill="#fef08a" />
      <circle cx="14" cy="80" r="1.5" fill="#fef08a" />
      <circle cx="11" cy="60" r="1.5" fill="#fef08a" />
      <circle cx="14" cy="40" r="1.5" fill="#fef08a" />
      <circle cx="25" cy="24" r="1.5" fill="#fef08a" />
      <circle cx="42" cy="14" r="1.5" fill="#fef08a" />

      {/* Inner shield dark field */}
      <circle cx="60" cy="60" r="44" fill="url(#smaujInner)" stroke="#fef08a" strokeWidth="1" />

      {/* Crescent and Star (Bulan Bintang Syiar Islam) */}
      <path
        d="M60 22 C53 22 47 27 47 34 C47 41 53 46 60 46 C57 44 55 40 55 34 C55 28 57 24 60 22 Z"
        fill="#fde047"
      />
      <polygon
        points="64,27 65.5,31 69.5,31 66.5,33.5 67.5,37.5 64,35 60.5,37.5 61.5,33.5 58.5,31 62.5,31"
        fill="#fde047"
      />

      {/* Open Rehal & Quran (Kitab Suci / Ilmu Agama) */}
      {/* Rehal base stand */}
      <path d="M48 64 L72 64 L66 69 L54 69 Z" fill="#ca8a04" />
      <path d="M52 69 L68 69 L64 74 L56 74 Z" fill="#996515" />
      {/* Open book pages */}
      <path
        d="M60 52 C55 50 46 51 40 53 C39.5 57 40 63 41 64 C47 62 55 61 60 63 Z"
        fill="#ffffff"
        stroke="#ca8a04"
        strokeWidth="0.8"
      />
      <path
        d="M60 52 C65 50 74 51 80 53 C80.5 57 80 63 79 64 C73 62 65 61 60 63 Z"
        fill="#f8fafc"
        stroke="#ca8a04"
        strokeWidth="0.8"
      />
      {/* Quran lines */}
      <line x1="44" y1="56" x2="56" y2="54" stroke="#047857" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="44" y1="59" x2="56" y2="57.5" stroke="#047857" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="64" y1="54" x2="76" y2="56" stroke="#047857" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="64" y1="57.5" x2="76" y2="59" stroke="#047857" strokeWidth="0.8" strokeLinecap="round" />

      {/* Torch of Knowledge flame */}
      <path
        d="M60 41 C58 44 56.5 47 58 50 C59 48 61 48 62 50 C63.5 47 62 44 60 41 Z"
        fill="#ea580c"
      />
      <path
        d="M60 43 C59 45 58 47 59 49 C59.5 48 60.5 48 61 49 C62 47 61 45 60 43 Z"
        fill="#facc15"
      />

      {/* Laurel leaves wreath (Kecemerlangan) */}
      <path
        d="M32 60 C32 72 40 82 52 86 C48 83 45 78 44 73 C41 71 36 67 36 62 Z"
        fill="#fde047"
        opacity="0.85"
      />
      <path
        d="M88 60 C88 72 80 82 68 86 C72 83 75 78 76 73 C79 71 84 67 84 62 Z"
        fill="#fde047"
        opacity="0.85"
      />

      {/* Ribbon banner at bottom for SMAUJ */}
      <path
        d="M26 89 L36 86 L60 88 L84 86 L94 89 L90 97 L60 99 L30 97 Z"
        fill="url(#smaujGold)"
        stroke="#78350f"
        strokeWidth="0.6"
      />
      <text
        x="60"
        y="95"
        textAnchor="middle"
        fill="#1e293b"
        fontSize="7.5"
        fontWeight="900"
        fontFamily="sans-serif"
        letterSpacing="0.8"
      >
        SMAUJ
      </text>

      {/* Top text arc outline */}
      <text
        x="60"
        y="107"
        textAnchor="middle"
        fill="#fef08a"
        fontSize="5"
        fontWeight="bold"
        fontFamily="sans-serif"
        letterSpacing="0.5"
      >
        ULU JEMPOL
      </text>
    </svg>
  );
}

export default AssociationLogo;
