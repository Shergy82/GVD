import React, { useState } from 'react';
import { 
  Sparkles, 
  Plus, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  ShoppingBag, 
  Layers, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { MOCK_AI_MATERIALS, MOCK_PROJECTS } from '../services/mockData';
import { AIMaterialsList, AIMaterialItem, SequenceItem } from '../types';

export const AIMaterialsView: React.FC = () => {
  const { currentUser, isGvdStaff } = useAuth();
  const [materialsList, setMaterialsList] = useState<AIMaterialsList>(MOCK_AI_MATERIALS[0]);
  const [takeoffWizardOpen, setTakeoffWizardOpen] = useState(false);

  // Takeoff input state
  const [selectedTrades, setSelectedTrades] = useState<string[]>(['Plastering', 'Tiling', 'Plumbing & Heating']);
  const [scaleInput, setScaleInput] = useState('1:50 @ A3');
  const [heightInput, setHeightInput] = useState('2.7');
  const [wallType, setWallType] = useState('100mm Metal Stud');
  const [substrate, setSubstrate] = useState('12.5mm Moisture Board');

  const generateTakeoffPdf = (mat: AIMaterialsList) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GVD CONTRACTS — AI MATERIALS & SEQUENCE TAKEOFF', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Takeoff Reference: ${mat.reference}`, 14, 30);
    doc.text(`Project: ${mat.projectReference}`, 14, 36);
    doc.text(`Confirmed Scale: ${mat.confirmedInputs.drawingScale}`, 14, 42);
    doc.text(`Wall Substrate: ${mat.confirmedInputs.substrateType}`, 14, 48);

    doc.line(14, 54, 196, 54);

    let y = 64;
    doc.setFont('helvetica', 'bold');
    doc.text('Trade & Material Description', 14, y);
    doc.text('Qty', 110, y);
    doc.text('Unit', 130, y);
    doc.text('Net Est (£)', 160, y);

    doc.setFont('helvetica', 'normal');
    y += 8;
    mat.materials.forEach(m => {
      doc.text(`${m.trade}: ${m.itemDescription.substring(0, 45)}`, 14, y);
      doc.text(`${m.quantity}`, 110, y);
      doc.text(`${m.unit}`, 130, y);
      doc.text(`£${(m.estimatedTotalPence / 100).toFixed(2)}`, 160, y);
      y += 8;
    });

    doc.line(14, y + 4, 196, y + 4);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('Automated Sequence of Works:', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    mat.sequenceOfWorks.forEach(s => {
      doc.text(`Step ${s.stepNumber} [${s.phase}]: ${s.description}`, 14, y);
      y += 6;
    });

    doc.save(`${mat.reference}_Takeoff_GVD.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>AI Materials Takeoff & Sequence of Works</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Multi-trade automated takeoff, opening deductions, pack rounding, and specialist sequence steps.
          </p>
        </div>

        <div className="btn-group-responsive">
          <button className="btn btn-navy" onClick={() => generateTakeoffPdf(materialsList)}>
            <Download size={16} /> Export Takeoff PDF
          </button>
          <button className="btn btn-primary" onClick={() => setTakeoffWizardOpen(true)}>
            <Sparkles size={16} /> Run New AI Takeoff
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid-2">
        {/* Bill of Materials Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--brand-gold)', fontWeight: 700 }}>{materialsList.reference}</span>
              <h3 className="card-title">Bill of Quantities & Pack Rounding</h3>
            </div>
            <span className="badge badge-valid"><CheckCircle2 size={12} /> {materialsList.status}</span>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Item Description</th>
                  <th>Qty</th>
                  <th>Coverage / Calculation Detail</th>
                  <th>Est. Net (£)</th>
                </tr>
              </thead>
              <tbody>
                {materialsList.materials.map(m => (
                  <tr key={m.id}>
                    <td><span className="badge badge-info">{m.trade}</span></td>
                    <td><strong>{m.itemDescription}</strong></td>
                    <td><strong>{m.quantity} {m.unit}</strong></td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.coverageDetail}</span>
                      {m.siteCheckRequired && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--status-warning-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <AlertTriangle size={12} /> Site check required
                        </div>
                      )}
                    </td>
                    <td><strong>£{(m.estimatedTotalPence / 100).toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmed Specification & Sequence Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Confirmed Takeoff Parameters</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div><strong>Scale:</strong> {materialsList.confirmedInputs.drawingScale}</div>
              <div><strong>Ceiling Height:</strong> {materialsList.confirmedInputs.ceilingHeightMeters}m</div>
              <div><strong>Wall Construction:</strong> {materialsList.confirmedInputs.wallConstruction}</div>
              <div><strong>Substrate:</strong> {materialsList.confirmedInputs.substrateType}</div>
              <div><strong>Legend Notes:</strong> {materialsList.confirmedInputs.legendNotes}</div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated Net Cost</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-gold-hover)' }}>
                £{(materialsList.totalEstimatedNetPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
              <ShoppingBag size={16} /> Convert to Merchant PO
            </button>
          </div>

          {/* Sequence Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Automated Site Sequence of Works</h3>
              <span className="badge badge-info">{materialsList.sequenceOfWorks.length} Steps</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {materialsList.sequenceOfWorks.map(s => (
                <div key={s.id} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)', borderLeft: '4px solid var(--brand-navy)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--brand-navy)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                    {s.stepNumber}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.phase}: {s.trade}</span>
                      {s.specialistRequired && (
                        <span className="badge badge-expiring" style={{ fontSize: '0.65rem' }}>
                          <ShieldAlert size={10} /> Specialist Required
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TAKEOFF WIZARD MODAL */}
      {takeoffWizardOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '550px', width: '100%', margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Guided AI Takeoff Wizard</h3>
              <button onClick={() => setTakeoffWizardOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setTakeoffWizardOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Drawing Scale Confirmation</label>
                <input type="text" className="form-input" value={scaleInput} onChange={e => setScaleInput(e.target.value)} required />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Ceiling Height (m)</label>
                  <input type="text" className="form-input" value={heightInput} onChange={e => setHeightInput(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Wall Substrate</label>
                  <input type="text" className="form-input" value={substrate} onChange={e => setSubstrate(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Upload Drawing / Spec PDF</label>
                <input type="file" className="form-input" />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setTakeoffWizardOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Takeoff & Sequence</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
