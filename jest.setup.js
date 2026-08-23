// React 19 requires the test environment to explicitly opt in to act()
// tracking — without this, state updates inside renderHook()/act() warn
// ("not configured to support act(...)") and RTL's `result` never populates.
global.IS_REACT_ACT_ENVIRONMENT = true;
