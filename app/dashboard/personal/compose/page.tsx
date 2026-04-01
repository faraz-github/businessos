'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Button, Tabs, Textarea, Input, Select, Badge } from '@/components/ui';
import { buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import { Mail, MessageCircle, Copy, ExternalLink, Check } from 'lucide-react';
import type { Client, BrandProfile } from '@/types';

const emailTemplates = [
  { value: 'initial_outreach', label: 'Initial Outreach' },
  { value: 'proposal_followup', label: 'Proposal Follow-up' },
  { value: 'contract_followup', label: 'Contract Follow-up' },
  { value: 'invoice_reminder', label: 'Invoice Reminder' },
  { value: 'project_update', label: 'Project Update' },
  { value: 'project_delivery', label: 'Project Delivery' },
  { value: 'support_ending', label: 'Support Period Ending' },
  { value: 'feedback_request', label: 'Feedback Request' },
  { value: 'recommendation', label: 'Recommendation Request' },
];

function generateTemplate(template: string, client: Client | null, brand: BrandProfile | null, channel: 'email' | 'whatsapp'): { subject: string; body: string } {
  const name = client?.contact_name || client?.name || '[Client Name]';
  const biz = brand?.business_name || '[Your Business]';
  const isConversational = channel === 'whatsapp' || brand?.tone === 'conversational';

  const templates: Record<string, { subject: string; body: string }> = {
    initial_outreach: {
      subject: `${biz} — Let's work together`,
      body: isConversational
        ? `Hey ${name}! 👋\n\nI came across your work and I think there's a great opportunity for us to collaborate. I specialize in building premium digital experiences.\n\nWould love to chat about what you're working on — are you free for a quick call this week?\n\nCheers,\n${biz}`
        : `Dear ${name},\n\nI hope this message finds you well. I wanted to reach out regarding a potential collaboration opportunity.\n\nAt ${biz}, we specialize in building premium digital experiences. I believe there's a strong alignment between what you're looking for and what we deliver.\n\nWould you be available for a brief call this week to discuss further?\n\nBest regards,\n${biz}`,
    },
    proposal_followup: {
      subject: `Following up on the proposal — ${biz}`,
      body: isConversational
        ? `Hey ${name}!\n\nJust checking in on the proposal I sent over. Have you had a chance to look through it?\n\nHappy to jump on a quick call if you have any questions or want to discuss anything.\n\nLet me know! 🙂\n${biz}`
        : `Dear ${name},\n\nI wanted to follow up on the proposal I shared with you recently. I hope you've had an opportunity to review it.\n\nPlease don't hesitate to reach out if you have any questions or would like to discuss any aspect of the proposal in detail.\n\nLooking forward to hearing from you.\n\nBest regards,\n${biz}`,
    },
    contract_followup: {
      subject: `Contract status — ${biz}`,
      body: `Hi ${name},\n\nJust a gentle reminder about the contract I sent over. Once we have your signature, we can get started right away.\n\nLet me know if you need any changes or have questions.\n\nBest,\n${biz}`,
    },
    invoice_reminder: {
      subject: `Invoice reminder — ${biz}`,
      body: `Hi ${name},\n\nThis is a friendly reminder about the pending invoice. I'd appreciate it if you could process the payment at your earliest convenience.\n\nPlease let me know if you need the invoice resent or have any questions about the amount.\n\nThank you,\n${biz}`,
    },
    project_update: {
      subject: `Project update — ${biz}`,
      body: `Hi ${name},\n\nHere's a quick update on where things stand with your project:\n\n• [Update 1]\n• [Update 2]\n• [Next milestone]\n\nEverything is on track. I'll share the next update on [date].\n\nBest,\n${biz}`,
    },
    project_delivery: {
      subject: `Project delivered! — ${biz}`,
      body: `Hi ${name},\n\nGreat news — your project is complete and ready for your review!\n\nI've prepared a delivery document with all the details, credentials, and next steps. You'll find everything you need there.\n\nPlease take a look and let me know if you have any questions.\n\nIt's been a pleasure working on this with you.\n\nBest,\n${biz}`,
    },
    support_ending: {
      subject: `Support period update — ${biz}`,
      body: `Hi ${name},\n\nI wanted to let you know that your support period will be ending soon.\n\nIt's been wonderful working with you on this project. If you'd like to extend support or discuss future projects, I'd love to chat.\n\nThank you for trusting ${biz} with your project.\n\nWarm regards,\n${biz}`,
    },
    feedback_request: {
      subject: `Would love your feedback — ${biz}`,
      body: `Hi ${name},\n\nNow that the project is complete, I'd really value your honest feedback on the experience.\n\nA few words about what worked well and anything that could be improved would go a long way in helping me serve future clients better.\n\nThank you so much for your time!\n\nBest,\n${biz}`,
    },
    recommendation: {
      subject: `Quick favour — ${biz}`,
      body: `Hi ${name},\n\nI hope you're doing well! I wanted to ask if you'd be open to writing a brief recommendation or testimonial about our work together.\n\nEven a few sentences about your experience would mean a lot and help others feel confident about working with ${biz}.\n\nCompletely understand if you're busy — no pressure at all.\n\nThank you,\n${biz}`,
    },
  };

  return templates[template] || { subject: '', body: '' };
}

export default function PersonalComposePage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [template, setTemplate] = useState('initial_outreach');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  const supabase = createClient();
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  useEffect(() => {
    async function fetchClients() {
      const user = currentUser;
      if (!user) return;
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).eq('mode', mode);
      setClients((data as Client[]) || []);
    }
    fetchClients();
  }, [mode, supabase]);

  useEffect(() => {
    const result = generateTemplate(template, selectedClient, brand, channel);
    setSubject(result.subject);
    setBody(result.body);
  }, [template, selectedClient, brand, channel]);

  function handleCopy() {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpen() {
    if (channel === 'email') {
      const email = selectedClient?.contact_email || '';
      window.open(buildMailtoLink(email, subject, body), '_blank');
    } else {
      const phone = selectedClient?.contact_phone || '';
      window.open(buildWhatsAppLink(phone, body), '_blank');
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Composers</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">Generate professional messages from templates.</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Controls */}
          <div className="space-y-4">
            <Tabs
              tabs={[
                { value: 'email', label: '✉️ Email' },
                { value: 'whatsapp', label: '💬 WhatsApp' },
              ]}
              value={channel}
              onChange={(v) => setChannel(v as any)}
            />

            <Select
              label="Template"
              options={emailTemplates}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />

            <Select
              label="Client"
              placeholder="Select a client..."
              options={[
                { value: '', label: 'No client selected' },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            />

            {selectedClient && (
              <Card variant="base" className="text-[12px]">
                <p className="font-medium text-[var(--text-primary)]">{selectedClient.name}</p>
                {selectedClient.contact_email && <p className="text-[var(--text-secondary)]">{selectedClient.contact_email}</p>}
                {selectedClient.contact_phone && <p className="text-[var(--text-secondary)]">{selectedClient.contact_phone}</p>}
              </Card>
            )}
          </div>

          {/* Composer */}
          <div className="col-span-2 space-y-3">
            {channel === 'email' && (
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            )}
            <Textarea
              label="Message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[320px] font-body text-[13px] leading-relaxed"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy text'}
              </Button>
              <Button
                icon={channel === 'email' ? <Mail size={14} /> : <MessageCircle size={14} />}
                onClick={handleOpen}
              >
                {channel === 'email' ? 'Open in Mail' : 'Open in WhatsApp'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
