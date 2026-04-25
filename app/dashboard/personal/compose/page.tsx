'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Input, Select } from '@/components/ui';
import { buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import { Mail, MessageCircle, Copy, Check, Linkedin, RotateCcw } from 'lucide-react';
import type { Client, BrandProfile } from '@/types';

/* ── Templates grouped by workflow stage ─────────────────────── */
// channel: 'linkedin' = only shown on LinkedIn channel
//          'client'   = shown on Email + WhatsApp
//          'all'      = shown everywhere
// usesLink: template body contains a document/link placeholder
type Channel = 'email' | 'whatsapp' | 'linkedin';
const TEMPLATES: {
  group: string;
  channel: 'linkedin' | 'client' | 'all';
  items: { value: string; label: string; usesLink?: boolean }[];
}[] = [
  { group: 'Outreach',          channel: 'linkedin', items: [
    { value: 'li_intro',    label: 'Connection + Intro' },
    { value: 'li_followup', label: 'Follow-up (no reply)' },
    { value: 'li_qualify',  label: 'Qualify Interest' },
  ]},
  { group: 'Proposal', channel: 'client', items: [
    { value: 'proposal_send',     label: 'Sending a Proposal',  usesLink: true },
    { value: 'proposal_followup', label: 'Proposal Follow-up' },
  ]},
  { group: 'Contracting', channel: 'client', items: [
    { value: 'contract_send',     label: 'Contract + SOW Ready',       usesLink: true },
    { value: 'contract_followup', label: 'Contract Follow-up' },
    { value: 'upfront_request',   label: 'Upfront Payment Request',    usesLink: true },
  ]},
  { group: 'Kickoff', channel: 'client', items: [
    { value: 'kickoff',             label: 'Project Kickoff' },
    { value: 'credentials_request', label: 'Credentials Request' },
    { value: 'requirements_send',   label: 'Requirements Doc Ready', usesLink: true },
  ]},
  { group: 'Active Work', channel: 'client', items: [
    { value: 'milestone_update', label: 'Milestone / Weekly Update' },
    { value: 'feedback_collect', label: 'Collecting Feedback' },
  ]},
  { group: 'Delivery & Payment', channel: 'client', items: [
    { value: 'delivery',         label: 'Project Delivery',        usesLink: true },
    { value: 'final_invoice',    label: 'Final Invoice + Payment', usesLink: true },
    { value: 'invoice_reminder', label: 'Invoice Reminder' },
  ]},
  { group: 'Post-project', channel: 'client', items: [
    { value: 'handover',         label: 'Handover Confirmation' },
    { value: 'feedback_request', label: 'Feedback Request' },
    { value: 'reengagement',     label: 'Re-engagement' },
    { value: 'recommendation',   label: 'Recommendation Request' },
  ]},
];

// Templates visible for the current channel
function visibleTemplates(channel: Channel) {
  return TEMPLATES.filter(g =>
    channel === 'linkedin' ? g.channel === 'linkedin' : g.channel !== 'linkedin'
  );
}

// Default template key per channel
const DEFAULT_TEMPLATE: Record<Channel, string> = {
  linkedin: 'li_intro',
  email:    'proposal_send',
  whatsapp: 'proposal_send',
};

/* ── Template generator ───────────────────────────────────────── */
function generateTemplate(
  key: string,
  client: Client | null,
  brand: BrandProfile | null,
  channel: 'email' | 'whatsapp' | 'linkedin',
  vars: { projectName: string; docLink: string; extra: string }
): { subject: string; body: string } {
  const cn   = client?.contact_name || client?.name || '[Client Name]';
  const biz  = brand?.business_name || '[Your Name]';
  const proj = vars.projectName || client?.name || '[Project Name]';
  const link = vars.docLink || '[Document link]';
  const svc  = client?.service_type ? svcLabel(client.service_type) : 'web development and design';
  const short = channel !== 'email';

  const T: Record<string, { subject: string; body: string }> = {

    /* LinkedIn */
    li_intro: {
      subject: '',
      body: short
        ? `Hi ${cn}! I noticed you're looking for a developer / designer. I specialise in ${svc} — from idea to deployment. Would love to connect and see if I can help. 🙂`
        : `Hi ${cn},\n\nI came across your post and wanted to reach out — I specialise in ${svc} and full project delivery.\n\nI'd love to hear more about what you're building and see if there's a fit.\n\nBest,\n${biz}`,
    },
    li_followup: {
      subject: '',
      body: `Hi ${cn}, just following up on my earlier message — still happy to chat if you're looking for a developer or designer. No pressure at all!`,
    },
    li_qualify: {
      subject: '',
      body: `Hi ${cn}, great to connect! I'd love to understand more about your project — what are you building, and what's your timeline looking like? Happy to jump on a quick call too.`,
    },

    /* Proposal */
    proposal_send: {
      subject: `Proposal — ${biz}`,
      body: short
        ? `Hey ${cn}, I've put together the proposal for your ${proj} project. Please find it here: ${link} — happy to answer any questions! 😊`
        : `Hi ${cn},\n\nThank you for taking the time to chat — it was great learning about the ${proj} project.\n\nI've put together a detailed proposal covering the scope, timeline, and investment. Please find it here:\n${link}\n\nHappy to answer any questions or jump on a call to walk through it together.\n\nBest,\n${biz}`,
    },
    proposal_followup: {
      subject: `Following up on the proposal — ${biz}`,
      body: short
        ? `Hey ${cn}, just checking in on the proposal I sent for ${proj}. Had a chance to look through it? Happy to answer any questions!`
        : `Hi ${cn},\n\nI wanted to follow up on the proposal I shared for ${proj}. Have you had a chance to review it?\n\nI'm happy to adjust anything or clarify further — just say the word.\n\nLooking forward to hearing from you.\n\nBest,\n${biz}`,
    },

    /* Contracting */
    contract_send: {
      subject: `Contract & Scope of Work — ${proj}`,
      body: short
        ? `Hey ${cn}, the contract and SOW for ${proj} are ready for your signature: ${link} — once signed we're ready to go! 🚀`
        : `Hi ${cn},\n\nExcited to move forward on ${proj}! I've prepared the Contract and Scope of Work for your review and signature:\n${link}\n\nOnce signed, I'll send the upfront payment invoice so we can kick things off.\n\nLet me know if you have any questions.\n\nBest,\n${biz}`,
    },
    contract_followup: {
      subject: `Contract status — ${proj}`,
      body: short
        ? `Hi ${cn}, just a gentle nudge on the contract for ${proj} — whenever you're ready to sign, we're good to go!`
        : `Hi ${cn},\n\nJust checking in on the contract for ${proj}. Once we have your signature, we can get started right away.\n\nLet me know if anything needs to be adjusted.\n\nBest,\n${biz}`,
    },
    upfront_request: {
      subject: `Upfront payment — ${proj}`,
      body: short
        ? `Hey ${cn}, thank you for signing the contract! Here's the upfront payment invoice: ${link} — once received, I'll get started immediately. 🙏`
        : `Hi ${cn},\n\nThank you for signing the contract for ${proj}! Please find the upfront payment invoice here:\n${link}\n\nPayment details are included. Once received, I'll get started immediately.\n\nLooking forward to working with you!\n\nBest,\n${biz}`,
    },

    /* Kickoff */
    kickoff: {
      subject: `Project kickoff — ${proj}`,
      body: short
        ? `Hey ${cn}, payment received — we're officially started on ${proj}! 🎉 I'll send the requirements doc shortly.`
        : `Hi ${cn},\n\nPayment received — we're officially started on ${proj}! 🎉\n\nHere's how we'll proceed:\n• I'll send over the requirements document for you to fill in\n• I'll need access to relevant accounts (domain, hosting, etc.)\n• I'll share updates at each milestone\n\nLet me know if you have any questions as we get going.\n\nBest,\n${biz}`,
    },
    credentials_request: {
      subject: `Project access needed — ${proj}`,
      body: short
        ? `Hey ${cn}, to get started on ${proj}, I'll need access to your domain registrar, hosting account, and any existing platform logins. Can we sort that out? 😊`
        : `Hi ${cn},\n\nTo get started on the technical side of ${proj}, I'll need access to:\n\n• Domain registrar (e.g., GoDaddy, Namecheap)\n• Hosting account (e.g., Hostinger, cPanel)\n• Any existing CMS or platform logins\n• Email accounts to be configured (if applicable)\n\nYou can share credentials securely over WhatsApp, or we can set it up together on a call.\n\nBest,\n${biz}`,
    },
    requirements_send: {
      subject: `Requirements document — ${proj}`,
      body: short
        ? `Hey ${cn}, I've sent the requirements doc for ${proj}. Please fill in as much detail as possible: ${link} 🙏`
        : `Hi ${cn},\n\nI've prepared a requirements document for ${proj} to make sure I fully understand your vision before I start building.\n\nPlease fill in as much detail as possible:\n${link}\n\nLet me know once you've completed it or if you'd prefer to go through it together on a call.\n\nBest,\n${biz}`,
    },

    /* Active Work */
    milestone_update: {
      subject: `${proj} — project update`,
      body: short
        ? `Hey ${cn}, quick update on ${proj} — making great progress! I'll share a preview soon. Let me know if you have any questions!`
        : `Hi ${cn},\n\nHere's a quick update on ${proj}:\n\n✅ Completed:\n• [Item 1]\n• [Item 2]\n\n🔄 In progress:\n• [Item 3]\n\n📅 Next milestone: [date/deliverable]\n\nEverything is on track. Let me know if you'd like to review what's been done so far.\n\nBest,\n${biz}`,
    },
    feedback_collect: {
      subject: `${proj} — review requested`,
      body: short
        ? `Hey ${cn}, I've shared the latest version of ${proj} for your review. Let me know your thoughts — any changes you'd like?`
        : `Hi ${cn},\n\nI've completed the latest milestone on ${proj} and would love your feedback before moving on.\n\n[Preview / staging link]\n\nPlease review and let me know:\n1. What's looking good\n2. Any changes you'd like\n3. Anything you'd like added or removed\n\nBest,\n${biz}`,
    },

    /* Delivery & Payment */
    delivery: {
      subject: `${proj} is ready! 🎉`,
      body: short
        ? `Hey ${cn}, ${proj} is complete and ready for you! 🎉 Here's everything: ${link} — please review and let me know your thoughts!`
        : `Hi ${cn},\n\nI'm thrilled to let you know that ${proj} is complete! 🎉\n\nI've prepared a full delivery document covering:\n• All deliverables with links\n• Credentials being handed over\n• Usage and maintenance notes\n• Support period details\n\n${link}\n\nPlease review everything and let me know if you have any questions.\n\nIt's been a real pleasure working on this with you.\n\nBest,\n${biz}`,
    },
    final_invoice: {
      subject: `Final invoice — ${proj}`,
      body: short
        ? `Hey ${cn}, as ${proj} is complete, here's the final invoice: ${link} — once payment is received, I'll transfer all files and credentials. Thank you! 🙏`
        : `Hi ${cn},\n\nAs ${proj} is complete, please find the final invoice here:\n${link}\n\nOnce payment is received, I'll transfer all code, files, and credentials to your accounts in full.\n\nThank you for being a great client to work with!\n\nBest,\n${biz}`,
    },
    invoice_reminder: {
      subject: `Invoice reminder — ${proj}`,
      body: short
        ? `Hi ${cn}, friendly reminder about the pending invoice for ${proj}. Please let me know if you need it resent!`
        : `Hi ${cn},\n\nThis is a gentle reminder about the pending invoice for ${proj}. I'd appreciate it if you could process the payment at your earliest convenience.\n\nPlease let me know if you need the invoice resent or have any questions.\n\nThank you,\n${biz}`,
    },

    /* Post-project */
    handover: {
      subject: `${proj} — handover complete`,
      body: short
        ? `Hey ${cn}, all files, code, and credentials for ${proj} have been transferred — everything is fully yours now. It's been a pleasure! 🙏`
        : `Hi ${cn},\n\nAll code, files, and credentials for ${proj} have now been transferred to your accounts — everything is fully yours.\n\nA few reminders:\n• Keep your domain and hosting renewed\n• Back up your site/app regularly\n• I'm available for support for [X] days\n\nThank you for trusting ${biz} with your project.\n\nBest,\n${biz}`,
    },
    feedback_request: {
      subject: `A quick favour — ${biz}`,
      body: short
        ? `Hey ${cn}, hope everything's going well with ${proj}! Would you be willing to share a few words about our experience working together? It really helps me a lot. 🙏`
        : `Hi ${cn},\n\nI hope ${proj} is going well!\n\nNow that we've wrapped up, I'd genuinely appreciate your honest feedback — what worked well and what could be better.\n\nEven a few sentences would mean a lot. You can simply reply to this email.\n\nThank you so much,\n${biz}`,
    },
    reengagement: {
      subject: `Checking in — ${biz}`,
      body: short
        ? `Hey ${cn}! It's been a while — hope everything's going well with ${proj}. If you ever need anything or have new ideas to build, I'm here. 😊`
        : `Hi ${cn},\n\nI hope things are going great! I wanted to check in and see how ${proj} is holding up.\n\nIf you ever need updates, new features, or want to start something new — I'd love to be involved.\n\nJust reply to this email or message me anytime.\n\nWarm regards,\n${biz}`,
    },
    recommendation: {
      subject: `A small favour — ${biz}`,
      body: short
        ? `Hey ${cn}, would you be open to leaving a quick recommendation about our work on ${proj}? Even 2–3 sentences helps massively. No pressure at all! 🙏`
        : `Hi ${cn},\n\nI hope you're doing well! I wanted to ask if you'd be open to writing a brief recommendation or testimonial about our work on ${proj}.\n\nEven a few sentences on LinkedIn or via email would mean a lot.\n\nAbsolutely no pressure — completely your call.\n\nThank you,\n${biz}`,
    },
  };

  return T[key] || { subject: '', body: '' };
}

function svcLabel(v: string | null) {
  const map: Record<string, string> = {
    web_dev: 'web development', app_dev: 'app development',
    web_design: 'UI/UX design', logo: 'logo design',
    branding: 'branding', seo: 'SEO',
    digital_mkt: 'digital marketing', other: 'development and design',
  };
  return v ? (map[v] || 'development and design') : 'web development and design';
}

/* ── PAGE ─────────────────────────────────────────────────────── */
export default function PersonalComposePage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [channel, setChannel]           = useState<'email' | 'whatsapp' | 'linkedin'>('email');
  const [templateKey, setTemplateKey]   = useState('li_intro');
  const [clients, setClients]           = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [subject, setSubject]           = useState('');
  const [body, setBody]                 = useState('');
  const [copied, setCopied]             = useState(false);
  const [userEdited, setUserEdited]     = useState(false);

  // Variables for template substitution
  const [projectName, setProjectName]   = useState('');
  const [docLink, setDocLink]           = useState('');

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  // Load clients
  const loadClients = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase.from('clients').select('*')
      .eq('user_id', currentUser.ownerId).eq('mode', mode);
    setClients((data as unknown as Client[]) || []);
  }, [currentUser, mode, supabase]);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Pre-fill project name from selected client
  useEffect(() => {
    if (selectedClient && !projectName) setProjectName(selectedClient.name);
  }, [selectedClientId]);

  // Regenerate template when key/channel/client changes — NOT when user has manually edited
  const regenerate = useCallback(() => {
    const result = generateTemplate(templateKey, selectedClient, brand, channel, { projectName, docLink, extra: '' });
    setSubject(result.subject);
    setBody(result.body);
    setUserEdited(false);
  }, [templateKey, selectedClient, brand, channel, projectName, docLink]);

  // When channel changes, switch to the right default template if current one
  // doesn't belong to the new channel
  useEffect(() => {
    const visible = visibleTemplates(channel).flatMap(g => g.items.map(i => i.value));
    if (!visible.includes(templateKey)) {
      setTemplateKey(DEFAULT_TEMPLATE[channel]);
      setUserEdited(false);
    }
  }, [channel]);

  // Auto-regenerate when template/channel/client changes (only if not manually edited)
  useEffect(() => {
    if (!userEdited) regenerate();
  }, [templateKey, channel, selectedClientId, brand]);

  function handleBodyChange(val: string) {
    setBody(val);
    setUserEdited(true);
  }
  function handleSubjectChange(val: string) {
    setSubject(val);
    setUserEdited(true);
  }

  function handleCopy() {
    const text = channel === 'email' ? `Subject: ${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpen() {
    if (channel === 'email') {
      const email = selectedClient?.contact_email || '';
      window.open(buildMailtoLink(email, subject, body), '_blank');
    } else if (channel === 'whatsapp') {
      const phone = selectedClient?.contact_phone || '';
      window.open(buildWhatsAppLink(phone, body), '_blank');
    } else {
      navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      const liUrl = (selectedClient as any)?.linkedin_url;
      window.open(liUrl || 'https://linkedin.com/messaging', '_blank');
    }
  }

  const channelMeta = {
    email:     { icon: <Mail size={13} />,        action: 'Open in Mail',        color: 'var(--accent-blue)' },
    whatsapp:  { icon: <MessageCircle size={13} />, action: 'Open WhatsApp',      color: 'var(--accent-green)' },
    linkedin:  { icon: <Linkedin size={13} />,    action: 'Copy & Open LinkedIn', color: 'var(--accent-violet)' },
  }[channel];

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Composers</h1>
            <p className="t-xs mt-1">Ready-to-send messages for every stage of your workflow.</p>
          </div>
        </div>

        {/* Brand not set up warning */}
        {!brand?.business_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--accent-amber-dim)', border: '1px solid var(--accent-amber)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 14 }}>⚠</span>
            <span style={{ fontSize: 12, color: 'var(--accent-amber)', fontFamily: 'var(--font-body)' }}>
              Your brand name is not set up yet — templates will use <strong>[Your Name]</strong> as a placeholder.{' '}
              <a href={`/dashboard/${mode}/settings`} style={{ color: 'var(--accent-amber)', fontWeight: 600, textDecoration: 'underline' }}>
                Set up your brand →
              </a>
            </span>
          </div>
        )}

        <div className="rgrid-aside-main" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── LEFT PANEL ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>

            {/* Client picker — top */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="t-label" style={{ marginBottom: 8 }}>Client</p>
              <Select
                placeholder="No client selected"
                options={[{ value: '', label: 'No client' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
              />
              {selectedClient && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {selectedClient.contact_email && (
                    <p className="t-2xs text-tertiary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {selectedClient.contact_email}</p>
                  )}
                  {selectedClient.contact_phone && (
                    <p className="t-2xs text-tertiary">📱 {selectedClient.contact_phone}</p>
                  )}
                </div>
              )}
            </div>

            {/* Channel */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="t-label" style={{ marginBottom: 8 }}>Channel</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {([
                  { value: 'email',    label: 'Email',    icon: <Mail size={13} /> },
                  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={13} /> },
                  { value: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={13} /> },
                ] as const).map(ch => (
                  <button key={ch.value} onClick={() => setChannel(ch.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                      borderRadius: 'var(--radius-sm)',
                      background: channel === ch.value ? 'var(--accent-blue-dim)' : 'transparent',
                      color: channel === ch.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: channel === ch.value ? 500 : 400,
                      transition: 'background 150ms, color 150ms',
                    }}
                    onMouseEnter={e => { if (channel !== ch.value) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (channel !== ch.value) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    {ch.icon} {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template list — filtered by channel */}
            <div style={{ padding: '12px 0 8px', overflowY: 'auto', maxHeight: 440 }}>
              <p className="t-label" style={{ padding: '0 16px', marginBottom: 4 }}>Template</p>
              {visibleTemplates(channel).map(group => (
                <div key={group.group}>
                  <p className="t-label-xs" style={{ padding: '8px 16px 4px' }}>{group.group}</p>
                  {group.items.map(item => (
                    <button key={item.value} onClick={() => { setTemplateKey(item.value); setUserEdited(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', textAlign: 'left',
                        padding: '6px 16px', border: 'none', cursor: 'pointer',
                        background: templateKey === item.value ? 'var(--accent-blue-dim)' : 'transparent',
                        color: templateKey === item.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: templateKey === item.value ? 500 : 400,
                        transition: 'background 150ms, color 150ms',
                      }}
                      onMouseEnter={e => { if (templateKey !== item.value) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { if (templateKey !== item.value) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span>{item.label}</span>
                      {item.usesLink && (
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '1px 5px', borderRadius: 3, background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)', flexShrink: 0 }}>link</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: COMPOSER ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Variables row — project name always, link only when template uses it */}
            {(() => {
              const currentTemplate = TEMPLATES.flatMap(g => g.items).find(t => t.value === templateKey);
              const showLink = currentTemplate?.usesLink ?? false;
              const linkLabels: Record<string, string> = {
                proposal_send: 'Proposal Link',
                contract_send: 'Contract / Doc Link',
                upfront_request: 'Invoice Link',
                requirements_send: 'Requirements Doc Link',
                delivery: 'Delivery Doc Link',
                final_invoice: 'Invoice Link',
              };
              const linkLabel = linkLabels[templateKey] || 'Document Link';
              const linkPlaceholder: Record<string, string> = {
                proposal_send: 'Paste your proposal link...',
                contract_send: 'Paste the contract link...',
                upfront_request: 'Paste the invoice link...',
                requirements_send: 'Paste the requirements doc link...',
                delivery: 'Paste the delivery doc link...',
                final_invoice: 'Paste the invoice link...',
              };
              return (
                <div className={showLink ? 'rgrid-2' : ''} style={{ display: 'grid', gridTemplateColumns: showLink ? '1fr 1fr' : '1fr', gap: 10 }}>
                  <Input
                    label="Project Name"
                    value={projectName}
                    onChange={e => { setProjectName(e.target.value); setUserEdited(false); }}
                    placeholder={selectedClient?.name || 'e.g., Website Redesign'}
                  />
                  {showLink && (
                    <div style={{ position: 'relative' }}>
                      <Input
                        label={linkLabel}
                        value={docLink}
                        onChange={e => { setDocLink(e.target.value); setUserEdited(false); }}
                        placeholder={linkPlaceholder[templateKey] || 'https://...'}
                      />
                      {!docLink && (
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(20%)', fontSize: 10, color: 'var(--accent-amber)', fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Required
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Subject — email only */}
            {channel === 'email' && (
              <Input
                label="Subject"
                value={subject}
                onChange={e => handleSubjectChange(e.target.value)}
              />
            )}

            {/* Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="t-label">Message</label>
                {userEdited && (
                  <button onClick={regenerate}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'color 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-amber)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    <RotateCcw size={11} /> Reset to template
                  </button>
                )}
              </div>
              <textarea
                value={body}
                onChange={e => handleBodyChange(e.target.value)}
                style={{
                  width: '100%', minHeight: 340, resize: 'vertical',
                  background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
                  outline: 'none', lineHeight: 1.7, boxSizing: 'border-box',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
              />
              {channel !== 'email' && (
                <p className="t-2xs text-tertiary">Short version — optimised for {channel === 'whatsapp' ? 'WhatsApp' : 'LinkedIn'}.</p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleCopy}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}>
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
              </button>
              <button
                onClick={handleOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: channelMeta.color, color: '#fff', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', transition: 'opacity 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                {channelMeta.icon} {channelMeta.action}
              </button>

              {/* Character / word count hint */}
              <span className="t-mono-sm" style={{ marginLeft: 'auto' }}>
                {body.length} chars · {body.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}
