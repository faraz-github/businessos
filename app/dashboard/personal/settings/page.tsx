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
import { Button, Input, Select } from '@/components/ui';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Save, Check, Plus, UserCog, Shield, Pencil, X, Power, Trash2, Download, Upload, AlertTriangle, Database, RotateCcw, HardDriveDownload } from 'lucide-react';
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2MB'); return; }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { uploadBrandLogo } = await import('@/app/dashboard/actions/brand');
      const url = await uploadBrandLogo(activeMode, formData);
      setLocalLogoUrl(url);
      await refreshBrand();
    } catch (err) { console.error('Logo upload failed:', err); }
    finally { setLogoUploading(false); }
  }

  async function handleLogoRemove() {
    setLocalLogoUrl('');
    // Clear logo_url by saving empty string — brand.logo_url will be null after refresh
    await fetch('/api/brand/logo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: activeMode }),
    });
    await refreshBrand();
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
      await upsertBrandProfile(data);
      await refreshBrand();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { console.error('Brand save error:', err); }
    finally { setSaving(false); }
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

        {/* Section 1: Identity */}
        <div>
          <p className="t-label section-gap">Identity</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

// ─── MAIN PAGE ───
export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab');
    if (t === 'team') return 'team';
    if (t === 'backup') return 'backup';
    return 'brand';
  });
  const { user } = useCurrentUser();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'team') setActiveTab('team');
    else if (!tab || tab === 'brand') setActiveTab('brand');
  }, [searchParams]);

  if (!user) return null;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* Page header */}
        <div>
          <h1 className="t-h1">Settings</h1>
          <p className="t-xs mt-1">Manage your brand and team access.</p>
        </div>

        {/* Tab switcher — underline style, not pill */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 0 }}>
          {[
            { value: 'brand', label: 'Brand Settings' },
            ...(user.role === 'superadmin' ? [{ value: 'team', label: 'Team & Access' }] : []),
            ...(user.role === 'superadmin' ? [{ value: 'backup', label: 'Backup & Restore' }] : []),
          ].map(tab => (
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
          {activeTab === 'brand' && <BrandTab />}
          {activeTab === 'team' && user.role === 'superadmin' && <TeamTab />}
          {activeTab === 'backup' && user.role === 'superadmin' && <BackupTab />}
        </div>

      </div>
    </PageTransition>
  );
}

// ─── BACKUP TAB ───────────────────────────────────────────────
interface BackupListItem {
  filename: string; name: string; size_bytes: number; created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type BackupStep = 'idle' | 'confirm_password' | 'loading' | 'done' | 'error';

function PasswordGate({ title, description, danger, onConfirm, onCancel, loading, error }: {
  title: string; description: string; danger?: boolean;
  onConfirm: (password: string) => void; onCancel: () => void;
  loading: boolean; error: string | null;
}) {
  const [pw, setPw] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '12px 14px', background: danger ? 'var(--accent-red-dim)' : 'var(--bg-hover)', borderRadius: 'var(--radius-md)', border: `1px solid ${danger ? 'rgba(240,82,82,0.2)' : 'var(--border-subtle)'}` }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: danger ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 12, color: danger ? 'var(--accent-red)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', opacity: 0.85 }}>{description}</p>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', display: 'block', marginBottom: 6 }}>
          Superadmin Password
        </label>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && pw.trim()) onConfirm(pw); }}
          placeholder="Enter your password to confirm"
          autoFocus
          style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const }}
        />
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '8px 14px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => pw.trim() && onConfirm(pw)} disabled={loading || !pw.trim()}
          style={{ flex: 1, padding: '8px 14px', background: danger ? 'var(--accent-red)' : 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: loading || !pw.trim() ? 'not-allowed' : 'pointer', opacity: loading || !pw.trim() ? 0.6 : 1 }}>
          {loading ? 'Working…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

function BackupTab() {
  const [backups, setBackups]       = useState<BackupListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Backup state
  const [backupStep, setBackupStep]   = useState<BackupStep>('idle');
  const [backupError, setBackupError] = useState<string | null>(null);

  // Restore state
  const [restoreStep, setRestoreStep]   = useState<BackupStep>('idle');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSource, setRestoreSource] = useState<{ type: 'file'; file: File } | { type: 'stored'; filename: string } | null>(null);
  const [restoreMode, setRestoreMode]   = useState<'replace' | 'merge'>('replace');
  const [restoreResult, setRestoreResult] = useState<Record<string, number> | null>(null);

  // Nuke state
  const [nukeStep, setNukeStep]   = useState<BackupStep>('idle');
  const [nukeError, setNukeError] = useState<string | null>(null);
  const [nukeResult, setNukeResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBackups = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/backup/list');
      if (res.ok) { const data = await res.json(); setBackups(data); }
    } finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  // ── Create backup ────────────────────────────────────────────
  async function handleCreateBackup(password: string) {
    setBackupStep('loading'); setBackupError(null);
    try {
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        setBackupError(err.error || 'Backup failed'); setBackupStep('error'); return;
      }
      // Trigger browser download
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const nameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = nameMatch?.[1] || 'bos-backup.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setBackupStep('done');
      loadBackups();
    } catch { setBackupError('Network error'); setBackupStep('error'); }
  }

  // ── Restore ──────────────────────────────────────────────────
  async function handleRestore(password: string) {
    if (!restoreSource) return;
    setRestoreStep('loading'); setRestoreError(null);
    try {
      const form = new FormData();
      form.append('password', password);
      form.append('mode', restoreMode);
      if (restoreSource.type === 'file') form.append('file', restoreSource.file);
      else form.append('filename', restoreSource.filename);

      const res = await fetch('/api/backup/restore', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setRestoreError(data.error || 'Restore failed'); setRestoreStep('error'); return; }
      setRestoreResult(data.restored);
      setRestoreStep('done');
      loadBackups();
    } catch { setRestoreError('Network error'); setRestoreStep('error'); }
  }

  // ── Nuke ─────────────────────────────────────────────────────
  async function handleNuke(password: string) {
    setNukeStep('loading'); setNukeError(null);
    try {
      const res = await fetch('/api/backup/nuke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setNukeError(data.error || 'Nuke failed'); setNukeStep('error'); return; }
      setNukeResult(data.message); setNukeStep('done');
      setBackups([]);
    } catch { setNukeError('Network error'); setNukeStep('error'); }
  }

  const sectionStyle = { display: 'flex', flexDirection: 'column' as const, gap: 16, paddingBottom: 24, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' };
  const labelStyle   = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Create Backup ─────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Create Backup</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
              Exports all your data (clients, documents, transactions, social posts, and more) to a JSON file. Brand logos are embedded as base64 — portable to any Supabase project. Backup is also stored in your private bucket.
            </p>
          </div>
          {backupStep === 'idle' && (
            <button onClick={() => { setBackupStep('confirm_password'); setBackupError(null); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', flexShrink: 0 }}>
              <HardDriveDownload size={14} /> Create Backup
            </button>
          )}
          {backupStep === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-green)', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', flexShrink: 0 }}>
              <Check size={14} /> Downloaded
              <button onClick={() => setBackupStep('idle')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)' }}>New backup</button>
            </div>
          )}
        </div>
        {backupStep === 'confirm_password' && (
          <PasswordGate
            title="Create backup" description="Downloads a full JSON backup and saves a copy to your private bucket."
            onConfirm={handleCreateBackup} onCancel={() => setBackupStep('idle')}
            loading={backupStep === 'loading'} error={backupError}
          />
        )}
        {backupStep === 'error' && backupError && (
          <div style={{ padding: '10px 14px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>
            {backupError} — <button onClick={() => setBackupStep('idle')} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, textDecoration: 'underline' }}>Try again</button>
          </div>
        )}
      </div>

      {/* ── Backup history ───────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Stored Backups</p>
        {loadingList ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Loading...</p>
        ) : backups.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>No backups stored yet. Create your first backup above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {backups.map((b, i) => (
              <div key={b.filename} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-card)', borderBottom: i < backups.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <Database size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{b.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>{formatBytes(b.size_bytes)}</p>
                </div>
                <button
                  onClick={() => { setRestoreSource({ type: 'stored', filename: b.filename }); setRestoreStep('confirm_password'); setRestoreError(null); }}
                  style={{ padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Restore from file ────────────────────────────── */}
      <div style={sectionStyle}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Restore from File</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
            Upload a backup JSON file from your computer. Choose Replace to clear existing data first, or Merge to only add rows that don't already exist.
          </p>
        </div>

        {(restoreStep === 'idle' || restoreStep === 'error') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['replace', 'merge'] as const).map(m => (
                <button key={m} onClick={() => setRestoreMode(m)}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', border: `1px solid ${restoreMode === m ? 'var(--accent-blue)' : 'var(--border-default)'}`, background: restoreMode === m ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)', color: restoreMode === m ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                  {m === 'replace' ? 'Replace (clear first)' : 'Merge (add missing)'}
                </button>
              ))}
            </div>
            {restoreMode === 'replace' && (
              <p style={{ fontSize: 11, color: 'var(--accent-amber)', fontFamily: 'var(--font-body)' }}>⚠ Replace deletes all current data before restoring. Irreversible — take a backup first.</p>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setRestoreSource({ type: 'file', file: f }); setRestoreStep('confirm_password'); setRestoreError(null); }
                }}
              />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <Upload size={13} /> Choose backup file
              </button>
              {restoreSource?.type === 'file' && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{restoreSource.file.name}</p>
              )}
            </div>
            {restoreStep === 'error' && restoreError && (
              <p style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>{restoreError}</p>
            )}
          </div>
        )}

        {restoreStep === 'confirm_password' && (
          <PasswordGate
            title={`Restore (${restoreMode} mode)`}
            description={restoreMode === 'replace'
              ? 'This will DELETE all current data then insert from the backup. This cannot be undone.'
              : 'This will insert rows from the backup that don\'t already exist. Current data is kept.'}
            danger={restoreMode === 'replace'}
            onConfirm={handleRestore}
            onCancel={() => { setRestoreStep('idle'); setRestoreSource(null); }}
            loading={restoreStep === 'loading'} error={restoreError}
          />
        )}

        {restoreStep === 'done' && restoreResult && (
          <div style={{ padding: '12px 14px', background: 'var(--accent-green-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(52,201,136,0.2)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>✓ Restore complete</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(restoreResult).filter(([, c]) => c > 0).map(([t, c]) => (
                <span key={t} style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(52,201,136,0.15)', borderRadius: 100, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                  {t}: {c}
                </span>
              ))}
            </div>
            <button onClick={() => { setRestoreStep('idle'); setRestoreSource(null); setRestoreResult(null); }}
              style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-green)', fontSize: 12, fontFamily: 'var(--font-body)', textDecoration: 'underline' }}>
              Done
            </button>
          </div>
        )}
      </div>

      {/* ── Danger zone: Nuke ────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '14px 16px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(240,82,82,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-red)', fontFamily: 'var(--font-body)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Nuke All Data
              </p>
              <p style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)', lineHeight: 1.5, opacity: 0.85 }}>
                Permanently deletes all clients, documents, transactions, leads, and every other data table. Your account is preserved — you stay logged in. <strong>There is no undo.</strong> Take a backup first.
              </p>
            </div>
            {nukeStep === 'idle' && (
              <button onClick={() => { setNukeStep('confirm_password'); setNukeError(null); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', flexShrink: 0 }}>
                <Trash2 size={13} /> Nuke All Data
              </button>
            )}
          </div>
          {nukeStep === 'confirm_password' && (
            <div style={{ marginTop: 14 }}>
              <PasswordGate
                title="Nuke all data — this cannot be undone"
                description="Deletes everything except your account. Your login is preserved."
                danger
                onConfirm={handleNuke}
                onCancel={() => setNukeStep('idle')}
                loading={nukeStep === 'loading'} error={nukeError}
              />
            </div>
          )}
          {nukeStep === 'done' && nukeResult && (
            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--accent-green)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>✓ {nukeResult}</p>
          )}
          {nukeStep === 'error' && nukeError && (
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>{nukeError}</p>
          )}
        </div>
      </div>

    </div>
  );
}
