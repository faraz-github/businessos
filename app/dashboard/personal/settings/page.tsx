'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { brandProfileSchema, type BrandProfileFormData } from '@/types/schemas';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { ALL_SECTIONS, SECTION_LABELS, AGENCY_SECTION_LABELS } from '@/lib/auth/sections';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Input, Select, ConfirmDialog, SignaturePad } from '@/components/ui';
import type { SignaturePadHandle } from '@/components/ui';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Save, Check, Plus, UserCog, Shield, Pencil, X, Power, Trash2, Download, Upload, Loader, Archive, AlertTriangle, Skull, Pen, Type } from 'lucide-react';
import type { Mode } from '@/types';

interface TeamMember {
  id: string; name: string; email: string; role: 'superadmin' | 'admin';
  allowed_personal: string[] | null; allowed_agency: string[] | null;
  is_active: boolean; last_login_at: string | null; created_at: string;
}

// ─── ACCESS SELECTOR ───
function AccessSelector({ allowedPersonal, allowedAgency, onChangePersonal, onChangeAgency }: {
  allowedPersonal: string[] | null; allowedAgency: string[] | null;
  onChangePersonal: (v: string[] | null) => void; onChangeAgency: (v: string[] | null) => void;
}) {
  function toggleMode(mode: 'personal' | 'agency') {
    if (mode === 'personal') onChangePersonal(allowedPersonal !== null ? null : [...ALL_SECTIONS.personal]);
    else onChangeAgency(allowedAgency !== null ? null : [...ALL_SECTIONS.agency]);
  }
  function toggleSection(mode: 'personal' | 'agency', section: string) {
    if (mode === 'personal' && allowedPersonal !== null) {
      const next = allowedPersonal.includes(section) ? allowedPersonal.filter(s => s !== section) : [...allowedPersonal, section];
      onChangePersonal(next.length ? next : null);
    }
    if (mode === 'agency' && allowedAgency !== null) {
      const next = allowedAgency.includes(section) ? allowedAgency.filter(s => s !== section) : [...allowedAgency, section];
      onChangeAgency(next.length ? next : null);
    }
  }

  const modeBlock = (mode: 'personal' | 'agency', isOn: boolean, allowed: string[] | null, sections: readonly string[]) => (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button type="button" onClick={() => toggleMode(mode)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '10px 14px',
        background: isOn ? 'var(--accent-blue-dim)' : 'var(--bg-hover)',
        border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: isOn ? 'var(--accent-blue)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>
          {mode} Mode
        </span>
        <div style={{ width: 32, height: 18, borderRadius: 9, background: isOn ? 'var(--accent-blue)' : 'var(--border-strong)', position: 'relative', transition: 'background 150ms' }}>
          <div style={{ position: 'absolute', top: 2, left: isOn ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 150ms' }} />
        </div>
      </button>
      {isOn && (
        <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sections.map(section => {
            const checked = allowed?.includes(section) ?? false;
            return (
              <button key={section} type="button" onClick={() => toggleSection(mode, section)} style={{
                padding: '4px 10px', borderRadius: 100,
                border: `1px solid ${checked ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                background: checked ? 'var(--accent-blue-dim)' : 'transparent',
                color: checked ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms',
              }}>
                {(mode === 'agency' ? AGENCY_SECTION_LABELS : SECTION_LABELS)[section] || section}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {modeBlock('personal', allowedPersonal !== null, allowedPersonal, ALL_SECTIONS.personal)}
      {modeBlock('agency', allowedAgency !== null, allowedAgency, ALL_SECTIONS.agency)}
    </div>
  );
}

// ─── MEMBER MODAL ───
function MemberModal({ member, isSelfEdit, onClose, onSaved }: {
  member?: TeamMember | null; isSelfEdit?: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!member;
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [allowedPersonal, setAllowedPersonal] = useState<string[] | null>(member?.allowed_personal ?? null);
  const [allowedAgency, setAllowedAgency] = useState<string[] | null>(member?.allowed_agency ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    if (!isEdit && !password.trim()) { setError('Password is required for new members'); return; }
    if (password && password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password && password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true); setError('');
    try {
      const url = isEdit ? `/api/users/${member!.id}` : '/api/users';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = { name, email, role: isSelfEdit ? 'superadmin' : 'admin' };
      if (!isSelfEdit) { body.allowedPersonal = allowedPersonal; body.allowedAgency = allowedAgency; }
      if (password) body.password = password;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      onSaved(); onClose();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  const title = isSelfEdit ? 'Edit Your Profile' : isEdit ? 'Edit Team Member' : 'Add Team Member';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-modal)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 14px' }}>
          <h2 className="t-h2">{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '8px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label={isEdit ? 'New Password (leave blank to keep)' : 'Password'} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
            <Input label="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
          </div>
          {!isSelfEdit && (
            <div>
              <p className="t-label section-gap">Access Control</p>
              <AccessSelector allowedPersonal={allowedPersonal} allowedAgency={allowedAgency} onChangePersonal={setAllowedPersonal} onChangeAgency={setAllowedAgency} />
            </div>
          )}
          {isSelfEdit && (
            <div style={{ padding: '10px 14px', background: 'var(--accent-blue-dim)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--accent-blue)', fontFamily: 'var(--font-body)' }}>
              SuperAdmin always has full access to everything.
            </div>
          )}
          {error && <p style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>{error}</p>}
        </div>
        <div style={{ padding: '16px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave} icon={<Save size={13} />}>
            {isEdit ? 'Save Changes' : 'Create Member'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── TEAM TAB ───
function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingSelf, setEditingSelf] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/users');
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function toggleActive(member: TeamMember) {
    await fetch(`/api/users/${member.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !member.is_active }),
    });
    fetchMembers();
  }

  async function deleteMember(member: TeamMember) {
    const res = await fetch(`/api/users/${member.id}`, { method: 'DELETE' });
    if (res.ok) fetchMembers();
  }

  const superAdmin = members.find(m => m.role === 'superadmin');
  const teamMembers = members.filter(m => m.role !== 'superadmin');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p className="t-sm-semibold">Team & Access</p>
          <p className="t-xs mt-1">Manage who can access the platform and what they can see.</p>
        </div>
        <Button icon={<Plus size={13} />} onClick={() => { setEditingMember(null); setEditingSelf(false); setShowModal(true); }}>
          Add Member
        </Button>
      </div>

      {superAdmin && (
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={16} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="t-sm-semibold">{superAdmin.name}</span>
                <span className="badge badge-blue">SuperAdmin</span>
              </div>
              <p className="t-2xs text-tertiary" style={{ marginTop: 2 }}>
                {superAdmin.email} · Full access
                {superAdmin.last_login_at && ` · Last login: ${new Date(superAdmin.last_login_at).toLocaleDateString('en-IN')}`}
              </p>
            </div>
            <button
              onClick={() => { setEditingMember(superAdmin); setEditingSelf(true); setShowModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              <Pencil size={12} /> Edit Profile
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="t-xs text-tertiary">Loading...</p>
      ) : teamMembers.length === 0 ? (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <UserCog size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
          <p className="t-sm-semibold">No team members yet</p>
          <p className="t-xs mt-1">Add a team member to grant them access to the platform.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {teamMembers.map(member => (
            <div key={member.id} className="card" style={{ padding: '14px 18px', opacity: member.is_active ? 1 : 0.55, transition: 'opacity 200ms' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: member.is_active ? 'var(--accent-violet-dim)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent-violet)', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                  {member.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="t-sm-semibold">{member.name}</span>
                    <span className="badge badge-violet">{member.role}</span>
                    {!member.is_active && <span className="badge badge-red">Inactive</span>}
                  </div>
                  <p className="t-2xs text-tertiary" style={{ marginTop: 2 }}>
                    {member.email}
                    {member.last_login_at && ` · Last login: ${new Date(member.last_login_at).toLocaleDateString('en-IN')}`}
                  </p>
                  {(member.allowed_personal || member.allowed_agency) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {member.allowed_personal && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Personal: {member.allowed_personal.length} sections</span>}
                      {member.allowed_agency && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Agency: {member.allowed_agency.length} sections</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setEditingMember(member); setEditingSelf(false); setShowModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => toggleActive(member)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${member.is_active ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)'}`, background: member.is_active ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)', color: member.is_active ? 'var(--accent-red)' : 'var(--accent-green)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}>
                    <Power size={12} />{member.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  {confirmDeleteId === member.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>Delete?</span>
                      <button onClick={() => { deleteMember(member); setConfirmDeleteId(null); }}
                        style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-red)', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                        Yes
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(member.id)}
                      style={{ display: 'flex', padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'color 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <MemberModal
          member={editingMember}
          isSelfEdit={editingSelf}
          onClose={() => { setShowModal(false); setEditingMember(null); setEditingSelf(false); }}
          onSaved={fetchMembers}
        />
      )}
    </div>
  );
}

// ─── BRAND TAB ───
function BrandTab() {
  const { mode, personalBrand, agencyBrand, refreshBrand } = useBrand();
  const [activeMode, setActiveMode] = useState<Mode>(mode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const brand = activeMode === 'personal' ? personalBrand : agencyBrand;

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<BrandProfileFormData>({
    resolver: zodResolver(brandProfileSchema),
    defaultValues: {
      mode: activeMode,
      primary_colour: '#4F8EF7',
      secondary_colour: '#8B6CF7',
      font_choice: 'DM Sans',
      tone: 'confident',
      business_name: '',
    },
  });

  const primaryColour   = watch('primary_colour');
  const secondaryColour = watch('secondary_colour');
  const [logoUploading, setLogoUploading] = useState(false);
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null);

  const displayLogoUrl = localLogoUrl ?? brand?.logo_url ?? null;

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    // 2 MB pre-compression sanity cap. The compressor will bring this
    // well under the bucket's 2 MB limit, but a 50 MB source would
    // take noticeable time to compress on a slow phone.
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo source file must be under 2 MB. Try a smaller image.');
      return;
    }

    setLogoUploading(true);
    try {
      // Compress on the user's device before shipping bytes.
      // SVGs pass through unchanged (they're already small and lossless).
      const { compressImage } = await import('@/lib/storage/compress');
      const compressed = file.type === 'image/svg+xml'
        ? file
        : await compressImage(file, 'logo');

      const formData = new FormData();
      formData.append('file', compressed);

      const { uploadBrandLogo } = await import('@/app/dashboard/actions/brand');
      const res = await uploadBrandLogo(activeMode, formData);
      if (!res.ok) {
        alert(`Logo upload failed: ${res.error}`);
        return;
      }
      setLocalLogoUrl(res.data.url);
      await refreshBrand();
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogoRemove() {
    const prev = localLogoUrl;
    setLocalLogoUrl('');  // optimistic
    try {
      const { removeBrandLogo } = await import('@/app/dashboard/actions/brand');
      const res = await removeBrandLogo(activeMode);
      if (!res.ok) {
        setLocalLogoUrl(prev);  // rollback
        alert(`Could not remove logo: ${res.error}`);
        return;
      }
      await refreshBrand();
    } catch (err) {
      setLocalLogoUrl(prev);  // rollback
      console.error('Logo remove failed:', err);
      alert(err instanceof Error ? err.message : 'Logo remove failed');
    }
  }

  // ─── SIGNATURE STATE / HANDLERS ──────────────────────────────
  // Mirrors the logo pattern 1:1: local optimistic state, optimistic
  // render while the upload/remove round-trips. The "Draw" flow
  // exports the canvas as a PNG Blob directly — no data URL → Blob
  // conversion needed — which keeps bytes-on-wire minimal. The
  // "Upload" flow goes through the same compressImage pipeline as
  // logos so we reuse the well-tuned compression profile.
  const [signatureTab, setSignatureTab] = useState<'saved' | 'draw' | 'upload'>('saved');
  const [sigUploading, setSigUploading] = useState(false);
  const [localSigUrl,  setLocalSigUrl]  = useState<string | null>(null);
  const [localSigType, setLocalSigType] = useState<'drawn' | 'uploaded' | null>(null);
  const [sigHasStrokes, setSigHasStrokes] = useState(false);
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  // When switching modes, reset the local overrides so the preview
  // reflects the other mode's saved signature (not the one we just
  // uploaded to the previous mode).
  useEffect(() => {
    setLocalSigUrl(null);
    setLocalSigType(null);
    setSignatureTab('saved');
  }, [activeMode]);

  // `displaySignatureUrl` is the URL we show in the preview:
  // the local optimistic URL wins over the brand's persisted URL.
  const displaySignatureUrl = localSigUrl ?? brand?.signature_url ?? null;
  const displaySignatureType: 'drawn' | 'uploaded' | null =
    localSigType ?? brand?.signature_type ?? null;

  async function handleSaveDrawnSignature() {
    const blob = await signaturePadRef.current?.getPngBlob();
    if (!blob) return;
    setSigUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', new File([blob], 'signature.png', { type: 'image/png' }));
      const { uploadBrandSignature } = await import('@/app/dashboard/actions/brand');
      const res = await uploadBrandSignature(activeMode, formData, 'drawn');
      if (!res.ok) {
        alert(`Could not save signature: ${res.error}`);
        return;
      }
      setLocalSigUrl(res.data.url);
      setLocalSigType('drawn');
      signaturePadRef.current?.clear();
      setSignatureTab('saved');
      await refreshBrand();
    } catch (err) {
      console.error('Signature save error:', err);
      alert(err instanceof Error ? err.message : 'Could not save signature');
    } finally {
      setSigUploading(false);
    }
  }

  async function handleUploadSignature(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Signature file must be under 2 MB. Try a smaller image.');
      return;
    }
    // Reset the input so picking the same file twice still fires change.
    e.target.value = '';

    setSigUploading(true);
    try {
      const { compressImage } = await import('@/lib/storage/compress');
      // Signatures reuse the logo compression profile (≤200KB, 512px long
      // edge). That's plenty for a stamp or scan — signatures print at
      // postage-stamp size inside the doc anyway.
      const compressed = await compressImage(file, 'logo');
      const formData = new FormData();
      formData.append('file', compressed);
      const { uploadBrandSignature } = await import('@/app/dashboard/actions/brand');
      const res = await uploadBrandSignature(activeMode, formData, 'uploaded');
      if (!res.ok) {
        alert(`Could not upload signature: ${res.error}`);
        return;
      }
      setLocalSigUrl(res.data.url);
      setLocalSigType('uploaded');
      setSignatureTab('saved');
      await refreshBrand();
    } catch (err) {
      console.error('Signature upload error:', err);
      alert(err instanceof Error ? err.message : 'Could not upload signature');
    } finally {
      setSigUploading(false);
    }
  }

  async function handleSignatureRemove() {
    const prevUrl  = localSigUrl;
    const prevType = localSigType;
    setLocalSigUrl('');           // optimistic
    setLocalSigType(null);
    try {
      const { removeBrandSignature } = await import('@/app/dashboard/actions/brand');
      const res = await removeBrandSignature(activeMode);
      if (!res.ok) {
        setLocalSigUrl(prevUrl);  // rollback
        setLocalSigType(prevType);
        alert(`Could not remove signature: ${res.error}`);
        return;
      }
      await refreshBrand();
    } catch (err) {
      setLocalSigUrl(prevUrl);
      setLocalSigType(prevType);
      console.error('Signature remove failed:', err);
      alert(err instanceof Error ? err.message : 'Could not remove signature');
    }
  }

  useEffect(() => {
    const b = activeMode === 'personal' ? personalBrand : agencyBrand;
    reset({
      mode: activeMode,
      primary_colour: b?.primary_colour || '#4F8EF7',
      secondary_colour: b?.secondary_colour || '#8B6CF7',
      font_choice: b?.font_choice || 'DM Sans',
      tone: b?.tone || 'confident',
      business_name: b?.business_name || '',
      tagline: b?.tagline || '',
      phone: b?.phone || '',
      email: b?.email || '',
      website: b?.website || '',
      gst_number: b?.gst_number || '',
      bank_name: b?.bank_name || '',
      bank_account_number: b?.bank_account_number || '',
      bank_ifsc: b?.bank_ifsc || '',
      bank_upi: b?.bank_upi || '',
    });
  }, [activeMode, personalBrand, agencyBrand, reset]);

  async function onSubmit(data: BrandProfileFormData) {
    setSaving(true);
    try {
      const { upsertBrandProfile } = await import('@/app/dashboard/actions/brand');
      const res = await upsertBrandProfile(data);
      if (!res.ok) {
        alert(`Could not save brand: ${res.error}`);
        return;
      }
      await refreshBrand();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Brand save error:', err);
      alert(err instanceof Error ? err.message : 'Brand save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('mode')} />

      {/* Personal / Agency mode selector — pill style matching ModeSwitch */}
      <div style={{
        display: 'inline-flex', alignItems: 'center',
        background: 'var(--bg-hover)',
        borderRadius: 'var(--radius-md)',
        padding: 3, gap: 2,
        marginBottom: 24,
      }}>
        {(['personal', 'agency'] as const).map(m => {
          const isActive = activeMode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => { setActiveMode(m); setValue('mode', m); }}
              style={{
                position: 'relative',
                padding: '7px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                background: isActive ? 'var(--bg-surface)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px var(--border-subtle)' : 'none',
                transition: 'all 150ms',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* Form — 3 logical sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Section 0: Logo */}
        <div>
          <p className="t-label section-gap">Logo</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Logo preview */}
            <div style={{
              width: 64, height: 64, borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {displayLogoUrl ? (
                <img src={displayLogoUrl} alt="Brand logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800,
                  color: primaryColour || 'var(--accent-blue)',
                }}>
                  {watch('business_name')?.[0]?.toUpperCase() || (activeMode === 'personal' ? 'P' : 'A')}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: logoUploading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
                cursor: logoUploading ? 'not-allowed' : 'pointer',
                transition: 'all 150ms',
              }}
                onMouseEnter={e => { if (!logoUploading) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
              >
                {logoUploading ? 'Uploading...' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  disabled={logoUploading}
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <p className="t-2xs text-tertiary">PNG, JPG, SVG or WebP · max 2MB</p>
            </div>
          </div>
        </div>

        {/* Section 0b: Signature */}
        {/* Saved signature / stamp. Offered as a picker option in the
            paperwork editor — NEVER auto-applied on Send or Final.
            The user explicitly chooses "Use saved" or drafts fresh
            each time. See SenderSignatureField in paperwork/page.tsx. */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p className="t-label" style={{ margin: 0 }}>Signature</p>
            <p className="t-2xs text-tertiary" style={{ margin: 0 }}>Reusable signature or stamp for your {activeMode === 'personal' ? 'personal' : 'agency'} documents</p>
          </div>

          <div className="signature-row">
            {/* Preview */}
            <div style={{
              width: 160, height: 90, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: displaySignatureUrl ? '#ffffff' : 'var(--bg-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {displaySignatureUrl ? (
                <img src={displaySignatureUrl} alt="Saved signature"
                  style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain' }} />
              ) : (
                <span className="t-2xs text-tertiary" style={{ textAlign: 'center', padding: 12 }}>
                  No signature saved
                </span>
              )}
            </div>

            {/* Controls */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Tab picker */}
              <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, gap: 2, borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
                {([
                  { id: 'saved',  label: displaySignatureUrl ? 'Saved' : 'No saved', icon: <Check size={12} />, disabled: !displaySignatureUrl },
                  { id: 'draw',   label: 'Draw',   icon: <Pen  size={12} />, disabled: false },
                  { id: 'upload', label: 'Upload', icon: <Type size={12} />, disabled: false },
                ] as const).map(t => (
                  <button key={t.id} type="button" onClick={() => { if (!t.disabled) setSignatureTab(t.id); }}
                    disabled={t.disabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 7, border: 'none',
                      background:   signatureTab === t.id ? 'var(--bg-surface)' : 'transparent',
                      color:        signatureTab === t.id ? 'var(--text-primary)' : (t.disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)'),
                      fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
                      cursor: t.disabled ? 'not-allowed' : 'pointer',
                      opacity: t.disabled ? 0.5 : 1,
                      boxShadow: signatureTab === t.id ? 'var(--shadow-card)' : 'none',
                      transition: 'all 150ms',
                    }}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* Saved — just show Remove */}
              {signatureTab === 'saved' && displaySignatureUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p className="t-2xs text-tertiary" style={{ margin: 0, flex: 1 }}>
                    {displaySignatureType === 'drawn' ? 'Drawn in app' : 'Uploaded image'}
                    {' · '}
                    Used as a picker option on outgoing documents.
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={handleSignatureRemove}>
                    <Trash2 size={12} /> Remove
                  </Button>
                </div>
              )}

              {/* Draw */}
              {signatureTab === 'draw' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SignaturePad
                    ref={signaturePadRef}
                    width={400}
                    height={90}
                    onDrawChange={setSigHasStrokes}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => signaturePadRef.current?.clear()}
                      disabled={!sigHasStrokes || sigUploading}>
                      Clear
                    </Button>
                    <Button type="button" size="sm"
                      onClick={handleSaveDrawnSignature}
                      disabled={!sigHasStrokes || sigUploading}>
                      {sigUploading ? 'Saving...' : 'Save Signature'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload */}
              {signatureTab === 'upload' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: sigUploading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
                    cursor: sigUploading ? 'not-allowed' : 'pointer',
                    transition: 'all 150ms',
                  }}>
                    {sigUploading ? 'Uploading...' : 'Choose image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={sigUploading}
                      onChange={handleUploadSignature}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <p className="t-2xs text-tertiary" style={{ margin: 0 }}>PNG, JPG or WebP · max 2MB</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Identity */}
        <div>
          <p className="t-label section-gap">Identity</p>
          <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Business Name" {...register('business_name')} error={errors.business_name?.message} placeholder="Your name or business name" />
            <Input label="Tagline" {...register('tagline')} placeholder="What you do in one line" />
            <Input label="Email" type="email" {...register('email')} placeholder="hello@yourbrand.com" />
            <Input label="Phone / WhatsApp" {...register('phone')} placeholder="+91 98765 43210" />
            <Input label="Website" {...register('website')} placeholder="https://yourbrand.com" />
            <Input label="GST Number" {...register('gst_number')} placeholder="22AAAAA0000A1Z5" />
          </div>
        </div>

        {/* Section 2: Brand */}
        <div>
          <p className="t-label section-gap">Brand</p>
          <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            <ColorPicker label="Primary Colour" value={primaryColour} onChange={v => setValue('primary_colour', v)} />
            <ColorPicker label="Secondary Colour" value={secondaryColour} onChange={v => setValue('secondary_colour', v)} />
            <Select label="Tone of Voice" {...register('tone')} options={[
              { value: 'confident', label: 'Confident' },
              { value: 'conversational', label: 'Conversational' },
              { value: 'formal', label: 'Formal' },
            ]} />
          </div>
        </div>

        {/* Section 3: Payment */}
        <div>
          <p className="t-label section-gap">Payment Details</p>
          <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Bank Name" {...register('bank_name')} placeholder="HDFC / SBI / ICICI..." />
            <Input label="Account Number" {...register('bank_account_number')} placeholder="Account number" />
            <Input label="IFSC Code" {...register('bank_ifsc')} placeholder="HDFC0001234" />
            <Input label="UPI ID" {...register('bank_upi')} placeholder="yourname@upi" />
          </div>
        </div>

      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28, paddingTop: 4 }}>
        <Button type="submit" loading={saving} icon={saved ? <Check size={13} /> : <Save size={13} />}>
          {saved ? 'Saved!' : 'Save Brand'}
        </Button>
      </div>
    </form>
  );
}

// ─── BACKUP TAB ───
interface BackupListItem {
  filename:   string;
  name:       string;
  size_bytes: number;
  created_at: string;
}

type PasswordAction =
  | { kind: 'create' }
  | { kind: 'restore-file';     file: File;         mode: 'replace' | 'merge' }
  | { kind: 'restore-existing'; filename: string;   mode: 'replace' | 'merge' }
  | { kind: 'nuke' };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function BackupTab() {
  const [backups, setBackups]             = useState<BackupListItem[]>([]);
  const [listLoading, setListLoading]     = useState(true);
  const [listError, setListError]         = useState<string | null>(null);
  const [running, setRunning]             = useState(false);
  const [resultMsg, setResultMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  // Restore-from-file UX state
  const [pendingFile, setPendingFile]     = useState<File | null>(null);
  const [restoreMode, setRestoreMode]     = useState<'replace' | 'merge'>('replace');

  // Password prompt state — one modal serves create/restore/nuke
  const [pwdAction, setPwdAction]         = useState<PasswordAction | null>(null);
  const [pwd, setPwd]                     = useState('');
  const [pwdError, setPwdError]           = useState<string | null>(null);

  // Nuke double-confirmation — user types the phrase to arm
  const [nukePhrase, setNukePhrase]       = useState('');
  const NUKE_PHRASE = 'DELETE ALL MY DATA';

  // Delete-backup confirmation — uses the ConfirmDialog primitive so the
  // destructive action gets a consistent two-step gate instead of firing
  // on the first button click.
  const [confirmDeleteBackup, setConfirmDeleteBackup] = useState<BackupListItem | null>(null);

  const loadBackups = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch('/api/backup/list');
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as BackupListItem[];
      setBackups(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { void loadBackups(); }, [loadBackups]);

  async function runAction(action: PasswordAction, password: string): Promise<void> {
    setRunning(true);
    setResultMsg(null);
    try {
      if (action.kind === 'create') {
        const res = await fetch('/api/backup/create', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error || `Backup failed (${res.status})`);
        }
        // Stream the blob to a download link so the user also gets the file locally.
        const blob  = await res.blob();
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `bos-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setResultMsg({ ok: true, text: 'Backup created and downloaded.' });
      } else if (action.kind === 'restore-file' || action.kind === 'restore-existing') {
        const form = new FormData();
        form.append('password', password);
        form.append('mode',     action.mode);
        if (action.kind === 'restore-file') {
          form.append('file', action.file);
        } else {
          form.append('filename', action.filename);
        }
        const res = await fetch('/api/backup/restore', { method: 'POST', body: form });
        const body = await res.json() as {
          ok?: boolean; error?: string;
          restored?: Record<string, number>;
          source_date?: string;
          errors?: string[];
        };
        if (!res.ok || !body.ok) throw new Error(body.error || 'Restore failed');
        const totalRows = Object.values(body.restored ?? {}).reduce((s, n) => s + n, 0);
        const hint = body.errors?.length
          ? ` (${body.errors.length} table error${body.errors.length === 1 ? '' : 's'} — see console)`
          : '';
        if (body.errors?.length) console.warn('[restore] table errors:', body.errors);
        setResultMsg({
          ok:   true,
          text: `Restored ${totalRows} rows from backup dated ${new Date(body.source_date || '').toLocaleString()}${hint}.`,
        });
        setPendingFile(null);
      } else {
        // Nuke
        const res = await fetch('/api/backup/nuke', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ password }),
        });
        const body = await res.json() as {
          ok?: boolean; error?: string; deleted?: Record<string, number>;
        };
        if (!res.ok || !body.ok) throw new Error(body.error || 'Nuke failed');
        const totalRows = Object.values(body.deleted ?? {}).reduce((s, n) => s + n, 0);
        setResultMsg({ ok: true, text: `Deleted ${totalRows} rows across all tables.` });
        setNukePhrase('');
      }
      await loadBackups();
    } catch (err) {
      setResultMsg({ ok: false, text: err instanceof Error ? err.message : 'Action failed' });
    } finally {
      setRunning(false);
    }
  }

  function submitPassword(e: React.FormEvent): void {
    e.preventDefault();
    if (!pwdAction || !pwd) { setPwdError('Password required'); return; }
    setPwdError(null);
    const action = pwdAction;
    const password = pwd;
    setPwdAction(null);
    setPwd('');
    void runAction(action, password);
  }

  function downloadExistingBackup(item: BackupListItem): void {
    // GET the backup file through our server route — the bucket is private
    // so we can't link directly. The browser opens the Content-Disposition
    // header as a download automatically.
    const url = `/api/backup/download?filename=${encodeURIComponent(item.filename)}`;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function deleteExistingBackup(item: BackupListItem): Promise<void> {
    setRunning(true);
    setResultMsg(null);
    try {
      const res = await fetch('/api/backup/delete', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: item.filename }),
      });
      const body = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || `Delete failed (${res.status})`);
      setResultMsg({ ok: true, text: `Deleted "${item.name}".` });
      await loadBackups();
    } catch (err) {
      setResultMsg({ ok: false, text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Create section ──────────────────────────────────────── */}
      <div>
        <h2 className="t-h2" style={{ marginBottom: 6 }}>Create backup</h2>
        <p className="t-xs text-secondary" style={{ marginBottom: 16 }}>
          Exports every row you own across every table, plus brand logos, into a single JSON file.
          A copy is stored in your workspace and downloaded to your device.
        </p>
        <Button
          onClick={() => { setPwdAction({ kind: 'create' }); setPwd(''); setPwdError(null); }}
          disabled={running}
          style={{ gap: 6 }}
        >
          {running ? <Loader size={14} className="spin" /> : <Download size={14} />}
          Create new backup
        </Button>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      {/* ── Restore from file ───────────────────────────────────── */}
      <div>
        <h2 className="t-h2" style={{ marginBottom: 6 }}>Restore from file</h2>
        <p className="t-xs text-secondary" style={{ marginBottom: 16 }}>
          Upload a backup JSON to restore.{' '}
          <strong style={{ color: 'var(--text-primary)' }}>Replace</strong> wipes existing data first;{' '}
          <strong style={{ color: 'var(--text-primary)' }}>Merge</strong> only adds rows whose IDs don&apos;t already exist.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '18px 16px', border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              background: pendingFile ? 'var(--accent-blue-dim)' : 'transparent',
              color: pendingFile ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: 13, fontFamily: 'var(--font-body)',
            }}
          >
            <Upload size={14} />
            {pendingFile ? `${pendingFile.name} (${formatBytes(pendingFile.size)})` : 'Click to select a backup JSON'}
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={e => setPendingFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['replace', 'merge'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRestoreMode(m)}
                  style={{
                    padding: '5px 14px', borderRadius: 100,
                    border: `1px solid ${restoreMode === m ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                    background: restoreMode === m ? 'var(--accent-blue-dim)' : 'transparent',
                    color: restoreMode === m ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer',
                    textTransform: 'capitalize', transition: 'all 150ms',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            <Button
              onClick={() => {
                if (!pendingFile) return;
                setPwdAction({ kind: 'restore-file', file: pendingFile, mode: restoreMode });
                setPwd('');
                setPwdError(null);
              }}
              disabled={!pendingFile || running}
              style={{ gap: 6 }}
            >
              {running ? <Loader size={14} className="spin" /> : <Archive size={14} />}
              Restore from file
            </Button>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      {/* ── Existing backups ────────────────────────────────────── */}
      <div>
        <h2 className="t-h2" style={{ marginBottom: 6 }}>Stored backups</h2>
        <p className="t-xs text-secondary" style={{ marginBottom: 16 }}>
          Backups stored in your Supabase project. Restore any of them directly.
        </p>

        {listLoading ? (
          <p className="t-xs text-tertiary" style={{ padding: '10px 0' }}>Loading…</p>
        ) : listError ? (
          <p className="t-xs" style={{ color: 'var(--accent-red)', padding: '10px 0' }}>
            {listError}
          </p>
        ) : backups.length === 0 ? (
          <p className="t-xs text-tertiary" style={{ padding: '10px 0' }}>
            No backups yet. Create one above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {backups.map(b => (
              <div
                key={b.filename}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)',
                }}
              >
                <Archive size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="t-xs-medium text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
                    {b.name}
                  </p>
                  <p className="t-2xs text-tertiary" style={{ marginTop: 2 }}>
                    {new Date(b.created_at).toLocaleString()} · {formatBytes(b.size_bytes)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Button
                    onClick={() => downloadExistingBackup(b)}
                    disabled={running}
                    variant="secondary"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                  >
                    <Download size={11} /> Download
                  </Button>
                  <Button
                    onClick={() => {
                      setPwdAction({ kind: 'restore-existing', filename: b.filename, mode: restoreMode });
                      setPwd('');
                      setPwdError(null);
                    }}
                    disabled={running}
                    style={{ padding: '4px 10px', fontSize: 11 }}
                  >
                    <Archive size={11} /> Restore
                  </Button>
                  <Button
                    onClick={() => setConfirmDeleteBackup(b)}
                    disabled={running}
                    variant="ghost"
                    style={{ padding: '4px 10px', fontSize: 11, color: 'var(--accent-red)' }}
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      {/* ── Danger zone ─────────────────────────────────────────── */}
      <div
        style={{
          padding: 18, borderRadius: 'var(--radius-md)',
          background: 'var(--accent-red-dim)',
          border: '1px solid rgba(240,82,82,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={14} style={{ color: 'var(--accent-red)' }} />
          <h2 className="t-h2" style={{ color: 'var(--accent-red)' }}>Delete all data</h2>
        </div>
        <p className="t-xs" style={{ color: 'var(--accent-red)', opacity: 0.85, marginBottom: 14 }}>
          Wipes every row across every table for this account. Your sign-in credentials remain
          so you can start fresh. <strong>Irreversible.</strong> Download a backup first.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={nukePhrase}
            onChange={e => setNukePhrase(e.target.value)}
            placeholder={`Type "${NUKE_PHRASE}" to arm`}
            className="input"
            style={{ maxWidth: 280, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          <Button
            onClick={() => { setPwdAction({ kind: 'nuke' }); setPwd(''); setPwdError(null); }}
            disabled={running || nukePhrase !== NUKE_PHRASE}
            style={{
              gap: 6,
              background: nukePhrase === NUKE_PHRASE ? 'var(--accent-red)' : 'var(--bg-hover)',
              color: nukePhrase === NUKE_PHRASE ? '#fff' : 'var(--text-tertiary)',
            }}
          >
            <Skull size={13} /> Delete everything
          </Button>
        </div>
      </div>

      {/* ── Result banner ───────────────────────────────────────── */}
      {resultMsg && (
        <div
          style={{
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: resultMsg.ok ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
            color: resultMsg.ok ? 'var(--accent-green)' : 'var(--accent-red)',
            fontSize: 12, fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {resultMsg.ok ? <Check size={13} /> : <X size={13} />}
          {resultMsg.text}
        </div>
      )}

      {/* ── Password prompt modal ───────────────────────────────── */}
      {pwdAction && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 24,
          }}
          onClick={() => { if (!running) { setPwdAction(null); setPwd(''); } }}
        >
          <form
            onSubmit={submitPassword}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)', padding: 24,
              width: '100%', maxWidth: 400,
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            <h3 className="t-h2" style={{ marginBottom: 6 }}>Confirm your password</h3>
            <p className="t-xs text-secondary" style={{ marginBottom: 16 }}>
              {pwdAction.kind === 'nuke'
                ? 'This will permanently delete all of your data. Enter your password to confirm.'
                : pwdAction.kind === 'create'
                ? 'Re-enter your password to create a backup.'
                : 'Re-enter your password to restore. This will modify your data.'}
            </p>
            <Input
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              autoFocus
              placeholder="Your password"
            />
            {pwdError && (
              <p className="t-xs" style={{ color: 'var(--accent-red)', marginTop: 8 }}>{pwdError}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setPwdAction(null); setPwd(''); }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!pwd}>
                Confirm
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Confirm-delete-backup dialog ─────────────────────────── */}
      <ConfirmDialog
        open={confirmDeleteBackup !== null}
        onClose={() => setConfirmDeleteBackup(null)}
        onConfirm={() => {
          const item = confirmDeleteBackup;
          setConfirmDeleteBackup(null);
          if (item) void deleteExistingBackup(item);
        }}
        title="Delete this backup?"
        description={
          confirmDeleteBackup
            ? `"${confirmDeleteBackup.name}" will be permanently removed from storage. Any copies you've already downloaded are unaffected.`
            : ''
        }
        confirmLabel="Delete backup"
        loading={running}
      />

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── MAIN PAGE ───
export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();

  // Resolve the initial tab from URL. Must reflect the user's role — a
  // non-superadmin with ?tab=team or ?tab=backup gets silently bumped
  // to 'brand' rather than rendering an empty content pane.
  const resolveTab = useCallback((raw: string | null, role?: string): 'brand' | 'team' | 'backup' => {
    if (role !== 'superadmin') return 'brand';
    if (raw === 'team' || raw === 'backup') return raw;
    return 'brand';
  }, []);

  const [activeTab, setActiveTab] = useState<'brand' | 'team' | 'backup'>(() =>
    resolveTab(searchParams.get('tab'), 'superadmin'),
  );

  useEffect(() => {
    setActiveTab(resolveTab(searchParams.get('tab'), user?.role));
  }, [searchParams, user?.role, resolveTab]);

  if (!user) return null;

  type TabValue = 'brand' | 'team' | 'backup';
  const tabs: ReadonlyArray<{ value: TabValue; label: string }> = [
    { value: 'brand', label: 'Brand Settings' },
    ...(user.role === 'superadmin'
      ? ([
          { value: 'team',   label: 'Team & Access' },
          { value: 'backup', label: 'Backup & Restore' },
        ] as const)
      : []),
  ];

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* Page header */}
        <div>
          <h1 className="t-h1">Settings</h1>
          <p className="t-xs mt-1">Manage your brand, team access, and backups.</p>
        </div>

        {/* Tab switcher — underline style, not pill */}
        <div className="tabs-scroll" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
                color: activeTab === tab.value ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: `2px solid ${activeTab === tab.value ? 'var(--accent-blue)' : 'transparent'}`,
                marginBottom: -1,
                transition: 'color 150ms, border-color 150ms',
              }}
              onMouseEnter={e => { if (activeTab !== tab.value) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (activeTab !== tab.value) (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          {activeTab === 'brand'  && <BrandTab />}
          {activeTab === 'team'   && user.role === 'superadmin' && <TeamTab />}
          {activeTab === 'backup' && user.role === 'superadmin' && <BackupTab />}
        </div>

      </div>
    </PageTransition>
  );
}
