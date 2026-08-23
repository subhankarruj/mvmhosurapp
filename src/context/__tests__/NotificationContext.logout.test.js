import { act, waitFor, cleanup } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { notificationsAPI } from '../../services/apiService';
import { goToLogin } from '../../utils/navigation';
import { ERR_SESSION_EXPIRED } from '../../constants/errors';
import {
  CACHE_KEY,
  SEED,
  renderProviderHook,
  renderSettledProvider,
} from '../notificationContextTestUtils';

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

const mockSetUser = jest.fn();
jest.mock('../UserContext', () => ({
  useUser: () => ({ setUser: mockSetUser }),
}));

describe('NotificationContext — handleLogout on ERR_SESSION_EXPIRED', () => {
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

  it('logs out (clears user, in-memory state, and cache; navigates to Login) when markRead reports a dead session', async () => {
    const { result, navigationRef } = await renderSettledProvider();
    notificationsAPI.markRead.mockResolvedValue({ ok: false, error: ERR_SESSION_EXPIRED });

    await act(async () => {
      await result.current.markRead(1);
    });

    expect(mockSetUser).toHaveBeenCalledWith(null);
    expect(goToLogin).toHaveBeenCalledWith(navigationRef.current);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('logs out when markAllRead reports a dead session', async () => {
    const { result } = await renderSettledProvider();
    notificationsAPI.markAllRead.mockResolvedValue({ ok: false, error: ERR_SESSION_EXPIRED });

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockSetUser).toHaveBeenCalledWith(null);
    expect(goToLogin).toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
  });

  it('logs out when load() itself detects a dead session (getAll() throwing ERR_SESSION_EXPIRED)', async () => {
    notificationsAPI.getAll.mockRejectedValue(new Error(ERR_SESSION_EXPIRED));

    await renderProviderHook();

    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(null));
    expect(goToLogin).toHaveBeenCalled();
  });
});
