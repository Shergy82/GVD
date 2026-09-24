import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { ApplicationCategory } from '../../types';
import { User, Building2, UserCheck, ShieldAlert, ArrowLeft, ArrowRight, Eye, EyeOff, Info, Crown } from 'lucide-react';

interface RegisterScreenProps {
  onNavigateLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigateLogin }) => {
  const { registerUser } = useAuth();

  const [category, setCategory] = useState<ApplicationCategory | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone validation helper (UK formats, spaces, + international prefixes)
  const validatePhone = (val: string): boolean => {
    const clean = val.trim();
    // Accepts +44, 07..., 01..., 02..., +1..., with spaces, hyphens, brackets
    const phoneRegex = /^(\+[\d\s\-\(\)]{7,20}|0[\d\s\-\(\)]{9,14})$/;
    return phoneRegex.test(clean);
  };

  // Password validation helper: min 8 chars, 1 uppercase, 1 digit
  const validatePasswordStrength = (pass: string): boolean => {
    return pass.length >= 8 && /[A-Z]/.test(pass) && /[0-9]/.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!category) {
      setErrorMsg("Please select how you will use GVD Connect.");
      return;
    }

    if (category === 'Contractor Company' && !companyName.trim()) {
      setErrorMsg("Please enter your Company Name.");
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!phone.trim() || !validatePhone(phone)) {
      setErrorMsg("Please enter a valid phone number (accepts UK spacing and international prefixes).");
      return;
    }

    if (!validatePasswordStrength(password)) {
      setErrorMsg("Password must be at least 8 characters long and contain at least 1 uppercase letter and 1 number.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please check and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser({
        email,
        password,
        fullName,
        phone,
        applicationCategory: category,
        companyName: category === 'Contractor Company' ? companyName : undefined,
        companyContactPerson: category === 'Contractor Company' ? fullName : undefined
      });
    } catch (err: any) {
      console.error("Registration error:", err);
      let userFriendlyError = "Registration failed. Please check your details and try again.";
      if (err.code === 'auth/email-already-in-use') {
        userFriendlyError = "An account with this email address already exists. Please sign in instead.";
      } else if (err.code === 'auth/weak-password') {
        userFriendlyError = "The password is too weak. Please create a stronger password.";
      } else if (err.message) {
        userFriendlyError = err.message;
      }
      setErrorMsg(userFriendlyError);
      setIsSubmitting(false);
      // Notice: password and confirmPassword remain intact or can be re-entered, non-sensitive form entries like fullName, email, phone are preserved!
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
            fontSize: '1.6rem',
            fontWeight: 700,
            margin: '0 0 6px 0',
            fontFamily: 'var(--font-heading)'
          }}>
            Create Your Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Join GVD Connect
          </p>
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

        {/* Step 1: Category Selection */}
        {!category ? (
          <div>
            <h2 style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '8px',
              color: 'var(--text-primary)'
            }}>
              How will you use GVD Connect?
            </h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'rgba(217, 119, 6, 0.12)',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              color: 'var(--brand-gold)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '20px',
              lineHeight: 1.4,
              textAlign: 'center'
            }}>
              <Crown size={18} style={{ flexShrink: 0 }} />
              <span>Initial Setup Mode: The first registered account automatically receives primary Owner authority.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={() => setCategory('GVD Employee')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-gold)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--brand-gold-light)',
                  color: 'var(--brand-gold-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <UserCheck size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    GVD Employee
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    Direct staff application (subject to management approval)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCategory('Individual Contractor')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-gold)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-info-bg)',
                  color: 'var(--status-info-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <User size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    Individual Contractor
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    Sole trader or independent sub-contractor operative
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCategory('Contractor Company')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-gold)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    Contractor Company
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    Subcontractor firm or supply chain business
                  </div>
                </div>
              </button>
            </div>

            <div style={{ textAlign: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={onNavigateLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Already have an account? Sign In
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Details Form */
          <form onSubmit={handleSubmit} noValidate>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>
                Category: {category}
              </span>
              <button
                type="button"
                onClick={() => setCategory(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-gold)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Change category
              </button>
            </div>

            {/* Contractor Company Field */}
            {category === 'Contractor Company' && (
              <div className="form-group">
                <label className="form-label" htmlFor="company-name">Company Name *</label>
                <input
                  id="company-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Electrical Services Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            )}

            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="full-name">
                {category === 'Contractor Company' ? "Main Contact's Full Name *" : "Full Name *"}
              </label>
              <input
                id="full-name"
                type="text"
                className="form-input"
                placeholder="e.g. John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="register-email">
                {category === 'Contractor Company' ? "Main Contact's Email *" : "Email Address *"}
              </label>
              <input
                id="register-email"
                type="email"
                className="form-input"
                placeholder="john.smith@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>

            {/* Mobile / Contact Number */}
            <div className="form-group">
              <label className="form-label" htmlFor="register-phone">
                Mobile / Contact Number *
              </label>
              <input
                id="register-phone"
                type="tel"
                className="form-input"
                placeholder="e.g. 07700 900123 or +44 7700 900123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
                autoComplete="tel"
                required
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Accepts UK phone numbers and international prefixes.
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="register-password">Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Create password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  style={{ paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: password && !validatePasswordStrength(password) ? 'var(--status-danger-text)' : 'var(--text-secondary)',
                marginTop: '4px',
                lineHeight: '1.3'
              }}>
                Password policy: At least 8 characters, 1 uppercase letter, and 1 number.
              </div>
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password *</label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCategory(null)}
                disabled={isSubmitting}
                style={{ flex: '1' }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button
                type="submit"
                className="btn btn-navy"
                disabled={isSubmitting}
                style={{ flex: '2', fontWeight: 700 }}
              >
                {isSubmitting ? (
                  <span>Submitting Application...</span>
                ) : (
                  <>
                    <span>Submit Application</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={onNavigateLogin}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-gold)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Already registered? Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
