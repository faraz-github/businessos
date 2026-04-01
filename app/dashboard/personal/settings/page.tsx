'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { brandProfileSchema, type BrandProfileFormData } from '@/types/schemas';
import { useBrand } from '@/lib/brand';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Button, Input, Textarea, Select, Tabs, Badge } from '@/components/ui';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { useAutoSave } from '@/hooks/use-auto-save';
import { Save, Upload, Check } from 'lucide-react';
import type { Mode, BrandProfile } from '@/types';

export default function BrandSettingsPage() {
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
      tagline: brand?.tagline || '',
      phone: brand?.phone || '',
      whatsapp: brand?.whatsapp || '',
      email: brand?.email || '',
      website: brand?.website || '',
      address: brand?.address || '',
      gst_number: brand?.gst_number || '',
      bank_name: brand?.bank_name || '',
      bank_account_number: brand?.bank_account_number || '',
      bank_ifsc: brand?.bank_ifsc || '',
      bank_upi: brand?.bank_upi || '',
    },
  });

  const formValues = watch();

  // Reset form when switching mode
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
      whatsapp: b?.whatsapp || '',
      email: b?.email || '',
      website: b?.website || '',
      address: b?.address || '',
      gst_number: b?.gst_number || '',
      bank_name: b?.bank_name || '',
      bank_account_number: b?.bank_account_number || '',
      bank_ifsc: b?.bank_ifsc || '',
      bank_upi: b?.bank_upi || '',
    });
  }, [activeMode, personalBrand, agencyBrand, reset]);

  // Auto-save
  useAutoSave({
    data: formValues,
    onSave: async (data) => {
      await saveBrand(data as BrandProfileFormData);
    },
    interval: 30000,
  });

  async function saveBrand(data: BrandProfileFormData) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('brand_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('mode', data.mode)
        .single();

      if (existing) {
        await supabase.from('brand_profiles').update(data).eq('id', existing.id);
      } else {
        await supabase.from('brand_profiles').insert({ ...data, user_id: user.id });
      }

      await refreshBrand();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = file.name.split('.').pop();
      const path = `${user.id}/${activeMode}-logo.${ext}`;

      await supabase.storage.from('brand-logos').upload(path, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('brand-logos').getPublicUrl(path);

      await supabase.from('brand_profiles').update({ logo_url: publicUrl }).eq('user_id', user.id).eq('mode', activeMode);
      await refreshBrand();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Brand Settings</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Configure your personal and agency brand profiles.</p>
          </div>
          <Button
            icon={saved ? <Check size={14} /> : <Save size={14} />}
            loading={saving}
            onClick={handleSubmit((data) => saveBrand(data))}
          >
            {saved ? 'Saved!' : 'Save'}
          </Button>
        </div>

        <Tabs
          tabs={[
            { value: 'personal', label: 'Personal Brand' },
            { value: 'agency', label: 'Agency Brand' },
          ]}
          value={activeMode}
          onChange={(v) => setActiveMode(v as Mode)}
        />

        <form onSubmit={handleSubmit(saveBrand)} className="space-y-6">
          <input type="hidden" {...register('mode')} value={activeMode} />

          {/* Logo & Identity */}
          <Card variant="elevated">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Identity</h2>
            <div className="flex items-start gap-6">
              {/* Logo */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-[var(--radius-lg)] border border-[var(--border-default)] flex items-center justify-center overflow-hidden bg-[var(--bg-surface)]">
                  {brand?.logo_url ? (
                    <img src={brand.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-[var(--text-tertiary)]">{(formValues.business_name || '?')[0]}</span>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <span className="text-[11px] text-[var(--accent-blue)] hover:underline flex items-center gap-1">
                    <Upload size={10} /> {uploading ? 'Uploading...' : 'Upload logo'}
                  </span>
                </label>
              </div>

              <div className="flex-1 space-y-3">
                <Input label="Business Name" {...register('business_name')} error={errors.business_name?.message} placeholder="Your name or business" />
                <Input label="Tagline" {...register('tagline')} placeholder="A short description" />
              </div>
            </div>
          </Card>

          {/* Colours & Style */}
          <Card variant="elevated">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Colours & Style</h2>
            <div className="grid grid-cols-2 gap-6">
              <ColorPicker label="Primary Colour" value={formValues.primary_colour} onChange={(v) => setValue('primary_colour', v)} />
              <ColorPicker label="Secondary Colour" value={formValues.secondary_colour} onChange={(v) => setValue('secondary_colour', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Select
                label="Font Choice"
                {...register('font_choice')}
                options={[
                  { value: 'DM Sans', label: 'DM Sans' },
                  { value: 'Inter', label: 'Inter' },
                  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
                  { value: 'Outfit', label: 'Outfit' },
                  { value: 'Manrope', label: 'Manrope' },
                ]}
              />
              <Select
                label="Tone of Voice"
                {...register('tone')}
                options={[
                  { value: 'formal', label: 'Formal' },
                  { value: 'conversational', label: 'Conversational' },
                  { value: 'confident', label: 'Confident' },
                ]}
              />
            </div>
          </Card>

          {/* Contact Details */}
          <Card variant="elevated">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Contact Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Phone" {...register('phone')} />
              <Input label="WhatsApp" {...register('whatsapp')} placeholder="With country code" />
              <Input label="Website" {...register('website')} error={errors.website?.message} placeholder="https://" />
            </div>
            <div className="mt-4">
              <Textarea label="Address" {...register('address')} className="min-h-[60px]" />
            </div>
          </Card>

          {/* Banking & GST */}
          <Card variant="elevated">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Banking & GST</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="GST Number" {...register('gst_number')} />
              <Input label="Bank Name" {...register('bank_name')} />
              <Input label="Account Number" {...register('bank_account_number')} />
              <Input label="IFSC Code" {...register('bank_ifsc')} />
              <Input label="UPI ID" {...register('bank_upi')} />
            </div>
          </Card>

          {/* Preview */}
          <Card variant="base">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-3">Brand Preview</h2>
            <div className="flex items-center gap-4 p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
              <div
                className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center text-white font-bold text-lg"
                style={{ background: formValues.primary_colour }}
              >
                {(formValues.business_name || '?')[0]}
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">{formValues.business_name || 'Your Business'}</p>
                <p className="text-[12px] text-[var(--text-secondary)]">{formValues.tagline || 'Your tagline here'}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <div className="w-6 h-6 rounded-full" style={{ background: formValues.primary_colour }} />
                <div className="w-6 h-6 rounded-full" style={{ background: formValues.secondary_colour }} />
              </div>
            </div>
          </Card>
        </form>
      </div>
    </PageTransition>
  );
}
