import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FileText, 
  MessageSquare, 
  Plus, 
  Search, 
  ArrowLeft, 
  Settings, 
  MoreVertical, 
  Download, 
  Trash2, 
  Edit2, 
  Send, 
  Check, 
  Loader2, 
  Paperclip, 
  Clock, 
  Info, 
  AlertCircle, 
  CloudLightning,
  RefreshCw,
  FileCode,
  FileSpreadsheet,
  FileImage,
  File,
  X,
  User,
  Filter,
  UploadCloud,
  Film,
  Music,
  FileArchive,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';

interface DokumenSectionProps {
  isMobile: boolean;
  hasCommitteeAccess?: boolean;
  onBack?: () => void;
}

interface FileMetadata {
  id: string; // Google Drive file ID
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  driveUrl: string;
}

export interface UploadQueueItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface CommentReply {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  content: string;
  timestamp: string;
}

interface FolderComment {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  content: string;
  timestamp: string;
  replies: CommentReply[];
}

interface AssociationFolder {
  id: string;
  name: string;
  driveFolderId?: string | null;
  status: 'Aktif' | 'Draf' | 'Arkib';
  createdAt: any;
  updatedAt: any;
  updatedBy?: string;
  files: FileMetadata[];
  comments: FolderComment[];
}

// Helper to get beautiful human-readable file size
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Safe mime type resolver for any format
const getMimeType = (file: File): string => {
  if (file.type && file.type.trim() !== '') return file.type;
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt': return 'application/vnd.ms-powerpoint';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'csv': return 'text/csv';
    case 'txt': return 'text/plain';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'mkv': return 'video/x-matroska';
    case 'avi': return 'video/x-msvideo';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4';
    case 'zip': return 'application/zip';
    case 'rar': return 'application/x-rar-compressed';
    case '7z': return 'application/x-7z-compressed';
    case 'tar': return 'application/x-tar';
    case 'gz': return 'application/gzip';
    case 'json': return 'application/json';
    case 'xml': return 'application/xml';
    case 'apk': return 'application/vnd.android.package-archive';
    default: return 'application/octet-stream';
  }
};

