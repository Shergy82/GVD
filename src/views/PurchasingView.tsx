import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  FileCheck,
  Receipt,
  Building,
  Settings,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Share2,
  DollarSign,
  Edit3,
  Trash2,
  Eye,
  Check,
  X,
  CreditCard,
  RotateCcw,
  Truck
} from 'lucide-react';
import type {
  UserProfile,
  ProjectRecord,
  SupplierRecord,
  PurchasingRule,
  MaterialsRequest,
  PurchaseOrder,
  SupplierInvoice,
  SupplierCreditNote,
  SupplierPaymentRecord,
  POAllocation,
  ProjectAllocation
} from '../types';
import {
  fetchSuppliers,
  saveSupplier,
  checkDuplicateSupplier,
  fetchPurchasingRules,
  savePurchasingRule,
  reviewMaterialsRequest,
  amendPurchaseOrder,
  cancelPurchaseOrder,
  createSupplierInvoice,
  postSupplierInvoice,
  createSupplierCreditNote,
  recordSupplierPayment,
  reverseSupplierPayment,
  checkDuplicateSupplierInvoice,
  checkCrossModuleExpenseOverlap,
  formatPence
} from '../services/purchasingService';
import { fetchProjects } from '../services/projectService';
import { generatePurchaseOrderPDF } from '../services/pdfService';
import { db } from '../services/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

interface PurchasingViewProps {
  currentUser: UserProfile;
}

