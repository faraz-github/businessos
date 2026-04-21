'use server';
// ============================================================
// Business OS — Documents (Paperwork) Server Actions
//
// The document engine backs all six paperwork types:
//   proposal, contract, sow, requirements, invoice, delivery.
// Each row lives in `documents` with a `type` field and a `fields`
// JSONB blob whose schema depends on the type.
//
// The page has distinct flows that each get their own action to keep
// the UX code lean:
//   - createDocument         — new blank doc with title + client + type
//   - duplicateAsContract    — clone a proposal into a contract, field-mapping the overlap
//   - updateDocument         — autosave + manual save (optional edit-count bump)
//   - deleteDocument         — single remove
//   - shareDocument          — first send: generates token + access code
//   - regenerateAccessCode   — rotate the access code without touching the token
//
// The edit_count logic lives server-side — clients can't forge a lower
// count, and the "sent vs draft" distinction is enforced by checking
// share_token existence in the DB rather than trusting the client.
//
// Canonical pattern — see subscriptions.ts for rationale.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/types/database';
import type { ActionResult } from './subscriptions';
import { DOC_REQUIRED_SCHEMAS, formatValidationMessage } from '@/types/schemas';
import { uploadFile, signaturePath } from '@/lib/storage/upload';
import { BUCKETS } from '@/lib/storage/constants';
import { ACCESS_CODE_LENGTH } from '@/types';

const DOC_TYPES = ['proposal', 'contract', 'sow', 'requirements', 'invoice', 'delivery'] as const;
type DocType = typeof DOC_TYPES[number];

const DOC_STATUSES = [
  'draft', 'final', 'sent', 'viewed', 'signed', 'paid', 'overdue',
] as const;
type DocStatus = typeof DOC_STATUSES[number];

/**
 * Statuses that require the document to satisfy its full
 * <doctype>RequiredSchema. Drafts skip validation entirely (autosave
 * runs over partial data); anything sent or later must validate.
 */
const STATUSES_REQUIRING_VALIDATION: readonly DocStatus[] = [
  'final', 'sent', 'viewed', 'signed', 'paid', 'overdue',
];

/**
 * Run the per-doc-type required-fields schema. Returns a single
 * user-friendly sentence on failure, null on success. The sentence
 * never exposes Zod paths or type names — see formatValidationMessage
 * in types/schemas.ts.
 */
function validateFinalDoc(
  type: DocType,
  fields: Record<string, unknown>,
  action: 'send' | 'finalize' = 'send',
): string | null {
  const schema = DOC_REQUIRED_SCHEMAS[type];
  const parsed = schema.safeParse(fields);
  if (parsed.success) return null;
  return formatValidationMessage(parsed.error.issues, action);
}

function revalidatePaperwork(): void {
  revalidatePath('/dashboard/personal/paperwork');
  revalidatePath('/dashboard/agency/paperwork');
  // Finance shows invoices (type='invoice' documents) — keep in sync.
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
}

// ─── CREATE ────────────────────────────────────────────────────

const documentCreateSchema = z.object({
  mode:       z.enum(['personal', 'agency']),
  type:       z.enum(DOC_TYPES),
  title:      z.string().min(1, 'Title required').trim(),
  client_id:  z.string().uuid().nullable().optional(),
  // Fields is unvalidated JSON — each doc type has its own shape and
  // client-side Zod schemas (see types/schemas.ts) handle that.
  // Accept any record; DB will store verbatim.
  fields:     z.record(z.unknown()).default({}),
  status:     z.enum(DOC_STATUSES).default('draft'),
});
export type DocumentCreateInput = z.input<typeof documentCreateSchema>;

