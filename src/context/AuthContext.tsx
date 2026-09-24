import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  reload
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  collection, 
  addDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserProfile, UserRole, AccountStatus, ApplicationCategory, AuditLog } from '../types';
import { MOCK_USERS } from '../services/mockData';

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  applicationCategory: ApplicationCategory;
  companyName?: string;
  companyContactPerson?: string;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: UserProfile | null;
  loading: boolean;
  isEmailVerified: boolean;
  isApproved: boolean;
  isPending: boolean;
  isRejected: boolean;
  isInactive: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginAsDemoUser: (role: UserRole) => void;
  registerUser: (data: RegisterData) => Promise<void>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshVerificationStatus: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateMyContactDetails: (fullName: string, phone: string) => Promise<void>;
  recordAuditLog: (action: string, entityType: string, entityId: string, details: string, beforeState?: any, afterState?: any) => Promise<void>;
  designatedOwnerEmail: string;
  setDesignatedOwnerEmail: (email: string) => void;
  resetLoginAndOwnerSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const OWNER_EMAIL_STORAGE_KEY = 'gvd_connect_owner_email';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastResendTimestamp, setLastResendTimestamp] = useState<number>(0);
  const [designatedOwnerEmail, setDesignatedOwnerEmailState] = useState<string>(() => {
    return localStorage.getItem(OWNER_EMAIL_STORAGE_KEY) || import.meta.env.VITE_OWNER_EMAIL || '';
  });

  const setDesignatedOwnerEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    localStorage.setItem(OWNER_EMAIL_STORAGE_KEY, clean);
    setDesignatedOwnerEmailState(clean);
  };

  const loginAsDemoUser = (role: UserRole) => {
    let target = MOCK_USERS.find(u => u.role === role);
    if (!target) {
      if (role === 'Accounts') {
        target = {
          uid: 'user-accounts-01',
          email: 'accounts@gvdcontracts.co.uk',
          fullName: 'Emma Watson',
          phone: '07700 900333',
          applicationCategory: 'GVD Employee',
          role: 'Accounts',
          status: 'approved',
          planningEligible: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          emailVerified: true
        };
      } else {
        target = MOCK_USERS[0];
      }
    }
    const mockAuthUser = {
      uid: target.uid,
      email: target.email,
      displayName: target.fullName,
      emailVerified: true
    } as FirebaseUser;

    setFirebaseUser(mockAuthUser);
    setCurrentUser({
      ...target,
      status: 'approved',
      emailVerified: true
    });
    localStorage.setItem('gvd_demo_user_role', role);
  };

  useEffect(() => {
    // Safety fallback: Ensure auth loading never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      clearTimeout(safetyTimer);
      setFirebaseUser(user);

      if (user) {
        // Listen to Firestore profile document in real-time
        const userRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            
            // Sync emailVerified status if needed
            if (data.emailVerified !== user.emailVerified && data.role !== 'Owner') {
              await updateDoc(userRef, { emailVerified: user.emailVerified, updatedAt: new Date().toISOString() }).catch(() => {});
              data.emailVerified = user.emailVerified;
            }

            // Check if this user should be Owner (first user, designated owner, or already Owner)
            const isOwnerByEmail = designatedOwnerEmail && user.email?.toLowerCase() === designatedOwnerEmail.toLowerCase();
            const shouldBeOwner = isOwnerByEmail || data.role === 'Owner';
            if (shouldBeOwner && (data.role !== 'Owner' || data.status !== 'approved')) {
              await updateDoc(userRef, {
                role: 'Owner',
                status: 'approved',
                planningEligible: true,
                emailVerified: true,
                updatedAt: new Date().toISOString()
              }).catch(() => {});
              data.role = 'Owner';
              data.status = 'approved';
              data.emailVerified = true;
            }

            setCurrentUser(data);
          } else {
            // Safe Recovery: Auth exists but Firestore profile doc does not exist yet
            const isOwnerByEmail = designatedOwnerEmail && user.email?.toLowerCase() === designatedOwnerEmail.toLowerCase();
            const fallbackRole: UserRole = isOwnerByEmail ? 'Owner' : 'IndividualContractor';
            const fallbackStatus: AccountStatus = isOwnerByEmail ? 'approved' : 'pending';

            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              fullName: user.displayName || user.email?.split('@')[0] || 'User',
              phone: '',
              applicationCategory: 'Individual Contractor',
              role: fallbackRole,
              status: fallbackStatus,
              planningEligible: isOwnerByEmail,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              emailVerified: isOwnerByEmail ? true : user.emailVerified
            };

            await setDoc(userRef, {
              ...newProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }).catch(console.error);

            setCurrentUser(newProfile);
          }
          setLoading(false);
        }, (err) => {
          console.error("Firestore user snapshot error:", err);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [designatedOwnerEmail]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const registerUser = async (data: RegisterData) => {
    setLoading(true);
    try {
      // 1. Create Auth account
      const userCred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      const user = userCred.user;

      // 2. Check if this is the first registered user or designated Owner
      let isFirstOrOwner = false;
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const hasOwner = usersSnap.docs.some(docSnap => docSnap.data()?.role === 'Owner');
        const isDesignated = designatedOwnerEmail && data.email.trim().toLowerCase() === designatedOwnerEmail.toLowerCase();
        // If there is no existing Owner, or this user matches designated email, or owner not yet claimed:
        if (!hasOwner || isDesignated || usersSnap.empty || localStorage.getItem('gvd_connect_owner_claimed') !== 'true') {
          isFirstOrOwner = true;
        }
      } catch (err) {
        console.warn("Could not query existing users, defaulting to Owner for first registrant:", err);
        isFirstOrOwner = true;
      }

      const initialRole: UserRole = isFirstOrOwner ? 'Owner' : (
        data.applicationCategory === 'Contractor Company' ? 'ContractorCompany' : 'IndividualContractor'
      );
      const initialStatus: AccountStatus = isFirstOrOwner ? 'approved' : 'pending';

      if (isFirstOrOwner) {
        setDesignatedOwnerEmail(data.email.trim().toLowerCase());
        localStorage.setItem('gvd_connect_owner_claimed', 'true');
      }

      // 3. Create linked User Profile document in Firestore
      const userProfile: UserProfile = {
        uid: user.uid,
        email: data.email.trim().toLowerCase(),
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        applicationCategory: data.applicationCategory,
        companyName: data.companyName ? data.companyName.trim() : undefined,
        companyContactPerson: data.companyContactPerson ? data.companyContactPerson.trim() : undefined,
        role: initialRole,
        status: initialStatus,
        planningEligible: isFirstOrOwner,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        emailVerified: isFirstOrOwner ? true : user.emailVerified
      };

      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 4. Send email verification (non-blocking for Owner)
      try {
        await sendEmailVerification(user);
      } catch (e) {
        console.warn("Verification email notice:", e);
      }

      // Set user profile in state immediately
      setCurrentUser(userProfile);
      setFirebaseUser(user);
      setLoading(false);

      // 5. Record Audit Log
      await recordAuditLog(
        'User Registered',
        'UserProfile',
        user.uid,
        `New registration for ${data.fullName} as ${data.applicationCategory}`,
        null,
        { email: data.email, category: data.applicationCategory }
      ).catch(() => {});

    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const resendVerificationEmail = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    
    // Rate-limiting check: 60 seconds
    const now = Date.now();
    if (now - lastResendTimestamp < 60000) {
      throw new Error("Please wait 60 seconds before requesting another verification email.");
    }

    await sendEmailVerification(auth.currentUser);
    setLastResendTimestamp(now);
    return true;
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    setFirebaseUser({ ...auth.currentUser });
    
    // Update firestore record
    if (auth.currentUser.emailVerified && currentUser) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        emailVerified: true,
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
    return auth.currentUser.emailVerified;
  };

  const sendPasswordReset = async (email: string) => {
    const actionCodeSettings = {
      url: window.location.origin + '/login',
      handleCodeInApp: false
    };
    await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
  };

  const logout = async () => {
    setLoading(true);
    localStorage.removeItem('gvd_demo_user_role');
    await signOut(auth);
    setFirebaseUser(null);
    setCurrentUser(null);
    setLoading(false);
  };

  const resetLoginAndOwnerSetup = async () => {
    setLoading(true);
    localStorage.removeItem('gvd_demo_user_role');
    localStorage.removeItem(OWNER_EMAIL_STORAGE_KEY);
    localStorage.removeItem('gvd_connect_owner_claimed');
    setDesignatedOwnerEmailState('');
    await signOut(auth).catch(() => {});
    setFirebaseUser(null);
    setCurrentUser(null);
    setLoading(false);
  };

  const updateMyContactDetails = async (fullName: string, phone: string) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      updatedAt: serverTimestamp()
    });
  };

  const recordAuditLog = async (
    action: string, 
    entityType: string, 
    entityId: string, 
    details: string, 
    beforeState?: any, 
    afterState?: any
  ) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        actorId: currentUser?.uid || auth.currentUser?.uid || 'system',
        actorName: currentUser?.fullName || auth.currentUser?.email || 'System',
        actorRole: currentUser?.role || 'IndividualContractor',
        action,
        entityType,
        entityId,
        details,
        beforeState: beforeState || null,
        afterState: afterState || null,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Could not write audit log:", e);
    }
  };

  const isEmailVerified = firebaseUser?.emailVerified ?? false;
  const isApproved = currentUser?.status === 'approved';
  const isPending = currentUser?.status === 'pending';
  const isRejected = currentUser?.status === 'rejected';
  const isInactive = currentUser?.status === 'inactive';
  const isOwner = currentUser?.role === 'Owner';
  const isAdmin = isOwner || currentUser?.role === 'Admin';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        loading,
        isEmailVerified,
        isApproved,
        isPending,
        isRejected,
        isInactive,
        isOwner,
        isAdmin,
        login,
        loginAsDemoUser,
        registerUser,
        resendVerificationEmail,
        refreshVerificationStatus,
        sendPasswordReset,
        logout,
        resetLoginAndOwnerSetup,
        updateMyContactDetails,
        recordAuditLog,
        designatedOwnerEmail,
        setDesignatedOwnerEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
