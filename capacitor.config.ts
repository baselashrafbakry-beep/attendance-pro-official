import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendance.salarytracker',
  appName: 'متتبع الحضور والراتب',
  webDir: 'dist',
  // بدون server.url = التطبيق يعمل من الـ dist المحلي داخل الـ APK
  // هذا يجعله يعمل offline وبدون أي قيود على الـ authentication
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f172a',
    minWebViewVersion: 80,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
