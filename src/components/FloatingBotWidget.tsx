import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, RotateCcw, Copy, Check, Bot, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  text: string;
  timestamp: string;
  provider?: string;
  modelUsed?: string;
}

interface QuickQuestion {
  short: string;
  full: string;
}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  text: 'Salam sejahtera! Saya Pembantu AI Perlembagaan Persatuan Taman Musytari Fasa 2 (PPM-001-05-28092026). Sila kemukakan soalan berkaitan fasal-fasal perlembagaan pertubuhan ini.',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    short: 'Syarat Ahli Biasa',
    full: 'Apakah syarat-syarat untuk menjadi Ahli Biasa pertubuhan mengikut perlembagaan?'
  },
  {
    short: 'Kadar Yuran Ahli',
    full: 'Berapakah bayaran yuran masuk dan yuran bulanan bagi setiap ahli?'
  },
  {
    short: 'Had Tunai Bendahari',
    full: 'Berapakah had wang tunai dalam tangan yang boleh disimpan oleh Bendahari pada satu-satu masa?'
  },
  {
    short: 'Kuorum Mesyuarat',
    full: 'Berapakah jumlah kuorum yang diperlukan untuk Mesyuarat Agung Tahunan atau Khas?'
  },
  {
    short: 'Sebab Pemecatan',
    full: 'Apakah syarat, fasal atau sebab-sebab pemecatan atau pemberhentian ahli?'
  },
  {
    short: 'Makna Logo Persatuan',
    full: 'Apakah keterangan dan maksud lambang atau lencana persatuan?'
  }
];

