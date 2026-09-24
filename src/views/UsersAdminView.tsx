import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import type { UserProfile, UserRole, ApplicationCategory, AccountStatus } from '../types';
import { 
  Users, 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Search, 
  UserX, 
  RotateCcw, 
  FileText, 
  Lock,
  Mail
} from 'lucide-react';

export const UsersAdminView: React.FC = () => {
  const { currentUser, isOwner, isAdmin, recordAuditLog } = useAuth();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved_inactive'>('pending');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Modal form state
  const [assignedRole, setAssignedRole] = useState<UserRole>('IndividualContractor');
  const [correctedCategory, setCorrectedCategory] = useState<ApplicationCategory>('Individual Contractor');
  const [primaryTrade, setPrimaryTrade] = useState<string>('');
  const [planningEligible, setPlanningEligible] = useState<boolean>(false);
  const [adminNotes, setAdminNotes] = useState<string>('');
  
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Real-time listener for all users in Firestore
  useEffect(() => {
    if (!isAdmin) return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });

      // Sort by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUsersList(list);
      setLoadingUsers(false);
    }, (err) => {
      console.error("Firestore users listen error:", err);
      setLoadingUsers(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Open User Detail Panel
  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setCorrectedCategory(user.applicationCategory || 'Individual Contractor');
    setPrimaryTrade(user.primaryTrade || '');
    setPlanningEligible(user.planningEligible ?? false);
    setAdminNotes(user.adminNotes || '');
    setActionError(null);
    setActionSuccess(null);

    // Suggest appropriate default role based on category
    if (user.role && user.role !== 'IndividualContractor' && user.role !== 'ContractorCompany') {
      setAssignedRole(user.role);
    } else {
      if (user.applicationCategory === 'Contractor Company') {
        setAssignedRole('ContractorCompany');
      } else if (user.applicationCategory === 'GVD Employee') {
        setAssignedRole('ProjectManager');
      } else {
        setAssignedRole('IndividualContractor');
      }
    }
  };

  // Filtered lists
  const pendingUsers = usersList.filter(u => u.status === 'pending');
  const approvedInactiveUsers = usersList.filter(u => u.status === 'approved' || u.status === 'inactive' || u.status === 'rejected');

  const filteredUsers = (activeTab === 'pending' ? pendingUsers : approvedInactiveUsers).filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.companyName && u.companyName.toLowerCase().includes(term))
    );
  });

  // Count active owners
  const activeOwnersCount = usersList.filter(u => u.role === 'Owner' && u.status === 'approved').length;

  // Handle Approve User
  const handleApprove = async () => {
    if (!selectedUser || !currentUser) return;
    setActionError(null);
    setActionSuccess(null);

    // Permission checks
    if (assignedRole === 'Admin' || assignedRole === 'Owner') {
      if (!isOwner) {
        setActionError("Only the Owner can grant Admin or Owner privileges.");
        return;
      }
    }

    if (!selectedUser.emailVerified) {
      setActionError("Cannot approve application until email address is verified.");
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const updates = {
        status: 'approved' as AccountStatus,
        role: assignedRole,
        applicationCategory: correctedCategory,
        primaryTrade: primaryTrade.trim() || undefined,
        planningEligible: planningEligible,
        adminNotes: adminNotes.trim(),
        approvedBy: currentUser.uid,
        approvedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updates);

      await recordAuditLog(
        'Approve User Application',
        'UserProfile',
        selectedUser.uid,
        `Approved ${selectedUser.fullName} as ${assignedRole}`,
        { status: selectedUser.status, role: selectedUser.role },
        updates
      );

      setActionSuccess(`Application for ${selectedUser.fullName} approved as ${assignedRole}!`);
      setTimeout(() => setSelectedUser(null), 1500);
    } catch (err: any) {
      console.error("Approval failed:", err);
      setActionError(err.message || "Failed to approve user.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reject User
  const handleReject = async () => {
    if (!selectedUser || !currentUser) return;
    setActionError(null);
    setActionSuccess(null);

    // Cannot reject last active owner
    if (selectedUser.role === 'Owner' && activeOwnersCount <= 1) {
      setActionError("Cannot reject the primary Owner account.");
      return;
    }

    if (selectedUser.role === 'Admin' && !isOwner) {
      setActionError("Only the Owner can reject an Admin account.");
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const updates = {
        status: 'rejected' as AccountStatus,
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updates);

      await recordAuditLog(
        'Reject User Application',
        'UserProfile',
        selectedUser.uid,
        `Rejected application for ${selectedUser.fullName}`,
        { status: selectedUser.status },
        updates
      );

      setActionSuccess(`Application for ${selectedUser.fullName} has been rejected.`);
      setTimeout(() => setSelectedUser(null), 1500);
    } catch (err: any) {
      console.error("Rejection failed:", err);
      setActionError(err.message || "Failed to reject user.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Deactivate User
  const handleDeactivate = async () => {
    if (!selectedUser || !currentUser) return;
    setActionError(null);
    setActionSuccess(null);

    // Cannot deactivate last active owner
    if (selectedUser.role === 'Owner') {
      if (activeOwnersCount <= 1) {
        setActionError("Cannot deactivate the only active Owner account.");
        return;
      }
      if (!isOwner) {
        setActionError("Only an Owner can deactivate an Owner account.");
        return;
      }
    }

    if (selectedUser.role === 'Admin' && !isOwner) {
      setActionError("Only the Owner can deactivate an Admin account.");
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const updates = {
        status: 'inactive' as AccountStatus,
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updates);

      await recordAuditLog(
        'Deactivate User',
        'UserProfile',
        selectedUser.uid,
        `Deactivated account for ${selectedUser.fullName}`,
        { status: selectedUser.status },
        updates
      );

      setActionSuccess(`Account for ${selectedUser.fullName} has been deactivated.`);
      setTimeout(() => setSelectedUser(null), 1500);
    } catch (err: any) {
      console.error("Deactivation failed:", err);
      setActionError(err.message || "Failed to deactivate user.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reactivate User
  const handleReactivate = async () => {
    if (!selectedUser || !currentUser) return;
    setActionError(null);
    setActionSuccess(null);

    if (selectedUser.role === 'Admin' && !isOwner) {
      setActionError("Only the Owner can reactivate an Admin account.");
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const updates = {
        status: 'approved' as AccountStatus,
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updates);

      await recordAuditLog(
        'Reactivate User',
        'UserProfile',
        selectedUser.uid,
        `Reactivated account for ${selectedUser.fullName}`,
        { status: selectedUser.status },
        updates
      );

      setActionSuccess(`Account for ${selectedUser.fullName} has been reactivated.`);
      setTimeout(() => setSelectedUser(null), 1500);
    } catch (err: any) {
      console.error("Reactivation failed:", err);
      setActionError(err.message || "Failed to reactivate user.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Lock size={48} style={{ color: 'var(--status-danger-text)', marginBottom: '16px' }} />
        <h2>Access Restricted</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Only GVD Administrators can access the user approval directory.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header & Tabs */}
      <div className="card-header" style={{ marginBottom: '20px', borderBottom: 'none' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
            User Approvals & Account Directory
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Review pending applications, set roles, and manage access statuses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'pending' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveTab('pending')}
            style={{ fontWeight: 600 }}
          >
            <Clock size={16} />
            <span>Pending Applications ({pendingUsers.length})</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'approved_inactive' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setActiveTab('approved_inactive')}
            style={{ fontWeight: 600 }}
          >
            <UserCheck size={16} />
            <span>Approved / Inactive ({approvedInactiveUsers.length})</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by full name, company, or email address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={18} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
        </div>
      </div>

      {/* Table List View */}
      <div className="card">
        {loadingUsers ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading user registry...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No users found in this view.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Applicant / User</th>
                  <th>Category</th>
                  <th>Contact Info</th>
                  <th>Email Verification</th>
                  <th>Status / Role</th>
                  <th>Application Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.fullName}</div>
                      {user.companyName && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {user.companyName}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                        {user.applicationCategory || 'Individual Contractor'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{user.email}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.phone || 'No phone'}</div>
                    </td>
                    <td>
                      {user.emailVerified ? (
                        <span className="badge badge-valid">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      ) : (
                        <span className="badge badge-expiring">
                          <Clock size={12} /> Unverified
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`badge badge-${user.status === 'approved' ? 'approved' : user.status === 'pending' ? 'pending' : 'blocked'}`}>
                          {user.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Role: {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="nowrap" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleSelectUser(user)}
                      >
                        <Edit3 size={14} />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Application Review / Edit Panel Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            maxWidth: '620px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>
                  Review Application: {selectedUser.fullName}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  UID: {selectedUser.uid}
                </div>
              </div>
              <span className={`badge badge-${selectedUser.status === 'approved' ? 'approved' : selectedUser.status === 'pending' ? 'pending' : 'blocked'}`}>
                {selectedUser.status}
              </span>
            </div>

            {/* Feedback Alerts */}
            {actionError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-danger-bg)',
                color: 'var(--status-danger-text)',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                <ShieldAlert size={16} />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-success-bg)',
                color: 'var(--status-success-text)',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                <CheckCircle2 size={16} />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Applicant Metadata Summary */}
            <div style={{
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '0.875rem'
            }}>
              <div className="grid-2" style={{ gap: '12px' }}>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Email:</strong> {selectedUser.email}
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Phone:</strong> {selectedUser.phone || 'N/A'}
                </div>
                {selectedUser.companyName && (
                  <div>
                    <strong style={{ color: 'var(--text-secondary)' }}>Company:</strong> {selectedUser.companyName}
                  </div>
                )}
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Email Verified:</strong>{' '}
                  {selectedUser.emailVerified ? (
                    <span style={{ color: 'var(--status-success-text)', fontWeight: 700 }}>Yes</span>
                  ) : (
                    <span style={{ color: 'var(--status-warning-text)', fontWeight: 700 }}>No (Approval blocked)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Configuration Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* Correct Category */}
              <div className="form-group">
                <label className="form-label">Application Category</label>
                <select
                  className="form-select"
                  value={correctedCategory}
                  onChange={(e) => setCorrectedCategory(e.target.value as ApplicationCategory)}
                  disabled={isProcessing}
                >
                  <option value="GVD Employee">GVD Employee</option>
                  <option value="Individual Contractor">Individual Contractor</option>
                  <option value="Contractor Company">Contractor Company</option>
                </select>
              </div>

              {/* Assign Approved Role */}
              <div className="form-group">
                <label className="form-label">Assigned Account Role *</label>
                <select
                  className="form-select"
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value as UserRole)}
                  disabled={isProcessing}
                >
                  <optgroup label="Operational & Staff Roles">
                    <option value="ProjectManager">Project Manager</option>
                    <option value="Planner">Planner</option>
                    <option value="Accounts">Accounts</option>
                  </optgroup>
                  <optgroup label="Contractor Roles">
                    <option value="IndividualContractor">Individual Contractor</option>
                    <option value="ContractorCompany">Contractor Company</option>
                  </optgroup>
                  <optgroup label="Administrative Roles (Owner Only)">
                    <option value="Admin" disabled={!isOwner}>Admin</option>
                    <option value="Owner" disabled={!isOwner}>Owner</option>
                  </optgroup>
                </select>
                {assignedRole === 'Admin' || assignedRole === 'Owner' ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', marginTop: '4px' }}>
                    Note: Granting Admin or Owner authority requires Owner privileges.
                  </div>
                ) : null}
              </div>

              {/* Primary Trade */}
              <div className="form-group">
                <label className="form-label">Primary Trade (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Electrician, Carpenter, Plumbing"
                  value={primaryTrade}
                  onChange={(e) => setPrimaryTrade(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              {/* Planning Eligibility */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={planningEligible}
                    onChange={(e) => setPlanningEligible(e.target.checked)}
                    disabled={isProcessing}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-navy)' }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    Enable Planning Eligibility (Should appear in planner resource lists)
                  </span>
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '28px', marginTop: '2px' }}>
                  Defaults to OFF. Enables person for site scheduling in future stages.
                </div>
              </div>

              {/* Private Admin Notes */}
              <div className="form-group">
                <label className="form-label">Private Administrative Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Internal notes visible only to GVD Administrators..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedUser(null)}
                disabled={isProcessing}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedUser.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleReject}
                      disabled={isProcessing}
                    >
                      <XCircle size={16} />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-navy"
                      onClick={handleApprove}
                      disabled={isProcessing || !selectedUser.emailVerified}
                    >
                      <CheckCircle2 size={16} />
                      <span>Approve Application</span>
                    </button>
                  </>
                )}

                {selectedUser.status === 'approved' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleDeactivate}
                      disabled={isProcessing}
                    >
                      <UserX size={16} />
                      <span>Deactivate Account</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-navy"
                      onClick={handleApprove}
                      disabled={isProcessing}
                    >
                      <CheckCircle2 size={16} />
                      <span>Save Changes</span>
                    </button>
                  </>
                )}

                {(selectedUser.status === 'inactive' || selectedUser.status === 'rejected') && (
                  <button
                    type="button"
                    className="btn btn-navy"
                    onClick={handleReactivate}
                    disabled={isProcessing}
                  >
                    <RotateCcw size={16} />
                    <span>Reactivate Account</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
