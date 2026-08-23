import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'https://prod.example.com/api',
        apiUrlLocal: 'http://local.example.com/api',
      },
    },
  },
}));

import {
  authAPI,
  notificationsAPI,
  saveTokens,
  getAccessToken,
  getRefreshToken,
} from '../apiService';
import { ERR_SESSION_EXPIRED } from '../../constants/errors';

// ── fetch Response mock helpers ────────────────────────────────────────────
// safeJson() reads response.text() (never response.json() directly) and only
// JSON.parses when content-type says so — these helpers mirror that contract
// so the tests exercise the real parsing branches, not a shortcut.
function jsonResponse(status, body) {
  const ok = status >= 200 && status < 300;
  return {
    status,
    ok,
    headers: { get: () => 'application/json' },
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  };
}

function emptyResponse(status) {
  const ok = status >= 200 && status < 300;
  return {
    status,
    ok,
    headers: { get: () => 'application/json' },
    text: jest.fn().mockResolvedValue(''),
    json: jest.fn().mockResolvedValue(undefined),
  };
}

function htmlResponse(status) {
  const ok = status >= 200 && status < 300;
  return {
    status,
    ok,
    headers: { get: () => 'text/html' },
    text: jest.fn().mockResolvedValue('<html>Bad Gateway</html>'),
    json: jest.fn(),
  };
}

function malformedJsonResponse(status) {
  const ok = status >= 200 && status < 300;
  return {
    status,
    ok,
    headers: { get: () => 'application/json' },
    text: jest.fn().mockResolvedValue('{not valid json'),
    json: jest.fn(),
  };
}

