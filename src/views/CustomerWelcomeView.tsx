import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Download, 
  Eye, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Smartphone, 
  Copy,
  ArrowLeft
} from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { MOCK_PROJECTS, MOCK_CUSTOMER_TOKEN, MOCK_BOOKINGS } from '../services/mockData';
import { Project, CustomerAccessToken } from '../types';

interface CustomerWelcomeViewProps {
  tokenUrlParam?: string;
  onBackToApp?: () => void;
}

export const CustomerWelcomeView: React.FC<CustomerWelcomeViewProps> = ({ tokenUrlParam, onBackToApp }) => {
  const [tokenData, setTokenData] = useState<CustomerAccessToken>(MOCK_CUSTOMER_TOKEN);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isPublicCustomerView, setIsPublicCustomerView] = useState<boolean>(!!tokenUrlParam);

  const targetProject: Project = MOCK_PROJECTS[0]; // 14 Grosvenor Square
  const publicUrl = `${window.location.origin}/c/${tokenData.rawToken}`;

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { width: 250, margin: 2 }, (err, url) => {
      if (!err && url) {
        setQrDataUrl(url);
      }
    });
  }, [publicUrl]);

  const generateWelcomePdf = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('GVD CONTRACTS', 14, 22);
    doc.setFontSize(14);
    doc.text('CUSTOMER WELCOME & SITE PROGRAMME SHEET', 14, 30);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Project Reference: ${targetProject.reference}`, 14, 42);
    doc.text(`Site Address: ${targetProject.siteAddress}`, 14, 48);
    doc.text(`Client Name: ${targetProject.customerName}`, 14, 54);
    doc.text(`Project Manager: ${targetProject.responsibleManagerName} (020 7946 0123)`, 14, 60);

    doc.line(14, 66, 196, 66);

    // Welcome Message
    doc.setFont('helvetica', 'bold');
    doc.text('Welcome to your GVD Project Live Hub', 14, 76);
    doc.setFont('helvetica', 'normal');
    doc.text('Scan the QR code below using any mobile camera to view your live schedule,', 14, 84);
    doc.text('approved site operatives, and project contact details in real-time.', 14, 90);

    // Embed QR Image
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 14, 100, 60, 60);
    }

    doc.setFontSize(9);
    doc.text(`Direct Web Address:`, 80, 115);
    doc.setFont('helvetica', 'bold');
    doc.text(publicUrl, 80, 122);
    doc.setFont('helvetica', 'normal');
    doc.text('Notice: Financial data, internal commercial notes, and private worker', 80, 134);
    doc.text('details are strictly excluded from this customer portal view.', 80, 140);

    doc.save(`${targetProject.reference}_Welcome_Sheet.pdf`);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // IF PUBLIC CUSTOMER PORTAL VIEW (Rendered when scanning QR code)
  if (isPublicCustomerView) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div className="card" style={{ borderTop: '6px solid var(--brand-gold)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800 }}>
              GVD <span>CONNECT</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--brand-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
              Client Live Programme Portal
            </span>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{targetProject.siteAddress}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Project: {targetProject.reference} • Client: {targetProject.customerName}
            </p>
          </div>

          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Approved Operatives on Site This Week</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {MOCK_BOOKINGS.slice(0, 3).map(b => (
              <div key={b.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem' }}>{b.personName}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{b.trade}</div>
                </div>
                <span className="badge badge-valid">{b.date}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', textAlign: 'center' }}>
            <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Sanitized View: Financials, UTRs, and internal GVD notes are hidden.
          </div>

          {onBackToApp && (
            <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '20px' }} onClick={onBackToApp}>
              <ArrowLeft size={14} /> Back to Main App
            </button>
          )}
        </div>
      </div>
    );
  }

  // GVD ADMIN / STAFF VIEW (Generating the Welcome Sheet)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Customer Welcome Sheet & QR Schedule</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Generate A4 Welcome Sheet with high-entropy token QR code pointing to sanitized live customer schedule.
          </p>
        </div>

        <button className="btn btn-navy" onClick={() => setIsPublicCustomerView(true)}>
          <Eye size={16} /> Preview Customer View
        </button>
      </div>

      <div className="grid-2">
        {/* PDF Generator Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Project Welcome A4 PDF Generator</h3>
            <span className="badge badge-valid">Token Active</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Prints a branded Welcome Sheet for <strong>{targetProject.reference}</strong> ({targetProject.siteAddress}). Includes key contact numbers and the QR code for client live schedule access.
            </p>

            {qrDataUrl && (
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                <img src={qrDataUrl} alt="Customer Access QR Code" style={{ width: '180px', height: '180px' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Scans directly to sanitized mobile view
                </div>
              </div>
            )}

            <button className="btn btn-primary" onClick={generateWelcomePdf}>
              <Download size={16} /> Print / Download A4 Welcome PDF
            </button>
          </div>
        </div>

        {/* Security & Access Link Control */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Token Security & Revocation Controls</h3>
            <Lock size={18} color="var(--brand-gold)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">High-Entropy Public Portal URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" className="form-input" value={publicUrl} readOnly />
                <button className="btn btn-outline btn-sm" onClick={copyLink}>
                  <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              <strong>Security Protocol:</strong> Possessing this link/QR code grants access only to the sanitized schedule projection. Token can be revoked at any time by GVD Admin.
            </div>

            <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }}>
              Revoke QR Access Token
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
