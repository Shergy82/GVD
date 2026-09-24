import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { UserProfile, CompanyProfile, CompetencyDocument, RequirementConfig, AccountStatus } from '../types';
import { calculateCompetencyStatus } from '../services/competencyLogic';
import { IndividualProfileView } from '../components/people/IndividualProfileView';
import { CompanyProfileView } from '../components/people/CompanyProfileView';
import { AttentionNeededView } from './AttentionNeededView';
import { RequirementConfigView } from '../components/competencies/RequirementConfigView';
import { CustomFieldsConfigView } from '../components/admin/CustomFieldsConfigView';
import { UsersAdminView } from './UsersAdminView';
import { 
  Users, 
  Building2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  CheckCircle2, 
  ShieldCheck,
  Settings,
  ChevronRight
} from 'lucide-react';

export const PeopleView: React.FC = () => {
  const { currentUser, isOwner, isAdmin } = useAuth();

  // Active view tab: 'individuals' | 'companies' | 'applications' | 'attention' | 'settings'
  const [activeTab, setActiveTab] = useState<'individuals' | 'companies' | 'applications' | 'attention' | 'settings'>('individuals');

  // Selected sub-profile
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Firestore real-time state
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyProfile[]>([]);
  const [docsList, setDocsList] = useState<CompetencyDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [planningFilter, setPlanningFilter] = useState<string>('all');

  useEffect(() => {
    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as UserProfile));
      setUsersList(list);
    });

    const companiesUnsub = onSnapshot(collection(db, 'companies'), (snap) => {
      const list: CompanyProfile[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CompanyProfile));
      setCompaniesList(list);
    });

    const docsUnsub = onSnapshot(collection(db, 'competencies'), (snap) => {
      const list: CompetencyDocument[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CompetencyDocument));
      setDocsList(list);
      setLoading(false);
    });

    return () => {
      usersUnsub();
      companiesUnsub();
      docsUnsub();
    };
  }, []);

  // Filtered Individuals
  const filteredUsers = usersList.filter(u => {
    if (activeTab === 'individuals' && u.status === 'pending') return false; // Pending in applications tab
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = u.fullName.toLowerCase().includes(term);
      const matchEmail = u.email.toLowerCase().includes(term);
      const matchCompany = u.companyName && u.companyName.toLowerCase().includes(term);
      const matchTrade = u.primaryTrade && u.primaryTrade.toLowerCase().includes(term);
      if (!matchName && !matchEmail && !matchCompany && !matchTrade) return false;
    }

    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && u.applicationCategory !== categoryFilter) return false;
    if (tradeFilter !== 'all' && u.primaryTrade !== tradeFilter) return false;
    if (planningFilter !== 'all') {
      const isEligible = planningFilter === 'eligible';
      if (u.planningEligible !== isEligible) return false;
    }

    return true;
  });

  // Filtered Companies
  const filteredCompanies = companiesList.filter(c => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        c.companyName.toLowerCase().includes(term) ||
        c.businessEmail.toLowerCase().includes(term) ||
        c.mainContactName.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Render individual profile sub-view if selected
  if (selectedUserId) {
    return <IndividualProfileView userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  // Render company profile sub-view if selected
  if (selectedCompanyId) {
    return <CompanyProfileView companyId={selectedCompanyId} onBack={() => setSelectedCompanyId(null)} />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="card-header" style={{ marginBottom: '16px', borderBottom: 'none' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
            People & Subcontractor Directory
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage individuals, subcontractor firms, competency documents, and application approvals.
          </p>
        </div>
      </div>

      {/* View Selector (Responsive Mobile Dropdown vs Desktop Tabs) */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '20px' }}>
        {/* Mobile Dropdown View Selector */}
        <div className="mobile-only" style={{ marginBottom: '8px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Directory View</label>
          <select
            className="form-select"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
          >
            <option value="individuals">Individuals Directory ({usersList.filter(u => u.status !== 'pending').length})</option>
            <option value="companies">Contractor Companies ({companiesList.length})</option>
            <option value="applications">Pending Applications ({usersList.filter(u => u.status === 'pending').length})</option>
            <option value="attention">Attention Needed Dashboard</option>
            <option value="settings">Requirements & Settings</option>
          </select>
        </div>

        {/* Desktop Visible Tab Buttons */}
        <div className="desktop-only" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'individuals' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveTab('individuals')}
          >
            <Users size={16} />
            <span>Individuals ({usersList.filter(u => u.status !== 'pending').length})</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'companies' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveTab('companies')}
          >
            <Building2 size={16} />
            <span>Companies ({companiesList.length})</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'applications' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveTab('applications')}
          >
            <Clock size={16} />
            <span>Applications ({usersList.filter(u => u.status === 'pending').length})</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'attention' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveTab('attention')}
          >
            <AlertCircle size={16} />
            <span>Attention Needed</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`btn ${activeTab === 'settings' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={16} />
              <span>Settings & Config</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-VIEW 1: INDIVIDUALS DIRECTORY */}
      {activeTab === 'individuals' && (
        <>
          {/* Search & Filter Panel */}
          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 2, minWidth: '240px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by name, email, company, or trade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>

              <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ flex: 1, minWidth: '150px' }}>
                <option value="all">All Categories</option>
                <option value="GVD Employee">GVD Employee</option>
                <option value="Individual Contractor">Individual Contractor</option>
                <option value="Contractor Company">Contractor Company</option>
              </select>

              <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: 1, minWidth: '130px' }}>
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="inactive">Inactive</option>
                <option value="rejected">Rejected</option>
              </select>

              <select className="form-select" value={planningFilter} onChange={(e) => setPlanningFilter(e.target.value)} style={{ flex: 1, minWidth: '140px' }}>
                <option value="all">Planner Status</option>
                <option value="eligible">Planning Eligible</option>
                <option value="ineligible">Not Eligible</option>
              </select>
            </div>
          </div>

          {/* Directory Content List */}
          <div className="card">
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading individuals...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No individuals match the selected search filters.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Individual Operative</th>
                        <th>Category</th>
                        <th>Contact Email & Phone</th>
                        <th>Primary Trade</th>
                        <th>Planning</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.uid}>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.fullName}</div>
                            {user.companyName && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.companyName}</div>}
                          </td>
                          <td><span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{user.applicationCategory}</span></td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>{user.email}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.phone || 'No phone'}</div>
                          </td>
                          <td><span style={{ fontWeight: 600 }}>{user.primaryTrade || 'General'}</span></td>
                          <td>{user.planningEligible ? <span className="badge badge-valid">Eligible</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Off</span>}</td>
                          <td><span className={`badge badge-${user.status === 'approved' ? 'approved' : 'blocked'}`}>{user.status}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button type="button" className="btn btn-navy btn-sm" onClick={() => setSelectedUserId(user.uid)}>
                              <span>View Profile</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredUsers.map(user => {
                    const uDocs = docsList.filter(d => d.holderId === user.uid);
                    const attentionCount = uDocs.filter(d => d.reviewStatus === 'Awaiting Review' || calculateCompetencyStatus(d) === 'Expired').length;

                    return (
                      <div
                        key={user.uid}
                        onClick={() => setSelectedUserId(user.uid)}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{user.fullName}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {user.companyName ? `${user.companyName} | ` : ''}Trade: {user.primaryTrade || 'General'}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <span className={`badge badge-${user.status === 'approved' ? 'approved' : 'blocked'}`} style={{ fontSize: '0.7rem' }}>
                              {user.status}
                            </span>
                            {attentionCount > 0 && (
                              <span className="badge badge-expiring" style={{ fontSize: '0.7rem' }}>
                                {attentionCount} need attention
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* SUB-VIEW 2: COMPANIES DIRECTORY */}
      {activeTab === 'companies' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Main Contact</th>
                  <th>Contact Email & Phone</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map(comp => (
                  <tr key={comp.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{comp.companyName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{comp.tradingName || ''}</div>
                    </td>
                    <td>{comp.mainContactName}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{comp.businessEmail}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{comp.businessPhone}</div>
                    </td>
                    <td><span className="badge badge-approved">{comp.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn btn-navy btn-sm" onClick={() => setSelectedCompanyId(comp.id)}>
                        <span>Company Profile</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: APPLICATIONS (STAGE 1 PRESERVED) */}
      {activeTab === 'applications' && (
        <UsersAdminView />
      )}

      {/* SUB-VIEW 4: ATTENTION NEEDED DASHBOARD */}
      {activeTab === 'attention' && (
        <AttentionNeededView onOpenUserProfile={(uid) => setSelectedUserId(uid)} />
      )}

      {/* SUB-VIEW 5: SETTINGS & CONFIG */}
      {activeTab === 'settings' && isAdmin && (
        <div className="grid-2">
          <RequirementConfigView />
          <CustomFieldsConfigView />
        </div>
      )}
    </div>
  );
};
