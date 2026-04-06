import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendance.salarytracker',
  appName: 'متتبع الحضور والراتب',
  webDir: 'dist',
  
  // ← رابط Netlify المباشر - يتم التحديث تلقائياً
  server: {
    url: 'https://dazzling-starburst-f119ef.netlify.app',
    cleartext: false,
  },

  android: {
    allowMixedContent: false,
    backgroundColor: '#0f172a',
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
