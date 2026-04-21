'use server';
// ============================================================
// Business OS — Lab Server Actions
//
// Covers the Lab page (v3.3.1 addition — not in the original Vercel
// backlog but migrated for consistency). Three tables:
//   1. lab_projects — side projects, ideas, completed builds
//   2. lab_tools    — tools being evaluated / used / dropped
//   3. lab_skills   — skills being learned
//
// Lab tables are owner-private and have no `mode` column (they're
// always personal — no agency-lab notion exists).
//
// Canonical pattern — see subscriptions.ts.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from './subscriptions';

function revalidateLab(): void {
  revalidatePath('/dashboard/personal/lab');
}

// ════════════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════════════

const PROJECT_STATUSES = ['idea', 'active', 'paused', 'shipped', 'archived'] as const;
type ProjectStatus = typeof PROJECT_STATUSES[number];

const labProjectCreateSchema = z.object({
  title:       z.string().min(1, 'Title required'),
  description: z.string().nullable().optional(),
  status:      z.enum(PROJECT_STATUSES).default('idea'),
  tech_stack:  z.string().nullable().optional(),
  url:         z.string().nullable().optional(),
  repo_url:    z.string().nullable().optional(),
});
export type LabProjectCreateInput = z.input<typeof labProjectCreateSchema>;

export async function createLabProject(
  input: LabProjectCreateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = labProjectCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lab_projects')
    .insert({ ...parsed.data, user_id: ownerId })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

const labProjectUpdateSchema = labProjectCreateSchema.partial();
export type LabProjectUpdateInput = z.infer<typeof labProjectUpdateSchema>;

export async function updateLabProject(
  id: string,
  input: LabProjectUpdateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!id) return { ok: false, error: 'Project id required' };

  const parsed = labProjectUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lab_projects')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

export async function updateLabProjectStatus(
  id: string,
  status: ProjectStatus,
): Promise<ActionResult<{ id: string; status: ProjectStatus }>> {
  if (!id) return { ok: false, error: 'Project id required' };
  if (!PROJECT_STATUSES.includes(status)) return { ok: false, error: 'Invalid status' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('lab_projects')
    .update({ status })
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: { id, status } };
}

export async function deleteLabProject(id: string): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Project id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('lab_projects')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: { id } };
}

// ════════════════════════════════════════════════════════════════
// TOOLS
// ════════════════════════════════════════════════════════════════

const TOOL_STATUSES = ['evaluating', 'using', 'dropped'] as const;

const labToolCreateSchema = z.object({
  name:         z.string().min(1, 'Name required'),
  category:     z.string().default('other'),
  status:       z.enum(TOOL_STATUSES).default('evaluating'),
  notes:        z.string().nullable().optional(),
  url:          z.string().nullable().optional(),
  monthly_cost: z.number().default(0),
});
export type LabToolCreateInput = z.input<typeof labToolCreateSchema>;

export async function createLabTool(
  input: LabToolCreateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = labToolCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lab_tools')
    .insert({ ...parsed.data, user_id: ownerId })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

const labToolUpdateSchema = labToolCreateSchema.partial();
export type LabToolUpdateInput = z.infer<typeof labToolUpdateSchema>;

export async function updateLabTool(
  id: string,
  input: LabToolUpdateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!id) return { ok: false, error: 'Tool id required' };

  const parsed = labToolUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lab_tools')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

export async function deleteLabTool(id: string): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Tool id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('lab_tools')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: { id } };
}

// ════════════════════════════════════════════════════════════════
// SKILLS
// ════════════════════════════════════════════════════════════════

const SKILL_STATUSES = ['learning', 'practicing', 'solid'] as const;

const labSkillCreateSchema = z.object({
  name:     z.string().min(1, 'Name required'),
  category: z.string().default('other'),
  status:   z.enum(SKILL_STATUSES).default('learning'),
  resource: z.string().nullable().optional(),
  notes:    z.string().nullable().optional(),
});
export type LabSkillCreateInput = z.input<typeof labSkillCreateSchema>;

export async function createLabSkill(
  input: LabSkillCreateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = labSkillCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lab_skills')
    .insert({ ...parsed.data, user_id: ownerId })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

const labSkillUpdateSchema = labSkillCreateSchema.partial();
export type LabSkillUpdateInput = z.infer<typeof labSkillUpdateSchema>;

export async function updateLabSkill(
  id: string,
  input: LabSkillUpdateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!id) return { ok: false, error: 'Skill id required' };

  const parsed = labSkillUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lab_skills')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

export async function deleteLabSkill(id: string): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Skill id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('lab_skills')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateLab();
  return { ok: true, data: { id } };
}