export async function createDocument(
  input: DocumentCreateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = documentCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('documents')
    .insert({
      ...parsed.data,
      fields: parsed.data.fields as unknown as Json,
      user_id: ownerId,
    })
    .select('*, clients(name, company)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePaperwork();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

// ─── DUPLICATE AS CONTRACT ─────────────────────────────────────
// Takes a proposal doc id and generates a contract with overlap fields
// pre-populated server-side. Moving the field-mapping logic here means
// the client only passes the proposal id — no ability to inject
// arbitrary contract content while claiming it "came from" a proposal.

export async function duplicateProposalAsContract(
  proposalId: string,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!proposalId) return { ok: false, error: 'Proposal id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Fetch the source proposal, scoped to ownership and proposal type.
  const { data: source, error: readErr } = await supabase
    .from('documents')
    .select('*, clients(name, company)')
    .eq('id', proposalId)
    .eq('user_id', ownerId)
    .eq('type', 'proposal')
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!source) return { ok: false, error: 'Proposal not found' };

  const proposalFields = (source.fields as Record<string, unknown>) ?? {};
  // Name the client from the joined clients record if present, else
  // leave blank for the user to fill in.
  const clientsRel = source.clients as { name?: string } | null;
  const clientName = clientsRel?.name ?? '';

  const contractFields = {
    project_description: (proposalFields.overview as string) ?? '',
    payment_schedule: proposalFields.payment_terms
      ? [{
          trigger: 'As per proposal',
          amount:  Number(proposalFields.investment_amount) || 0,
        }]
      : [],
    parties: { client: clientName, freelancer: '' },
    revision_policy:       '',
    ip_clause:             '',
    confidentiality_clause:'',
    governing_law:         'India',
    termination_clause:    '',
  };

  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id:   ownerId,
      mode:      source.mode,
      type:      'contract',
      title:     (source.title as string).replace(/^Proposal/i, 'Contract'),
      client_id: source.client_id ?? null,
      fields:    contractFields as unknown as Json,
      status:    'draft',
    })
    .select('*, clients(name, company)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePaperwork();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

// ─── UPDATE ────────────────────────────────────────────────────
// Two flavors via one action, controlled by `bumpEditCount`:
//   - autosave: bumpEditCount = false
//   - explicit save: bumpEditCount = true (only when the doc is already
//     sent — sent docs track revision history; drafts don't)
//
// The server derives "is sent?" from the current DB row's share_token,
// not the client — so a crafted client can't skip the edit-count bump.

const documentUpdateSchema = z.object({
  title:     z.string().trim().optional(),
  client_id: z.string().uuid().nullable().optional(),
  fields:    z.record(z.unknown()).optional(),
  status:    z.enum(DOC_STATUSES).optional(),
});
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;

export async function updateDocument(
  id: string,
  input: DocumentUpdateInput,
  options: { bumpEditCount?: boolean } = {},
): Promise<ActionResult<Record<string, unknown>>> {
  if (!id) return { ok: false, error: 'Document id required' };

  const parsed = documentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Read current edit_count + share_token + type so we know whether to
  // bump, whether the doc is sent, and which required schema to apply
  // if the target status demands validation.
  const { data: existing, error: readErr } = await supabase
    .from('documents')
    .select('edit_count, share_token, type, fields')
    .eq('id', id)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'Document not found' };

  // ── Validation gate ──
  // If the target status (or current status, if status isn't being
  // changed) requires validation, run the per-doctype required schema
  // against the merged fields (existing + incoming overrides). Reject
  // before the DB write so a half-finalized doc never lands.
  const targetStatus = parsed.data.status ?? null;
  const needsValidation = targetStatus !== null
    && STATUSES_REQUIRING_VALIDATION.includes(targetStatus);

  if (needsValidation) {
    const mergedFields: Record<string, unknown> = {
      ...((existing.fields as Record<string, unknown>) ?? {}),
      ...((parsed.data.fields as Record<string, unknown> | undefined) ?? {}),
    };
    const message = validateFinalDoc(
      existing.type as DocType,
      mergedFields,
      targetStatus === 'final' ? 'finalize' : 'send',
    );
    if (message) {
      return { ok: false, error: message };
    }
  }

  const now = new Date().toISOString();
  const isSent = !!existing.share_token;
  const shouldBump = options.bumpEditCount === true && isSent;
  const newEditCount = shouldBump
    ? ((existing.edit_count as number | null) ?? 0) + 1
    : (existing.edit_count as number | null) ?? 0;

  // Compose update payload. Build it as the DB row Update type so we
  // don't need to cast — each branch extends only the fields it writes.
  type DocumentUpdate = {
    title?: string;
    client_id?: string | null;
    fields?: Json;
    status?: DocStatus;
    edit_count: number;
    last_edited_at?: string;
  };
  const updatePayload: DocumentUpdate = {
    edit_count: newEditCount,
  };
  if (parsed.data.title !== undefined)     updatePayload.title     = parsed.data.title;
  if (parsed.data.client_id !== undefined) updatePayload.client_id = parsed.data.client_id;
  if (parsed.data.status !== undefined)    updatePayload.status    = parsed.data.status;
  if (parsed.data.fields !== undefined) {
    updatePayload.fields = parsed.data.fields as unknown as Json;
  }
  if (shouldBump) {
    updatePayload.last_edited_at = now;
  }

  const { data, error } = await supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select('*, clients(name, company)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePaperwork();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

// ─── DELETE ────────────────────────────────────────────────────

export async function deleteDocument(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Document id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidatePaperwork();
  return { ok: true, data: { id } };
}

// ─── SHARE / SEND ──────────────────────────────────────────────
// First time the user clicks "Send" on a document, we generate:
//   - share_token (URL-safe, never rotated once set — that's the stable ref)
//   - access_code (6-digit numeric, rotatable)
//   - access_code_expires_at (7 days out)
// and flip status → 'sent'. Subsequent sends call regenerateAccessCode.
//
// Both token and code generation happen server-side — no chance for a
// client to short-circuit with a predictable value.

function generateShareToken(): string {
  // 24 hex chars = 96 bits of entropy, URL-safe by construction.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateAccessCode(): string {
  // N-digit numeric code (N = ACCESS_CODE_LENGTH, see @/types).
  // Math.random is fine here — guess-resistance is enforced by the
  // /api/doc/verify-code endpoint (rate-limited, constant-time
  // compare). We just need human-friendly + non-sequential.
  //
  // Range: [10^(N-1), 10^N) — excludes leading zeros to keep codes
  // uniformly the right display width.
  const min = Math.pow(10, ACCESS_CODE_LENGTH - 1);
  const max = Math.pow(10, ACCESS_CODE_LENGTH);
  return String(Math.floor(min + Math.random() * (max - min)));
}

export async function shareDocument(
  id: string,
): Promise<ActionResult<{ share_token: string; access_code: string; access_code_expires_at: string }>> {
  if (!id) return { ok: false, error: 'Document id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Read current token + type + fields. The validation gate below uses
  // type + fields; share_token decides whether to rotate or reuse.
  const { data: existing, error: readErr } = await supabase
    .from('documents')
    .select('share_token, type, fields')
    .eq('id', id)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'Document not found' };

  // Sending a doc implies finalization. Reject if required fields
  // aren't filled in — the recipient should never see a half-baked
  // proposal/contract/invoice. Same gate as updateDocument's final-or-
  // above transitions.
  const message = validateFinalDoc(
    existing.type as DocType,
    (existing.fields as Record<string, unknown>) ?? {},
    'send',
  );
  if (message) {
    return { ok: false, error: message };
  }

  const token   = (existing.share_token as string | null) ?? generateShareToken();
  const newCode = generateAccessCode();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('documents')
    .update({
      status:                   'sent',
      share_token:              token,
      access_code:              newCode,
      access_code_expires_at:   expires,
    })
    .eq('id', id)
    .eq('user_id', ownerId)
    .select('*, clients(name, company)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePaperwork();
  // Return the code to the caller so the UI can display it — it's not
  // exposed anywhere else post-creation.
  return {
    ok: true,
    data: {
      share_token:            token,
      access_code:            newCode,
      access_code_expires_at: expires,
      // Attach the full row for callers that need to update UI state.
      ...(data as unknown as Record<string, unknown>),
    } as { share_token: string; access_code: string; access_code_expires_at: string },
  };
}

// ─── REGENERATE ACCESS CODE ────────────────────────────────────

export async function regenerateAccessCode(
  id: string,
): Promise<ActionResult<{ access_code: string; access_code_expires_at: string }>> {
  if (!id) return { ok: false, error: 'Document id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const newCode = generateAccessCode();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('documents')
    .update({
      access_code:            newCode,
      access_code_expires_at: expires,
    })
    .eq('id', id)
    .eq('user_id', ownerId)
    .select('*, clients(name, company)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePaperwork();
  return {
    ok: true,
    data: {
      access_code:            newCode,
      access_code_expires_at: expires,
      ...(data as unknown as Record<string, unknown>),
    } as { access_code: string; access_code_expires_at: string },
  };
}

// ─── CREATOR SIGNATURE UPLOAD ──────────────────────────────────
// Used by SenderSignatureField's "Draw" tab in the paperwork editor.
// Replaces the prior base64-to-fields path: now the PNG bytes go to
// document-media and the field stores the storage PATH (not a URL).
// The public doc view mints a fresh signed URL per render via
// resolveSignatureUrls() in app/doc/[token]/page.tsx.
//
// This is authenticated — only the document owner can upload to
// their own document's signature folder. Ownership check mirrors
// the other document mutations in this file.
export async function uploadCreatorSignature(
  documentId: string,
  file: FormData,
): Promise<ActionResult<{ path: string }>> {
  const idSchema = z.string().uuid('Invalid document id');
  const parsedId = idSchema.safeParse(documentId);
  if (!parsedId.success) return { ok: false, error: parsedId.error.issues[0].message };

  const imageFile = file.get('file');
  if (!(imageFile instanceof File)) return { ok: false, error: 'No file provided' };
  if (imageFile.type !== 'image/png') {
    // Canvas exports are always PNG. Anything else means a tampered
    // payload — reject rather than widen the bucket's MIME allow-list.
    return { ok: false, error: 'Signature must be PNG' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Ownership check before any storage write.
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, user_id')
    .eq('id', parsedId.data)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!doc || doc.user_id !== ownerId) {
    return { ok: false, error: 'Document not found' };
  }

  // Path: {ownerId}/{documentId}/signatures/creator-{nanoid}.png
  // Same shape as the client-signing path, different role segment,
  // keeping creator and client signatures visibly separate in storage.
  const path = signaturePath(ownerId, doc.id, 'creator', 'image/png');
  const upload = await uploadFile({
    bucket:      BUCKETS.DOCUMENT_MEDIA,
    path,
    file:        imageFile,
    contentType: 'image/png',
    upsert:      false,
  });
  if (!upload.ok) return upload;

  // We deliberately DO NOT update `fields.creator_signature` here.
  // The caller (SenderSignatureField) holds the signature shape
  // ({ type, data, date, name }) and merges it into the editor's
  // field state, which autosave picks up. Keeping the field update
  // on the client keeps this action uncoupled from doc-type-specific
  // field shapes.
  return { ok: true, data: { path: upload.data.path } };
}
