// Re-exports for ergonomic imports from '@/hooks'.
// Import from the specific file when you need to avoid pulling
// all of them in (matters for Server Components — these are all client-only).

export { useDebounce } from './use-debounce';
export { useAutoSave } from './use-auto-save';
export type { UseAutoSaveOptions, UseAutoSaveResult } from './use-auto-save';
export { useUser } from './use-user';
export type { CurrentUser } from './use-user';
export { useSupabaseRealtime } from './use-realtime';
export type { UseRealtimeOptions, RealtimeEvent } from './use-realtime';
