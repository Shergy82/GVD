import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ForgotPasswordScreenProps {
  onNavigateLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onNavigateLogin }) => {
  const { sendPasswordReset } = useAuth();
  
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await sendPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      // For security, even if Firebase errors (e.g. user-not-found), show generic confirmation message
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
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
        maxWidth: '440px',
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
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'var(--brand-navy)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '1.2rem',
            fontFamily: 'var(--font-heading)',
            marginBottom: '10px'
          }}>
            GVD
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: '0 0 6px 0',
            fontFamily: 'var(--font-heading)'
          }}>
            Forgotten Password
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Reset your GVD Connect account password
          </p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-success-bg)',
              color: 'var(--status-success-text)',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
              Check Your Email
            </h3>
            <p style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              marginBottom: '24px',
              backgroundColor: 'var(--bg-subtle)',
              padding: '14px',
              borderRadius: 'var(--radius-md)'
            }}>
              If an account exists for <strong>{email}</strong>, you'll receive a password-reset link shortly.
            </p>
            <button
              type="button"
              className="btn btn-navy"
              onClick={onNavigateLogin}
              style={{ width: '100%', fontWeight: 700 }}
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {errorMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-danger-bg)',
                color: 'var(--status-danger-text)',
                fontSize: '0.875rem',
                marginBottom: '20px'
              }}>
                <ShieldAlert size={18} />
                <div>{errorMsg}</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email address</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reset-email"
                  type="email"
                  className="form-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  style={{ paddingLeft: '40px' }}
                  required
                />
                <Mail size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-navy"
              disabled={isSubmitting}
              style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '1rem', fontWeight: 700 }}
            >
              {isSubmitting ? "Sending Reset Link..." : "Send Password Reset Link"}
            </button>

            <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={onNavigateLogin}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
