// Shared, pure helpers for NotificationContext.*.test.js. jest.mock() calls
// themselves must stay in each test file (Babel hoists them per-file), but
// everything else is safe to share.
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { NotificationProvider, useNotifications } from './NotificationContext';

export const CACHE_KEY = '@jmd_notifications_cache';

export const SEED = [
  { id: 1, title: 'A', message: 'first', type: 'general', read: false },
  { id: 2, title: 'B', message: 'second', type: 'general', read: false },
];

export function makeNavigationRef() {
  return { current: { isReady: () => true, navigate: jest.fn() } };
}

export function renderProviderHook(navigationRef = makeNavigationRef()) {
  return renderHook(() => useNotifications(), {
    wrapper: ({ children }) => (
      <NotificationProvider navigationRef={navigationRef}>{children}</NotificationProvider>
    ),
  });
}

// Renders and waits for the initial cache-load + network-load mount effect
// to fully settle, leaving `notifications` == SEED (2 unread).
export async function renderSettledProvider() {
  const navigationRef = makeNavigationRef();
  const { result } = await renderProviderHook(navigationRef);
  // result.current can transiently be null between renders under RTL 14's
  // async renderHook/act — a bare `.loading` access on that would throw
  // instead of letting waitFor retry, so guard it explicitly.
  await waitFor(() => {
    expect(result.current).not.toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.notifications).toEqual(SEED);
  });
  return { result, navigationRef };
}
