import { CommonActions } from '@react-navigation/native';

// Several tab screens are nested: Root Stack → MainTabs (Tab) → <Screen>Tab.
// 'Login' lives in the Root Stack, not in the Tab navigator, so navigating
// there on session expiry has to dispatch to the Root Stack (the Tab's
// parent) rather than the Tab navigator itself.
export function goToLogin(navigation) {
  const rootNav = navigation.getParent() ?? navigation;
  rootNav.dispatch(
    CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
  );
}