describe('apiService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    global.fetch = jest.fn();
  });

  describe('request() — automatic 401 refresh', () => {
    it('refreshes the access token and retries the original request once, using the new token', async () => {
      await saveTokens('old-access', 'valid-refresh');

      global.fetch
        .mockResolvedValueOnce(jsonResponse(401, { success: false, message: 'Token expired. Please refresh.' }))
        .mockResolvedValueOnce(jsonResponse(200, {
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        }))
        .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 1, name: 'Test User' } }));

      const result = await authAPI.me();

      expect(result).toEqual({ id: 1, name: 'Test User' });
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // First call: original request with the old token.
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer old-access');
      // Second call: the refresh request itself.
      expect(global.fetch.mock.calls[1][0]).toEqual(expect.stringContaining('/auth/refresh'));
      // Third call: retry of the original request, now with the NEW token.
      expect(global.fetch.mock.calls[2][0]).toEqual(expect.stringContaining('/auth/me'));
      expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new-access');

      expect(await getAccessToken()).toBe('new-access');
      expect(await getRefreshToken()).toBe('new-refresh');
    });

    it('throws ERR_SESSION_EXPIRED and clears the session when the refresh endpoint itself 401s', async () => {
      await saveTokens('old-access', 'stale-refresh');

      global.fetch
        .mockResolvedValueOnce(jsonResponse(401, { success: false, message: 'Invalid token.' }))
        .mockResolvedValueOnce(jsonResponse(401, { success: false, message: 'Invalid or expired refresh token.' }));

      await expect(authAPI.me()).rejects.toThrow(ERR_SESSION_EXPIRED);
      expect(global.fetch).toHaveBeenCalledTimes(2); // no retry attempted — refresh failed first
      expect(await getAccessToken()).toBeNull();
      expect(await getRefreshToken()).toBeNull();
    });

    it('throws ERR_SESSION_EXPIRED without attempting a refresh call when no refresh token is stored', async () => {
      await saveTokens('old-access', ''); // falsy — getRefreshToken() will short-circuit _doRefresh

      global.fetch.mockResolvedValueOnce(jsonResponse(401, { success: false, message: 'Invalid token.' }));

      await expect(authAPI.me()).rejects.toThrow(ERR_SESSION_EXPIRED);
      expect(global.fetch).toHaveBeenCalledTimes(1); // never called /auth/refresh
    });

    it('throws ERR_SESSION_EXPIRED when the retried request is still 401 even after a successful refresh', async () => {
      await saveTokens('old-access', 'valid-refresh');

      global.fetch
        .mockResolvedValueOnce(jsonResponse(401, { success: false, message: 'Invalid token.' }))
        .mockResolvedValueOnce(jsonResponse(200, {
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        }))
        .mockResolvedValueOnce(jsonResponse(401, { success: false, message: 'Invalid token.' }));

      await expect(authAPI.me()).rejects.toThrow(ERR_SESSION_EXPIRED);
      expect(global.fetch).toHaveBeenCalledTimes(3);
      // Session is cleared even though a refresh nominally "succeeded" —
      // the retried request still rejected it, so it's genuinely gone.
      expect(await getAccessToken()).toBeNull();
      expect(await getRefreshToken()).toBeNull();
    });

    it('treats a non-JSON (e.g. HTML 502) refresh response as a failed refresh, never JSON-parsing it', async () => {
      await saveTokens('old-access', 'valid-refresh');

      global.fetch
        .mockResolvedValueOnce(jsonResponse(401, { success: false, message: 'Invalid token.' }))
        .mockResolvedValueOnce(htmlResponse(502));

      await expect(authAPI.me()).rejects.toThrow(ERR_SESSION_EXPIRED);
      expect(await getAccessToken()).toBeNull();
    });
  });

  describe('safeJson() parsing behavior', () => {
    beforeEach(async () => {
      await saveTokens('access-token', 'refresh-token');
    });

    it('parses a valid JSON success body', async () => {
      global.fetch.mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [{ id: 1, read: false }] })
      );
      const list = await notificationsAPI.getAll();
      expect(list).toEqual([{ id: 1, read: false }]);
    });

    it('treats an empty-but-ok body as { success: true } rather than failing to parse', async () => {
      global.fetch.mockResolvedValueOnce(emptyResponse(200));
      const list = await notificationsAPI.getAll();
      expect(list).toEqual([]); // data.data is undefined on an empty body -> `|| []`
    });

    it('throws a clean "Server error" message for an empty, non-ok body', async () => {
      global.fetch.mockResolvedValueOnce(emptyResponse(500));
      await expect(notificationsAPI.getAll()).rejects.toThrow('Server error (500)');
    });

    it('throws a clean "Server error" message for a non-JSON body without ever parsing it', async () => {
      global.fetch.mockResolvedValueOnce(htmlResponse(502));
      await expect(notificationsAPI.getAll()).rejects.toThrow('Server error (502)');
    });

    it('throws a clean "Server error" message instead of a raw JSON.parse crash on a malformed body', async () => {
      global.fetch.mockResolvedValueOnce(malformedJsonResponse(200));
      await expect(notificationsAPI.getAll()).rejects.toThrow('Server error (200)');
    });

    it('surfaces the server-provided message when the JSON body reports success: false', async () => {
      global.fetch.mockResolvedValueOnce(
        jsonResponse(404, { success: false, message: 'Notification not found.' })
      );
      // markRead() catches request()'s throw internally and returns {ok, error}
      // rather than throwing — this is the shape NotificationContext relies on.
      await expect(notificationsAPI.markRead(999)).resolves.toEqual({
        ok: false,
        error: 'Notification not found.',
      });
    });

    it('prefers errors[0].message over a top-level message when both are present (express-validator shape)', async () => {
      global.fetch.mockResolvedValueOnce(
        jsonResponse(400, {
          success: false,
          message: 'Request failed',
          errors: [{ msg: 'ignored', message: 'Valid notification id required.' }],
        })
      );
      await expect(notificationsAPI.markRead(-1)).resolves.toEqual({
        ok: false,
        error: 'Valid notification id required.',
      });
    });
  });
});