// SVG Maskot Robot Putih Glossy Mengikut Imej Rujukan
function RobotAvatarSvg({
  pupilOffset,
  isBlinking,
  className = "w-full h-full"
}: {
  pupilOffset: { x: number; y: number };
  isBlinking: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 235"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Glow Cyan untuk Mata & Mulut */}
        <filter id="robotCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#22d3ee" floodOpacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#06b6d4" floodOpacity="0.6" />
        </filter>

        {/* Head Shell Gradient: Putih Glossy Pearlescent */}
        <linearGradient id="robotHeadGrad" x1="100" y1="18" x2="100" y2="114" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#f8fafc" />
          <stop offset="75%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Visor Screen Gradient: Kaca Gelap Lengkung */}
        <linearGradient id="robotVisorGrad" x1="100" y1="36" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="45%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#090d16" />
        </linearGradient>

        {/* Ear Pods Gradient */}
        <linearGradient id="robotEarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="50%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Torso Body Gradient */}
        <linearGradient id="robotBodyGrad" x1="100" y1="114" x2="100" y2="204" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#f1f5f9" />
          <stop offset="70%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Floating Arms Gradient */}
        <linearGradient id="robotArmGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Soft Drop Shadow for Outer Elements */}
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* 1. Floating Shadow Terbawah */}
      <ellipse
        cx="100"
        cy="226"
        rx="36"
        ry="6"
        fill="#94a3b8"
        fillOpacity="0.32"
        className="transition-all duration-300"
      />

      {/* 2. Floating Arms (Tangan Terapung di kiri & kanan) */}
      <g filter="url(#softShadow)">
        {/* Tangan Kiri */}
        <g transform="translate(38, 142) rotate(-16)">
          <rect x="-14" y="-30" width="28" height="64" rx="14" fill="url(#robotArmGrad)" />
          {/* Shading Highlight */}
          <path d="M -8 -24 Q 0 -28 6 -24" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        </g>
        {/* Tangan Kanan */}
        <g transform="translate(162, 142) rotate(16)">
          <rect x="-14" y="-30" width="28" height="64" rx="14" fill="url(#robotArmGrad)" />
          {/* Shading Highlight */}
          <path d="M -6 -24 Q 0 -28 8 -24" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        </g>
      </g>

      {/* 3. Badan Terapung (Torso Pod) */}
      <g filter="url(#softShadow)">
        {/* Sambungan Leher / Collar */}
        <path d="M 82 110 Q 100 114 118 110 L 122 120 Q 100 126 78 120 Z" fill="#94a3b8" />

        {/* Bentuk Badan Putih Bulat */}
        <path
          d="M 66 120 C 66 116, 134 116, 134 120 C 146 142, 142 192, 100 200 C 58 192, 54 142, 66 120 Z"
          fill="url(#robotBodyGrad)"
        />

        {/* Garisan Alur Badan (Seam Panel) */}
        <path
          d="M 68 152 L 86 156 L 87 166 L 113 166 L 114 156 L 132 152"
          stroke="#94a3b8"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.75"
        />

        {/* Kilauan Putih Dada Kiri (Glossy Reflection) */}
        <ellipse cx="78" cy="132" rx="9" ry="16" fill="#ffffff" opacity="0.65" transform="rotate(-18 78 132)" />
      </g>

      {/* 4. Kepala Robot (Head Frame) */}
      <g filter="url(#softShadow)">
        {/* Ear Pod Kiri */}
        <rect x="34" y="52" width="18" height="38" rx="9" fill="url(#robotEarGrad)" stroke="#cbd5e1" strokeWidth="1" />
        {/* Ear Pod Kanan */}
        <rect x="148" y="52" width="18" height="38" rx="9" fill="url(#robotEarGrad)" stroke="#cbd5e1" strokeWidth="1" />

        {/* Mahkota / Rabung Atas Kepala */}
        <rect x="80" y="16" width="40" height="8" rx="4" fill="#cbd5e1" />

        {/* Kubah Kepala Putih Utama (Helmet) */}
        <rect
          x="44"
          y="22"
          width="112"
          height="88"
          rx="40"
          fill="url(#robotHeadGrad)"
          stroke="#e2e8f0"
          strokeWidth="1.5"
        />

        {/* Pantulan Kilau Lengkung di Atas Kepala */}
        <path
          d="M 64 34 Q 100 24 136 34"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Bingkai Luar Visor Gelap */}
        <rect
          x="54"
          y="34"
          width="92"
          height="64"
          rx="26"
          fill="#090d16"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Skrin Kaca Visor Gelap Sebenar */}
        <rect
          x="56"
          y="36"
          width="88"
          height="60"
          rx="24"
          fill="url(#robotVisorGrad)"
        />

        {/* Pantulan Lengkung Kaca Visor Atas */}
        <path
          d="M 66 44 Q 100 38 134 44"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.25"
        />
        <path
          d="M 68 49 Q 100 44 132 49"
          stroke="#38bdf8"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.18"
        />

        {/* 5. ELEMEN MUKA (MATA & SENYUMAN DENGAN EYE-TRACKING & BLINK) */}
        <g
          style={{
            transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
            transition: 'transform 0.08s ease-out'
          }}
        >
          {/* MATA KIRI (Bentuk Kapsul Bercahaya Cyan Seperti Gambar) */}
          <g
            style={{
              transformOrigin: '78px 65px',
              transform: isBlinking ? 'scaleY(0.08)' : 'scaleY(1)',
              transition: 'transform 0.1s ease'
            }}
          >
            <path
              d="M 70 65 C 70 57, 86 57, 86 65 C 86 70, 70 70, 70 65 Z"
              fill="#38bdf8"
              filter="url(#robotCyanGlow)"
            />
            {/* Specular Dot Kecil */}
            <circle cx="76" cy="62" r="2" fill="#ffffff" opacity="0.9" />
          </g>

          {/* MATA KANAN (Bentuk Kapsul Bercahaya Cyan) */}
          <g
            style={{
              transformOrigin: '122px 65px',
              transform: isBlinking ? 'scaleY(0.08)' : 'scaleY(1)',
              transition: 'transform 0.1s ease'
            }}
          >
            <path
              d="M 114 65 C 114 57, 130 57, 130 65 C 130 70, 114 70, 114 65 Z"
              fill="#38bdf8"
              filter="url(#robotCyanGlow)"
            />
            {/* Specular Dot Kecil */}
            <circle cx="120" cy="62" r="2" fill="#ffffff" opacity="0.9" />
          </g>

          {/* SENYUMAN COMEL BERCERIA (Cyan Glowing Crescent) */}
          <path
            d="M 93 75 Q 100 84 107 75 Q 100 78 93 75 Z"
            fill="#38bdf8"
            filter="url(#robotCyanGlow)"
          />
        </g>
      </g>
    </svg>
  );
}

