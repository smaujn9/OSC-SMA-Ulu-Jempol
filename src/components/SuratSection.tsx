import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Download, 
  History, 
  PenTool, 
  Check, 
  Loader2, 
  Eye, 
  Search, 
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
  Upload,
  RefreshCw,
  Sparkles,
  Edit,
  Table as TableIcon
} from 'lucide-react';

interface ParagraphTable {
  headers: string[];
  rows: string[][];
}

interface OfficialLetter {
  id?: string;
  noRujukan: string;
  tarikh: string;
  penerimaNama: string;
  penerimaJawatan: string;
  penerimaAlamat: string;
  tajuk: string;
  kandungan: string[];
  slogan: string;
  pengirimNama: string;
  pengirimJawatan: string;
  pdfUrl: string;
  signatureUrl?: string;
  createdAt?: any;
  createdByEmail: string;
  createdByNama: string;
  tables?: (ParagraphTable | null)[];
  tablesJson?: string;
}

function splitTextForNumberedParagraph(pdf: jsPDF, text: string, w1: number, w2: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? currentLine + " " + word : word;
    const currentLimit = lines.length === 0 ? w1 : w2;
    
    if (pdf.getTextWidth(testLine) <= currentLimit) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word);
        currentLine = "";
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function drawJustifiedLine(pdf: jsPDF, line: string, x: number, y: number, width: number) {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    pdf.text(line, x, y);
    return;
  }
  
  const totalWordsWidth = words.reduce((sum, word) => sum + pdf.getTextWidth(word), 0);
  const totalGapWidth = width - totalWordsWidth;
  const singleGapWidth = totalGapWidth / (words.length - 1);
  
  let currentX = x;
  words.forEach((word) => {
    pdf.text(word, currentX, y);
    currentX += pdf.getTextWidth(word) + singleGapWidth;
  });
}

