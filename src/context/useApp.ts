import { useContext } from 'react';
import { AppContext } from './AppContextDefinition';

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider.');
  return context;
}
