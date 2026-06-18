import { useState, useRef } from 'react';
import { Upload, FileText, Download, Trash2, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import type { EmployeeDocument } from '../App';

interface Props {
  documents: EmployeeDocument[];
  onDocumentsChange: (documents: EmployeeDocument[]) => void;
  isMobile?: boolean;
}

const DOCUMENT_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'license', label: 'Driving License' },
  { value: 'passport', label: 'Passport' },
  { value: 'company-id', label: 'Company ID' },
  { value: 'other', label: 'Other' },
] as const;

export function DocumentManager({ documents, onDocumentsChange, isMobile = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);
  const [newDoc, setNewDoc] = useState<{
    name: string;
    type: EmployeeDocument['type'];
    fileData: string;
    fileType: string;
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only PDF, PNG, JPG, and JPEG files are allowed');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewDoc({
        name: file.name,
        type: 'other',
        fileData: reader.result as string,
        fileType: file.type,
      });
      setShowAddModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleAddDocument = () => {
    if (!newDoc) return;
    if (!newDoc.name.trim()) {
      toast.error('Document name is required');
      return;
    }

    const doc: EmployeeDocument = {
      id: String(Date.now()),
      name: newDoc.name.trim(),
      type: newDoc.type,
      fileData: newDoc.fileData,
      fileType: newDoc.fileType,
      uploadedAt: new Date().toISOString(),
    };

    onDocumentsChange([...documents, doc]);
    toast.success('Document uploaded successfully');
    setShowAddModal(false);
    setNewDoc(null);
  };

  const handleDownload = (doc: EmployeeDocument) => {
    const link = document.createElement('a');
    link.href = doc.fileData;
    link.download = doc.name;
    link.click();
    toast.success('Document downloaded');
  };

  const handleDelete = (docId: string, docName: string) => {
    if (!window.confirm(`Delete "${docName}"? This cannot be undone.`)) return;
    onDocumentsChange(documents.filter(d => d.id !== docId));
    toast.success('Document deleted');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>Documents</h4>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            background: 'var(--app-btn-primary-bg)',
            color: 'var(--app-btn-primary-fg)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Upload style={{ width: 14, height: 14 }} />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {documents.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: 'var(--app-input-bg)',
            border: '2px dashed var(--app-input-border)',
            borderRadius: 12,
            color: 'var(--app-text-muted)',
            fontSize: 13,
          }}
        >
          No documents uploaded yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map(doc => (
            <div
              key={doc.id}
              style={{
                padding: 12,
                background: 'var(--app-input-bg)',
                border: '1px solid var(--app-input-border)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: doc.fileType.startsWith('image/') ? '#EBF5FF' : '#FEF2F2',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FileText
                  style={{
                    width: 18,
                    height: 18,
                    color: doc.fileType.startsWith('image/') ? '#3B82F6' : '#EF4444',
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--app-text-primary)', marginBottom: 2 }}>
                  {doc.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)' }}>
                  {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || 'Other'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setPreviewDoc(doc)}
                  style={{
                    padding: 6,
                    background: 'var(--app-card)',
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="View"
                >
                  <Eye style={{ width: 14, height: 14, color: 'var(--app-text-muted)' }} />
                </button>
                <button
                  onClick={() => handleDownload(doc)}
                  style={{
                    padding: 6,
                    background: 'var(--app-card)',
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Download"
                >
                  <Download style={{ width: 14, height: 14, color: 'var(--app-text-muted)' }} />
                </button>
                <button
                  onClick={() => handleDelete(doc.id, doc.name)}
                  style={{
                    padding: 6,
                    background: 'var(--app-card)',
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Delete"
                >
                  <Trash2 style={{ width: 14, height: 14, color: '#EF4444' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Document Modal */}
      {showAddModal && newDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--app-overlay)',
            zIndex: 100,
            display: 'flex',
            alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setNewDoc(null);
            }
          }}
        >
          <div
            style={{
              background: 'var(--app-card)',
              width: isMobile ? '100%' : 460,
              maxHeight: isMobile ? '90vh' : 'auto',
              borderRadius: isMobile ? '20px 20px 0 0' : 20,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
                Add Document
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDoc(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X style={{ width: 20, height: 20, color: 'var(--app-text-muted)' }} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>
                  Document Name
                </label>
                <input
                  type="text"
                  value={newDoc.name}
                  onChange={e => setNewDoc({ ...newDoc, name: e.target.value })}
                  placeholder="e.g. Aadhaar Card"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    background: 'var(--app-input-bg)',
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 10,
                    color: 'var(--app-text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>
                  Document Type
                </label>
                <select
                  value={newDoc.type}
                  onChange={e => setNewDoc({ ...newDoc, type: e.target.value as EmployeeDocument['type'] })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    background: 'var(--app-input-bg)',
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 10,
                    color: 'var(--app-text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ padding: 12, background: 'var(--app-input-bg)', borderRadius: 10, fontSize: 13, color: 'var(--app-text-muted)' }}>
                <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--app-text-primary)' }}>File Selected:</div>
                <div>{newDoc.fileType.replace('application/', '').replace('image/', '').toUpperCase()}</div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--app-border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDoc(null);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 500,
                  background: 'var(--app-card)',
                  color: 'var(--app-text-secondary)',
                  border: '1px solid var(--app-input-border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddDocument}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 500,
                  background: 'var(--app-btn-primary-bg)',
                  color: 'var(--app-btn-primary-fg)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Add Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--app-overlay)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setPreviewDoc(null);
          }}
        >
          <div
            style={{
              background: 'var(--app-card)',
              borderRadius: 12,
              overflow: 'hidden',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
                {previewDoc.name}
              </h3>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X style={{ width: 20, height: 20, color: 'var(--app-text-muted)' }} />
              </button>
            </div>
            <div style={{ padding: 20, overflow: 'auto' }}>
              {previewDoc.fileType.startsWith('image/') ? (
                <img
                  src={previewDoc.fileData}
                  alt={previewDoc.name}
                  style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }}
                />
              ) : (
                <iframe
                  src={previewDoc.fileData}
                  style={{ width: isMobile ? '90vw' : '70vw', height: '70vh', border: 'none' }}
                  title={previewDoc.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
