import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, Info, CheckCircle2, FolderKanban, ArrowRight } from 'lucide-react';

interface HomeViewProps {
  onNavigateProjects?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigateProjects }) => {
  const { currentUser, isOwner, isAdmin } = useAuth();
  const isContractor = currentUser?.role === 'IndividualContractor' || currentUser?.role === 'ContractorCompany';

  const firstName = currentUser?.fullName?.split(' ')[0] || 'User';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Welcome Card */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, var(--brand-navy) 0%, #1e293b 100%)',
        color: '#FFFFFF',
        padding: '32px 28px',
        border: 'none',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '12px'
            }}>
              <ShieldCheck size={14} style={{ color: 'var(--brand-gold)' }} />
              <span>GVD Connect Stage 3 Active</span>
            </div>
            <h1 style={{
              color: '#FFFFFF',
              fontSize: '2rem',
              fontWeight: 700,
              margin: '0 0 8px 0',
              fontFamily: 'var(--font-heading)'
            }}>
              Welcome, {firstName}!
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '1rem', margin: 0, maxWidth: '600px' }}>
              Your GVD Connect account is active. Access secure project workspaces and site documents below.
            </p>

            {onNavigateProjects && (
              <button
                onClick={onNavigateProjects}
                style={{
                  marginTop: '20px',
                  padding: '12px 20px',
                  backgroundColor: '#38BDF8',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FolderKanban size={18} />
                <span>Open {isContractor ? 'My Jobs' : 'Projects Directory'}</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>

          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Approved Account Role
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-gold)' }}>
              {currentUser?.role}
            </div>
          </div>
        </div>
      </div>

      {/* Account Overview Grid */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Profile Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={20} style={{ color: 'var(--brand-gold)' }} />
              <span>Account Status Summary</span>
            </h2>
            <span className="badge badge-approved">
              <CheckCircle2 size={12} /> Approved
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Full Name</span>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser?.fullName}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Email Address</span>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser?.email}</span>
            </div>

            {currentUser?.companyName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Company</span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser.companyName}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Application Category</span>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser?.applicationCategory}</span>
            </div>
          </div>
        </div>

        {/* System Status Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={20} style={{ color: 'var(--status-info-text)' }} />
              <span>GVD Stage 3 System Active</span>
            </h2>
          </div>

          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            Stage 3 (<strong>Projects and Secure Project Workspaces</strong>) is operational. Access central site records, drawings, safety documents, site photos, and action updates.
          </p>

          {(isOwner || isAdmin) ? (
            <div style={{
              padding: '14px',
              backgroundColor: 'var(--status-info-bg)',
              color: 'var(--status-info-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem'
            }}>
              <strong>Owner/Admin Privileges Active:</strong> You can create projects with atomic reference generation (e.g. GVD-2026-0001), extract AI quotes, set confirmed contract values, and manage security membership.
            </div>
          ) : (
            <div style={{
              padding: '14px',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem'
            }}>
              Contractor View Active: You can view assigned job information, site drawings, upload site photos, and raise site queries directly to your responsible GVD manager.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
