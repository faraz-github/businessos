'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Button, Tabs, Textarea, Input, Select } from '@/components/ui';
import { buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import { Mail, MessageCircle, Copy, Check, Linkedin } from 'lucide-react';
import type { Client, BrandProfile } from '@/types';

/* ── Templates grouped by workflow stage ── */
const TEMPLATES = [
  { group: 'LinkedIn', items: [
    { value: 'li_intro',      label: 'Connection + Intro' },
    { value: 'li_followup',   label: 'Follow-up (no reply)' },
    { value: 'li_qualify',    label: 'Qualify Interest' },
  ]},
  { group: 'Proposal', items: [
    { value: 'proposal_send',    label: 'Sending a Proposal' },
    { value: 'proposal_followup', label: 'Proposal Follow-up' },
  ]},
  { group: 'Contracting', items: [
    { value: 'contract_send',    label: 'Contract + SOW Ready' },
    { value: 'contract_followup', label: 'Contract Follow-up' },
    { value: 'upfront_request',  label: 'Upfront Payment Request' },
  ]},
  { group: 'Kickoff', items: [
    { value: 'kickoff',            label: 'Project Kickoff' },
    { value: 'credentials_request', label: 'Credentials Request' },
    { value: 'requirements_send',  label: 'Requirements Doc Ready' },
  ]},
  { group: 'Active Work', items: [
    { value: 'milestone_update', label: 'Milestone / Weekly Update' },
    { value: 'feedback_collect', label: 'Collecting Feedback' },
  ]},
  { group: 'Delivery & Payment', items: [
    { value: 'delivery',        label: 'Project Delivery' },
    { value: 'final_invoice',   label: 'Final Invoice + Payment' },
    { value: 'invoice_reminder', label: 'Invoice Reminder' },
  ]},
  { group: 'Post-project', items: [
    { value: 'handover',         label: 'Handover Confirmation' },
    { value: 'feedback_request', label: 'Feedback Request (~1 week)' },
    { value: 'reengagement',     label: 'Re-engagement (~1 month)' },
    { value: 'recommendation',   label: 'Recommendation Request' },
  ]},
];

const FLAT_TEMPLATES = TEMPLATES.flatMap(g => g.items.map(t => ({ ...t, group: g.group })));

function generateTemplate(
  templateKey: string,
  client: Client | null,
  brand: BrandProfile | null,
  channel: 'email' | 'whatsapp' | 'linkedin'
): { subject: string; body: string } {
  const clientName = client?.contact_name || client?.name || '[Client Name]';
  const biz = brand?.business_name || '[Your Name]';
  const isShort = channel !== 'email';

  const t: Record<string, { subject: string; body: string }> = {

    /* ── LinkedIn ── */
    li_intro: {
      subject: '',
      body: isShort
        ? `Hi ${clientName}! I noticed you're looking for a developer. I specialise in web development, app development, and design — from idea to deployment. Would love to connect and see if I can help. 🙂`
        : `Hi ${clientName},\n\nI came across your post and wanted to reach out — I specialise in web development, mobile apps, UI/UX design (Figma), logo and branding work, and full project delivery.\n\nI'd love to hear more about what you're building and see if there's a fit.\n\nBest,\n${biz}`,
    },
    li_followup: {
      subject: '',
      body: `Hi ${clientName}, just following up on my earlier message — still happy to chat if you're looking for a developer or designer. No pressure at all!`,
    },
    li_qualify: {
      subject: '',
      body: `Hi ${clientName}, great to connect! I'd love to understand more about your project — what are you building, and what's your timeline looking like? Happy to jump on a quick call too.`,
    },

    /* ── Proposal ── */
    proposal_send: {
      subject: `Proposal — ${biz}`,
      body: `Hi ${clientName},\n\nThank you for taking the time to chat — it was great learning about your project.\n\nI've put together a detailed proposal covering the scope, timeline, and investment. Please find it attached / at the link below.\n\nHappy to answer any questions or jump on a call to walk through it together.\n\nBest,\n${biz}`,
    },
    proposal_followup: {
      subject: `Following up on the proposal — ${biz}`,
      body: isShort
        ? `Hey ${clientName}, just checking in on the proposal I sent. Had a chance to look through it? Happy to answer any questions!`
        : `Hi ${clientName},\n\nI wanted to follow up on the proposal I shared. Have you had a chance to review it?\n\nI'm happy to adjust anything or clarify further — just say the word.\n\nLooking forward to hearing from you.\n\nBest,\n${biz}`,
    },

    /* ── Contracting ── */
    contract_send: {
      subject: `Contract & Scope of Work — ${biz}`,
      body: `Hi ${clientName},\n\nExcited to move forward! I've prepared the Contract and Scope of Work document for your review and signature.\n\n[Document link]\n\nOnce signed, I'll send the upfront payment invoice so we can kick things off.\n\nLet me know if you have any questions.\n\nBest,\n${biz}`,
    },
    contract_followup: {
      subject: `Contract status — ${biz}`,
      body: isShort
        ? `Hi ${clientName}, just a gentle nudge on the contract — whenever you're ready to sign, we're good to go!`
        : `Hi ${clientName},\n\nJust checking in on the contract I sent over. Once we have your signature, we can get started right away.\n\nLet me know if anything needs to be adjusted.\n\nBest,\n${biz}`,
    },
    upfront_request: {
      subject: `Upfront payment — ${biz}`,
      body: `Hi ${clientName},\n\nThank you for signing the contract! To officially kick off the project, please find the upfront payment invoice attached.\n\nPayment details are included in the invoice. Once received, I'll get started immediately.\n\nLooking forward to working with you!\n\nBest,\n${biz}`,
    },

    /* ── Kickoff ── */
    kickoff: {
      subject: `Project kickoff — ${biz}`,
      body: `Hi ${clientName},\n\nPayment received — we're officially started! 🎉\n\nHere's how we'll proceed:\n• I'll send over a requirements document for you to fill in\n• I'll need access to relevant accounts (domain, hosting, etc.)\n• I'll share updates [weekly/at each milestone]\n\nLet me know if you have any questions as we get going.\n\nBest,\n${biz}`,
    },
    credentials_request: {
      subject: `Project access — ${biz}`,
      body: `Hi ${clientName},\n\nTo get started on the technical side, I'll need access to a few things:\n\n• Domain registrar (e.g., GoDaddy, Namecheap)\n• Hosting account (e.g., Hostinger, cPanel)\n• Any existing CMS or platform logins\n• Email accounts to be configured (if applicable)\n\nYou can share credentials securely over WhatsApp, or we can set it up together on a call.\n\nBest,\n${biz}`,
    },
    requirements_send: {
      subject: `Requirements document — ${biz}`,
      body: `Hi ${clientName},\n\nI've prepared a requirements document to make sure I fully understand your vision before I start building.\n\nPlease fill in as much detail as possible — the more you share, the better the output.\n\n[Document link]\n\nLet me know once you've completed it or if you'd prefer to go through it together on a call.\n\nBest,\n${biz}`,
    },

    /* ── Active Work ── */
    milestone_update: {
      subject: `Project update — ${biz}`,
      body: `Hi ${clientName},\n\nHere's a quick update on your project:\n\n✅ Completed:\n• [Item 1]\n• [Item 2]\n\n🔄 In progress:\n• [Item 3]\n\n📅 Next milestone: [date/deliverable]\n\nEverything is on track. Let me know if you'd like to review what's been done so far.\n\nBest,\n${biz}`,
    },
    feedback_collect: {
      subject: `Feedback request — ${biz}`,
      body: isShort
        ? `Hey ${clientName}, I've shared the latest version for your review. Let me know your thoughts — any changes you'd like?`
        : `Hi ${clientName},\n\nI've completed the latest milestone and would love your feedback before moving on.\n\n[Preview / staging link]\n\nPlease review and let me know:\n1. What's looking good\n2. Any changes you'd like\n3. Anything you'd like added or removed\n\nBest,\n${biz}`,
    },

    /* ── Delivery & Payment ── */
    delivery: {
      subject: `Your project is ready! — ${biz}`,
      body: `Hi ${clientName},\n\nI'm thrilled to let you know that your project is complete! 🎉\n\nI've prepared a full delivery document covering:\n• All deliverables with links\n• Credentials being handed over\n• Usage and maintenance notes\n• Support period details\n\n[Delivery document link]\n\nPlease review everything and let me know if you have any questions.\n\nIt's been a real pleasure working on this project with you.\n\nBest,\n${biz}`,
    },
    final_invoice: {
      subject: `Final invoice — ${biz}`,
      body: `Hi ${clientName},\n\nAs the project is complete, please find the final invoice attached.\n\nOnce payment is received, I'll transfer all code, files, and credentials to your accounts in full.\n\nThank you for being a great client to work with!\n\nBest,\n${biz}`,
    },
    invoice_reminder: {
      subject: `Invoice reminder — ${biz}`,
      body: isShort
        ? `Hi ${clientName}, friendly reminder about the pending invoice. Please let me know if you need it resent or have any questions!`
        : `Hi ${clientName},\n\nThis is a gentle reminder about the pending invoice. I'd appreciate it if you could process the payment at your earliest convenience.\n\nPlease let me know if you need the invoice resent or have any questions.\n\nThank you,\n${biz}`,
    },

    /* ── Post-project ── */
    handover: {
      subject: `Handover complete — ${biz}`,
      body: `Hi ${clientName},\n\nAll code, files, and credentials have now been transferred to your accounts — everything is fully yours.\n\nA few reminders:\n• Keep your domain and hosting renewed\n• Back up your site/app regularly\n• I'm available for support for [X] days\n\nThank you for trusting ${biz} with your project. It's been a great experience.\n\nBest,\n${biz}`,
    },
    feedback_request: {
      subject: `Quick favour — your feedback — ${biz}`,
      body: isShort
        ? `Hey ${clientName}, hope everything's going well with the project! Would you be willing to share a few words about our experience working together? It really helps me a lot. 🙏`
        : `Hi ${clientName},\n\nI hope the project is going well!\n\nNow that we've wrapped up, I'd genuinely appreciate your honest feedback on the experience — what worked well and what could be better.\n\nEven a few sentences would mean a lot. You can simply reply to this email.\n\nThank you so much,\n${biz}`,
    },
    reengagement: {
      subject: `Checking in — ${biz}`,
      body: isShort
        ? `Hey ${clientName}! It's been a while — hope everything's going well. If you ever need anything for the project or have new ideas to build, I'm here. 😊`
        : `Hi ${clientName},\n\nI hope things are going great! I wanted to check in and see how everything is holding up with the project.\n\nIf you ever need updates, new features, or want to start something new — I'd love to be involved.\n\nJust reply to this email or message me anytime.\n\nWarm regards,\n${biz}`,
    },
    recommendation: {
      subject: `A small favour — ${biz}`,
      body: isShort
        ? `Hey ${clientName}, would you be open to leaving a quick recommendation or testimonial about our work? Even 2–3 sentences helps massively. No pressure at all! 🙏`
        : `Hi ${clientName},\n\nI hope you're doing well! I wanted to ask if you'd be open to writing a brief recommendation or testimonial about our work together.\n\nEven a few sentences on LinkedIn or via email would mean a lot and help others feel confident about working with me.\n\nAbsolutely no pressure — completely your call.\n\nThank you,\n${biz}`,
    },
  };

  return t[templateKey] || { subject: '', body: '' };
}

export default function PersonalComposePage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabase = createClient();

  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'linkedin'>('email');
  const [templateKey, setTemplateKey] = useState('li_intro');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      const { data } = await supabase.from('clients').select('*').eq('user_id', currentUser.id).eq('mode', mode);
      setClients((data as Client[]) || []);
    }
    load();
  }, [mode, currentUser]);

  useEffect(() => {
    const result = generateTemplate(templateKey, selectedClient, brand, channel);
    setSubject(result.subject);
    setBody(result.body);
  }, [templateKey, selectedClient, brand, channel]);

  function handleCopy() {
    navigator.clipboard.writeText(channel === 'email' ? `${subject}\n\n${body}` : body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpen() {
    if (channel === 'email') {
      window.open(buildMailtoLink(selectedClient?.contact_email || '', subject, body), '_blank');
    } else if (channel === 'whatsapp') {
      window.open(buildWhatsAppLink(selectedClient?.contact_phone || '', body), '_blank');
    } else {
      /* LinkedIn — copy to clipboard, then open LinkedIn */
      navigator.clipboard.writeText(body);
      if (selectedClient && (selectedClient as any).linkedin_url) {
        window.open((selectedClient as any).linkedin_url, '_blank');
      } else {
        window.open('https://linkedin.com/messaging', '_blank');
      }
    }
  }

  const channelIcon = channel === 'email'
    ? <Mail size={14} />
    : channel === 'whatsapp'
    ? <MessageCircle size={14} />
    : <Linkedin size={14} />;

  const channelAction = channel === 'email'
    ? 'Open in Mail'
    : channel === 'whatsapp'
    ? 'Open WhatsApp'
    : 'Copy & Open LinkedIn';

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">
        <div>
          <h1 className="t-h1">Composers</h1>
          <p className="t-xs mt-1">Ready-to-send messages for every stage of your workflow.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── LEFT: Controls ── */}
          <div className="flex flex-col gap-4">
            {/* Channel */}
            <div>
              <p className="t-label card-heading-gap">Channel</p>
              <div className="flex flex-col gap-1">
                {[
                  { value: 'email',     label: 'Email',     icon: <Mail size={13} /> },
                  { value: 'whatsapp',  label: 'WhatsApp',  icon: <MessageCircle size={13} /> },
                  { value: 'linkedin',  label: 'LinkedIn',  icon: <Linkedin size={13} /> },
                ].map(ch => (
                  <button key={ch.value} onClick={() => setChannel(ch.value as any)}
                    className="flex items-center gap-2.5 radius-sm interactive"
                    style={{
                      padding: '8px 10px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                      background: channel === ch.value ? 'var(--accent-blue-dim)' : 'transparent',
                      color: channel === ch.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: channel === ch.value ? 500 : 400,
                    }}>
                    {ch.icon} {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template picker — grouped */}
            <div>
              <p className="t-label card-heading-gap">Template</p>
              <div className="flex flex-col gap-0.5">
                {TEMPLATES.map(group => (
                  <div key={group.group}>
                    <p className="t-label-xs" style={{ padding: '8px 10px 4px', color: 'var(--text-tertiary)' }}>{group.group}</p>
                    {group.items.map(item => (
                      <button key={item.value} onClick={() => setTemplateKey(item.value)}
                        className="radius-sm interactive"
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 10px', border: 'none', cursor: 'pointer',
                          background: templateKey === item.value ? 'var(--accent-blue-dim)' : 'transparent',
                          color: templateKey === item.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                          fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: templateKey === item.value ? 500 : 400,
                        }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Client */}
            <div>
              <p className="t-label card-heading-gap">Client</p>
              <Select
                placeholder="No client selected"
                options={[{ value: '', label: 'No client' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
              />
            </div>
          </div>

          {/* ── RIGHT: Composer ── */}
          <div className="flex flex-col gap-3">
            {channel === 'email' && (
              <Input label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
            )}
            <Textarea
              label="Message"
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ minHeight: 360 }}
            />
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button icon={channelIcon} onClick={handleOpen}>{channelAction}</Button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