export default function FloatingBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ptmf2_bot_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [DEFAULT_WELCOME_MESSAGE];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Responsive Mascot Size
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const mascotWidth = isMobile ? 56 : 68;
  const mascotHeight = isMobile ? 66 : 80;

  // Mascot Coordinates & Drag
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 20, y: 300 };
    try {
      const saved = localStorage.getItem('ptmf2_bot_position');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.min(Math.max(12, parsed.x), window.innerWidth - (isMobile ? 56 : 68) - 16),
            y: Math.min(Math.max(60, parsed.y), window.innerHeight - (isMobile ? 66 : 80) - 80)
          };
        }
      }
    } catch (_) {}
    const defaultX = Math.max(12, window.innerWidth - (isMobile ? 56 : 68) - 18);
    const defaultY = window.innerHeight - (isMobile ? 66 : 80) - (isMobile ? 96 : 36);
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isSnappedLeft, setIsSnappedLeft] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Eye-Tracking
  const [pupilOffset, setPupilOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);

  const mascotRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    mascotX: number;
    mascotY: number;
    hasMoved: boolean;
  }>({ pointerX: 0, pointerY: 0, mascotX: 0, mascotY: 0, hasMoved: false });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Resize Listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      const w = mobile ? 56 : 68;
      const h = mobile ? 66 : 80;
      setPosition(prev => {
        const snapLeft = (prev.x + w / 2) < window.innerWidth / 2;
        const margin = mobile ? 12 : 20;
        const newX = snapLeft ? margin : (window.innerWidth - w - margin);
        const newY = Math.min(Math.max(60, prev.y), window.innerHeight - h - (mobile ? 90 : 36));
        setIsSnappedLeft(snapLeft);
        return { x: newX, y: newY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save chat history
  useEffect(() => {
    try {
      localStorage.setItem('ptmf2_bot_chat_history', JSON.stringify(messages));
    } catch (_) {}
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  // Blinking Cycle
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 4000 + Math.random() * 2500);

    return () => clearInterval(blinkInterval);
  }, []);

  // Eye tracking listener for mouse & touch
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent | MouseEvent | TouchEvent) => {
      if (isDragging) return;

      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      } else {
        return;
      }

      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const mascotCenterX = rect.left + rect.width / 2;
      const mascotCenterY = rect.top + rect.height * 0.4; // Fokus pada bahagian mata kepala

      const dx = clientX - mascotCenterX;
      const dy = clientY - mascotCenterY;
      const dist = Math.hypot(dx, dy);

      if (dist === 0) {
        setPupilOffset({ x: 0, y: 0 });
        return;
      }

      const angle = Math.atan2(dy, dx);
      const maxTravel = isMobile ? 3.5 : 4.8; // px
      const travel = Math.min(dist / 24, maxTravel);

      setPupilOffset({
        x: Math.cos(angle) * travel,
        y: Math.sin(angle) * travel
      });
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
    window.addEventListener('touchmove', handleGlobalPointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('touchmove', handleGlobalPointerMove);
    };
  }, [isDragging, isMobile]);

  // Pointer Down (Drag Start)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      mascotX: position.x,
      mascotY: position.y,
      hasMoved: false
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move (Dragging)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    if (!dragStartRef.current.hasMoved && Math.hypot(deltaX, deltaY) > 6) {
      dragStartRef.current.hasMoved = true;
    }

    if (dragStartRef.current.hasMoved) {
      const newX = dragStartRef.current.mascotX + deltaX;
      const newY = Math.min(
        Math.max(20, dragStartRef.current.mascotY + deltaY),
        window.innerHeight - mascotHeight - 20
      );

      setPosition({ x: newX, y: newY });
    }
  };

  // Pointer Up (Auto-Snap)
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}

    // Tap/Click without drag
    if (!dragStartRef.current.hasMoved) {
      setIsOpen(prev => !prev);
      return;
    }

    // Auto-Snap to nearest edge
    const margin = isMobile ? 12 : 20;
    const mascotCenterX = position.x + mascotWidth / 2;
    const isNearLeft = mascotCenterX < window.innerWidth / 2;

    const finalX = isNearLeft ? margin : (window.innerWidth - mascotWidth - margin);
    const bottomNavBuffer = isMobile ? 88 : 36;
    const finalY = Math.min(
      Math.max(50, position.y),
      window.innerHeight - mascotHeight - bottomNavBuffer
    );

    setIsSnappedLeft(isNearLeft);
    const finalPos = { x: finalX, y: finalY };
    setPosition(finalPos);

    try {
      localStorage.setItem('ptmf2_bot_position', JSON.stringify(finalPos));
    } catch (_) {}
  };

  // Submit Question to API
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const historyContext = messages
        .filter(m => m.id !== 'welcome')
        .slice(-4)
        .map(m => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat/perlembagaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyContext
        })
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Ralat pelayan (${res.status})`);
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: data.reply || 'Maaf, maklumat tersebut tiada dalam rujukan saya.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: data.provider,
        modelUsed: data.modelUsed
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: err.message || 'Maaf, perkhidmatan bot menghadapi gangguan sambungan sementara. Sila cuba lagi.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setIsResetting(true);
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setInputText('');
    try {
      localStorage.removeItem('ptmf2_bot_chat_history');
    } catch (_) {}
    setTimeout(() => {
      setIsResetting(false);
    }, 600);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format bot response (markdown style bullets, bolding, and Fasal highlights selaras tema)
  const renderFormattedBotText = (text: string) => {
    const paragraphs = text.split('\n');
    return paragraphs.map((para, pIdx) => {
      if (!para.trim()) return <div key={pIdx} className="h-1.5" />;

      // Highlight "Fasal X" or "Fasal X(...)"
      const parts = para.split(/(\bFasal\s+\d+(?:\s*(?:—|-|\))\s*[^,\n.]+)?)/gi);

      return (
        <p key={pIdx} className="mb-2 last:mb-0 leading-relaxed text-slate-800 text-[13px] font-medium">
          {parts.map((part, idx) => {
            if (/^Fasal\s+\d+/i.test(part)) {
              return (
                <span
                  key={idx}
                  className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 inline-block my-0.5 shadow-3xs"
                >
                  {part}
                </span>
              );
            }

            // Bold styling support for **text**
            const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
            return boldParts.map((bPart, bIdx) => {
              if (bPart.startsWith('**') && bPart.endsWith('**')) {
                return (
                  <strong key={bIdx} className="font-extrabold text-slate-900">
                    {bPart.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={bIdx}>{bPart}</span>;
            });
          })}
        </p>
      );
    });
  };

  // Chat window anchor positioning
  const chatWindowStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: '80px',
        left: '10px',
        right: '10px',
        height: 'calc(100dvh - 120px)',
        maxHeight: '600px',
        zIndex: 9999
      }
    : {
        position: 'fixed',
        bottom: `${Math.max(24, Math.min(position.y - 480, window.innerHeight - 560))}px`,
        ...(isSnappedLeft
          ? { left: `${Math.min(position.x + mascotWidth + 16, window.innerWidth - 420)}px` }
          : { right: `${Math.max(16, window.innerWidth - position.x + 16)}px` }),
        width: '390px',
        height: '540px',
        maxHeight: '85vh',
        zIndex: 9999
      };

  if (isDismissed) {
    return (
      <button
        type="button"
        onClick={() => setIsDismissed(false)}
        title="Tampilkan semula Bot Perlembagaan PTMF2"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-3.5 sm:bottom-4 sm:right-4 z-40 p-2 sm:p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white/90 hover:text-white shadow-xl backdrop-blur-md border border-cyan-400/40 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 text-xs font-bold animate-in fade-in duration-200"
      >
        <Bot size={16} className="text-cyan-400" />
        <span className="hidden sm:inline text-[11px]">Buka Bot</span>
      </button>
    );
  }

  return (
    <>
      {/* ======================================================== */}
      {/* 1. MASKOT ROBOT PUTIH GLOSSY (FLOATING ROBOT)             */}
      {/* ======================================================== */}
      <div
        ref={mascotRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${mascotWidth}px`,
          height: `${mascotHeight}px`,
          zIndex: 9998,
          touchAction: 'none',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging
            ? 'none'
            : 'left 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.25), top 0.25s ease-out'
        }}
        className="group select-none"
        aria-label="Pembantu AI Perlembagaan PTMF2"
        role="button"
        tabIndex={0}
      >
        {/* Butang Pangkah / Tutup Robot Kecil Di Atas Kanan */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsDismissed(true);
            setIsOpen(false);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          title="Tutup / Buang Robot"
          className="absolute -top-1 -right-1 z-30 w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-900 active:bg-black text-white/90 hover:text-white flex items-center justify-center shadow-md border border-white/70 transition-all hover:scale-115 active:scale-90 cursor-pointer"
        >
          <X size={11} strokeWidth={2.8} />
        </button>

        {/* Mascot Container dengan Animasi Apungan (Hover/Bobbing) */}
        <div
          className={`relative w-full h-full flex items-center justify-center transition-transform ${
            isDragging ? 'scale-105' : 'hover:scale-105 active:scale-95'
          }`}
          style={{
            animation: isDragging ? 'none' : 'mascotFloat 3.8s ease-in-out infinite'
          }}
        >
          {/* Outer Pulsing Glow Aura Halus */}
          <div
            className={`absolute -inset-1.5 rounded-full bg-cyan-400/25 blur-md transition-opacity duration-300 pointer-events-none ${
              isOpen ? 'opacity-90 animate-pulse' : 'opacity-40 group-hover:opacity-80'
            }`}
          />

          {/* SVG Robot Sempurna Mengikut Imej */}
          <RobotAvatarSvg pupilOffset={pupilOffset} isBlinking={isBlinking} />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TETINGKAP CHAT (SELARAS DENGAN TEMA LAMAN WEB INI)     */}
      {/* ======================================================== */}
      {isOpen && (
        <div
          style={chatWindowStyle}
          className="flex flex-col rounded-3xl bg-white text-slate-800 border border-slate-200/90 shadow-2xl shadow-indigo-950/20 backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans"
        >
          {/* Header Selaras Tema Web (Indigo Rasmi Persatuan) */}
          <div className="px-3.5 py-3 sm:px-4 sm:py-3.5 bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white flex items-center justify-between gap-2.5 shrink-0 border-b border-indigo-800/40">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              {/* Mini Robot Avatar Badge */}
              <div className="relative w-8 h-8 rounded-xl bg-white/10 p-0.5 shadow-xs shrink-0 flex items-center justify-center border border-white/20">
                <RobotAvatarSvg pupilOffset={{ x: 0, y: 0 }} isBlinking={false} className="w-7 h-7" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-indigo-950 shadow-xs" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
                    Bot Perlembagaan PTMF2
                  </h3>
                  <span className="hidden sm:inline-flex text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                    Fasal 1-18
                  </span>
                </div>
                <p className="text-[10px] text-indigo-200/90 font-medium truncate">
                  PPM-001-05-28092026 • Sumber Rujukan Rasmi
                </p>
              </div>
            </div>

            {/* Butang Tindakan Header */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleResetChat}
                title="Set Semula / Reset Sembang"
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer active:scale-90"
              >
                <RotateCcw
                  size={15}
                  className={`transition-transform duration-500 ${isResetting ? '-rotate-180 text-white' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Tutup Sembang"
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Cip Cadangan Soalan Pantas (Sebaris Sahaja & Boleh Di-Kembangkan) */}
          <div className="bg-slate-50/95 border-b border-slate-200/80 px-3 py-2 shrink-0 transition-all duration-200 select-none">
            {/* Baris Utama (Satu Baris Kemas) */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsSuggestionsExpanded(prev => !prev)}
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer group flex-1"
                title={isSuggestionsExpanded ? "Lipat semula senarai cadangan soalan" : "Kembangkan untuk lihat semua cadangan soalan perlembagaan"}
              >
                <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-amber-600" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 group-hover:text-indigo-600 transition-colors">
                    Cadangan Soalan
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold shrink-0">
                    {QUICK_QUESTIONS.length}
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal truncate hidden sm:inline">
                    {isSuggestionsExpanded ? '(Ketik untuk tutup)' : '(Ketik untuk lihat semua)'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsSuggestionsExpanded(prev => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-bold shadow-3xs transition-all cursor-pointer shrink-0"
              >
                <span>{isSuggestionsExpanded ? 'Lipat' : 'Kembangkan'}</span>
                {isSuggestionsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Paparan Terkembang (Expanded): Semua 6 soalan dipaparkan penuh dengan kemas tanpa sebarang soalan terpotong */}
            {isSuggestionsExpanded && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/80 max-h-56 overflow-y-auto space-y-1.5 pr-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Pilih soalan untuk tanya terus kepada bot:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {QUICK_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        handleSendMessage(q.full);
                        setIsSuggestionsExpanded(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-indigo-50/80 active:bg-indigo-100 border border-slate-200/90 hover:border-indigo-300 transition-all flex items-start gap-2.5 shadow-3xs hover:shadow-xs cursor-pointer group"
                    >
                      <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-indigo-950 group-hover:text-indigo-700">
                          {q.short}
                        </div>
                        <div className="text-[10px] text-slate-500 leading-snug mt-0.5">
                          {q.full}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ruangan Mesej Sembang */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 scroll-smooth bg-slate-50/60 text-sm">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Mini Bot Icon */}
                {msg.role === 'bot' && (
                  <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 p-0.5 shrink-0 mt-0.5 shadow-xs flex items-center justify-center">
                    <RobotAvatarSvg pupilOffset={{ x: 0, y: 0 }} isBlinking={false} className="w-5 h-5" />
                  </div>
                )}

                <div
                  className={`relative group max-w-[85%] rounded-2xl p-3.5 shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-md shadow-indigo-600/20'
                      : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/90 shadow-sm'
                  }`}
                >
                  {/* Kandungan Teks */}
                  {msg.role === 'bot' ? (
                    renderFormattedBotText(msg.text)
                  ) : (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
                  )}

                  {/* Kaki Mesej: Masa & Butang Salin */}
                  <div
                    className={`flex items-center justify-between gap-3 mt-2.5 pt-1.5 border-t text-[10px] ${
                      msg.role === 'user'
                        ? 'border-indigo-500/30 text-indigo-100'
                        : 'border-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{msg.timestamp}</span>
                    </div>

                    {msg.role === 'bot' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="opacity-70 group-hover:opacity-100 hover:text-indigo-600 transition-opacity flex items-center gap-1 cursor-pointer font-bold"
                        title="Salin jawapan"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={11} className="text-emerald-600" />
                            <span className="text-emerald-600">Disalin</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Animasi Menunggu / Sedang Menyemak Perlembagaan */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 p-0.5 shrink-0 shadow-xs flex items-center justify-center">
                  <RobotAvatarSvg pupilOffset={{ x: 0, y: 0 }} isBlinking={false} className="w-5 h-5 animate-pulse" />
                </div>
                <div className="bg-white border border-indigo-100 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-sm flex items-center gap-2">
                  <span className="text-xs text-indigo-900 font-bold">Menyemak perlembagaan rasmi</span>
                  <div className="flex items-center gap-1 ml-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Borang Selaras Tema Web */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center gap-2"
            >
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tanya fasal perlembagaan PTMF2..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 text-xs rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 resize-none max-h-24 transition-all outline-none disabled:opacity-50 font-medium"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                title="Hantar pertanyaan"
              >
                <Send size={15} />
              </button>
            </form>

            {/* Peringatan Disiplin Rujukan */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1 font-medium">
              <span className="truncate">
                Rujukan rasmi teks Perlembagaan PTMF2 (Fasal 1 - 18)
              </span>
              <span className="text-indigo-600 font-bold shrink-0 ml-2">Fakta Tepat Sahaja</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
