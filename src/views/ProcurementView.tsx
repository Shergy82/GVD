import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  FileCheck, 
  Sparkles, 
  Search, 
  AlertTriangle, 
  Download, 
  Building
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MOCK_PURCHASE_ORDERS, MOCK_SUPPLIER_INVOICES, MOCK_PROJECTS } from '../services/mockData';
import { PurchaseOrder, SupplierInvoice } from '../types';

export const ProcurementView: React.FC = () => {
  const { currentUser, isGvdStaff, isOwner, isAdmin } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(MOCK_PURCHASE_ORDERS);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>(MOCK_SUPPLIER_INVOICES);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder>(MOCK_PURCHASE_ORDERS[0]);
  const [newPoModal, setNewPoModal] = useState(false);

  // Form states
  const [supplierName, setSupplierName] = useState('Travis Perkins');
  const [purpose, setPurpose] = useState('Timber, plasterboard & fixings');
  const [amount, setAmount] = useState('850');

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    const count = purchaseOrders.length + 1;
    const refStr = `GVD-PO-2026-${count.toString().padStart(3, '0')}`;
    const newPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      reference: refStr,
      projectId: 'prj-001',
      projectReference: 'GVD-PRJ-2026-001',
      supplierName,
      purposeItems: purpose,
      requestedBy: currentUser?.uid || 'user-pm-01',
      requestedByName: currentUser?.fullName || 'Dave Miller',
      approvedValuePence: parseInt(amount) * 100,
      status: 'Pending Approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setPurchaseOrders([newPo, ...purchaseOrders]);
    setSelectedPo(newPo);
    setNewPoModal(false);
  };

  const handleApprovePo = (poId: string) => {
    setPurchaseOrders(prev => prev.map(p => p.id === poId ? {
      ...p,
      status: 'Approved',
      approvedBy: currentUser?.uid,
      approvedByName: currentUser?.fullName
    } : p));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Purchase Orders & Supplier Invoices</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Atomic PO reference generation, spend controls, AI invoice matching, and commitment accounting.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: 'max-content' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setNewPoModal(true)}>
            <Plus size={16} /> Request Purchase Order
          </button>
        </div>
      </div>

      {/* Clean Purchase Order Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {purchaseOrders.map(po => {
          const isSelected = po.id === selectedPo.id;
          return (
            <button
              key={po.id}
              onClick={() => setSelectedPo(po)}
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
              <ShoppingBag size={16} color={isSelected ? 'var(--brand-gold)' : 'var(--brand-navy)'} />
              <span className="ref-tag" style={{ color: isSelected ? 'var(--brand-gold)' : 'var(--brand-gold-hover)', fontWeight: 800 }}>
                {po.reference}
              </span>
              <span>{po.supplierName}</span>
              <span className={`badge ${isSelected ? 'badge-valid' : 'badge-info'}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                {po.status}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected PO Details — Full Width 100% */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="ref-tag" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--brand-gold)', backgroundColor: 'var(--brand-navy)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                {selectedPo.reference}
              </span>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedPo.supplierName}</h3>
              <span className={`badge ${selectedPo.status === 'Approved' ? 'badge-valid' : 'badge-pending'}`}>{selectedPo.status}</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              Project: <span className="ref-tag" style={{ fontWeight: 700 }}>{selectedPo.projectReference}</span> • Requested by {selectedPo.requestedByName}
            </p>
          </div>

            {isGvdStaff && selectedPo.status === 'Pending Approval' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleApprovePo(selectedPo.id)}>
                Approve Purchase Order
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="grid-2">
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Approved PO Value</span>
                <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--brand-gold-hover)' }}>
                  £{(selectedPo.approvedValuePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Purpose & Materials</span>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '4px' }}>{selectedPo.purposeItems}</div>
              </div>
            </div>

            {/* Matched Supplier Invoices */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Matched Supplier Invoices</h4>
                <span className="badge badge-info"><Sparkles size={12} /> AI Invoice Matching Active</span>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap', width: '160px' }}>Invoice Ref</th>
                      <th style={{ whiteSpace: 'nowrap', width: '130px' }}>Invoice Date</th>
                      <th style={{ whiteSpace: 'nowrap', width: '130px' }}>Net Amount</th>
                      <th style={{ whiteSpace: 'nowrap', width: '110px' }}>VAT</th>
                      <th style={{ whiteSpace: 'nowrap', width: '130px' }}>Gross</th>
                      <th style={{ whiteSpace: 'nowrap', width: '140px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierInvoices.filter(i => i.purchaseOrderId === selectedPo.id || i.poReference === selectedPo.reference).map(inv => (
                      <tr key={inv.id}>
                        <td style={{ whiteSpace: 'nowrap' }}><span className="ref-tag" style={{ fontWeight: 800 }}>{inv.invoiceNumber}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{inv.invoiceDate}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>£{(inv.netPence / 100).toFixed(2)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>£{(inv.vatPence / 100).toFixed(2)}</td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>£{(inv.grossPence / 100).toFixed(2)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}><span className="badge badge-valid"><CheckCircle2 size={12} /> {inv.matchedStatus}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost Commitment Accounting Rule Note */}
            <div style={{ padding: '14px 16px', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              <strong>Cost Recognition Rule:</strong> Invoiced amount (£850.00) is counted as Actual Cost. Uninvoiced PO balance (£0.00) is counted as Committed Cost. No double-counting occurs.
            </div>
          </div>
        </div>

      {/* NEW PO MODAL */}
      {newPoModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Request Purchase Order</h3>
              <button onClick={() => setNewPoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreatePo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Select Supplier</label>
                <input type="text" className="form-input" value={supplierName} onChange={e => setSupplierName(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Purpose / Materials List</label>
                <textarea className="form-textarea" rows={3} value={purpose} onChange={e => setPurpose(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Maximum Estimated Value (£)</label>
                <input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setNewPoModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate PO Reference</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
