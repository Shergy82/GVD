import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Download, 
  Upload, 
  Eye, 
  DollarSign,
  Receipt,
  Car,
  Lock,
  Building
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { MOCK_CLAIMS, MOCK_PROJECTS } from '../services/mockData';
import { LiveDataStore } from '../services/liveStore';
import { AttendanceClaim, ClaimStatus } from '../types';

export const ClaimsView: React.FC = () => {
  const { currentUser, isGvdStaff, isContractor, isOwner, isAdmin } = useAuth();
  const [claims, setClaims] = useState<AttendanceClaim[]>(MOCK_CLAIMS);
  const [selectedClaim, setSelectedClaim] = useState<AttendanceClaim>(MOCK_CLAIMS[0]);
  const [newClaimModal, setNewClaimModal] = useState(false);

  // Subscribe to real-time multi-device sync
  React.useEffect(() => {
    const unsub = LiveDataStore.subscribe<AttendanceClaim[]>('claims', MOCK_CLAIMS, (data) => {
      setClaims(data);
    });
    return () => unsub();
  }, []);

  // New claim state (£200/day 3-day Prj A / 2-day Prj B + £100 split travel example)
  const [travelSplitA, setTravelSplitA] = useState('60');
  const [travelSplitB, setTravelSplitB] = useState('40');

  const handleStatusChange = (claimId: string, newStatus: ClaimStatus) => {
    const updated = claims.map(c => c.id === claimId ? {
      ...c,
      status: newStatus,
      approvedBy: currentUser?.fullName,
      approvedAt: new Date().toISOString().split('T')[0]
    } : c);
    setClaims(updated);
    LiveDataStore.update('claims', updated);
  };

  const generateClaimPDF = (claim: AttendanceClaim) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GVD CONTRACTS — INVOICE / CLAIM STATEMENT', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Claim Reference: ${claim.invoiceNumber || claim.id}`, 14, 30);
    doc.text(`Contractor Name: ${claim.personName}`, 14, 36);
    doc.text(`Week Starting: ${claim.weekStartDate}`, 14, 42);
    doc.text(`Status: ${claim.status}`, 14, 48);

    doc.line(14, 54, 196, 54);

    let y = 64;
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 14, y);
    doc.text('Project', 50, y);
    doc.text('Slot / Hours', 110, y);
    doc.text('Cost (£)', 160, y);

    doc.setFont('helvetica', 'normal');
    y += 8;
    claim.daysWorked.forEach(d => {
      doc.text(d.date, 14, y);
      doc.text(d.projectReference, 50, y);
      doc.text(d.slot, 110, y);
      doc.text(`£${(d.calculatedCostPence / 100).toFixed(2)}`, 160, y);
      y += 8;
    });

    if (claim.travelProjectAllocations.length > 0) {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.text('Travel & Expenses Allocations:', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      claim.travelProjectAllocations.forEach(t => {
        doc.text(`Project ${t.projectId} Travel Split`, 14, y);
        doc.text(`£${(t.amountPence / 100).toFixed(2)}`, 160, y);
        y += 6;
      });
    }

    doc.line(14, y + 4, 196, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`TOTAL APPROVED AMOUNT: £${(claim.totalClaimPence / 100).toFixed(2)}`, 14, y + 14);

    doc.save(`${claim.invoiceNumber || 'Claim'}_GVD.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Attendance, Claims & Invoices</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Confirmed weekly attendance claims, expense receipt allocations, and invoice PDF generation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: 'max-content' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setNewClaimModal(true)}>
            <Plus size={16} /> Submit Weekly Claim
          </button>
        </div>
      </div>

      {/* Clean Weekly Claim Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {claims.map(c => {
          const isSelected = c.id === selectedClaim.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedClaim(c)}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                border: isSelected ? '2px solid var(--brand-gold)' : '1px solid var(--border-color)',
                backgroundColor: isSelected ? 'var(--brand-navy)' : 'var(--bg-surface)',
                color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.9rem',
                fontWeight: isSelected ? 700 : 500,
                boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <FileText size={16} color={isSelected ? 'var(--brand-gold)' : 'var(--brand-navy)'} />
              <span style={{ fontWeight: 800 }}>{c.personName}</span>
              <span>(Week Ending {c.weekEndingDate})</span>
              <span className={`badge ${isSelected ? 'badge-valid' : 'badge-info'}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                £{(c.totalClaimPence / 100).toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Claim Details — Full Width 100% */}
      <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selectedClaim.personName}</h3>
                <span className="badge badge-valid">{selectedClaim.status}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Week starting {selectedClaim.weekStartDate} • Invoice Ref: <code>{selectedClaim.invoiceNumber || 'INV-DRAFT'}</code>
              </p>
            </div>

            <div className="btn-group-responsive">
              <button className="btn btn-navy btn-sm" onClick={() => generateClaimPDF(selectedClaim)}>
                <Download size={14} /> Download Invoice PDF
              </button>
              {isGvdStaff && selectedClaim.status === 'Submitted' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(selectedClaim.id, 'Approved')}>
                    Approve Claim
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(selectedClaim.id, 'Rejected')}>
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Claim Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Days Worked Table */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>Confirmed Days & Rates</h4>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap', width: '130px' }}>Date</th>
                      <th style={{ whiteSpace: 'nowrap', width: '220px' }}>Project</th>
                      <th style={{ whiteSpace: 'nowrap', width: '120px' }}>Slot</th>
                      <th style={{ whiteSpace: 'nowrap', width: '130px' }}>Day Rate</th>
                      <th style={{ whiteSpace: 'nowrap', width: '140px' }}>Subtotal (£)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClaim.daysWorked.map((d, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>{d.date}</td>
                        <td style={{ whiteSpace: 'nowrap' }}><span className="ref-tag" style={{ fontWeight: 800, color: 'var(--brand-gold)' }}>{d.projectReference}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{d.slot}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>£{(d.dayRatePence / 100).toFixed(2)}</td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>£{(d.calculatedCostPence / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Travel & Expense Splits */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>
                Travel & Project Allocation Splits
              </h4>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Approved Travel Amount</span>
                  <strong>£{(selectedClaim.travelTotalPence / 100).toFixed(2)}</strong>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedClaim.travelProjectAllocations.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 10px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                      <span>Allocation to Project <strong>{a.projectId}</strong></span>
                      <strong>£{(a.amountPence / 100).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Financial Summary Box */}
            <div style={{ padding: '16px 20px', backgroundColor: 'var(--brand-navy)', color: '#FFF', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--brand-gold)' }}>Total Claim Payable (Excl. VAT / CIS)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF' }}>
                  £{(selectedClaim.totalClaimPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </h3>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#94A3B8' }}>
                <div>Labour: £1,000.00</div>
                <div>Travel Split: £100.00</div>
              </div>
            </div>
          </div>
        </div>

      {/* NEW CLAIM MODAL */}
      {newClaimModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '550px', width: '100%', margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Submit Weekly Attendance Claim</h3>
              <button onClick={() => setNewClaimModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '0.85rem' }}>
              <strong>Pre-filled from Planner:</strong> 3 days on Project A (£600) + 2 days on Project B (£400) at agreed £200/day rate.
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setNewClaimModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Project A Travel Allocation (£)</label>
                  <input type="number" className="form-input" value={travelSplitA} onChange={e => setTravelSplitA(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project B Travel Allocation (£)</label>
                  <input type="number" className="form-input" value={travelSplitB} onChange={e => setTravelSplitB(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Upload Receipt Evidence (Optional)</label>
                <input type="file" className="form-input" />
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                Calculated Total: <strong>£{(1000 + (parseInt(travelSplitA) || 0) + (parseInt(travelSplitB) || 0)).toFixed(2)}</strong>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setNewClaimModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Claim</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