export default function SuratSection({ isMobile = false, onBack }: { isMobile?: boolean; onBack?: () => void }) {
  const { currentUserDoc, allUsers, loginWithGoogle } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  
  // State variables for form
  const [noRujukan, setNoRujukan] = useState('');
  const [tarikh, setTarikh] = useState('');
  const [penerimaNama, setPenerimaNama] = useState('');
  const [penerimaJawatan, setPenerimaJawatan] = useState('');
  const [penerimaAlamat, setPenerimaAlamat] = useState('');
  const [tajuk, setTajuk] = useState('');
  const [perenggan, setPerenggan] = useState<string[]>(['']);
  const [paragraphTables, setParagraphTables] = useState<(ParagraphTable | null)[]>([null]);
  const [slogan, setSlogan] = useState('“BERKHIDMAT UNTUK MASYARAKAT”');
  const [pengirimNama, setPengirimNama] = useState('');
  const [pengirimJawatan, setPengirimJawatan] = useState('');
  
  // Signature States
  const [signatureMode, setSignatureMode] = useState<'saved' | 'draw'>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  
  // Statuses
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<OfficialLetter[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Deletion Confirmation States
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // AI Generation States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Letterhead Image URL
  const letterheadUrl = '/api/letterhead';
  const directLetterheadUrl = '/api/letterhead';
  const [letterheadBase64, setLetterheadBase64] = useState<string | null>(null);
  const [isLoadingLetterhead, setIsLoadingLetterhead] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-fill sender info on load
  useEffect(() => {
    if (currentUserDoc) {
      setPengirimNama(currentUserDoc.displayName || currentUserDoc.nickname || '');
      setPengirimJawatan(currentUserDoc.role || '');
      
      // Auto generate reference suggestion
      const year = new Date().getFullYear();
      setNoRujukan(`SMAUJ/${year}/${Math.floor(100 + Math.random() * 900)}`);
      
      // Auto-set Date to Malay format
      const months = [
        'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
        'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
      ];
      const today = new Date();
      setTarikh(`${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`);
      
      // Check for saved signature
      if (currentUserDoc.signatureUrl) {
        setSignatureMode('saved');
        setSignatureDataUrl(currentUserDoc.signatureUrl);
      }
    }
  }, [currentUserDoc]);

  // Load Letterhead on Init
  useEffect(() => {
    const fetchLetterhead = async () => {
      setIsLoadingLetterhead(true);
      try {
        // Try fetching direct as blob first (best CORS handling)
        const res = await fetch(letterheadUrl);
        if (!res.ok) throw new Error("Proxy response not OK");
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLetterheadBase64(reader.result as string);
          setIsLoadingLetterhead(false);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn("Fetch letterhead failed, trying HTML Image element fallback:", err);
        // Fallback to Image tag loading
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = directLetterheadUrl;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              setLetterheadBase64(canvas.toDataURL('image/png'));
            }
            setIsLoadingLetterhead(false);
          };
          img.onerror = () => {
            console.error("Fallback image tag also failed to load letterhead.");
            setIsLoadingLetterhead(false);
          };
        } catch (e) {
          console.error("Error setting up image canvas:", e);
          setIsLoadingLetterhead(false);
        }
      }
    };
    fetchLetterhead();
  }, []);

  // Load History
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const q = query(collection(db, 'surat_rasmi'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const docsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OfficialLetter[];
      setHistory(docsData);
    } catch (err) {
      console.error("Gagal mendapatkan rekod sejarah:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Generate Official Letter Draft with AI helper
  const handleGenerateDraftWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInstruction.trim()) {
      setAiError('Sila masukkan butiran atau arahan surat.');
      return;
    }

    setIsAiGenerating(true);
    setAiError(null);

    try {
      const response = await fetch('/api/surat/generate-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instruction: aiInstruction,
          pengirimNama: pengirimNama,
          pengirimJawatan: pengirimJawatan,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal menjana surat daripada pelayan AI.');
      }

      const data = await response.json();

      if (data) {
        if (data.penerimaNama) setPenerimaNama(data.penerimaNama);
        if (data.penerimaJawatan) setPenerimaJawatan(data.penerimaJawatan);
        if (data.penerimaAlamat) setPenerimaAlamat(data.penerimaAlamat);
        if (data.tajuk) setTajuk(data.tajuk);
        if (data.perenggan && Array.isArray(data.perenggan)) {
          setPerenggan(data.perenggan);
        }
        if (data.slogan) setSlogan(data.slogan);
        if (data.pengirimNama) setPengirimNama(data.pengirimNama);
        if (data.pengirimJawatan) setPengirimJawatan(data.pengirimJawatan);

        setSuccessMsg('Surat rasmi berjaya dijana dengan bantuan AI! Sila semak dan buat pelarasan yang perlu.');
        setIsAiModalOpen(false);
        setAiInstruction('');
        
        setTimeout(() => setSuccessMsg(null), 7000);
      }
    } catch (err: any) {
      console.error('Error generating AI draft:', err);
      setAiError(err.message || 'Ralat semasa menjana draf surat.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#1e3a8a'; // dark blue
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      // Prevent scrolling while drawing on mobile
      if (e.cancelable) e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    // Auto-save drew content to local state data URL
    const canvas = canvasRef.current;
    if (canvas) {
      const empty = isCanvasEmpty(canvas);
      if (!empty) {
        setSignatureDataUrl(canvas.toDataURL('image/png'));
      }
    }
  };

  const isCanvasEmpty = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) return true;
    const buffer = new Uint32Array(
      context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  // Handle saving signature permanently to user profile
  const saveSignaturePermanently = async () => {
    if (!signatureDataUrl || !currentUserDoc?.uid) return;
    setIsSavingSignature(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      // Upload signature to Storage
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      const storageRef = ref(storage, `signatures/user_${currentUserDoc.uid}_${Date.now()}.png`);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // Save URL inside Firestore User document
      await updateDoc(doc(db, 'users', currentUserDoc.uid), {
        signatureUrl: downloadUrl
      });

      setSuccessMsg("Tandatangan anda telah disimpan sebagai profil tetap!");
      setSignatureDataUrl(downloadUrl);
      setSignatureMode('saved');
    } catch (err) {
      console.error("Gagal simpan tandatangan:", err);
      setErrorMsg("Gagal menyimpan tandatangan digital.");
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Add / Remove body paragraphs
  const addParagraph = () => {
    setPerenggan(prev => [...prev, '']);
    setParagraphTables(prev => [...prev, null]);
  };

  const removeParagraph = (index: number) => {
    if (perenggan.length === 1) return;
    setPerenggan(prev => prev.filter((_, i) => i !== index));
    setParagraphTables(prev => prev.filter((_, i) => i !== index));
  };

  const handleParagraphChange = (index: number, val: string) => {
    setPerenggan(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  // Initialize a default table for a paragraph
  const handleAddTable = (paraIdx: number) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      copy[paraIdx] = {
        headers: ['Bil', 'Butiran', 'Kuantiti', 'Jumlah (RM)'],
        rows: [['1', 'Sewa Khemah', '2', '200.00']]
      };
      return copy;
    });
  };

  // Remove the table from a paragraph
  const handleRemoveTable = (paraIdx: number) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      copy[paraIdx] = null;
      return copy;
    });
  };

  // Update headers of a paragraph table
  const handleUpdateHeader = (paraIdx: number, headerIdx: number, val: string) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      const table = copy[paraIdx];
      if (table) {
        const headersCopy = [...table.headers];
        headersCopy[headerIdx] = val;
        copy[paraIdx] = { ...table, headers: headersCopy };
      }
      return copy;
    });
  };

  // Add a column to a paragraph table
  const handleAddColumn = (paraIdx: number) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      const table = copy[paraIdx];
      if (table) {
        const headersCopy = [...table.headers, `Lajur ${table.headers.length + 1}`];
        const rowsCopy = table.rows.map(row => [...row, '']);
        copy[paraIdx] = { headers: headersCopy, rows: rowsCopy };
      }
      return copy;
    });
  };

  // Remove a column from a paragraph table
  const handleRemoveColumn = (paraIdx: number, headerIdx: number) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      const table = copy[paraIdx];
      if (table && table.headers.length > 1) {
        const headersCopy = table.headers.filter((_, idx) => idx !== headerIdx);
        const rowsCopy = table.rows.map(row => row.filter((_, idx) => idx !== headerIdx));
        copy[paraIdx] = { headers: headersCopy, rows: rowsCopy };
      }
      return copy;
    });
  };

  // Update row cell value of a paragraph table
  const handleUpdateCell = (paraIdx: number, rowIdx: number, colIdx: number, val: string) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      const table = copy[paraIdx];
      if (table) {
        const rowsCopy = table.rows.map((row, rIdx) => {
          if (rIdx === rowIdx) {
            const rowCopy = [...row];
            rowCopy[colIdx] = val;
            return rowCopy;
          }
          return row;
        });
        copy[paraIdx] = { ...table, rows: rowsCopy };
      }
      return copy;
    });
  };

  // Add a row to a paragraph table
  const handleAddRow = (paraIdx: number) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      const table = copy[paraIdx];
      if (table) {
        const newRow = Array(table.headers.length).fill('');
        copy[paraIdx] = { ...table, rows: [...table.rows, newRow] };
      }
      return copy;
    });
  };

  // Remove a row from a paragraph table
  const handleRemoveRow = (paraIdx: number, rowIdx: number) => {
    setParagraphTables(prev => {
      const copy = [...prev];
      const table = copy[paraIdx];
      if (table && table.rows.length > 1) {
        const rowsCopy = table.rows.filter((_, idx) => idx !== rowIdx);
        copy[paraIdx] = { ...table, rows: rowsCopy };
      }
      return copy;
    });
  };

  // Generate Letter PDF
  const generatePDF = async (): Promise<jsPDF | null> => {
    if (!noRujukan || !penerimaNama || !penerimaAlamat || !tajuk || !pengirimNama || !pengirimJawatan) {
      setErrorMsg("Sila isi semua maklumat mandatori (*).");
      return null;
    }
    if (!signatureDataUrl) {
      setErrorMsg("Sila turunkan tandatangan digital anda terlebih dahulu.");
      return null;
    }

    try {
      const renderWithScale = async (scale: number): Promise<jsPDF> => {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        // Page width: 210mm, Margin: 15mm on left and right => Content width = 180mm
        // 1. Draw Letterhead image aligned with body text margins (sebaris kiri & kanan dengan teks di bawah)
        const contentLeftX = 15;
        const contentWidth = 180;
        const letterheadY = 5;
        let currentY = 55;

        if (letterheadBase64) {
          // Default proportional height: 2048 x 581 px => (581 / 2048) * 180mm = 51.06mm
          let letterheadHeight = 51.06;
          try {
            const imgProps = pdf.getImageProperties(letterheadBase64);
            if (imgProps && imgProps.width > 0 && imgProps.height > 0) {
              letterheadHeight = (imgProps.height * contentWidth) / imgProps.width;
            }
          } catch (e) {
            console.warn("Could not read letterhead image properties:", e);
          }
          pdf.addImage(letterheadBase64, 'PNG', contentLeftX, letterheadY, contentWidth, letterheadHeight);
          currentY = letterheadY + letterheadHeight + 6 * scale;
        } else {
          // Text Fallback Header in case of load failure
          pdf.setFont('Helvetica', 'Bold');
          pdf.setFontSize(14 * scale);
          pdf.setTextColor(6, 95, 70); // emerald-800
          pdf.text("SEKOLAH MENENGAH AGAMA ULU JEMPOL", 105, 18, { align: 'center' });
          pdf.setFont('Helvetica', 'Normal');
          pdf.setFontSize(9 * scale);
          pdf.setTextColor(100, 116, 139);
          pdf.text("Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan Darul Khusus", 105, 23, { align: 'center' });
          pdf.setDrawColor(6, 95, 70);
          pdf.setLineWidth(1);
          pdf.line(contentLeftX, 28, contentLeftX + contentWidth, 28);
          currentY = 36 * scale;
        }
        
        pdf.setFont('Helvetica', 'Normal');
        pdf.setFontSize(10.5 * scale);
        pdf.setTextColor(30, 41, 59); // slate-800

        // 2. Reference, Date and Recipient Block (Aligned/Selari horizontally in Malay standard)
        const refText = `Ruj. Kami: ${noRujukan}`;
        const dateText = `Tarikh: ${tarikh}`;
        
        // 1st row: Left: Recipient Name, Right: Ruj. Kami (aligned at the same Y)
        pdf.setFont('Helvetica', 'Bold');
        pdf.text(penerimaNama, 15, currentY);
        pdf.text(refText, 195, currentY, { align: 'right' });
        
        // Increment currentY to the 2nd row
        currentY += 5 * scale;
        
        // 2nd row: Left: Recipient Jawatan (or start of address if no jawatan), Right: Tarikh (aligned at the same Y)
        pdf.setFont('Helvetica', 'Bold');
        pdf.text(dateText, 195, currentY, { align: 'right' });
        
        if (penerimaJawatan) {
          pdf.setFont('Helvetica', 'Normal');
          pdf.text(penerimaJawatan, 15, currentY);
          currentY += 5 * scale;
          
          pdf.setFont('Helvetica', 'Normal');
          const addressLines = pdf.splitTextToSize(penerimaAlamat, 110);
          addressLines.forEach((line: string) => {
            pdf.text(line, 15, currentY);
            currentY += 5 * scale;
          });
        } else {
          pdf.setFont('Helvetica', 'Normal');
          const addressLines = pdf.splitTextToSize(penerimaAlamat, 110);
          addressLines.forEach((line: string) => {
            pdf.text(line, 15, currentY);
            currentY += 5 * scale;
          });
        }

        currentY += 5 * scale;

        // 4. Salutation
        pdf.text("Tuan,", 15, currentY);
        currentY += 8 * scale;

        // 5. Subject / Title (Bold, Uppercase, No underline as requested)
        pdf.setFont('Helvetica', 'Bold');
        pdf.setFontSize(10.5 * scale);
        const uppercaseTajuk = tajuk.toUpperCase();
        const splitTajuk = pdf.splitTextToSize(uppercaseTajuk, 180);
        
        splitTajuk.forEach((line: string) => {
          pdf.text(line, 15, currentY);
          currentY += 6 * scale;
        });

        currentY += 4 * scale;

        // 6. Body Paragraphs
        pdf.setFont('Helvetica', 'Normal');
        
        perenggan.forEach((para, idx) => {
          // Malay letters: First paragraph has no numbering.
          // Second and subsequent paragraphs are prefixed with "2. ", "3. " etc.
          // The last paragraph of the letter does not have a number.
          const isLastPara = idx === perenggan.length - 1;
          const hasNumber = idx > 0 && !(isLastPara && perenggan.length > 1);
          
          let formattedText = para;
          let prefix = "";
          
          if (hasNumber) {
            prefix = `${idx + 1}. `;
          }
          
          pdf.setFont('Helvetica', 'Normal');
          pdf.setFontSize(10.5 * scale);
          
          // Print paragraph with indented first line for all paragraphs (Malay letter format)
          // First line is shorter (170mm width) to fit the 10mm indentation (starts at 25mm instead of 15mm)
          const splitPara = splitTextForNumberedParagraph(pdf, formattedText, 170, 180);
          
          if (hasNumber) {
            pdf.setFont('Helvetica', 'Bold');
            pdf.text(prefix, 15, currentY);
          }
          
          pdf.setFont('Helvetica', 'Normal');
          
          splitPara.forEach((line: string, lineIdx: number) => {
            // Check for overflow - add page if needed
            if (currentY > 265) {
              pdf.addPage();
              currentY = 25; // start high on new page
            }
            // The first line of ALL paragraphs is indented to start at 25mm (jarak seperti mana perenggan ke2)
            const currentStartX = (lineIdx === 0) ? 25 : 15;
            const currentWidth = (lineIdx === 0) ? 170 : 180;
            const isLastLine = lineIdx === splitPara.length - 1;

            if (isLastLine) {
              pdf.text(line, currentStartX, currentY);
            } else {
              drawJustifiedLine(pdf, line, currentStartX, currentY, currentWidth);
            }
            currentY += 5.5 * scale;
          });
          
          // Render table below this paragraph if configured
          const table = paragraphTables[idx];
          if (table) {
            // Ensure there is enough space on page, otherwise push table to new page
            if (currentY > 245) {
              pdf.addPage();
              currentY = 25;
            }
            
            autoTable(pdf, {
              startY: currentY,
              head: [table.headers],
              body: table.rows,
              theme: 'grid',
              styles: { 
                fontSize: 8.5 * scale, 
                cellPadding: 1.8 * scale,
                font: 'Helvetica',
                textColor: [51, 65, 85] // slate-700
              },
              headStyles: { 
                fillColor: [79, 70, 229], // Indigo 600
                textColor: [255, 255, 255],
                fontStyle: 'bold'
              },
              margin: { left: 15, right: 15 },
            });
            
            currentY = (pdf as any).lastAutoTable.finalY + 5 * scale;
          } else {
            currentY += 4 * scale; // gap between paragraphs
          }
        });

        currentY += 2 * scale;

        // 7. Slogan
        if (currentY > 260) { pdf.addPage(); currentY = 25; }
        pdf.setFont('Helvetica', 'Bold');
        pdf.setFontSize(10.5 * scale);
        pdf.text(slogan, 15, currentY);
        currentY += 8 * scale;

        // 8. Closing Signature Text
        if (currentY > 260) { pdf.addPage(); currentY = 25; }
        pdf.setFont('Helvetica', 'Normal');
        pdf.setFontSize(10.5 * scale);
        pdf.text("Saya yang menjalankan amanah,", 15, currentY);
        currentY += 4 * scale;

        // 9. Signature Image
        if (currentY > 240) { pdf.addPage(); currentY = 25; }
        
        // Load signature image
        try {
          const sigRes = await fetch(signatureDataUrl);
          const sigBlob = await sigRes.blob();
          const sigReader = new FileReader();
          const base64Sig = await new Promise<string>((res) => {
            sigReader.onloadend = () => res(sigReader.result as string);
            sigReader.readAsDataURL(sigBlob);
          });
          pdf.addImage(base64Sig, 'PNG', 15, currentY, 40 * scale, 18 * scale);
        } catch (err) {
          console.error("Gagal cetak tandatangan di PDF:", err);
        }
        currentY += 20 * scale;

        // 10. Sender block (Bold name in uppercase bracket, role below)
        if (currentY > 275) { pdf.addPage(); currentY = 25; }
        pdf.setFont('Helvetica', 'Bold');
        pdf.setFontSize(10.5 * scale);
        pdf.text(`(${pengirimNama.toUpperCase()})`, 15, currentY);
        currentY += 5 * scale;
        pdf.setFont('Helvetica', 'Normal');
        pdf.setFontSize(10.5 * scale);
        pdf.text(pengirimJawatan, 15, currentY);
        currentY += 5 * scale;
        pdf.text("Sekolah Menengah Agama Ulu Jempol", 15, currentY);

        return pdf;
      };

      let optimalPdf: jsPDF | null = null;
      let scale = 1.0;
      const minScale = 0.55;
      const step = 0.05;

      while (scale >= minScale) {
        const tempPdf = await renderWithScale(scale);
        if (tempPdf.getNumberOfPages() === 1) {
          optimalPdf = tempPdf;
          break;
        }
        optimalPdf = tempPdf;
        scale -= step;
      }

      return optimalPdf;
    } catch (err) {
      console.error("Gagal membina PDF:", err);
      setErrorMsg("Ralat teknikal semasa menjana fail PDF.");
      return null;
    }
  };

  // Submit and save letter
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsGenerating(true);

    try {
      const pdf = await generatePDF();
      if (!pdf) {
        setIsGenerating(false);
        return;
      }

      // 1. Output PDF as blob and upload to Storage
      const pdfOutput = pdf.output('blob');
      const letterId = `letter_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const fileRef = ref(storage, `surat_rasmi/${letterId}.pdf`);
      
      const snapshot = await uploadBytes(fileRef, pdfOutput);
      const downloadPdfUrl = await getDownloadURL(snapshot.ref);

      // 2. Save letter data to Firestore
      const newLetter: OfficialLetter = {
        noRujukan,
        tarikh,
        penerimaNama,
        penerimaJawatan,
        penerimaAlamat,
        tajuk,
        kandungan: perenggan,
        slogan,
        pengirimNama,
        pengirimJawatan,
        pdfUrl: downloadPdfUrl,
        signatureUrl: signatureDataUrl || undefined,
        createdAt: serverTimestamp(),
        createdByEmail: currentUserDoc?.email || 'unknown',
        createdByNama: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Anon',
        tablesJson: JSON.stringify(paragraphTables)
      };

      await addDoc(collection(db, 'surat_rasmi'), newLetter);

      // Save offline or download locally
      pdf.save(`Surat_Rasmi_${noRujukan.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

      setSuccessMsg(`Surat rasmi berjaya dijana dan disimpan! PDF dimuat turun secara automatik.`);
      
      // Reset form (except references/dates)
      setPenerimaNama('');
      setPenerimaJawatan('');
      setPenerimaAlamat('');
      setTajuk('');
      setPerenggan(['']);
      setParagraphTables([null]);
      
    } catch (err) {
      console.error("Gagal simpan surat rasmi:", err);
      setErrorMsg("Sila pastikan sambungan internet stabil untuk menyimpan rekod di awan.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete past letter from history - stage 1 (open custom modal)
  const initiateDeleteLetter = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteModalOpen(true);
  };

  // Delete past letter from history - stage 2 (confirm via custom modal)
  const confirmDeleteLetter = async () => {
    if (!deleteTargetId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteDoc(doc(db, 'surat_rasmi', deleteTargetId));
      setSuccessMsg("Surat rasmi berjaya dipadam daripada sejarah.");
      fetchHistory();
    } catch (err) {
      console.error("Gagal memadam surat:", err);
      setErrorMsg("Anda tidak mempunyai kebenaran untuk memadam rekod ini.");
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteTargetId(null);
    }
  };

  // Edit past letter to reuse / regenerate
  const handleEditAndReuse = (letter: OfficialLetter) => {
    setNoRujukan(letter.noRujukan || '');
    setTarikh(letter.tarikh || '');
    setPenerimaNama(letter.penerimaNama || '');
    setPenerimaJawatan(letter.penerimaJawatan || '');
    setPenerimaAlamat(letter.penerimaAlamat || '');
    setTajuk(letter.tajuk || '');
    setPerenggan(letter.kandungan && letter.kandungan.length > 0 ? [...letter.kandungan] : ['']);
    if (letter.tablesJson) {
      try {
        setParagraphTables(JSON.parse(letter.tablesJson));
      } catch (e) {
        console.error("Gagal parse tablesJson:", e);
        const size = letter.kandungan && letter.kandungan.length > 0 ? letter.kandungan.length : 1;
        setParagraphTables(Array(size).fill(null));
      }
    } else if (letter.tables && letter.tables.length > 0) {
      setParagraphTables([...letter.tables]);
    } else {
      const size = letter.kandungan && letter.kandungan.length > 0 ? letter.kandungan.length : 1;
      setParagraphTables(Array(size).fill(null));
    }
    setSlogan(letter.slogan || '“BERKHIDMAT UNTUK MASYARAKAT”');
    setPengirimNama(letter.pengirimNama || '');
    setPengirimJawatan(letter.pengirimJawatan || '');
    if (letter.signatureUrl) {
      setSignatureDataUrl(letter.signatureUrl);
      setSignatureMode('saved');
    } else {
      setSignatureDataUrl(null);
      setSignatureMode('draw');
    }
    
    // Switch tab to generate
    setActiveTab('generate');
    
    // Show feedback
    setSuccessMsg("Surat rasmi berjaya dimuatkan ke dalam borang. Anda boleh mengubahsuai dan menjana semula.");
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Filter history
  const filteredHistory = history.filter(letter => {
    const term = searchQuery.toLowerCase();
    return (
      letter.noRujukan.toLowerCase().includes(term) ||
      letter.penerimaNama.toLowerCase().includes(term) ||
      letter.tajuk.toLowerCase().includes(term) ||
      letter.pengirimNama.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-1 sm:p-3">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer border border-slate-100"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="space-y-0.5">
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-indigo-600 shrink-0" size={20} />
              JANA SURAT RASMI PERSATUAN
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Modul Rasmi Pentadbiran & PIBG Sekolah Menengah Agama Ulu Jempol
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'generate' ? 'bg-white text-indigo-700 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <PenTool size={13} />
            <span>Jana Surat</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <History size={13} />
            <span>Sejarah Rekod</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex items-start gap-2.5 text-emerald-800 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
          <Check size={15} className="shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Form Column */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-3xs p-4 sm:p-5 space-y-5">
            
            {/* AI Generator Section */}
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-4 space-y-3 shadow-3xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="text-violet-600 animate-pulse shrink-0" size={16} />
                    <h3 className="text-xs font-black text-violet-900 uppercase tracking-wider">Jana Surat Rasmi Dengan AI</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal">
                    Tulis topik/aduan ringkas anda, dan pembantu AI akan mengisi semua borang rujukan, penerima, tajuk, dan perenggan kandungan secara automatik mengikut format surat rasmi Melayu yang betul!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAiError(null);
                    setIsAiModalOpen(true);
                  }}
                  className="px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-[10px] font-black shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Sparkles size={11} />
                  <span>Mula Jana</span>
                </button>
              </div>
            </div>

            {/* Metada Section */}
            <div className="border-b border-slate-100 pb-4 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Maklumat Rujukan & Tarikh</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">No. Rujukan Surat *</label>
                  <input
                    type="text"
                    required
                    value={noRujukan}
                    onChange={(e) => setNoRujukan(e.target.value)}
                    placeholder="Contoh: SMAUJ/2026/102"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tarikh Surat *</label>
                  <input
                    type="text"
                    required
                    value={tarikh}
                    onChange={(e) => setTarikh(e.target.value)}
                    placeholder="Contoh: 16 Julai 2026"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Recipient Section */}
            <div className="border-b border-slate-100 pb-4 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Maklumat Penerima (Kepada)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Nama Penerima *</label>
                  <input
                    type="text"
                    required
                    value={penerimaNama}
                    onChange={(e) => setPenerimaNama(e.target.value)}
                    placeholder="Contoh: Encik Ahmad bin Ali"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Jawatan Penerima (Opsional)</label>
                  <input
                    type="text"
                    value={penerimaJawatan}
                    onChange={(e) => setPenerimaJawatan(e.target.value)}
                    placeholder="Contoh: Pengarah Cawangan"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Alamat Penuh Penerima *</label>
                <textarea
                  required
                  rows={3}
                  value={penerimaAlamat}
                  onChange={(e) => setPenerimaAlamat(e.target.value)}
                  placeholder="Contoh: Jabatan Kerja Raya,&#10;Jalan Simpang, 72200 Batu Kikir,&#10;Negeri Sembilan."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white transition-all resize-none"
                />
              </div>
            </div>

            {/* Title & Subject */}
            <div className="border-b border-slate-100 pb-4 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Perkara & Tajuk Surat</span>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tajuk / Perkara * (Auto UPPERCASE)</label>
                <input
                  type="text"
                  required
                  value={tajuk}
                  onChange={(e) => setTajuk(e.target.value)}
                  placeholder="Contoh: JEMPUTAN KE MAJLIS ANUGERAH KECEMERLANGAN AKADEMIK SMAUJ"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white transition-all"
                />
              </div>
            </div>

            {/* Paragraphs */}
            <div className="border-b border-slate-100 pb-4 space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Kandungan Perenggan Surat</span>
                <button
                  type="button"
                  onClick={addParagraph}
                  className="px-2 py-1 bg-slate-50 hover:bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black border border-slate-100 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus size={10} />
                  <span>Tambah Perenggan</span>
                </button>
              </div>

              <div className="space-y-4">
                {perenggan.map((para, idx) => (
                  <div key={idx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        {idx === 0 ? "Perenggan Utama (Pendahuluan - Tanpa No)" : `Perenggan ${idx + 1}`}
                      </span>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => removeParagraph(idx)}
                          className="text-rose-500 hover:text-rose-700 text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 size={10} />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      required
                      rows={idx === 0 ? 3 : 4}
                      value={para}
                      onChange={(e) => handleParagraphChange(idx, e.target.value)}
                      placeholder={idx === 0 ? "Dengan hormatnya perkara di atas adalah dirujuk..." : `Kandungan bagi perenggan ${idx + 1} di sini...`}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 bg-white transition-all resize-none"
                    />

                    {/* Table Builder for each Paragraph */}
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                      {paragraphTables[idx] ? (
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-3 shadow-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                              <TableIcon size={12} />
                              Jadual Perenggan {idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTable(idx)}
                              className="text-rose-500 hover:text-rose-700 text-[9px] font-black flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 size={10} />
                              Buang Jadual
                            </button>
                          </div>

                          {/* Columns Management (Headers) */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">Tajuk Lajur (Columns)</label>
                              <button
                                type="button"
                                onClick={() => handleAddColumn(idx)}
                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[8px] font-extrabold border border-indigo-100 cursor-pointer flex items-center gap-0.5"
                              >
                                <Plus size={8} /> Tambah Lajur
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                              {paragraphTables[idx]?.headers.map((hdr, hIdx) => (
                                <div key={hIdx} className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
                                  <input
                                    type="text"
                                    value={hdr}
                                    onChange={(e) => handleUpdateHeader(idx, hIdx, e.target.value)}
                                    className="w-20 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-hidden bg-white"
                                  />
                                  {paragraphTables[idx]!.headers.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveColumn(idx, hIdx)}
                                      className="px-1 py-0.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-[8px] font-extrabold border-l border-slate-200 cursor-pointer"
                                    >
                                      &times;
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Rows Management */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">Kandungan Baris (Rows & Cells)</label>
                              <button
                                type="button"
                                onClick={() => handleAddRow(idx)}
                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded text-[8px] font-extrabold border border-emerald-100 cursor-pointer flex items-center gap-0.5"
                              >
                                <Plus size={8} /> Tambah Baris
                              </button>
                            </div>

                            {/* Scrollable responsive container for desktop and mobile */}
                            <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50 p-1.5">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr>
                                    {paragraphTables[idx]?.headers.map((hdr, hIdx) => (
                                      <th key={hIdx} className="px-1.5 py-1 text-[8px] font-black text-slate-500 uppercase tracking-wider">{hdr || `Lajur ${hIdx+1}`}</th>
                                    ))}
                                    <th className="w-8"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {paragraphTables[idx]?.rows.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="px-1 py-0.5">
                                          <input
                                            type="text"
                                            value={cell}
                                            onChange={(e) => handleUpdateCell(idx, rIdx, cIdx, e.target.value)}
                                            className="w-full px-1.5 py-1 text-[9px] font-medium text-slate-700 bg-white border border-slate-150 rounded-md focus:outline-hidden focus:border-indigo-500"
                                          />
                                        </td>
                                      ))}
                                      <td className="px-1 py-0.5 text-center">
                                        {paragraphTables[idx]!.rows.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveRow(idx, rIdx)}
                                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer animate-pulse"
                                            title="Padam Baris"
                                          >
                                            <Trash2 size={10} />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddTable(idx)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50/70 hover:text-indigo-600 text-slate-600 rounded-lg text-[9px] font-bold border border-slate-200/80 flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <TableIcon size={12} />
                          <span>Tambah Jadual di bawah perenggan ini</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature & Closing */}
            <div className="border-b border-slate-100 pb-4 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Tandatangan & Slogan</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Slogan Surat (Default)</label>
                  <input
                    type="text"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    placeholder="“BERKHIDMAT UNTUK MASYARAKAT”"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Nama & Jawatan Pengirim *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={pengirimNama}
                      onChange={(e) => setPengirimNama(e.target.value)}
                      placeholder="Nama Penuh"
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-[11px] font-black text-slate-800 focus:outline-hidden focus:border-indigo-500 bg-white"
                    />
                    <input
                      type="text"
                      required
                      value={pengirimJawatan}
                      onChange={(e) => setPengirimJawatan(e.target.value)}
                      placeholder="Jawatan"
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-[11px] font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Signature Canvas */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    Tandatangan Digital *
                    {signatureMode === 'saved' && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[8px] font-black uppercase">Sedia Ada</span>}
                  </label>
                  
                  {currentUserDoc?.signatureUrl && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureMode('saved');
                          setSignatureDataUrl(currentUserDoc.signatureUrl || null);
                        }}
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${signatureMode === 'saved' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Guna Rekod Profil
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureMode('draw');
                          setSignatureDataUrl(null);
                        }}
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${signatureMode === 'draw' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Lukis Baru
                      </button>
                    </div>
                  )}
                </div>

                {signatureMode === 'draw' ? (
                  <div className="space-y-3">
                    <div className="relative border border-dashed border-indigo-200 rounded-xl bg-slate-50 p-2 overflow-hidden flex flex-col items-center">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={160}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="bg-white border border-slate-100 rounded-lg shadow-inner max-w-full cursor-crosshair touch-none"
                      />
                      <div className="w-full flex justify-between items-center mt-2 px-1">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sila tandatangan dalam kotak di atas</span>
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black cursor-pointer transition-colors"
                        >
                          Padam Canvas
                        </button>
                      </div>
                    </div>

                    {signatureDataUrl && (
                      <div className="flex items-center gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                        <span className="text-[10px] text-indigo-800 font-bold">Mahukan tandatangan ini disimpan terus ke profil tetap anda?</span>
                        <button
                          type="button"
                          disabled={isSavingSignature}
                          onClick={saveSignaturePermanently}
                          className="ml-auto px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition-colors flex items-center gap-1"
                        >
                          {isSavingSignature ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                          <span>Simpan ke Profil</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50/30 border border-emerald-150 rounded-xl p-3 flex items-center gap-4">
                    <div className="w-24 h-12 bg-white rounded-lg border border-emerald-100 flex items-center justify-center overflow-hidden p-1">
                      {signatureDataUrl && <img src={signatureDataUrl} alt="Tandatangan Tersimpan" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-emerald-800 uppercase tracking-tight flex items-center gap-1">
                        <Check size={14} className="stroke-[2.5]" />
                        Tandatangan Sedia Ada Dipilih
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                        Tandatangan daripada profil akaun anda akan digunakan secara automatik di dalam PDF.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Mempersiapkan fail PDF & Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <FileText size={15} />
                    <span>Jana Surat Rasmi (Muat Turun PDF)</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Preview Column */}
          <div className="lg:col-span-5 space-y-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block px-1">Pratonton Langsung Fail A4</span>
            
            {/* Live Mockup Sheet */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 sm:p-6 aspect-[1/1.414] w-full max-w-full flex flex-col justify-between text-[7px] text-slate-800 overflow-hidden leading-relaxed relative">
              
              {/* Overlay Letterhead */}
              <div>
                <div className="w-full mb-4 border-b border-slate-100 pb-2">
                  {letterheadBase64 || directLetterheadUrl ? (
                    <img src={letterheadBase64 || directLetterheadUrl} alt="Letterhead" className="w-full object-contain pointer-events-none" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-14 w-full bg-slate-50 border border-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400">
                      <FileText size={16} />
                      <span className="text-[6px] font-bold uppercase mt-1">Logo / Letterhead Persatuan</span>
                    </div>
                  )}
                </div>

                {/* Recipient & Meta details aligned/selari horizontally */}
                <div className="flex justify-between items-start mb-4 gap-4">
                  {/* Recipient details (Left side) */}
                  <div className="space-y-0.5 max-w-[60%]">
                    <p className="font-extrabold text-[8px] text-slate-900 leading-tight">{penerimaNama || 'Nama Penerima'}</p>
                    {penerimaJawatan && <p className="font-bold text-slate-500 leading-tight">{penerimaJawatan}</p>}
                    <p className="whitespace-pre-line text-slate-600 leading-snug">{penerimaAlamat || 'Alamat Penerima di sini'}</p>
                  </div>

                  {/* Meta details (Right side) */}
                  <div className="text-right font-bold flex flex-col gap-0.5 w-[40%] shrink-0">
                    <p className="leading-tight">Ruj. Kami: <span className="text-indigo-600 font-extrabold">{noRujukan || 'SMAUJ/2026/XXX'}</span></p>
                    <p className="leading-tight">Tarikh: <span>{tarikh || 'Tarikh Hari Ini'}</span></p>
                  </div>
                </div>

                {/* Salutation */}
                <p className="mb-3 font-semibold text-slate-700">Tuan,</p>

                {/* Title */}
                <div className="mb-4">
                  <p className="font-extrabold text-[8px] text-slate-900 uppercase tracking-tight leading-tight">
                    {tajuk || 'TAJUK SURAT RASMI PERSATUAN'}
                  </p>
                </div>

                {/* Paragraphs preview */}
                <div className="space-y-2.5">
                  {perenggan.map((para, i) => {
                    const isLastPara = i === perenggan.length - 1;
                    const hasNumber = i > 0 && !(isLastPara && perenggan.length > 1);
                    const table = paragraphTables[i];
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="block text-justify leading-relaxed">
                          <p className="text-slate-600 font-medium text-justify">
                            {hasNumber && (
                              <span className="float-left font-extrabold text-slate-900 mr-2 select-none w-4">
                                {i + 1}.
                              </span>
                            )}
                            <span className={hasNumber ? "block" : "indent-8 block"}>
                              {para || (i === 0 ? 'Dengan hormatnya perkara di atas dirujuk...' : `Kandungan perenggan ${i + 1} di sini...`)}
                            </span>
                          </p>
                        </div>

                        {/* Table Preview */}
                        {table && (
                          <div className="my-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/20 max-w-full">
                            <table className="w-full text-left border-collapse text-[6px]">
                              <thead>
                                <tr className="bg-indigo-50/50 border-b border-slate-200 text-slate-700">
                                  {table.headers.map((hdr, hIdx) => (
                                    <th key={hIdx} className="px-2 py-0.5 font-extrabold uppercase tracking-tight">{hdr || `Lajur ${hIdx+1}`}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {table.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="text-slate-600">
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="px-2 py-0.5 font-medium">{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Slogan */}
                <p className="mt-5 font-extrabold text-slate-800">{slogan}</p>
              </div>

              {/* Bottom Block (Sign-off) */}
              <div className="mt-6 border-t border-slate-50 pt-3 space-y-1">
                <p className="text-slate-600">Saya yang menjalankan amanah,</p>
                
                {/* Signature Preview */}
                <div className="h-10 w-24 bg-slate-50/50 border border-slate-100/50 rounded-lg flex items-center justify-center p-1 relative my-1 overflow-hidden shrink-0">
                  {signatureDataUrl ? (
                    <img src={signatureDataUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[5px] text-slate-300 font-extrabold uppercase tracking-wider">Tiada Tandatangan</span>
                  )}
                </div>

                {/* Sender Details */}
                <p className="font-extrabold text-[8px] text-slate-900 uppercase">({pengirimNama || 'NAMA PENGIRIM'})</p>
                <p className="font-bold text-slate-500">{pengirimJawatan || 'JAWATAN'},</p>
                <p className="font-semibold text-slate-400">Sekolah Menengah Agama Ulu Jempol.</p>
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs p-4 sm:p-5 space-y-5">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari rujukan, tajuk atau penerima..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white"
              />
            </div>
            
            <button
              onClick={fetchHistory}
              className="w-full sm:w-auto px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-150 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isLoadingHistory ? "animate-spin" : ""} />
              <span>Segarkan Semula</span>
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Memuatkan Sejarah Surat...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-slate-200 rounded-2xl max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4">
                <FileText size={22} />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Tiada Rekod Dijumpai</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">
                {searchQuery ? "Tiada rekod surat rasmi yang sepadan dengan carian anda." : "Belum ada sebarang surat rasmi yang dijana di bawah modul persatuan setakat ini."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistory.map((letter) => (
                <div 
                  key={letter.id} 
                  className="bg-white rounded-xl border border-slate-100 hover:border-slate-200 shadow-3xs p-4 flex flex-col justify-between gap-4 transition-all relative group"
                >
                  <div className="space-y-3">
                    {/* Top Label */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                          {letter.noRujukan}
                        </span>
                        <p className="text-[9px] text-slate-400 font-extrabold">{letter.tarikh}</p>
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => letter.id && initiateDeleteLetter(letter.id)}
                        className="text-slate-300 hover:text-rose-600 transition-colors cursor-pointer p-1"
                        title="Padam Surat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-900 leading-normal line-clamp-2 uppercase">
                        {letter.tajuk}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-semibold line-clamp-1">
                        Kepada: <span className="font-bold text-slate-700">{letter.penerimaNama}</span>
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-50 pt-3 mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <div className="space-y-0.5 font-semibold">
                      <p>Dijana Oleh: <span className="font-bold text-slate-700">{letter.createdByNama}</span></p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Edit & Reuse Button */}
                      <button
                        onClick={() => handleEditAndReuse(letter)}
                        className="px-2.5 py-1.5 bg-violet-50 hover:bg-violet-600 text-violet-700 hover:text-white rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer"
                        title="Sunting & Guna Semula"
                      >
                        <Edit size={11} />
                        <span>Sunting & Guna</span>
                      </button>

                      {/* Download Button */}
                      <a
                        href={letter.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Download size={11} />
                        <span>Buka PDF</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Letter Generator Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="animate-pulse text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">PEMBANTU PENULISAN SURAT AI</h3>
                  <p className="text-[10px] text-indigo-100 font-medium">Jana draf surat rasmi lengkap dengan sekelip mata</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isAiGenerating) {
                    setIsAiModalOpen(false);
                    setAiError(null);
                  }
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleGenerateDraftWithAI} className="p-5 space-y-4">
              {aiError && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <span className="mt-0.5">⚠️</span>
                  <span>{aiError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Butiran atau Topik Surat (Aduan / Jemputan / Permohonan) *
                </label>
                <textarea
                  required
                  rows={5}
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Contoh: Saya mahu membuat surat jemputan kepada Pegawai Pendidikan Daerah Jempol untuk merasmikan Majlis Ihtifal & Hari Kecemerlangan Sekolah Menengah Agama Ulu Jempol."
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 transition-all resize-none"
                  disabled={isAiGenerating}
                />
                <p className="text-[9px] text-slate-400 font-bold">
                  * Berikan butiran atau konteks yang ringkas, AI akan merangka seluruh perenggan surat dengan tatabahasa rasmi Melayu secara lengkap.
                </p>
              </div>

              {/* Sender Context Preview */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                  Konteks Pengirim (Akan diguna pakai)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-semibold block">Nama Pengirim</span>
                    <span className="font-bold text-slate-700">{pengirimNama || 'Setiausaha Persatuan'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-semibold block">Jawatan</span>
                    <span className="font-bold text-slate-700">{pengirimJawatan || 'Setiausaha'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAiModalOpen(false);
                    setAiError(null);
                  }}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-150 transition-colors cursor-pointer"
                  disabled={isAiGenerating}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAiGenerating}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-indigo-400 disabled:to-violet-400 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 min-w-[130px] transition-all cursor-pointer"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="animate-spin" size={13} />
                      <span>Sedang Merangka...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>Jana Deraf ✨</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Deletion Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Body */}
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">PADAM REKOD SEJARAH</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Adakah anda pasti mahu memadamkan surat rasmi ini dari sejarah? Tindakan ini tidak boleh diundur.
                </p>
              </div>
            </div>

            {/* Modal Footer / Action Buttons */}
            <div className="bg-slate-50 p-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTargetId(null);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteLetter}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
              >
                Ya, Padam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
