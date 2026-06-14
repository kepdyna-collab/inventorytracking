import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  status?: 'active' | 'disabled';
  lastLogin: any;
}

export const SUPER_ADMIN_EMAIL = 'gamefull56@gmail.com';

export async function syncUserProfile(user: any) {
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  const profileData: Partial<UserProfile> = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    lastLogin: new Date().toISOString(),
  };

  if (!userSnap.exists()) {
    // New user
    profileData.role = user.email === SUPER_ADMIN_EMAIL ? 'admin' : 'user';
    profileData.status = user.email === SUPER_ADMIN_EMAIL ? 'active' : 'disabled';
    await setDoc(userRef, profileData);
    return profileData as UserProfile;
  } else {
    // Existing user - update details but don't overwrite role unless it's the super admin
    const currentData = userSnap.data() as UserProfile;
    if (user.email === SUPER_ADMIN_EMAIL && currentData.role !== 'admin') {
      profileData.role = 'admin';
    }
    await updateDoc(userRef, profileData);
    return { ...currentData, ...profileData } as UserProfile;
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('lastLogin', 'desc'));
  const querySnapshot = await getDocs(q);
  const users: UserProfile[] = [];
  querySnapshot.forEach((doc) => {
    users.push(doc.data() as UserProfile);
  });
  return users;
}

export async function getUserInventories(uid: string) {
  const inventoriesRef = collection(db, 'user_data', uid, 'inventories');
  const querySnapshot = await getDocs(inventoriesRef);
  const inventories: any[] = [];
  querySnapshot.forEach((doc) => {
    inventories.push({ id: doc.id, ...doc.data() });
  });
  return inventories;
}

export async function getUserNotes(uid: string) {
  const notesRef = doc(db, 'user_data', uid, 'notes', 'all');
  const docSnap = await getDoc(notesRef);
  if (docSnap.exists()) {
    return docSnap.data().notes || [];
  }
  return [];
}

export async function updateUserStatus(uid: string, status: 'active' | 'disabled') {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { status });
}

export async function updateUserRole(uid: string, role: 'admin' | 'user') {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role });
}

export async function deleteUserRecord(uid: string) {
  const userRef = doc(db, 'users', uid);
  // Also clean up user_data
  const inventoriesRef = collection(db, 'user_data', uid, 'inventories');
  const inventoryDocs = await getDocs(inventoriesRef);
  
  const promises = inventoryDocs.docs.map(d => deleteDoc(d.ref));
  promises.push(deleteDoc(doc(db, 'user_data', uid, 'notes', 'all')));
  promises.push(deleteDoc(userRef));
  
  await Promise.all(promises);
}
