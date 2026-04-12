import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendance.salarytracker',
  appName: 'متتبع الحضور والراتب',
  webDir: 'dist',
  server: {
    // Production URL — التطبيق يشير للـ Vercel مباشرة
    // هذا يضمن أن التطبيق يحمّل أحدث إصدار دائماً
    url: 'https://attendance-salary-tracker-2kgv285go.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
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
