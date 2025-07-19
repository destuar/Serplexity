/**
 * @file useNavigation.ts
 * @description Hook for accessing navigation context
 */

import { useContext } from 'react';
import { NavigationContext } from '../contexts/NavigationContextTypes';

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}; 