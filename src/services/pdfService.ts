import { jsPDF } from 'jspdf';
import type { WeeklyClaim, InvoiceRecord } from '../types';
import { formatPenceToGBP } from './projectService';
import { formatDayHeader } from './plannerService';

/**
 * Generate a clean, professional A4 PDF for Claims:
 * - Draft Claim (watermarked Draft)
 * - Submitted Claim
 * - Approved Claim Summary
 */
export function generateClaimPDF(
  claim: WeeklyClaim,
  docType: 'Draft Claim' | 'Submitted Claim' | 'Approved Claim Summary' = 'Submitted Claim'
): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  let y = 18;

  const isDraft = docType === 'Draft Claim' || claim.status === 'Draft';
  const isApproved = docType === 'Approved Claim Summary' || claim.status === 'Approved' || claim.status === 'Partially Approved';

  // 1. Watermark for Draft
  if (isDraft) {
    doc.setTextColor(240, 240, 240);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(54);
    doc.text('DRAFT', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
  }

  // 2. Header
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(docType.toUpperCase(), margin, y);

  // Status Badge on top right
  doc.setFontSize(10);
  doc.setTextColor(isApproved ? 16 : isDraft ? 160 : 37, isApproved ? 120 : isDraft ? 70 : 99, isApproved ? 60 : isDraft ? 70 : 235);
  doc.text(`Status: ${claim.status}`, pageWidth - margin, y, { align: 'right' });
  y += 7;

  // Horizontal divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Metadata block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text(`Claim Reference:`, margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(claim.claimReference || 'DRAFT-REF', margin + 30, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Week Period:`, pageWidth / 2, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatDayHeader(claim.weekStartDate)} (${claim.weekStartDate}) – ${formatDayHeader(claim.weekEndDate)} (${claim.weekEndDate})`, pageWidth / 2 + 25, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Contractor:`, margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(claim.contractorName, margin + 30, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Submission Date:`, pageWidth / 2, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(claim.submittedAt ? claim.submittedAt.slice(0, 10) : 'Not submitted yet', pageWidth / 2 + 25, y);
  y += 8;

  // Section 1: Labour Attendance
  const payableAttendance = claim.attendanceLines.filter(l => l.attendanceType !== 'did_not_attend');
  if (payableAttendance.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('LABOUR & ATTENDANCE', margin + 3, y + 5);
    y += 10;

    // Table Header
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Date', margin, y);
    doc.text('Project', margin + 25, y);
    doc.text('Attendance Type', margin + 65, y);
    doc.text('Status', margin + 115, y);
    doc.text('Submitted', margin + 145, y);
    if (isApproved) {
      doc.text('Approved', pageWidth - margin, y, { align: 'right' });
    }
    y += 4;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    for (const l of payableAttendance) {
      doc.text(l.localDate, margin, y);
      doc.text(l.projectReference, margin + 25, y);
      const desc = l.attendanceType === 'full_day' ? 'Full Day' :
                   l.attendanceType === 'half_day' ? 'Half Day' : `${l.actualHours ?? 0} hrs`;
      doc.text(`${desc}${l.isUnplanned ? ' (Unplanned)' : ''}`, margin + 65, y);
      doc.text(l.lineStatus, margin + 115, y);
      doc.text(formatPenceToGBP(l.calculatedAmountPence), margin + 145, y);
      if (isApproved) {
        doc.text(formatPenceToGBP(l.approvedAmountPence ?? l.calculatedAmountPence), pageWidth - margin, y, { align: 'right' });
      }
      y += 5;
      if (y > 270) { doc.addPage(); y = 20; }
    }
    y += 4;
  }

  // Section 2: Expenses
  if (claim.expenseLines.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('REIMBURSABLE EXPENSES', margin + 3, y + 5);
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Date', margin, y);
    doc.text('Project', margin + 25, y);
    doc.text('Category & Description', margin + 65, y);
    doc.text('Receipts', margin + 125, y);
    doc.text('Claimed', pageWidth - margin, y, { align: 'right' });
    y += 4;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    for (const l of claim.expenseLines) {
      doc.text(l.expenseDate, margin, y);
      doc.text(l.projectReference, margin + 25, y);
      doc.text(`${l.category}: ${l.description.slice(0, 35)}`, margin + 65, y);
      doc.text(`${l.receiptFileUrls.length} file(s)`, margin + 125, y);
      doc.text(formatPenceToGBP(l.amountPence), pageWidth - margin, y, { align: 'right' });
      y += 5;
      if (y > 270) { doc.addPage(); y = 20; }
    }
    y += 4;
  }

  // Section 3: Travel
  if (claim.travelLines.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('TRAVEL & MILEAGE', margin + 3, y + 5);
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Date', margin, y);
    doc.text('Description / Method', margin + 25, y);
    doc.text('Project Allocations', margin + 95, y);
    doc.text('Total', pageWidth - margin, y, { align: 'right' });
    y += 4;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    for (const l of claim.travelLines) {
      doc.text(l.travelDate, margin, y);
      const methodLabel = l.travelMethod === 'mileage' ? `Mileage (${l.miles} mi)` :
                          l.travelMethod === 'actual_fuel' ? 'Fuel (Receipt)' : 'Fixed';
      doc.text(`${l.journeyDescription} [${methodLabel}]`, margin + 25, y);
      const allocSummary = l.projectAllocations.map(a => `${a.projectReference}: ${formatPenceToGBP(a.allocatedAmountPence)}`).join(', ');
      doc.text(allocSummary, margin + 95, y);
      doc.text(formatPenceToGBP(l.totalAmountPence), pageWidth - margin, y, { align: 'right' });
      y += 5;
      if (y > 270) { doc.addPage(); y = 20; }
    }
    y += 4;
  }

  // Totals Box
  y = Math.min(y, 250);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Labour: ${formatPenceToGBP(claim.totalLabourPence)}`, margin + 6, y + 7);
  doc.text(`Expenses: ${formatPenceToGBP(claim.totalExpensesPence)}`, margin + 55, y + 7);
  doc.text(`Travel: ${formatPenceToGBP(claim.totalTravelPence)}`, margin + 110, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Submitted:`, margin + 6, y + 18);
  doc.text(formatPenceToGBP(claim.totalClaimPence), margin + 45, y + 18);

  if (isApproved && claim.approvedTotalPence != null) {
    doc.setTextColor(5, 150, 105);
    doc.text(`Approved Total:`, margin + 95, y + 18);
    doc.text(formatPenceToGBP(claim.approvedTotalPence), margin + 130, y + 18);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated by GVD Connect on ${new Date().toLocaleDateString('en-GB')}. Document identity preserved.`, margin, pageHeight - 10);

  doc.save(`${claim.claimReference || 'Claim'}_${docType.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generate a professional, legally compliant A4 Tax Invoice PDF:
 * - Contractor is the SUPPLIER (issuer)
 * - GVD Contracts Ltd is the CUSTOMER
 * - Detailed line items, net, VAT treatment, CIS deduction, and gross total
 */
export function generateInvoicePDF(invoice: InvoiceRecord): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  let y = 18;

  // 1. Header Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', margin, y);

  // Status Badge on top right
  doc.setFontSize(11);
  const isPaid = invoice.paymentStatus === 'Paid';
  const isPart = invoice.paymentStatus === 'Part Paid';
  doc.setTextColor(isPaid ? 16 : isPart ? 190 : 200, isPaid ? 120 : isPart ? 110 : 30, isPaid ? 60 : isPart ? 20 : 30);
  doc.text(`STATUS: ${invoice.paymentStatus.toUpperCase()}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 2. Supplier (Issuer) & Customer (Billing) Blocks
  // SUPPLIER (Left side)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FROM / SUPPLIER (ISSUER):', margin, y);
  y += 5;

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.supplierName || invoice.contractorName, margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (invoice.supplierAddress) {
    const addressLines = doc.splitTextToSize(invoice.supplierAddress, 80);
    doc.text(addressLines, margin, y);
    y += addressLines.length * 4.5;
  }
  if (invoice.supplierVatNumber) {
    doc.text(`VAT No: ${invoice.supplierVatNumber}`, margin, y);
    y += 4.5;
  }

  // CUSTOMER (Right side)
  let custY = 34;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TO / BILL TO:', pageWidth / 2 + 10, custY);
  custY += 5;

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customerName || 'GVD Contracts Ltd', pageWidth / 2 + 10, custY);
  custY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const custAddress = invoice.customerAddress || '107–109 Charterhouse Street\nLondon EC1M 6PT\nUnited Kingdom';
  const custLines = doc.splitTextToSize(custAddress, 80);
  doc.text(custLines, pageWidth / 2 + 10, custY);

  y = Math.max(y, custY + custLines.length * 4.5) + 6;

  // 3. Invoice Metadata Strip
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, pageWidth - margin * 2, 14, 'F');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE NUMBER', margin + 4, y + 5);
  doc.text('INVOICE DATE', margin + 48, y + 5);
  doc.text('SERVICE PERIOD', margin + 92, y + 5);
  doc.text('GVD INTERNAL REF', margin + 145, y + 5);

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.invoiceNumber, margin + 4, y + 10);
  doc.text(invoice.invoiceDate, margin + 48, y + 10);
  doc.text(`${invoice.servicePeriodStart} to ${invoice.servicePeriodEnd}`, margin + 92, y + 10);
  doc.text(invoice.internalReference, margin + 145, y + 10);

  y += 18;

  // 4. Itemised Lines Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Description / Service Item', margin, y);
  doc.text('Project', margin + 85, y);
  doc.text('Qty / Unit', margin + 120, y);
  doc.text('Rate', margin + 145, y);
  doc.text('Net Amount', pageWidth - margin, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  for (const item of invoice.lineItems) {
    const descLines = doc.splitTextToSize(item.description, 80);
    doc.text(descLines, margin, y);
    doc.text(item.projectReference, margin + 85, y);
    doc.text(`${item.quantity ?? 1} ${item.unitDescription || 'ea'}`, margin + 120, y);
    doc.text(item.ratePence ? formatPenceToGBP(item.ratePence) : '—', margin + 145, y);
    doc.text(formatPenceToGBP(item.netAmountPence), pageWidth - margin, y, { align: 'right' });

    y += Math.max(descLines.length * 4.5, 6);
    if (y > 240) { doc.addPage(); y = 20; }
  }

  y += 4;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // 5. Financial Summary / Tax Calculation Box (Right aligned)
  const boxWidth = 90;
  const boxX = pageWidth - margin - boxWidth;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal (Net):', boxX, y);
  doc.text(formatPenceToGBP(invoice.netAmountPence), pageWidth - margin, y, { align: 'right' });
  y += 5;

  // VAT
  const vatLabel = invoice.vatTreatment ? `VAT (${invoice.vatTreatment}):` : 'VAT (0%):';
  doc.text(vatLabel, boxX, y);
  doc.text(formatPenceToGBP(invoice.vatAmountPence), pageWidth - margin, y, { align: 'right' });
  y += 5;

  // CIS Deduction
  if (invoice.cisDeductionPence && invoice.cisDeductionPence > 0) {
    const cisLabel = invoice.cisTreatment || 'CIS Labour Deduction:';
    doc.setTextColor(190, 24, 93); // rose-700
    doc.text(`Less ${cisLabel}:`, boxX, y);
    doc.text(`-${formatPenceToGBP(invoice.cisDeductionPence)}`, pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(boxX, y, pageWidth - margin, y);
  y += 4;

  // Gross Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('GROSS AMOUNT DUE:', boxX, y);
  doc.text(formatPenceToGBP(invoice.grossAmountPence), pageWidth - margin, y, { align: 'right' });
  y += 8;

  // Settlement status summary
  doc.setFillColor(isPaid ? 240 : 254, isPaid ? 253 : 243, isPaid ? 244 : 199);
  doc.roundedRect(boxX, y, boxWidth, 14, 1.5, 1.5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Settled: ${formatPenceToGBP(invoice.totalPaidPence)}`, boxX + 4, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isPaid ? 16 : 180, isPaid ? 120 : 40, isPaid ? 60 : 40);
  doc.text(`Outstanding Balance: ${formatPenceToGBP(invoice.outstandingPence)}`, boxX + 4, y + 10);
  y += 18;

  doc.save(`${invoice.invoiceNumber}_Invoice.pdf`);
}

/**
 * Generate a professional A4 Purchase Order PDF for GVD Connect (Stage 6)
 * Section 9: Prominent PO ref, supplier, project ref/address, approved items, tax basis, revision, terms.
 * Excludes: Customer contract value, project profit, private tax details, site access codes.
 */
export function generatePurchaseOrderPDF(
  po: import('../types').PurchaseOrder,
  options: { download?: boolean } = { download: true }
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  let y = 16;

  const isCancelled = po.status === 'Cancelled';

  // 1. Watermark if Cancelled
  if (isCancelled) {
    doc.setTextColor(254, 202, 202); // red-200
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(54);
    doc.text('CANCELLED', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
  }

  // 2. Header banner & Branding
  doc.setFillColor(15, 23, 42); // slate-900 (GVD navy)
  doc.rect(margin, y, 40, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GVD CONNECT', margin + 4, y + 6.5);

  // Document Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(18);
  doc.text('PURCHASE ORDER', margin + 48, y + 8);

  // Status & Revision Badge
  doc.setFontSize(9);
  doc.setTextColor(isCancelled ? 220 : 16, isCancelled ? 38 : 120, isCancelled ? 38 : 60);
  doc.text(`Status: ${po.status.toUpperCase()} (Rev ${po.revision})`, pageWidth - margin, y + 7, { align: 'right' });
  y += 15;

  // Prominent PO Reference Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 12, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`PO NUMBER: ${po.poReference}`, margin + 5, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Issue Date: ${po.issueDate}  |  Request Ref: ${po.requestReference}`, pageWidth - margin - 5, y + 8, { align: 'right' });
  y += 18;

  // Supplier & Delivery Address Two-Column Block
  const colWidth = (pageWidth - margin * 2 - 8) / 2;

  // Column 1: Supplier
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, colWidth, 38, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, colWidth, 38, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('SUPPLIER / MERCHANT', margin + 4, y + 6);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(po.supplierName, margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  if (po.supplierAddress) {
    const addressLines = doc.splitTextToSize(po.supplierAddress, colWidth - 8);
    doc.text(addressLines, margin + 4, y + 18);
  }
  if (po.supplierPhone) doc.text(`Phone: ${po.supplierPhone}`, margin + 4, y + 31);
  if (po.supplierEmail) doc.text(`Email: ${po.supplierEmail}`, margin + 4, y + 35);

  // Column 2: Project & Delivery
  const col2X = margin + colWidth + 8;
  doc.setFillColor(248, 250, 252);
  doc.rect(col2X, y, colWidth, 38, 'F');
  doc.rect(col2X, y, colWidth, 38, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('PROJECT & DELIVERY DESTINATION', col2X + 4, y + 6);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${po.projectReference} - ${po.projectName}`, col2X + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Fulfillment: ${po.deliveryType === 'collection' ? 'Trade Counter Collection' : 'Site Delivery'}`, col2X + 4, y + 18);

  const deliveryLines = doc.splitTextToSize(`Address: ${po.deliveryAddress}`, colWidth - 8);
  doc.text(deliveryLines, col2X + 4, y + 23);

  doc.text(`Requested By: ${po.requesterName}`, col2X + 4, y + 32);
  doc.text(`Authorized By: ${po.approverName}`, col2X + 4, y + 36);

  y += 44;

  // Approved Scope & Items Table
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM / SCOPE DESCRIPTION', margin + 3, y + 5);
  doc.text('QTY', margin + 115, y + 5);
  doc.text('UNIT PRICE', margin + 135, y + 5);
  doc.text('TOTAL', pageWidth - margin - 3, y + 5, { align: 'right' });
  y += 7;

  // Item rows or General Scope
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  if (po.items && po.items.length > 0) {
    po.items.forEach((item, index) => {
      const rowBg = index % 2 === 0 ? 255 : 248;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(margin, y, pageWidth - margin * 2, 6.5, 'F');

      doc.text(item.description, margin + 3, y + 4.5);
      doc.text(`${item.quantity} ${item.unitDescription || ''}`.trim(), margin + 115, y + 4.5);
      doc.text(formatPenceToGBP(item.unitPricePence), margin + 135, y + 4.5);
      doc.text(formatPenceToGBP(item.totalPricePence), pageWidth - margin - 3, y + 4.5, { align: 'right' });
      y += 6.5;
    });
  } else {
    // Total-only request scope
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.text(po.approvedScope || 'Approved materials purchase per quotation', margin + 3, y + 5);
    doc.text('1 lot', margin + 115, y + 5);
    doc.text(formatPenceToGBP(po.authorisedNetPence), margin + 135, y + 5);
    doc.text(formatPenceToGBP(po.authorisedNetPence), pageWidth - margin - 3, y + 5, { align: 'right' });
    y += 8;
  }

  y += 4;

  // Special instructions
  if (po.specialInstructions) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Special Instructions: ${po.specialInstructions}`, margin, y);
    y += 6;
  }

  // Authorised Value Breakdown Summary
  const boxWidth = 85;
  const boxX = pageWidth - margin - boxWidth;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, y, boxWidth, 24, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxX, y, boxWidth, 24, 2, 2, 'S');

  let boxY = y + 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Authorised Net Amount:', boxX + 4, boxY);
  doc.text(formatPenceToGBP(po.authorisedNetPence), pageWidth - margin - 4, boxY, { align: 'right' });
  boxY += 5;

  doc.text('Authorised VAT (20%):', boxX + 4, boxY);
  doc.text(formatPenceToGBP(po.authorisedVatPence), pageWidth - margin - 4, boxY, { align: 'right' });
  boxY += 6;

  doc.setDrawColor(203, 213, 225);
  doc.line(boxX + 4, boxY - 1, pageWidth - margin - 4, boxY - 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('MAX AUTHORISED GROSS:', boxX + 4, boxY + 3);
  doc.text(formatPenceToGBP(po.authorisedGrossPence), pageWidth - margin - 4, boxY + 3, { align: 'right' });

  y += 30;

  // Standard Purchasing Terms & Conditions (Section 9)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('GVD CONTRACTS LTD — STANDARD PURCHASING TERMS', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const terms = [
    '1. This Purchase Order authorizes the expenditure up to the Maximum Authorized Gross amount shown above.',
    '2. The PO Reference number must be quoted prominently on all delivery notes, tickets and subsequent supplier invoices.',
    '3. Materials must strictly match specified British & European quality standards and project requirements.',
    '4. Invoices must be submitted electronically to accounts@gvdcontracts.co.uk matching this PO reference.'
  ];
  let termY = y + 9;
  terms.forEach(t => {
    doc.text(t, margin + 4, termY);
    termY += 3.5;
  });

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('GVD Connect Official Purchasing Record. Generated on ' + new Date().toISOString().slice(0, 10), margin, pageHeight - 10);

  if (options.download) {
    doc.save(`${po.poReference}_Order.pdf`);
  }

  return doc;
}

