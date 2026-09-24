import React from 'react';
import { 
  Calendar, 
  Clock, 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  Briefcase, 
  ArrowRight, 
  Users, 
  Plus,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  MOCK_BOOKINGS, 
  MOCK_COMPETENCIES, 
  MOCK_CLAIMS, 
  MOCK_PROJECTS,
  MOCK_PURCHASE_ORDERS,
  MOCK_SUBCONTRACT_APPLICATIONS
} from '../services/mockData';

interface HomeDashboardProps {
  onSelectTab: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onSelectTab }) => {
  const { currentUser, isGvdStaff, isContractor, isCompany } = useAuth();

  // Filter bookings for current user or today
  const myBookings = isContractor || isCompany
    ? MOCK_BOOKINGS.filter(b => b.personId === currentUser?.uid)
    : MOCK_BOOKINGS;

  const pendingAcknowledge = myBookings.filter(b => b.status === 'Pending');
  const expiries = MOCK_COMPETENCIES.filter(c => c.reviewStatus === 'Expiring Soon' || c.reviewStatus === 'Expired');
  const pendingClaims = MOCK_CLAIMS.filter(c => c.status === 'Submitted');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFF', padding: '24px 28px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ color: 'var(--brand-gold)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Operations Control
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: '#FFF' }}>
            Welcome back, {currentUser?.fullName}
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '4px' }}>
            {isGvdStaff ? 'Overview of active projects, labour bookings, claims, and compliance alerts.' : 'Here is your current site schedule and pending actions.'}
          </p>
        </div>

        {isGvdStaff && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => onSelectTab('planner')}>
              <Plus size={16} /> Book Workforce
            </button>
            <button className="btn btn-outline" style={{ color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }} onClick={() => onSelectTab('projects')}>
              <Briefcase size={16} /> New Project
            </button>
          </div>
        )}
      </div>

      {/* Action Items Grid */}
      <div className="grid-3">
        {/* Card 1: Today & Upcoming Work */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="var(--brand-gold)" />
              <h3 className="card-title">Booked Work</h3>
            </div>
            <span className="badge badge-info">{myBookings.length} Bookings</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myBookings.slice(0, 3).map(b => (
              <div key={b.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)', borderLeft: '4px solid var(--brand-gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{b.projectReference}</span>
                  <span className={`badge ${b.status === 'Accepted' ? 'badge-valid' : 'badge-pending'}`}>{b.status}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {b.projectAddress}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{b.date} • {b.slot}</span>
                  <span>{b.trade}</span>
                </div>
              </div>
            ))}

            {myBookings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                No active bookings scheduled for this week.
              </div>
            )}
          </div>
          <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '12px' }} onClick={() => onSelectTab('planner')}>
            View Full Schedule <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 2: Competency & Compliance Alerts */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="var(--status-danger-text)" />
              <h3 className="card-title">Compliance Expiries</h3>
            </div>
            <span className="badge badge-expired">{expiries.length} Alerts</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {expiries.map(c => (
              <div key={c.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: c.reviewStatus === 'Expired' ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: c.reviewStatus === 'Expired' ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}>
                    {c.requirementName}
                  </span>
                  <span className={`badge ${c.reviewStatus === 'Expired' ? 'badge-expired' : 'badge-expiring'}`}>
                    {c.reviewStatus}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                  Holder: {c.personName} ({c.trade})
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                  Expiry: {c.expiryDate || 'N/A'}
                </div>
              </div>
            ))}

            {expiries.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--status-success-text)' }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 6px' }} />
                All personnel competencies and certificates valid.
              </div>
            )}
          </div>

          <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '12px' }} onClick={() => onSelectTab('people')}>
            Review All Documents <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 3: Claims & Financial Tasks */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="var(--status-info-text)" />
              <h3 className="card-title">Claims & Approvals</h3>
            </div>
            <span className="badge badge-submitted">{pendingClaims.length} Pending</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {MOCK_CLAIMS.slice(0, 3).map(claim => (
              <div key={claim.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{claim.personName}</span>
                  <span className="badge badge-approved">£{(claim.totalClaimPence / 100).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Week: {claim.weekStartDate} • {claim.daysWorked.length} days worked
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Status: {claim.status}
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '12px' }} onClick={() => onSelectTab('claims')}>
            Manage Claims <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
