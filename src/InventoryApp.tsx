import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Save, X, Filter, ArrowUpDown, Download, FileImage, FileText, Clock, Home, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';

interface BeverageItem {
  id: string;
  category: string;
  customerName?: string;
  customerPhone?: string;
  productName: string;
  size: number;
  unitPrice: number;
  quantityAvailable: number;
  isPaid?: boolean;
}

interface LogEntry {
  id: string;
  itemId: string;
  productName: string;
  amountAdded: number;
  timestamp: string;
  isPaid?: boolean;
}

import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { LogOut, User as UserIcon } from 'lucide-react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { SUPER_ADMIN_EMAIL, UserProfile } from './lib/userService';

export default function App() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const location = useLocation();
  const systemId = new URLSearchParams(location.search).get('system') || 'default';

  // Get the title from Home's notes if possible, or fallback to storage
  const [systemTitle, setSystemTitle] = useState('Counter Inventory');

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      });

      const notesRef = doc(db, 'user_data', user.uid, 'notes', 'all');
      const unsubscribeNotes = onSnapshot(notesRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().notes) {
          const notes = docSnap.data().notes;
          const currentNote = notes.find((n: any) => String(n.id) === String(systemId));
          if (currentNote) {
            setSystemTitle(currentNote.title || 'Counter Inventory');
          }
        }
      });

      return () => {
        unsubscribeUser();
        unsubscribeNotes();
      };
    }
  }, [user, systemId]);

  const systemName = systemId; // Use ID for storage keys
  
  const contentRef = useRef<HTMLDivElement>(null);
  const historyCardRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<BeverageItem[]>(() => {
    const saved = localStorage.getItem(`inventory_items_${systemName}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem(`inventory_logs_${systemName}`);
    return saved ? JSON.parse(saved) : [];
  });

  const isCloudLoaded = useRef(false);

  // Cloud Sync listener
  useEffect(() => {
    if (user && systemId) {
      const docRef = doc(db, 'user_data', user.uid, 'inventories', systemId);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        isCloudLoaded.current = true;
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.items) {
            setItems(prev => JSON.stringify(prev) !== JSON.stringify(data.items) ? data.items : prev);
          }
          if (data.logs) {
            setLogs(prev => JSON.stringify(prev) !== JSON.stringify(data.logs) ? data.logs : prev);
          }
        }
      }, (error) => {
        console.error("Snapshot error", error);
        isCloudLoaded.current = true; // prevent blocking forever if error
      });
      return unsubscribe;
    } else if (!user) {
        // if explicitly not logged in, treat as local loaded
        isCloudLoaded.current = true;
    }
  }, [user, systemId]);

  // Cloud Sync Update Effect
  useEffect(() => {
    // Only push back to cloud if we've successfully loaded from cloud at least once
    // OR if we are explicitly not logged in (which won't push anyway due to `!user` check)
    if (user && isCloudLoaded.current) {
      const syncData = async () => {
        try {
          await setDoc(doc(db, 'user_data', user.uid, 'inventories', systemId), {
            items,
            logs,
            systemTitle,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Cloud Sync Error:", e);
        }
      };
      
      // Debounce the sync to avoid too many writes
      const timeoutId = setTimeout(() => {
        syncData();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [items, logs, user, systemId, systemTitle]);

  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem(`inventory_search_query_${systemName}`) || '';
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(() => {
    return localStorage.getItem(`inventory_selected_id_${systemName}`);
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItemSelection = (id: string, select?: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (select ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllSelection = () => {
    const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.id));
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredItems.forEach(item => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredItems.forEach(item => next.add(item.id));
        return next;
      });
    }
  };

  const handleDeleteSelected = () => {
    const idsToDelete = new Set(selectedIds);
    if (idsToDelete.size === 0) return;
    
    // Smoothly remove selected items
    setItems(prevItems => prevItems.filter(item => !idsToDelete.has(item.id)));
    
    // Also clean up related logs to prevent orphaned data
    setLogs(prevLogs => prevLogs.filter(log => !idsToDelete.has(log.itemId)));
    
    // Clean up selection and related states
    setSelectedIds(new Set());
    if (selectedRowId && idsToDelete.has(selectedRowId)) {
      setSelectedRowId(null);
    }
    if (editId && idsToDelete.has(editId)) {
      setEditId(null);
      setIsAdding(false);
    }
  };
  const [editForm, setEditForm] = useState<Omit<BeverageItem, 'id'>>(() => {
    const saved = localStorage.getItem(`inventory_edit_form_${systemName}`);
    return saved ? JSON.parse(saved) : {
      category: '',
      customerName: '',
      customerPhone: '',
      productName: '',
      size: 0,
      unitPrice: 0,
      quantityAvailable: 0,
      isPaid: false,
    };
  });
  const [isAdding, setIsAdding] = useState(false);
  const [logInput, setLogInput] = useState<string>('');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showHistoryExportOptions, setShowHistoryExportOptions] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const isDarkMode = true;

  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  React.useEffect(() => {
    localStorage.setItem(`inventory_items_${systemName}`, JSON.stringify(items));
  }, [items, systemName]);

  React.useEffect(() => {
    localStorage.setItem(`inventory_logs_${systemName}`, JSON.stringify(logs));
  }, [logs, systemName]);

  React.useEffect(() => {
    localStorage.setItem(`inventory_edit_form_${systemName}`, JSON.stringify(editForm));
  }, [editForm, systemName]);

  React.useEffect(() => {
    if (selectedRowId) {
      localStorage.setItem(`inventory_selected_id_${systemName}`, selectedRowId);
    } else {
      localStorage.removeItem(`inventory_selected_id_${systemName}`);
    }
  }, [selectedRowId, systemName]);

  React.useEffect(() => {
    localStorage.setItem(`inventory_search_query_${systemName}`, searchQuery);
  }, [searchQuery, systemName]);

  const selectedItem = useMemo(() => {
    return items.find(i => i.id === selectedRowId);
  }, [items, selectedRowId]);

  const itemLogs = useMemo(() => {
    if (!selectedItem) return [];
    return logs
      .filter(log => log.itemId === selectedItem.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, selectedItem]);

  const monthlyTotalForSelected = useMemo(() => {
    if (!selectedItem) return 0;
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    return itemLogs
      .filter(log => new Date(log.timestamp) >= oneMonthAgo)
      .reduce((acc, curr) => acc + curr.amountAdded, 0);
  }, [itemLogs, selectedItem]);

  const monthlyPriceForSelected = useMemo(() => {
    if (!selectedItem) return 0;
    return monthlyTotalForSelected * selectedItem.unitPrice;
  }, [monthlyTotalForSelected, selectedItem]);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      Object.values(item).some(val => 
        val.toString().toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [items, searchQuery]);

  // Grouped by Category for display similar to the image
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: BeverageItem[] } = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(items.map(item => item.category))).filter(Boolean).sort();
  }, [items]);

  const formatSize = (size: number | string) => {
    const s = typeof size === 'string' ? parseFloat(size) : size;
    if (!s || isNaN(s)) return size;
    if (s <= 999) return `${s} ml`;
    return `${s / 1000} L`;
  };

  const handleEdit = (e: React.MouseEvent, item: BeverageItem) => {
    e.stopPropagation();
    setEditId(item.id);
    setEditForm(item);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (editId) {
      const existingItem = items.find(i => i.id === editId);
      const newQty = editForm.quantityAvailable ?? existingItem?.quantityAvailable ?? 0;
      const oldQty = existingItem?.quantityAvailable ?? 0;
      
      if (newQty !== oldQty) {
        const diff = newQty - oldQty;
        const newLog: LogEntry = {
          id: `log-edit-${Date.now()}`,
          itemId: editId,
          productName: editForm.productName || existingItem?.productName || '',
          amountAdded: diff,
          timestamp: new Date().toISOString(),
        };
        setLogs(prev => [newLog, ...prev]);
      }
      
      setItems(prev => prev.map(item => item.id === editId ? { ...item, ...editForm } as BeverageItem : item));
      setEditId(null);
    } else if (isAdding) {
      const itemId = Date.now().toString();
      const newItem = {
        ...editForm,
        id: itemId,
      } as BeverageItem;
      
      if (newItem.quantityAvailable !== 0) {
        const newLog: LogEntry = {
          id: `log-new-${Date.now()}`,
          itemId: itemId,
          productName: newItem.productName,
          amountAdded: newItem.quantityAvailable,
          timestamp: new Date().toISOString(),
        };
        setLogs(prev => [newLog, ...prev]);
      }
      
      setItems(prev => [...prev, newItem]);
      setIsAdding(false);
    }
    setEditForm({});
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setItems(prev => prev.filter(item => item.id !== id));
    if (selectedRowId === id) {
      setSelectedRowId(null);
    }
    if (editId === id) {
      setEditId(null);
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setEditId(null);
    setEditForm({
      category: '',
      customerName: '',
      customerPhone: '',
      productName: '',
      size: 0,
      unitPrice: 0,
      quantityAvailable: 0,
      isPaid: false,
    });
  };

  const handleAddLog = () => {
    const amount = parseInt(logInput) || 0;
    if (!selectedRowId || !selectedItem || amount === 0) return;

    const newLog: LogEntry = {
      id: `log-${Date.now()}`,
      itemId: selectedRowId,
      productName: selectedItem.productName,
      amountAdded: amount,
      timestamp: new Date().toISOString(),
      isPaid: selectedItem.isPaid,
    };

    setLogs(prev => [newLog, ...prev]);
    
    // Also update item quantity
    setItems(prev => prev.map(item => 
      item.id === selectedRowId 
        ? { ...item, quantityAvailable: item.quantityAvailable + amount } 
        : item
    ));
    
    setLogInput('');
  };

  const handleDeleteLog = (logId: string) => {
    const logToDelete = logs.find(log => log.id === logId);
    if (!logToDelete) return;

    setLogs(prev => prev.filter(log => log.id !== logId));
    
    // Adjust stock back to revert the change made by this log
    setItems(prev => prev.map(item => 
      item.id === logToDelete.itemId 
        ? { ...item, quantityAvailable: item.quantityAvailable - logToDelete.amountAdded } 
        : item
    ));
  };

  const handleExportImage = async (targetRef: React.RefObject<HTMLDivElement>, showFullHistory: boolean = true) => {
    const target = targetRef.current;
    if (!target) {
      console.warn('Export target not found. Ensure the section is visible.');
      return;
    }
    
    setShowExportOptions(false);
    setShowHistoryExportOptions(false);
    setIsExportingData(true);
    
    // Ensure fonts are loaded and UI has updated
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Re-check target after potential re-render
    const activeTarget = targetRef.current;
    if (!activeTarget) return;

    activeTarget.classList.add('is-exporting', 'is-exporting-pdf');
    
    // Explicitly show items tagged for export if we are doing a full report
    const exportOnlyElements = activeTarget.querySelectorAll<HTMLElement>('.export-only');
    if (showFullHistory) {
      exportOnlyElements.forEach(el => {
        el.style.setProperty('display', 'block', 'important');
      });
    }
    
    // Hide ignored elements
    const elementsToHide = activeTarget.querySelectorAll<HTMLElement>('[data-html2canvas-ignore], [data-no-export="true"]');
    const printHeader = activeTarget.querySelector('.print-header-content') as HTMLElement;
    
    if (printHeader) printHeader.style.setProperty('display', 'block', 'important');
    elementsToHide.forEach((el) => { 
      el.style.setProperty('display', 'none', 'important');
    });

    try {
      const dataUrl = await domToPng(activeTarget, { 
        backgroundColor: '#ffffff',
        scale: 2,
        style: { 
          transform: 'scale(1)', 
          transformOrigin: 'top left',
          backgroundColor: '#ffffff'
        },
      });
      
      const d = new Date();
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = d.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true}).replace(':', '.').replace(' ', '').toLowerCase();
      
      const link = document.createElement('a');
      link.download = `inventory-report-${dateStr}-time-${timeStr}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      if (printHeader) printHeader.style.display = '';
      elementsToHide.forEach((el) => { el.style.display = ''; });
      exportOnlyElements.forEach(el => el.style.display = '');
      activeTarget.classList.remove('is-exporting', 'is-exporting-pdf');
      setIsExportingData(false);
    }
  };

  const handleExportPDF = async (targetRef: React.RefObject<HTMLDivElement>, showFullHistory: boolean = true) => {
    const target = targetRef.current;
    if (!target) {
      console.warn('Export target not found. Ensure the section is visible.');
      return;
    }

    setShowExportOptions(false);
    setShowHistoryExportOptions(false);
    setIsExportingData(true);
    
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 800));

    // Re-check target after potential re-render
    const activeTarget = targetRef.current;
    if (!activeTarget) return;

    activeTarget.classList.add('is-exporting', 'is-exporting-pdf');
    
    // Explicitly show items tagged for export if requested
    const exportOnlyElements = activeTarget.querySelectorAll<HTMLElement>('.export-only');
    if (showFullHistory) {
      exportOnlyElements.forEach(el => {
        el.style.setProperty('display', 'block', 'important');
      });
    }
    
    const elementsToHide = activeTarget.querySelectorAll<HTMLElement>('[data-html2canvas-ignore], [data-no-export="true"]');
    const printHeader = activeTarget.querySelector('.print-header-content') as HTMLElement;
    
    if (printHeader) printHeader.style.setProperty('display', 'block', 'important');
    elementsToHide.forEach((el) => { 
      el.style.setProperty('display', 'none', 'important');
    });

    try {
      const dataUrl = await domToPng(activeTarget, { 
        backgroundColor: '#ffffff',
        scale: 2,
        style: { 
          transform: 'scale(1)', 
          transformOrigin: 'top left',
          backgroundColor: '#ffffff'
        }
      });
      
      const width = activeTarget.offsetWidth;
      const height = activeTarget.offsetHeight;
      
      const pdf = new jsPDF({
        orientation: height > width ? 'portrait' : 'landscape',
        unit: 'px',
        format: [width, height]
      });
      
      const d = new Date();
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = d.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true}).replace(':', '.').replace(' ', '').toLowerCase();
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(`inventory-report-${dateStr}-time-${timeStr}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      if (printHeader) printHeader.style.display = '';
      elementsToHide.forEach((el) => { el.style.display = ''; });
      exportOnlyElements.forEach(el => el.style.display = '');
      activeTarget.classList.remove('is-exporting', 'is-exporting-pdf');
      setIsExportingData(false);
    }
  };



  return (
    <div className="min-h-screen bg-[#F05C3E] p-6 lg:p-12 font-sans selection:bg-[#FFF59D] selection:text-black text-white transition-colors duration-300">
      
      <div className="max-w-7xl mx-auto relative" ref={contentRef}>
        {/* Back to Home Button & Auth */}
        <div className="md:absolute left-0 top-0 mb-4 md:mb-0 print:hidden flex items-center gap-3" data-html2canvas-ignore>
          <button 
            onClick={() => navigate('/')}  
            className="flex items-center justify-center gap-2 border-2 border-white/20 rounded-lg text-white hover:bg-white/10 transition-all bg-transparent text-white/50 shadow-sm px-4 h-[46px] font-bold text-[11px] uppercase tracking-wider"
          >
            <Home size={16} />
            Back to Home
          </button>

          {user && (
            <div className="flex items-center gap-2 bg-transparent text-white border-2 border-white/20 rounded-lg h-[46px] px-2 shadow-sm relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 rounded-full border border-white/20 overflow-hidden hover:border-blue-500 transition-colors"
                title="Profile Menu"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <UserIcon size={16} />
                  </div>
                )}
              </button>
              
              {showProfileMenu && (
                <div className="absolute top-12 left-0 bg-transparent text-white shadow-xl rounded-lg overflow-hidden min-w-[150px] border border-white/20 z-50">
                  <div className="px-4 py-2 border-b border-white/20 flex items-center gap-2">
                     <span className="text-[10px] font-bold text-white uppercase truncate">
                       {user.displayName || 'Account'}
                     </span>
                  </div>
                  {(user.email === SUPER_ADMIN_EMAIL || profile?.role === 'admin') && (
                    <button 
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/admin');
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 transition-colors flex items-center gap-2 font-bold border-b border-white/20 bg-cyan-50/10"
                    >
                      <Shield size={16} />
                      Admin Dashboard
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      signOut(auth);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 font-medium"
                  >
                    <LogOut size={16} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title Block */}
        <header className="mb-12 text-center print:block">
          <h1 
            className="text-4xl lg:text-6xl font-bold tracking-widest text-white uppercase mb-2"
            style={{ 
              textShadow: '2px 2px 0px #b91c1c, 4px 4px 0px #991b1b, 6px 6px 12px rgba(0,0,0,0.3)' 
            }}
          >
            {systemTitle.replace(/^\d+\s+/, '')}
          </h1>
          <h2 className="text-2xl lg:text-4xl font-bold tracking-widest text-white uppercase">
            Table for Stock Tracking
          </h2>
        </header>

        {/* Print Header (Only visible when printing or specifically toggled) */}
        <div className="hidden print:block mb-8 border-b-4 border-black pb-6 text-center print-header-content">
          <h1 className="text-4xl font-black uppercase text-white mb-2">Inventory Report</h1>
          <div className="flex justify-between items-center text-white font-bold uppercase tracking-widest text-xs">
            <span>DYNA (DK) System Phone: 070895958</span>
            <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Summary Info */}
        <div 
          className="mb-8 bg-[#D6320F] p-6 rounded-xl border border-white/20 shadow-sm dark:shadow-none print:block"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Total Qtys</span>
                <span className="text-xl font-bold text-white">{items.reduce((acc, curr) => acc + curr.quantityAvailable, 0)}</span>
              </div>
              <div className="flex flex-col gap-1 border-l border-white/20">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Total Price / Unit</span>
                <span className="text-xl font-bold text-white">${items.reduce((acc, curr) => acc + curr.unitPrice, 0).toFixed(2)}</span>
              </div>
              <div className="flex flex-col gap-1 border-l border-white/20">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Total Price</span>
                <span className="text-xl font-bold text-white">${items.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantityAvailable), 0).toFixed(2)}</span>
              </div>
              <div className="flex flex-col gap-1 border-l border-white/20">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Total Price Month</span>
                <span className="text-xl font-bold text-white">${(items.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantityAvailable), 0) * 30).toFixed(2)}</span>
              </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between print:hidden">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white" size={18} />
            <input 
              type="text"
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#D6320F] text-white border border-white/20 rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-[#FFF59D] outline-none transition-all dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto items-center justify-center md:justify-end">

            {/* 2. Add Product Button */}
            <button 
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-[#FCE6A4] hover:bg-[#F9D776] text-black font-extrabold py-2.5 px-4 h-[46px] rounded-lg transition-all border border-[#DEB887] shadow-sm transform hover:scale-105 active:scale-95"
              id="add-product-btn"
            >
              <Plus size={18} />
              <span className="whitespace-nowrap uppercase text-[11px] tracking-wider">Add Product</span>
            </button>

            {/* 3. Delete Selected Button */}
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 bg-transparent hover:bg-red-500/10 text-red-500 border-2 border-red-500/50 hover:border-red-500 font-black py-2.5 px-4 h-[46px] rounded-lg transition-all shadow-sm transform hover:scale-105 active:scale-95"
                  title="Delete Selected Items"
                  id="delete-action-btn"
                >
                  <Trash2 size={18} />
                  <span className="whitespace-nowrap uppercase text-[11px] tracking-widest font-black">Delete ({selectedIds.size})</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* 5. Export Button */}
            <div className="relative" data-html2canvas-ignore>
              <button 
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="flex items-center justify-center border-2 border-white/20 rounded-lg text-white hover:bg-white/10 transition-all bg-transparent text-white shadow-sm w-[46px] h-[46px] transform hover:scale-105 active:scale-95"
                title="Export Options"
              >
                <Download size={20} />
              </button>
              
              <AnimatePresence>
                {showExportOptions && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowExportOptions(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-transparent text-white border border-white/20 rounded-xl shadow-xl z-20 overflow-hidden"
                    >
                      <button 
                        onClick={() => handleExportImage(contentRef)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-b border-white/20"
                      >
                        <FileImage size={18} className="text-blue-500" />
                        <span className="font-semibold text-xs">Save as Photo</span>
                      </button>
                      <button 
                        onClick={() => handleExportPDF(contentRef)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                      >
                        <FileText size={18} className="text-red-500" />
                        <span className="font-semibold text-xs">Save as PDF</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Inventory Table Container */}
        <div className={`bg-[#D6320F] text-white rounded-xl shadow-sm dark:shadow-none border border-white/20 transition-all ${isExportingData ? 'overflow-visible' : 'overflow-hidden overflow-x-auto'} print:block`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-white/20 border-b border-white/20">
                {systemTitle.toLowerCase().includes('sales inventory') && (
                  <>
                    <th className="px-4 py-3 text-left font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Name</th>
                    <th className="px-4 py-3 text-left font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Phone</th>
                  </>
                )}
                <th className="px-4 py-3 text-left font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Category</th>
                <th className="px-4 py-3 text-left font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Product Name</th>
                <th className="px-4 py-3 text-center font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Qtys</th>
                <th className="px-4 py-3 text-left font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Size (M.L / L)</th>
                <th className="px-4 py-3 text-left font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Price / Unit</th>
                <th className="px-4 py-3 text-center font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Total Price</th>
                <th className="px-4 py-3 text-center font-black text-white uppercase text-[11px] tracking-wider border-r border-white/20">Actions</th>
                <th className="px-4 py-3 text-center font-black text-white uppercase text-[11px] tracking-wider" data-html2canvas-ignore>
                  <div className="flex justify-center items-center gap-2">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded cursor-pointer accent-red-600"
                      checked={filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.id))}
                      onChange={toggleAllSelection}
                    />
                    <span className="text-[9px]">Select All</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {isAdding && (
                <tr className="bg-white/10 animate-pulse">
                  {systemTitle.toLowerCase().includes('sales inventory') && (
                    <>
                      <td className="p-2 border border-white/20">
                        <input 
                          type="text" 
                          value={editForm.customerName || ''} 
                          onChange={e => setEditForm({...editForm, customerName: e.target.value.replace(/[0-9]/g, '')})}
                          onFocus={e => e.target.select()}
                          onClick={e => (e.target as HTMLInputElement).select()}
                          placeholder="Name"
                          className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                        />
                      </td>
                      <td className="p-2 border border-white/20">
                        <input 
                          type="text" 
                          value={editForm.customerPhone || ''} 
                          onChange={e => setEditForm({...editForm, customerPhone: e.target.value.replace(/[^0-9]/g, '')})}
                          onFocus={e => e.target.select()}
                          onClick={e => (e.target as HTMLInputElement).select()}
                          placeholder="Phone"
                          className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                        />
                      </td>
                    </>
                  )}
                   <td className="p-2 border border-white/20">
                    <input 
                      type="text" 
                      list="category-suggestions"
                      value={editForm.category} 
                      onChange={e => setEditForm({...editForm, category: e.target.value.toUpperCase()})}
                      onFocus={e => e.target.select()}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      placeholder="Category"
                      className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                    />
                    <datalist id="category-suggestions">
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </td>
                  <td className="p-2 border border-white/20">
                    <input 
                      type="text" 
                      value={editForm.productName} 
                      onChange={e => {
                        const val = e.target.value;
                        setEditForm({...editForm, productName: val.charAt(0).toUpperCase() + val.slice(1)});
                      }}
                      onFocus={e => e.target.select()}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      placeholder="Product Name"
                      className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                    />
                  </td>
                  <td className="p-2 border border-white/20">
                    <input 
                      type="number" 
                      value={Number.isNaN(editForm.quantityAvailable) ? '' : editForm.quantityAvailable} 
                      onChange={e => setEditForm({...editForm, quantityAvailable: parseInt(e.target.value)})}
                      onFocus={e => e.target.select()}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      placeholder="Qty"
                      className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-center font-bold"
                    />
                  </td>
                  <td className="p-2 border border-white/20">
                    <input 
                      type="number" 
                      value={Number.isNaN(editForm.size) ? '' : editForm.size}
                      onChange={e => setEditForm({...editForm, size: parseFloat(e.target.value)})}
                      onFocus={e => e.target.select()}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      placeholder="Size (M.L / L)"
                      className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs text-center"
                    />
                  </td>
                  <td className="p-2 border border-white/20">
                    <input 
                      type="number" 
                      value={Number.isNaN(editForm.unitPrice) ? '' : editForm.unitPrice}
                      onChange={e => setEditForm({...editForm, unitPrice: parseFloat(e.target.value)})}
                      onFocus={e => e.target.select()}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      placeholder="Price"
                      className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-center font-bold"
                    />
                  </td>
                  <td className="p-2 border border-white/20 bg-transparent text-white text-right font-mono font-bold text-xs text-white">
                    Auto-calc
                  </td>
                  <td className="p-2 border border-white/20 text-center">
                    <div className="flex items-center justify-center gap-2">
                       <button onClick={handleSave} className="text-green-600 hover:text-green-700">
                        <Save size={18} />
                      </button>
                      <button onClick={() => { setEditId(null); setIsAdding(false); setEditForm({}); }} className="text-red-500 hover:text-red-600">
                        <X size={18} />
                      </button>
                    </div>
                  </td>
                  <td className="p-2 border border-white/20 text-center"></td>
                </tr>
              )}
              {(Object.entries(groupedItems) as [string, BeverageItem[]][]).map(([category, itemsInCategory]) => (
                <React.Fragment key={category}>
                  {itemsInCategory.map((item, idx) => {
                    if (editId === item.id) {
                      return (
                        <tr key={item.id} className="bg-blue-50 dark:bg-blue-900/20 border-b border-white/20">
                          {systemTitle.toLowerCase().includes('sales inventory') && (
                            <>
                              <td className="p-2 border-r border-white/20">
                                <input 
                                  type="text" 
                                  value={editForm.customerName || ''} 
                                  onChange={e => setEditForm({...editForm, customerName: e.target.value.replace(/[0-9]/g, '')})}
                                  onFocus={e => e.target.select()}
                                  onClick={e => (e.target as HTMLInputElement).select()}
                                  className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                                />
                              </td>
                              <td className="p-2 border-r border-white/20">
                                <input 
                                  type="text" 
                                  value={editForm.customerPhone || ''} 
                                  onChange={e => setEditForm({...editForm, customerPhone: e.target.value.replace(/[^0-9]/g, '')})}
                                  onFocus={e => e.target.select()}
                                  onClick={e => (e.target as HTMLInputElement).select()}
                                  className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                                />
                              </td>
                            </>
                          )}
                          <td className="p-2 border-r border-white/20">
                            <input 
                              type="text" 
                              list="category-suggestions"
                              value={editForm.category} 
                              onChange={e => setEditForm({...editForm, category: e.target.value.toUpperCase()})}
                              onFocus={e => e.target.select()}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                            />
                            <datalist id="category-suggestions">
                              {uniqueCategories.map(cat => (
                                <option key={cat} value={cat} />
                              ))}
                            </datalist>
                          </td>
                          <td className="p-2 border-r border-white/20">
                            <input 
                              type="text" 
                              value={editForm.productName} 
                              onChange={e => {
                                const val = e.target.value;
                                setEditForm({...editForm, productName: val.charAt(0).toUpperCase() + val.slice(1)});
                              }}
                              onFocus={e => e.target.select()}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 border-r border-white/20">
                            <input 
                              type="number" 
                              value={Number.isNaN(editForm.quantityAvailable) ? '' : editForm.quantityAvailable} 
                              onChange={e => setEditForm({...editForm, quantityAvailable: parseInt(e.target.value)})}
                              onFocus={e => e.target.select()}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-center font-bold"
                            />
                          </td>
                          <td className="p-2 border-r border-white/20">
                            <input 
                              type="number" 
                              value={Number.isNaN(editForm.size) ? '' : editForm.size}
                              onChange={e => setEditForm({...editForm, size: parseFloat(e.target.value)})}
                              onFocus={e => e.target.select()}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-xs text-center"
                            />
                          </td>
                          <td className="p-2 border-r border-white/20">
                            <input 
                              type="number" 
                              value={Number.isNaN(editForm.unitPrice) ? '' : editForm.unitPrice}
                              onChange={e => setEditForm({...editForm, unitPrice: parseFloat(e.target.value)})}
                              onFocus={e => e.target.select()}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="w-full p-1 border rounded bg-transparent text-white dark:text-white text-center font-bold"
                            />
                          </td>
                          <td className="p-2 border-r border-white/20 font-black text-white text-base">
                             ${((editForm.unitPrice || 0) * (editForm.quantityAvailable || 0)).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-white/20 text-center">
                            <div className="flex items-center justify-center gap-3" data-html2canvas-ignore>
                              <button 
                                onClick={handleSave} 
                                className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/50 transition-all border border-green-100 dark:border-green-800"
                                title="Save"
                              >
                                <Save size={20} />
                              </button>
                              <button 
                                onClick={() => { setEditId(null); setEditForm({}); }} 
                                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all border border-red-100 dark:border-red-800"
                                title="Cancel"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          </td>
                          <td className="p-2 text-center" data-html2canvas-ignore></td>
                        </tr>
                      );
                    }
                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedRowId(selectedRowId === item.id ? null : item.id)}
                        className={`cursor-pointer border-b border-white/20 transition-all ${
                          selectedRowId === item.id 
                            ? 'bg-red-100 border-l-4 border-l-red-600 shadow-inner' 
                            : 'hover:bg-white/10 border-l-4 border-l-transparent'
                        }`}
                      >
                        {systemTitle.toLowerCase().includes('sales inventory') && (
                          <>
                            <td className={`px-4 py-3 font-medium border-r border-white/20 transition-colors ${
                              selectedRowId === item.id 
                                ? 'bg-red-100/50 dark:bg-red-900/40 text-black' 
                                : 'bg-transparent text-white text-white'
                            }`}>
                              {item.customerName || ''}
                            </td>
                            <td className={`px-4 py-3 font-medium border-r border-white/20 transition-colors ${
                              selectedRowId === item.id 
                                ? 'bg-red-100/50 dark:bg-red-900/40 text-black' 
                                : 'bg-transparent text-white text-white'
                            }`}>
                              {item.customerPhone || ''}
                            </td>
                          </>
                        )}
                        <td className={`px-4 py-3 font-medium border-r border-white/20 uppercase transition-colors ${
                          selectedRowId === item.id 
                            ? 'bg-red-100/50 dark:bg-red-900/40 text-black' 
                            : 'bg-transparent text-white text-white'
                        }`}>
                          {idx === 0 ? category : ""}
                        </td>
                        <td className={`px-4 py-3 border-r border-white/20 font-bold capitalize transition-colors ${
                          selectedRowId === item.id ? 'text-black' : 'text-white'
                        }`}>{item.productName}</td>
                        <td className="px-4 py-3 border-r border-white/20 text-center">
                          <span className={`font-bold transition-colors ${
                            selectedRowId === item.id ? 'text-black' : 'text-white'
                          }`}>
                            {item.quantityAvailable}
                          </span>
                        </td>
                        <td className={`px-4 py-3 border-r border-white/20 font-medium transition-colors ${
                          selectedRowId === item.id ? 'text-black' : 'text-white'
                        }`}>{formatSize(item.size)}</td>
                        <td className={`px-4 py-3 border-r border-white/20 font-bold transition-colors ${
                          selectedRowId === item.id ? 'text-black' : 'text-white'
                        }`}>
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 border-r border-white/20 font-black text-base transition-colors ${
                          selectedRowId === item.id ? 'text-black' : 'text-white'
                        }`}>
                          ${(item.unitPrice * item.quantityAvailable).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 border-r border-white/20 text-center">
                          <div className="flex items-center justify-center gap-3" data-html2canvas-ignore>
                            <button 
                              onClick={(e) => handleEdit(e, item)}
                              className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Edit Product"
                            >
                              <Edit2 size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center" data-html2canvas-ignore>
                           <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded cursor-pointer accent-red-600"
                              checked={selectedIds.has(item.id)} 
                              onChange={(e) => { e.stopPropagation(); toggleItemSelection(item.id); }} 
                              onClick={(e) => e.stopPropagation()}
                            />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

            </tbody>
          </table>
          {filteredItems.length === 0 && !isAdding && (
            <div className="p-12 text-center text-white">
              No inventory items found matching your search.
            </div>
          )}
        </div>

        {(selectedIds.size === 0 || isExportingData) && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 print:block print:mt-0 print:space-y-4" id="product-history" ref={historySectionRef} data-html2canvas-ignore>
          <div className={`lg:col-span-2 bg-[#D6320F] text-white rounded-xl shadow-sm dark:shadow-none border border-white/20 transition-all ${isExportingData ? 'overflow-visible' : 'overflow-hidden'} print:border-none print:shadow-none`} ref={historyCardRef}>

            <div className="p-4 bg-[#D6320F] text-white border-b border-white/20 flex justify-between items-center print:bg-transparent text-white print:border-b print:border-black print:px-0">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">TRANSACTION LOGS</span>
                <h3 className="font-bold text-white uppercase text-xs tracking-wider print:text-sm print:text-black">
                  {selectedItem ? `${selectedItem.customerName || ''} ${selectedItem.customerPhone || ''} ${selectedItem.productName}` : 'All Products Activity'}
                </h3>
              </div>
              {selectedItem && (
                <div className="flex gap-2 print:hidden relative" data-html2canvas-ignore>
                  <button 
                    onClick={() => setShowHistoryExportOptions(!showHistoryExportOptions)}
                    className="p-2 rounded-lg bg-transparent border border-white/20 text-gray-400 hover:text-white hover:bg-white/10 transition-all shadow-sm"
                    title="Export History Report"
                  >
                    <Download size={16} />
                  </button>

                  <AnimatePresence>
                    {showHistoryExportOptions && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowHistoryExportOptions(false)}
                        />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-10 w-48 bg-transparent text-white border border-white/20 rounded-xl shadow-xl z-20 overflow-hidden"
                        >
                          <button 
                            onClick={() => {
                              handleExportImage(historySectionRef, false);
                              setShowHistoryExportOptions(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-b border-white/20"
                          >
                            <FileImage size={18} className="text-blue-500" />
                            <span className="font-semibold text-xs">Save as Photo</span>
                          </button>
                          <button 
                            onClick={() => {
                              handleExportPDF(historySectionRef, false);
                              setShowHistoryExportOptions(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            <FileText size={18} className="text-red-500" />
                            <span className="font-semibold text-xs">Save as PDF</span>
                          </button>

                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
            <div className={`overflow-y-auto print:max-h-none ${isExportingData ? 'max-h-none overflow-visible' : 'max-h-[450px]'}`}>
              {(!selectedItem && logs.length === 0) ? (
                <div className="p-12 text-center text-white text-sm italic">
                  No transaction history recorded yet. Click on a product above to update stock.
                </div>
              ) : (selectedItem && itemLogs.length === 0) ? (
                <div className="p-12 text-center text-white text-sm">
                  No tracking logs for this product yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-transparent text-white text-white uppercase font-black tracking-tighter sticky top-0">
                    <tr>
                      <th className="px-6 py-3">Date & Time</th>
                      {!selectedItem && <th className="px-6 py-3">Product</th>}
                      <th className="px-6 py-3 text-center">Amount Added</th>
                      <th className="px-6 py-3 text-right">Total Price</th>
                      <th className="px-6 py-3 text-right">Paid</th>
                      <th className="px-6 py-3 text-center print:hidden" data-html2canvas-ignore>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700 capitalize">
                    {(selectedItem ? itemLogs : logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())).map(log => (
                      <tr key={log.id} className="hover:bg-white/10 transition-colors">
                        <td className="px-6 py-4 text-white font-medium">
                          {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        {!selectedItem && (
                          <td className="px-6 py-4 text-white font-bold uppercase">
                            {log.productName}
                          </td>
                        )}
                        <td className={`px-6 py-4 text-center font-bold ${log.amountAdded > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {log.amountAdded > 0 ? '+' : ''}{log.amountAdded}
                        </td>
                        <td className={`px-6 py-4 text-right font-black ${log.amountAdded < 0 ? 'text-red-500' : 'text-white'}`}>
                          ${(log.amountAdded * (items.find(i => i.id === log.itemId)?.unitPrice || 0)).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <input 
                            type="checkbox" 
                            checked={log.isPaid || false} 
                            onChange={(e) => {
                                const newLogs = logs.map(l => l.id === log.id ? {...l, isPaid: e.target.checked} : l);
                                setLogs(newLogs);
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 text-center print:hidden" data-html2canvas-ignore>
                          <button 
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Delete this entry"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
          {/* Product Summary Box */}
          <div className="bg-[#D6320F] text-white rounded-xl shadow-sm dark:shadow-none border border-white/20 p-6 relative print:border-none print:shadow-none print:bg-transparent text-white print:p-0 print:mt-0">
            <div className="mb-4 print:mb-8 border-b border-white/20 pb-2 flex justify-between items-center">
              <h3 className="font-bold text-white uppercase text-xs tracking-wider print:text-2xl print:text-red-600">Product Summary</h3>
            </div>
            {selectedItem ? (
              <div className="space-y-6 print:space-y-12">
                <div className="print:border-l-4 print:border-red-600 print:pl-6">
                  <label className="block text-[10px] font-bold text-white uppercase mb-1 print:text-sm">Selected Product</label>
                  <p className="text-sm font-semibold text-white print:text-4xl print:font-black capitalize">{selectedItem.productName}</p>
                </div>
 
                <div className="grid grid-cols-1 gap-3 print:grid-cols-2 print:gap-8">
                  <div className="flex flex-col gap-2 p-4 bg-white/10 rounded-lg border border-orange-100 print:bg-transparent text-white print:border-2 print:border-orange-200 print:p-6">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest print:text-sm">Monthly Qtys</span>
                    <span className="text-4xl font-black text-white print:text-5xl">{monthlyTotalForSelected}</span>
                  </div>
                  <div className="flex flex-col gap-2 p-4 bg-white/10 rounded-lg border border-green-100 print:bg-transparent text-white print:border-2 print:border-green-200 print:p-6">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest print:text-sm">Monthly Total Price</span>
                    <span className="text-4xl font-black text-white print:text-5xl">${monthlyPriceForSelected.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/20 flex flex-col gap-3 print:hidden">
                  <label className="block text-[10px] font-bold text-black dark:text-green-500 uppercase tracking-widest">UPDATE STOCK (ADD/REMOVE)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={logInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Only allow numbers and minus sign
                        if (val === '' || val === '-' || !isNaN(parseInt(val))) {
                          setLogInput(val);
                        }
                      }}
                      placeholder="e.g. 50 or -10"
                      className="flex-1 bg-transparent text-white border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all font-bold dark:text-white"
                    />
                    <button 
                      onClick={handleAddLog}
                      disabled={parseInt(logInput) === 0 || logInput === '' || logInput === '-'}
                      className="bg-[#FCE6A4] hover:bg-[#F9D776] disabled:opacity-50 text-black font-extrabold px-6 py-2 rounded-lg transition-all border border-[#DEB887] shadow-sm active:scale-95 text-xs uppercase tracking-widest"
                    >
                      Update Stock
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-4 border-2 border-dashed border-white/20 rounded-xl">
                 <p className="text-white text-sm italic">Select a product above first</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Global Full History Log Section - Always included in export */}
        <div className={`mt-12 bg-transparent text-white rounded-xl shadow-sm dark:shadow-none border border-white/20 transition-all ${isExportingData ? 'overflow-visible' : 'overflow-hidden'} hidden print:block export-only`} style={isExportingData ? { display: 'block' } : {}} data-html2canvas-ignore>
          <div className="p-4 bg-red-600 text-white flex justify-between items-center print:bg-black">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">System Audit Trail</span>
              <h3 className="font-black uppercase tracking-widest text-sm">Full Transaction History (All Products)</h3>
            </div>
            <Clock size={20} />
          </div>
          <div className={isExportingData ? 'overflow-visible' : 'overflow-x-auto'}>
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-transparent text-white font-black uppercase text-white border-b-2 border-black dark:border-slate-600">
                <tr>
                  <th className="px-4 py-3 border-r border-white/20">Timestamp</th>
                  <th className="px-4 py-3 border-r border-white/20">Product Name</th>
                  <th className="px-4 py-3 border-r border-white/20 text-center">Movement</th>
                  <th className="px-4 py-3 text-right">Log Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {[...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => (
                  <tr key={`full-history-${log.id}`} className="dark:text-slate-300">
                    <td className="px-4 py-3 border-r border-white/20 font-mono font-bold">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 border-r border-white/20 font-extrabold uppercase">
                      {log.productName}
                    </td>
                    <td className={`px-4 py-3 border-r border-white/20 text-center font-black ${log.amountAdded > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {log.amountAdded > 0 ? `+${log.amountAdded}` : log.amountAdded}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                       #{log.id.split('-').pop()}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center italic text-gray-500 font-bold uppercase tracking-widest">
                      No global logs recorded in the registry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <footer className="mt-12 mb-8 print:hidden" data-html2canvas-ignore>
          <div className="pt-4 border-t border-white/20 flex justify-between items-center text-[10px] text-white font-medium tracking-tight">
             <p>© 2026 Inventory Control System create by DYNA (DK) Phone: 070895958</p>
             <p>All values in USD</p>
          </div>
        </footer>
      </div>

      {/* Export Loading Overlay */}
      <AnimatePresence>
        {isExportingData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-transparent text-white/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-transparent text-white border border-white/20 rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mb-4" />
              <h3 className="text-lg font-bold text-white">Preparing File...</h3>
              <p className="text-sm text-white mt-2">Please wait a moment</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

