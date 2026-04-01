'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { brandProfileSchema, type BrandProfileFormData } from '@/types/schemas';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Button, Input, Select, Tabs, Badge } from '@/components/ui';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ALL_SECTIONS } from '@/lib/auth/session';
import {
  Save, Upload, Check, Plus, UserCog, User,
  Shield, Pencil, X, RefreshCw, Power,
} from 'lucide-react';
import type { Mode } from '@/types';

// ─── TYPES ───
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin';
  allowed_personal: string[] | null;
  allowed_agency: string[] | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// ─── SECTION LABELS ───
const SECTION_LABELS: Record<string, string> = {
  home: 'Home', social: 'Social & Brand', compose: 'Composers',
  paperwork: 'Paperwork', clients: 'All Clients', feedback: 'Feedback',
  support: 'Support', finance: 'Finance', 'bd-pipeline': 'BD Pipeline',
};

// ─── ACCESS SELECTOR COMPONENT ───
function AccessSelector({
  allowedPersonal, allowedAgency,
  onChangePersonal, onChangeAgency,
}: {
  allowedPersonal: string[] | null;
  allowedAgency: string[] | null;
  onChangePersonal: (v: string[] | null) => void;
  onChangeAgency: (v: string[] | null) => void;
}) {
  const personalOn = allowedPersonal !== null;
  const agencyOn = allowedAgency !== null;

  function toggleMode(mode: 'personal' | 'agency') {
    if (mode === 'personal') {
      onChangePersonal(personalOn ? null : [...ALL_SECTIONS.personal]);
    } else {
      onChangeAgency(agencyOn ? null : [...ALL_SECTIONS.agency]);
    }
  }

  function toggleSection(mode: 'personal' | 'agency', section: string) {
    if (mode === 'personal' && allowedPersonal !== null) {
      const next = allowedPersonal.includes(section)
        ? allowedPersonal.filter((s) => s !== section)
        : [...allowedPersonal, section];
      onChangePersonal(next.length ? next : null);
    }
    if (mode === 'agency' && allowedAgency !== null) {
      const next = allowedAgency.includes(section)
        ? allowedAgency.filter((s) => s !== section)
        : [...allowedAgency, section];
      onChangeAgency(next.length ? next : null);
    }
  }

  const modeBlock = (
    mode: 'personal' | 'agency',
    isOn: boolean,
    allowed: string[] | null,
    sections: readonly string[],
  ) => (
    <div style={{
      border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* Mode toggle header */}
      <button
        type="button"
        onClick={() => toggleMode(mode)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 14px',
          background: isOn ? 'var(--accent-blue-dim)' : 'var(--bg-hover)',
          border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: isOn ? 'var(--accent-blue)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          textTransform: 'capitalize',
        }}>
          {mode} Mode
        </span>
        <div style={{
          width: 32, height: 18, borderRadius: 9,
          background: isOn ? 'var(--accent-blue)' : 'var(--border-strong)',
          position: 'relative', transition: 'background 150ms',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: isOn ? 16 : 2,
            width: 14, height: 14, borderRadius: '50%', background: '#fff',
            transition: 'left 150ms',
          }} />
        </div>
      </button>
      {/* Section checkboxes */}
      {isOn && (
        <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sections.map((section) => {
            const checked = allowed?.includes(section) ?? false;
            return (
              <button
                key={section}
                type="button"
                onClick={() => toggleSection(mode, section)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 100,
                  border: `1px solid ${checked ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                  background: checked ? 'var(--accent-blue-dim)' : 'transparent',
                  color: checked ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 500,
                  fontFamily: 'var(--font-body)', cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                {SECTION_LABELS[section] || section}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {modeBlock('personal', personalOn, allowedPersonal, ALL_SECTIONS.personal)}
      {modeBlock('agency', agencyOn, allowedAgency, ALL_SECTIONS.agency)}
    </div>
  );
}

// ─── CREATE/EDIT MEMBER MODAL ───
function MemberModal({
  member, onClose, onSaved,
}: {
  member?: TeamMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!member;
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [password, setPassword] = useState('');
  const [allowedPersonal, setAllowedPersonal] = useState<string[] | null>(
    member?.allowed_personal ?? null,
  );
  const [allowedAgency, setAllowedAgency] = useState<string[] | null>(
    member?.allowed_agency ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    if (!isEdit && !password.trim()) { setError('Password is required for new members'); return; }
    setSaving(true);
    setError('');
    try {
      const url = isEdit ? `/api/users/${member!.id}` : '/api/users';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        name, email, role: 'admin',
        allowedPersonal, allowedAgency,
      };
      if (password) body.password = password;

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      onSaved();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800,
            color: 'var(--text-primary)', letterSpacing: '-0.3px',
          }}>
            {isEdit ? 'Edit Team Member' : 'Add Team Member'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', display: 'flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <Input
            label={isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? '••••••••' : 'Minimum 8 characters'}
          />

          <div>
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-body)', marginBottom: 10,
            }}>
              Access Control
            </p>
            <AccessSelector
              allowedPersonal={allowedPersonal}
              allowedAgency={allowedAgency}
              onChangePersonal={setAllowedPersonal}
              onChangeAgency={setAllowedAgency}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
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
  const [resettingId, setResettingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/users');
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function toggleActive(member: TeamMember) {
    await fetch(`/api/users/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !member.is_active }),
    });
    fetchMembers();
  }

  const nonSuperAdmins = members.filter((m) => m.role !== 'superadmin');
  const me = members.find((m) => m.role === 'superadmin');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
            Team & Access
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-body)' }}>
            Manage who can access the platform and what they can see.
          </p>
        </div>
        <Button icon={<Plus size={13} />} onClick={() => { setEditingMember(null); setShowModal(true); }}>
          Add Member
        </Button>
      </div>

      {/* SuperAdmin row (read-only) */}
      {me && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--accent-blue-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={16} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                  {me.name}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 100,
                  background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)',
                }}>
                  SuperAdmin
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 1 }}>
                {me.email} · Full access · Cannot be modified
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team members */}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Loading...</p>
      ) : nonSuperAdmins.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '32px 20px', textAlign: 'center',
        }}>
          <UserCog size={32} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
            No team members yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-body)' }}>
            Add a team member to grant them access to the platform.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nonSuperAdmins.map((member) => (
            <div key={member.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', padding: '14px 16px',
              opacity: member.is_active ? 1 : 0.5,
              transition: 'opacity 200ms',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: member.is_active ? 'var(--accent-violet-dim)' : 'var(--bg-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--accent-violet)',
                  fontFamily: 'var(--font-display)',
                }}>
                  {member.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                      {member.name}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 100,
                      background: 'var(--accent-violet-dim)', color: 'var(--accent-violet)',
                    }}>
                      {member.role}
                    </span>
                    {!member.is_active && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 100,
                        background: 'var(--accent-red-dim)', color: 'var(--accent-red)',
                      }}>
                        Inactive
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
                    {member.email}
                    {member.last_login_at && ` · Last login: ${new Date(member.last_login_at).toLocaleDateString('en-IN')}`}
                  </p>
                  {/* Access summary */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {member.allowed_personal && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 100,
                        background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-body)',
                      }}>
                        Personal: {member.allowed_personal.length} sections
                      </span>
                    )}
                    {member.allowed_agency && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 100,
                        background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-body)',
                      }}>
                        Agency: {member.allowed_agency.length} sections
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => { setEditingMember(member); setShowModal(true); }}
                    title="Edit"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      background: 'transparent', color: 'var(--text-secondary)',
                      fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => toggleActive(member)}
                    title={member.is_active ? 'Deactivate' : 'Reactivate'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${member.is_active ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)'}`,
                      background: member.is_active ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)',
                      color: member.is_active ? 'var(--accent-red)' : 'var(--accent-green)',
                      fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    <Power size={12} />
                    {member.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <MemberModal
          member={editingMember}
          onClose={() => { setShowModal(false); setEditingMember(null); }}
          onSaved={fetchMembers}
        />
      )}
    </div>
  );
}

