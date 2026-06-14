import React, { useState, useEffect } from 'react';
import { Menu, Search, Clock, List, Square, CheckSquare, AppWindow, Edit2, X, Check, Trash2, Plus, Pin, LogOut, User as UserIcon, Shield, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { SUPER_ADMIN_EMAIL, UserProfile } from './lib/userService';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export default function Home() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

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
          const fetchedNotes = docSnap.data().notes;
          setNotes(fetchedNotes.map((n: any) => ({
            ...n,
            isInventory: n.isInventory || (n.title && n.title.includes('Inventory'))
          })));
        } else {
          setNotes([]);
        }
      });

      return () => {
        unsubscribeUser();
        unsubscribeNotes();
      };
    } else {
      setNotes([]);
    }
  }, [user]);

  // Handle Note Updates via Firebase directly
  const updateFirebaseNotes = async (newNotes: any[]) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'user_data', user.uid, 'notes', 'all'), {
        notes: newNotes,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Notes Cloud Sync Error:", e);
    }
  };

  const handleSetNotes = (newNotes: any[]) => {
    setNotes(newNotes);
    updateFirebaseNotes(newNotes);
  };

  const startEdit = (e: React.MouseEvent, note: any) => {
    e.stopPropagation();
    setEditingNote({ ...note });
    setShowColorPicker(false);
  };

  const saveEdit = () => {
    // Preserve the existing isInventory flag, and ensure it's set if the title contains 'Inventory'
    const isInventory = editingNote.isInventory || editingNote.title.includes('Inventory');                
    // Remove the isNew flag when saving
    const { isNew, ...rest } = editingNote;
    handleSetNotes(notes.map(n => n.id === editingNote.id ? { ...rest, isInventory } : n));
    setEditingNote(null);
    setShowColorPicker(false);
  };

  const deleteNote = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    handleSetNotes(notes.filter(n => n.id !== id));
  };

  const addNewNote = (title: string = 'New Note') => {
    const isInventory = title.includes('Inventory');
    const newNote = {
      id: Date.now(),
      title: title,
      content: '',
      color: 'bg-[#64B5F6]', // Default color
      editable: true,
      hasTime: true,
      isInventory,
      isNew: true,
      time: new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    };
    handleSetNotes([newNote, ...notes]);
    setEditingNote(newNote);
    setShowSystemMenu(false);
  };

  const togglePin = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    handleSetNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const filteredNotes = notes.filter(note => 
    (note.title && note.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => {
    if (a.pinned === b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });

  return (
    <div className="min-h-screen bg-[#F05C3E] font-sans text-gray-800 flex justify-center">
      
      {/* Mobile Frame Simulation (for larger screens) or full width on mobile */}
      <div className="w-full bg-[#F05C3E] min-h-screen shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* App Bar */}
        <div className="px-4 h-14 flex items-center justify-between border-b border-white/10 bg-black/20 backdrop-blur-md z-10 sticky top-0">
          {isSearching ? (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                autoFocus
                className="flex-1 border-none outline-none text-white placeholder-white/50 bg-transparent"
              />
              <button 
                onClick={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white focus:outline-none"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {user && (
                  <div className="flex items-center gap-2 mr-2 relative">
                    <button 
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="w-8 h-8 rounded-full border border-white/20 overflow-hidden hover:border-cyan-400 transition-colors"
                    >
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/80">
                          <UserIcon size={16} />
                        </div>
                      )}
                    </button>
                    
                    {showProfileMenu && (
                      <div className="absolute top-10 left-0 bg-white shadow-xl rounded-lg overflow-hidden min-w-[150px] border border-gray-100 z-50">
                        <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                             <UserIcon size={12} />
                           </div>
                           <span className="text-[10px] font-bold text-gray-500 uppercase truncate max-w-[100px]">
                             {user.displayName || 'Account'}
                           </span>
                        </div>
                        {(user.email === SUPER_ADMIN_EMAIL || profile?.role === 'admin') && (
                          <button 
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/admin');
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-cyan-600 hover:bg-cyan-50 transition-colors flex items-center gap-2 font-bold border-b border-gray-50 bg-cyan-50/10"
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
                          className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium"
                        >
                          <LogOut size={16} />
                          Log Out
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSystemMenu(!showSystemMenu)} className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors">
                    <Plus size={20} strokeWidth={2} />
                  </button>
                  {showSystemMenu && (
                    <div className="absolute top-10 left-0 bg-white shadow-xl rounded-lg overflow-hidden min-w-[200px] border border-gray-100 z-50">
                      <button 
                        onClick={() => addNewNote('1 Counter Inventory')}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-gray-50 font-medium"
                      >
                        1 Counter Inventory
                      </button>
                      <button 
                        onClick={() => addNewNote('2 Counter sales Inventory')}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors font-medium"
                      >
                        2 Counter sales Inventory
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setIsSearching(true)}
                className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white focus:outline-none"
              >
                <Search size={22} strokeWidth={2} />
              </button>
            </>
          )}
        </div>

        {/* Main Content - Box Buttons Grid */}
        <div className="flex-1 overflow-y-auto px-3 py-4 bg-transparent">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {filteredNotes.map((note) => (
              <div
                key={note.id} 
                className={`${editingNote?.id === note.id ? editingNote.color : note.color} rounded-xl p-2.5 text-white relative shadow-sm hover:shadow-md transition-all text-left flex flex-col aspect-square overflow-hidden group border border-black/5 ${editingNote?.id === note.id ? 'col-span-2 aspect-auto h-auto' : ''}`}
                onClick={() => {
                  if (editingNote?.id === note.id) return;
                  // If it's explicitly marked as inventory, or the title contains 'inventory' (case insensitive),
                  // allow navigation to the inventory page for that note.
                  if (note.isInventory === true || note.title.toLowerCase().includes('inventory')) {
                    navigate(`/inventory?system=${note.id}`);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {editingNote?.id === note.id ? (
                  <div className="flex flex-col h-full gap-2 w-full" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                       <input 
                         value={editingNote.title} 
                         onChange={e => setEditingNote({...editingNote, title: e.target.value})}
                         className="bg-white/20 border-b border-white/30 text-white font-bold text-sm outline-none w-full placeholder-white/50 px-1"
                         placeholder="Title"
                       />
                    </div>
                    <textarea 
                      value={editingNote.content}
                      onChange={e => setEditingNote({...editingNote, content: e.target.value})}
                      className="bg-white/20 text-white border border-white/30 rounded p-2 text-xs font-mono outline-none w-full flex-1 min-h-[80px] resize-none placeholder-white/50 mt-2"
                      placeholder="Details"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="relative">
                        <button 
                          className="p-1 px-2 bg-white/20 hover:bg-white/30 rounded text-white text-[10px] uppercase font-black tracking-tight flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPicker(!showColorPicker);
                          }}
                        >
                          <Palette size={14} className="opacity-80 hover:opacity-100" />
                        </button>
                        {showColorPicker && (
                          <div className="absolute left-0 bottom-full mb-1 bg-slate-800 p-1.5 rounded-lg shadow-xl border border-white/10 gap-1 z-50 flex">
                            {['bg-[#00BCD4]', 'bg-[#E57373]', 'bg-[#64B5F6]', 'bg-[#7986CB]', 'bg-[#F26464]', 'bg-[#00ACC1]', 'bg-[#ffb74d]', 'bg-[#81c784]', 'bg-[#ba68c8]', 'bg-[#555555]'].map(c => (
                              <button 
                                key={c}
                                className={`w-4 h-4 rounded-full ${c} border ${editingNote.color === c ? 'border-white scale-125' : 'border-white/20'} hover:scale-110 transition-transform flex-shrink-0 mx-0.5`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNote({...editingNote, color: c});
                                  setShowColorPicker(false);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (editingNote.isNew) {
                              handleSetNotes(notes.filter(n => n.id !== editingNote.id));
                            }
                            setEditingNote(null);
                            setShowColorPicker(false);
                          }} 
                          className="p-1 px-2 bg-white/20 hover:bg-white/30 rounded text-white text-[10px] uppercase font-black tracking-tight"
                        >
                          Cancel
                        </button>
                        <button onClick={saveEdit} className="p-1 px-3 bg-white text-black hover:bg-gray-100 rounded font-black text-[10px] uppercase tracking-tight">
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute right-1 top-1 flex items-center justify-end z-10">
                      <button 
                        onClick={(e) => togglePin(e, note.id)} 
                        className={`p-1 rounded hover:bg-white/20 transition-colors ${note.pinned ? 'text-white !opacity-100' : 'text-white/60 hover:text-white/90'}`}
                      >
                        <Pin size={12} fill={note.pinned ? "currentColor" : "none"} />
                      </button>
                      <button 
                        onClick={(e) => startEdit(e, note)} 
                        className="p-1 rounded hover:bg-white/20 transition-colors text-white/90"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={(e) => deleteNote(e, note.id)} 
                      className="absolute right-1 bottom-1 p-1 rounded hover:bg-white/20 transition-colors text-white/90 z-10"
                    >
                      <Trash2 size={12} />
                    </button>
                    
                    {note.title && (
                      <h3 className="font-black text-[12px] mb-1 leading-tight tracking-tight drop-shadow-sm group-hover:underline underline-offset-2 pr-4 truncate uppercase">
                        {note.title}
                      </h3>
                    )}
                    
                    {note.content && (
                      <p className="text-[10px] whitespace-pre-wrap leading-[1.2] font-mono tracking-tight opacity-80 line-clamp-3">
                        {note.content}
                      </p>
                    )}
 
                    {note.isList && note.items && (
                      <div className="space-y-1 mt-1 overflow-hidden h-full">
                        {note.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex items-start gap-1">
                            {item.checked ? (
                              <CheckSquare size={10} className="mt-[2px] opacity-90 shrink-0" />
                            ) : (
                              <Square size={10} className="mt-[2px] opacity-90 shrink-0" />
                            )}
                            <span className={`text-[9px] leading-tight font-mono tracking-tight line-clamp-1 ${item.checked ? 'opacity-70 line-through' : 'opacity-95'}`}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
 
                    <div className="mt-auto pt-1">
                       {note.hasTime && (
                        <div className="flex items-start gap-1 mt-1 text-white/80 text-[9px] font-mono tracking-tighter">
                          <Clock size={10} className="mt-0.5 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="leading-tight truncate">
                              {(() => {
                                const parts = (note.time || '').trim().split(/\s+/);
                                return parts.slice(0, -1).join(' ') || 'Sep 23 2016';
                              })()}
                            </span>
                            <span className="opacity-70 leading-tight">
                              {(() => {
                                const parts = (note.time || '').trim().split(/\s+/);
                                return parts[parts.length - 1] || '';
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
