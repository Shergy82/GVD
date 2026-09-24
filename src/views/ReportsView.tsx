import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  FileCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Filter, 
  Building,
  DollarSign
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { MOCK_PROJECTS, MOCK_CLAIMS, MOCK_SUPPLIER_INVOICES, MOCK_SUBCONTRACT_ORDERS } from '../services/mockData';
import { ProjectCommercials } from '../types';

export const ReportsView: React.FC = () => {
  const { currentUser, isGvdStaff, isOwner, isAdmin } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<'month' | 'quarter' | 'year'>('month');

  // Commercial Calculation Engine (Section 13)
  const prj = MOCK_PROJECTS[0]; // 14 Grosvenor Square
  const contractValuePence = prj.contractValuePence;
  const customerVarsPence = prj.customerVariationsPence;
  const totalRevisedContractPence = contractValuePence + customerVarsPence; // £140,000.00

  const actualLabourPence = 110000; // £1,100.00
  const actualInvoicesPence = 85000; // £850.00
  const actualSubcontractPence = 400000; // £4,000.00
  const totalActualCostsPence = actualLabourPence + actualInvoicesPence + actualSubcontractPence; // £5,950.00

  const committedSubcontractPence = 700000; // £7,000.00 remaining
  const forecastRemainingPence = 2500000; // £25,000.00 to complete
  const forecastFinalCostPence = totalActualCostsPence + committedSubcontractPence + forecastRemainingPence; // £37,950.00

  const forecastProfitPence = totalRevisedContractPence - forecastFinalCostPence; // £102,050.00
  const marginPercentage = (forecastProfitPence / totalRevisedContractPence) * 100; // ~72.89%

  const exportCSV = () => {
    const headers = "Project Ref,Customer,Contract Value,Actual Costs,Forecast Final Cost,Forecast Profit,Margin %\n";
    const row = `${prj.reference},${prj.customerName},${(totalRevisedContractPence/100).toFixed(2)},${(totalActualCostsPence/100).toFixed(2)},${(forecastFinalCostPence/100).toFixed(2)},${(forecastProfitPence/100).toFixed(2)},${marginPercentage.toFixed(2)}%\n`;
    const blob = new Blob([headers + row], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GVD_Commercial_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Financial Cost Control & Management Reports</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Integer minor currency math, project margin reporting, and period performance exports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={exportCSV}>
            <Download size={16} /> Export CSV Report
          </button>
        </div>
      </div>

      {/* Commercial Breakdown Header Cards */}
      <div className="grid-4">
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Revised Contract Value</span>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            £{(totalRevisedContractPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Actual Costs Recognised</span>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: '2px' }}>
            £{(totalActualCostsPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Forecast Final Cost</span>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            £{(forecastFinalCostPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--status-success-bg)', border: '1px solid var(--status-success-text)', borderRadius: 'var(--radius-lg)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--status-success-text)', fontWeight: 700 }}>Forecast Project Margin</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-success-text)', marginTop: '2px' }}>
            {marginPercentage.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--status-success-text)', marginTop: '2px' }}>
            +£{(forecastProfitPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })} profit
          </div>
        </div>
      </div>

      {/* Main Commercial Breakdown Section (Mobile Cards + Desktop Table) */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Project Commercial Summary Breakdown</h3>
          <span className="badge badge-valid">Minor Currency Math (Pence)</span>
        </div>

        {/* Project Commercial Cards for Mobile & Laptop Screens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {MOCK_PROJECTS.map(p => (
            <div key={p.id} style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="ref-tag" style={{ fontWeight: 800, color: 'var(--brand-gold)', backgroundColor: 'var(--brand-navy)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                    {p.reference}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{p.customerName}</span>
                </div>
                <span className="badge badge-valid">{marginPercentage.toFixed(1)}% MARGIN</span>
              </div>

              <div className="grid-4" style={{ gap: '10px' }}>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Original Contract</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>£{(p.contractValuePence / 100).toLocaleString()}</div>
                </div>

                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer Variations</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--brand-gold)' }}>+£{(p.customerVariationsPence / 100).toLocaleString()}</div>
                </div>

                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actual Costs</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>£{(totalActualCostsPence / 100).toLocaleString()}</div>
                </div>

                <div style={{ padding: '8px 12px', backgroundColor: 'var(--status-success-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-success-text)', fontWeight: 700 }}>Forecast Profit</span>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--status-success-text)' }}>+£{(forecastProfitPence / 100).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Closure Defects & Financial Checklist */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '14px' }}>Pre-Closure Checklist & Financial Signoff</h3>
        <div className="grid-2">
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Site Completion Checklist</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ✓ All site works complete<br />
              ✓ Defects list resolved<br />
              ✓ Handover keys returned
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Financial Pre-Closure Audit</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ✓ All supplier invoices matched<br />
              ✓ Subcontract final account agreed<br />
              ✓ Client retention balance settled
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
