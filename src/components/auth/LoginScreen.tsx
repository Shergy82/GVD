import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';
import { Eye, EyeOff, Lock, Mail, ShieldAlert, ArrowRight, Settings, Crown, Shield, HardHat, UserCheck, Sparkles, Building } from 'lucide-react';

interface LoginScreenProps {
  onNavigateRegister: () => void;
  onNavigateForgotPassword: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateRegister,
  onNavigateForgotPassword
}) => {
  const { login, loginAsDemoUser, designatedOwnerEmail, setDesignatedOwnerEmail } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Owner setup modal state
  const [showOwnerSetup, setShowOwnerSetup] = useState(false);
  const [ownerInputEmail, setOwnerInputEmail] = useState(designatedOwnerEmail);
  const [ownerSavedNotice, setOwnerSavedNotice] = useState(false);

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
      // Plain English security error - avoid exposing raw Firebase codes or revealing email existence
      setErrorMsg("Unable to sign in. Check your email and password and try again.");
      setIsSubmitting(false);
    }
  };

  const handleSaveOwnerEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setDesignatedOwnerEmail(ownerInputEmail);
    setOwnerSavedNotice(true);
    setTimeout(() => {
      setOwnerSavedNotice(false);
      setShowOwnerSetup(false);
    }, 1200);
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
        maxWidth: '480px',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        padding: '32px 28px'
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

        {/* 1-Click Instant Demo Login Banner & Actions */}
        <div style={{
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
          border: '1px solid rgba(217, 119, 6, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Sparkles size={16} color="var(--brand-gold)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand-gold)' }}>
              1-Click Instant Access
            </span>
          </div>

          {/* Featured Primary Owner Button */}
          <button
            type="button"
            onClick={() => handleQuickLogin('Owner')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'var(--brand-navy)',
              color: '#FFFFFF',
              border: '1px solid var(--brand-gold)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.95rem',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Crown size={18} color="#FBBF24" />
              </div>
              <div>
                <div style={{ lineHeight: 1.2 }}>Sign In as Owner</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.85 }}>
                  Phil Shergold ({designatedOwnerEmail || 'shergy82@gmail.com'})
                </div>
              </div>
            </div>
            <ArrowRight size={16} color="#FBBF24" />
          </button>

          {/* Other Role Quick Access */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
              Or sign in as team member:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('Admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Shield size={14} color="#3B82F6" />
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('ProjectManager')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <HardHat size={14} color="#10B981" />
                <span>Project Mgr</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('Accounts')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Building size={14} color="#8B5CF6" />
                <span>Accounts</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('IndividualContractor')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <UserCheck size={14} color="#F59E0B" />
                <span>Contractor</span>
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            or password sign in
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="email-input" style={{ marginBottom: 0 }}>Email address</label>
              <button
                type="button"
                onClick={() => setEmail(designatedOwnerEmail || 'shergy82@gmail.com')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-gold)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Use Owner Email
              </button>
            </div>
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

        {/* Initial Owner Configuration Helper */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setShowOwnerSetup(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Settings size={12} />
            <span>Owner Setup Config</span>
          </button>
        </div>

        {/* Owner Setup Modal */}
        {showOwnerSetup && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700 }}>
                Designated Owner Email Setup
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Specify the email address that will automatically receive initial <strong>Owner</strong> authority when registered.
              </p>
              
              <form onSubmit={handleSaveOwnerEmail}>
                <div className="form-group">
                  <label className="form-label">Owner Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. owner@gvd.co.uk"
                    value={ownerInputEmail}
                    onChange={(e) => setOwnerInputEmail(e.target.value)}
                    required
                  />
                </div>

                {ownerSavedNotice && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--status-success-bg)',
                    color: 'var(--status-success-text)',
                    fontSize: '0.8rem',
                    marginBottom: '12px'
                  }}>
                    Designated owner email updated!
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowOwnerSetup(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-navy btn-sm">
                    Save Owner Email
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
