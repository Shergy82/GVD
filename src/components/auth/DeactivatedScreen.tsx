import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldX, LogOut, Phone, Mail } from 'lucide-react';

export const DeactivatedScreen: React.FC = () => {
  const { currentUser, isRejected, logout } = useAuth();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-main)',
      padding: '24px 16px'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        padding: '32px 28px',
        textAlign: 'center'
      }}>
        {/* Icon */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--status-danger-bg)',
          color: 'var(--status-danger-text)',
          marginBottom: '16px'
        }}>
          <ShieldX size={36} />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          margin: '0 0 10px 0',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-heading)'
        }}>
          {isRejected ? "Application Not Approved" : "Access Disabled"}
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
          marginBottom: '24px',
          backgroundColor: 'var(--bg-subtle)',
          padding: '16px',
          borderRadius: 'var(--radius-md)'
        }}>
          {isRejected 
            ? "Your application has not been approved. Please contact GVD for further information."
            : "Your access has been disabled. Please contact GVD."
          }
        </p>

        <button
          type="button"
          className="btn btn-navy"
          onClick={logout}
          style={{ width: '100%', marginBottom: '24px', fontWeight: 700 }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>

        {/* Support Contact */}
        <div style={{
          paddingTop: '18px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            GVD Support Contact
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <a href="mailto:support@gvdconnect.co.uk" style={{ color: 'var(--brand-gold)', textDecoration: 'none', fontWeight: 600 }}>
              <Mail size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              support@gvdconnect.co.uk
            </a>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span>
              <Phone size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              0800 123 4567
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
