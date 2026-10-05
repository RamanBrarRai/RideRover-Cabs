import { NavigationContainer } from '@react-navigation/native';
import { APP_ROLE } from '../config';
import { useAuth } from '../auth/AuthContext';
import { useProfile } from './ProfileProvider';
import { resolveGate } from './guards';
import Onboarding from '../screens/auth/Onboarding';
import AuthStack from '../screens/auth/AuthStack';
import { ConnectionProblem, ProfileSetup, Splash, WrongApp } from '../screens/auth/Gates';
import CustomerApp, { customerLinking } from '../screens/customer/CustomerApp';
import { DriverApp, DriverVerificationApp, driverLinking } from '../screens/driver/DriverApp';

/**
 * Decides, from the login state and the user's role, which complete app experience to show.
 * Each app (and its tab bar) is mounted once and stays mounted while the user moves between tabs.
 */
export default function RootNavigator() {
  const auth = useAuth();
  const prof = useProfile();
  const p = prof.profile;
  const needsSetup = !!p && (!p.fullName || (APP_ROLE === 'DRIVER' && !p.address));
  const gate = resolveGate({ auth: auth.status, role: auth.user?.role, appRole: APP_ROLE, seenOnboarding: auth.seenOnboarding, profile: prof.state, needsSetup, driverStatus: p?.status });

  switch (gate) {
    case 'LOADING': return <Splash />;
    case 'CONNECTION_PROBLEM': return <ConnectionProblem />;
    case 'ONBOARDING': return <Onboarding />;
    case 'AUTH': return <NavigationContainer><AuthStack /></NavigationContainer>;
    case 'PROFILE_SETUP': return <ProfileSetup />;
    case 'WRONG_APP': return <WrongApp />;
    case 'CUSTOMER_APP': return <NavigationContainer linking={customerLinking as any}><CustomerApp /></NavigationContainer>;
    case 'DRIVER_APP': return <NavigationContainer linking={driverLinking as any}><DriverApp /></NavigationContainer>;
    case 'DRIVER_VERIFICATION_APP': return <NavigationContainer linking={driverLinking as any}><DriverVerificationApp /></NavigationContainer>;
  }
}
