import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ShieldAlert, 
  ArrowRight, 
  Crown, 
  Shield, 
  HardHat, 
  UserCheck, 
  RotateCcw, 
  Settings,
  Sparkles
} from 'lucide-react';

interface LoginScreenProps {
  onNavigateRegister: () => void;
  onNavigateForgotPassword: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateRegister,
  onNavigateForgotPassword
}) => {
  const { login, loginAsDemoUser, resetLoginAndOwnerSetup, designatedOwnerEmail } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Testing & Developer tools state
  const [showTestingTools, setShowTestingTools] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Please enter both your email address and password.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      console.error("Login failed:", err);
      setErrorMsg("Unable to sign in. Check your email and password and try again.");
      setIsSubmitting(false);
    }
  };

  const handleResetState = async () => {
    await resetLoginAndOwnerSetup();
    setEmail('');
    setPassword('');
    setErrorMsg(null);
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 3000);
  };

  const handleQuickLogin = (role: UserRole) => {
    setErrorMsg(null);
    loginAsDemoUser(role);
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
        maxWidth: '460px',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        padding: '36px 30px'
      }}>
        {/* Branding Logo */}
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
            marginBottom: '14px',
            letterSpacing: '0.05em'
          }}>
            GVD
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 6px 0',
            fontFamily: 'var(--font-heading)'
          }}>
            GVD Connect
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Operations & Construction Management
          </p>
        </div>

        {/* First User = Owner Callout Card */}
        <div style={{
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
          border: '1px solid rgba(217, 119, 6, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 16px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(217, 119, 6, 0.2)',
            color: 'var(--brand-gold)',
            marginBottom: '10px'
          }}>
            <Crown size={22} />
          </div>
          <h2 style={{
            margin: '0 0 6px 0',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)'
          }}>
            First Registered User = Owner
          </h2>
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            margin: '0 0 14px 0',
            lineHeight: 1.45
          }}>
            The first user to create an account automatically receives primary <strong>Owner</strong> authority with full administrative control across all projects, labour, purchasing, and users.
          </p>
          <button
            type="button"
            onClick={onNavigateRegister}
            className="btn btn-navy"
            style={{
              width: '100%',
              padding: '11px',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Crown size={16} color="#FBBF24" />
            <span>Register as First User (Owner)</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            or sign in with existing account
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-danger-bg)',
            color: 'var(--status-danger-text)',
            fontSize: '0.875rem',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email address</label>
            <div style={{ position: 'relative' }}>
              <input
                id="email-input"
                type="email"
                className="form-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="username"
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

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="password-input" style={{ marginBottom: 0 }}>Password</label>
              <button
                type="button"
                onClick={onNavigateForgotPassword}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-gold)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Forgotten password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                style={{ paddingLeft: '40px', paddingRight: '44px' }}
                required
              />
              <Lock size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                title={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-navy"
            disabled={isSubmitting}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '12px',
              fontSize: '1rem',
              fontWeight: 700
            }}
          >
            {isSubmitting ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Don't have an account yet?{' '}
            <button
              type="button"
              onClick={onNavigateRegister}
              disabled={isSubmitting}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-gold)',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.9rem'
              }}
            >
              Create an account
            </button>
          </p>
        </div>

        {/* Developer & Testing Options Accordion */}
        <div style={{ marginTop: '22px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setShowTestingTools(!showTestingTools)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Settings size={13} />
            <span>{showTestingTools ? 'Hide Testing & Demo Options' : 'Testing & Reset Options'}</span>
          </button>

          {showTestingTools && (
            <div style={{
              marginTop: '12px',
              padding: '14px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Local Auth State Reset
                </span>
                <button
                  type="button"
                  onClick={handleResetState}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--status-danger-text)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset App State</span>
                </button>
              </div>

              {resetNotice && (
                <div style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success-text)',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '10px'
                }}>
                  Login & local storage state cleared! Ready for new Owner registration.
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Optional test personas:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('Owner')}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'flex-start' }}
                >
                  <Crown size={12} color="#FBBF24" />
                  <span>Owner Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('Admin')}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'flex-start' }}
                >
                  <Shield size={12} color="#3B82F6" />
                  <span>Admin Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('ProjectManager')}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'flex-start' }}
                >
                  <HardHat size={12} color="#10B981" />
                  <span>PM Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('IndividualContractor')}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'flex-start' }}
                >
                  <UserCheck size={12} color="#F59E0B" />
                  <span>Contractor Demo</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
