// ============================================================
// Business OS — Core Types
// Mirror of database schema + application types
// ============================================================

export type Mode = 'personal' | 'agency';
export type Tone = 'formal' | 'conversational' | 'confident';
export type PreferredChannel = 'email' | 'whatsapp' | 'phone';

export type ClientStage =
  | 'interested'
  | 'proposal_sent'
  | 'contract_sent'
  | 'contract_signed'
  | 'requirements_sent'
  | 'requirements_received'
  | 'initial_payment_received'
  | 'work_in_progress'
  | 'phase_1_complete'
  | 'phase_2_complete'
  | 'review_and_feedback'
  | 'revisions_complete'
  | 'final_payment_received'
  | 'delivered'
  | 'deployed'
  | 'support_period_active'
  | 'completed';

export type DocumentType = 'proposal' | 'contract' | 'sow' | 'requirements' | 'invoice' | 'delivery';
export type DocumentStatus = 'draft' | 'final' | 'sent' | 'viewed' | 'signed';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'overdue' | 'paid';
export type LeadStage = 'prospect' | 'contacted' | 'replied' | 'meeting_scheduled' | 'proposal_sent' | 'negotiating' | 'closed_won' | 'closed_lost';
export type TransactionType = 'income' | 'expense';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type SocialPlatform = 'linkedin' | 'github' | 'twitter' | 'other';
export type SocialPostStatus = 'idea' | 'draft' | 'scheduled' | 'published';
export type TimeBlockType = 'deep' | 'outreach' | 'admin' | 'personal';
export type QuickLogType = 'lead' | 'call' | 'client_note' | 'payment' | 'task' | 'other';
export type AccessRole = 'bd' | 'viewer';
export type TestimonialSource = 'direct' | 'linkedin' | 'email' | 'form';

// ─── Database Row Types ───

export interface BrandProfile {
  id: string;
  user_id: string;
  mode: Mode;
  logo_url: string | null;
  primary_colour: string;
  secondary_colour: string;
  font_choice: string;
  tone: Tone;
  business_name: string;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  gst_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_upi: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageHistoryEntry {
  stage: ClientStage;
  entered_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  mode: Mode;
  name: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  preferred_channel: PreferredChannel;
  notes: string;
  current_stage: ClientStage;
  stage_history: StageHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  mode: Mode;
  type: DocumentType;
  client_id: string | null;
  title: string;
  fields: Record<string, unknown>;
  status: DocumentStatus;
  share_token: string | null;
  signed_at: string | null;
  signer_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Signature {
  id: string;
  document_id: string;
  signer_name: string;
  signed_at: string;
  ip_address: string | null;
}

export interface Lead {
  id: string;
  user_id: string;
  mode: Mode;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  stage: LeadStage;
  notes: LeadNote[];
  last_activity_at: string;
  next_action: string | null;
  next_action_date: string | null;
  deal_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  text: string;
  created_at: string;
  author?: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  mode: Mode;
  client_id: string | null;
  document_id: string | null;
  number: string;
  amount: number;
  gst_rate: number;
  gst_amount: number;
  total: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  mode: Mode;
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  mode: Mode;
  name: string;
  category: string;
  cost: number;
  billing_cycle: BillingCycle;
  next_renewal_at: string;
  status: SubscriptionStatus;
  auto_pay: boolean;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  user_id: string;
  mode: Mode;
  platform: SocialPlatform;
  title: string | null;
  content: string | null;
  planned_date: string | null;
  status: SocialPostStatus;
  engagement_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeBlock {
  id: string;
  user_id: string;
  mode: Mode;
  date: string;
  type: TimeBlockType;
  start_time: string;
  end_time: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface Priority {
  id: string;
  user_id: string;
  mode: Mode;
  date: string;
  text: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PersonalBlocker {
  id: string;
  user_id: string;
  mode: Mode;
  date: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface SupportPeriod {
  id: string;
  user_id: string;
  mode: Mode;
  client_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  user_id: string;
  mode: Mode;
  client_id: string;
  content: string;
  source: TestimonialSource;
  portfolio_usable: boolean;
  received_at: string;
  created_at: string;
  updated_at: string;
}

export interface AccessRoleRow {
  id: string;
  user_id: string;
  granted_user_id: string;
  role: AccessRole;
  allowed_sections: string[];
  created_at: string;
  updated_at: string;
}

export interface QuickLog {
  id: string;
  user_id: string;
  mode: Mode;
  type: QuickLogType;
  content: string;
  processed: boolean;
  linked_id: string | null;
  created_at: string;
}

export interface ProfileReview {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  section: string;
  completed: boolean;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Application Types ───

export type AttentionItemType =
  | 'contract_follow_up'
  | 'invoice_overdue'
  | 'client_update'
  | 'social_post_due'
  | 'proposal_nudge'
  | 'subscription_renewal'
  | 'support_ending';

export type AttentionSeverity = 'critical' | 'important' | 'info';

export interface AttentionItem {
  id: string;
  type: AttentionItemType;
  severity: AttentionSeverity;
  title: string;
  description: string;
  link: string;
  related_id: string;
  created_at: string;
}

export interface IncomeCategory {
  value: 'project_payment' | 'initial_payment' | 'final_payment' | 'retainer';
  label: string;
}

export interface ExpenseCategory {
  value: 'tools_and_subscriptions' | 'contractor' | 'marketing' | 'miscellaneous';
  label: string;
}

// ─── Navigation ───

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
