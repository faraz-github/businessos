import { z } from 'zod';

// ─── BRAND PROFILE ───
export const brandProfileSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  logo_url: z.string().nullable().optional(),
  // Saved signature fields — same posture as logo_url: managed by
  // dedicated uploadBrandSignature / removeBrandSignature actions,
  // not by the general upsertBrandProfile path. Listed here so the
  // schema doesn't reject a payload that carries them, and so the
  // upsert action can strip them explicitly.
  signature_url:  z.string().nullable().optional(),
  signature_type: z.enum(['drawn', 'uploaded']).nullable().optional(),
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

// ─── PER-DOCTYPE REQUIRED SCHEMAS (v3.5 step 7, revised v3.5.1) ───
// Stricter than the *FieldsSchema variants above (which permit autosave
// of partials). These run on the server when transitioning a document
// to status 'final' / 'sent' / 'signed' / 'paid'. Drafts skip this
// entirely — drafts are allowed to be incomplete.
//
// Philosophy (revised v3.5.1)
// ---------------------------
// Validation is a backstop against sending an obviously-broken document
// that would confuse the recipient — not a checklist for "complete"
// documents. The bar is: does the recipient have enough info to
// understand what this document is about?
//
// Adding a field here makes a previously-savable final doc unsavable.
// Be extra deliberate: prefer to leave it optional and let the user's
// own judgement gate sending.
//
// Numeric coercion
// ----------------
// Several fields (amounts, totals, quantities, rates) are entered
// through <input type="number"> which stores strings in React state.
// We use z.coerce.number() so a correctly-filled amount saved as the
// string "5000" still validates — the prior behaviour rejected these
// with a confusing "Expected number, received string" error despite
// the user having filled the field correctly.

