import React, { useState, useEffect } from 'react';
import { getAllUsers, UserProfile, getUserInventories, getUserNotes, updateUserStatus, deleteUserRecord, updateUserRole, SUPER_ADMIN_EMAIL } from '../lib/userService';
import { User, Shield, Clock, Mail, ChevronLeft, Package, FileText, ExternalLink, ArrowLeft, Download, FileImage, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userData, setUserData] = useState<{ inventories: any[], notes: any[] }>({ inventories: [], notes: [] });
  const [fetchingData, setFetchingData] = useState(false);
  const [activeInventoryId, setActiveInventoryId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await getAllUsers();
        // Sort users: Super admin first, then admins, then users
        const sortedUsers = [...allUsers].sort((a, b) => {
          if (a.email === SUPER_ADMIN_EMAIL) return -1;
          if (b.email === SUPER_ADMIN_EMAIL) return 1;
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return 0;
        });
        setUsers(sortedUsers);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleViewUser = async (user: UserProfile) => {
    setSelectedUser(user);
    setActiveInventoryId(null);
    setNoteSearchQuery('');
    setFetchingData(true);
    try {
      const [invs, nts] = await Promise.all([
        getUserInventories(user.uid),
        getUserNotes(user.uid)
      ]);
      setUserData({ inventories: invs, notes: nts });
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    } finally {
      setFetchingData(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.role === 'admin') return; // Cannot disable admins
    const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
    try {
      await updateUserStatus(user.uid, newStatus);
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.role === 'admin') return;

    try {
      await deleteUserRecord(user.uid);
      setUsers(prev => prev.filter(u => u.uid !== user.uid));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Error deleting user. Access might be restricted.");
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    if (user.email === SUPER_ADMIN_EMAIL) return; // Cannot demote super admin
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRole(user.uid, newRole);
      setUsers(prev => {
        const updated = prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u);
        return [...updated].sort((a, b) => {
          if (a.email === SUPER_ADMIN_EMAIL) return -1;
          if (b.email === SUPER_ADMIN_EMAIL) return 1;
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return 0;
        });
      });
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const [exportMenuId, setExportMenuId] = useState<string | null>(null);

  const handleExportPhoto = async (containerId: string, title: string) => {
    setExportMenuId(null);
    const target = document.getElementById(containerId);
    if (!target) return;

    try {
      await document.fonts.ready;
      target.classList.add('is-exporting', 'is-exporting-pdf');
      // Small delay for class to apply and layout to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await domToPng(target, { 
        backgroundColor: '#ffffff',
        scale: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && (node.getAttribute('data-no-export') === 'true')) {
            return false;
          }
          return true;
        },
        style: {
          padding: '20px',
          backgroundColor: '#ffffff',
          color: '#000000'
        }
      });
      
      const link = document.createElement('a');
      link.download = `admin-report-${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Photo Export Error:", err);
    } finally {
      target.classList.remove('is-exporting', 'is-exporting-pdf');
    }
  };

  const handleExportPDF = async (containerId: string, title: string) => {
    setExportMenuId(null);
    const target = document.getElementById(containerId);
    if (!target) return;

    try {
      await document.fonts.ready;
      target.classList.add('is-exporting', 'is-exporting-pdf');
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await domToPng(target, { 
        backgroundColor: '#ffffff', 
        scale: 3, 
        filter: (node) => {
          if (node instanceof HTMLElement && (node.getAttribute('data-no-export') === 'true')) {
            return false;
          }
          return true;
        },
        style: {
          backgroundColor: '#ffffff',
          color: '#000000'
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(dataUrl);
      
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', margin, margin, contentWidth, contentHeight);
      pdf.save(`admin-report-${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
    } finally {
      target.classList.remove('is-exporting', 'is-exporting-pdf');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F05C3E] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
    (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#F05C3E] text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => selectedUser ? setSelectedUser(null) : navigate('/')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-cyan-400 flex items-center gap-3">
              <Shield size={32} />
              {selectedUser ? "User Data Inspector" : "Admin Dashboard"}
            </h1>
          </div>
          
          {selectedUser && (
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-cyan-400/30">
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold">{selectedUser.displayName}</span>
                <span className="text-[10px] text-gray-500 font-mono">{selectedUser.email}</span>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!selectedUser ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-6"
            >
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Registered Users</h2>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="w-48 bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 placeholder:text-gray-500 transition-colors"
                      />
                    </div>
                    <span className="bg-cyan-400/20 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {filteredUsers.length} Total
                    </span>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                        <th className="px-6 py-4">User Info</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Last Active</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((user) => (
                        <tr key={user.uid} className="hover:bg-cyan-500/5 transition-all group cursor-pointer" onClick={() => handleViewUser(user)}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 group-hover:border-cyan-400 transition-colors bg-white/5 flex items-center justify-center shrink-0">
                                {user.photoURL ? (
                                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <User size={20} className="text-gray-400" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-gray-200 group-hover:text-cyan-400 transition-colors">{user.displayName || 'Anonymous User'}</span>
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                                  <Mail size={10} />
                                  <span className="truncate max-w-[200px]">{user.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRole(user);
                              }}
                              disabled={user.email === SUPER_ADMIN_EMAIL}
                              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                                user.role === 'admin'
                                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 ring-1 ring-purple-500/30 hover:bg-purple-500/30'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40'
                              } ${user.email === SUPER_ADMIN_EMAIL ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                            >
                              <Shield size={10} className={user.role === 'admin' ? 'opacity-100' : 'opacity-40'} />
                              {user.role}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                              <Clock size={12} />
                              {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 px-3">
                              <button
                                disabled={user.role === 'admin'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStatus(user);
                                }}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg ${
                                  user.role === 'admin'
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 cursor-not-allowed opacity-60'
                                    : user.status === 'disabled'
                                      ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50'
                                      : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20 hover:border-green-500/50'
                                }`}
                              >
                                {user.role === 'admin' ? 'IMMUNE' : (user.status === 'disabled' ? 'Disabled' : 'Active')}
                              </button>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewUser(user);
                                }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 rounded-lg text-[10px] font-black transition-all border border-cyan-400/30 whitespace-nowrap uppercase tracking-widest"
                              >
                                EXAMINE
                                <ExternalLink size={12} />
                              </button>

                              {user.role === 'user' && (
                                <div className="flex items-center gap-2">
                                  <AnimatePresence mode="wait">
                                    {confirmDeleteId === user.uid ? (
                                      <motion.div 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="flex items-center gap-2"
                                      >
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteUser(user);
                                          }}
                                          className="px-2 py-1 bg-red-500 text-[10px] font-black uppercase rounded text-white shadow-lg shadow-red-500/20"
                                        >
                                          CONFIRM
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(null);
                                          }}
                                          className="px-2 py-1 bg-white/10 text-[10px] font-black uppercase rounded text-gray-400"
                                        >
                                          BACK
                                        </button>
                                      </motion.div>
                                    ) : (
                                      <motion.button 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteId(user.uid);
                                        }}
                                        className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20 hover:border-red-500"
                                        title="Delete Account Permanently"
                                      >
                                        <Trash2 size={16} />
                                      </motion.button>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {fetchingData ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-mono text-cyan-400 animate-pulse uppercase tracking-widest">Accessing Secure Records...</p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-12">
                  {/* Notes View - Start Here */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-yellow-400/20 pb-4">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <FileText size={20} />
                        <h2 className="text-xl font-bold uppercase tracking-widest text-xs">User Activity Notes</h2>
                      </div>

                      <div className="relative group">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                        <input
                          type="text"
                          placeholder="Search inventory name..."
                          value={noteSearchQuery}
                          onChange={(e) => setNoteSearchQuery(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400/50 focus:border-yellow-400/30 w-full sm:w-64 transition-all"
                        />
                      </div>
                    </div>

                    {userData.notes.length === 0 ? (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-gray-500 italic">
                        No notes saved to cloud by this user.
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {[...userData.notes]
                          .filter(note => note.title.toLowerCase().includes(noteSearchQuery.toLowerCase()))
                          .sort((a, b) => b.id - a.id)
                          .map((note: any) => (
                          <div key={note.id} className="group flex flex-col">
                            <button 
                              onClick={() => {
                                // Try to find matching inventory by ID (stable) or title (fallback)
                                const matchingInv = userData.inventories.find(inv => 
                                  inv.id === String(note.id) || inv.systemTitle === note.title
                                );
                                if (matchingInv) {
                                  setActiveInventoryId(activeInventoryId === matchingInv.id ? null : matchingInv.id);
                                }
                              }}
                              className={`p-6 text-left bg-white/5 border rounded-2xl transition-all duration-300 ${
                                userData.inventories.some(inv => inv.id === String(note.id) || inv.systemTitle === note.title) 
                                ? 'border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/5 cursor-pointer' 
                                : 'border-white/5 opacity-80 cursor-default'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-gray-200 group-hover:text-cyan-400 transition-colors">
                                  {note.title}
                                </h3>
                                {userData.inventories.some(inv => inv.id === String(note.id) || inv.systemTitle === note.title) && (
                                  <span className="text-[10px] bg-cyan-400/10 text-cyan-400 px-2 py-1 rounded font-black tracking-tighter">
                                    HAS INVENTORY
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed italic border-l-2 border-white/10 pl-4">
                                {note.content}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                                <Clock size={12} />
                                {new Date(note.id).toLocaleString()}
                              </div>
                            </button>

                            {/* Matching Inventory Reveal */}
                            <AnimatePresence>
                              {activeInventoryId && userData.inventories.find(inv => (inv.id === String(note.id) || inv.systemTitle === note.title || inv.id === note.title) && inv.id === activeInventoryId) && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-4 mb-8 bg-slate-900 border border-cyan-400/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] shadow-cyan-950/20 ring-1 ring-cyan-400/10 scale-[0.98] overflow-hidden">
                                    {userData.inventories.filter(inv => inv.id === String(note.id) || inv.systemTitle === note.title || inv.id === note.title).map(inv => (
                                      <div key={inv.id} id={`inv-card-${inv.id}`} className="p-8">
                                        <div className="flex justify-between items-center mb-8 pb-6 border-b border-white/5">
                                          <div>
                                            <span className="text-[10px] text-gray-500 mb-1 block uppercase font-black">INVENTORY TITLE</span>
                                            <h4 className="text-lg font-black text-cyan-400 uppercase tracking-tighter">{inv.systemTitle || inv.id}</h4>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <div className="text-right">
                                              <span className="text-[10px] text-gray-500 mb-1 block uppercase font-black">LAST SYNC</span>
                                              <span className="text-xs font-mono text-gray-400">{new Date(inv.updatedAt).toLocaleString()}</span>
                                            </div>
                                            <div className="relative" data-no-export="true">
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setExportMenuId(exportMenuId === inv.id ? null : inv.id);
                                                }}
                                                className="p-2 bg-white/5 hover:bg-cyan-400/20 border border-white/10 hover:border-cyan-400/50 rounded-lg text-gray-400 hover:text-cyan-400 transition-all shadow-lg"
                                                title="Export Options"
                                              >
                                                <Download size={20} />
                                              </button>

                                              <AnimatePresence>
                                                {exportMenuId === inv.id && (
                                                  <>
                                                    <div 
                                                      className="fixed inset-0 z-30" 
                                                      onClick={() => setExportMenuId(null)}
                                                    />
                                                    <motion.div
                                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                      className="absolute right-0 mt-2 w-48 bg-[#1e293b] border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-40 overflow-hidden"
                                                      data-no-export="true"
                                                    >
                                                      <button 
                                                        onClick={() => handleExportPhoto(`inv-card-${inv.id}`, inv.systemTitle || inv.id)}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-cyan-400 transition-colors border-b border-white/5"
                                                      >
                                                        <FileImage size={18} className="text-blue-400" />
                                                        <span className="font-bold">Save as Photo</span>
                                                      </button>
                                                      <button 
                                                        onClick={() => handleExportPDF(`inv-card-${inv.id}`, inv.systemTitle || inv.id)}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-red-400 transition-colors"
                                                      >
                                                        <FileText size={18} className="text-red-400" />
                                                        <span className="font-bold">Save as PDF</span>
                                                      </button>
                                                    </motion.div>
                                                  </>
                                                )}
                                              </AnimatePresence>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="space-y-6">
                                          <div>
                                              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Package size={14} className="text-cyan-400" />
                                                CURRENT STOCK LEVELS
                                              </h3>
                                              <div className="grid grid-cols-6 text-[10px] uppercase tracking-widest text-gray-600 font-black mb-4 px-2">
                                                <div className="col-span-2">Product</div>
                                                <div className="text-center">Qty</div>
                                                <div className="text-center">Size</div>
                                                <div className="text-center">Price / Unit</div>
                                                <div className="text-right">Total Price</div>
                                              </div>
                                              <div className="space-y-2">
                                                {inv.items?.map((item: any) => (
                                                  <div key={item.id} className="grid grid-cols-6 text-sm py-3 px-2 bg-white/[0.02] border border-white/5 rounded-xl items-center hover:bg-white/[0.05] transition-colors">
                                                    <div className="col-span-2 flex flex-col">
                                                      <span className="font-black text-gray-200 tracking-tight">{item.productName}</span>
                                                      <span className="text-[10px] text-gray-500 uppercase font-bold">{item.category}</span>
                                                      {item.customerName && (
                                                        <span className="text-[9px] text-cyan-400 mt-1 font-bold">CUST: {item.customerName}</span>
                                                      )}
                                                    </div>
                                                    <div className="text-center font-mono font-black text-cyan-400 text-base">{item.quantityAvailable}</div>
                                                    <div className="text-center font-mono text-xs text-gray-400">{item.size || '-'}</div>
                                                    <div className="text-center font-mono text-xs text-gray-400">${(item.unitPrice || 0).toFixed(2)}</div>
                                                    <div className="text-right font-mono font-black text-gray-200">${((item.unitPrice || 0) * (item.quantityAvailable || 0)).toFixed(2)}</div>
                                                  </div>
                                                ))}
                                              </div>
                                          </div>

                                          {inv.logs?.length > 0 && (
                                            <div className="pt-8 border-t border-white/10 mt-8">
                                              <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Clock size={14} />
                                                TRANSACTION LOGS
                                              </h3>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {[...inv.logs].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log: any) => (
                                                  <div key={log.id} className="flex items-center justify-between py-3 px-4 bg-black/40 rounded-xl border border-white/5 hover:border-red-500/20 transition-all">
                                                    <div className="flex flex-col">
                                                      <span className="text-xs font-black text-gray-300 tracking-tight uppercase">{log.productName}</span>
                                                      <span className="text-[10px] text-gray-500 font-mono">
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                      </span>
                                                    </div>
                                                    <div className={`text-sm font-black font-mono px-2 py-1 rounded ${log.amountAdded < 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                                      {log.amountAdded > 0 ? '+' : ''}{log.amountAdded}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminPanel;
