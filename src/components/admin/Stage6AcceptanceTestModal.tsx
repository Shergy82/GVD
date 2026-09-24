import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle, X, Loader2, ShoppingBag } from 'lucide-react';
import { runStage6AcceptanceTests, type Stage6TestResult } from '../../services/stage6AcceptanceTests';

interface Stage6AcceptanceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Stage6AcceptanceTestModal: React.FC<Stage6AcceptanceTestModalProps> = ({ isOpen, onClose }) => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Stage6TestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<Stage6TestResult | null>(null);

  if (!isOpen) return null;

  const handleRunAll = async () => {
    setRunning(true);
    setResults([]);
    setSelectedResult(null);

    const testResults = await runStage6AcceptanceTests((res) => {
      setResults(prev => [...prev.filter(r => r.id !== res.id), res]);
    });

    setResults(testResults);
    setRunning(false);
  };

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-surface, #FFFFFF)', borderRadius: '16px',
        width: '100%', maxWidth: '900px', height: '90vh', display: 'flex',
        flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        border: '1px solid var(--border-color, #E2E8F0)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border-color, #E2E8F0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--brand-navy, #0B192C)', color: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag size={22} style={{ color: 'var(--brand-gold, #FFC107)' }} />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#FFF' }}>
                Stage 6 Acceptance Test Suite (Tests A – S)
              </h2>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
                Materials requests, PO revisions, supplier invoices, matching headroom & cost separation
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '14px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>
              Total: <strong>19 Tests (A–S)</strong>
            </span>
            {results.length > 0 && (
              <>
                <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={16} /> {passedCount} Passed
                </span>
                {failedCount > 0 && (
                  <span style={{ color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <XCircle size={16} /> {failedCount} Failed
                  </span>
                )}
              </>
            )}
          </div>

          <button
            onClick={handleRunAll}
            disabled={running}
            className="btn btn-primary"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700
            }}
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Running Test Suite...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Run All Stage 6 Tests</span>
              </>
            )}
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Test List */}
          <div style={{ width: '45%', borderRight: '1px solid #E2E8F0', overflowY: 'auto', padding: '8px' }}>
            {results.length === 0 && !running && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
                <Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                Click <strong>"Run All Stage 6 Tests"</strong> to validate purchasing workflows.
              </div>
            )}

            {results.map((res) => {
              const isSelected = selectedResult?.id === res.id;
              const isPassed = res.status === 'passed';
              return (
                <div
                  key={res.id}
                  onClick={() => setSelectedResult(res)}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', marginBottom: '6px',
                    cursor: 'pointer', background: isSelected ? '#EFF6FF' : '#FFF',
                    border: isSelected ? '1px solid #3B82F6' : '1px solid #E2E8F0',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isPassed ? (
                        <CheckCircle size={16} style={{ color: '#059669', flexShrink: 0 }} />
                      ) : (
                        <XCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
                      )}
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>
                        Test {res.id}: {res.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{res.durationMs}ms</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', marginLeft: '24px' }}>
                    {res.category}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details Pane */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#FAFAFA' }}>
            {selectedResult ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                    background: selectedResult.status === 'passed' ? '#DCFCE7' : '#FEE2E2',
                    color: selectedResult.status === 'passed' ? '#166534' : '#991B1B'
                  }}>
                    {selectedResult.status.toUpperCase()}
                  </span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                    Test {selectedResult.id} — {selectedResult.name}
                  </h3>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '16px', lineHeight: 1.5 }}>
                  {selectedResult.description}
                </div>

                <div style={{
                  background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0',
                  padding: '16px', marginBottom: '16px'
                }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginTop: 0, marginBottom: '10px' }}>
                    Execution Evidence & Assertions:
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: '#1E293B', lineHeight: 1.7 }}>
                    {selectedResult.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                {selectedResult.error && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #F87171', borderRadius: '8px',
                    padding: '14px', color: '#991B1B', fontSize: '0.8rem'
                  }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <AlertTriangle size={16} /> Error Failure Reason:
                    </strong>
                    <code>{selectedResult.error}</code>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                Select a test on the left to inspect its parameters, evidence and verification records.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid #E2E8F0', background: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B'
        }}>
          <span>GVD Connect Operations Control — Stage 6 Automated Verification</span>
          <button onClick={onClose} className="btn btn-outline btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
};