// A tolerant number coercion — treats undefined/null/empty as missing
// (validation catches it), and numeric strings as numbers.
const coercedNumber = z.preprocess((v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number());

export const proposalRequiredSchema = z.object({
  // Proposals require only `overview` in the fields blob. The client
  // and project name live outside `fields`:
  //   - client identity → documents.client_id FK (enforced at send-modal
  //     level: the send UI won't open without a client attached).
  //   - project name    → documents.title column (enforced at create
  //     time: the create form's Save button is disabled without a title).
  // Checking fields.client_name / fields.project_title here was wrong —
  // the proposal editor never writes those keys (they're invoice/
  // SOW-only), so validation always tripped on them.
  overview: z.string().min(1, 'Overview is missing'),
}).passthrough();

export const contractRequiredSchema = z.object({
  parties: z.object({
    client:     z.string().min(1, 'Client name is missing'),
    freelancer: z.string().min(1, 'Your (service provider) name is missing'),
  }),
  project_description: z.string().min(1, 'Project description is missing'),
}).passthrough();

export const sowRequiredSchema = z.object({
  objectives: z.string().min(1, 'Objectives are missing'),
  deliverables: z.array(z.object({
    title: z.string().min(1),
  }).passthrough()).min(1, 'Add at least one deliverable'),
}).passthrough();

export const requirementsRequiredSchema = z.object({
  functional_requirements: z.array(z.object({
    requirement: z.string().min(1),
  }).passthrough()).min(1, 'Add at least one requirement'),
}).passthrough();

export const invoiceRequiredSchema = z.object({
  client_name: z.string().min(1, 'Client name is missing'),
  line_items: z.array(z.object({
    description: z.string().min(1),
    quantity:    coercedNumber.refine((n) => n > 0, 'must be greater than 0'),
    rate:        coercedNumber.refine((n) => n > 0, 'must be greater than 0'),
  }).passthrough()).min(1, 'Add at least one line item'),
  total: coercedNumber.refine((n) => n > 0, 'Invoice total must be greater than 0'),
}).passthrough();

export const deliveryRequiredSchema = z.object({
  project_summary: z.string().min(1, 'Project summary is missing'),
  deliverables: z.array(z.object({
    title: z.string().min(1),
  }).passthrough()).min(1, 'Add at least one deliverable'),
}).passthrough();

/**
 * Lookup map: doc type → required-fields Zod schema. Used by the
 * server action that gates draft → final transitions. Adding a new
 * doc type? Add a corresponding entry here — TypeScript will catch
 * the omission via the `Record<DocumentType, ...>` shape.
 */
export const DOC_REQUIRED_SCHEMAS = {
  proposal:     proposalRequiredSchema,
  contract:     contractRequiredSchema,
  sow:          sowRequiredSchema,
  requirements: requirementsRequiredSchema,
  invoice:      invoiceRequiredSchema,
  delivery:     deliveryRequiredSchema,
} as const;

// ─── FRIENDLY ERROR FORMATTING ─────────────────────────────────
// Zod paths and type names ("path: payment_schedule.0.amount —
// Expected number, received string") aren't user-facing copy. This
// map translates the path heads our required schemas actually produce
// into human labels. Paths not listed here fall back to
// title-cased-with-spaces — readable but less tailored.
const FIELD_LABELS: Record<string, string> = {
  client_name:         'Client name',
  project_title:       'Project title',
  project_description: 'Project description',
  project_summary:     'Project summary',
  overview:            'Overview',
  objectives:          'Objectives',
  'parties.client':       'Client name',
  'parties.freelancer':   'Service provider name',
  payment_schedule:       'Payment schedule',
  line_items:             'Line items',
  deliverables:           'Deliverables',
  functional_requirements:'Functional requirements',
  total:                  'Invoice total',
  description:            'Description',
  quantity:               'Quantity',
  rate:                   'Rate',
  title:                  'Title',
  requirement:            'Requirement',
  trigger:                'Milestone trigger',
  amount:                 'Milestone amount',
};

/**
 * Convert a Zod path segment array to a human label.
 *   ['payment_schedule', 0, 'amount'] → "Milestone amount (#1)"
 *   ['parties', 'client']             → "Client name"
 *   ['line_items', 2, 'rate']         → "Rate (line 3)"
 *   []                                → "Document"
 */
export function labelForZodPath(path: (string | number)[]): string {
  if (path.length === 0) return 'Document';

  // Join leading string segments to allow compound keys like
  // "parties.client" to hit the lookup table.
  const stringSegments = path.filter(p => typeof p === 'string') as string[];
  const compound = stringSegments.join('.');
  if (FIELD_LABELS[compound]) return FIELD_LABELS[compound];

  // Otherwise the last string wins (e.g. [...'line_items', 2, 'rate'] → 'rate')
  const last = stringSegments[stringSegments.length - 1];
  const base = last && FIELD_LABELS[last]
    ? FIELD_LABELS[last]
    : (last ?? 'Field').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

  // Append item index if the path descended through an array.
  const numeric = path.find(p => typeof p === 'number');
  if (typeof numeric === 'number') {
    return `${base} (item ${numeric + 1})`;
  }
  return base;
}

/**
 * Build a short human sentence summarising what's missing, given a
 * Zod error. Used by the updateDocument / shareDocument actions when
 * a final/sent transition fails validation.
 *
 * Output shape:
 *   "Before sending, please fill: Client name, Overview, and 2 more."
 *
 * Collapses duplicate labels, caps visible items at 3, and never
 * includes Zod error messages or path strings.
 */
export function formatValidationMessage(
  issues: readonly { path: (string | number)[] }[],
  action: 'send' | 'finalize' = 'send',
): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const issue of issues) {
    const label = labelForZodPath(issue.path);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  if (labels.length === 0) {
    return action === 'send'
      ? 'This document is missing some required information.'
      : 'Please complete the required fields before finalising.';
  }

  const verb = action === 'send' ? 'sending' : 'finalising';
  const visible = labels.slice(0, 3);
  const extra   = labels.length - visible.length;
  const list    = visible.length === 1
    ? visible[0]
    : visible.slice(0, -1).join(', ') + ' and ' + visible[visible.length - 1];

  return extra > 0
    ? `Before ${verb}, please fill: ${list} — and ${extra} more.`
    : `Before ${verb}, please fill: ${list}.`;
}

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

// ─── INVOICE ───
// Invoices are stored as `documents` rows with type='invoice' — the
// old public.invoices table was dropped in migration 012, and the
// per-doc-type `fields` validation lives in step 7 (the paperwork
// validation audit). Keeping this section as a deliberate reminder
// not to re-add a top-level invoiceSchema without wiring it into
// documents.ts.

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
  billing_cycle: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual']).default('monthly'),
  next_renewal_at: z.string().min(1, 'Next renewal date required'),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  auto_pay: z.boolean().default(false),
});
export type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

// ─── SOCIAL POST ───
export const socialPostSchema = z.object({
  mode: z.enum(['personal', 'agency']),
  // Platform enum matches the SocialPlatform type in types/index.ts.
  // github + twitter were removed — no creation paths exist for them.
  platform: z.enum(['linkedin', 'instagram', 'other']).default('linkedin'),
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
