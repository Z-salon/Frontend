import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { BusinessProvider } from './BusinessContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BusinessProvider>{children}</BusinessProvider>
    </AuthProvider>
  );
}