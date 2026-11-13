import { useSyncExternalStore } from 'react';

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Two-column desktop layout and centred sheets. Keep in step with the 960px breakpoint in app.css. */
export const useIsWide = () => useMedia('(min-width: 960px)');
export const usePrefersDark = () => useMedia('(prefers-color-scheme: dark)');
