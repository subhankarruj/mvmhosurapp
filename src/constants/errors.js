// Centralized app error codes — never string-match a raw literal at the call
// site. apiService.js throws these; screens compare against them.
export const ERR_SESSION_EXPIRED = 'SESSION_EXPIRED';
