import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Employee, EmployeeDocument } from '../App';
import { ProfilePhoto } from './ProfilePhoto';
import { PhotoUploadCrop } from './PhotoUploadCrop';
import { DocumentManager } from './DocumentManager';
import { SyncIndicator } from './SyncIndicator';

interface Props {
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
  onNavigateToProfile: (employeeId: string) => void;
}

interface FormState {
  // Basic Information
  name: string;
  salary: string;
  department: string;
  joiningDate: string;
  profilePhoto?: string;
  // Personal Information
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | '';
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  // Address Information
  currentAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  // Employment Information
  designation?: string;
  employeeCode?: string;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'intern' | '';
  // Documents
  documents?: EmployeeDocument[];
}

const EMPTY_FORM: FormState = {
  name: '', salary: '', department: '', joiningDate: '', profilePhoto: undefined,
  mobile: '', alternateMobile: '', email: '', dateOfBirth: '', gender: '',
  emergencyContactName: '', emergencyContactNumber: '',
  currentAddress: '', city: '', state: '', postalCode: '', country: '',
  designation: '', employeeCode: '', employmentType: '',
  documents: []
};

const DEPT_OPTIONS = ['Engineering', 'Design', 'HR', 'Sales', 'Marketing', 'Finance', 'Operations', 'Product'];

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ModalForm({
  title, form, setForm, onSave, onClose, error, isMobile, onPhotoUpload,
}: {
  title: string; form: FormState; setForm: (f: FormState) => void;
  onSave: () => void; onClose: () => void; error: string; isMobile: boolean;
  onPhotoUpload: () => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--app-overlay)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--app-card)',
        width: isMobile ? '100%' : 560,
        borderRadius: isMobile ? '20px 20px 0 0' : 20,
        padding: isMobile ? '24px 20px 32px' : 28,
        maxHeight: isMobile ? '92dvh' : '90vh',
        overflowY: 'auto',
        border: isMobile ? 'none' : '1px solid #E5E7EB',
      }}>
        {/* Drag handle on mobile */}
        {isMobile && (
          <div style={{ width: 36, height: 4, background: 'var(--app-border)', borderRadius: 2, margin: '0 auto 20px' }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: 'var(--app-text-primary)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Profile Photo Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <ProfilePhoto name={form.name || 'New Employee'} photoUrl={form.profilePhoto} size={80} />
          <button
            onClick={onPhotoUpload}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: 'var(--app-input-bg)',
              border: '1px solid var(--app-input-border)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--app-text-secondary)',
            }}
          >
            <Camera style={{ width: 14, height: 14 }} />
            {form.profilePhoto ? 'Change Photo' : 'Add Photo'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Basic Information */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 12 }}>Basic Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Arjun Sharma"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Department *</label>
                <select
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: form.department ? 'var(--app-text-primary)' : 'var(--app-text-muted)', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">Select department</option>
                  {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Designation</label>
                  <input
                    type="text"
                    value={form.designation || ''}
                    onChange={e => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g. Senior Developer"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Employee Code</label>
                  <input
                    type="text"
                    value={form.employeeCode || ''}
                    onChange={e => setForm({ ...form, employeeCode: e.target.value })}
                    placeholder="e.g. EMP001"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Monthly Salary *</label>
                  <input
                    type="number"
                    value={form.salary}
                    onChange={e => setForm({ ...form, salary: e.target.value })}
                    placeholder="e.g. 45000"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Joining Date *</label>
                  <input
                    type="date"
                    value={form.joiningDate}
                    onChange={e => setForm({ ...form, joiningDate: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Employment Type</label>
                <select
                  value={form.employmentType || ''}
                  onChange={e => setForm({ ...form, employmentType: e.target.value as any })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: form.employmentType ? 'var(--app-text-primary)' : 'var(--app-text-muted)', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">Select type</option>
                  <option value="full-time">Full Time</option>
                  <option value="part-time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 12 }}>Personal Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Mobile Number</label>
                  <input
                    type="tel"
                    value={form.mobile || ''}
                    onChange={e => setForm({ ...form, mobile: e.target.value })}
                    placeholder="e.g. 9876543210"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Alternate Mobile</label>
                  <input
                    type="tel"
                    value={form.alternateMobile || ''}
                    onChange={e => setForm({ ...form, alternateMobile: e.target.value })}
                    placeholder="e.g. 9876543211"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Email Address</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. arjun@company.com"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth || ''}
                    onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Gender</label>
                  <select
                    value={form.gender || ''}
                    onChange={e => setForm({ ...form, gender: e.target.value as any })}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: form.gender ? 'var(--app-text-primary)' : 'var(--app-text-muted)', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Emergency Contact Name</label>
                  <input
                    type="text"
                    value={form.emergencyContactName || ''}
                    onChange={e => setForm({ ...form, emergencyContactName: e.target.value })}
                    placeholder="e.g. Ravi Sharma"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Emergency Contact Number</label>
                  <input
                    type="tel"
                    value={form.emergencyContactNumber || ''}
                    onChange={e => setForm({ ...form, emergencyContactNumber: e.target.value })}
                    placeholder="e.g. 9876543212"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 12 }}>Address Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Current Address</label>
                <textarea
                  value={form.currentAddress || ''}
                  onChange={e => setForm({ ...form, currentAddress: e.target.value })}
                  placeholder="Enter current address"
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>City</label>
                  <input
                    type="text"
                    value={form.city || ''}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Mumbai"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>State</label>
                  <input
                    type="text"
                    value={form.state || ''}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Postal Code</label>
                  <input
                    type="text"
                    value={form.postalCode || ''}
                    onChange={e => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="e.g. 400001"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Country</label>
                  <input
                    type="text"
                    value={form.country || ''}
                    onChange={e => setForm({ ...form, country: e.target.value })}
                    placeholder="e.g. India"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <DocumentManager
              documents={form.documents || []}
              onDocumentsChange={(docs) => setForm({ ...form, documents: docs })}
              isMobile={isMobile}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 500, background: 'var(--app-card)', border: '1px solid var(--app-input-border)', borderRadius: 12, color: 'var(--app-text-secondary)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onSave} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, background: 'var(--app-btn-primary-bg)', border: 'none', borderRadius: 12, color: 'var(--app-btn-primary-fg)', cursor: 'pointer' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmployeeScreen({ employees, onUpdateEmployees, onNavigateToProfile }: Props) {
  const isMobile = useIsMobile();
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  const openAdd = () => { setForm(EMPTY_FORM); setEditingId(null); setError(''); setModalMode('add'); };
  const openEdit = (emp: Employee) => {
    setForm({
      name: emp.name,
      salary: String(emp.salary),
      department: emp.department,
      joiningDate: emp.joiningDate,
      profilePhoto: emp.profilePhoto,
      // Personal Information
      mobile: emp.mobile || '',
      alternateMobile: emp.alternateMobile || '',
      email: emp.email || '',
      dateOfBirth: emp.dateOfBirth || '',
      gender: emp.gender || '',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactNumber: emp.emergencyContactNumber || '',
      // Address Information
      currentAddress: emp.currentAddress || '',
      city: emp.city || '',
      state: emp.state || '',
      postalCode: emp.postalCode || '',
      country: emp.country || '',
      // Employment Information
      designation: emp.designation || '',
      employeeCode: emp.employeeCode || '',
      employmentType: emp.employmentType || '',
      // Documents
      documents: emp.documents || []
    });
    setEditingId(emp.id); setError(''); setModalMode('edit');
  };

  const handlePhotoSave = (photoData: string) => {
    setForm({ ...form, profilePhoto: photoData });
    setShowPhotoUpload(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }

    const today = new Date().toISOString().slice(0, 10);

    if (modalMode === 'add') {
      const newEmp: Employee = {
        id: String(Date.now()),
        name: form.name.trim(),
        salary: form.salary && !isNaN(Number(form.salary)) ? Number(form.salary) : 0,
        department: form.department || 'General',
        joiningDate: form.joiningDate || today,
        profilePhoto: form.profilePhoto,
        // Personal Information
        mobile: form.mobile || undefined,
        alternateMobile: form.alternateMobile || undefined,
        email: form.email || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactNumber: form.emergencyContactNumber || undefined,
        // Address Information
        currentAddress: form.currentAddress || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postalCode: form.postalCode || undefined,
        country: form.country || undefined,
        // Employment Information
        designation: form.designation || undefined,
        employeeCode: form.employeeCode || undefined,
        employmentType: form.employmentType || undefined,
        documents: form.documents || []
      };
      onUpdateEmployees([...employees, newEmp]);
      toast.success(`${newEmp.name} added to the team`);
    } else {
      onUpdateEmployees(employees.map(e => e.id === editingId ? {
        ...e,
        name: form.name.trim(),
        salary: form.salary && !isNaN(Number(form.salary)) ? Number(form.salary) : e.salary,
        department: form.department || e.department,
        joiningDate: form.joiningDate || e.joiningDate,
        profilePhoto: form.profilePhoto,
        // Personal Information
        mobile: form.mobile || undefined,
        alternateMobile: form.alternateMobile || undefined,
        email: form.email || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactNumber: form.emergencyContactNumber || undefined,
        // Address Information
        currentAddress: form.currentAddress || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postalCode: form.postalCode || undefined,
        country: form.country || undefined,
        // Employment Information
        designation: form.designation || undefined,
        employeeCode: form.employeeCode || undefined,
        employmentType: form.employmentType || undefined,
        // Documents
        documents: form.documents || []
      } : e));
      toast.success('Employee updated');
    }
    setModalMode(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the team? This cannot be undone.`)) return;
    onUpdateEmployees(employees.filter(e => e.id !== id));
    toast.success(`${name} removed`);
  };

  return (
    <>
      <div style={{ padding: isMobile ? '20px 16px 16px' : '32px 36px', maxWidth: isMobile ? '100%' : 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ color: 'var(--app-text-primary)', marginBottom: 2, fontSize: isMobile ? 20 : undefined }}>Employees</h1>
            <p style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>{employees.length} team members</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SyncIndicator />
            <button
              onClick={openAdd}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '9px 14px' : '9px 18px', fontSize: 13.5, fontWeight: 600, background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)', border: 'none', borderRadius: 12, cursor: 'pointer' }}
            >
              <Plus style={{ width: 15, height: 15 }} />
              {isMobile ? 'Add' : 'Add Employee'}
            </button>
          </div>
        </div>

        {/* Mobile: cards */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {employees.map(emp => (
              <div key={emp.id} style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 14, padding: '14px 16px' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  onClick={() => onNavigateToProfile(emp.id)}
                >
                  <ProfilePhoto name={emp.name} photoUrl={emp.profilePhoto} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)' }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 1 }}>{emp.department}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--app-text-secondary)', background: 'var(--app-subtle-bg)', padding: '2px 9px', borderRadius: 20 }}>
                        ₹{emp.salary.toLocaleString('en-IN')}/mo
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
                        Since {formatDate(emp.joiningDate)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(emp); }} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--app-subtle-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--app-text-muted)' }}>
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }} style={{ width: 34, height: 34, borderRadius: 10, background: '#FEF2F2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            ))}
            {employees.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--app-text-muted)', fontSize: 14 }}>
                No employees yet. Tap "Add" to get started.
              </div>
            )}
          </div>
        ) : (
          /* Desktop: table */
          <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 130px 88px', padding: '10px 24px', background: 'var(--app-table-header-bg)', borderBottom: '1px solid var(--app-border-subtle)' }}>
              {['Name', 'Department', 'Monthly Salary', 'Joined', ''].map(h => (
                <div key={h} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>
            {employees.map(emp => (
              <div
                key={emp.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 130px 88px', padding: '13px 24px', borderBottom: '1px solid var(--app-border-subtle)', alignItems: 'center', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => onNavigateToProfile(emp.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ProfilePhoto name={emp.name} photoUrl={emp.profilePhoto} size={36} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--app-text-primary)' }}>{emp.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)' }}>ID: {emp.id}</div>
                  </div>
                </div>
                <div>
                  <span style={{ padding: '3px 10px', fontSize: 12, background: 'var(--app-subtle-bg)', border: '1px solid var(--app-input-border)', borderRadius: 20, color: 'var(--app-text-muted)' }}>
                    {emp.department}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--app-text-primary)' }}>₹{emp.salary.toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>{formatDate(emp.joiningDate)}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(emp); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4, borderRadius: 6 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-subtle-bg)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4, borderRadius: 6 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            ))}
            {employees.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--app-text-muted)', fontSize: 14 }}>
                No employees yet. Add your first team member.
              </div>
            )}
          </div>
        )}
      </div>

      {modalMode && (
        <ModalForm
          title={modalMode === 'add' ? 'Add Employee' : 'Edit Employee'}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => setModalMode(null)}
          error={error}
          isMobile={isMobile}
          onPhotoUpload={() => setShowPhotoUpload(true)}
        />
      )}

      {showPhotoUpload && (
        <PhotoUploadCrop
          onSave={handlePhotoSave}
          onCancel={() => setShowPhotoUpload(false)}
          currentPhoto={form.profilePhoto}
        />
      )}
    </>
  );
}
