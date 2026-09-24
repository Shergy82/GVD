import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type { CompetencyDocument, UserProfile, RequirementConfig } from '../types';
import { calculateCompetencyStatus, getOverallRequirementStatus } from '../services/competencyLogic';
import { ReviewEvidenceModal } from '../components/competencies/ReviewEvidenceModal';
import { DocumentPreviewModal } from '../components/competencies/DocumentPreviewModal';
import { AlertCircle, Clock, ShieldAlert, CheckCircle2, Eye, Edit3, Filter, Search, User } from 'lucide-react';

interface AttentionNeededViewProps {
  onOpenUserProfile?: (uid: string) => void;
}

export const AttentionNeededView: React.FC<AttentionNeededViewProps> = ({ onOpenUserProfile }) => {
  const { currentUser, isAdmin } = useAuth();

  const [allDocs, setAllDocs] = useState<CompetencyDocument[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allReqs, setAllReqs] = useState<RequirementConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'awaiting_review' | 'expired' | 'expiring_soon' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected modals
  const [reviewingDoc, setReviewingDoc] = useState<CompetencyDocument | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<CompetencyDocument | null>(null);

  useEffect(() => {
    const docsUnsub = onSnapshot(collection(db, 'competencies'), (snap) => {
      const list: CompetencyDocument[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CompetencyDocument));
      setAllDocs(list);
    });

    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as UserProfile));
      setAllUsers(list.filter(u => u.status === 'approved'));
    });

    const reqsUnsub = onSnapshot(collection(db, 'requirement_configs'), (snap) => {
      const list: RequirementConfig[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as RequirementConfig));
      setAllReqs(list.filter(r => r.isActive));
      setLoading(false);
    });

    return () => {
      docsUnsub();
      usersUnsub();
      reqsUnsub();
    };
  }, []);

  // Compute items needing attention
  const awaitingReviewItems = allDocs.filter(d => d.reviewStatus === 'Awaiting Review');
  
  const expiredItems = allDocs.filter(d => {
    if (d.reviewStatus !== 'Valid') return false;
    return calculateCompetencyStatus(d) === 'Expired';
  });

  const expiringSoonItems = allDocs.filter(d => {
    if (d.reviewStatus !== 'Valid') return false;
    return calculateCompetencyStatus(d) === 'Expiring Soon';
  });

  const rejectedItems = allDocs.filter(d => d.reviewStatus === 'Rejected');

  // Filter list
  let displayDocs: CompetencyDocument[] = [];
  if (urgencyFilter === 'awaiting_review') displayDocs = awaitingReviewItems;
  else if (urgencyFilter === 'expired') displayDocs = expiredItems;
  else if (urgencyFilter === 'expiring_soon') displayDocs = expiringSoonItems;
  else if (urgencyFilter === 'rejected') displayDocs = rejectedItems;
  else displayDocs = [...awaitingReviewItems, ...expiredItems, ...expiringSoonItems, ...rejectedItems];

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    displayDocs = displayDocs.filter(d => 
      d.holderName.toLowerCase().includes(term) ||
      d.requirementName.toLowerCase().includes(term) ||
      (d.issuerProvider && d.issuerProvider.toLowerCase().includes(term))
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div 
          className="card" 
          onClick={() => setUrgencyFilter('awaiting_review')}
          style={{ 
            cursor: 'pointer', 
            borderLeft: '4px solid var(--brand-gold)',
            backgroundColor: urgencyFilter === 'awaiting_review' ? 'var(--status-warning-bg)' : 'var(--bg-surface)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Awaiting Review</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-gold)' }}>{awaitingReviewItems.length}</div>
        </div>

        <div 
          className="card" 
          onClick={() => setUrgencyFilter('expired')}
          style={{ 
            cursor: 'pointer', 
            borderLeft: '4px solid var(--status-danger-text)',
            backgroundColor: urgencyFilter === 'expired' ? 'var(--status-danger-bg)' : 'var(--bg-surface)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Expired Certificates</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--status-danger-text)' }}>{expiredItems.length}</div>
        </div>

        <div 
          className="card" 
          onClick={() => setUrgencyFilter('expiring_soon')}
          style={{ 
            cursor: 'pointer', 
            borderLeft: '4px solid #D97706',
            backgroundColor: urgencyFilter === 'expiring_soon' ? 'var(--status-warning-bg)' : 'var(--bg-surface)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Expiring Soon (60d)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#D97706' }}>{expiringSoonItems.length}</div>
        </div>

        <div 
          className="card" 
          onClick={() => setUrgencyFilter('rejected')}
          style={{ 
            cursor: 'pointer', 
            borderLeft: '4px solid var(--status-danger-text)',
            backgroundColor: urgencyFilter === 'rejected' ? 'var(--status-danger-bg)' : 'var(--bg-surface)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rejected Items</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--status-danger-text)' }}>{rejectedItems.length}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by person name or requirement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${urgencyFilter === 'all' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setUrgencyFilter('all')}
            >
              All Attention Items
            </button>
            <button
              type="button"
              className={`btn btn-sm ${urgencyFilter === 'awaiting_review' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setUrgencyFilter('awaiting_review')}
            >
              Awaiting Review ({awaitingReviewItems.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${urgencyFilter === 'expired' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setUrgencyFilter('expired')}
            >
              Expired ({expiredItems.length})
            </button>
          </div>
        </div>
      </div>

      {/* Action Items List */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading items needing attention...
          </div>
        ) : displayDocs.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={36} style={{ color: 'var(--status-success-text)', marginBottom: '10px' }} />
            <div>No items currently requiring attention under this filter.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Holder / Entity</th>
                  <th>Requirement</th>
                  <th>Issuer / Ref</th>
                  <th>Expiry Date</th>
                  <th>Action Needed</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayDocs.map(docItem => {
                  const status = docItem.reviewStatus === 'Awaiting Review' ? 'Awaiting Review' : calculateCompetencyStatus(docItem);
                  return (
                    <tr key={docItem.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{docItem.holderName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Type: {docItem.holderType}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{docItem.requirementName}</div>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          {docItem.requirementCategory}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{docItem.issuerProvider || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ref: {docItem.referenceNumber || 'N/A'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {docItem.doesNotExpire ? 'Does Not Expire' : (docItem.expiryDate ? new Date(docItem.expiryDate).toLocaleDateString('en-GB') : 'No Date')}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${status === 'Awaiting Review' ? 'pending' : status === 'Expired' ? 'expired' : 'expiring'}`}>
                          {status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {docItem.documentUrl && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setPreviewingDoc(docItem)}
                              title="Preview Document"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-navy btn-sm"
                            onClick={() => setReviewingDoc(docItem)}
                          >
                            <Edit3 size={14} />
                            <span>Review</span>
                          </button>
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

      {/* Review Modal */}
      {reviewingDoc && (
        <ReviewEvidenceModal
          competencyDoc={reviewingDoc}
          onClose={() => setReviewingDoc(null)}
          onSuccess={() => setReviewingDoc(null)}
        />
      )}

      {/* Preview Modal */}
      {previewingDoc && (
        <DocumentPreviewModal
          doc={previewingDoc}
          onClose={() => setPreviewingDoc(null)}
        />
      )}
    </div>
  );
};
