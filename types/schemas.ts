import { z } from 'zod';

// ─── BRAND PROFILE ───
export const brandProfileSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  logo_url: z.string().nullable().optional(),
  primary_colour: z.string().min(4).max(9).default('#4F8EF7'),
  secondary_colour: z.string().min(4).max(9).default('#8B6CF7'),
  font_choice: z.string().default('DM Sans'),
  tone: z.enum(['formal', 'conversational', 'confident']).default('confident'),
  business_name: z.string().min(1, 'Business name is required'),
  tagline: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  email: z.string().email('Invalid email').nullable().optional(),
  website: z.string().url('Invalid URL').nullable().optional(),
  address: z.string().nullable().optional(),
  gst_number: z.string().nullable().optional(),
  bank_name: z.string().nullable().optional(),
  bank_account_number: z.string().nullable().optional(),
  bank_ifsc: z.string().nullable().optional(),
  bank_upi: z.string().nullable().optional(),
});
export type BrandProfileFormData = z.infer<typeof brandProfileSchema>;

// ─── CLIENT ───
export const clientSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  name: z.string().min(1, 'Client name is required'),
  company: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().email('Invalid email').nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  preferred_channel: z.enum(['email', 'whatsapp', 'phone']).default('email'),
  notes: z.string().default(''),
});
export type ClientFormData = z.infer<typeof clientSchema>;

// ─── DOCUMENT FIELDS ───
export const proposalFieldsSchema = z.object({
  client_name: z.string().min(1),
  project_title: z.string().min(1),
  overview: z.string().min(1),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  timeline: z.string(),
  investment_amount: z.number().min(0),
  payment_terms: z.string(),
  validity_period: z.string(),
  portfolio_reference: z.string().optional(),
});

export const contractFieldsSchema = z.object({
  party_one: z.string().min(1),
  party_two: z.string().min(1),
  project_description: z.string().min(1),
  scope_reference: z.string().optional(),
  payment_schedule: z.array(z.object({
    amount: z.number(),
    trigger: z.string(),
    due_date: z.string().optional(),
  })),
  revision_policy: z.string(),
  ip_clause: z.string(),
  confidentiality_clause: z.string(),
  termination_clause: z.string(),
  governing_law: z.string().default('India'),
});

export const sowFieldsSchema = z.object({
  objectives: z.string().min(1),
  deliverables: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })),
  out_of_scope: z.array(z.string()),
  milestone_schedule: z.array(z.object({
    milestone: z.string(),
    target_date: z.string(),
  })),
  acceptance_criteria: z.string(),
  assumptions: z.array(z.string()),
  dependencies: z.array(z.string()),
});

export const requirementsFieldsSchema = z.object({
  project_background: z.string().min(1),
  functional_requirements: z.array(z.object({
    requirement: z.string(),
    completed: z.boolean().default(false),
  })),
  design_references: z.array(z.string()),
  content_responsibilities: z.string(),
  technical_access: z.array(z.string()),
  deadline_expectations: z.string(),
  signoff_section: z.string().optional(),
});

export const invoiceFieldsSchema = z.object({
  invoice_number: z.string().min(1),
  client_name: z.string().min(1),
  client_company: z.string().optional(),
  client_email: z.string().optional(),
  client_address: z.string().optional(),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number().default(1),
    rate: z.number(),
    amount: z.number(),
  })),
  subtotal: z.number(),
  gst_enabled: z.boolean().default(true),
  gst_rate: z.number().default(18),
  gst_amount: z.number(),
  total: z.number(),
  due_date: z.string(),
  payment_instructions: z.string().optional(),
});

export const deliveryFieldsSchema = z.object({
  project_summary: z.string().min(1),
  deliverables: z.array(z.object({
    title: z.string(),
    link: z.string().optional(),
    description: z.string().optional(),
  })),
  credentials: z.array(z.object({
    service: z.string(),
    details: z.string(),
  })),
  usage_notes: z.string().optional(),
  maintenance_notes: z.string().optional(),
  support_period_details: z.string().optional(),
  signoff_section: z.string().optional(),
});

