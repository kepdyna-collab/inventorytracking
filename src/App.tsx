import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './lib/firebase';
import { syncUserProfile, UserProfile } from './lib/userService';
import { doc, onSnapshot } from 'firebase/firestore';
import InventoryApp from './InventoryApp';
import Home from './Home';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import DisabledPage from './components/DisabledPage';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const handleSync = async () => {
      if (user) {
        setCheckingProfile(true);
        try {
          // Initial sync/create
          const up = await syncUserProfile(user);
          if (up) setProfile(up);

          // Real-time listener for status changes
          const userRef = doc(db, 'users', user.uid);
          unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              // Account was deleted by admin
              setProfile(null);
              auth.signOut();
            }
          });
        } catch (error) {
          console.error("Profile sync failed:", error);
        } finally {
          setCheckingProfile(false);
        }
      } else {
        setProfile(null);
      }
    };
    
    handleSync();
    return () => unsubscribe();
  }, [user]);

  if (loading || (user && !profile && checkingProfile)) {
    return (
      <div className="min-h-screen bg-[#F05C3E] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If user is logged in but their account is disabled
  if (user && profile?.status === 'disabled') {
    return <DisabledPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <LoginPage /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/" 
          element={user ? <Home /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/inventory" 
          element={user ? <InventoryApp /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/admin" 
          element={user ? (profile?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" replace />) : <Navigate to="/login" replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}
