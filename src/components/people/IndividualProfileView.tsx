import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, PrivateBusinessDetails, CompetencyDocument, RequirementConfig, AuditLog } from '../../types';
import { calculateCompetencyStatus, getOverallRequirementStatus } from '../../services/competencyLogic';
import { UploadEvidenceModal } from '../competencies/UploadEvidenceModal';
import { DocumentPreviewModal } from '../competencies/DocumentPreviewModal';
import { ReviewEvidenceModal } from '../competencies/ReviewEvidenceModal';
import { 
  User, 
  Building2, 
  ShieldCheck, 
  FileText, 
  Briefcase, 
  History, 
  ArrowLeft, 
  Upload, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Lock, 
  Edit3,
  DollarSign,
  Car,
  Receipt,
  Plus
} from 'lucide-react';
import { 
  getContractorRates, 
  saveContractorRate, 
  getContractorTaxConfig, 
  saveContractorTaxConfig 
} from '../../services/claimsService';
import { formatPenceToGBP, parseGBPToPence } from '../../services/projectService';
import { formatLocalDate } from '../../services/plannerService';
import type { ContractorRateVersion, ContractorTaxConfig, PaymentBasis, TravelMethod } from '../../types';

interface IndividualProfileViewProps {
  userId: string;
  onBack?: () => void;
}

