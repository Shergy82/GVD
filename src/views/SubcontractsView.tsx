import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Download, 
  FileCheck, 
  AlertTriangle, 
  Lock,
  Building
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { MOCK_SUBCONTRACT_ORDERS, MOCK_SUBCONTRACT_VARIATIONS, MOCK_SUBCONTRACT_APPLICATIONS } from '../services/mockData';
import { SubcontractOrder, SubcontractVariation, SubcontractApplication } from '../types';

export const SubcontractsView: React.FC = () => {
  const { currentUser, isGvdStaff, isCompany, isOwner, isAdmin } = useAuth();
  const [orders, setOrders] = useState<SubcontractOrder[]>(MOCK_SUBCONTRACT_ORDERS);
  const [variations, setVariations] = useState<SubcontractVariation[]>(MOCK_SUBCONTRACT_VARIATIONS);
  const [applications, setApplications] = useState<SubcontractApplication[]>(MOCK_SUBCONTRACT_APPLICATIONS);

  const selectedOrder = orders[0]; // GVD-SCO-2026-001 (Apex Plumbing)

  const generateApprovalPdf = (order: SubcontractOrder, app: SubcontractApplication) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GVD CONTRACTS — INTERIM PAYMENT CERTIFICATE', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Subcontract Order Ref: ${order.reference}`, 14, 30);
    doc.text(`Subcontractor: ${order.companyName}`, 14, 36);
    doc.text(`Project: ${order.projectReference}`, 14, 42);
    doc.text(`Certificate No: ${app.applicationNumber}`, 14, 48);

    doc.line(14, 54, 196, 54);

    let y = 66;
    doc.setFont('helvetica', 'bold');
    doc.text('Financial Statement Summary', 14, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.text(`Original Subcontract Value: £${(order.originalValuePence / 100).toLocaleString()}`, 14, y); y += 8;
    doc.text(`Approved Variations To Date: £${(order.approvedVariationsPence / 100).toLocaleString()}`, 14, y); y += 8;
    doc.text(`Current Authorised Value: £${(order.currentAuthorizedValuePence / 100).toLocaleString()}`, 14, y); y += 8;
    doc.text(`Cumulative Certified to Date: £${(order.certifiedAmountPence / 100).toLocaleString()}`, 14, y); y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text(`REMAINING UNCLAIMED ENTITLEMENT: £${(order.remainingEntitlementPence / 100).toLocaleString()}`, 14, y + 4);

    doc.line(14, y + 12, 196, y + 12);
    y += 20;

    doc.setFontSize(9);
    doc.text(`Certified By: Phil Shergold (Owner / GVD Contracts)`, 14, y); y += 6;
    doc.text(`Timestamp: ${new Date().toISOString()}`, 14, y); y += 6;
    doc.text(`Digital Verification Hash: SHA256-GVD-SCO-${app.id}-VERIFIED`, 14, y);

    doc.save(`${order.reference}_Interim_Cert_${app.applicationNumber}.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Subcontract Orders, Variations & Interim Payments</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Company trade contracts, variation approvals, cumulative interim payment applications, and certified PDF snapshots.
          </p>
        </div>
      </div>

      {/* Main Order Financial Overview Box (Section 15 Scenario I Example!) */}
      <div className="card" style={{ backgroundColor: 'var(--brand-navy)', color: '#FFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
          <div>
            <span style={{ color: 'var(--brand-gold)', fontWeight: 700, fontSize: '0.85rem' }}>SUBCONTRACT ACCOUNT</span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFF', marginTop: '2px' }}>
              {selectedOrder.reference} — {selectedOrder.companyName}
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
              Trade: {selectedOrder.trade} • Project: {selectedOrder.projectReference}
            </p>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => generateApprovalPdf(selectedOrder, applications[0])}>
            <Download size={14} /> Download Signed PDF Snapshot
          </button>
        </div>

        <div className="grid-4">
          <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Original Contract</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '2px' }}>
              £{(selectedOrder.originalValuePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Approved Variations</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-gold)', marginTop: '2px' }}>
              +£{(selectedOrder.approvedVariationsPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Cumulative Certified</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34D399', marginTop: '2px' }}>
              £{(selectedOrder.certifiedAmountPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'rgba(217, 119, 6, 0.2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand-gold)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', fontWeight: 700 }}>Remaining Entitlement</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFF', marginTop: '2px' }}>
              £{(selectedOrder.remainingEntitlementPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Variations & Applications Stacked Vertically for Full Width & Zero Clipping */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        {/* Variations List */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="card-title">Variations Log</h3>
            {isCompany && (
              <button className="btn btn-outline btn-sm">
                <Plus size={14} /> Submit Variation Request
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', width: '100px' }}>Ref</th>
                  <th style={{ minWidth: '220px' }}>Description</th>
                  <th style={{ whiteSpace: 'nowrap', width: '110px' }}>Value</th>
                  <th style={{ whiteSpace: 'nowrap', width: '120px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {variations.map(v => (
                  <tr key={v.id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 800, color: 'var(--brand-navy)' }}>{v.variationReference}</td>
                    <td style={{ minWidth: '220px', lineHeight: '1.4' }}>{v.description}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--brand-gold)' }}>+£{(v.netValuePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><span className="badge badge-valid"><CheckCircle2 size={12} /> {v.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interim Applications */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="card-title">Cumulative Interim Applications</h3>
            {isCompany && (
              <button className="btn btn-primary btn-sm">
                <Plus size={14} /> Submit Interim Application
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', width: '90px' }}>App No.</th>
                  <th style={{ whiteSpace: 'nowrap', width: '140px' }}>Cumulative Claimed</th>
                  <th style={{ whiteSpace: 'nowrap', width: '140px' }}>Certified Amount</th>
                  <th style={{ whiteSpace: 'nowrap', width: '120px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>No. {app.applicationNumber}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>£{(app.cumulativeWorkClaimedPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 800, color: '#059669' }}>£{((app.certifiedAmountPence || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><span className="badge badge-valid"><CheckCircle2 size={12} /> {app.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
