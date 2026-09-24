import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  FileText, 
  Download, 
  Share2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Building, 
  Truck, 
  Store, 
  DollarSign, 
  X, 
  Send, 
  Camera, 
  Check, 
  ArrowRight,
  Eye,
  AlertTriangle
} from 'lucide-react';
import type { 
  UserProfile, 
  ProjectRecord, 
  MaterialsRequest, 
  PurchaseOrder, 
  SupplierRecord,
  RequestItem,
  MaterialReceiptRecord
} from '../types';
import { 
  fetchSuppliers, 
  createMaterialsRequest, 
  recordMaterialReceipt,
  formatPence
} from '../services/purchasingService';
import { fetchProjects } from '../services/projectService';
import { generatePurchaseOrderPDF } from '../services/pdfService';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';

interface ContractorMaterialsViewProps {
  currentUser: UserProfile;
  initialProjectId?: string;
  onNavigateProject?: (projectId: string) => void;
}

export const ContractorMaterialsView: React.FC<ContractorMaterialsViewProps> = ({
  currentUser,
  initialProjectId,
  onNavigateProject
}) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'orders'>('requests');
  const [requests, setRequests] = useState<MaterialsRequest[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // New Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [suggestedSupplier, setSuggestedSupplier] = useState('');
  const [purpose, setPurpose] = useState('');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [deliveryType, setDeliveryType] = useState<'collection' | 'delivery'>('collection');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isItemised, setIsItemised] = useState(false);
  const [items, setItems] = useState<{ id: string; description: string; quantity: number; unitDescription: string; unitPrice: string }[]>([
    { id: '1', description: '', quantity: 1, unitDescription: 'units', unitPrice: '' }
  ]);
  const [totalOnlyAmount, setTotalOnlyAmount] = useState('');
  const [valueBasis, setValueBasis] = useState<'Net' | 'VAT' | 'Gross'>('Gross');
  const [supportingNote, setSupportingNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Query Response Modal
  const [selectedQueryRequest, setSelectedQueryRequest] = useState<MaterialsRequest | null>(null);
  const [queryResponseText, setQueryResponseText] = useState('');

  // Material Receipt Modal
  const [receiptPo, setReceiptPo] = useState<PurchaseOrder | null>(null);
  const [receiptType, setReceiptType] = useState<'All received' | 'Part received' | 'Issue with delivery'>('All received');
  const [receiptNote, setReceiptNote] = useState('');
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  // Success Notification
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allSupps, allPrjs] = await Promise.all([
        fetchSuppliers(),
        fetchProjects(currentUser)
      ]);
      setSuppliers(allSupps);
      setProjects(allPrjs);

      // Load user's requests from Firestore or localStorage
      try {
        const reqSnap = await getDocs(
          query(collection(db, 'materials_requests'), where('requesterUid', '==', currentUser.uid))
        );
        const reqList = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialsRequest));
        setRequests(reqList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch (e) {
        // Local fallback
      }

      // Load user's issued POs
      try {
        const poSnap = await getDocs(
          query(collection(db, 'purchase_orders'), where('requesterUid', '==', currentUser.uid))
        );
        const poList = poSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));
        setPurchaseOrders(poList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch (e) {}

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill delivery address when project changes
  useEffect(() => {
    if (selectedProjectId) {
      const prj = projects.find(p => p.id === selectedProjectId);
      if (prj && deliveryType === 'delivery') {
        setDeliveryAddress(prj.address || '');
      }
    }
  }, [selectedProjectId, deliveryType, projects]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: String(Date.now()), description: '', quantity: 1, unitDescription: 'units', unitPrice: '' }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const calculateGrossTotalPence = (): number => {
    if (!isItemised) {
      const val = parseFloat(totalOnlyAmount || '0');
      return Math.round(val * 100);
    }
    const sumPence = items.reduce((sum, item) => {
      const price = parseFloat(item.unitPrice || '0');
      const qty = item.quantity || 0;
      return sum + Math.round(price * qty * 100);
    }, 0);
    return sumPence;
  };

  const handleCreateRequest = async (submitNow: boolean) => {
    setFormError(null);
    if (!selectedProjectId) {
      setFormError('Please select a project you are assigned to.');
      return;
    }
    if (!purpose.trim()) {
      setFormError('Please describe the materials needed and reason.');
      return;
    }
    if (!selectedSupplierId && !suggestedSupplier.trim()) {
      setFormError('Please choose a supplier or enter a suggested supplier.');
      return;
    }

    const grossPence = calculateGrossTotalPence();
    if (grossPence <= 0) {
      setFormError('Estimated amount must be greater than £0.00.');
      return;
    }

    const prj = projects.find(p => p.id === selectedProjectId);
    if (!prj) {
      setFormError('Selected project is invalid.');
      return;
    }

    const supp = suppliers.find(s => s.id === selectedSupplierId);

    setSubmitting(true);
    try {
      const reqItems: RequestItem[] = isItemised
        ? items.map(item => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitDescription: item.unitDescription,
            estimatedUnitPricePence: Math.round(parseFloat(item.unitPrice || '0') * 100),
            estimatedTotalPence: Math.round(parseFloat(item.unitPrice || '0') * item.quantity * 100)
          }))
        : [];

      const { request, poIssued } = await createMaterialsRequest(
        {
          projectId: prj.id,
          projectReference: prj.reference,
          projectName: prj.name,
          supplierId: supp?.id,
          supplierName: supp?.name,
          suggestedSupplier: supp ? undefined : suggestedSupplier.trim(),
          purpose: purpose.trim(),
          requiredByDate: requiredByDate || undefined,
          isItemised,
          items: reqItems,
          estimatedTotalPence: grossPence,
          valueBasis,
          netAmountPence: Math.round(grossPence / 1.2),
          vatAmountPence: grossPence - Math.round(grossPence / 1.2),
          grossAmountPence: grossPence,
          taxBreakdownConfirmed: false,
          deliveryType,
          deliveryAddress: deliveryAddress || prj.address || 'Trade Counter Collection',
          submitNow
        },
        currentUser,
        purchaseOrders,
        []
      );

      setRequests(prev => [request, ...prev]);
      if (poIssued) {
        setPurchaseOrders(prev => [poIssued, ...prev]);
        setSuccessBanner(`Materials Request ${request.requestReference} approved immediately! PO ${poIssued.poReference} is ready.`);
      } else {
        setSuccessBanner(submitNow
          ? `Request ${request.requestReference} submitted for GVD project review.`
          : `Draft request ${request.requestReference} saved.`);
      }

      setShowRequestModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedSupplierId('');
    setSuggestedSupplier('');
    setPurpose('');
    setRequiredByDate('');
    setDeliveryType('collection');
    setDeliveryAddress('');
    setIsItemised(false);
    setItems([{ id: '1', description: '', quantity: 1, unitDescription: 'units', unitPrice: '' }]);
    setTotalOnlyAmount('');
    setSupportingNote('');
  };

  const handleSendQueryResponse = async () => {
    if (!selectedQueryRequest || !queryResponseText.trim()) return;
    try {
      const now = new Date().toISOString();
      const queries = selectedQueryRequest.queries || [];
      if (queries.length > 0) {
        queries[queries.length - 1].responseByUid = currentUser.uid;
        queries[queries.length - 1].responseByName = currentUser.fullName;
        queries[queries.length - 1].responseAt = now;
        queries[queries.length - 1].responseText = queryResponseText.trim();
      }

      await updateDoc(doc(db, 'materials_requests', selectedQueryRequest.id), {
        queries,
        status: 'Submitted', // Return to submitted for reviewer inspection
        updatedAt: now
      });

      setRequests(prev => prev.map(r => r.id === selectedQueryRequest.id ? { ...r, queries, status: 'Submitted' } : r));
      setSelectedQueryRequest(null);
      setQueryResponseText('');
      setSuccessBanner('Response sent to GVD Project Manager.');
    } catch (e: any) {
      alert(e.message || 'Error sending response');
    }
  };

  const handleRecordReceiptSubmit = async () => {
    if (!receiptPo) return;
    setSubmittingReceipt(true);
    try {
      const updated = await recordMaterialReceipt(
        receiptPo,
        {
          type: receiptType,
          receivedDate: new Date().toISOString().slice(0, 10),
          note: receiptNote.trim() || undefined
        },
        currentUser
      );
      setPurchaseOrders(prev => prev.map(p => p.id === updated.id ? updated : p));
      setReceiptPo(null);
      setReceiptNote('');
      setSuccessBanner(`Materials receipt logged against ${updated.poReference}.`);
    } catch (e: any) {
      alert(e.message || 'Error recording receipt');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px' }}>
      {/* Top Banner & Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={24} style={{ color: 'var(--brand-gold, #D97706)' }} />
            Materials & Purchasing
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Request project materials, track approval status and show official POs to merchants.
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setShowRequestModal(true); }}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontWeight: 700,
            borderRadius: '10px'
          }}
        >
          <Plus size={18} />
          <span>Request Materials</span>
        </button>
      </div>

      {successBanner && (
        <div style={{
          padding: '12px 16px',
          background: '#ECFDF5',
          border: '1px solid #10B981',
          borderRadius: '8px',
          color: '#065F46',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successBanner}</span>
          <button onClick={() => setSuccessBanner(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E2E8F0', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('requests')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'requests' ? '3px solid #0F172A' : 'none',
            color: activeTab === 'requests' ? '#0F172A' : '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock size={16} />
          <span>My Requests ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'orders' ? '3px solid #0F172A' : 'none',
            color: activeTab === 'orders' ? '#0F172A' : '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CheckCircle2 size={16} />
          <span>Authorised POs ({purchaseOrders.length})</span>
        </button>
      </div>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div>
          {requests.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: '#F8FAFC',
              border: '1px dashed #CBD5E1',
              borderRadius: '12px'
            }}>
              <Package size={40} style={{ color: '#94A3B8', marginBottom: '8px' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>No materials requests yet</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: '400px', margin: '6px auto 16px' }}>
                Need fixings, timber, boards or hire equipment for a site? Submit a request and receive an official PO reference.
              </p>
              <button
                onClick={() => { resetForm(); setShowRequestModal(true); }}
                className="btn btn-outline"
                style={{ fontSize: '0.85rem' }}
              >
                + Create First Request
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requests.map(req => {
                const isApproved = req.status === 'Approved';
                const isQueried = req.status === 'Queried';
                const isRejected = req.status === 'Rejected';

                return (
                  <div
                    key={req.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                            {req.requestReference}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isApproved ? '#DCFCE7' : isQueried ? '#FEF3C7' : isRejected ? '#FEE2E2' : '#F1F5F9',
                            color: isApproved ? '#166534' : isQueried ? '#92400E' : isRejected ? '#991B1B' : '#475569'
                          }}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                          {req.projectReference} — {req.projectName}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                          {formatPence(req.grossAmountPence)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          Est. Gross ({req.valueBasis})
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#334155', background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: '2px' }}>
                        Supplier: {req.supplierName || req.suggestedSupplier}
                      </div>
                      <div>{req.purpose}</div>
                      {req.isItemised && req.items && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#64748B' }}>
                          {req.items.map((i, idx) => `${i.quantity}x ${i.description}`).join(' • ')}
                        </div>
                      )}
                    </div>

                    {/* Query Alert & Answer Button */}
                    {isQueried && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        color: '#92400E'
                      }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={16} />
                          Reviewer Query:
                        </div>
                        <p style={{ margin: '4px 0 8px 0', fontSize: '0.8rem' }}>
                          {req.queries?.[req.queries.length - 1]?.queryText}
                        </p>
                        <button
                          onClick={() => { setSelectedQueryRequest(req); setQueryResponseText(''); }}
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          Answer Query
                        </button>
                      </div>
                    )}

                    {/* Issued PO Link */}
                    {isApproved && req.issuedPoReference && (
                      <div style={{
                        marginTop: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                          Authorised PO: <strong>{req.issuedPoReference}</strong>
                        </div>
                        <button
                          onClick={() => {
                            const po = purchaseOrders.find(p => p.poReference === req.issuedPoReference);
                            if (po) generatePurchaseOrderPDF(po);
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '0.75rem', borderColor: '#166534', color: '#166534' }}
                        >
                          <Download size={14} style={{ marginRight: '4px' }} />
                          Download PO
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          {purchaseOrders.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: '#F8FAFC',
              border: '1px dashed #CBD5E1',
              borderRadius: '12px'
            }}>
              <CheckCircle2 size={40} style={{ color: '#94A3B8', marginBottom: '8px' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>No issued Purchase Orders yet</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: '400px', margin: '6px auto' }}>
                When your materials request is approved by GVD management, an official PO document is generated here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {purchaseOrders.map(po => {
                const isFulfilled = po.status === 'Fulfilled';
                const isPart = po.status === 'Part Fulfilled';

                return (
                  <div
                    key={po.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                            {po.poReference}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isFulfilled ? '#DCFCE7' : isPart ? '#FEF3C7' : '#EFF6FF',
                            color: isFulfilled ? '#166534' : isPart ? '#92400E' : '#1E40AF'
                          }}>
                            {po.status.toUpperCase()} (Rev {po.revision})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                          Supplier: <strong>{po.supplierName}</strong> | Project: {po.projectReference}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                          {formatPence(po.authorisedGrossPence)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          Authorised Max Gross
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#334155' }}>
                      <div>{po.approvedScope}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                        Delivery: {po.deliveryType === 'collection' ? 'Trade counter collection' : `Delivery to: ${po.deliveryAddress}`}
                      </div>
                    </div>

                    {/* Receipt Status Summary */}
                    {po.receivedMaterials && po.receivedMaterials.length > 0 && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: '0.75rem', color: '#475569' }}>
                        <strong>Materials Logged: </strong>
                        {po.receivedMaterials.map(r => `${r.type} on ${r.receivedDate}${r.note ? ` (${r.note})` : ''}`).join(' • ')}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => generatePurchaseOrderPDF(po)}
                        className="btn btn-sm btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      >
                        <Download size={14} />
                        Download PO PDF
                      </button>

                      {navigator.share && (
                        <button
                          onClick={async () => {
                            try {
                              const doc = generatePurchaseOrderPDF(po, { download: false });
                              const blob = doc.output('blob');
                              const file = new File([blob], `${po.poReference}_Order.pdf`, { type: 'application/pdf' });
                              await navigator.share({
                                title: `Purchase Order ${po.poReference}`,
                                text: `GVD Connect Purchase Order ${po.poReference} for ${po.supplierName}`,
                                files: [file]
                              });
                            } catch (e) {}
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                        >
                          <Share2 size={14} />
                          Share PO
                        </button>
                      )}

                      <button
                        onClick={() => { setReceiptPo(po); setReceiptNote(''); setReceiptType('All received'); }}
                        className="btn btn-sm btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      >
                        <Truck size={14} />
                        Record Materials Received
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* NEW MATERIALS REQUEST MODAL                                */}
      {/* ========================================================= */}
      {showRequestModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 50
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Request Materials
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Generates reference GVD-MR-2026-XXXX. PO issued upon GVD approval.
                </span>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formError && (
                <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #F87171', borderRadius: '8px', color: '#B91C1C', fontSize: '0.8rem' }}>
                  {formError}
                </div>
              )}

              {/* 1. Project Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Project <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.reference} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Supplier Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Supplier / Merchant <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginBottom: '8px' }}
                >
                  <option value="">Select from GVD directory...</option>
                  {suppliers.filter(s => s.isActive).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.address.split(',')[1] || s.address})
                    </option>
                  ))}
                  <option value="unlisted">+ Other / Suggested Supplier</option>
                </select>

                {(!selectedSupplierId || selectedSupplierId === 'unlisted') && (
                  <input
                    type="text"
                    placeholder="Enter unlisted merchant name..."
                    value={suggestedSupplier}
                    onChange={e => setSuggestedSupplier(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                )}
              </div>

              {/* 3. Description / Purpose */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  What is needed & Why? <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 15mm copper tube & compression fittings for 2nd floor wetroom install"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              {/* 4. Itemised vs Total Only Toggle */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                    Pricing Breakdown
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsItemised(!isItemised)}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isItemised ? 'Switch to Simple Total-Only' : '+ Itemise Line by Line'}
                  </button>
                </div>

                {isItemised ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#F8FAFC', padding: '12px', borderRadius: '8px' }}>
                    {items.map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.description}
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          style={{ flex: 2, padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                          style={{ width: '60px', padding: '7px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="£ Unit"
                          value={item.unitPrice}
                          onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                          style={{ width: '80px', padding: '7px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                        />
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddItem}
                      style={{ background: 'none', border: '1px dashed #CBD5E1', padding: '6px', borderRadius: '6px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer', textAlign: 'center', marginTop: '4px' }}
                    >
                      + Add Another Item
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Total estimated cost (£)"
                      value={totalOnlyAmount}
                      onChange={e => setTotalOnlyAmount(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 600 }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                      Detailed merchant items are optional. You can enter an estimated spending ceiling.
                    </span>
                  </div>
                )}
              </div>

              {/* 5. Value Basis & Required By Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Tax Basis
                  </label>
                  <select
                    value={valueBasis}
                    onChange={e => setValueBasis(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    <option value="Gross">Gross (Max Spend Limit)</option>
                    <option value="Net">Net (+ 20% VAT)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Required-by Date
                  </label>
                  <input
                    type="date"
                    value={requiredByDate}
                    onChange={e => setRequiredByDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* 6. Collection vs Delivery */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Fulfillment Method
                </label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('collection')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: deliveryType === 'collection' ? '2px solid #0F172A' : '1px solid #CBD5E1',
                      background: deliveryType === 'collection' ? '#F8FAFC' : '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Store size={16} />
                    Collection
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: deliveryType === 'delivery' ? '2px solid #0F172A' : '1px solid #CBD5E1',
                      background: deliveryType === 'delivery' ? '#F8FAFC' : '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Truck size={16} />
                    Site Delivery
                  </button>
                </div>

                {deliveryType === 'delivery' && (
                  <input
                    type="text"
                    placeholder="Delivery address (defaults to site)"
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                  />
                )}
              </div>

              {/* Calculated Total Display */}
              <div style={{
                background: '#F1F5F9',
                padding: '12px 16px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                  Total Estimated Amount:
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                  {formatPence(calculateGrossTotalPence())}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#F8FAFC'
            }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreateRequest(false)}
                className="btn btn-outline"
                style={{ fontSize: '0.85rem' }}
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreateRequest(true)}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', fontWeight: 700 }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* QUERY RESPONSE MODAL                                       */}
      {/* ========================================================= */}
      {selectedQueryRequest && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 50
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
              Answer Review Query
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              {selectedQueryRequest.requestReference} — {selectedQueryRequest.projectReference}
            </p>

            <div style={{ margin: '14px 0', padding: '12px', background: '#FFFBEB', borderRadius: '8px', fontSize: '0.85rem', color: '#92400E' }}>
              <strong>GVD Question: </strong>
              {selectedQueryRequest.queries?.[selectedQueryRequest.queries.length - 1]?.queryText}
            </div>

            <textarea
              rows={3}
              placeholder="Type your response or clarification here..."
              value={queryResponseText}
              onChange={e => setQueryResponseText(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setSelectedQueryRequest(null)} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button onClick={handleSendQueryResponse} className="btn btn-primary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Submit Response
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RECORD MATERIALS RECEIPT MODAL                             */}
      {/* ========================================================= */}
      {receiptPo && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 50
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
              Record Materials Received
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              PO: <strong>{receiptPo.poReference}</strong> ({receiptPo.supplierName})
            </p>

            <div style={{ margin: '14px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Receipt Status
              </label>
              <select
                value={receiptType}
                onChange={e => setReceiptType(e.target.value as any)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              >
                <option value="All received">All items received in full</option>
                <option value="Part received">Part received (more expected)</option>
                <option value="Issue with delivery">Issue with delivery / Damaged items</option>
              </select>

              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginTop: '4px' }}>
                Delivery Note / Condition Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes or delivery note number..."
                value={receiptNote}
                onChange={e => setReceiptNote(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setReceiptPo(null)} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button
                disabled={submittingReceipt}
                onClick={handleRecordReceiptSubmit}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', fontWeight: 700 }}
              >
                {submittingReceipt ? 'Saving...' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
