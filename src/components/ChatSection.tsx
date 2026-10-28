import React, { useState, useRef, useEffect } from 'react';
import { Post, Comment } from '../types';
import { ThumbsUp, MessageSquare, Send, Award, Share2, Image, Globe, Pin, X, Upload, Loader2, Trash2, Maximize2, ExternalLink } from 'lucide-react';
import { USER_AHMAD } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { resizeImage, uploadImageToStorage, preloadImages, saveImageToCache } from '../utils/imageUtils';
import { CachedImage } from './CachedImage';

// Helper function to turn URLs into clickable hyperlinks opening in a new tab
const renderTextWithLinks = (text: string) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part.match(/^(https?:\/\/|www\.)/i)) {
      const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`;
      return (
        <a 
          key={index} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-indigo-600 hover:underline break-all font-bold"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

interface ChatSectionProps {
  posts: Post[];
  onAddPost: (content: string, image?: string, scope?: 'Awam' | 'Ahli Jawatankuasa') => void;
  onLikePost: (postId: string) => void;
  onAddComment: (postId: string, commentContent: string) => void;
  onDeletePost?: (postId: string) => void;
  onDeleteComment?: (postId: string, commentId: string) => void;
}

export default function ChatSection({ posts, onAddPost, onLikePost, onAddComment, onDeletePost, onDeleteComment }: ChatSectionProps) {
  const [newPostText, setNewPostText] = useState('');
  const [postImage, setPostImage] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [postScope, setPostScope] = useState<'Awam' | 'Ahli Jawatankuasa'>('Awam');
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [confirmDeleteCommentInfo, setConfirmDeleteCommentInfo] = useState<{postId: string, commentId: string} | null>(null);
  const [previewFullImage, setPreviewFullImage] = useState<string | null>(null);
  const { allUsers, firebaseUser, loginWithGoogle, currentUserDoc, allApplications } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewFullImage(null);
      }
    };
    if (previewFullImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewFullImage]);

  // Automatically pre-cache all community chat images and avatars in background for smooth viewing
  useEffect(() => {
    if (posts && posts.length > 0) {
      const chatImages = posts
        .map(p => p.image)
        .filter((img): img is string => typeof img === 'string' && img.trim() !== '');

      const avatars = posts
        .map(p => p.authorAvatar)
        .filter((av): av is string => typeof av === 'string' && av.trim() !== '');

      const commentAvatars = posts.flatMap(p => 
        (p.comments || []).map(c => c.authorAvatar).filter((av): av is string => typeof av === 'string' && av.trim() !== '')
      );

      preloadImages([...chatImages, ...avatars, ...commentAvatars]);
    }
  }, [posts]);
  
  const isAdminUtama = currentUserDoc?.role === 'Admin Utama' || currentUserDoc?.role === 'ADMIN UTAMA' || currentUserDoc?.isSuperAdmin === true || currentUserDoc?.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my';
  const isAnonymous = !firebaseUser || firebaseUser.isAnonymous;
  
  const isApprovedMember = currentUserDoc?.membershipStatus === 'Aktif' || 
                          currentUserDoc?.membershipStatus === 'Diluluskan' || 
                          currentUserDoc?.membershipStatus === 'Diluluskan Keahlian' ||
                          currentUserDoc?.approvalStatus === 'Approved' || 
                          currentUserDoc?.approvalStatus === 'Diluluskan' || 
                          currentUserDoc?.approvalStatus === 'Diluluskan Keahlian' ||
                          !!currentUserDoc?.memberNo || 
                          (currentUserDoc?.role && !['Pelawat', 'Tetamu', 'Tiada'].includes(currentUserDoc.role)) || 
                          currentUserDoc?.isSuperAdmin === true ||
                          (allApplications || []).some(app => 
                            (app.uid === currentUserDoc?.uid || (app.email && currentUserDoc?.email && app.email.toLowerCase().trim() === currentUserDoc.email.toLowerCase().trim())) &&
                            (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian' || app.status === 'Approved')
                          );

  const isTetamu = !firebaseUser || firebaseUser.isAnonymous || (!isApprovedMember && (currentUserDoc?.role === 'Tetamu' || currentUserDoc?.role === 'Pelawat'));

  const isUserCommittee = (role?: string) => {
    if (!role) return false;
    const nonCommitteeRoles = ['Pelawat', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Penduduk', 'Tetamu'];
    return !nonCommitteeRoles.includes(role);
  };
  const hasJawatan = isUserCommittee(currentUserDoc?.role || USER_AHMAD.role);

  const communityMembers = (allUsers || []).map(u => ({
    name: u.nickname || u.displayName || 'Pengguna',
    displayName: u.displayName || '',
    nickname: u.nickname || '',
    avatar: u.uploadedProfileImageUrl || u.photoURL || u.googleProfileImageUrl || 'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc',
    role: u.role || 'Pelawat',
    isOnline: true,
    bio: u.bio || undefined,
    cover: u.coverURL || undefined,
    address: u.address || undefined,
    phone: u.phoneNumber || undefined,
    email: u.email || undefined,
  }));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAvatar, setCurrentAvatar] = useState(USER_AHMAD.avatar);

  useEffect(() => {
    const handleAvatarChange = () => {
      setCurrentAvatar(USER_AHMAD.avatar);
    };
    window.addEventListener('tmf2_avatar_changed', handleAvatarChange);
    return () => {
      window.removeEventListener('tmf2_avatar_changed', handleAvatarChange);
    };
  }, []);

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() && !postImage.trim()) return;
    onAddPost(newPostText, postImage || undefined, postScope);
    setNewPostText('');
    setPostImage('');
    setShowImageInput(false);
    setPostScope('Awam');
  };

  const handleCommentSubmit = (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;
    onAddComment(postId, text);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploading(true);
        // 1. Generate local preview immediately so that the user sees the image instantly
        const localBase64 = await resizeImage(file, 800, 800, 0.7);
        setPostImage(localBase64);
        setShowImageInput(true);
        await saveImageToCache(localBase64, localBase64);

        // 2. Perform background upload
        const downloadURL = await uploadImageToStorage(file, 'chats', 800, 800, 0.7);
        await saveImageToCache(downloadURL, localBase64);
        
        // 3. Update preview with final URL once uploaded
        setPostImage(downloadURL);
      } catch (err) {
        console.error("Error uploading image:", err);
        alert("Gagal memuat naik gambar. Sila cuba lagi.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (isTetamu) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
          <MessageSquare size={28} />
        </div>
        <h3 className="font-extrabold text-slate-800 text-sm">Akses Sembang Warga SMAUJ Dihadkan</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Ruangan sembang ini hanya boleh diakses oleh warga sekolah atau ibu bapa berdaftar yang telah disahkan sahaja demi menjaga keselamatan dan privasi warga Sekolah Menengah Agama Ulu Jempol.
        </p>
        {!firebaseUser || firebaseUser.isAnonymous ? (
          <button
            onClick={() => loginWithGoogle()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Log Masuk Google</span>
          </button>
        ) : (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 inline-block font-semibold">
            Status Keahlian: Menunggu Kelulusan Jawatankuasa
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Facebook Style Create Post Card */}
      <div id="fb-post-composer" className="bg-white rounded-xl shadow-xs border border-gray-100 p-4">
        {isAnonymous ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <MessageSquare size={28} className="text-slate-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Sembang Komuniti Dikunci</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Sila log masuk dengan akaun Google untuk menyertai perbualan, berkongsi hantaran dan memberi komen.
              </p>
            </div>
            <button
              onClick={() => loginWithGoogle()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-indigo-100 transition-colors"
            >
              Log Masuk Google
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-3 items-center pb-3 border-b border-gray-100">
              <CachedImage
                src={currentAvatar}
                alt="User avatar"
                className="w-10 h-10 rounded-full object-cover border border-gray-200"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1">
                <div className="font-bold text-sm text-gray-900 leading-tight">
                  {currentUserDoc?.nickname || currentUserDoc?.displayName || USER_AHMAD.name}
                </div>
                {hasJawatan ? (
                  <div className="relative inline-block mt-0.5">
                    <select
                      value={postScope}
                      onChange={(e) => setPostScope(e.target.value as 'Awam' | 'Ahli Jawatankuasa')}
                      className="text-[10px] bg-indigo-50 border border-indigo-200 rounded-md font-extrabold px-2 py-0.5 text-indigo-700 outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Awam">🌐 Awam</option>
                      <option value="Ahli Jawatankuasa">🔒 Ahli Jawatankuasa</option>
                    </select>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1 mt-0.5">
                    <Globe size={11} className="text-gray-400 shrink-0" />
                    <span>Awam</span>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Composer form */}
            <form onSubmit={handlePostSubmit} className="mt-3 space-y-3">
              <textarea
                id="composer-textarea"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="Apa yang anda ingin kongsikan dengan komuniti hari ini?"
                className="w-full text-sm outline-hidden border-0 bg-transparent resize-none focus:ring-0 min-h-[90px] text-gray-800 placeholder-gray-400"
              />

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {/* Image Preview or input selection */}
              {showImageInput && (
                <div className="p-3 bg-slate-50 rounded-lg space-y-3 border border-slate-200 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setPostImage('');
                      setShowImageInput(false);
                    }}
                    className="absolute top-2 right-2 p-1 bg-gray-900/80 hover:bg-gray-950 text-white rounded-full cursor-pointer transition-colors z-10"
                  >
                    <X size={14} />
                  </button>

                  {postImage ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white max-h-[220px] flex items-center justify-center">
                      <img
                        src={postImage}
                        alt="Preview upload"
                        className="max-h-[200px] object-contain rounded-md"
                      />
                    </div>
                  ) : isUploading ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-indigo-600" size={24} />
                      <span className="text-xs font-semibold text-slate-600">Sedang memuat naik gambar...</span>
                    </div>
                  ) : (
                    <div 
                      onClick={triggerFileInput}
                      className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-100/50 cursor-pointer transition-colors flex flex-col items-center justify-center gap-2"
                    >
                      <Upload className="text-slate-400" size={24} />
                      <span className="text-xs font-semibold text-slate-600">Klik untuk muat naik gambar dari peranti anda</span>
                      <span className="text-[10px] text-slate-400">Menyokong PNG, JPG, GIF</span>
                    </div>
                  )}

                  {/* Alternative URL Input */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Atau masukkan pautan URL gambar:</label>
                    <input
                      type="text"
                      value={postImage.startsWith('data:') ? '' : postImage}
                      onChange={(e) => {
                        setPostImage(e.target.value);
                        if (e.target.value) setShowImageInput(true);
                      }}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImageInput(true);
                      triggerFileInput();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-xs font-medium transition-colors cursor-pointer ${postImage ? 'text-indigo-600 bg-indigo-50' : 'text-green-600'}`}
                  >
                    <Image size={16} />
                    <span>Foto/Video</span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={(!newPostText.trim() && !postImage.trim()) || isUploading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  {isUploading && <Loader2 className="animate-spin" size={12} />}
                  <span>{isUploading ? 'Memuat naik...' : 'Hantar'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Community Feed */}
      <div className="space-y-4">
        {posts.map((post) => {
          const hasLiked = post.likes.includes(USER_AHMAD.name);
          const isAhmad = post.authorName === currentUserDoc?.nickname || post.authorName === currentUserDoc?.displayName || post.authorName === USER_AHMAD.name;
          const isPostOwner = (post.authorUid && firebaseUser && post.authorUid === firebaseUser.uid) || 
                              (!post.authorUid && isAhmad);
          const member = communityMembers.find(m => 
            m.nickname === post.authorName || 
            m.displayName === post.authorName || 
            m.name === post.authorName
          );
          const resolvedAuthorName = isAhmad 
            ? (currentUserDoc?.nickname || currentUserDoc?.displayName || USER_AHMAD.name) 
            : (member?.nickname || member?.displayName || post.authorName);
          const resolvedAuthorAvatar = isAhmad
            ? (currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || firebaseUser?.photoURL || USER_AHMAD.avatar)
            : (member?.avatar || post.authorAvatar);

          const handleAuthorClick = () => {
            window.dispatchEvent(new CustomEvent('tmf2_view_profile', { detail: isAhmad ? null : member }));
          };

          return (
            <div key={post.id} className="bg-white rounded-xl shadow-xs border border-gray-100 p-4">
              {/* Post Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3">
                  <CachedImage
                    src={resolvedAuthorAvatar}
                    alt={resolvedAuthorName}
                    onClick={handleAuthorClick}
                    className="w-10 h-10 rounded-full object-cover border border-gray-100 cursor-pointer hover:opacity-85 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span 
                        onClick={handleAuthorClick}
                        className="font-bold text-sm text-gray-900 hover:underline cursor-pointer"
                      >
                        {resolvedAuthorName}
                      </span>
                      {post.authorRole && (
                        <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm">
                          <Award size={10} />
                          {post.authorRole}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <span>{post.timestamp}</span>
                      <span>•</span>
                      {post.scope === 'Ahli Jawatankuasa' ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-700 bg-amber-50 border border-amber-200 text-[9px] font-extrabold px-1 py-0.5 rounded-sm">
                          🔒 Ahli Jawatankuasa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-[10px]">
                          <Globe size={11} className="text-gray-400" />
                          <span>Awam</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {post.isPinned && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Pin size={12} className="rotate-45" />
                      <span>Disematkan</span>
                    </span>
                  )}
                  {(isPostOwner || isAdminUtama) && onDeletePost && (
                    <button
                      onClick={() => setConfirmDeletePostId(post.id)}
                      className="text-gray-400 hover:text-rose-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Padam Hantaran"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Post Content */}
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed mb-4">
                {renderTextWithLinks(post.content)}
              </p>

              {/* Post Image */}
              {post.image && (
                <div 
                  onClick={() => setPreviewFullImage(post.image!)}
                  className="rounded-xl overflow-hidden border border-gray-100 mb-4 max-h-[420px] cursor-pointer relative group bg-slate-900/5 flex items-center justify-center transition-all duration-200"
                  title="Klik untuk lihat gambar penuh"
                >
                  <CachedImage
                    src={post.image}
                    alt="Post media"
                    className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-black/75 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-xs transform translate-y-1 group-hover:translate-y-0 transition-all">
                      <Maximize2 size={14} />
                      <span>Lihat Gambar Penuh</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Likes & Comments Counters */}
              <div className="flex justify-between items-center text-xs text-gray-500 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-1 w-5 h-5">
                    <ThumbsUp size={10} fill="currentColor" />
                  </span>
                  <span className="font-medium">
                    {post.likes.length > 0 
                      ? hasLiked 
                        ? post.likes.length === 1 
                          ? 'Anda menyukai ini' 
                          : `Anda dan ${post.likes.length - 1} orang lain`
                        : `${post.likes.length} orang`
                      : 'Suka pertama'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button className="hover:underline cursor-pointer">
                    {post.comments.length} Komen
                  </button>
                  <button className="hover:underline cursor-pointer">
                    Kongsi
                  </button>
                </div>
              </div>

              {/* Post Actions Row */}
              <div className="flex grid grid-cols-3 gap-1 py-1 text-xs font-semibold text-gray-600 border-b border-gray-100">
                <button
                  onClick={() => onLikePost(post.id)}
                  className={`flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${hasLiked ? 'text-blue-600 font-bold' : ''}`}
                >
                  <ThumbsUp size={16} fill={hasLiked ? 'currentColor' : 'none'} />
                  <span>Suka</span>
                </button>
                <button 
                  onClick={() => {
                    const el = document.getElementById(`comment-input-${post.id}`);
                    if (el) el.focus();
                  }}
                  className="flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <MessageSquare size={16} />
                  <span>Komen</span>
                </button>
                <button className="flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                  <Share2 size={16} />
                  <span>Kongsi</span>
                </button>
              </div>

              {/* Comments Section */}
              {post.comments.length > 0 && (
                <div className="space-y-3 mt-4 pt-2">
                  {post.comments.map((comment) => {
                    const isCommAhmad = comment.authorName === currentUserDoc?.nickname || comment.authorName === currentUserDoc?.displayName || comment.authorName === USER_AHMAD.name;
                    const commMember = communityMembers.find(m => 
                      m.nickname === comment.authorName || 
                      m.displayName === comment.authorName || 
                      m.name === comment.authorName
                    );
                    const resolvedCommAuthorName = isCommAhmad 
                      ? (currentUserDoc?.nickname || currentUserDoc?.displayName || USER_AHMAD.name) 
                      : (commMember?.nickname || commMember?.displayName || comment.authorName);
                    const resolvedCommAuthorAvatar = isCommAhmad
                      ? (currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || firebaseUser?.photoURL || USER_AHMAD.avatar)
                      : (commMember?.avatar || comment.authorAvatar);

                    const handleCommAuthorClick = () => {
                      window.dispatchEvent(new CustomEvent('tmf2_view_profile', { detail: isCommAhmad ? null : commMember }));
                    };

                    const isCommentOwner = (comment.authorUid && firebaseUser && comment.authorUid === firebaseUser.uid) || 
                                           (!comment.authorUid && isCommAhmad);

                    return (
                      <div key={comment.id} className="flex gap-2.5 items-start text-xs">
                        <CachedImage
                          src={resolvedCommAuthorAvatar}
                          alt={resolvedCommAuthorName}
                          onClick={handleCommAuthorClick}
                          className="w-8 h-8 rounded-full object-cover border border-gray-100 mt-0.5 cursor-pointer hover:opacity-85 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1">
                          <div className="bg-gray-100 p-2.5 rounded-2xl inline-block max-w-[90%]">
                            <span 
                              onClick={handleCommAuthorClick}
                              className="font-bold text-gray-900 block mb-0.5 hover:underline cursor-pointer"
                            >
                              {resolvedCommAuthorName}
                            </span>
                            <p className="text-gray-800 leading-normal whitespace-pre-line">{renderTextWithLinks(comment.content)}</p>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1 pl-2.5">
                            <span className="font-semibold hover:underline cursor-pointer text-gray-600">Suka</span>
                            <span>•</span>
                            <span className="font-semibold hover:underline cursor-pointer text-gray-600">Balas</span>
                            <span>•</span>
                            {(isCommentOwner || isAdminUtama) && onDeleteComment && (
                              <>
                                <button
                                  onClick={() => {
                                    setConfirmDeleteCommentInfo({postId: post.id, commentId: comment.id});
                                  }}
                                  className="font-semibold hover:underline text-rose-600 cursor-pointer"
                                >
                                  Padam
                                </button>
                                <span>•</span>
                              </>
                            )}
                            <span>{comment.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Comment Input */}
              <div className="flex gap-2.5 items-center mt-4">
                <CachedImage
                  src={currentAvatar}
                  alt="Ahmad avatar"
                  className="w-8 h-8 rounded-full object-cover border border-gray-100"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 flex gap-2 items-center bg-gray-100 rounded-full px-3 py-1.5 border border-gray-100">
                  <input
                    id={`comment-input-${post.id}`}
                    type="text"
                    value={commentInputs[post.id] || ''}
                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                    placeholder="Tulis komen..."
                    className="flex-1 bg-transparent border-0 outline-hidden focus:ring-0 text-xs py-0.5 text-gray-800"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCommentSubmit(post.id);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleCommentSubmit(post.id)}
                    disabled={!commentInputs[post.id]?.trim()}
                    className="text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-opacity cursor-pointer p-0.5"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Pop-up Confirmation for Post Delete */}
      {confirmDeletePostId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setConfirmDeletePostId(null)}
          />
          
          {/* Modal Content */}
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative z-10 border border-gray-100 transform scale-100 transition-all duration-200 animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              {/* Warning Icon */}
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                <Trash2 size={24} />
              </div>
              
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Padam Hantaran?
              </h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Adakah anda pasti ingin memadam hantaran ini secara kekal? Tindakan ini tidak boleh diundurkan.
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmDeletePostId(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (onDeletePost) {
                      onDeletePost(confirmDeletePostId);
                    }
                    setConfirmDeletePostId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Ya, Padam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pop-up Confirmation for Comment Delete */}
      {confirmDeleteCommentInfo && onDeleteComment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setConfirmDeleteCommentInfo(null)}
          />
          
          {/* Modal Content */}
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative z-10 border border-gray-100 transform scale-100 transition-all duration-200 animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              {/* Warning Icon */}
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                <Trash2 size={24} />
              </div>
              
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Padam Komen?
              </h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Adakah anda pasti ingin memadam komen ini secara kekal? Tindakan ini tidak boleh diundurkan.
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmDeleteCommentInfo(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    onDeleteComment(confirmDeleteCommentInfo.postId, confirmDeleteCommentInfo.commentId);
                    setConfirmDeleteCommentInfo(null);
                  }}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Ya, Padam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal View Full Image */}
      {previewFullImage && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewFullImage(null)}
        >
          {/* Action buttons bar */}
          <div 
            className="absolute top-4 right-4 z-20 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={previewFullImage}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm flex items-center justify-center"
              title="Buka pautan dalam tab baru"
            >
              <ExternalLink size={18} />
            </a>
            <button
              onClick={() => setPreviewFullImage(null)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm flex items-center justify-center"
              title="Tutup (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Centered Image Container */}
          <div 
            className="relative max-w-5xl max-h-[88vh] w-full flex items-center justify-center p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <CachedImage
              src={previewFullImage}
              alt="Gambar penuh komuniti"
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
