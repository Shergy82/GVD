import React, { useState } from 'react';
import { Home, User, Users, LogOut, FolderKanban, Calendar, MoreHorizontal, Briefcase, Receipt, CreditCard, ShoppingBag, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AppShellProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  hasUnsavedChanges?: boolean;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ 
  currentTab, 
  onSelectTab, 
  hasUnsavedChanges = false,
  children 
}) => {
  const { currentUser, isOwner, isAdmin, logout } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isContractor = currentUser?.role === 'IndividualContractor' || currentUser?.role === 'ContractorCompany';

  // Core Bottom Navigation Bar items:
  // For GVD Staff: Home | Projects | Planner | My Account | More
  // For Contractors: Home | My Jobs | My Work | My Account
  const coreNavItems = isContractor ? [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'My Jobs', icon: FolderKanban },
    { id: 'my_work', label: 'My Work', icon: Briefcase },
    { id: 'my_claims', label: 'My Claims', icon: Receipt },
    { id: 'account', label: 'Account', icon: User }
  ] : [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'account', label: 'Account', icon: User },
    { id: 'more', label: 'More', icon: MoreHorizontal }
  ];

  // Full Sidebar Nav Items (Desktop):
  const sidebarItems = isContractor ? [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'My Jobs', icon: FolderKanban },
    { id: 'my_work', label: 'My Work Diary', icon: Briefcase },
    { id: 'my_claims', label: 'My Claims', icon: Receipt },
    { id: 'my_materials', label: 'Materials & POs', icon: Package },
    { id: 'account', label: 'My Account', icon: User }
  ] : [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'Projects Directory', icon: FolderKanban },
    { id: 'planner', label: 'Planner & Labour Sheet', icon: Calendar },
    { id: 'account', label: 'My Account', icon: User }
  ];

  if (isOwner || isAdmin) {
    sidebarItems.push({ id: 'people', label: 'People Directory', icon: Users });
  }
  if (isOwner || isAdmin || currentUser?.role === 'Accounts' || currentUser?.role === 'ProjectManager') {
    sidebarItems.push({
      id: 'claims_review',
      label: currentUser?.role === 'ProjectManager' ? 'Review Claims' : 'Claims & Finance',
      icon: CreditCard
    });
    sidebarItems.push({
      id: 'purchasing',
      label: 'Purchasing & POs',
      icon: ShoppingBag
    });
  }

  const handleTabChange = (targetTab: string) => {
    if (targetTab === 'more') {
      setShowMoreMenu(!showMoreMenu);
      return;
    }
    setShowMoreMenu(false);

    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("You have unsaved form entries. Are you sure you want to navigate away?");
      if (!confirmLeave) return;
    }
    onSelectTab(targetTab);
  };

  const userInitials = currentUser?.fullName
    ? currentUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-wordmark">
            GVD <span>CONNECT</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sidebarItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleTabChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {currentUser?.fullName}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', fontWeight: 600 }}>
              {currentUser?.role}
            </span>
          </div>
          <button 
            onClick={logout} 
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '6px', flexShrink: 0 }} 
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="main-layout">
        {/* Top Header Bar */}
        <header className="top-bar">
          <div className="top-bar-title">
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--brand-navy)',
              color: '#FFF',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}>
              GVD
            </div>
            <span>
              {currentTab === 'projects' ? (isContractor ? 'My Jobs' : 'Projects') : 
               currentTab === 'my_work' ? 'My Work Diary' :
               currentTab === 'my_claims' ? 'My Claims' :
               currentTab === 'my_materials' ? 'Materials & Purchase Orders' :
               currentTab === 'claims_review' ? 'Claims & Finance' :
               currentTab === 'purchasing' ? 'Purchasing & Commercial' :
               currentTab === 'planner' ? 'Planner & Labour Sheet' :
               (sidebarItems.find(i => i.id === currentTab)?.label || 'GVD Connect')}
            </span>
          </div>

          <div className="top-bar-actions">
            <div className="user-badge">
              <div className="user-avatar">
                {userInitials}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{currentUser?.fullName}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--brand-gold)', fontWeight: 700 }}>{currentUser?.role}</span>
              </div>
            </div>

            <button
              onClick={logout}
              className="btn btn-outline btn-sm"
              title="Sign Out"
            >
              <LogOut size={16} />
              <span className="desktop-only">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic View Content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* More Options Drawer Modal (Mobile) */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">More Destinations</h3>
              <button onClick={() => setShowMoreMenu(false)} className="text-slate-400 hover:text-slate-700 text-xs font-bold">
                Close
              </button>
            </div>

            <div className="space-y-2">
              {(isOwner || isAdmin) && (
                <button
                  onClick={() => handleTabChange('people')}
                  className="w-full p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl text-left flex items-center space-x-3 transition text-slate-800 text-sm font-semibold border border-slate-200"
                >
                  <Users className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span className="block font-bold">People Directory</span>
                    <span className="text-xs text-slate-500 font-normal">Manage accounts, approvals & trade competencies</span>
                  </div>
                </button>
              )}

              {(isOwner || isAdmin || currentUser?.role === 'Accounts' || currentUser?.role === 'ProjectManager') && (
                <button
                  onClick={() => handleTabChange('claims_review')}
                  className="w-full p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl text-left flex items-center space-x-3 transition text-slate-800 text-sm font-semibold border border-slate-200"
                >
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span className="block font-bold">
                      {currentUser?.role === 'ProjectManager' ? 'Attendance & Claims Review' : 'Claims & Finance'}
                    </span>
                    <span className="text-xs text-slate-500 font-normal">
                      {currentUser?.role === 'ProjectManager' ? 'Review assigned project attendance & claims' : 'Review claims, invoices & payments'}
                    </span>
                  </div>
                </button>
              )}

              <button
                onClick={logout}
                className="w-full p-3 bg-red-50 hover:bg-red-100 rounded-xl text-left flex items-center space-x-3 transition text-red-700 text-sm font-semibold border border-red-200"
              >
                <LogOut className="w-5 h-5 text-red-600" />
                <span>Sign Out of Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation (Mobile Viewports <768px) */}
      <nav className="bottom-nav">
        {coreNavItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id || (item.id === 'more' && showMoreMenu);
          return (
            <button
              key={item.id}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabChange(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