// ─── LEAD ───
export const leadSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  company: z.string().min(1, 'Company name is required'),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  stage: z.enum([
    'prospect', 'contacted', 'replied', 'meeting_scheduled',
    'proposal_sent', 'negotiating', 'closed_won', 'closed_lost',
  ]).default('prospect'),
  next_action: z.string().nullable().optional(),
  next_action_date: z.string().nullable().optional(),
  deal_value: z.number().nullable().optional(),
});
export type LeadFormData = z.infer<typeof leadSchema>;

// ─── INVOICE (finance) ───
export const invoiceSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  client_id: z.string().uuid().nullable().optional(),
  number: z.string().min(1, 'Invoice number required'),
  amount: z.number().min(0),
  gst_rate: z.number().default(18),
  gst_amount: z.number().default(0),
  total: z.number().min(0),
  due_date: z.string().min(1, 'Due date required'),
});
export type InvoiceFormData = z.infer<typeof invoiceSchema>;

// ─── TRANSACTION ───
export const transactionSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().nullable().optional(),
  date: z.string().min(1, 'Date required'),
  invoice_id: z.string().uuid().nullable().optional(),
});
export type TransactionFormData = z.infer<typeof transactionSchema>;

// ─── SUBSCRIPTION ───
export const subscriptionSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  name: z.string().min(1, 'Name required'),
  category: z.string().default('tools'),
  cost: z.number().min(0),
  billing_cycle: z.enum(['monthly', 'annual']).default('monthly'),
  next_renewal_at: z.string().min(1, 'Next renewal date required'),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  auto_pay: z.boolean().default(false),
});
export type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

// ─── SOCIAL POST ───
export const socialPostSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  platform: z.enum(['linkedin', 'github', 'twitter', 'other']).default('linkedin'),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  planned_date: z.string().nullable().optional(),
  status: z.enum(['idea', 'draft', 'scheduled', 'published']).default('idea'),
  engagement_notes: z.string().nullable().optional(),
});
export type SocialPostFormData = z.infer<typeof socialPostSchema>;

// ─── TIME BLOCK ───
export const timeBlockSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  date: z.string(),
  type: z.enum(['deep', 'outreach', 'admin', 'personal']),
  start_time: z.string(),
  end_time: z.string(),
  label: z.string().nullable().optional(),
});
export type TimeBlockFormData = z.infer<typeof timeBlockSchema>;

// ─── PRIORITY ───
export const prioritySchema = z.object({
  mode: z.enum(['personal', 'agency']),
  date: z.string(),
  text: z.string().min(1, 'Priority text required'),
  sort_order: z.number().default(0),
});
export type PriorityFormData = z.infer<typeof prioritySchema>;

// ─── QUICK LOG ───
export const quickLogSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  type: z.enum(['lead', 'call', 'client_note', 'payment', 'task', 'other']),
  content: z.string().min(1, 'Log content required'),
});
export type QuickLogFormData = z.infer<typeof quickLogSchema>;

// ─── SUPPORT PERIOD ───
export const supportPeriodSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  client_id: z.string().uuid(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  notes: z.string().nullable().optional(),
});
export type SupportPeriodFormData = z.infer<typeof supportPeriodSchema>;

// ─── TESTIMONIAL ───
export const testimonialSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  client_id: z.string().uuid(),
  content: z.string().min(1, 'Testimonial content required'),
  source: z.enum(['direct', 'linkedin', 'email', 'form']).default('direct'),
  portfolio_usable: z.boolean().default(false),
  received_at: z.string().optional(),
});
export type TestimonialFormData = z.infer<typeof testimonialSchema>;

// ─── SIGNATURE (public) ───
export const signatureSchema = z.object({
  document_id: z.string().uuid(),
  signer_name: z.string().min(1, 'Please enter your name'),
});
export type SignatureFormData = z.infer<typeof signatureSchema>;
