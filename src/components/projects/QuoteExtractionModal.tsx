import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  DollarSign, 
  HelpCircle,
  Clock
} from 'lucide-react';
import type { ProjectCommercial, QuoteProvisionalSum, UserProfile } from '../../types';
import { updateProjectCommercial, parseGBPToPence, formatPenceToGBP } from '../../services/projectService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';

interface QuoteExtractionModalProps {
  projectId: string;
  projectReference: string;
  existingCommercial?: ProjectCommercial | null;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const QuoteExtractionModal: React.FC<QuoteExtractionModalProps> = ({
  projectId,
  projectReference,
  existingCommercial,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'extracted' | 'failed' | 'manual'>('idle');

  // Form Fields (Extracted or Manual)
  const [quoteReference, setQuoteReference] = useState(existingCommercial?.quoteReference || '');
  const [quoteDate, setQuoteDate] = useState(existingCommercial?.quoteDate || '');
  const [netAmount, setNetAmount] = useState(existingCommercial?.netPence ? (existingCommercial.netPence / 100).toFixed(2) : '');
  const [vatAmount, setVatAmount] = useState(existingCommercial?.vatPence ? (existingCommercial.vatPence / 100).toFixed(2) : '');
  const [vatTreatment, setVatTreatment] = useState(existingCommercial?.vatTreatment || 'Standard 20% VAT');
  const [grossAmount, setGrossAmount] = useState(
    existingCommercial?.confirmedContractValuePence ? (existingCommercial.confirmedContractValuePence / 100).toFixed(2) : ''
  );
  const [exclusions, setExclusions] = useState<string>(
    existingCommercial?.exclusions ? existingCommercial.exclusions.join('\n') : ''
  );
  const [provisionalSumsText, setProvisionalSumsText] = useState<string>(
    existingCommercial?.provisionalSums ? existingCommercial.provisionalSums.map(p => `${p.item}: £${(p.amountPence / 100).toFixed(2)}`).join('\n') : ''
  );
  const [internalNotes, setInternalNotes] = useState(existingCommercial?.internalNotes || '');
  const [correctionReason, setCorrectionReason] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Simulated AI Extraction Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  };

  const handleSimulateExtraction = async () => {
    if (!selectedFile) return;
    setExtracting(true);
    setError(null);

    try {
      // Simulate backend processing & OCR extraction delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock AI Suggestions derived safely
      const fileNameLower = selectedFile.name.toLowerCase();
      let mockNet = 12500.00;
      let mockVat = 2500.00;
      let mockGross = 15000.00;
      let mockRef = `QT-${Math.floor(100000 + Math.random() * 900000)}`;

      if (fileNameLower.includes('small')) {
        mockNet = 4200.00;
        mockVat = 840.00;
        mockGross = 5040.00;
      }

      setQuoteReference(mockRef);
      setQuoteDate(new Date().toISOString().split('T')[0]);
      setNetAmount(mockNet.toFixed(2));
      setVatAmount(mockVat.toFixed(2));
      setGrossAmount(mockGross.toFixed(2));
      setExclusions("Scaffolding beyond 3 storeys\nUnforeseen ground contamination removal\nDecorating after plastering");
      setProvisionalSumsText("Electrical sub-main replacement: £1,200.00\nSpecialist asbestos survey allowance: £600.00");
      setExtractionStatus('extracted');
    } catch (err: any) {
      setExtractionStatus('failed');
      setError("AI Quote extraction could not process this document. You can enter the details manually below.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveConfirmedValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grossAmount || isNaN(parseFloat(grossAmount))) {
      setError("Please enter a valid confirmed total contract amount.");
      return;
    }

    if (existingCommercial?.hasConfirmedValue && existingCommercial.confirmedContractValuePence !== parseGBPToPence(grossAmount) && !correctionReason.trim()) {
      setError("Please provide a mandatory reason for changing a previously confirmed contract value.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let uploadedUrl = existingCommercial?.quoteDocumentUrl || '';
      let uploadedFileName = existingCommercial?.quoteFileName || '';

      if (selectedFile) {
        setUploading(true);
        const timestamp = Date.now();
        const storagePath = `project_quotes/${projectId}/${timestamp}_${selectedFile.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, selectedFile);
        uploadedUrl = await getDownloadURL(storageRef);
        uploadedFileName = selectedFile.name;
        setUploading(false);
      }

      // Parse provisional sums
      const parsedProvisionalSums: QuoteProvisionalSum[] = provisionalSumsText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            return {
              item: parts[0].trim(),
              amountPence: parseGBPToPence(parts.slice(1).join(':'))
            };
          }
          return { item: line, amountPence: 0 };
        });

      const parsedExclusions = exclusions.split('\n').map(s => s.trim()).filter(Boolean);

      const netPence = netAmount ? parseGBPToPence(netAmount) : undefined;
      const vatPence = vatAmount ? parseGBPToPence(vatAmount) : undefined;
      const grossPence = parseGBPToPence(grossAmount);

      const payload: Partial<ProjectCommercial> = {
        projectId,
        projectReference,
        quoteDocumentUrl: uploadedUrl,
        quoteFileName: uploadedFileName,
        quoteReference: quoteReference || undefined,
        quoteDate: quoteDate || undefined,
        confirmedContractValuePence: grossPence,
        hasConfirmedValue: true,
        netPence,
        vatPence,
        vatTreatment,
        grossPence,
        provisionalSums: parsedProvisionalSums,
        exclusions: parsedExclusions,
        internalNotes: internalNotes || undefined,
        extractionStatus: extractionStatus === 'extracted' ? 'Confirmed' : 'None'
      };

      await updateProjectCommercial(projectId, payload, correctionReason || undefined, currentUser);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save commercial contract value.');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Commercial & Quotation Extraction</h2>
              <p className="text-xs text-slate-300">{projectReference} — Owner/Admin Only Workspace</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quote Document Selection & AI Extract */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-900 font-semibold text-sm">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Upload Quotation Document (PDF / Scan)</span>
              </div>
              <span className="text-xs text-indigo-600 font-medium">Assisted AI Extraction Available</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input 
                type="file" 
                id="quote-file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label 
                htmlFor="quote-file"
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-300 text-slate-700 rounded-lg cursor-pointer text-sm font-medium flex items-center justify-center space-x-2 transition shadow-sm"
              >
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>{selectedFile ? selectedFile.name : (existingCommercial?.quoteFileName || 'Select Quote File')}</span>
              </label>

              {selectedFile && (
                <button
                  type="button"
                  onClick={handleSimulateExtraction}
                  disabled={extracting}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 animate-spin-slow" />
                  <span>{extracting ? 'Extracting Figures...' : 'Extract Suggested Figures'}</span>
                </button>
              )}
            </div>

            {extractionStatus === 'extracted' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-emerald-800 text-xs font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Figures extracted as suggestions below. Review, edit and confirm before saving.</span>
              </div>
            )}
          </div>

          {/* Review / Entry Form */}
          <form onSubmit={handleSaveConfirmedValue} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
              <span>Confirmed Commercial Figures</span>
              <span className="text-xs font-normal text-slate-500">Stored safely in integer minor units (pence)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quote Reference</label>
                <input 
                  type="text" 
                  value={quoteReference}
                  onChange={(e) => setQuoteReference(e.target.value)}
                  placeholder="e.g. Q-2026-889"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quote Date</label>
                <input 
                  type="date" 
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Net Amount (£)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={netAmount}
                  onChange={(e) => setNetAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">VAT Amount (£)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={vatAmount}
                  onChange={(e) => setVatAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">VAT Treatment</label>
                <select
                  value={vatTreatment}
                  onChange={(e) => setVatTreatment(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="Standard 20% VAT">Standard 20% VAT</option>
                  <option value="Reduced Rate 5%">Reduced Rate 5%</option>
                  <option value="Zero Rated 0%">Zero Rated 0%</option>
                  <option value="Domestic Reverse Charge">Domestic Reverse Charge</option>
                  <option value="Exempt">Exempt</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Confirmed Original Contract Value Gross (£) <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                step="0.01"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="e.g. 15000.00"
                required
                className="w-full px-3.5 py-2.5 border-2 border-indigo-200 rounded-lg text-base font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Parsed to pence: <strong className="text-slate-800">{formatPenceToGBP(grossAmount ? parseGBPToPence(grossAmount) : null)}</strong>
              </p>
            </div>

            {existingCommercial?.hasConfirmedValue && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 text-amber-900 font-semibold text-xs">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Administrative Correction — Mandatory Reason Required</span>
                </div>
                <input 
                  type="text" 
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Correcting original typo in gross figure from PDF"
                  className="w-full px-3 py-1.5 border border-amber-300 rounded text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Provisional Sums / Allowances (Format: Item: £Amount)</label>
              <textarea
                rows={2}
                value={provisionalSumsText}
                onChange={(e) => setProvisionalSumsText(e.target.value)}
                placeholder="Electrical replacement: £1200.00"
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exclusions (One per line)</label>
              <textarea
                rows={2}
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder="Scaffolding beyond 3 storeys"
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Commercial Notes (Owner/Admin Only)</label>
              <input 
                type="text" 
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Private notes for directors..."
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Form Footer */}
            <div className="pt-4 border-t flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-md disabled:opacity-50 flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Save Confirmed Commercial Record</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
