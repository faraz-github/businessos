import type { Tone } from '@/types';

export interface MessageTemplate {
  id: string;
  label: string;
  category: 'outreach' | 'followup' | 'delivery' | 'retention' | 'feedback';
  subject: (params: TemplateParams) => string;
  body: (params: TemplateParams) => string;
  whatsapp: (params: TemplateParams) => string;
}

export interface TemplateParams {
  clientName: string;
  businessName: string;
  tone: Tone;
  projectName?: string;
  invoiceNumber?: string;
  amount?: string;
  dueDate?: string;
  supportEndDate?: string;
}

function greeting(name: string, tone: Tone): string {
  if (tone === 'conversational') return `Hey ${name}! 👋`;
  if (tone === 'confident') return `Hi ${name},`;
  return `Dear ${name},`;
}

function signoff(businessName: string, tone: Tone): string {
  if (tone === 'conversational') return `Cheers,\n${businessName}`;
  if (tone === 'confident') return `Best,\n${businessName}`;
  return `Best regards,\n${businessName}`;
}

export const templates: MessageTemplate[] = [
  {
    id: 'initial_outreach',
    label: 'Initial Outreach',
    category: 'outreach',
    subject: ({ businessName }) => `${businessName} — Let's work together`,
    body: ({ clientName, businessName, tone }) =>
      `${greeting(clientName, tone)}\n\n${
        tone === 'conversational'
          ? `I came across your work and I think there's a great opportunity for us to collaborate. I specialize in building premium digital experiences.\n\nWould love to chat about what you're working on — are you free for a quick call this week?`
          : tone === 'confident'
          ? `I wanted to reach out about a potential collaboration. At ${businessName}, we build premium digital experiences that drive real results.\n\nI'd love to learn more about what you're working on. Are you available for a brief call this week?`
          : `I hope this message finds you well. I wanted to reach out regarding a potential collaboration opportunity.\n\nAt ${businessName}, we specialize in building premium digital experiences. I believe there's a strong alignment between what you're looking for and what we deliver.\n\nWould you be available for a brief call this week to discuss further?`
      }\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName, businessName }) =>
      `Hey ${clientName}! 👋\n\nI'm reaching out from ${businessName}. I think there's a great fit for us to work together.\n\nWould you be up for a quick chat this week? 🙂`,
  },
  {
    id: 'proposal_followup',
    label: 'Proposal Follow-up',
    category: 'followup',
    subject: ({ businessName }) => `Following up on the proposal — ${businessName}`,
    body: ({ clientName, businessName, tone }) =>
      `${greeting(clientName, tone)}\n\n${
        tone === 'conversational'
          ? `Just checking in on the proposal I sent over. Have you had a chance to look through it?\n\nHappy to jump on a quick call if you have any questions or want to discuss anything.`
          : `I wanted to follow up on the proposal I shared with you recently. I hope you've had an opportunity to review it.\n\nPlease don't hesitate to reach out if you have any questions or would like to discuss any aspect of the proposal in detail.`
      }\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName }) =>
      `Hey ${clientName}! Just checking in on the proposal I sent over. Had a chance to look through it? Happy to chat if you have any questions! 🙂`,
  },
  {
    id: 'contract_followup',
    label: 'Contract Follow-up',
    category: 'followup',
    subject: ({ businessName }) => `Contract status — ${businessName}`,
    body: ({ clientName, businessName, tone }) =>
      `${greeting(clientName, tone)}\n\nJust a gentle reminder about the contract I sent over. Once we have your signature, we can get started right away.\n\nLet me know if you need any changes or have questions.\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName }) =>
      `Hey ${clientName}! Quick reminder about the contract — once you've signed, we can kick things off. Let me know if you need any changes! 🚀`,
  },
  {
    id: 'invoice_reminder',
    label: 'Invoice Reminder',
    category: 'followup',
    subject: ({ invoiceNumber }) => `Invoice ${invoiceNumber || ''} — Payment reminder`,
    body: ({ clientName, businessName, tone, invoiceNumber, amount, dueDate }) =>
      `${greeting(clientName, tone)}\n\nThis is a friendly reminder about invoice ${invoiceNumber || ''}${amount ? ` for ${amount}` : ''}${dueDate ? `, due on ${dueDate}` : ''}.\n\nI'd appreciate it if you could process the payment at your earliest convenience. Let me know if you need the invoice resent or have any questions.\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName, invoiceNumber, amount }) =>
      `Hi ${clientName}! Just a friendly nudge about invoice ${invoiceNumber || ''}${amount ? ` (${amount})` : ''}. Would appreciate it if you could process it when you get a chance. Let me know if you need anything! 🙏`,
  },
  {
    id: 'project_update',
    label: 'Project Update',
    category: 'delivery',
    subject: ({ businessName, projectName }) => `${projectName || 'Project'} update — ${businessName}`,
    body: ({ clientName, businessName, tone, projectName }) =>
      `${greeting(clientName, tone)}\n\nHere's a quick update on ${projectName || 'your project'}:\n\n• [Update 1]\n• [Update 2]\n• [Next milestone]\n\nEverything is on track. I'll share the next update on [date].\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName, projectName }) =>
      `Hey ${clientName}! Quick update on ${projectName || 'the project'}:\n\n✅ [Update 1]\n✅ [Update 2]\n🎯 Next up: [milestone]\n\nAll on track! Will update you again on [date] 👍`,
  },
  {
    id: 'project_delivery',
    label: 'Project Delivery',
    category: 'delivery',
    subject: ({ businessName }) => `Project delivered! — ${businessName}`,
    body: ({ clientName, businessName, tone }) =>
      `${greeting(clientName, tone)}\n\n${
        tone === 'conversational'
          ? `Great news — your project is complete and ready for review! 🎉\n\nI've put together a delivery document with all the details, credentials, and next steps. Everything you need is in there.\n\nTake a look and let me know if you have any questions. It's been awesome working on this with you!`
          : `I'm pleased to let you know that your project is complete and ready for your review.\n\nI've prepared a comprehensive delivery document that includes all deliverables, credentials, and maintenance notes.\n\nPlease take your time reviewing everything. I'm available for any questions or clarifications you may need.`
      }\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName }) =>
      `Hey ${clientName}! 🎉 Your project is done!\n\nI've prepared a delivery doc with everything — all files, credentials, and instructions. Take a look and let me know if you have any questions!\n\nIt's been great working on this with you 🙌`,
  },
  {
    id: 'support_ending',
    label: 'Support Period Ending',
    category: 'retention',
    subject: ({ businessName }) => `Support period update — ${businessName}`,
    body: ({ clientName, businessName, tone, supportEndDate }) =>
      `${greeting(clientName, tone)}\n\nI wanted to let you know that your support period ${supportEndDate ? `ends on ${supportEndDate}` : 'will be ending soon'}.\n\nIt's been wonderful working with you on this project. If you'd like to extend support or discuss future projects, I'd love to chat.\n\nThank you for trusting ${businessName} with your project.\n\nWarm regards,\n${businessName}`,
    whatsapp: ({ clientName, supportEndDate }) =>
      `Hey ${clientName}! Just a heads up — your support period ${supportEndDate ? `ends on ${supportEndDate}` : 'is ending soon'}.\n\nIt's been great working with you! If you want to extend or chat about anything new, I'm here. Thanks for trusting us 🙏`,
  },
  {
    id: 'feedback_request',
    label: 'Feedback Request',
    category: 'feedback',
    subject: ({ businessName }) => `Would love your feedback — ${businessName}`,
    body: ({ clientName, businessName, tone }) =>
      `${greeting(clientName, tone)}\n\nNow that the project is complete, I'd really value your honest feedback on the experience.\n\nA few words about what worked well and anything that could be improved would go a long way in helping me serve future clients better.\n\nThank you so much for your time!\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName }) =>
      `Hey ${clientName}! Now that the project is wrapped up, I'd really appreciate your honest feedback. Even a few words about the experience would help me a lot! No pressure at all 🙂`,
  },
  {
    id: 'recommendation_request',
    label: 'Recommendation Request',
    category: 'feedback',
    subject: ({ businessName }) => `Quick favour — ${businessName}`,
    body: ({ clientName, businessName, tone }) =>
      `${greeting(clientName, tone)}\n\nI hope you're doing well! I wanted to ask if you'd be open to writing a brief recommendation or testimonial about our work together.\n\nEven a few sentences about your experience would mean a lot and help others feel confident about working with ${businessName}.\n\nCompletely understand if you're busy — no pressure at all.\n\n${signoff(businessName, tone)}`,
    whatsapp: ({ clientName, businessName }) =>
      `Hey ${clientName}! Hope you're doing well 😊\n\nWould you be open to writing a quick testimonial about working with ${businessName}? Even a couple of sentences would mean the world. Totally understand if you're busy!`,
  },
];

export function getTemplate(id: string): MessageTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): MessageTemplate[] {
  return templates.filter((t) => t.category === category);
}
