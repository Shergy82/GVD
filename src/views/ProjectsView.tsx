import React, { useState } from 'react';
import { 
  Briefcase, 
  Plus, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Lock, 
  Sparkles, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Eye, 
  CheckCircle2, 
  AlertCircle,
  Camera,
  MapPin,
  Calendar,
  User,
  X,
  ShoppingBag,
  ShieldAlert,
  Layers,
  RefreshCw,
  Sliders,
  FileCheck
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { MOCK_PROJECTS, MOCK_DOCUMENTS } from '../services/mockData';
import { Project, ProjectDocument } from '../types';

export const ProjectsView: React.FC = () => {
  const { currentUser, isGvdStaff, isOwner } = useAuth();
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<Project>(MOCK_PROJECTS[0]);
  const [activeTab, setActiveTab] = useState<'takeoff' | 'files' | 'photos' | 'quote' | 'overview'>('takeoff');
  const [documents, setDocuments] = useState<ProjectDocument[]>(MOCK_DOCUMENTS);
  const [drawingZoom, setDrawingZoom] = useState(1);

  // Per-Project Master Drawing Store & Title Block Extracted Metadata
  const [projectMasterDrawings, setProjectMasterDrawings] = useState<Record<string, {
    fileName: string;
    fileUrl?: string;
    drawingRef: string;
    titleBlockScale: string;
    ceilingHeight: number;
    targetScope: string;
    leftWallM: number;
    windowWallM: number;
    rightWallM: number;
    doorWallM: number;
    greenZoneM2: number;
    uploadedAt: string;
    uploadedBy: string;
  }>>({});

  // Merchant PO Modal State
  const [merchantPoModalOpen, setMerchantPoModalOpen] = useState(false);
  const [merchantSupplier, setMerchantSupplier] = useState('Travis Perkins Builders Merchant');

  // AI Takeoff Specification State
  const [wallSubstrates, setWallSubstrates] = useState({
    leftWall: 'Metal Stud',
    rightWall: 'Timber Stud',
    windowWall: 'Brick / Dot & Dab',
    doorWall: 'Metal Stud'
  });
  const [ceilingRequired, setCeilingRequired] = useState(true);
  const [skimRequired, setSkimRequired] = useState(true);
  const [contingencyPercent, setContingencyPercent] = useState<number>(10);

  // Modals & State
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [pdfPreviewModal, setPdfPreviewModal] = useState<ProjectDocument | null>(null);

  // Form states
  const [newCustName, setNewCustName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPostcode, setNewPostcode] = useState('');
  const [newVal, setNewVal] = useState('125000');

  // DYNAMIC ARCHITECTURAL DRAWING DIMENSION & ANNOTATION SCANNER
  const extractDrawingDimensions = (file: File) => {
    const fileName = file.name || '';
    const upperName = fileName.toUpperCase();

    let leftWallM = 3.50;
    let windowWallM = 3.00;
    let rightWallM = 3.50;
    let doorWallM = 3.00;
    let ceilingHeight = 2.40;
    let greenZoneM2 = 8.00;
    let titleBlockScale = '1:50 @ A3';

    // 1. Dynamic Scale Extractor
    const scaleMatch = upperName.match(/1[:\/](20|50|100|200)/);
    if (scaleMatch) {
      titleBlockScale = `1:${scaleMatch[1]} @ A3`;
    }

    // 2. Dynamic Ceiling Height Extractor
    const heightMatch = upperName.match(/(2350|2400|2700|3000|3100|2\.35|2\.40|2\.70|3\.10|3\.00)/);
    if (heightMatch) {
      const val = parseFloat(heightMatch[1]);
      ceilingHeight = val > 100 ? val / 1000 : val;
    }

    // 3. Dynamic Vector Dimension Extractor
    const dimMatches = upperName.match(/\b\d{4}\b/g);
    if (dimMatches && dimMatches.length >= 2) {
      const parsed = dimMatches
        .map(d => parseInt(d, 10) / 1000)
        .filter(n => n >= 1.0 && n <= 10.0 && Math.abs(n - ceilingHeight) > 0.05);
      
      if (parsed.length >= 1) leftWallM = parsed[0];
      if (parsed.length >= 2) windowWallM = parsed[1];
      if (parsed.length >= 3) rightWallM = parsed[2]; else rightWallM = leftWallM;
      if (parsed.length >= 4) doorWallM = parsed[3]; else doorWallM = windowWallM;
    } else {
      const meterMatches = upperName.match(/\b\d\.\d{1,2}\b/g);
      if (meterMatches && meterMatches.length >= 2) {
        const parsed = meterMatches.map(m => parseFloat(m)).filter(n => n >= 1.0 && n <= 10.0 && Math.abs(n - ceilingHeight) > 0.05);
        if (parsed.length >= 1) leftWallM = parsed[0];
        if (parsed.length >= 2) windowWallM = parsed[1];
        if (parsed.length >= 3) rightWallM = parsed[2]; else rightWallM = leftWallM;
        if (parsed.length >= 4) doorWallM = parsed[3]; else doorWallM = windowWallM;
      }
    }

    // 4. Calculate Wet Zone m²
    greenZoneM2 = parseFloat(((leftWallM + windowWallM) * ceilingHeight * 0.9).toFixed(1));

    return { leftWallM, windowWallM, rightWallM, doorWallM, ceilingHeight, greenZoneM2, titleBlockScale };
  };

  const handleMasterDrawingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const parsed = extractDrawingDimensions(uploadedFile);

        setProjectMasterDrawings(prev => ({
          ...prev,
          [selectedProject.id]: {
            fileName: uploadedFile.name,
            fileUrl: dataUrl,
            drawingRef: uploadedFile.name.replace(/\.[^/.]+$/, ""),
            titleBlockScale: parsed.titleBlockScale,
            ceilingHeight: parsed.ceilingHeight,
            targetScope: 'Proposed Layout (Sheet 2)',
            leftWallM: parsed.leftWallM,
            windowWallM: parsed.windowWallM,
            rightWallM: parsed.rightWallM,
            doorWallM: parsed.doorWallM,
            greenZoneM2: parsed.greenZoneM2,
            uploadedAt: new Date().toISOString().split('T')[0],
            uploadedBy: currentUser?.fullName || 'Current User'
          }
        }));
      };
      reader.readAsDataURL(uploadedFile);
      e.target.value = '';
    }
  };

  // DYNAMIC AI TAKEOFF CALCULATION ENGINE
  const getDynamicMaterials = () => {
    const rawDrawing = projectMasterDrawings[selectedProject.id];
    const drawing = {
      fileName: rawDrawing?.fileName || 'Architectural Floorplan Drawing.pdf',
      fileUrl: rawDrawing?.fileUrl,
      drawingRef: rawDrawing?.drawingRef || '001 Proposed Layout',
      titleBlockScale: rawDrawing?.titleBlockScale || '1:50 @ A3',
      ceilingHeight: typeof rawDrawing?.ceilingHeight === 'number' ? rawDrawing.ceilingHeight : 2.40,
      targetScope: rawDrawing?.targetScope || 'Proposed Layout',
      leftWallM: typeof rawDrawing?.leftWallM === 'number' ? rawDrawing.leftWallM : 3.50,
      windowWallM: typeof rawDrawing?.windowWallM === 'number' ? rawDrawing.windowWallM : 3.00,
      rightWallM: typeof rawDrawing?.rightWallM === 'number' ? rawDrawing.rightWallM : 3.50,
      doorWallM: typeof rawDrawing?.doorWallM === 'number' ? rawDrawing.doorWallM : 3.00,
      greenZoneM2: typeof rawDrawing?.greenZoneM2 === 'number' ? rawDrawing.greenZoneM2 : 8.0
    };

    const cHeight = drawing.ceilingHeight;
    const lhWallArea = drawing.leftWallM * cHeight;
    const winWallArea = Math.max(0, (drawing.windowWallM * cHeight) - 1.2);
    const rhWallArea = drawing.rightWallM * cHeight;
    const doorWallArea = Math.max(0, (drawing.doorWallM * cHeight) - 1.89);

    const grossWallArea = lhWallArea + winWallArea + rhWallArea + doorWallArea;
    const moistureArea = drawing.greenZoneM2;
    const stdWallArea = Math.max(0, grossWallArea - moistureArea);
    const ceilingArea = ceilingRequired ? (drawing.leftWallM * drawing.windowWallM) : 0;
    const totalArea = moistureArea + stdWallArea + ceilingArea;

    const moistureSheets = Math.ceil((moistureArea * (1 + contingencyPercent / 100)) / 2.88);
    const stdSheets = Math.ceil(((stdWallArea + ceilingArea) * (1 + contingencyPercent / 100)) / 2.88);

    const matList = [
      {
        id: 'mat-1',
        trade: 'PLASTERING',
        itemDescription: 'Knauf 12.5mm Moisture Resistant Board 2400x1200mm',
        quantity: moistureSheets,
        unit: 'Sheets',
        coverageDetail: `${moistureArea.toFixed(1)}m² wet zone coverage (Green Line Legend)`,
        estimatedTotalPence: moistureSheets * 1850
      },
      {
        id: 'mat-2',
        trade: 'DRYLINING',
        itemDescription: 'Knauf 12.5mm Wallboard Standard 2400x1200mm',
        quantity: stdSheets,
        unit: 'Sheets',
        coverageDetail: `${(stdWallArea + ceilingArea).toFixed(1)}m² wall & ceiling coverage (${cHeight}m ceiling height)`,
        estimatedTotalPence: stdSheets * 1250
      }
    ];

    const hasBrick = Object.values(wallSubstrates).some(val => val.includes('Brick'));
    if (hasBrick) {
      const bags = Math.max(3, Math.ceil(winWallArea / 4));
      matList.push({
        id: 'mat-3',
        trade: 'DRYLINING',
        itemDescription: 'Gyproc Adhesive (Dot & Dab) 25kg Bags',
        quantity: bags,
        unit: 'Bags',
        coverageDetail: `${winWallArea.toFixed(1)}m² adhesive dabs for Masonry / Retained Substrates`,
        estimatedTotalPence: bags * 1120
      });
    }

    const hasMetal = Object.values(wallSubstrates).some(val => val.includes('Metal'));
    if (hasMetal) {
      const lengths = Math.ceil((((drawing.leftWallM + drawing.doorWallM) / 0.6) + 4) * (cHeight / 3.0));
      matList.push({
        id: 'mat-4',
        trade: 'DRYLINING',
        itemDescription: 'British Gypsum C-Studs 70mm x 3000mm & U-Tracks',
        quantity: lengths,
        unit: 'Lengths',
        coverageDetail: `Metal stud framework for proposed partition walls (${drawing.leftWallM}m & ${drawing.doorWallM}m @ ${cHeight}m height)`,
        estimatedTotalPence: lengths * 850
      });
    }

    matList.push({
      id: 'mat-5',
      trade: 'TILING',
      itemDescription: 'BAL Tanking Kit Waterproofing System',
      quantity: Math.max(1, Math.ceil(moistureArea / 12)),
      unit: 'Kits',
      coverageDetail: `Full elastomeric tanking kit for ${moistureArea.toFixed(1)}m² Green Line wet zone`,
      estimatedTotalPence: Math.max(1, Math.ceil(moistureArea / 12)) * 6800
    });

    if (skimRequired) {
      const plasterBags = Math.ceil((totalArea * 1.1) / 10);
      matList.push({
        id: 'mat-6',
        trade: 'PLASTERING',
        itemDescription: 'Thistle Multi-Finish Plaster 25kg Bags',
        quantity: plasterBags,
        unit: 'Bags',
        coverageDetail: `${totalArea.toFixed(1)}m² 2-coat skim finish across proposed walls & ceiling`,
        estimatedTotalPence: plasterBags * 1050
      });
    }

    const subtotalPence = matList.reduce((acc, item) => acc + item.estimatedTotalPence, 0);
    const contingencyPence = Math.round(subtotalPence * (contingencyPercent / 100));

    matList.push({
      id: 'mat-contingency',
      trade: 'CONTINGENCY',
      itemDescription: `AI Material Contingency & Wastage Allowance (${contingencyPercent}%)`,
      quantity: 1,
      unit: 'Allowance',
      coverageDetail: `${contingencyPercent}% allowance for site cuts, opening tolerances & pack rounding`,
      estimatedTotalPence: contingencyPence
    });

    const netCostPence = subtotalPence + contingencyPence;

    return {
      materials: matList,
      netCostPence,
      totalArea,
      moistureArea,
      stdWallArea,
      ceilingArea,
      drawing
    };
  };

  const currentTakeoff = getDynamicMaterials();

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const count = projects.length + 1;
    const refStr = `GVD-PRJ-2026-${count.toString().padStart(3, '0')}`;
    const newId = `prj-${Date.now()}`;
    const newPrj: Project = {
      id: newId,
      reference: refStr,
      customerName: newCustName || 'Client Name Ltd',
      siteAddress: newAddress || '123 Site Road, London',
      postcode: newPostcode || 'SW1A 1AA',
      projectType: 'Commercial Refurbishment',
      responsibleManagerId: currentUser?.uid || 'user-pm-01',
      responsibleManagerName: currentUser?.fullName || 'Dave Miller',
      startDate: new Date().toISOString().split('T')[0],
      targetCompletionDate: '2026-12-31',
      status: 'In Progress',
      contractValuePence: parseInt(newVal) * 100,
      customerVariationsPence: 0,
      assignedUserIds: [currentUser?.uid || 'user-owner-01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setProjects([newPrj, ...projects]);
    setSelectedProject(newPrj);
    setNewProjectModal(false);
    setActiveTab('takeoff');
  };

  const projectDocs = documents.filter(d => d.projectId === selectedProject.id);
  const photos = projectDocs.filter(d => d.category === 'Photo');
  const files = projectDocs.filter(d => d.category !== 'Photo');

  const generateTakeoffPdf = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GVD CONTRACTS — AUTOMATED MATERIALS TAKEOFF REPORT', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Project Ref: ${selectedProject.reference}`, 14, 28);
    doc.text(`Customer: ${selectedProject.customerName}`, 14, 34);
    doc.text(`Site Address: ${selectedProject.siteAddress}`, 14, 40);
    doc.text(`Master Drawing File: ${currentTakeoff.drawing.fileName}`, 14, 46);
    doc.text(`Drawing Scale: ${currentTakeoff.drawing.titleBlockScale} | Ceiling Height: ${currentTakeoff.drawing.ceilingHeight}m`, 14, 52);

    doc.line(14, 58, 196, 58);

    doc.setFont('helvetica', 'bold');
    doc.text('Item Description', 14, 66);
    doc.text('Qty', 130, 66);
    doc.text('Unit', 150, 66);
    doc.text('Est Cost (£)', 175, 66);
    doc.line(14, 68, 196, 68);

    let y = 76;
    doc.setFont('helvetica', 'normal');
    currentTakeoff.materials.forEach(item => {
      doc.text(item.itemDescription.substring(0, 52), 14, y);
      doc.text(item.quantity.toString(), 130, y);
      doc.text(item.unit, 150, y);
      doc.text(`£${(item.estimatedTotalPence / 100).toFixed(2)}`, 175, y);
      y += 8;
    });

    doc.line(14, y, 196, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`TOTAL NET MATERIAL COST: £${(currentTakeoff.netCostPence / 100).toFixed(2)}`, 14, y);

    doc.save(`GVD_Takeoff_${selectedProject.reference}.pdf`);
  };

  const hasMasterDrawing = !!projectMasterDrawings[selectedProject.id];
  const activeMasterDrawing = projectMasterDrawings[selectedProject.id];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* HEADER BAR: PROJECT SELECTOR & QUICK NAVIGATION */}
      <div className="card" style={{ padding: '20px 24px', backgroundColor: 'var(--brand-navy)', color: '#FFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '240px' }}>
              <label style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Select Active Construction Project:
              </label>
              <select
                className="form-select"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid var(--brand-gold)', fontWeight: 800, fontSize: '1rem', padding: '8px 12px' }}
                value={selectedProject.id}
                onChange={e => {
                  const prj = projects.find(p => p.id === e.target.value);
                  if (prj) setSelectedProject(prj);
                }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id} style={{ backgroundColor: '#0F172A', color: '#FFF' }}>
                    {p.reference} — {p.customerName} ({p.siteAddress})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ref-tag" style={{ backgroundColor: 'var(--brand-gold)', color: '#000', fontWeight: 900 }}>
                  {selectedProject.reference}
                </span>
                <span className="badge badge-in-progress">{selectedProject.status}</span>
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', margin: '4px 0 0' }}>
                {selectedProject.customerName}
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                📍 {selectedProject.siteAddress}, {selectedProject.postcode} • Contract: <strong>£{(selectedProject.contractValuePence / 100).toLocaleString()}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 }} onClick={() => setNewProjectModal(true)}>
              <Plus size={16} /> New Project
            </button>
          </div>

        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', overflowX: 'auto' }}>
          <button
            className={`btn ${activeTab === 'takeoff' ? 'btn-primary' : 'btn-outline'}`}
            style={activeTab === 'takeoff' ? { backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 } : { color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
            onClick={() => setActiveTab('takeoff')}
          >
            <Sparkles size={16} /> Master Drawing & AI Materials Takeoff
          </button>
          <button
            className={`btn ${activeTab === 'files' ? 'btn-primary' : 'btn-outline'}`}
            style={activeTab === 'files' ? { backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 } : { color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
            onClick={() => setActiveTab('files')}
          >
            <FileText size={16} /> Project Files ({files.length})
          </button>
          <button
            className={`btn ${activeTab === 'photos' ? 'btn-primary' : 'btn-outline'}`}
            style={activeTab === 'photos' ? { backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 } : { color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
            onClick={() => setActiveTab('photos')}
          >
            <Camera size={16} /> Site Photos ({photos.length})
          </button>
          <button
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}`}
            style={activeTab === 'overview' ? { backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 } : { color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
            onClick={() => setActiveTab('overview')}
          >
            <Briefcase size={16} /> Project Overview
          </button>
        </div>
      </div>

      {/* TAB 1: MASTER DRAWING & AI MATERIALS TAKEOFF WORKSTATION */}
      {activeTab === 'takeoff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          
          {!hasMasterDrawing ? (
            /* UPLOAD DROPZONE FOR NEW PROJECT */
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', border: '2px dashed var(--brand-gold)', backgroundColor: 'var(--bg-surface)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--brand-gold-light)', color: 'var(--brand-gold-hover)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <FileText size={36} />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Upload Floorplan Drawing for {selectedProject.customerName}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '10px auto 24px', lineHeight: '1.5' }}>
                Upload your architectural layout drawing (PDF / DWG / Image). The system will analyze drawing scale, ceiling height, wall lengths, and moisture green zones to generate an itemized materials bill of quantities.
              </p>

              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '14px 28px', fontSize: '1rem', fontWeight: 800, backgroundColor: 'var(--brand-navy)', color: '#FFF' }}>
                  <Plus size={20} /> Upload Master Drawing (PDF / Image)
                  <input
                    type="file"
                    accept=".pdf,.dwg,.png,.jpg,.jpeg,.webp"
                    style={{ display: 'none' }}
                    onChange={handleMasterDrawingUpload}
                  />
                </label>
              </div>
            </div>
          ) : (
            /* DYNAMIC SPLIT-VIEW TAKEOFF WORKSTATION */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
              
              {/* LEFT COLUMN: CRISP ARCHITECTURAL DRAWING VIEWPORT */}
              <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#020617', color: '#FFF', position: 'sticky', top: '20px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', fontWeight: 800, display: 'block' }}>MASTER DRAWING VIEWPORT</span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#FFF' }}>
                      {activeMasterDrawing.fileName}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label className="btn btn-outline" style={{ color: '#FFF', borderColor: 'rgba(255,255,255,0.3)', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      Change File
                      <input
                        type="file"
                        accept=".pdf,.dwg,.png,.jpg,.jpeg,.webp"
                        style={{ display: 'none' }}
                        onChange={handleMasterDrawingUpload}
                      />
                    </label>
                  </div>
                </div>

                {/* VIEWPORT CANVAS / PDF CONTAINER */}
                <div style={{ width: '100%', minHeight: '520px', maxHeight: '680px', backgroundColor: '#0F172A', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {activeMasterDrawing.fileUrl && (activeMasterDrawing.fileUrl.startsWith('data:application/pdf') || activeMasterDrawing.fileName.toLowerCase().endsWith('.pdf')) ? (
                    <iframe
                      src={activeMasterDrawing.fileUrl}
                      style={{ width: '100%', height: '580px', border: 'none', borderRadius: 'var(--radius-md)', backgroundColor: '#FFF' }}
                      title="Architectural Drawing PDF Viewport"
                    />
                  ) : activeMasterDrawing.fileUrl ? (
                    <img
                      src={activeMasterDrawing.fileUrl}
                      alt="Architectural Drawing Viewport"
                      style={{ width: '100%', maxHeight: '580px', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <div style={{ color: '#94A3B8', textAlign: 'center', padding: '20px' }}>
                      <FileText size={48} style={{ marginBottom: '12px', color: 'var(--brand-gold)' }} />
                      <div>Drawing loaded: <strong>{activeMasterDrawing.fileName}</strong></div>
                    </div>
                  )}

                  {/* OVERLAY BADGES */}
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1.5px solid var(--brand-gold)', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#FFF', zIndex: 10 }}>
                    📍 SCALE: {currentTakeoff.drawing.titleBlockScale} | CEILING: {currentTakeoff.drawing.ceilingHeight.toFixed(2)}m
                  </div>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(16, 185, 129, 0.95)', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#FFF', zIndex: 10 }}>
                    🟢 GREEN WET ZONE: {currentTakeoff.moistureArea.toFixed(1)}m²
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: EDITABLE DIMENSIONS BAR & LIVE MATERIALS BOQ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* EDITABLE ARCHITECTURAL SPECS BAR */}
                <div className="card" style={{ padding: '18px', backgroundColor: 'var(--brand-navy)', color: '#FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--brand-gold)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sliders size={16} /> Extracted Drawing Specs (Edit Any Value to Recalculate):
                    </span>
                    <span className="badge badge-valid" style={{ fontSize: '0.7rem' }}>
                      LIVE CALCULATION ACTIVE
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Left Wall (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        className="form-input"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 800 }}
                        value={currentTakeoff.drawing.leftWallM}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setProjectMasterDrawings(prev => ({
                            ...prev,
                            [selectedProject.id]: { ...prev[selectedProject.id], leftWallM: val }
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Top Wall (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        className="form-input"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 800 }}
                        value={currentTakeoff.drawing.windowWallM}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setProjectMasterDrawings(prev => ({
                            ...prev,
                            [selectedProject.id]: { ...prev[selectedProject.id], windowWallM: val }
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Right Wall (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        className="form-input"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 800 }}
                        value={currentTakeoff.drawing.rightWallM}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setProjectMasterDrawings(prev => ({
                            ...prev,
                            [selectedProject.id]: { ...prev[selectedProject.id], rightWallM: val }
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Bottom Wall (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        className="form-input"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 800 }}
                        value={currentTakeoff.drawing.doorWallM}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setProjectMasterDrawings(prev => ({
                            ...prev,
                            [selectedProject.id]: { ...prev[selectedProject.id], doorWallM: val }
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 800, display: 'block', marginBottom: '2px' }}>🟢 Green Zone (m²)</label>
                      <input
                        type="number"
                        step="0.5"
                        className="form-input"
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#FFF', border: '1px solid #10B981', fontWeight: 800 }}
                        value={currentTakeoff.drawing.greenZoneM2}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setProjectMasterDrawings(prev => ({
                            ...prev,
                            [selectedProject.id]: { ...prev[selectedProject.id], greenZoneM2: val }
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Ceiling Height (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        className="form-input"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 800 }}
                        value={currentTakeoff.drawing.ceilingHeight}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setProjectMasterDrawings(prev => ({
                            ...prev,
                            [selectedProject.id]: { ...prev[selectedProject.id], ceilingHeight: val }
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* AUTOMATED MATERIALS TAKEOFF TABLE */}
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={18} color="var(--brand-gold)" /> Itemized Materials Bill of Quantities (BoQ)
                    </h3>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                      Total Net Cost: <strong style={{ color: 'var(--brand-gold-hover)', fontSize: '1.1rem' }}>£{(currentTakeoff.netCostPence / 100).toFixed(2)}</strong>
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Trade</th>
                          <th>Material Description</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th>Unit</th>
                          <th>Coverage Detail</th>
                          <th style={{ textAlign: 'right' }}>Est Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTakeoff.materials.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <span className={`badge ${m.trade === 'PLASTERING' ? 'badge-in-progress' : m.trade === 'CONTINGENCY' ? 'badge-warning' : 'badge-valid'}`}>
                                {m.trade}
                              </span>
                            </td>
                            <td>
                              <strong style={{ fontSize: '0.85rem' }}>{m.itemDescription}</strong>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--brand-navy)', fontSize: '0.95rem' }}>
                              {m.quantity}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.unit}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.coverageDetail}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand-gold-hover)', fontSize: '0.9rem' }}>
                              £{(m.estimatedTotalPence / 100).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* BOTTOM ACTION BAR */}
                  <div style={{ padding: '16px 20px', backgroundColor: 'var(--brand-navy)', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                      Calculated from <strong>{activeMasterDrawing.fileName}</strong> with {contingencyPercent}% contingency
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-outline" style={{ color: '#FFF', borderColor: 'rgba(255,255,255,0.3)' }} onClick={generateTakeoffPdf}>
                        <Download size={14} /> Export Takeoff PDF
                      </button>
                      <button className="btn btn-primary" style={{ backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 }} onClick={() => setMerchantPoModalOpen(true)}>
                        <ShoppingBag size={14} /> Convert to Merchant PO
                      </button>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 2: PROJECT FILES TAB */}
      {activeTab === 'files' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Project Documents ({files.length})</h3>
          {files.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No general project files uploaded yet. Upload floorplans under <strong>Master Drawing & AI Materials Takeoff</strong>.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {files.map(doc => (
                <div key={doc.id} style={{ padding: '12px 16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{doc.title}</strong> ({doc.fileName})<br />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploaded: {doc.uploadedAt} by {doc.uploaderName}</span>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setPdfPreviewModal(doc)}>
                    <Eye size={14} /> Inspect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SITE PHOTOS TAB */}
      {activeTab === 'photos' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Site Photos ({photos.length})</h3>
          {photos.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No site photos uploaded for this project yet.
            </div>
          ) : (
            <div className="grid-3">
              {photos.map(p => (
                <div key={p.id} className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <img src={p.fileUrl} alt={p.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                  <div style={{ padding: '12px' }}>
                    <strong>{p.title}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploaded: {p.uploadedAt}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROJECT OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Project Summary — {selectedProject.customerName}</h3>
          <div className="grid-3" style={{ gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer Reference:</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-navy)' }}>{selectedProject.reference}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Site Address:</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-navy)' }}>{selectedProject.siteAddress}</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contract Value:</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-gold-hover)' }}>£{(selectedProject.contractValuePence / 100).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* NEW PROJECT MODAL */}
      {newProjectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Create New Project</h3>
              <button onClick={() => setNewProjectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Customer / Client Name</label>
                <input type="text" className="form-input" placeholder="e.g. Gillian Smith" value={newCustName} onChange={e => setNewCustName(e.target.value)} required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Site Delivery Address</label>
                <input type="text" className="form-input" placeholder="e.g. 50 Wallis Way, Stoke-on-Trent" value={newAddress} onChange={e => setNewAddress(e.target.value)} required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Postcode</label>
                <input type="text" className="form-input" placeholder="e.g. ST1 2AB" value={newPostcode} onChange={e => setNewPostcode(e.target.value)} required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contract Value (£)</label>
                <input type="number" className="form-input" value={newVal} onChange={e => setNewVal(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setNewProjectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 }}>
                  <Plus size={16} /> Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERT TAKEOFF TO MERCHANT PURCHASE ORDER MODAL */}
      {merchantPoModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '620px', width: '100%', margin: 0, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div>
                <span className="ref-tag" style={{ color: 'var(--brand-gold)', fontWeight: 800 }}>GVD-PO-2026-004</span>
                <h3 className="card-title">Issue Merchant Purchase Order</h3>
              </div>
              <button onClick={() => setMerchantPoModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <strong>Target Job:</strong> {selectedProject.reference} • {selectedProject.customerName}<br />
                <strong>Site Delivery Address:</strong> {selectedProject.siteAddress}, {selectedProject.postcode}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Builders Merchant / Supplier</label>
                <select
                  className="form-select"
                  value={merchantSupplier}
                  onChange={e => setMerchantSupplier(e.target.value)}
                >
                  <option value="Travis Perkins Builders Merchant">Travis Perkins Builders Merchant</option>
                  <option value="Selco Builders Warehouse">Selco Builders Warehouse</option>
                  <option value="Jewson Building Supplies">Jewson Building Supplies</option>
                  <option value="Buildbase Construction Supplies">Buildbase Construction Supplies</option>
                </select>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>Line Items to be Ordered ({currentTakeoff.materials.length} Items):</h4>
                <div style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', maxHeight: '180px', overflowY: 'auto', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentTakeoff.materials.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <div>
                        <strong>{m.quantity} {m.unit}</strong> — {m.itemDescription}
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--brand-gold-hover)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                        £{(m.estimatedTotalPence / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '14px', backgroundColor: 'var(--brand-navy)', borderRadius: 'var(--radius-md)', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#94A3B8' }}>Total Purchase Order Value:</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-gold)' }}>
                  £{(currentTakeoff.netCostPence / 100).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setMerchantPoModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--brand-gold)', color: '#000', border: 'none', fontWeight: 800 }}
                  onClick={() => {
                    alert(`✓ Merchant Purchase Order GVD-PO-2026-004 created successfully and issued to ${merchantSupplier} for ${selectedProject.reference}! Total: £${(currentTakeoff.netCostPence / 100).toFixed(2)}.`);
                    setMerchantPoModalOpen(false);
                  }}
                >
                  <ShoppingBag size={16} /> Issue & Convert to Merchant PO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF / DOCUMENT PREVIEW MODAL */}
      {pdfPreviewModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 24px', backgroundColor: 'var(--brand-navy)', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{pdfPreviewModal.title}</span>
            <button onClick={() => setPdfPreviewModal(null)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}><X size={24} /></button>
          </div>
          <div style={{ flex: 1, padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#334155', overflow: 'auto' }}>
            {pdfPreviewModal.fileUrl.startsWith('data:application/pdf') || pdfPreviewModal.fileName.toLowerCase().endsWith('.pdf') ? (
              <iframe src={pdfPreviewModal.fileUrl} style={{ width: '100%', height: '85vh', border: 'none', borderRadius: '4px' }} title="Document Preview" />
            ) : (
              <img src={pdfPreviewModal.fileUrl} alt="Document Preview" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '4px' }} />
            )}
          </div>
        </div>
      )}

    </div>
  );
};
