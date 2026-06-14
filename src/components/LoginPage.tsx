import React, { useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { setPersistence, browserLocalPersistence, browserSessionPersistence, signInWithPopup } from 'firebase/auth';
import { User, Lock, Mail, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyDomain = () => {
    navigator.clipboard.writeText(window.location.hostname);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Set persistence based on checkbox
      await setPersistence(
        auth, 
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F05C3E] overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(251,146,60,0.4),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(234,88,12,0.4),transparent)]" />
      
      {/* Animated background blobs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-white/5 rounded-full blur-[100px] animate-pulse delay-700" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-[400px] px-6"
      >
        {/* Glassmorphism Card */}
        <div className="relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[40px] p-10 shadow-2xl overflow-hidden group">
          {/* Subtle glowing edge overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Profile Circle */}
          <div className="flex justify-center mb-10">
            <div className="w-24 h-24 rounded-full border-2 border-cyan-400/50 flex items-center justify-center relative bg-blue-900/20 shadow-[0_0_20px_rgba(34,211,238,0.3)] group-hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-shadow">
              <svg viewBox="0 0 100 100" className="w-16 h-16 pointer-events-none" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Document Background */}
                <rect x="25" y="15" width="50" height="70" rx="4" fill="#E2E8F0" stroke="#1E293B" strokeWidth="2" />
                <path d="M25 25C25 19.4772 29.4772 15 35 15H65C70.5228 15 75 19.4772 75 25V30H25V25Z" fill="#CBD5E1" stroke="#1E293B" strokeWidth="2" />
                
                {/* Bar Chart */}
                <rect x="32" y="65" width="8" height="12" fill="#1E293B" />
                <rect x="44" y="55" width="8" height="22" fill="#1E293B" />
                <rect x="56" y="45" width="8" height="32" fill="#1E293B" />
                <rect x="28" y="77" width="44" height="4" fill="#3B82F6" />
                
                {/* Dollar Circle & Arrow */}
                <circle cx="25" cy="45" r="14" fill="#4ADE80" stroke="#1E293B" strokeWidth="2" />
                <text x="25" y="49" fontSize="12" fontWeight="bold" fill="#1E293B" textAnchor="middle" style={{ fontFamily: 'sans-serif' }}>$</text>
                <path d="M42 45L55 45M55 45L50 40M55 45L50 50" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* User Circle */}
                <circle cx="80" cy="35" r="12" fill="#FACC15" stroke="#1E293B" strokeWidth="2" />
                <circle cx="80" cy="32" r="4" fill="#991B1B" />
                <path d="M74 41C74 38 76.6863 36 80 36C83.3137 36 86 38 86 41" fill="#991B1B" />
              </svg>
              {/* Spinning outer ring effect */}
              <div className="absolute -inset-1 border border-cyan-400/20 rounded-full animate-[spin_10s_linear_infinite]" />
            </div>
          </div>

          <div className="space-y-6">
            {/* Login Button (Gmail Auth Shortcut) */}
            <motion.button
              type="button"
              onClick={handleLogin}
              whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(37,99,235,0.4)' }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-blue-900/60 hover:bg-blue-800 border border-cyan-400/30 py-4 rounded-xl text-white font-bold tracking-widest text-sm transition-all relative overflow-hidden group/btn flex items-center justify-center gap-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
              <Mail className="w-5 h-5 text-cyan-400" />
              LOG IN WITH GMAIL
            </motion.button>

            {/* Remember Me Toggle */}
            <div className="flex items-center justify-center text-xs text-white/50 px-1">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  className="rounded bg-blue-900/20 border border-white/10"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-red-400 text-[10px] sm:text-xs font-medium leading-relaxed">
                  {error.code === 'auth/unauthorized-domain' ? (
                    <>
                      <span className="block font-bold mb-2 text-white/90 text-sm italic underline">ACTION REQUIRED TO FIX:</span>
                      This error happens because Firebase needs to "know" your app's domain.
                      <div className="mt-4 p-3 bg-black/60 rounded-lg border border-cyan-400/30 text-left">
                        <p className="text-[10px] text-cyan-400/70 mb-2 uppercase font-bold tracking-widest">1. Copy this domain:</p>
                        <div className="flex items-center gap-2 mb-4">
                          <code className="flex-1 p-2 bg-black/40 rounded text-[11px] font-mono text-cyan-400 break-all border border-cyan-400/10">
                            {window.location.hostname}
                          </code>
                          <button 
                            type="button"
                            onClick={copyDomain}
                            className="p-2 bg-cyan-400/10 hover:bg-cyan-400/20 rounded-lg transition-colors text-cyan-400"
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-cyan-400/70 mb-1 uppercase font-bold tracking-widest">2. Paste it in:</p>
                        <p className="text-[9px] text-white/50 leading-tight">
                          Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains
                        </p>
                      </div>
                    </>
                  ) : (
                    <span className="font-mono">{error.message}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm z-20">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
