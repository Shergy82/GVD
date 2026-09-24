import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { RegisterScreen } from './components/auth/RegisterScreen';
import { ForgotPasswordScreen } from './components/auth/ForgotPasswordScreen';
import { PendingApprovalScreen } from './components/auth/PendingApprovalScreen';
import { DeactivatedScreen } from './components/auth/DeactivatedScreen';
import { AppShell } from './components/layout/AppShell';
import { HomeView } from './views/HomeView';
import { MyAccountView } from './views/MyAccountView';
import { PeopleView } from './views/PeopleView';
import { ProjectDirectoryView } from './views/ProjectDirectoryView';
import { ProjectWorkspaceView } from './views/ProjectWorkspaceView';
import { PlannerView } from './views/PlannerView';
import { ContractorMyWorkView } from './views/ContractorMyWorkView';
import { ContractorClaimsView } from './views/ContractorClaimsView';
import { ClaimsReviewView } from './views/ClaimsReviewView';
import { PurchasingView } from './views/PurchasingView';
import { ContractorMaterialsView } from './views/ContractorMaterialsView';
import './styles/theme.css';

type AuthViewMode = 'login' | 'register' | 'forgot-password';

export function MainAppRouter() {
  const { 
    firebaseUser, 
    currentUser, 
    loading, 
    isPending, 
    isRejected, 
    isInactive, 
    isEmailVerified 
  } = useAuth();

  const [authMode, setAuthMode] = useState<AuthViewMode>('login');
  const [currentTab, setCurrentTab] = useState<string>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const isContractor = currentUser?.role === 'IndividualContractor' || currentUser?.role === 'ContractorCompany';

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (tab !== 'projects') {
      setSelectedProjectId(null);
    }
  };

  // 1. Loading State (Prevents flash of protected content)
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
        padding: '24px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          backgroundColor: 'var(--brand-navy)',
          color: '#FFFFFF',
          fontWeight: 800,
          fontSize: '1.4rem',
          fontFamily: 'var(--font-heading)',
          marginBottom: '16px'
        }}>
          GVD
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
          GVD Connect
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Checking authentication and account status...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!firebaseUser) {
    if (authMode === 'register') {
      return <RegisterScreen onNavigateLogin={() => setAuthMode('login')} />;
    }
    if (authMode === 'forgot-password') {
      return <ForgotPasswordScreen onNavigateLogin={() => setAuthMode('login')} />;
    }
    return (
      <LoginScreen
        onNavigateRegister={() => setAuthMode('register')}
        onNavigateForgotPassword={() => setAuthMode('forgot-password')}
      />
    );
  }

  // 3. Authenticated but Pending or Unverified State (Owners bypass pending block)
  if (currentUser?.role !== 'Owner' && (!isEmailVerified || isPending)) {
    return <PendingApprovalScreen />;
  }

  // 4. Authenticated but Deactivated or Rejected State
  if (isInactive || isRejected) {
    return <DeactivatedScreen />;
  }

  if (!currentUser) return null;

  // 5. Approved User State -> Application Shell
  const renderTabContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeView 
            onNavigateProjects={() => {
              setCurrentTab('projects');
              setSelectedProjectId(null);
            }} 
          />
        );
      case 'projects':
        if (selectedProjectId) {
          return (
            <ProjectWorkspaceView
              projectId={selectedProjectId}
              currentUser={currentUser}
              onBack={() => setSelectedProjectId(null)}
            />
          );
        }
        return (
          <ProjectDirectoryView
            currentUser={currentUser}
            onSelectProject={(id) => setSelectedProjectId(id)}
          />
        );
      case 'planner':
        return (
          <PlannerView
            currentUser={currentUser}
            onSelectProject={(id) => {
              setCurrentTab('projects');
              setSelectedProjectId(id);
            }}
          />
        );
      case 'my_work':
        return (
          <ContractorMyWorkView
            currentUser={currentUser}
            onSelectProject={(id) => {
              setCurrentTab('projects');
              setSelectedProjectId(id);
            }}
          />
        );
      case 'my_claims':
        return <ContractorClaimsView currentUser={currentUser} />;
      case 'claims_review':
        return <ClaimsReviewView currentUser={currentUser} />;
      case 'purchasing':
        return <PurchasingView currentUser={currentUser} />;
      case 'my_materials':
        return (
          <ContractorMaterialsView 
            currentUser={currentUser} 
            onNavigateProject={(id) => {
              setCurrentTab('projects');
              setSelectedProjectId(id);
            }}
          />
        );
      case 'account':
        return <MyAccountView />;
      case 'people':
        return <PeopleView />;
      default:
        return (
          <ProjectDirectoryView
            currentUser={currentUser}
            onSelectProject={(id) => setSelectedProjectId(id)}
          />
        );
    }
  };

  return (
    <AppShell currentTab={currentTab} onSelectTab={handleTabChange}>
      {renderTabContent()}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppRouter />
    </AuthProvider>
  );
}
