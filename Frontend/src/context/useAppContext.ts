import { useContext } from 'react';
import { AppContext, type AppContextValue } from './appContextValue';

export const useAppContext = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