export const IndividualProfileView: React.FC<IndividualProfileViewProps> = ({ userId, onBack }) => {
  const { currentUser, isOwner, isAdmin, recordAuditLog } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bizDetails, setBizDetails] = useState<PrivateBusinessDetails | null>(null);
  const [userDocs, setUserDocs] = useState<CompetencyDocument[]>([]);
  const [reqConfigs, setReqConfigs] = useState<RequirementConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Active section for Mobile / Desktop view
  const [activeSection, setActiveSection] = useState<'overview' | 'details' | 'competencies' | 'business' | 'activity' | 'commercial'>('overview');

  // Commercial / Rates State
  const [rates, setRates] = useState<ContractorRateVersion[]>([]);
  const [taxConfig, setTaxConfig] = useState<ContractorTaxConfig | null>(null);
  const [paymentBasis, setPaymentBasis] = useState<PaymentBasis>('day_rate');
  const [rateGbp, setRateGbp] = useState('200.00');
  const [halfDayGbp, setHalfDayGbp] = useState('100.00');
  const [effectiveFrom, setEffectiveFrom] = useState(formatLocalDate(new Date()));
  const [travelMethod, setTravelMethod] = useState<TravelMethod>('mileage');
  const [mileageRatePence, setMileageRatePence] = useState('45');
  const [fixedTravelGbp, setFixedTravelGbp] = useState('30.00');
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([
    'Materials', 'Tools & Equipment', 'PPE / Safety', 'Parking'
  ]);
  const [paymentTermsDays, setPaymentTermsDays] = useState('14');
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [rateSuccess, setRateSuccess] = useState<string | null>(null);

  // Tax Config State
  const [taxVatRegistered, setTaxVatRegistered] = useState(false);
  const [taxVatNumber, setTaxVatNumber] = useState('');
  const [taxCisApplicable, setTaxCisApplicable] = useState(true);
  const [taxCisRate, setTaxCisRate] = useState(20);
  const [taxReverseCharge, setTaxReverseCharge] = useState(false);
  const [isSavingTax, setIsSavingTax] = useState(false);
  const [taxSuccess, setTaxSuccess] = useState<string | null>(null);

  // Business Details Form State
  const [tradingName, setTradingName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [utr, setUtr] = useState('');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState('');
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [bizSuccess, setBizSuccess] = useState<string | null>(null);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CompetencyDocument | null>(null);
  const [reviewDoc, setReviewDoc] = useState<CompetencyDocument | null>(null);

  const isSelf = currentUser?.uid === userId;
  const canViewPrivateBiz = isSelf || isAdmin;
  const canEditPrivateBiz = isSelf || isAdmin;
  const canViewCommercial = (isAdmin || isSelf) && (profile?.role === 'IndividualContractor' || profile?.applicationCategory === 'Individual Contractor');

  // Load user profile & related data
  useEffect(() => {
    const userRef = doc(db, 'users', userId);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
      }
    });

    const bizRef = doc(db, 'private_business_details', userId);
    const unsubBiz = onSnapshot(bizRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PrivateBusinessDetails;
        setBizDetails(data);
        setTradingName(data.tradingName || '');
        setBusinessAddress(data.businessAddress || '');
        setUtr(data.utr || '');
        setVatRegistered(data.vatRegistered || false);
        setVatNumber(data.vatNumber || '');
      }
    });

    const docsQuery = query(collection(db, 'competencies'), where('holderId', '==', userId));
    const unsubDocs = onSnapshot(docsQuery, (snap) => {
      const list: CompetencyDocument[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CompetencyDocument));
      setUserDocs(list);
    });

    const reqUnsub = onSnapshot(collection(db, 'requirement_configs'), (snap) => {
      const list: RequirementConfig[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as RequirementConfig));
      setReqConfigs(list.filter(r => r.isActive));
    });

    const auditQuery = query(collection(db, 'audit_logs'), where('entityId', '==', userId));
    const unsubAudit = onSnapshot(auditQuery, (snap) => {
      const list: AuditLog[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as AuditLog));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(list);
      setLoading(false);
    });

    // Load commercial rates & tax configuration
    loadCommercialData();

    return () => {
      unsubUser();
      unsubBiz();
      unsubDocs();
      reqUnsub();
      unsubAudit();
    };
  }, [userId]);

  const loadCommercialData = async () => {
    try {
      const [rList, tConfig] = await Promise.all([
        getContractorRates(userId),
        getContractorTaxConfig(userId)
      ]);
      setRates(rList);
      setTaxConfig(tConfig);
      if (tConfig) {
        setTaxVatRegistered(tConfig.vatRegistered || false);
        setTaxVatNumber(tConfig.vatNumber || '');
        setTaxCisApplicable(tConfig.cisApplicable !== false);
        setTaxCisRate(tConfig.cisDeductionRate || 20);
        setTaxReverseCharge(tConfig.reverseChargeApplicable || false);
      }
      if (rList.length > 0) {
        const latest = rList[0];
        setPaymentBasis(latest.paymentBasis);
        setRateGbp(latest.paymentBasis === 'day_rate' ? (latest.dayRatePence ? (latest.dayRatePence / 100).toFixed(2) : '200.00') : (latest.hourlyRatePence ? (latest.hourlyRatePence / 100).toFixed(2) : '25.00'));
        setHalfDayGbp(latest.halfDayRatePence ? (latest.halfDayRatePence / 100).toFixed(2) : '100.00');
        setTravelMethod(latest.travelMethod || 'mileage');
        setMileageRatePence(latest.mileageRatePence ? String(latest.mileageRatePence) : '45');
        setFixedTravelGbp(latest.fixedTravelAmountPence ? (latest.fixedTravelAmountPence / 100).toFixed(2) : '30.00');
        if (latest.claimableExpenseCategories) setSelectedExpenses(latest.claimableExpenseCategories);
        if (latest.paymentTermsDays) setPaymentTermsDays(String(latest.paymentTermsDays));
      }
    } catch (err) {
      console.warn("Failed to load commercial data:", err);
    }
  };

  const handleSaveRateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setRateSuccess(null);
    setIsSavingRate(true);

    try {
      const parsedRate = parseGBPToPence(rateGbp);
      const parsedHalfDay = paymentBasis === 'day_rate' ? parseGBPToPence(halfDayGbp) : undefined;
      const parsedFixed = travelMethod === 'fixed_amount' ? parseGBPToPence(fixedTravelGbp) : undefined;
      const parsedMileage = travelMethod === 'mileage' ? parseInt(mileageRatePence) || 45 : undefined;

      const newRateData = {
        contractorUid: userId,
        paymentBasis,
        dayRatePence: paymentBasis === 'day_rate' ? parsedRate : undefined,
        halfDayRatePence: parsedHalfDay,
        hourlyRatePence: paymentBasis === 'hourly_rate' ? parsedRate : undefined,
        effectiveFrom,
        travelMethod,
        mileageRatePence: parsedMileage,
        fixedTravelAmountPence: parsedFixed,
        claimableExpenseCategories: selectedExpenses,
        paymentTermsDays: parseInt(paymentTermsDays) || 14,
        createdByUid: currentUser?.uid || '',
        createdByName: currentUser?.fullName || ''
      };

      const existingActive = rates.find(r => !r.effectiveTo);
      await saveContractorRate(newRateData, existingActive?.id);

      await recordAuditLog(
        'Set Contractor Rate',
        'ContractorRateVersion',
        userId,
        `Defined rate version effective from ${effectiveFrom} for ${profile?.fullName}`,
        null,
        newRateData
      );

      setRateSuccess("Date-effective rate version created successfully!");
      await loadCommercialData();
    } catch (err: any) {
      alert(err.message || 'Failed to save rate version');
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleSaveTaxConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && currentUser?.role !== 'Accounts') return;
    setTaxSuccess(null);
    setIsSavingTax(true);

    try {
      const updatedTaxConfig: ContractorTaxConfig = {
        contractorUid: userId,
        vatRegistered: taxVatRegistered,
        vatNumber: taxVatRegistered ? taxVatNumber.trim() : undefined,
        vatRate: 20,
        cisApplicable: taxCisApplicable,
        cisDeductionRate: taxCisRate,
        reverseChargeApplicable: taxReverseCharge,
        supplierBusinessName: tradingName.trim() || profile?.fullName,
        supplierBusinessAddress: businessAddress.trim(),
        isVerified: true,
        verifiedByUid: currentUser?.uid,
        verifiedByName: currentUser?.fullName,
        verifiedAt: new Date().toISOString(),
        configuredByUid: currentUser?.uid,
        configuredByName: currentUser?.fullName,
        configuredAt: new Date().toISOString()
      };

      await saveContractorTaxConfig(updatedTaxConfig);
      setTaxConfig(updatedTaxConfig);
      await recordAuditLog(
        'Verify Contractor Tax Config',
        'ContractorTaxConfig',
        userId,
        `Verified tax configuration for ${profile?.fullName}`,
        null,
        updatedTaxConfig
      );
      setTaxSuccess("Tax configuration saved and verified successfully!");
    } catch (err: any) {
      alert(err.message || 'Failed to save tax configuration');
    } finally {
      setIsSavingTax(false);
    }
  };

  const handleSaveBizDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizSuccess(null);
    setIsSavingBiz(true);

    try {
      const bizRef = doc(db, 'private_business_details', userId);
      const bizData: PrivateBusinessDetails = {
        uid: userId,
        tradingName: tradingName.trim() || undefined,
        businessAddress: businessAddress.trim() || undefined,
        utr: utr.trim() || undefined, // Stored as text preserving leading zeroes
        vatRegistered,
        vatNumber: vatRegistered ? vatNumber.trim() : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.uid
      };

      await setDoc(bizRef, {
        ...bizData,
        updatedAt: serverTimestamp()
      });

      await recordAuditLog('Update Private Business Details', 'PrivateBusinessDetails', userId, `Updated business details for ${profile?.fullName}`, null, bizData);
      setBizSuccess("Private business details updated successfully!");
    } catch (err: any) {
      console.error("Failed to save business details:", err);
    } finally {
      setIsSavingBiz(false);
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '30px', textAlign: 'center' }}>Loading individual profile...</div>;
  }

  if (!profile) {
    return <div className="card" style={{ padding: '30px', textAlign: 'center' }}>User profile not found.</div>;
  }

  // Calculate overall competency items
  const awaitingCount = userDocs.filter(d => d.reviewStatus === 'Awaiting Review').length;
  const expiredCount = userDocs.filter(d => d.reviewStatus === 'Valid' && calculateCompetencyStatus(d) === 'Expired').length;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Profile Header Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {onBack && (
              <button type="button" className="btn btn-outline btn-sm" onClick={onBack} title="Back to directory">
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-navy)',
              color: '#FFF',
              fontWeight: 800,
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {profile.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
                {profile.fullName}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {profile.companyName ? `Company: ${profile.companyName} | ` : ''}Category: {profile.applicationCategory}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={`badge badge-${profile.status === 'approved' ? 'approved' : 'pending'}`}>
              {profile.status}
            </span>
            <span className="badge badge-info" style={{ fontWeight: 700 }}>
              Role: {profile.role}
            </span>
          </div>
        </div>

        {/* Section Navigation Tabs (Desktop visible / Mobile Overview buttons) */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginTop: '20px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-color)',
          overflowX: 'auto'
        }}>
          <button
            type="button"
            className={`btn btn-sm ${activeSection === 'overview' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveSection('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeSection === 'details' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveSection('details')}
          >
            Details
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeSection === 'competencies' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveSection('competencies')}
          >
            Competencies & Documents ({userDocs.length})
          </button>
          {canViewPrivateBiz && profile.applicationCategory !== 'GVD Employee' && (
            <button
              type="button"
              className={`btn btn-sm ${activeSection === 'business' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setActiveSection('business')}
            >
              Private Business Details
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={`btn btn-sm ${activeSection === 'activity' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setActiveSection('activity')}
            >
              Activity History ({auditLogs.length})
            </button>
          )}
          {canViewCommercial && (
            <button
              type="button"
              className={`btn btn-sm ${activeSection === 'commercial' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setActiveSection('commercial')}
            >
              Commercial & Rates
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Profile Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Full Name:</span>
                <span style={{ fontWeight: 600 }}>{profile.fullName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Contact Email:</span>
                <span style={{ fontWeight: 600 }}>{profile.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Phone Number:</span>
                <span style={{ fontWeight: 600 }}>{profile.phone || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Primary Trade:</span>
                <span style={{ fontWeight: 600 }}>{profile.primaryTrade || 'General / Unassigned'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Planning Eligibility:</span>
                <span style={{ fontWeight: 600 }}>{profile.planningEligible ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Competency Status Overview
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Uploaded Documents:</span>
                <span className="badge badge-info">{userDocs.length} items</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Awaiting GVD Review:</span>
                <span className="badge badge-pending">{awaitingCount} items</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Expired Documents:</span>
                <span className="badge badge-expired">{expiredCount} items</span>
              </div>

              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-navy"
                  onClick={() => setShowUploadModal(true)}
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <Upload size={16} />
                  <span>Upload Certificate Evidence</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DETAILS */}
      {activeSection === 'details' && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Account Details & Role Settings
          </h3>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{profile.fullName}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{profile.email}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{profile.phone || 'N/A'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Application Category</label>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{profile.applicationCategory}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Approved Role (Protected)</label>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>{profile.role}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Primary Trade (Protected)</label>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>{profile.primaryTrade || 'General'}</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: COMPETENCIES & DOCUMENTS */}
      {activeSection === 'competencies' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Certificates & Evidence Documents
            </h3>
            <button type="button" className="btn btn-navy btn-sm" onClick={() => setShowUploadModal(true)}>
              <Upload size={16} /> Upload Certificate
            </button>
          </div>

          {userDocs.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No competency documents or certificates uploaded yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Requirement</th>
                    <th>Issuer / Ref</th>
                    <th>Expiry Date</th>
                    <th>Review Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userDocs.map(docItem => {
                    const status = docItem.reviewStatus === 'Awaiting Review' ? 'Awaiting Review' : calculateCompetencyStatus(docItem);
                    return (
                      <tr key={docItem.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{docItem.requirementName}</div>
                          {docItem.fileName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{docItem.fileName}</div>}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{docItem.issuerProvider || 'N/A'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ref: {docItem.referenceNumber || 'N/A'}</div>
                        </td>
                        <td>
                          {docItem.doesNotExpire ? 'Does Not Expire' : (docItem.expiryDate ? new Date(docItem.expiryDate).toLocaleDateString('en-GB') : 'N/A')}
                        </td>
                        <td>
                          <span className={`badge badge-${status === 'Valid' ? 'valid' : status === 'Awaiting Review' ? 'pending' : 'expired'}`}>
                            {status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {docItem.documentUrl && (
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreviewDoc(docItem)}>
                                <Eye size={14} /> Preview
                              </button>
                            )}
                            {isAdmin && (
                              <button type="button" className="btn btn-navy btn-sm" onClick={() => setReviewDoc(docItem)}>
                                <Edit3 size={14} /> Review
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: PRIVATE BUSINESS DETAILS */}
      {activeSection === 'business' && canViewPrivateBiz && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Private Business & Tax Identifiers
            </h3>
            <span className="badge badge-info">Private to Self & GVD Staff</span>
          </div>

          {bizSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
              <CheckCircle2 size={16} />
              <span>{bizSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveBizDetails}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Trading / Business Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Smith Electrical Contractors"
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  disabled={!canEditPrivateBiz || isSavingBiz}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unique Taxpayer Reference (UTR)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 0123456789 (10-digit text value)"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  disabled={!canEditPrivateBiz || isSavingBiz}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Stored as text to preserve leading zeroes.
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Registered Business Address</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Full business address..."
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  disabled={!canEditPrivateBiz || isSavingBiz}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={vatRegistered}
                    onChange={(e) => setVatRegistered(e.target.checked)}
                    disabled={!canEditPrivateBiz || isSavingBiz}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span>VAT Registered Business</span>
                </label>
              </div>

              {vatRegistered && (
                <div className="form-group">
                  <label className="form-label">VAT Registration Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GB 123 4567 89"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    disabled={!canEditPrivateBiz || isSavingBiz}
                  />
                </div>
              )}
            </div>

            {canEditPrivateBiz && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button type="submit" className="btn btn-navy" disabled={isSavingBiz} style={{ fontWeight: 700 }}>
                  {isSavingBiz ? "Saving Business Details..." : "Save Business Details"}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* SECTION 5: ACTIVITY LOG (ADMIN ONLY) */}
      {activeSection === 'activity' && isAdmin && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Profile Audit & History Log
          </h3>
          {auditLogs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No audit history records found for this user profile.</div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td className="nowrap" style={{ fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString('en-GB')}</td>
                      <td style={{ fontWeight: 600 }}>{log.actorName}</td>
                      <td><span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{log.action}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION: COMMERCIAL & RATES */}
      {activeSection === 'commercial' && canViewCommercial && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Rate status banner */}
          <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #0F172A, #1E293B)', color: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Agreed Commercial Terms
                </span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-heading)' }}>
                  {rates.length > 0 && rates[0]
                    ? `${formatPenceToGBP(rates[0].paymentBasis === 'day_rate' ? (rates[0].dayRatePence || 0) : (rates[0].hourlyRatePence || 0))} / ${rates[0].paymentBasis === 'day_rate' ? 'Day' : 'Hour'}`
                    : 'No Agreed Rate Set'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '6px' }}>
                  {rates.length > 0 && rates[0]
                    ? `Effective from: ${rates[0].effectiveFrom} ${rates[0].halfDayRatePence ? `• Half Day: ${formatPenceToGBP(rates[0].halfDayRatePence)}` : ''} • Travel: ${rates[0].travelMethod || 'None'}`
                    : 'GVD Management must define an active rate before monetary claims can be submitted.'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span className={`badge ${rates.length > 0 ? 'badge-approved' : 'badge-pending'}`} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  {rates.length > 0 ? 'Rate Active' : 'Rate Pending'}
                </span>
                {taxConfig?.isVerified && (
                  <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                    Tax Config Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rate Configuration Form (Admin Only) */}
          {isAdmin ? (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    Define Date-Effective Contractor Rates
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Creates a versioned rate record. Existing submitted or approved work will not be silently modified.
                  </p>
                </div>
              </div>

              {rateSuccess && (
                <div style={{ padding: '10px 14px', background: 'var(--status-success-bg)', color: 'var(--status-success-text)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                  ✓ {rateSuccess}
                </div>
              )}

              <form onSubmit={handleSaveRateVersion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Payment Basis *</label>
                    <select
                      className="form-input"
                      value={paymentBasis}
                      onChange={e => {
                        const newBasis = e.target.value as PaymentBasis;
                        setPaymentBasis(newBasis);
                        if (newBasis === 'day_rate' && rateGbp === '25.00') setRateGbp('200.00');
                        if (newBasis === 'hourly_rate' && rateGbp === '200.00') setRateGbp('25.00');
                      }}
                    >
                      <option value="day_rate">Day Rate (£ / Day)</option>
                      <option value="hourly_rate">Hourly Rate (£ / Hour)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Agreed Rate (£) * {paymentBasis === 'day_rate' ? '(Full Day)' : '(Per Hour)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      className="form-input"
                      value={rateGbp}
                      onChange={e => {
                        setRateGbp(e.target.value);
                        if (paymentBasis === 'day_rate') {
                          const half = (parseFloat(e.target.value || '0') / 2).toFixed(2);
                          setHalfDayGbp(half);
                        }
                      }}
                      required
                    />
                  </div>
                </div>

                {paymentBasis === 'day_rate' && (
                  <div className="grid-2">
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">Agreed Half-Day Rate (£) *</label>
                        <button
                          type="button"
                          onClick={() => {
                            const half = (parseFloat(rateGbp || '0') / 2).toFixed(2);
                            setHalfDayGbp(half);
                          }}
                          style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Suggest 50% (£{(parseFloat(rateGbp || '0') / 2).toFixed(2)})
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        className="form-input"
                        value={halfDayGbp}
                        onChange={e => setHalfDayGbp(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Do not assume half a day always pays 50%. Explicit amount required.
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Effective From Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={effectiveFrom}
                        onChange={e => setEffectiveFrom(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {paymentBasis === 'hourly_rate' && (
                  <div className="form-group">
                    <label className="form-label">Effective From Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={effectiveFrom}
                      onChange={e => setEffectiveFrom(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Travel rules */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Car size={16} /> Permitted Travel Method & Allowance
                  </h4>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Approved Travel Method</label>
                      <select
                        className="form-input"
                        value={travelMethod}
                        onChange={e => setTravelMethod(e.target.value as TravelMethod)}
                      >
                        <option value="none">None (No Travel Claimable)</option>
                        <option value="mileage">Mileage at Agreed Rate</option>
                        <option value="fixed_amount">Agreed Fixed Travel Allowance</option>
                        <option value="actual_fuel">Actual Fuel Reimbursement (Receipts Required)</option>
                      </select>
                    </div>

                    {travelMethod === 'mileage' && (
                      <div className="form-group">
                        <label className="form-label">Approved Mileage Rate (Pence per Mile)</label>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          className="form-input"
                          value={mileageRatePence}
                          onChange={e => setMileageRatePence(e.target.value)}
                          placeholder="e.g. 45"
                        />
                      </div>
                    )}

                    {travelMethod === 'fixed_amount' && (
                      <div className="form-group">
                        <label className="form-label">Agreed Fixed Travel Amount (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          className="form-input"
                          value={fixedTravelGbp}
                          onChange={e => setFixedTravelGbp(e.target.value)}
                          placeholder="e.g. 30.00"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Expense categories */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={16} /> Claimable Expense Categories
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                    {[
                      'Materials', 'Tools & Equipment', 'PPE / Safety', 'Parking',
                      'Accommodation', 'Subsistence', 'Phone / Data', 'Other'
                    ].map(cat => (
                      <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                        <input
                          type="checkbox"
                          checked={selectedExpenses.includes(cat)}
                          onChange={e => {
                            if (e.target.checked) setSelectedExpenses([...selectedExpenses, cat]);
                            else setSelectedExpenses(selectedExpenses.filter(c => c !== cat));
                          }}
                        />
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Payment terms */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Agreed Payment Terms (Days)</label>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        className="form-input"
                        value={paymentTermsDays}
                        onChange={e => setPaymentTermsDays(e.target.value)}
                        placeholder="e.g. 14"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button type="submit" className="btn btn-navy" disabled={isSavingRate} style={{ fontWeight: 700 }}>
                    {isSavingRate ? 'Saving Rate Version...' : 'Save New Rate Version'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Contractor Read-Only Rate View */
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                My Commercial Terms
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Payment Basis:</span>
                  <strong>{rates[0]?.paymentBasis === 'day_rate' ? 'Day Rate' : 'Hourly Rate'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Agreed Rate:</span>
                  <strong>{rates[0] ? formatPenceToGBP(rates[0].paymentBasis === 'day_rate' ? (rates[0].dayRatePence || 0) : (rates[0].hourlyRatePence || 0)) : 'Pending'}</strong>
                </div>
                {rates[0]?.paymentBasis === 'day_rate' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Half-Day Rate:</span>
                    <strong>{rates[0].halfDayRatePence ? formatPenceToGBP(rates[0].halfDayRatePence) : 'Not specified'}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Travel Policy:</span>
                  <strong>{rates[0]?.travelMethod === 'mileage' ? `Mileage (@ ${rates[0].mileageRatePence || 45}p/mi)` : rates[0]?.travelMethod === 'actual_fuel' ? 'Actual Fuel Reimbursement' : rates[0]?.travelMethod === 'fixed_amount' ? `Fixed Travel (${formatPenceToGBP(rates[0].fixedTravelAmountPence || 0)})` : 'None'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Payment Terms:</span>
                  <strong>{rates[0]?.paymentTermsDays ? `${rates[0].paymentTermsDays} days` : '14 days upon approval'}</strong>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px' }}>
                ℹ Your commercial terms are maintained by GVD Management. If any details are incorrect, please contact GVD Accounts.
              </p>
            </div>
          )}

          {/* Rate Versions History (Admin Only) */}
          {isAdmin && rates.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Rate Version History
              </h3>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Effective From</th>
                      <th>Effective To</th>
                      <th>Basis</th>
                      <th>Rate</th>
                      <th>Travel</th>
                      <th>Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.effectiveFrom}</td>
                        <td>{r.effectiveTo || <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>Current Active</span>}</td>
                        <td>{r.paymentBasis === 'day_rate' ? 'Day Rate' : 'Hourly Rate'}</td>
                        <td style={{ fontWeight: 700 }}>
                          {formatPenceToGBP(r.paymentBasis === 'day_rate' ? (r.dayRatePence || 0) : (r.hourlyRatePence || 0))}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{r.travelMethod}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.createdByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tax Configuration Section (Admin & Accounts) */}
          {(isAdmin || currentUser?.role === 'Accounts') && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    Contractor Tax & Deduction Settings
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Configure VAT treatment, domestic reverse charge and CIS deduction rules for invoice issuance.
                  </p>
                </div>
              </div>

              {taxSuccess && (
                <div style={{ padding: '10px 14px', background: 'var(--status-success-bg)', color: 'var(--status-success-text)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                  ✓ {taxSuccess}
                </div>
              )}

              <form onSubmit={handleSaveTaxConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={taxVatRegistered}
                        onChange={e => setTaxVatRegistered(e.target.checked)}
                      />
                      <span>Contractor is VAT Registered</span>
                    </label>
                  </div>

                  {taxVatRegistered && (
                    <div className="form-group">
                      <label className="form-label">VAT Number *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. GB 987 6543 21"
                        value={taxVatNumber}
                        onChange={e => setTaxVatNumber(e.target.value)}
                        required={taxVatRegistered}
                      />
                    </div>
                  )}
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={taxCisApplicable}
                        onChange={e => setTaxCisApplicable(e.target.checked)}
                      />
                      <span>Subject to CIS (Construction Industry Scheme)</span>
                    </label>
                  </div>

                  {taxCisApplicable && (
                    <div className="form-group">
                      <label className="form-label">CIS Deduction Rate (%)</label>
                      <select
                        className="form-input"
                        value={taxCisRate}
                        onChange={e => setTaxCisRate(parseInt(e.target.value) || 20)}
                      >
                        <option value="20">20% (Standard Registered Subcontractor)</option>
                        <option value="30">30% (Higher / Unmatched Rate)</option>
                        <option value="0">0% (Gross Payment Status)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={taxReverseCharge}
                      onChange={e => setTaxReverseCharge(e.target.checked)}
                    />
                    <span>Apply VAT Domestic Reverse Charge (Customer accounts for VAT to HMRC)</span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button type="submit" className="btn btn-navy" disabled={isSavingTax} style={{ fontWeight: 700 }}>
                    {isSavingTax ? 'Saving Tax Settings...' : 'Save & Verify Tax Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showUploadModal && (
        <UploadEvidenceModal
          requirementConfigs={reqConfigs}
          targetHolderId={userId}
          targetHolderName={profile.fullName}
          targetHolderType="individual"
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => setShowUploadModal(false)}
        />
      )}

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {reviewDoc && (
        <ReviewEvidenceModal
          competencyDoc={reviewDoc}
          onClose={() => setReviewDoc(null)}
          onSuccess={() => setReviewDoc(null)}
        />
      )}
    </div>
  );
};
