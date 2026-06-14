import React from 'react';
import { auth } from '../lib/firebase';
import { ShieldAlert, LogOut } from 'lucide-react';
import { motion } from 'motion/react';

const DisabledPage: React.FC = () => {
  const handleLogout = () => {
    auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#F05C3E] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center"
      >
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <ShieldAlert size={40} className="text-red-500" />
        </div>
        
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">
          Access Restricted
        </h1>
        
        <p className="text-gray-400 mb-8 leading-relaxed">
          Your account is currently inactive. This may be because it is pending administrator approval or has been temporarily restricted.
        </p>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </motion.div>
    </div>
  );
};

export default DisabledPage;