// ─── BRAND SETTINGS TAB (preserved from original) ───
function BrandTab() {
  const { mode, personalBrand, agencyBrand, refreshBrand } = useBrand();
  const [activeMode, setActiveMode] = useState<Mode>(mode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const brand = activeMode === 'personal' ? personalBrand : agencyBrand;
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<BrandProfileFormData>({
    resolver: zodResolver(brandProfileSchema),
    defaultValues: {
      mode: activeMode,
      primary_colour: brand?.primary_colour || '#4F8EF7',
      secondary_colour: brand?.secondary_colour || '#8B6CF7',
      font_choice: brand?.font_choice || 'DM Sans',
      tone: brand?.tone || 'confident',
      business_name: brand?.business_name || '',
    },
  });

  const primaryColour = watch('primary_colour');
  const secondaryColour = watch('secondary_colour');

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
    } catch (err) {
      console.error('Brand save error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Tabs
          tabs={[{ value: 'personal', label: 'Personal' }, { value: 'agency', label: 'Agency' }]}
          value={activeMode}
          onChange={(v) => { setActiveMode(v as Mode); setValue('mode', v as Mode); }}
        />
        <input type="hidden" {...register('mode')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Business Name" {...register('business_name')} error={errors.business_name?.message} />
            <Input label="Tagline" {...register('tagline')} />
            <Input label="Email" type="email" {...register('email')} />
            <Input label="Phone" {...register('phone')} />
            <Input label="Website" {...register('website')} />
            <Input label="GST Number" {...register('gst_number')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ColorPicker label="Primary Colour" value={primaryColour} onChange={(v) => setValue('primary_colour', v)} />
            <ColorPicker label="Secondary Colour" value={secondaryColour} onChange={(v) => setValue('secondary_colour', v)} />
            <Select
              label="Tone of Voice"
              {...register('tone')}
              options={[
                { value: 'confident', label: 'Confident' },
                { value: 'conversational', label: 'Conversational' },
                { value: 'formal', label: 'Formal' },
              ]}
            />
            <Input label="Bank Name" {...register('bank_name')} />
            <Input label="Account Number" {...register('bank_account_number')} />
            <Input label="IFSC Code" {...register('bank_ifsc')} />
            <Input label="UPI" {...register('bank_upi')} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" loading={saving} icon={saved ? <Check size={13} /> : <Save size={13} />}>
            {saved ? 'Saved!' : 'Save Brand'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── MAIN PAGE ───
export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'team' ? 'team' : 'brand';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { user } = useCurrentUser();

  if (!user) return null;

  const tabs = [
    { value: 'brand', label: 'Brand Settings' },
    ...(user.role === 'superadmin' ? [{ value: 'team', label: 'Team & Access' }] : []),
  ];

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
            letterSpacing: '-0.5px', color: 'var(--text-primary)',
          }}>
            Settings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, fontFamily: 'var(--font-body)' }}>
            Manage your brand and team access.
          </p>
        </div>
        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
        <Card variant="base">
          {activeTab === 'brand' && <BrandTab />}
          {activeTab === 'team' && user.role === 'superadmin' && <TeamTab />}
        </Card>
      </div>
    </PageTransition>
  );
}
