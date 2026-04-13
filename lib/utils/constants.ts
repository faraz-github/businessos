import type { ClientStage, LeadStage, IncomeCategory, ExpenseCategory } from '@/types';

// ─── CLIENT STAGES ───
export const CLIENT_STAGES: { value: ClientStage; label: string; group: string }[] = [
  { value: 'lead', label: 'Lead', group: 'lead' },
  { value: 'proposal_sent', label: 'Proposal Sent', group: 'lead' },
  { value: 'contract_sent', label: 'Contract Sent', group: 'lead' },
  { value: 'contract_signed', label: 'Contract Signed', group: 'onboarding' },
  { value: 'requirements_sent', label: 'Requirements Sent', group: 'onboarding' },
  { value: 'requirements_received', label: 'Requirements Received', group: 'onboarding' },
  { value: 'upfront_paid', label: 'Initial Payment Received', group: 'onboarding' },
  { value: 'in_progress', label: 'Work In Progress', group: 'active' },
  { value: 'milestone_review', label: 'Phase 1 Complete', group: 'active' },
  { value: 'revision', label: 'Phase 2 Complete', group: 'active' },
  { value: 'final_review', label: 'Review & Feedback', group: 'active' },
  { value: 'handover', label: 'Revisions Complete', group: 'active' },
  { value: 'final_payment_received', label: 'Final Payment Received', group: 'closing' },
  { value: 'final_payment_received', label: 'Delivered', group: 'closing' },
  { value: 'deployed', label: 'Deployed', group: 'closing' },
  { value: 'support_active', label: 'Support Period Active', group: 'support' },
  { value: 'completed', label: 'Completed', group: 'done' },
];

// ─── LEAD STAGES ───
export const LEAD_STAGES: { value: LeadStage; label: string; color: string }[] = [
  { value: 'prospect', label: 'Prospect', color: 'var(--text-tertiary)' },
  { value: 'contacted', label: 'Contacted', color: 'var(--accent-blue)' },
  { value: 'replied', label: 'Replied', color: 'var(--accent-violet)' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', color: 'var(--accent-amber)' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'var(--accent-blue)' },
  { value: 'negotiating', label: 'Negotiating', color: 'var(--accent-amber)' },
  { value: 'closed_won', label: 'Closed Won', color: 'var(--accent-green)' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'var(--accent-red)' },
];

// ─── INCOME CATEGORIES ───
export const INCOME_CATEGORIES: IncomeCategory[] = [
  { value: 'project_payment', label: 'Project Payment' },
  { value: 'initial_payment', label: 'Initial Payment' },
  { value: 'final_payment', label: 'Final Payment' },
  { value: 'retainer', label: 'Retainer' },
];

// ─── EXPENSE CATEGORIES ───
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { value: 'tools_and_subscriptions', label: 'Tools & Subscriptions' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

// ─── DOCUMENT TYPES ───
export const DOCUMENT_TYPES = [
  { value: 'proposal', label: 'Proposal', description: 'Project pitch with scope, timeline, and investment' },
  { value: 'contract', label: 'Contract', description: 'Legal agreement with payment schedule and terms' },
  { value: 'sow', label: 'Scope of Work', description: 'Detailed deliverables, milestones, and criteria' },
  { value: 'requirements', label: 'Client Requirements', description: 'Functional requirements and project inputs' },
  { value: 'invoice', label: 'Invoice', description: 'Billing with line items, GST, and payment details' },
  { value: 'delivery', label: 'Delivery Document', description: 'Handoff with deliverables, credentials, and notes' },
] as const;

// ─── TIME BLOCK TYPES ───
export const TIME_BLOCK_TYPES = [
  { value: 'deep', label: 'Deep Work', color: 'var(--accent-blue)' },
  { value: 'outreach', label: 'Outreach', color: 'var(--accent-green)' },
  { value: 'admin', label: 'Admin', color: 'var(--accent-amber)' },
  { value: 'personal', label: 'Personal', color: 'var(--accent-violet)' },
] as const;

// ─── SOCIAL PLATFORMS ───
export const SOCIAL_PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'other', label: 'Other' },
] as const;

// ─── GITHUB REVIEW SECTIONS ───
export const GITHUB_REVIEW_SECTIONS = [
  'Pinned Repos (6 best projects)',
  'README quality per pinned repo',
  'Profile README',
  'Contribution graph health',
  'Project descriptions',
  'Live demo links',
  'Tech stack accuracy',
];

// ─── LINKEDIN REVIEW SECTIONS ───
export const LINKEDIN_REVIEW_SECTIONS = [
  'Headline & banner image',
  'About section',
  'Featured section',
  'Experience descriptions',
  'Skills & endorsements',
  'Recommendations',
  'Activity & posting frequency',
];
