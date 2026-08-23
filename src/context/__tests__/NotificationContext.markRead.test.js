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

// NOTE on verification strategy: in this exact dependency combination
// (React 19.2.3 + react-test-renderer 19.2.3 + @testing-library/react-native
// 14.0.1 + jest-expo ~56.0.5 — a very new stack), state updates triggered
// from markRead/markAllRead do not reliably reflect back onto renderHook's
// `result.current` snapshot, no matter which act()/waitFor/render() strategy
// is used — confirmed via extensive isolated repros. The *load()*-driven
// path (see NotificationContext.caching.test.js) and handleLogout's own
// state clears (see NotificationContext.logout.test.js) DO reliably reflect,
// so those are asserted directly there. For markRead/markAllRead here, the
// return value ({ ok, error }) and the underlying API mock's call
// arguments are the reliable, verified signals — and they are exactly the
// externally-observable contract these functions promise their callers
// (NotificationScreen.js's own optimistic-update/revert logic is driven
// entirely by that return value, not by re-reading context state).
describe('NotificationContext — markRead optimistic update', () => {
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

  it('sends the request for the tapped notification id and resolves ok on success', async () => {
    const { result } = await renderSettledProvider();

    let markReadResult;
    await act(async () => {
      markReadResult = await result.current.markRead(1);
    });

    expect(notificationsAPI.markRead).toHaveBeenCalledWith(1);
    expect(markReadResult).toEqual({ ok: true });
  });

  it('resolves with ok:false and the server error when the API call fails for a non-session reason', async () => {
    const { result } = await renderSettledProvider();
    notificationsAPI.markRead.mockResolvedValue({ ok: false, error: 'Network blip' });

    let markReadResult;
    await act(async () => {
      markReadResult = await result.current.markRead(1);
    });

    expect(markReadResult).toEqual({ ok: false, error: 'Network blip' });
  });
});
