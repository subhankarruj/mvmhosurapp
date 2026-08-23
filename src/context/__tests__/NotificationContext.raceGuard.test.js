import { act, cleanup } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { notificationsAPI } from '../../services/apiService';
import { SEED, renderSettledProvider } from '../notificationContextTestUtils';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
}));

jest.mock('../../services/apiService', () => ({
  notificationsAPI: {
    getAll: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  },
}));

jest.mock('../../utils/navigation', () => ({
  goToLogin: jest.fn(),
}));

jest.mock('../UserContext', () => ({
  useUser: () => ({ setUser: jest.fn() }),
}));

// See the verification-strategy note at the top of
// NotificationContext.markRead.test.js — direct `result.current` state
// inspection after a markRead/markAllRead call is unreliable in this exact
// dependency stack, so the guard is verified through what IS reliable: each
// call's own returned { ok, error }. That return value is precisely the
// guard's observable contract — `ok: true` means "superseded, don't revert",
// `ok: false` means "revert normally" — so this still directly exercises the
// logic in question, not a proxy for it.
describe('NotificationContext — inFlightMarkAllTs race-condition guard', () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    notificationsAPI.getAll.mockReset();
    notificationsAPI.markRead.mockReset();
    notificationsAPI.markAllRead.mockReset();
    await AsyncStorage.clear();
    notificationsAPI.getAll.mockResolvedValue(SEED);
    notificationsAPI.markRead.mockResolvedValue({ ok: true });
    notificationsAPI.markAllRead.mockResolvedValue({ ok: true });
    Notifications.addNotificationReceivedListener.mockReturnValue({ remove: jest.fn() });
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks(); // undo any Date.now spies from a test
  });

  it('reports markRead as ok when a later, successful markAllRead supersedes its failure', async () => {
    const { result } = await renderSettledProvider();

    // markRead's underlying request resolves (with failure) only after
    // markAllRead has already fully completed — a real, bounded delay.
    notificationsAPI.markRead.mockImplementation(
      () => new Promise((res) => setTimeout(() => res({ ok: false, error: 'Timed out' }), 40))
    );
    notificationsAPI.markAllRead.mockResolvedValue({ ok: true });

    // markRead's `startedAt` must read strictly earlier than markAllRead's
    // `ts` for the guard to engage — pin Date.now() so the ordering is
    // deterministic instead of racing on real clock resolution.
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)  // markRead's startedAt
      .mockReturnValueOnce(2000); // markAllRead's ts

    // markRead's own optimistic-update state changes (setNotifications/
    // setUnreadCount, fired synchronously inside updateNotifications before
    // its own first await) need to happen inside a tracked act() scope, or
    // React logs "not wrapped in act(...)" — yielding two microtasks here
    // gives them a chance to run while still inside this act() call.
    let markReadPromise;
    await act(async () => {
      markReadPromise = result.current.markRead(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    let markAllReadResult;
    await act(async () => {
      markAllReadResult = await result.current.markAllRead();
    });
    expect(markAllReadResult).toEqual({ ok: true });

    let markReadResult;
    await act(async () => {
      markReadResult = await markReadPromise;
    });

    // The guard reports success for markRead even though its own request
    // failed — the already-committed markAllRead is authoritative.
    expect(markReadResult).toEqual({ ok: true });
  });

  it('reports markRead as a normal failure when no markAllRead is in flight', async () => {
    const { result } = await renderSettledProvider();
    notificationsAPI.markRead.mockResolvedValue({ ok: false, error: 'Timed out' });

    let markReadResult;
    await act(async () => {
      markReadResult = await result.current.markRead(1);
    });

    expect(markReadResult).toEqual({ ok: false, error: 'Timed out' });
  });

  it('clears the in-flight marker when markAllRead itself fails, so a concurrent markRead still reports its own failure', async () => {
    const { result } = await renderSettledProvider();

    notificationsAPI.markRead.mockImplementation(
      () => new Promise((res) => setTimeout(() => res({ ok: false, error: 'Timed out' }), 40))
    );
    notificationsAPI.markAllRead.mockResolvedValue({ ok: false, error: 'Server error' });

    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)  // markRead's startedAt
      .mockReturnValueOnce(2000); // markAllRead's ts

    // markRead's own optimistic-update state changes (setNotifications/
    // setUnreadCount, fired synchronously inside updateNotifications before
    // its own first await) need to happen inside a tracked act() scope, or
    // React logs "not wrapped in act(...)" — yielding two microtasks here
    // gives them a chance to run while still inside this act() call.
    let markReadPromise;
    await act(async () => {
      markReadPromise = result.current.markRead(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    let markAllReadResult;
    await act(async () => {
      markAllReadResult = await result.current.markAllRead();
    });
    expect(markAllReadResult).toEqual({ ok: false, error: 'Server error' });

    let markReadResult;
    await act(async () => {
      markReadResult = await markReadPromise;
    });

    // markAllRead did NOT succeed — the marker must have been cleared, so
    // markRead reports its own real failure instead of being told it was
    // superseded by a (nonexistent) successful markAllRead.
    expect(markReadResult).toEqual({ ok: false, error: 'Timed out' });
  });
});