// Helper for file type icons (supports all formats)
const getFileIcon = (mimeType: string, fileName = '') => {
  const mime = (mimeType || '').toLowerCase();
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';

  if (mime.includes('pdf') || ext === 'pdf') {
    return <FileText className="w-8 h-8 text-rose-500" />;
  }
  if (
    mime.includes('word') || 
    mime.includes('document') || 
    mime.includes('officedocument.wordprocessingml') ||
    ['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)
  ) {
    return <FileText className="w-8 h-8 text-blue-500" />;
  }
  if (
    mime.includes('presentation') || 
    mime.includes('powerpoint') || 
    mime.includes('officedocument.presentationml') ||
    ['ppt', 'pptx', 'odp', 'key'].includes(ext)
  ) {
    return <FileText className="w-8 h-8 text-amber-500" />;
  }
  if (
    mime.includes('excel') || 
    mime.includes('sheet') || 
    mime.includes('csv') ||
    mime.includes('officedocument.spreadsheetml') ||
    ['xls', 'xlsx', 'csv', 'ods', 'tsv', 'numbers'].includes(ext)
  ) {
    return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
  }
  if (mime.includes('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'tiff', 'psd', 'ai'].includes(ext)) {
    return <FileImage className="w-8 h-8 text-purple-500" />;
  }
  if (mime.includes('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', '3gp', 'm4v'].includes(ext)) {
    return <Film className="w-8 h-8 text-pink-500" />;
  }
  if (mime.includes('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'wma'].includes(ext)) {
    return <Music className="w-8 h-8 text-indigo-500" />;
  }
  if (
    mime.includes('zip') || 
    mime.includes('rar') || 
    mime.includes('tar') || 
    mime.includes('compressed') ||
    mime.includes('7z') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'bin'].includes(ext)
  ) {
    return <FileArchive className="w-8 h-8 text-amber-600" />;
  }
  if (
    mime.includes('json') || 
    mime.includes('javascript') || 
    mime.includes('typescript') || 
    mime.includes('html') || 
    mime.includes('xml') ||
    ['json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'sql', 'xml', 'md', 'sh', 'yaml', 'yml', 'txt', 'java', 'c', 'cpp'].includes(ext)
  ) {
    return <FileCode className="w-8 h-8 text-cyan-600" />;
  }
  return <File className="w-8 h-8 text-slate-400" />;
};

// Helper for file badges
const getFileBadgeColor = (mimeType: string, fileName = '') => {
  const mime = (mimeType || '').toLowerCase();
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';

  if (mime.includes('pdf') || ext === 'pdf') return 'bg-rose-100 text-rose-700';
  if (mime.includes('word') || ['doc', 'docx', 'odt'].includes(ext)) return 'bg-blue-100 text-blue-700';
  if (mime.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'bg-amber-100 text-amber-700';
  if (mime.includes('excel') || mime.includes('sheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'bg-emerald-100 text-emerald-700';
  if (mime.includes('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'bg-purple-100 text-purple-700';
  if (mime.includes('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'bg-pink-100 text-pink-700';
  if (mime.includes('audio/') || ['mp3', 'wav', 'm4a'].includes(ext)) return 'bg-indigo-100 text-indigo-700';
  if (mime.includes('zip') || mime.includes('rar') || ['zip', 'rar', '7z'].includes(ext)) return 'bg-amber-100 text-amber-700';
  if (mime.includes('json') || ['json', 'sql', 'js', 'ts', 'py', 'html'].includes(ext)) return 'bg-cyan-100 text-cyan-700';
  return 'bg-slate-100 text-slate-700';
};

const getFileBadgeLabel = (mimeType: string, fileName = '') => {
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || '' : '';
  if (ext && ext.length <= 6) return ext;
  if (!mimeType) return 'FAIL';
  const mime = mimeType.toLowerCase();
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('word') || mime.includes('document')) return 'DOCX';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'PPTX';
  if (mime.includes('excel') || mime.includes('sheet')) return 'XLSX';
  if (mime.includes('csv')) return 'CSV';
  if (mime.includes('image/png')) return 'PNG';
  if (mime.includes('image/jpeg') || mime.includes('image/jpg')) return 'JPG';
  if (mime.includes('image/')) return 'IMEJ';
  if (mime.includes('video/')) return 'VIDEO';
  if (mime.includes('audio/')) return 'AUDIO';
  if (mime.includes('zip')) return 'ZIP';
  if (mime.includes('rar')) return 'RAR';
  return 'FAIL';
};

// Search or create a folder in Google Drive REST API
const createGoogleDriveFolder = async (folderName: string, token: string): Promise<string> => {
  // First, check if a folder with this name already exists in Drive to avoid duplicate folders
  try {
    const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const qParam = `mimeType = 'application/vnd.google-apps.folder' and name = '${escapedName}' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qParam)}&fields=files(id,name)&spaces=drive`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    } else if (searchRes.status === 401 || searchRes.status === 403) {
      const errText = await searchRes.text().catch(() => '');
      const err: any = new Error(`Google Drive Auth Error (${searchRes.status}): ${errText}`);
      err.status = searchRes.status;
      throw err;
    }
  } catch (err: any) {
    if (err.status === 401 || err.status === 403) throw err;
    console.warn("Folder search in Drive failed, proceeding to creation:", err);
  }

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };

  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    let parsedMsg = response.statusText;
    try {
      const parsed = JSON.parse(errText);
      parsedMsg = parsed.error?.message || errText;
    } catch (_) {
      parsedMsg = errText;
    }
    const err: any = new Error(`Google Drive Error (${response.status}): ${parsedMsg}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.id;
};

// Multipart file upload to Google Drive REST API (supports up to 50MB, all formats)
const uploadFileToGoogleDrive = async (file: File, parentFolderId: string | null, token: string) => {
  const resolvedMime = getMimeType(file);
  const metadata: any = {
    name: file.name,
    mimeType: resolvedMime
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const boundary = '3d0f1a2b3c4d5e6f';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  
  return new Promise<{ id: string; webViewLink: string }>((resolve, reject) => {
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        
        // Convert arrayBuffer to base64 safely in chunks to prevent call-stack or memory exhaustion
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        const CHUNK_SIZE = 0x8000;
        let binary = '';
        for (let i = 0; i < len; i += CHUNK_SIZE) {
          const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
          binary += String.fromCharCode.apply(null, chunk as any);
        }
        const base64Data = btoa(binary);

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Transfer-Encoding: base64\r\n' +
          `Content-Type: ${resolvedMime}\r\n\r\n` +
          base64Data +
          closeDelimiter;

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          let parsedMsg = response.statusText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch (_) {
            parsedMsg = errText;
          }
          const err: any = new Error(`Google Drive Upload Error (${response.status}): ${parsedMsg}`);
          err.status = response.status;
          throw err;
        }

        const result = await response.json();

        // Attempt to grant reader permission so documents can be previewed by other committee members
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
          });
        } catch (permErr) {
          console.warn("Could not set viewer permission on Drive file:", permErr);
        }

        resolve({
          id: result.id,
          webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view?usp=sharing`
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export default function DokumenSection({ isMobile, hasCommitteeAccess = false, onBack }: DokumenSectionProps) {
  const { currentUserDoc, googleDriveToken, setGoogleDriveToken, connectGoogleDrive, logAction, firebaseUser } = useAuth();
  
  // Realtime Folders State
  const [folders, setFolders] = useState<AssociationFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  
  // UI States
  const [selectedFolder, setSelectedFolder] = useState<AssociationFolder | null>(null);
  const [activeTab, setActiveTab] = useState<'komen' | 'butiran' | 'aktiviti'>('komen');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  
  // File Upload & Multi-upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploadSummary, setUploadSummary] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Comments States
  const [newCommentText, setNewCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [newReplyText, setNewReplyText] = useState('');
  
  // Context menus & editing
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string>('Tiada data');

  // Loading/progress state for buttons
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [isDeletingInModal, setIsDeletingInModal] = useState(false);

  // Custom Confirmation Dialog State
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleConfirmDeleteClick = async () => {
    if (!confirmDelete) return;
    setIsDeletingInModal(true);
    try {
      await confirmDelete.onConfirm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingInModal(false);
    }
  };

  // Load Folders from Firestore in Realtime
  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local') {
      setFolders([]);
      setLoadingFolders(false);
      return;
    }
    const q = collection(db, 'folders');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const folderList: AssociationFolder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        folderList.push({
          id: docSnap.id,
          name: data.name || '',
          driveFolderId: data.driveFolderId || null,
          status: data.status || 'Aktif',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy || '',
          files: data.files || [],
          comments: data.comments || []
        } as AssociationFolder);
      });
      
      // Sort by updatedAt descending, or createdAt descending
      folderList.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setFolders(folderList);
      setLoadingFolders(false);
      
      // Update last updated metadata text
      if (folderList.length > 0) {
        const newest = folderList[0];
        const dateObj = newest.updatedAt?.toDate() || newest.createdAt?.toDate() || new Date();
        const formattedDate = dateObj.toLocaleDateString('ms-MY', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        setLastUpdatedDate(`Terakhir dikemas kini: ${formattedDate}`);
      }
    }, (error) => {
      console.error("Error loading folders: ", error);
      setLoadingFolders(false);
    });

    return () => unsubscribe();
  }, [db, firebaseUser]);

  // Sync selected folder in realtime when folder list updates
  useEffect(() => {
    if (selectedFolder) {
      const updated = folders.find(f => f.id === selectedFolder.id);
      if (updated) {
        setSelectedFolder(updated);
      }
    }
  }, [folders, selectedFolder]);

  // Check if current user is admin/committee
  const rolesWithWriteAccess = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Penolong Setiausaha', 'Bendahari'];
  const canWrite = currentUserDoc && (rolesWithWriteAccess.includes(currentUserDoc.role) || currentUserDoc.isSuperAdmin);

  // Validate cached Google Drive token on load and clear if expired/unauthorized
  useEffect(() => {
    let isMounted = true;
    const verifyCachedToken = async () => {
      if (!googleDriveToken) return;
      try {
        const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { Authorization: `Bearer ${googleDriveToken}` }
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            console.warn("Token Google Drive telah tamat tempoh atau tidak sah (401/403). Menetapkan semula token.");
            if (isMounted) {
              setGoogleDriveToken(null);
            }
          }
        }
      } catch (err) {
        console.warn("Semakan kesahan token Google Drive gagal:", err);
      }
    };
    verifyCachedToken();
    return () => { isMounted = false; };
  }, [googleDriveToken]);

  // Show beautiful Toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Google Drive Connection Handler
  const handleConnectDrive = async (): Promise<string | null> => {
    setIsConnectingDrive(true);
    try {
      const token = await connectGoogleDrive();
      if (token) {
        showToast("Berjaya menyambung ke Google Drive!", "success");
        await logAction('Sambung Google Drive', 'Menyambungkan akaun ke integrasi Google Drive');
        return token;
      } else {
        showToast("Gagal menyambung ke Google Drive.", "error");
        return null;
      }
    } catch (err: any) {
      console.error(err);
      showToast("Gagal menyambung Google Drive: " + err.message, "error");
      return null;
    } finally {
      setIsConnectingDrive(false);
    }
  };

  // Add Folder Handler
  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setIsSubmittingFolder(true);
    
    try {
      let gDriveFolderId: string | null = null;
      
      // If we have Google Drive access, auto-create the folder in Drive!
      if (googleDriveToken) {
        try {
          gDriveFolderId = await createGoogleDriveFolder(newFolderName.trim(), googleDriveToken);
          showToast("Folder berjaya dicipta di Firestore & Google Drive!", "success");
        } catch (driveErr: any) {
          console.warn("Drive folder auto-creation failed, creating in Firestore only:", driveErr);
          if (driveErr?.status === 401 || driveErr?.status === 403) {
            setGoogleDriveToken(null);
          }
          showToast("Folder dicipta di Firestore (Gagal di Google Drive)", "info");
        }
      } else {
        showToast("Folder dicipta dalam Firestore sahaja (Akaun Google Drive belum disambung)", "info");
      }

      const folderId = `folder_${Date.now()}`;
      const folderDocRef = doc(db, 'folders', folderId);
      
      await setDoc(folderDocRef, {
        id: folderId,
        name: newFolderName.trim(),
        driveFolderId: gDriveFolderId,
        status: 'Aktif',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserDoc?.displayName || 'Admin',
        files: [],
        comments: []
      });

      await logAction('Cipta Folder', `Mencipta folder baru: ${newFolderName.trim()}`);
      setNewFolderName('');
      setShowAddModal(false);
    } catch (err: any) {
      console.error(err);
      showToast("Gagal mencipta folder: " + err.message, "error");
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  // Edit/Rename Folder Handler
  const handleEditFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFolderName.trim() || !editFolderId) return;
    setIsEditingFolder(true);
    
    try {
      const folderDocRef = doc(db, 'folders', editFolderId);
      await updateDoc(folderDocRef, {
        name: editFolderName.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserDoc?.displayName || 'Admin'
      });

      await logAction('Kemaskini Folder', `Menamakan semula folder kepada: ${editFolderName.trim()}`);
      showToast("Nama folder berjaya dikemas kini!", "success");
      setEditFolderId(null);
      setEditFolderName('');
      setShowEditModal(false);
    } catch (err: any) {
      console.error(err);
      showToast("Gagal mengemaskini folder: " + err.message, "error");
    } finally {
      setIsEditingFolder(false);
    }
  };

  // Delete Folder Handler
  const handleDeleteFolder = (folderId: string, folderName: string) => {
    setConfirmDelete({
      show: true,
      title: "Padam Folder",
      message: `Adakah anda pasti mahu memadam folder "${folderName}" berserta semua kandungannya?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'folders', folderId));
          await logAction('Padam Folder', `Memadam folder: ${folderName}`);
          showToast("Folder berjaya dipadam!", "success");
          if (selectedFolder?.id === folderId) {
            setSelectedFolder(null);
          }
        } catch (err: any) {
          console.error(err);
          showToast("Gagal memadam folder: " + err.message, "error");
        } finally {
          setConfirmDelete(null);
        }
      }
    });
  };

  // Process Multi-upload & Drag-and-Drop files (any format, up to 50MB per file)
  const handleProcessFiles = async (rawFiles: File[]) => {
    if (!rawFiles || rawFiles.length === 0 || !selectedFolder) return;
    if (!canWrite) {
      showToast("Anda tidak mempunyai kebenaran untuk memuat naik fail.", "error");
      return;
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    const initialQueue: UploadQueueItem[] = rawFiles.map((file, idx) => {
      const isOver = file.size > MAX_SIZE;
      return {
        id: `${Date.now()}_${idx}_${file.name}`,
        name: file.name,
        size: file.size,
        status: isOver ? 'error' : 'pending',
        progress: 0,
        error: isOver ? 'Melebihi had maksimum 50MB' : undefined
      };
    });

    const validFiles = rawFiles.filter(f => f.size <= MAX_SIZE);
    if (validFiles.length === 0) {
      showToast("Ralat: Semua fail yang dipilih melebihi had maksimum 50MB.", "error");
      setUploadQueue(initialQueue);
      return;
    }

    let activeToken = googleDriveToken;

    // Check Drive token; connect if absent
    if (!activeToken) {
      showToast("Sila sambungkan akaun Google Drive untuk memuat naik...", "info");
      try {
        activeToken = await connectGoogleDrive();
      } catch (err: any) {
        showToast("Penyambungan Google Drive dibatalkan.", "error");
        return;
      }
      if (!activeToken) {
        showToast("Penyambungan Google Drive diperlukan untuk memuat naik fail.", "error");
        return;
      }
    }

    setIsUploadingFile(true);
    setUploadProgress(5);
    setUploadQueue(initialQueue);
    setUploadSummary(null);

    try {
      let activeDriveFolderId = selectedFolder.driveFolderId;

      // Ensure Google Drive folder exists
      if (!activeDriveFolderId) {
        try {
          activeDriveFolderId = await createGoogleDriveFolder(selectedFolder.name, activeToken);
          await updateDoc(doc(db, 'folders', selectedFolder.id), {
            driveFolderId: activeDriveFolderId
          });
        } catch (folderErr: any) {
          console.warn("Folder creation error in Google Drive:", folderErr);
          if (
            folderErr?.status === 401 || 
            folderErr?.status === 403 || 
            folderErr?.message?.includes('401') || 
            folderErr?.message?.includes('403') || 
            folderErr?.message?.includes('Insufficient Permission')
          ) {
            setGoogleDriveToken(null);
            const freshToken = await connectGoogleDrive();
            if (freshToken) {
              activeToken = freshToken;
              try {
                activeDriveFolderId = await createGoogleDriveFolder(selectedFolder.name, activeToken);
                await updateDoc(doc(db, 'folders', selectedFolder.id), {
                  driveFolderId: activeDriveFolderId
                });
              } catch {
                activeDriveFolderId = null;
              }
            }
          }
        }
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < rawFiles.length; i++) {
        const file = rawFiles[i];
        const queueId = initialQueue[i].id;

        if (file.size > MAX_SIZE) {
          failedCount++;
          continue;
        }

        // Set this item to uploading
        setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'uploading', progress: 30 } : q));
        const currentPercentage = Math.round(((i) / rawFiles.length) * 100);
        setUploadProgress(currentPercentage);

        try {
          let driveResult;
          try {
            driveResult = await uploadFileToGoogleDrive(file, activeDriveFolderId, activeToken);
          } catch (uploadErr: any) {
            if (
              uploadErr?.status === 401 || 
              uploadErr?.status === 403 || 
              uploadErr?.message?.includes('401') || 
              uploadErr?.message?.includes('403')
            ) {
              setGoogleDriveToken(null);
              const freshToken = await connectGoogleDrive();
              if (!freshToken) throw new Error("Pengesahan Google Drive gagal.");
              activeToken = freshToken;
              driveResult = await uploadFileToGoogleDrive(file, activeDriveFolderId, activeToken);
            } else {
              throw uploadErr;
            }
          }

          const newFile: FileMetadata = {
            id: driveResult.id,
            name: file.name,
            mimeType: getMimeType(file),
            size: file.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: currentUserDoc?.displayName || 'Admin',
            driveUrl: driveResult.webViewLink
          };

          successCount++;
          setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'success', progress: 100 } : q));

          // Realtime add to Firestore so it shows immediately
          await updateDoc(doc(db, 'folders', selectedFolder.id), {
            files: arrayUnion(newFile),
            updatedAt: serverTimestamp(),
            updatedBy: currentUserDoc?.displayName || 'Admin'
          });

        } catch (fileErr: any) {
          console.error(`Gagal muat naik fail ${file.name}:`, fileErr);
          failedCount++;
          setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'error', progress: 0, error: fileErr?.message || 'Gagal dimuat naik' } : q));
        }
      }

      setUploadProgress(100);
      setUploadSummary({ total: rawFiles.length, success: successCount, failed: failedCount });

      if (successCount > 0) {
        await logAction('Muat Naik Fail', `Memuat naik ${successCount} fail ke folder "${selectedFolder.name}"`);
        if (failedCount === 0) {
          showToast(
            rawFiles.length === 1 
              ? `Fail "${rawFiles[0].name}" berjaya dimuat naik ke Google Drive!` 
              : `${successCount} fail berjaya dimuat naik serentak ke Google Drive!`,
            'success'
          );
        } else {
          showToast(`${successCount} fail berjaya dimuat naik (${failedCount} gagal).`, 'info');
        }
      } else {
        showToast("Gagal memuat naik fail. Sila semak sambungan akaun Google Drive anda.", "error");
      }

    } catch (err: any) {
      console.error(err);
      showToast("Ralat muat naik: " + (err.message || "Gagal memproses muat naik fail."), "error");
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      handleProcessFiles(files);
    }
  };

  // Drag and Drop Event Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      handleProcessFiles(droppedFiles);
    }
  };

  // Delete File Handler
  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (!selectedFolder || !canWrite) return;
    setConfirmDelete({
      show: true,
      title: "Padam Fail",
      message: `Adakah anda pasti mahu memadam fail "${fileName}"? Fail ini akan dipadam dari rekod metadata.`,
      onConfirm: async () => {
        try {
          const updatedFiles = selectedFolder.files.filter(f => f.id !== fileId);
          
          // Update Firestore
          await updateDoc(doc(db, 'folders', selectedFolder.id), {
            files: updatedFiles,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserDoc?.displayName || 'Admin'
          });

          // Optional: Delete from Google Drive too if token is available
          if (googleDriveToken) {
            try {
              await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${googleDriveToken}` }
              });
              showToast("Fail berjaya dipadam sepenuhnya dari Firestore & Google Drive!", "success");
            } catch (err) {
              console.warn("Drive file delete failed, deleted from Firestore metadata only:", err);
              showToast("Fail dipadam dari Firestore metadata sahaja", "info");
            }
          } else {
            showToast("Fail dipadam dari Firestore metadata sahaja (Akaun Google Drive belum disambung)", "info");
          }

          await logAction('Padam Fail', `Memadam fail "${fileName}" dari folder "${selectedFolder.name}"`);
        } catch (err: any) {
          console.error(err);
          showToast("Gagal memadam fail: " + err.message, "error");
        } finally {
          setConfirmDelete(null);
        }
      }
    });
  };

  // Comments System (Single thread - 1 Parent Comment with nesting replies)
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedFolder) return;

    // "Komen hanya boleh single komen untuk satu folder sahaja"
    // If a comment thread already exists, prevent creating a new parent comment!
    if (selectedFolder.comments.length > 0) {
      showToast("Ralat: Hanya dibenarkan satu komen utama bagi satu folder sahaja. Sila balas (Reply) pada komen sedia ada.", "error");
      return;
    }

    setIsSubmittingComment(true);
    try {
      const newComment: FolderComment = {
        id: `comment_${Date.now()}`,
        authorName: currentUserDoc?.displayName || 'Ahli',
        authorRole: currentUserDoc?.role || 'Penduduk',
        authorAvatar: currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
        content: newCommentText.trim(),
        timestamp: new Date().toLocaleString('ms-MY', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        replies: []
      };

      await updateDoc(doc(db, 'folders', selectedFolder.id), {
        comments: [newComment],
        updatedAt: serverTimestamp()
      });

      await logAction('Tambah Komen', `Menulis komen di folder "${selectedFolder.name}"`);
      setNewCommentText('');
      showToast("Komen berjaya dihantar!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Gagal menghantar komen: " + err.message, "error");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Add reply under parent comment
  const handleAddReply = async (commentId: string) => {
    if (!newReplyText.trim() || !selectedFolder) return;
    setSubmittingReplyId(commentId);

    try {
      const updatedComments = selectedFolder.comments.map(c => {
        if (c.id === commentId) {
          const newReply: CommentReply = {
            id: `reply_${Date.now()}`,
            authorName: currentUserDoc?.displayName || 'Ahli',
            authorRole: currentUserDoc?.role || 'Penduduk',
            authorAvatar: currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100',
            content: newReplyText.trim(),
            timestamp: new Date().toLocaleString('ms-MY', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          };
          return {
            ...c,
            replies: [...c.replies, newReply]
          };
        }
        return c;
      });

      await updateDoc(doc(db, 'folders', selectedFolder.id), {
        comments: updatedComments,
        updatedAt: serverTimestamp()
      });

      await logAction('Balas Komen', `Membalas komen di folder "${selectedFolder.name}"`);
      setNewReplyText('');
      setReplyToId(null);
      showToast("Balasan komen berjaya dihantar!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Gagal menghantar balasan: " + err.message, "error");
    } finally {
      setSubmittingReplyId(null);
    }
  };

  // Delete entire comment thread
  const handleDeleteCommentThread = (commentId: string) => {
    if (!selectedFolder) return;
    setConfirmDelete({
      show: true,
      title: "Padam Komen",
      message: "Adakah anda pasti mahu memadam komen ini berserta semua balasannya?",
      onConfirm: async () => {
        try {
          const updatedComments = selectedFolder.comments.filter(c => c.id !== commentId);
          await updateDoc(doc(db, 'folders', selectedFolder.id), {
            comments: updatedComments,
            updatedAt: serverTimestamp()
          });
          showToast("Komen berjaya dipadam!", "success");
        } catch (err) {
          console.error(err);
          showToast("Gagal memadam komen", "error");
        } finally {
          setConfirmDelete(null);
        }
      }
    });
  };

  // Filter folders by search term
  const filteredFolders = folders.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allowedRoles = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'];
  const hasAccess = currentUserDoc && (allowedRoles.includes(currentUserDoc.role) || currentUserDoc.isSuperAdmin);

  if (!hasAccess) {
    return (
      <div id="dokumen-section-root" className="w-full bg-slate-50 min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xs">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100/50">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Akses Terhad</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Halaman Dokumen Sekolah ini hanya boleh diakses oleh peranan **Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib/Penolong Setiausaha,** dan **Bendahari** sahaja.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="dokumen-section-root" className="w-full bg-slate-50 min-h-screen pb-16 relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5 text-emerald-600" /> :
             toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-600" /> :
             <Info className="w-5 h-5 text-blue-600" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Drive Integration Banner if not connected */}
        {!googleDriveToken && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <CloudLightning className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="font-bold text-sm text-slate-900">Sambungan Google Drive Belum Aktif</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                  Sila sambungkan Google Drive menggunakan butang di sebelah kanan. Muat naik fail terus dimasukkan ke folder pemacu awan peribadi anda, manakala metadata disimpan selamat dalam Firestore.
                </p>
              </div>
            </div>
            <button
              onClick={handleConnectDrive}
              disabled={isConnectingDrive}
              className="gsi-material-button self-start sm:self-center shrink-0 border border-slate-300 hover:border-slate-400 bg-white shadow-sm flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl transition duration-200"
            >
              {isConnectingDrive ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              ) : (
                <div className="gsi-material-button-icon w-5 h-5">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="block w-full h-full">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
              )}
              <span className="text-xs font-semibold text-slate-800">Sambung Google Drive</span>
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!selectedFolder ? (
            /* ================= VIEW 1: FOLDER LIST VIEW ================= */
            <motion.div
              key="folder-list-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {/* Header block - Mockup design */}
              <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <ArrowLeft 
                    className="w-5 h-5 text-slate-600 cursor-pointer hover:text-slate-900 transition" 
                    onClick={onBack}
                  />
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">Folder Persatuan</h1>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setLoadingFolders(true);
                      setTimeout(() => setLoadingFolders(false), 800);
                    }}
                    className="p-1 hover:bg-slate-100 text-slate-600 rounded-full transition"
                    title="Muat semula senarai"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingFolders ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                  <button className="p-1 hover:bg-slate-100 text-slate-600 rounded-full transition">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search & Filter Row - Mockup design */}
              <div className="flex gap-2.5 mb-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-1 focus:ring-slate-200 text-sm text-slate-800 font-medium"
                  />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 font-semibold text-xs transition hover:bg-slate-100">
                  <Filter className="w-4 h-4 text-slate-500" />
                  Filter
                </button>
              </div>

              {/* Last Update Pill Bar - Mockup design */}
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-2 px-6 py-2 border border-slate-100 bg-white rounded-full text-slate-500 shadow-sm text-xs font-semibold">
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loadingFolders ? 'animate-spin' : ''}`} />
                  <span>Last update {lastUpdatedDate}</span>
                </div>
              </div>

              {/* Add Folder Big Button - Mockup design */}
              {canWrite && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#131b26] hover:bg-[#1f2937] text-white rounded-2xl shadow-sm transition duration-150 font-extrabold text-xs mb-6"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Folder
                </button>
              )}

              {/* Folder list header summary - Mockup design */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">Semua Folder</span>
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                    {filteredFolders.length}
                  </span>
                </div>
                <button className="text-slate-400 hover:text-slate-600 transition">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Folders Display Grid */}
              {loadingFolders ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-3xl shadow-sm">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                  <p className="text-slate-500 text-sm font-medium">Memuatkan senarai folder...</p>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 border-dashed rounded-3xl text-center px-4">
                  <Folder className="w-16 h-16 text-slate-300 mb-4 stroke-[1.5]" />
                  <h3 className="font-bold text-slate-700 text-lg">Tiada Folder Dijumpai</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-sm">
                    {searchTerm ? 'Tiada folder yang menepati kata carian anda. Sila cuba kata kunci lain.' : 'Sistem dokumen sekolah belum mempunyai folder. Hubungi urusetia untuk mencipta folder dokumen.'}
                  </p>
                  {canWrite && !searchTerm && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm font-semibold text-sm transition"
                    >
                      <Plus className="w-4 h-4" />
                      Cipta Folder Pertama
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredFolders.map((folder) => {
                    const totalFiles = folder.files?.length || 0;
                    const commentCount = folder.comments?.length || 0;
                    return (
                      <div
                        key={folder.id}
                        className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition duration-200 cursor-pointer relative"
                        onClick={() => setSelectedFolder(folder)}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-3 bg-blue-50/70 border border-blue-100/50 rounded-xl">
                              <Folder className="w-6 h-6 text-blue-500 fill-blue-500/10" />
                            </div>
                            
                            {/* Actions menu button */}
                            {canWrite && (
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setActiveMenuFolderId(activeMenuFolderId === folder.id ? null : folder.id)}
                                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                
                                {activeMenuFolderId === folder.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setActiveMenuFolderId(null)} />
                                    <div className="absolute right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg py-1 w-32 z-20 text-left text-xs font-semibold">
                                      <button
                                        onClick={() => {
                                          setEditFolderId(folder.id);
                                          setEditFolderName(folder.name);
                                          setShowEditModal(true);
                                          setActiveMenuFolderId(null);
                                        }}
                                        className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5 text-slate-700"
                                      >
                                        <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                        Ubah Nama
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteFolder(folder.id, folder.name);
                                          setActiveMenuFolderId(null);
                                        }}
                                        className="w-full px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 border-t border-slate-50"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Padam
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
                            {folder.name}
                          </h3>
                        </div>

                        {/* Folder Bottom Metadata */}
                        <div className="mt-4 pt-3 border-t border-slate-50/60 space-y-1.5 text-[11px] text-slate-500 font-medium">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              {totalFiles} fail
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                              {commentCount} komen
                            </span>
                          </div>
                          <div className="text-slate-400 text-[10px] flex items-center gap-1 truncate">
                            <Clock className="w-3 h-3 text-slate-300 shrink-0" />
                            <span>Dikemas kini: {folder.updatedAt ? new Date(folder.updatedAt.seconds * 1000).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru sahaja'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            /* ================= VIEW 2: FOLDER DETAILS VIEW ================= */
            <motion.div
              key="folder-detail-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              {/* Back to folders and Header - Mockup design */}
              <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <ArrowLeft 
                    className="w-5 h-5 text-slate-600 cursor-pointer hover:text-slate-800 transition" 
                    onClick={() => setSelectedFolder(null)} 
                  />
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">Detail Folder</h1>
                </div>
                
                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  Aktif
                </span>
              </div>

              {/* Google Drive Status inside Folder Detail */}
              {!googleDriveToken ? (
                <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <CloudLightning className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Google Drive Belum Disambung</h4>
                      <p className="text-[11px] text-slate-600">Sambungkan Google Drive untuk memuat naik fail ke folder ini.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    className="shrink-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isConnectingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudLightning className="w-3.5 h-3.5" />}
                    Sambung Drive Sekarang
                  </button>
                </div>
              ) : (
                <div className="mb-4 px-3.5 py-2 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Google Drive Aktif & Sedia untuk Muat Naik
                  </span>
                  <button
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline"
                  >
                    Tukar / Sambung Semula
                  </button>
                </div>
              )}

              {/* Horizontal Action Row below header - Mockup design */}
              <div className="grid grid-cols-5 gap-1 bg-white border border-slate-100 rounded-2xl p-3.5 mb-6 shadow-sm">
                {/* Button 1: Muat Naik */}
                <button
                  onClick={() => {
                    if (!googleDriveToken) {
                      handleConnectDrive().then((token) => {
                        if (token) fileInputRef.current?.click();
                      });
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={isUploadingFile || isConnectingDrive}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 transition text-slate-600 disabled:opacity-50 cursor-pointer"
                  title="Muat naik banyak fail ke folder ini"
                >
                  <div className="p-2.5 bg-blue-50/50 border border-blue-100 text-blue-600 rounded-xl mb-1.5">
                    {isUploadingFile || isConnectingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-bold tracking-tight">Muat Naik</span>
                </button>

                {/* Button 2: Edit */}
                <button
                  onClick={() => {
                    setEditFolderId(selectedFolder.id);
                    setEditFolderName(selectedFolder.name);
                    setShowEditModal(true);
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 transition text-slate-600 cursor-pointer"
                >
                  <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl mb-1.5">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight">Edit</span>
                </button>

                {/* Button 3: Padam */}
                <button
                  onClick={() => handleDeleteFolder(selectedFolder.id, selectedFolder.name)}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-rose-50/50 transition text-rose-600 cursor-pointer"
                >
                  <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl mb-1.5">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight">Padam</span>
                </button>

                {/* Button 4: Lampiran */}
                <button
                  onClick={() => {
                    if (!googleDriveToken) {
                      handleConnectDrive().then((token) => {
                        if (token) fileInputRef.current?.click();
                      });
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={isUploadingFile || isConnectingDrive}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 transition text-slate-600 disabled:opacity-50 cursor-pointer"
                  title="Muat naik fail lampiran (Multi-upload)"
                >
                  <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl mb-1.5">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight">Lampiran</span>
                </button>

                {/* Button 5: Lagi */}
                <button
                  onClick={() => {
                    showToast("Status folder ini: Aktif & Disegerakkan bersama Google Drive.", "info");
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 transition text-slate-600 cursor-pointer"
                >
                  <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl mb-1.5">
                    <MoreVertical className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight">Lagi</span>
                </button>
              </div>

              {/* Hidden multi-file input - supports any format */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileInputChange} 
                multiple
                className="hidden" 
              />

              {/* Folder Main Card - Mockup design */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-6 shadow-sm flex items-center gap-4">
                <div className="p-4 bg-blue-50 border border-blue-100/50 rounded-2xl shrink-0">
                  <Folder className="w-8 h-8 text-blue-600 fill-blue-500/10" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-extrabold text-slate-900 truncate leading-tight">
                    {selectedFolder.name}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-1 leading-none">
                    {selectedFolder.files?.length || 0} fail • {selectedFolder.comments?.length || 0} komen
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                    Dikemas kini: {selectedFolder.updatedAt ? new Date(selectedFolder.updatedAt.seconds * 1000).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru sahaja'} oleh {selectedFolder.updatedBy || 'Admin'}
                  </p>
                </div>
              </div>

              {/* Multi-upload Queue & Progress Card */}
              {(isUploadingFile || uploadQueue.length > 0) && (
                <div className="mb-6 p-4 bg-white border border-blue-200/80 rounded-2xl shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {isUploadingFile ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      <span className="text-xs font-bold text-slate-800">
                        {isUploadingFile 
                          ? `Memuat naik ${uploadQueue.filter(q => q.status === 'success').length + 1} daripada ${uploadQueue.length} fail...` 
                          : `Selesai muat naik (${uploadSummary?.success || 0}/${uploadSummary?.total || uploadQueue.length} fail berjaya)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-600">
                        {uploadProgress}%
                      </span>
                      {!isUploadingFile && (
                        <button
                          onClick={() => {
                            setUploadQueue([]);
                            setUploadSummary(null);
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition"
                          title="Tutup senarai muat naik"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isUploadingFile ? 'bg-blue-600' : 'bg-emerald-600'
                      }`} 
                      style={{ width: `${uploadProgress}%` }} 
                    />
                  </div>

                  {/* Files Queue List */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1 pr-1">
                    {uploadQueue.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="shrink-0">
                            {getFileIcon('', item.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate text-[11px]" title={item.name}>
                              {item.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-medium">
                              {formatBytes(item.size)}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {item.status === 'uploading' && (
                            <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Memuat naik...
                            </span>
                          )}
                          {item.status === 'success' && (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" />
                              Berjaya
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1" title={item.error}>
                              <AlertCircle className="w-3 h-3" />
                              {item.error || 'Gagal'}
                            </span>
                          )}
                          {item.status === 'pending' && (
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Menunggu
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Content Layout Split: LEFT: Files, RIGHT: Details/Comments/Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* COLUMN LEFT: FILES SECTION (7 cols on lg) with Drag & Drop */}
                <div 
                  onDragEnter={canWrite ? handleDragEnter : undefined}
                  onDragOver={canWrite ? handleDragOver : undefined}
                  onDragLeave={canWrite ? handleDragLeave : undefined}
                  onDrop={canWrite ? handleDrop : undefined}
                  className={`lg:col-span-7 bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[460px] relative transition-all duration-200 ${
                    isDraggingOver ? 'border-blue-500 ring-4 ring-blue-100 bg-blue-50/20' : 'border-slate-100'
                  }`}
                >
                  {/* Drag Over Overlay */}
                  {isDraggingOver && (
                    <div className="absolute inset-0 bg-blue-50/95 backdrop-blur-[2px] border-2 border-dashed border-blue-500 rounded-2xl z-30 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                      <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-3 animate-bounce">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-extrabold text-blue-900 mb-1">
                        Lepaskan fail di sini untuk memuat naik
                      </h4>
                      <p className="text-xs text-blue-700 font-semibold max-w-sm">
                        Menyokong pelbagai fail serentak (Multi-Upload) • Apa-apa format fail disokong
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                        Fail dalam folder
                        {selectedFolder.files && selectedFolder.files.length > 0 && (
                          <span className="bg-slate-100 text-slate-600 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                            {selectedFolder.files.length}
                          </span>
                        )}
                      </h3>
                      {canWrite && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingFile}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tambah Fail (Multi-Upload)
                        </button>
                      )}
                    </div>

                    {(!selectedFolder.files || selectedFolder.files.length === 0) ? (
                      /* Empty State Dropzone */
                      <div 
                        onClick={() => canWrite && fileInputRef.current?.click()}
                        className={`py-14 px-6 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-2xl transition-all duration-200 ${
                          canWrite 
                            ? 'border-blue-300 hover:border-blue-500 bg-blue-50/20 hover:bg-blue-50/50 cursor-pointer group' 
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="w-16 h-16 bg-blue-100/70 border border-blue-200 text-blue-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition duration-200 shadow-xs">
                          <UploadCloud className="w-8 h-8" />
                        </div>
                        <h4 className="font-extrabold text-slate-800 text-sm mb-1 group-hover:text-blue-600 transition">
                          Seret & Lepas Fail Di Sini
                        </h4>
                        <p className="text-slate-500 text-xs max-w-xs leading-relaxed mb-4">
                          atau <span className="text-blue-600 font-bold underline">klik untuk pilih fail</span> dari komputer / telefon anda
                        </p>
                        <div className="flex items-center gap-2 flex-wrap justify-center mb-4 max-w-md">
                          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 shadow-2xs">
                            Pelbagai Fail (Multi-Upload)
                          </span>
                          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 shadow-2xs">
                            Semua Format Disokong (PDF, DOCX, XLSX, Imej, Video, Arkib, dll.)
                          </span>
                          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 shadow-2xs">
                            Maksimum 50MB setiap fail
                          </span>
                        </div>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            Pilih Fail untuk Muat Naik
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Compact Dropzone Strip above existing files */}
                        {canWrite && (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/40 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition group"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white border border-slate-200 text-blue-600 rounded-lg group-hover:scale-105 transition shadow-2xs">
                                <UploadCloud className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700 group-hover:text-blue-700 transition">
                                  Seret & lepas fail ke sini atau <span className="text-blue-600 underline">klik untuk tambah fail</span>
                                </p>
                                <p className="text-[10px] text-slate-400 font-semibold">
                                  Boleh muat naik banyak fail serentak (Multi-upload) • Apa-apa format fail disokong
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shrink-0 shadow-2xs flex items-center gap-1 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Pilih Fail
                            </button>
                          </div>
                        )}

                        {/* Existing Files List */}
                        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                          {selectedFolder.files.map((file) => {
                            const badgeColorClass = getFileBadgeColor(file.mimeType, file.name);
                            const badgeLabel = getFileBadgeLabel(file.mimeType, file.name);

                            return (
                              <div
                                key={file.id}
                                className="group p-3 border border-slate-100 hover:border-slate-200 bg-white rounded-xl transition duration-150 flex items-center justify-between gap-4 shadow-2xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`shrink-0 p-2 border rounded-xl group-hover:scale-105 transition duration-200 ${badgeColorClass}`}>
                                    {getFileIcon(file.mimeType, file.name)}
                                  </div>
                                  
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-slate-800 truncate leading-tight group-hover:text-blue-700 transition" title={file.name}>
                                      {file.name}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1.5 flex-wrap leading-none">
                                      <span className={`px-1.5 py-0.5 rounded font-black text-[9px] ${badgeColorClass}`}>
                                        {badgeLabel}
                                      </span>
                                      <span>{formatBytes(file.size)}</span>
                                      <span>• Dimuat naik oleh {file.uploadedBy || 'Admin'}</span>
                                    </p>
                                  </div>
                                </div>

                                {/* Options Button / Download */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <a
                                    href={file.driveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition shadow-sm border border-slate-100"
                                    title="Lihat/Muat turun fail dari Google Drive"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                  {canWrite && (
                                    <button
                                      onClick={() => handleDeleteFile(file.id, file.name)}
                                      className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition border border-slate-100 cursor-pointer"
                                      title="Padam fail"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Attachment notice inside Drive details */}
                  <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-2">
                      <CloudLightning className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Integrasi Drive aktif • Drag & Drop dan Multi-Upload aktif (semua format).</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">Max 50MB / fail</span>
                  </div>
                </div>

                {/* COLUMN RIGHT: INTERACTION / DISCUSSIONS (5 cols on lg) */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden">
                  
                  {/* Dynamic Tabs Navigation */}
                  <div>
                    <div className="flex border-b border-slate-200">
                      <button
                        onClick={() => setActiveTab('komen')}
                        className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition relative ${
                          activeTab === 'komen' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Komen
                        {selectedFolder.comments?.length > 0 && (
                          <span className="ml-1.5 bg-orange-100 text-orange-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                            {selectedFolder.comments.length}
                          </span>
                        )}
                        {activeTab === 'komen' && (
                          <motion.div layoutId="active-doc-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('butiran')}
                        className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition relative ${
                          activeTab === 'butiran' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Butiran
                        {activeTab === 'butiran' && (
                          <motion.div layoutId="active-doc-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('aktiviti')}
                        className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition relative ${
                          activeTab === 'aktiviti' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Aktiviti
                        {activeTab === 'aktiviti' && (
                          <motion.div layoutId="active-doc-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />
                        )}
                      </button>
                    </div>

                    <div className="p-5">
                      
                      {/* SUBSECTION 1: DISCUSSIONS (Komen) */}
                      {activeTab === 'komen' && (
                        <div className="space-y-4">
                          {selectedFolder.comments.length === 0 ? (
                            <div className="py-12 text-center">
                              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.5]" />
                              <h4 className="font-bold text-slate-700 text-xs">Tiada Komen Utama</h4>
                              <p className="text-slate-400 text-[11px] mt-1 leading-relaxed max-w-[200px] mx-auto">
                                Sila mulakan perbincangan atau tinggalkan nota rujukan bagi fail dalam folder ini.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                              {selectedFolder.comments.map((comment) => (
                                <div key={comment.id} className="space-y-3">
                                  {/* Main Parent Comment */}
                                  <div className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <img
                                      src={comment.authorAvatar}
                                      alt={comment.authorName}
                                      referrerPolicy="no-referrer"
                                      className="w-8 h-8 rounded-full bg-slate-200 shrink-0 border border-slate-200"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-xs text-slate-900 truncate">
                                            {comment.authorName}
                                          </span>
                                          <span className="bg-slate-200 text-slate-600 font-extrabold text-[8px] px-1 py-0.5 rounded leading-none uppercase">
                                            {comment.authorRole}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[9px] text-slate-400 font-semibold shrink-0">
                                            {comment.timestamp}
                                          </span>
                                          {(canWrite || currentUserDoc?.displayName === comment.authorName) && (
                                            <button
                                              onClick={() => handleDeleteCommentThread(comment.id)}
                                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-600 transition"
                                              title="Padam ulasan"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs text-slate-700 font-medium leading-relaxed mt-1 whitespace-pre-wrap">
                                        {comment.content}
                                      </p>
                                      
                                      {/* Reply trigger button */}
                                      <div className="mt-2 flex items-center gap-1.5">
                                        <button
                                          onClick={() => {
                                            setReplyToId(replyToId === comment.id ? null : comment.id);
                                            setNewReplyText('');
                                          }}
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 hover:text-orange-700"
                                        >
                                          <Send className="w-2.5 h-2.5 rotate-45" />
                                          Balas
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Replies Flow (Sub-elements) */}
                                  {comment.replies && comment.replies.length > 0 && (
                                    <div className="pl-6 space-y-2 border-l-2 border-slate-200 ml-4">
                                      {comment.replies.map((reply) => (
                                        <div key={reply.id} className="flex gap-2.5 items-start bg-white p-2.5 rounded-lg border border-slate-100">
                                          <img
                                            src={reply.authorAvatar}
                                            alt={reply.authorName}
                                            referrerPolicy="no-referrer"
                                            className="w-6 h-6 rounded-full bg-slate-200 shrink-0 border border-slate-200"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-1 truncate">
                                                <span className="font-bold text-[11px] text-slate-800 truncate">
                                                  {reply.authorName}
                                                </span>
                                                <span className="bg-slate-100 text-slate-500 font-bold text-[7px] px-1 py-0.5 rounded uppercase leading-none">
                                                  {reply.authorRole}
                                                </span>
                                              </div>
                                              <span className="text-[8px] text-slate-400 font-medium shrink-0">
                                                {reply.timestamp}
                                              </span>
                                            </div>
                                            <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
                                              {reply.content}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Inline Reply Form */}
                                  {replyToId === comment.id && (
                                    <div className="pl-6 ml-4 border-l-2 border-orange-200 flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="Tulis balasan ulasan..."
                                        value={newReplyText}
                                        onChange={(e) => setNewReplyText(e.target.value)}
                                        disabled={submittingReplyId === comment.id}
                                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 disabled:opacity-50"
                                      />
                                      <button
                                        onClick={() => handleAddReply(comment.id)}
                                        disabled={!newReplyText.trim() || submittingReplyId === comment.id}
                                        className="px-2.5 bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 justify-center hover:bg-orange-700 transition"
                                      >
                                        {submittingReplyId === comment.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                        Hantar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUBSECTION 2: DETAILS (Butiran) */}
                      {activeTab === 'butiran' && (
                        <div className="space-y-4 text-xs text-slate-600 font-semibold">
                          <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3">
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                              <span className="text-slate-400">Nama Folder</span>
                              <span className="text-slate-800 font-bold">{selectedFolder.name}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                              <span className="text-slate-400">Google Drive ID</span>
                              <span className="text-slate-800 font-bold font-mono truncate max-w-[150px]" title={selectedFolder.driveFolderId || 'Belum Dijana'}>
                                {selectedFolder.driveFolderId || 'Tiada'}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                              <span className="text-slate-400">Status Folder</span>
                              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded">
                                {selectedFolder.status}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                              <span className="text-slate-400">Diwujudkan</span>
                              <span className="text-slate-800 font-bold">
                                {selectedFolder.createdAt?.toDate().toLocaleString('ms-MY') || 'Sekarang'}
                              </span>
                            </div>
                            <div className="flex justify-between pb-1">
                              <span className="text-slate-400">Dikemaskini oleh</span>
                              <span className="text-slate-800 font-bold">{selectedFolder.updatedBy || 'Sistem Admin'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SUBSECTION 3: ACTIVITIES (Aktiviti) */}
                      {activeTab === 'aktiviti' && (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          <div className="p-3 border border-slate-150 bg-slate-50 rounded-xl flex items-start gap-2.5">
                            <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-slate-700 leading-snug">Folder "{selectedFolder.name}" aktif</p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-1">Sistem dokumen sedia digunakan.</p>
                            </div>
                          </div>
                          {selectedFolder.files && selectedFolder.files.length > 0 && (
                            <div className="p-3 border border-slate-150 bg-slate-50 rounded-xl flex items-start gap-2.5">
                              <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-slate-700 leading-snug">Fail dokumen dimuat naik</p>
                                <p className="text-[10px] text-slate-400 font-semibold mt-1">Terakhir pada {new Date(selectedFolder.files[selectedFolder.files.length - 1].uploadedAt).toLocaleString('ms-MY')}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Comments Input Box (Only show when tab is 'komen' and single parent comment doesn't exist yet, or we let them reply) */}
                  {activeTab === 'komen' && (
                    <div className="p-4 border-t border-slate-150 bg-slate-50/50">
                      <form onSubmit={handleAddComment} className="flex gap-2">
                        <img
                          src={currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100"}
                          alt="Avatar"
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full bg-slate-200 shrink-0 border border-slate-200"
                        />
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder={selectedFolder.comments.length > 0 ? "Gunakan butang Reply untuk membalas ulasan..." : "Tulis komen utama..."}
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            disabled={selectedFolder.comments.length > 0 || isSubmittingComment}
                            className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                          <button
                            type="submit"
                            disabled={!newCommentText.trim() || selectedFolder.comments.length > 0 || isSubmittingComment}
                            className="absolute right-1.5 top-1.5 p-1 text-slate-400 hover:text-orange-600 disabled:text-slate-300 transition"
                          >
                            {isSubmittingComment ? (
                              <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                            ) : (
                              <Send className="w-4 h-4 rotate-45" />
                            )}
                          </button>
                        </div>
                      </form>
                      {selectedFolder.comments.length > 0 && (
                        <p className="text-[9px] text-slate-400 font-bold mt-1 text-center">
                          Akaun dihadkan kepada satu komen perbincangan utama bagi setiap folder.
                        </p>
                      )}
                    </div>
                  )}

                </div>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ================= MODAL 1: ADD FOLDER ================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white border border-slate-100 rounded-2xl p-6 w-full max-w-md shadow-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-1.5">
                <Folder className="w-5 h-5 text-blue-600" />
                Tambah Folder Baru
              </h3>
              <button 
                onClick={() => {
                  setNewFolderName('');
                  setShowAddModal(false);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFolder} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nama Folder</label>
                <input
                  type="text"
                  placeholder="Contoh: Minit Mesyuarat 2026"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
                  required
                />
              </div>

              {!googleDriveToken && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2.5 items-start">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-600 leading-snug">
                    Anda belum menyambungkan Google Drive. Folder akan disimpan dalam database Firestore sahaja secara lalai.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 justify-end">
                <button
                  type="button"
                  disabled={isSubmittingFolder}
                  onClick={() => {
                    setNewFolderName('');
                    setShowAddModal(false);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 font-semibold text-xs rounded-xl transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFolder || !newFolderName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  {isSubmittingFolder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmittingFolder ? 'Mencipta...' : 'Cipta Folder'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= MODAL 2: EDIT FOLDER ================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white border border-slate-100 rounded-2xl p-6 w-full max-w-md shadow-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-blue-600" />
                Ubah Nama Folder
              </h3>
              <button 
                onClick={() => {
                  setEditFolderName('');
                  setEditFolderId(null);
                  setShowEditModal(false);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditFolder} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nama Folder Baru</label>
                <input
                  type="text"
                  placeholder="Contoh: Minit Mesyuarat Penuh 2026"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2 justify-end">
                <button
                  type="button"
                  disabled={isEditingFolder}
                  onClick={() => {
                    setEditFolderName('');
                    setEditFolderId(null);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 font-semibold text-xs rounded-xl transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isEditingFolder || !editFolderName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  {isEditingFolder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Kemas Kini
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= MODAL 3: CONFIRM DELETE ================= */}
      <AnimatePresence>
        {confirmDelete && confirmDelete.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-100 rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-full text-rose-600">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {confirmDelete.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {confirmDelete.message}
                </p>
              </div>

              <div className="flex items-center gap-3 mt-6 justify-center">
                <button
                  type="button"
                  disabled={isDeletingInModal}
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition w-1/2 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingInModal}
                  onClick={handleConfirmDeleteClick}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-sm transition w-1/2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingInModal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Padam
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
