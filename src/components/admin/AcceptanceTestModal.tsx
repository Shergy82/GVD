import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle, X, Loader2, FileCheck } from 'lucide-react';
import { runAcceptanceTests, type TestResult } from '../../services/acceptanceTests';

interface AcceptanceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcceptanceTestModal: React.FC<AcceptanceTestModalProps> = ({ isOpen, onClose }) => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

  if (!isOpen) return null;

  const handleRunAll = async () => {
    setRunning(true);
    setResults([]);
    setSelectedResult(null);

    const testResults = await runAcceptanceTests((res) => {
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
            <FileCheck size={22} style={{ color: 'var(--brand-gold, #FFC107)' }} />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#FFF' }}>
                Stage 5 Acceptance Test Suite (Tests A – T)
              </h2>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
                Controlled validation of calculations, permissions, duplicate controls & cost life-cycle
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#94A3B8',
              cursor: 'pointer', padding: '6px', borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '12px 24px', background: 'var(--bg-subtle, #F8FAFC)',
          borderBottom: '1px solid var(--border-color, #E2E8F0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
        }}>
          <button
            onClick={handleRunAll}
            disabled={running}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: running ? 'var(--bg-subtle, #E2E8F0)' : 'var(--brand-gold, #D97706)',
              color: running ? '#64748B' : '#FFFFFF', fontWeight: 700, fontSize: '0.85rem',
              cursor: running ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {running ? <><Loader2 size={16} className="spin" /> Executing 20 Tests...</> : <><Play size={16} /> Run Acceptance Tests</>}
          </button>

          {results.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem' }}>
              <span style={{ color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={16} /> {passedCount} Passed
              </span>
              {failedCount > 0 && (
                <span style={{ color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <XCircle size={16} /> {failedCount} Failed
                </span>
              )}
              <span style={{ color: 'var(--text-muted, #64748B)' }}>
                Total: {results.length} / 20
              </span>
            </div>
          )}
        </div>

        {/* Body Split */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Test List */}
          <div style={{
            width: '45%', borderRight: '1px solid var(--border-color, #E2E8F0)',
            overflowY: 'auto', padding: '12px'
          }}>
            {results.length === 0 && !running && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #64748B)' }}>
                Click <strong>Run Acceptance Tests</strong> above to execute the automated test cases across claims, rates, approvals, invoices and payments.
              </div>
            )}

            {results.map(test => {
              const isSelected = selectedResult?.id === test.id;
              const isPassed = test.status === 'passed';
              return (
                <div
                  key={test.id}
                  onClick={() => setSelectedResult(test)}
                  style={{
                    padding: '12px 14px', borderRadius: '8px', marginBottom: '8px',
                    border: `1px solid ${isSelected ? 'var(--brand-gold, #D97706)' : 'var(--border-color, #E2E8F0)'}`,
                    background: isSelected ? 'var(--brand-gold-light, #FEF3C7)' : 'var(--bg-surface, #FFFFFF)',
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: isPassed ? '#DCFCE7' : '#FEE2E2',
                        color: isPassed ? '#16A34A' : '#DC2626',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 800
                      }}>
                        {test.id}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary, #0F172A)' }}>
                        {test.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)' }}>
                      {test.durationMs}ms
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #475569)', paddingLeft: '32px' }}>
                    {test.description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Test Detail Pane */}
          <div style={{ width: '55%', overflowY: 'auto', padding: '24px', background: 'var(--bg-subtle, #F8FAFC)' }}>
            {selectedResult ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px',
                    borderRadius: '4px',
                    background: selectedResult.status === 'passed' ? '#DCFCE7' : '#FEE2E2',
                    color: selectedResult.status === 'passed' ? '#16A34A' : '#DC2626'
                  }}>
                    TEST {selectedResult.id} • {selectedResult.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)' }}>
                    Category: {selectedResult.category}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary, #0F172A)' }}>
                  {selectedResult.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #475569)', marginBottom: '16px' }}>
                  {selectedResult.description}
                </p>

                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary, #0F172A)' }}>
                  Assertion Details & Execution Log
                </h4>
                <div style={{
                  background: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--border-color, #E2E8F0)',
                  padding: '14px', fontSize: '0.8rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '6px'
                }}>
                  {selectedResult.details.map((line, idx) => (
                    <div key={idx} style={{ color: line.startsWith('✓') ? '#16A34A' : 'var(--text-primary, #1E293B)' }}>
                      • {line}
                    </div>
                  ))}
                </div>

                {selectedResult.error && (
                  <div style={{
                    marginTop: '16px', padding: '12px', background: '#FEE2E2',
                    borderRadius: '8px', border: '1px solid #DC2626', color: '#B91C1C',
                    fontSize: '0.8rem'
                  }}>
                    <strong>Failure Details:</strong> {selectedResult.error}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted, #64748B)' }}>
                Select a test from the left list to view assertion logs and details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
