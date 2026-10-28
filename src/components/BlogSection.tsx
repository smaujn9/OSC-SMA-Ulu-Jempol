import React, { useState } from 'react';
import { BookOpen, Calendar, ChevronRight, X, Search, FileText } from 'lucide-react';
import { BlogItem } from '../types';
import { parseDateToMs } from '../utils/dateUtils';

interface BlogSectionProps {
  blogs: BlogItem[];
  isMobile: boolean;
  activeBlog?: BlogItem | null;
  setActiveBlog?: (blog: BlogItem | null) => void;
}

export default function BlogSection({ blogs, isMobile, activeBlog: propActiveBlog, setActiveBlog: propSetActiveBlog }: BlogSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [localActiveBlog, setLocalActiveBlog] = useState<BlogItem | null>(null);

  const activeBlog = propSetActiveBlog !== undefined ? propActiveBlog : localActiveBlog;
  const setActiveBlog = propSetActiveBlog !== undefined ? propSetActiveBlog : setLocalActiveBlog;

  // Filter based on search query
  const filteredBlogs = blogs
    .filter(b => 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.summary.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => parseDateToMs(b.date) - parseDateToMs(a.date));

  return (
    <div className="space-y-6 select-none text-slate-800">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
              <BookOpen size={20} />
            </span>
            Blog Komuniti & Aktiviti
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            Sorotan terkini aktiviti, mesyuarat, dan program yang dianjurkan oleh Persatuan Taman Musytari Fasa 2 Batu Kikir Negeri Sembilan.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Cari artikel blog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-200 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 bg-white"
          />
        </div>
      </div>

      {/* BLOG GRID */}
      {filteredBlogs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 space-y-2">
          <BookOpen className="mx-auto text-gray-300" size={32} />
          <p className="text-xs text-gray-400 font-bold">Tiada artikel blog ditemui yang sepadan dengan carian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlogs.map((blog) => (
            <div 
              key={blog.id} 
              onClick={() => setActiveBlog(blog)}
              className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-teal-100 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-44 w-full overflow-hidden border-b border-gray-50 relative">
                  <img 
                    src={blog.image} 
                    alt={blog.title} 
                    className="w-full h-full object-cover hover:scale-103 transition-transform duration-300" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2.5 left-2.5 bg-slate-900/60 backdrop-blur-xs text-[8px] md:text-[10px] text-white font-black px-2 py-0.5 rounded-full">
                    Sistem Laporan
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <span className="text-[9px] text-teal-600 font-bold block">{blog.date}</span>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-snug hover:text-teal-600 transition-colors line-clamp-1">{blog.title}</h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-medium line-clamp-3">
                    {blog.summary}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border-t border-gray-50 px-4 py-2 text-[10px] text-teal-600 font-bold flex items-center justify-between">
                <span>Baca Artikel Penuh</span>
                <ChevronRight size={14} className="stroke-[2.5]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FULL BLOG VIEW MODAL */}
      {activeBlog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl relative overflow-hidden select-none text-slate-800">
            {/* Cover image */}
            <div className="h-52 w-full bg-slate-900 relative">
              <img 
                src={activeBlog.image} 
                alt="blog-header-cover" 
                className="w-full h-full object-cover opacity-90" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
              
              <button
                onClick={() => setActiveBlog(null)}
                className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white p-1.5 rounded-full backdrop-blur-xs transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-teal-600 text-white font-black px-2 py-0.5 rounded-full">TERKINI</span>
                  <span className="text-[9px] text-teal-200 font-bold">{activeBlog.date}</span>
                </div>
                <h3 className="text-sm md:text-lg font-black leading-tight drop-shadow-sm">{activeBlog.title}</h3>
              </div>
            </div>

            {/* Article Content */}
            <div className="p-5 space-y-4 max-h-[50vh] overflow-y-auto">
              <div className="flex items-center gap-2.5 pb-2 border-b border-gray-50">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                  <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc" alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">Diterbitkan oleh AJK Persatuan</span>
                  <span className="text-[9px] text-gray-400 font-bold">Pegawai Penerangan Penduduk</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 leading-relaxed font-medium space-y-2">
                {activeBlog.summary ? (
                  activeBlog.summary.split('\n').map((line: string, i: number) => {
                    if (line.trim() === '') return <div key={i} className="h-2" />;
                    return <p key={i}>{line}</p>;
                  })
                ) : (
                  <p className="text-gray-400 italic">Tiada kandungan artikel.</p>
                )}
              </div>

              <div className="bg-teal-50 border border-teal-150 p-3 rounded-xl flex items-start gap-2 text-[10px] text-teal-800 font-semibold">
                <FileText size={16} className="text-teal-600 shrink-0 mt-0.5" />
                <span>Ini merupakan artikel laporan rasmi daripada sistem pelaporan program. Semua maklumat telah disahkan oleh Pengerusi Persatuan Penduduk.</span>
              </div>
            </div>

            {/* Footer action close */}
            <div className="bg-slate-50 px-5 py-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setActiveBlog(null)}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Tutup Pembacaan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
