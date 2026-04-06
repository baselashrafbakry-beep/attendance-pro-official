// Re-export shared pages
export { default as SettingsPage } from './SettingsPage';
export { default as AboutPage } from './AboutPage';

// ChangePasswordPage as a standalone page
import SettingsPage from './SettingsPage';
export function ChangePasswordPage() {
  return <SettingsPage />;
}
