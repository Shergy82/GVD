import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, AlertCircle, Building2, User, CheckCircle2 } from 'lucide-react';
import type { ProjectAccessPreset, ProjectMember, UserProfile, CompanyProfile } from '../../types';
import { addProjectMember } from '../../services/projectService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface AddMemberModalProps {
  projectId: string;
  existingMemberUids: string[];
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  projectId,
  existingMemberUids,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'individual' | 'company'>('individual');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selected User State
  const [selectedUserUid, setSelectedUserUid] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedNamedUserUids, setSelectedNamedUserUids] = useState<string[]>([]);
  
  const [accessPreset, setAccessPreset] = useState<ProjectAccessPreset>('Contractor Participant');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDirectory() {
      try {
        setLoadingData(true);
        // Load approved users
        const usersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'approved')));
        const loadedUsers: UserProfile[] = [];
        usersSnap.forEach(d => loadedUsers.push({ uid: d.id, ...d.data() } as UserProfile));

        // Load active companies
        const compSnap = await getDocs(query(collection(db, 'companies'), where('status', '==', 'active')));
        const loadedComp: CompanyProfile[] = [];
        compSnap.forEach(d => loadedComp.push({ id: d.id, ...d.data() } as CompanyProfile));

        setUsersList(loadedUsers);
        setCompaniesList(loadedComp);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingData(false);
      }
    }
    loadDirectory();
  }, []);

  // When company is selected, update company contacts list
  const companyUsers = selectedCompanyId 
    ? usersList.filter(u => u.companyId === selectedCompanyId || (companiesList.find(c => c.id === selectedCompanyId)?.associatedUserIds || []).includes(u.uid))
    : [];

  const handleAddIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserUid) {
      setError('Please select a person to add.');
      return;
    }

    const targetUser = usersList.find(u => u.uid === selectedUserUid);
    if (!targetUser) return;

    setSaving(true);
    setError(null);

    try {
      const preset = targetUser.applicationCategory === 'GVD Employee' ? 'GVD Project Team' : accessPreset;
      const memberRecord: ProjectMember = {
        uid: targetUser.uid,
        fullName: targetUser.fullName,
        email: targetUser.email,
        phone: targetUser.phone,
        companyName: targetUser.companyName || '',
        trade: targetUser.primaryTrade || '',
        role: targetUser.role,
        accessPreset: preset,
        addedAt: new Date().toISOString(),
        addedBy: currentUser.fullName
      };

      await addProjectMember(projectId, memberRecord, currentUser);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add project member.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCompanyContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      setError('Please select a contractor company.');
      return;
    }
    if (selectedNamedUserUids.length === 0) {
      setError('Selecting a company does not silently grant access. Please check the specific named contacts who should receive access.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const company = companiesList.find(c => c.id === selectedCompanyId);
      for (const uid of selectedNamedUserUids) {
        const u = usersList.find(usr => usr.uid === uid);
        if (u && !existingMemberUids.includes(u.uid)) {
          const memberRecord: ProjectMember = {
            uid: u.uid,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            companyName: company?.companyName || u.companyName || '',
            trade: u.primaryTrade || '',
            role: u.role,
            accessPreset: 'Company Contact',
            addedAt: new Date().toISOString(),
            addedBy: currentUser.fullName
          };
          await addProjectMember(projectId, memberRecord, currentUser);
        }
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add company contacts to project.');
    } finally {
      setSaving(false);
    }
  };

  const availableIndividualUsers = usersList.filter(u => !existingMemberUids.includes(u.uid));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Add Project Member / Company</h3>
              <p className="text-xs text-slate-300">Grant authorized project workspace access</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Disclaimer Banner */}
        <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex items-start space-x-2 text-xs text-indigo-900">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong>Important:</strong> Project access lets this person see authorised job information. It does <em>not</em> book them to attend. (The Planner will handle site bookings later).
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b text-xs font-semibold">
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex-1 py-3 border-b-2 text-center transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'individual'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Individual Person (GVD / Subcontractor)</span>
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`flex-1 py-3 border-b-2 text-center transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'company'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Contractor Company</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loadingData ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading directory accounts...</div>
          ) : activeTab === 'individual' ? (
            <form onSubmit={handleAddIndividual} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Person</label>
                <select
                  value={selectedUserUid}
                  onChange={(e) => setSelectedUserUid(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  <option value="">-- Choose Approved User --</option>
                  {availableIndividualUsers.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.fullName} — {u.applicationCategory} ({u.primaryTrade || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Access Preset</label>
                <select
                  value={accessPreset}
                  onChange={(e) => setAccessPreset(e.target.value as ProjectAccessPreset)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  <option value="Contractor Participant">Contractor Participant (Site photos, assigned actions, drawings)</option>
                  <option value="GVD Project Team">GVD Project Team (Full internal GVD access)</option>
                  <option value="Company Contact">Company Contact (High-level job overview & docs)</option>
                </select>
              </div>

              <div className="pt-3 border-t flex items-center justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow disabled:opacity-50"
                >
                  {saving ? 'Adding Member...' : 'Grant Project Access'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAddCompanyContacts} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Contractor Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedNamedUserUids([]);
                  }}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  <option value="">-- Choose Company Profile --</option>
                  {companiesList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.businessPhone || c.businessEmail})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCompanyId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center space-x-2 text-amber-900 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    <span>Explicit Named Users Selection</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Selecting a company does not automatically give all company-linked accounts access. Check which specific contacts should receive access:
                  </p>

                  {companyUsers.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-1">No registered user accounts linked to this company yet.</p>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {companyUsers.map(usr => (
                        <label key={usr.uid} className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer bg-white p-2 rounded border border-amber-200">
                          <input 
                            type="checkbox"
                            checked={selectedNamedUserUids.includes(usr.uid)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedNamedUserUids([...selectedNamedUserUids, usr.uid]);
                              else setSelectedNamedUserUids(selectedNamedUserUids.filter(id => id !== usr.uid));
                            }}
                            className="rounded text-indigo-600"
                          />
                          <div className="flex-1">
                            <span className="font-semibold">{usr.fullName}</span>
                            <span className="text-slate-500 text-[11px] block">{usr.email} • {usr.phone}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t flex items-center justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || selectedNamedUserUids.length === 0}
                  className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow disabled:opacity-50"
                >
                  {saving ? 'Adding Contacts...' : `Grant Access to ${selectedNamedUserUids.length} Named User(s)`}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