export const PurchasingView: React.FC<PurchasingViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'orders' | 'invoices' | 'suppliers' | 'rules'>('requests');
  const [loading, setLoading] = useState(true);

  // Core Data
  const [requests, setRequests] = useState<MaterialsRequest[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [creditNotes, setCreditNotes] = useState<SupplierCreditNote[]>([]);
  const [payments, setPayments] = useState<SupplierPaymentRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [rules, setRules] = useState<PurchasingRule[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [reviewRequest, setReviewRequest] = useState<MaterialsRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'Approve' | 'Query' | 'Reject' | 'ApproveRevised'>('Approve');
  const [reviewQueryText, setReviewQueryText] = useState('');
  const [reviewRejectReason, setReviewRejectReason] = useState('');
  const [revisedGross, setRevisedGross] = useState('');
  const [revisedScope, setRevisedScope] = useState('');

  const [amendPo, setAmendPo] = useState<PurchaseOrder | null>(null);
  const [amendNewGross, setAmendNewGross] = useState('');
  const [amendReason, setAmendReason] = useState('');

  const [cancelPo, setCancelPo] = useState<PurchaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Invoice Entry Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invSupplierId, setInvSupplierId] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invDueDate, setInvDueDate] = useState('');
  const [invGrossAmount, setInvGrossAmount] = useState('');
  const [invNetAmount, setInvNetAmount] = useState('');
  const [invVatTreatment, setInvVatTreatment] = useState('Standard 20%');
  const [invPoLookupRef, setInvPoLookupRef] = useState('');
  const [invPoAllocations, setInvPoAllocations] = useState<POAllocation[]>([]);
  const [invProjectAllocations, setInvProjectAllocations] = useState<ProjectAllocation[]>([]);
  const [invDescription, setInvDescription] = useState('');
  const [invHasException, setInvHasException] = useState(false);
  const [invExceptionReason, setInvExceptionReason] = useState('');
  const [invDuplicateWarning, setInvDuplicateWarning] = useState<string | null>(null);
  const [invCrossModuleWarning, setInvCrossModuleWarning] = useState<string | null>(null);

  // Payment Recording Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payAllocations, setPayAllocations] = useState<{ invoiceId: string; invoiceNumber: string; amountPence: number }[]>([]);

  // Credit Note Modal
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [credSupplierId, setCredSupplierId] = useState('');
  const [credNumber, setCredNumber] = useState('');
  const [credDate, setCredDate] = useState(new Date().toISOString().slice(0, 10));
  const [credGrossAmount, setCredGrossAmount] = useState('');
  const [credProjectId, setCredProjectId] = useState('');
  const [credPoId, setCredPoId] = useState('');
  const [credReason, setCredReason] = useState('');
  const [credEffect, setCredEffect] = useState<'reduces_order' | 'replacement_expected' | 'adjustment'>('reduces_order');
  const [credApplyInvoiceId, setCredApplyInvoiceId] = useState('');

  // Supplier Edit Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [suppName, setSuppName] = useState('');
  const [suppLegalName, setSuppLegalName] = useState('');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppAccountNo, setSuppAccountNo] = useState('');
  const [suppTermsDays, setSuppTermsDays] = useState('30');
  const [suppNotes, setSuppNotes] = useState('');

  // Toast / Error
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const isOwner = currentUser.role === 'Owner';
  const isAdmin = currentUser.role === 'Admin';
  const isAccounts = currentUser.role === 'Accounts';
  const isPM = currentUser.role === 'ProjectManager';

  useEffect(() => {
    loadAllData();
  }, [currentUser]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [allSupps, allRules, allPrjs] = await Promise.all([
        fetchSuppliers(),
        fetchPurchasingRules(),
        fetchProjects(currentUser)
      ]);
      setSuppliers(allSupps);
      setRules(allRules);
      setProjects(allPrjs);

      // Load collections from Firestore
      try {
        const [reqSnap, poSnap, invSnap, cnSnap, paySnap] = await Promise.all([
          getDocs(collection(db, 'materials_requests')),
          getDocs(collection(db, 'purchase_orders')),
          getDocs(collection(db, 'supplier_invoices')),
          getDocs(collection(db, 'supplier_credit_notes')),
          getDocs(collection(db, 'supplier_payments'))
        ]);

        const reqList = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialsRequest));
        const poList = poSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));
        const invList = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierInvoice));
        const cnList = cnSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierCreditNote));
        const payList = paySnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierPaymentRecord));

        setRequests(reqList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setPurchaseOrders(poList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setInvoices(invList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setCreditNotes(cnList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setPayments(payList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch (e) {}

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const showError = (err: string) => {
    setToastError(err);
    setTimeout(() => setToastError(null), 6000);
  };

  /* ========================================================= */
  /* REQUEST REVIEW HANDLER                                    */
  /* ========================================================= */
  const handleExecuteReview = async () => {
    if (!reviewRequest) return;
    try {
      const { request: updated, poIssued } = await reviewMaterialsRequest(
        reviewRequest,
        reviewAction,
        {
          queryText: reviewQueryText,
          rejectionReason: reviewRejectReason,
          revisedGrossPence: revisedGross ? Math.round(parseFloat(revisedGross) * 100) : undefined,
          revisedScope: revisedScope || undefined,
          revisedScopeNote: revisedScope ? `Revised by ${currentUser.fullName}` : undefined
        },
        currentUser,
        purchaseOrders,
        rules
      );

      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      if (poIssued) {
        setPurchaseOrders(prev => [poIssued, ...prev]);
        showToast(`Request approved! Purchase Order ${poIssued.poReference} issued successfully.`);
      } else if (reviewAction === 'Query') {
        showToast(`Query sent to requester ${updated.requesterName}.`);
      } else if (reviewAction === 'Reject') {
        showToast(`Request ${updated.requestReference} rejected.`);
      }

      setReviewRequest(null);
    } catch (err: any) {
      showError(err.message || 'Error processing request review');
    }
  };

  /* ========================================================= */
  /* PO AMENDMENT HANDLER                                      */
  /* ========================================================= */
  const handleExecuteAmend = async () => {
    if (!amendPo || !amendNewGross || !amendReason.trim()) return;
    try {
      const newGrossPence = Math.round(parseFloat(amendNewGross) * 100);
      const updated = await amendPurchaseOrder(
        amendPo,
        {
          newGrossPence,
          changeDescription: `Amended authorised spend to ${formatPence(newGrossPence)}`,
          reason: amendReason.trim()
        },
        currentUser
      );

      setPurchaseOrders(prev => prev.map(p => p.id === updated.id ? updated : p));
      setAmendPo(null);
      showToast(`PO ${updated.poReference} updated to Revision ${updated.revision}.`);
    } catch (e: any) {
      showError(e.message || 'Error amending PO');
    }
  };

  /* ========================================================= */
  /* PO CANCELLATION HANDLER                                   */
  /* ========================================================= */
  const handleExecuteCancel = async () => {
    if (!cancelPo || !cancelReason.trim()) return;
    try {
      const updated = await cancelPurchaseOrder(cancelPo, cancelReason.trim(), currentUser);
      setPurchaseOrders(prev => prev.map(p => p.id === updated.id ? updated : p));
      setCancelPo(null);
      showToast(`PO ${updated.poReference} marked as ${updated.status}. Unused commitments released.`);
    } catch (e: any) {
      showError(e.message || 'Error cancelling PO');
    }
  };

  /* ========================================================= */
  /* INVOICE ENTRY & PO LOOKUP                                 */
  /* ========================================================= */
  const handleLookupPO = (poRef: string) => {
    setInvPoLookupRef(poRef);
    const matched = purchaseOrders.find(p => p.poReference.trim().toUpperCase() === poRef.trim().toUpperCase());
    if (matched) {
      setInvSupplierId(matched.supplierId);
      const prj = projects.find(p => p.id === matched.projectId);

      // Prefill allocations without inventing invoice number or date!
      const grossPence = parseFloat(invGrossAmount || '0') * 100 || matched.remainingAuthorisedGrossPence;
      const netPence = Math.round(grossPence / 1.2);
      const vatPence = grossPence - netPence;

      setInvPoAllocations([{
        poId: matched.id,
        poReference: matched.poReference,
        allocatedGrossPence: Math.min(grossPence, matched.remainingAuthorisedGrossPence),
        allocatedNetPence: Math.round(Math.min(grossPence, matched.remainingAuthorisedGrossPence) / 1.2)
      }]);

      setInvProjectAllocations([{
        projectId: matched.projectId,
        projectReference: matched.projectReference,
        allocatedNetPence: netPence,
        allocatedVatPence: vatPence,
        allocatedGrossPence: grossPence
      }]);

      showToast(`Prefilled from PO ${matched.poReference}: Supplier & Project assigned. (Remaining Headroom: ${formatPence(matched.remainingAuthorisedGrossPence)})`);
    }
  };

  const handleCreateInvoiceSubmit = async () => {
    try {
      const grossPence = Math.round(parseFloat(invGrossAmount || '0') * 100);
      const netPence = invNetAmount ? Math.round(parseFloat(invNetAmount) * 100) : Math.round(grossPence / 1.2);
      const vatPence = grossPence - netPence;

      if (!invSupplierId) throw new Error('Supplier is required.');
      if (!invNumber.trim()) throw new Error('Supplier Invoice Number is mandatory.');
      if (grossPence <= 0) throw new Error('Gross amount must be greater than £0.00.');

      const supp = suppliers.find(s => s.id === invSupplierId);
      if (!supp) throw new Error('Supplier not found.');

      // If no project allocation provided, build one from default project
      let prjAllocs = [...invProjectAllocations];
      if (prjAllocs.length === 0) {
        if (!projects[0]) throw new Error('No projects available.');
        prjAllocs = [{
          projectId: projects[0].id,
          projectReference: projects[0].reference,
          allocatedNetPence: netPence,
          allocatedVatPence: vatPence,
          allocatedGrossPence: grossPence
        }];
      }

      const inv = await createSupplierInvoice(
        {
          supplierId: supp.id,
          supplierName: supp.name,
          supplierInvoiceNumber: invNumber.trim(),
          invoiceDate: invDate,
          dueDate: invDueDate || undefined,
          netAmountPence: netPence,
          vatAmountPence: vatPence,
          grossAmountPence: grossPence,
          vatTreatment: invVatTreatment,
          description: invDescription.trim() || undefined,
          poAllocations: invPoAllocations,
          projectAllocations: prjAllocs,
          hasException: invHasException,
          exceptionReason: invExceptionReason || undefined
        },
        currentUser,
        invoices,
        purchaseOrders,
        []
      );

      setInvoices(prev => [inv, ...prev]);
      setShowInvoiceModal(false);
      showToast(`Supplier Invoice ${inv.supplierInvoiceNumber} entered and queued for review.`);
      resetInvoiceForm();
    } catch (e: any) {
      showError(e.message || 'Error entering invoice');
    }
  };

  const resetInvoiceForm = () => {
    setInvSupplierId('');
    setInvNumber('');
    setInvGrossAmount('');
    setInvNetAmount('');
    setInvPoLookupRef('');
    setInvPoAllocations([]);
    setInvProjectAllocations([]);
    setInvDescription('');
    setInvHasException(false);
    setInvExceptionReason('');
    setInvDuplicateWarning(null);
    setInvCrossModuleWarning(null);
  };

  const handlePostInvoice = async (invoice: SupplierInvoice) => {
    try {
      const { invoice: posted, updatedPOs } = await postSupplierInvoice(invoice, currentUser, purchaseOrders);
      setInvoices(prev => prev.map(i => i.id === posted.id ? posted : i));
      if (updatedPOs.length > 0) {
        setPurchaseOrders(prev => prev.map(po => {
          const m = updatedPOs.find(u => u.id === po.id);
          return m ? m : po;
        }));
      }
      showToast(`Invoice ${posted.supplierInvoiceNumber} posted! Costs recognised immutably.`);
    } catch (e: any) {
      showError(e.message || 'Error posting invoice');
    }
  };

  /* ========================================================= */
  /* PAYMENT RECORDING HANDLER                                 */
  /* ========================================================= */
  const handleRecordPaymentSubmit = async () => {
    try {
      const amountPence = Math.round(parseFloat(payAmount || '0') * 100);
      if (!paySupplierId) throw new Error('Supplier is required.');
      if (!payReference.trim()) throw new Error('Payment Reference is required.');
      if (amountPence <= 0) throw new Error('Payment amount must be greater than £0.00.');
      if (payAllocations.length === 0) throw new Error('Allocate payment to at least one invoice.');

      const supp = suppliers.find(s => s.id === paySupplierId);
      if (!supp) throw new Error('Supplier not found.');

      const { payment, updatedInvoices } = await recordSupplierPayment(
        {
          supplierId: supp.id,
          supplierName: supp.name,
          paymentDate: payDate,
          amountPence,
          paymentReference: payReference.trim(),
          internalNote: payNote.trim() || undefined,
          invoiceAllocations: payAllocations
        },
        currentUser,
        payments,
        invoices
      );

      setPayments(prev => [payment, ...prev]);
      setInvoices(prev => prev.map(inv => {
        const m = updatedInvoices.find(u => u.id === inv.id);
        return m ? m : inv;
      }));

      setShowPaymentModal(false);
      showToast(`External payment of ${formatPence(payment.amountPence)} recorded. Invoices updated.`);
    } catch (e: any) {
      showError(e.message || 'Error recording payment');
    }
  };

  /* ========================================================= */
  /* CREDIT NOTE HANDLER                                       */
  /* ========================================================= */
  const handleRecordCreditSubmit = async () => {
    try {
      const grossPence = Math.round(parseFloat(credGrossAmount || '0') * 100);
      if (!credSupplierId) throw new Error('Supplier is required.');
      if (!credNumber.trim()) throw new Error('Credit Note number is required.');
      if (grossPence <= 0) throw new Error('Amount must be greater than £0.00.');
      if (!credProjectId) throw new Error('Project is required.');

      const supp = suppliers.find(s => s.id === credSupplierId);
      const prj = projects.find(p => p.id === credProjectId);
      if (!supp || !prj) throw new Error('Supplier or Project invalid.');

      const { creditNote, updatedInvoice, updatedPO } = await createSupplierCreditNote(
        {
          supplierId: supp.id,
          supplierName: supp.name,
          creditNoteNumber: credNumber.trim(),
          date: credDate,
          netAmountPence: Math.round(grossPence / 1.2),
          vatAmountPence: grossPence - Math.round(grossPence / 1.2),
          grossAmountPence: grossPence,
          poId: credPoId || undefined,
          projectId: prj.id,
          projectReference: prj.reference,
          creditEffect: credEffect,
          reason: credReason.trim(),
          appliedToInvoiceId: credApplyInvoiceId || undefined
        },
        currentUser,
        invoices,
        purchaseOrders
      );

      setCreditNotes(prev => [creditNote, ...prev]);
      if (updatedInvoice) {
        setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
      }
      if (updatedPO) {
        setPurchaseOrders(prev => prev.map(p => p.id === updatedPO.id ? updatedPO : p));
      }

      setShowCreditModal(false);
      showToast(`Credit Note ${creditNote.creditNoteNumber} recorded. Balances adjusted.`);
    } catch (e: any) {
      showError(e.message || 'Error recording credit note');
    }
  };

  /* ========================================================= */
  /* SUPPLIER DIRECTORY HANDLER                                */
  /* ========================================================= */
  const handleSaveSupplierSubmit = async () => {
    try {
      if (!suppName.trim()) throw new Error('Supplier name is required.');
      if (!suppEmail.trim()) throw new Error('Contact email is required.');

      const dup = checkDuplicateSupplier(suppliers, {
        name: suppName,
        email: suppEmail,
        phone: suppPhone,
        id: editSupplierId || undefined
      });
      if (dup.isLikelyDuplicate) {
        const proceed = window.confirm(`Warning: ${dup.reason}\nDo you still wish to save this supplier?`);
        if (!proceed) return;
      }

      await saveSupplier(
        {
          name: suppName.trim(),
          legalName: suppLegalName.trim() || undefined,
          email: suppEmail.trim(),
          phone: suppPhone.trim(),
          address: suppAddress.trim(),
          gvdAccountNumber: suppAccountNo.trim() || undefined,
          paymentTermsDays: parseInt(suppTermsDays) || 30,
          isActive: true,
          internalNotes: suppNotes.trim() || undefined
        },
        editSupplierId || undefined
      );

      const refreshed = await fetchSuppliers();
      setSuppliers(refreshed);
      setShowSupplierModal(false);
      showToast(`Supplier ${suppName} saved to directory.`);
    } catch (e: any) {
      showError(e.message || 'Error saving supplier');
    }
  };

  /* Filters */
  const filteredRequests = requests.filter(r => {
    if (filterProject && r.projectId !== filterProject) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.requestReference.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        (r.supplierName || '').toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredOrders = purchaseOrders.filter(p => {
    if (filterProject && p.projectId !== filterProject) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.poReference.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        p.projectReference.toLowerCase().includes(q) ||
        p.requesterName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredInvoices = invoices.filter(i => {
    if (filterProject && !i.projectAllocations.some(p => p.projectId === filterProject)) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        i.supplierInvoiceNumber.toLowerCase().includes(q) ||
        i.supplierName.toLowerCase().includes(q) ||
        i.poAllocations.some(p => p.poReference.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      {/* Toast Banners */}
      {toastMessage && (
        <div style={{
          padding: '12px 16px', background: '#ECFDF5', border: '1px solid #10B981',
          borderRadius: '8px', color: '#065F46', fontSize: '0.85rem', fontWeight: 600,
          marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {toastError && (
        <div style={{
          padding: '12px 16px', background: '#FEF2F2', border: '1px solid #EF4444',
          borderRadius: '8px', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600,
          marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{toastError}</span>
          <button onClick={() => setToastError(null)} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Bar */}
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
            <ShoppingBag size={24} style={{ color: 'var(--brand-gold, #D97706)' }} />
            Purchasing & Commercial Control
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Authorise materials requests, issue purchase orders, match supplier invoices and record external payments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(isOwner || isAdmin || isAccounts) && (
            <>
              <button
                onClick={() => { resetInvoiceForm(); setShowInvoiceModal(true); }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <Plus size={16} />
                Enter Supplier Invoice
              </button>

              <button
                onClick={() => setShowPaymentModal(true)}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              >
                <CreditCard size={16} />
                Record Payment
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E2E8F0', marginBottom: '20px', overflowX: 'auto' }}>
        {[
          { id: 'requests', label: 'Requests', count: requests.filter(r => r.status === 'Submitted').length, icon: Clock },
          { id: 'orders', label: 'Purchase Orders', count: purchaseOrders.length, icon: FileCheck },
          { id: 'invoices', label: 'Supplier Invoices', count: invoices.length, icon: Receipt },
          { id: 'suppliers', label: 'Supplier Directory', count: suppliers.length, icon: Building },
          { id: 'rules', label: 'Purchasing Rules', count: rules.length, icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderBottom: isActive ? '3px solid #0F172A' : 'none',
                color: isActive ? '#0F172A' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: isActive ? '#0F172A' : '#E2E8F0',
                  color: isActive ? '#FFFFFF' : '#475569'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1. REQUESTS TAB                                           */}
      {/* ========================================================= */}
      {activeTab === 'requests' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search request ref, project, requester..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
            </div>

            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.reference} - {p.name}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="">All Statuses</option>
              <option value="Submitted">Submitted (Awaiting Review)</option>
              <option value="Queried">Queried</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {filteredRequests.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              <Clock size={36} style={{ color: '#94A3B8', marginBottom: '8px' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>No requests matching criteria</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredRequests.map(req => {
                const isPending = req.status === 'Submitted';
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
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                            {req.requestReference}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: req.status === 'Approved' ? '#DCFCE7' : req.status === 'Queried' ? '#FEF3C7' : req.status === 'Rejected' ? '#FEE2E2' : '#EFF6FF',
                            color: req.status === 'Approved' ? '#166534' : req.status === 'Queried' ? '#92400E' : req.status === 'Rejected' ? '#991B1B' : '#1E40AF'
                          }}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                          Requester: <strong>{req.requesterName}</strong> ({req.requesterRole}) | Project: {req.projectReference}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                          {formatPence(req.grossAmountPence)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          Requested Gross ({req.valueBasis})
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: '2px' }}>
                        Supplier: {req.supplierName || req.suggestedSupplier}
                      </div>
                      <div style={{ color: '#334155' }}>{req.purpose}</div>
                      {req.isItemised && req.items && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#64748B' }}>
                          {req.items.map(i => `${i.quantity}x ${i.description} (@ £${(i.estimatedUnitPricePence / 100).toFixed(2)})`).join(' • ')}
                        </div>
                      )}
                    </div>

                    {/* Review Actions */}
                    {isPending && (
                      <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('Approve');
                            setReviewQueryText('');
                            setReviewRejectReason('');
                            setRevisedGross('');
                            setRevisedScope('');
                          }}
                          className="btn btn-sm btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}
                        >
                          <CheckCircle size={14} />
                          Approve Request
                        </button>

                        <button
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('Query');
                            setReviewQueryText('');
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                        >
                          Query
                        </button>

                        <button
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('ApproveRevised');
                            setRevisedGross((req.grossAmountPence / 100).toFixed(2));
                            setRevisedScope(req.purpose);
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                        >
                          Approve Revised Scope
                        </button>

                        <button
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('Reject');
                            setReviewRejectReason('');
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#DC2626', borderColor: '#FCA5A5' }}
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Display Issued PO Link */}
                    {req.status === 'Approved' && req.issuedPoReference && (
                      <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                        ✓ PO Issued: <strong>{req.issuedPoReference}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PURCHASE ORDERS TAB                                    */}
      {/* ========================================================= */}
      {activeTab === 'orders' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search PO number, supplier, project..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredOrders.map(po => {
              const isClosed = po.status === 'Closed' || po.status === 'Cancelled';
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
                          background: po.status === 'Cancelled' ? '#FEE2E2' : po.status === 'Fulfilled' ? '#DCFCE7' : '#EFF6FF',
                          color: po.status === 'Cancelled' ? '#991B1B' : po.status === 'Fulfilled' ? '#166534' : '#1E40AF'
                        }}>
                          {po.status.toUpperCase()} (Rev {po.revision})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                        Supplier: <strong>{po.supplierName}</strong> | Project: {po.projectReference} ({po.projectName})
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                        {formatPence(po.authorisedGrossPence)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                        Headroom: {formatPence(po.remainingAuthorisedGrossPence)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#334155' }}>
                    <div>{po.approvedScope}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                      Issued: {po.issueDate} by {po.approverName} | Invoiced to date: {formatPence(po.invoicedGrossPence)}
                    </div>
                  </div>

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

                    {!isClosed && (isOwner || isAdmin || isPM) && (
                      <>
                        <button
                          onClick={() => {
                            setAmendPo(po);
                            setAmendNewGross((po.authorisedGrossPence / 100).toFixed(2));
                            setAmendReason('');
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                        >
                          <Edit3 size={14} />
                          Amend PO
                        </button>

                        <button
                          onClick={() => {
                            setCancelPo(po);
                            setCancelReason('');
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#DC2626', borderColor: '#FCA5A5' }}
                        >
                          <Trash2 size={14} />
                          Cancel / Close
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SUPPLIER INVOICES TAB                                  */}
      {/* ========================================================= */}
      {activeTab === 'invoices' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', color: '#64748B' }}>
              Showing {filteredInvoices.length} supplier invoices
            </div>
            {(isOwner || isAdmin || isAccounts) && (
              <button
                onClick={() => { resetInvoiceForm(); setShowInvoiceModal(true); }}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                + Enter Invoice
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredInvoices.map(inv => {
              const isApproved = inv.status === 'Approved';
              const isPaid = inv.paymentStatus === 'Paid';
              return (
                <div
                  key={inv.id}
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
                          {inv.supplierInvoiceNumber}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: isApproved ? '#DCFCE7' : '#FEF3C7',
                          color: isApproved ? '#166534' : '#92400E'
                        }}>
                          {inv.status.toUpperCase()}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: isPaid ? '#DCFCE7' : '#EFF6FF',
                          color: isPaid ? '#166534' : '#1E40AF'
                        }}>
                          {inv.paymentStatus.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                        Supplier: <strong>{inv.supplierName}</strong> | Date: {inv.invoiceDate}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                        {formatPence(inv.grossAmountPence)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        Paid: {formatPence(inv.totalPaidPence)} | Outstanding: {formatPence(inv.outstandingPence)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#334155' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Matched POs: {inv.poAllocations.map(p => `${p.poReference} (${formatPence(p.allocatedGrossPence)})`).join(', ') || 'None (Unmatched)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                      Project Allocations: {inv.projectAllocations.map(p => `${p.projectReference} (${formatPence(p.allocatedGrossPence)})`).join(', ')}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isApproved && (isOwner || isAdmin || isAccounts) && (
                      <button
                        onClick={() => handlePostInvoice(inv)}
                        className="btn btn-sm btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        <CheckCircle size={14} />
                        Approve & Post Cost
                      </button>
                    )}

                    {isApproved && !isPaid && (isOwner || isAdmin || isAccounts) && (
                      <button
                        onClick={() => {
                          setPaySupplierId(inv.supplierId);
                          setPayAmount((inv.outstandingPence / 100).toFixed(2));
                          setPayAllocations([{
                            invoiceId: inv.id,
                            invoiceNumber: inv.supplierInvoiceNumber,
                            amountPence: inv.outstandingPence
                          }]);
                          setShowPaymentModal(true);
                        }}
                        className="btn btn-sm btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      >
                        <CreditCard size={14} />
                        Record Payment
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setCredSupplierId(inv.supplierId);
                        setCredApplyInvoiceId(inv.id);
                        setCredProjectId(inv.projectAllocations[0]?.projectId || '');
                        setCredPoId(inv.poAllocations[0]?.poId || '');
                        setShowCreditModal(true);
                      }}
                      className="btn btn-sm btn-outline"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                    >
                      <RotateCcw size={14} />
                      Record Credit Note
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SUPPLIER DIRECTORY TAB                                 */}
      {/* ========================================================= */}
      {activeTab === 'suppliers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', color: '#64748B' }}>
              Directory of approved builders merchants and trade suppliers
            </div>
            {(isOwner || isAdmin) && (
              <button
                onClick={() => {
                  setEditSupplierId(null);
                  setSuppName('');
                  setSuppLegalName('');
                  setSuppEmail('');
                  setSuppPhone('');
                  setSuppAddress('');
                  setSuppAccountNo('');
                  setSuppTermsDays('30');
                  setSuppNotes('');
                  setShowSupplierModal(true);
                }}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                + Add Supplier
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {suppliers.map(s => (
              <div
                key={s.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {s.name}
                  </h3>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: s.isActive ? '#DCFCE7' : '#F1F5F9', color: s.isActive ? '#166534' : '#64748B', fontWeight: 700 }}>
                    {s.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '6px' }}>
                  {s.legalName && <div>Legal: {s.legalName}</div>}
                  <div>Account No: <strong>{s.gvdAccountNumber || 'None'}</strong></div>
                  <div>Payment Terms: {s.paymentTermsDays} Days</div>
                  <div>Email: {s.email}</div>
                  <div>Phone: {s.phone}</div>
                  <div style={{ marginTop: '4px' }}>Address: {s.address}</div>
                </div>

                {s.internalNotes && (
                  <div style={{ marginTop: '8px', padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px', fontSize: '0.75rem', color: '#475569' }}>
                    Note: {s.internalNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. PURCHASING RULES TAB                                   */}
      {/* ========================================================= */}
      {activeTab === 'rules' && (
        <div>
          <div style={{ fontSize: '0.9rem', color: '#64748B', marginBottom: '16px' }}>
            Approval delegations and automated purchasing limits. Default is manual approval by Owner/Admin.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rules.map(r => (
              <div
                key={r.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {r.name}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                      Applies to Role: <strong>{r.approverRole || 'Any Authorized'}</strong> (Version {r.version})
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: r.isAutoApprovalEnabled ? '#DCFCE7' : '#FEF3C7',
                    color: r.isAutoApprovalEnabled ? '#166534' : '#92400E',
                    fontWeight: 700
                  }}>
                    {r.isAutoApprovalEnabled ? 'AUTO-APPROVAL ENABLED' : 'MANUAL REVIEW REQUIRED'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Per-Order Maximum:</span>
                    <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>{formatPence(r.maxOrderGrossPence)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Aggregate Period:</span>
                    <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>{r.aggregatePeriodDays ? `${r.aggregatePeriodDays} Days` : 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Aggregate Period Limit:</span>
                    <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>{r.aggregatePeriodLimitPence ? formatPence(r.aggregatePeriodLimitPence) : 'N/A'}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* REVIEW REQUEST MODAL                                       */}
      {/* ========================================================= */}
      {reviewRequest && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', zIndex: 50
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Review Materials Request: {reviewRequest.requestReference}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              Requester: <strong>{reviewRequest.requesterName}</strong> | Project: {reviewRequest.projectReference}
            </p>

            <div style={{ margin: '14px 0', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div><strong>Purpose: </strong>{reviewRequest.purpose}</div>
              <div style={{ marginTop: '4px' }}><strong>Supplier: </strong>{reviewRequest.supplierName || reviewRequest.suggestedSupplier}</div>
              <div style={{ marginTop: '4px' }}><strong>Requested Amount: </strong>{formatPence(reviewRequest.grossAmountPence)}</div>
            </div>

            {/* Action Specific Fields */}
            {reviewAction === 'Query' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Query Question / Information Required:
                </label>
                <textarea
                  rows={3}
                  value={reviewQueryText}
                  onChange={e => setReviewQueryText(e.target.value)}
                  placeholder="e.g. Can we use existing stock from project 001 instead?"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>
            )}

            {reviewAction === 'Reject' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Reason for Rejection:
                </label>
                <textarea
                  rows={3}
                  value={reviewRejectReason}
                  onChange={e => setReviewRejectReason(e.target.value)}
                  placeholder="e.g. Order scope not authorized under current client contract."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>
            )}

            {reviewAction === 'ApproveRevised' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Revised Authorized Gross (£):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={revisedGross}
                    onChange={e => setRevisedGross(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Revised Approved Scope:
                  </label>
                  <textarea
                    rows={2}
                    value={revisedScope}
                    onChange={e => setRevisedScope(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setReviewRequest(null)} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button onClick={handleExecuteReview} className="btn btn-primary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Confirm {reviewAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ENTER SUPPLIER INVOICE MODAL                              */}
      {/* ========================================================= */}
      {showInvoiceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', zIndex: 50
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', maxWidth: '640px', width: '100%',
            maxHeight: '90vh', overflowY: 'auto', padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Enter Supplier Invoice
              </h3>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Optional PO Lookup */}
              <div style={{ background: '#F1F5F9', padding: '12px', borderRadius: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Purchase Order Lookup (Optional Prefill):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. GVD-PO-2026-0001"
                    value={invPoLookupRef}
                    onChange={e => setInvPoLookupRef(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupPO(invPoLookupRef)}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.75rem' }}
                  >
                    Lookup PO
                  </button>
                </div>
              </div>

              {/* Supplier Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Supplier <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={invSupplierId}
                  onChange={e => setInvSupplierId(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Invoice Number & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Supplier Invoice Number <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-99841"
                    value={invNumber}
                    onChange={e => setInvNumber(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Invoice Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={e => setInvDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Amounts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Gross Amount (£) <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={invGrossAmount}
                    onChange={e => setInvGrossAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    VAT Treatment
                  </label>
                  <select
                    value={invVatTreatment}
                    onChange={e => setInvVatTreatment(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  >
                    <option value="Standard 20%">Standard 20%</option>
                    <option value="Zero Rated">Zero Rated (0%)</option>
                    <option value="Reverse Charge">Domestic Reverse Charge</option>
                  </select>
                </div>
              </div>

              {/* Exception override */}
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={invHasException}
                    onChange={e => setInvHasException(e.target.checked)}
                  />
                  Documented Exception (Override PO Headroom / Unmatched)
                </label>
                {invHasException && (
                  <input
                    type="text"
                    placeholder="Reason for exception authorization..."
                    value={invExceptionReason}
                    onChange={e => setInvExceptionReason(e.target.value)}
                    style={{ width: '100%', marginTop: '6px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button onClick={() => setShowInvoiceModal(false)} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button onClick={handleCreateInvoiceSubmit} className="btn btn-primary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Save Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RECORD PAYMENT MODAL                                      */}
      {/* ========================================================= */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', zIndex: 50
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Record External Supplier Payment
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              Records payment made outside the app. Reuses verified payment infrastructure.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '14px 0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Supplier <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={paySupplierId}
                  onChange={e => setPaySupplierId(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Payment Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Payment Reference <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BACS-88491"
                    value={payReference}
                    onChange={e => setPayReference(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Total Payment Amount (£) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowPaymentModal(false)} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button onClick={handleRecordPaymentSubmit} className="btn btn-primary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUPPLIER MODAL (ADD / EDIT)                               */}
      {/* ========================================================= */}
      {showSupplierModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', zIndex: 50
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              {editSupplierId ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0' }}>
              <input
                type="text"
                placeholder="Supplier Name *"
                value={suppName}
                onChange={e => setSuppName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder="Legal / Trading Name (if different)"
                value={suppLegalName}
                onChange={e => setSuppLegalName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
              <input
                type="email"
                placeholder="Contact Email *"
                value={suppEmail}
                onChange={e => setSuppEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={suppPhone}
                onChange={e => setSuppPhone(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
              <textarea
                rows={2}
                placeholder="Address"
                value={suppAddress}
                onChange={e => setSuppAddress(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder="GVD Account Number with Supplier"
                value={suppAccountNo}
                onChange={e => setSuppAccountNo(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowSupplierModal(false)} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button onClick={handleSaveSupplierSubmit} className="btn btn-primary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
