import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Globe, 
  Shield, 
  Lock, 
  FileText, 
  CheckCircle2, 
  Copy,
  Building
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MOCK_AUDIT_LOGS, MOCK_REQUIREMENTS } from '../services/mockData';

export const SettingsView: React.FC = () => {
  const { currentUser, isOwner, isAdmin } = useAuth();
  const [domainInput, setDomainInput] = useState('app.gvdcontracts.co.uk');
  const [copied, setCopied] = useState(false);

  const dnsRecords = [
    { type: 'A', host: 'app', value: '199.36.158.100', status: 'Connected' },
    { type: 'TXT', host: '_acme-challenge.app', value: 'firebase-gvd-verify=998877665544', status: 'Verified' }
  ];

  const copyDns = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Company Settings & System Configuration</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Domain binding, GVD wordmark branding, requirement rules, and immutable audit logs.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Domain Configuration */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Canonical Domain Configuration</h3>
            <Globe size={18} color="var(--brand-gold)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Primary Application URL</label>
              <input type="text" className="form-input" value={domainInput} onChange={e => setDomainInput(e.target.value)} />
            </div>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '6px' }}>Required DNS Records for Firebase Hosting</h4>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Host / Name</th>
                    <th>Target Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dnsRecords.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.type}</strong></td>
                      <td><code>{r.host}</code></td>
                      <td><code>{r.value}</code></td>
                      <td><span className="badge badge-valid"><CheckCircle2 size={10} /> {r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Branding & Wordmark */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Branding & Wordmark Settings</h3>
            <Building size={18} color="var(--brand-navy)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#FFF' }}>
                GVD <span style={{ color: 'var(--brand-gold)' }}>CONNECT</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Official Wordmark Branding</span>
            </div>

            <div className="form-group">
              <label className="form-label">Replace Logo (PNG / SVG)</label>
              <input type="file" className="form-input" accept="image/*" />
            </div>
          </div>
        </div>
      </div>

      {/* Immutable Audit Log Browser */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">System Audit Log (Append-Only)</h3>
          <span className="badge badge-valid"><Shield size={12} /> Server Timestamped</span>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor Name & Role</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_AUDIT_LOGS.map(log => (
                <tr key={log.id}>
                  <td><code>{log.timestamp}</code></td>
                  <td><strong>{log.actorName}</strong> ({log.actorRole})</td>
                  <td><span className="badge badge-info">{log.action}</span></td>
                  <td>{log.entityType}</td>
                  <td>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
