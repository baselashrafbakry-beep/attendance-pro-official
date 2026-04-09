// ============================================================
// useApp Hook — Main app hook
// ============================================================
import { useAppStore } from '../stores/appStore';

export function useApp() {
  return useAppStore();
}

export default useApp;
