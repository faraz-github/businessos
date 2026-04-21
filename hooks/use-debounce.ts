'use client';
// ============================================================
// Business OS — useDebounce
// Debounces a value — returns `value` only after it has stayed
// unchanged for `delay` ms. Standard pattern for search inputs,
// filter fields, anything that triggers a query on change.
// ============================================================

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
