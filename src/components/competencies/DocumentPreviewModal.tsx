import React, { useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, FileText, Image as ImageIcon } from 'lucide-react';
import type { CompetencyDocument } from '../../types';

interface DocumentPreviewModalProps {
  doc: CompetencyDocument | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ doc, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  if (!doc) return null;

  const fileUrl = doc.documentUrl || '';
  const fileName = doc.fileName || `${doc.requirementName}.pdf`;
  const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || doc.mimeType?.startsWith('image/');
  const isPdf = fileUrl.match(/\.pdf/i) || doc.mimeType === 'application/pdf';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 200,
      padding: '16px'
    }}>
      {/* Modal Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--brand-navy)',
        color: '#FFFFFF',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isImage ? <ImageIcon size={20} style={{ color: 'var(--brand-gold)' }} /> : <FileText size={20} style={{ color: 'var(--brand-gold)' }} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#FFF' }}>
              {doc.requirementName} — {doc.holderName}
            </div>
            <div style={{ fontSize: '0.775rem', color: '#94A3B8' }}>
              {doc.issuerProvider ? `Issuer: ${doc.issuerProvider} | ` : ''} Ref: {doc.referenceNumber || 'N/A'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isImage && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setZoomLevel(prev => Math.max(50, prev - 25))}
                style={{ color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{zoomLevel}%</span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setZoomLevel(prev => Math.min(200, prev + 25))}
                style={{ color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
            </>
          )}

          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={fileName}
              className="btn btn-primary btn-sm"
            >
              <Download size={16} />
              <span className="desktop-only">Download</span>
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFF',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div style={{
        flex: 1,
        backgroundColor: '#000000',
        borderRadius: '0 0 var(--radius-md) var(--radius-md)',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative'
      }}>
        {!fileUrl ? (
          <div style={{ color: '#94A3B8', textAlign: 'center', padding: '40px' }}>
            <FileText size={48} style={{ marginBottom: '12px' }} />
            <div>No document file attached to this record.</div>
          </div>
        ) : isImage ? (
          <div style={{ overflow: 'auto', maxWidth: '100%', maxHeight: '100%', textAlign: 'center' }}>
            <img
              src={fileUrl}
              alt={doc.requirementName}
              style={{
                maxWidth: `${zoomLevel}%`,
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                transition: 'transform 0.15s ease'
              }}
            />
          </div>
        ) : isPdf ? (
          <iframe
            src={fileUrl}
            title={doc.requirementName}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '500px',
              border: 'none',
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-sm)'
            }}
          />
        ) : (
          <div style={{ color: '#FFF', textAlign: 'center', padding: '30px' }}>
            <p style={{ marginBottom: '16px' }}>Preview unavailable for this file format.</p>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <ExternalLink size={16} /> Open File in Browser
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
