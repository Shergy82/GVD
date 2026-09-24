import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, CheckCircle2, Clock, RefreshCw, LogOut, Phone, AlertCircle } from 'lucide-react';

export const PendingApprovalScreen: React.FC = () => {
  const { 
    currentUser, 
    isEmailVerified, 
    resendVerificationEmail, 
    refreshVerificationStatus, 
    logout 
  } = useAuth();

  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleResend = async () => {
    setResendStatus(null);
    setResendError(null);
    setIsSending(true);
    try {
      await resendVerificationEmail();
      setResendStatus("Verification email sent! Please check your inbox and spam folder.");
    } catch (err: any) {
      setResendError(err.message || "Could not send verification email. Please try again later.");
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsRefreshing(true);
    setResendStatus(null);
    setResendError(null);
    try {
      await refreshVerificationStatus();
    } catch (err) {
      console.error("Status check failed:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

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
        maxWidth: '520px',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        padding: '32px 28px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
            marginBottom: '12px'
          }}>
            GVD
          </div>
          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: 700,
            margin: '0 0 8px 0',
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)'
          }}>
            Application Under Review
          </h1>
          <div style={{
            backgroundColor: 'var(--status-info-bg)',
            color: 'var(--status-info-text)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.925rem',
            lineHeight: '1.5',
            fontWeight: 500,
            marginTop: '12px'
          }}>
            Your account has been created. Please verify your email address. GVD will review your application before you can access the app.
          </div>
        </div>

        {/* Verification & Approval Badges */}
        <div style={{
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 16px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Email Verification Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={20} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Email Address
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {currentUser?.email}
                </div>
              </div>
            </div>
            {isEmailVerified ? (
              <span className="badge badge-valid">
                <CheckCircle2 size={12} /> Verified
              </span>
            ) : (
              <span className="badge badge-expiring">
                <Clock size={12} /> Unverified
              </span>
            )}
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

          {/* GVD Review Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={20} style={{ color: 'var(--brand-gold)' }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  GVD Application Status
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Category: {currentUser?.applicationCategory || 'Individual Contractor'}
                </div>
              </div>
            </div>
            <span className="badge badge-pending">
              Pending Approval
            </span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {resendStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success-text)',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}>
            <CheckCircle2 size={16} />
            <span>{resendStatus}</span>
          </div>
        )}

        {resendError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-danger-bg)',
            color: 'var(--status-danger-text)',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}>
            <AlertCircle size={16} />
            <span>{resendError}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {!isEmailVerified && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleResend}
              disabled={isSending}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Mail size={16} />
              <span>{isSending ? "Sending Verification..." : "Resend Verification Email"}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-navy"
            onClick={handleCheckStatus}
            disabled={isRefreshing}
            style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}
          >
            <RefreshCw size={16} className={isRefreshing ? "spin" : ""} />
            <span>{isRefreshing ? "Checking Status..." : "Check Status"}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={logout}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Configured Support Contact */}
        <div style={{
          paddingTop: '18px',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Need assistance with your application?
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '6px' }}>
            <a href="mailto:support@gvdconnect.co.uk" style={{ color: 'var(--brand-gold)', textDecoration: 'none', fontWeight: 600 }}>
              support@gvdconnect.co.uk
            </a>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={14} /> 0800 123 4567
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
