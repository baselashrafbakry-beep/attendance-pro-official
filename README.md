# متتبع الحضور والراتب - برو

## نظرة عامة على المشروع
- **الاسم**: متتبع الحضور والراتب - برو
- **الإصدار**: v6.5.0
- **الهدف**: نظام متكامل لتتبع الحضور وحساب الرواتب للشركات والمؤسسات
- **المطور**: م باسل اشرف | 📞 01014543845

## الروابط المهمة
- **الموقع (Vercel)**: https://attendance-salary-tracker.vercel.app
- **GitHub Repository**: https://github.com/baselashrafbakry-beep/attendance-pro-official
- **آخر إصدار APK**: https://github.com/baselashrafbakry-beep/attendance-pro-official/releases/latest

## بيانات الدخول التجريبية
| المستخدم | اسم المستخدم | كلمة المرور | الدور |
|---------|------------|------------|------|
| المدير | admin | admin123 | مدير |
| باسل أشرف | basel2026 | basel123 | موظف |
| محمد جبريل | gebrel | gebrel123 | موظف |

## المميزات الرئيسية
1. ✅ تتبع الحضور اليومي مع تسجيل الوقت
2. ✅ حساب الراتب التلقائي مع الخصومات والمكافآت
3. ✅ نظام إدارة الإجازات (سنوية، مرضية، بدون راتب)
4. ✅ لوحة تحكم للمدير مع إحصاءات شاملة
5. ✅ مزامنة السحابة عبر Supabase
6. ✅ تصدير التقارير (PDF و CSV)
7. ✅ تطبيق Android (APK)
8. ✅ دعم GPS لتحديد موقع تسجيل الدخول
9. ✅ إجازات رسمية مصرية (10 أيام لعام 2026)

## البنية التقنية
| المكون | التقنية |
|--------|---------|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| State Management | Zustand |
| Database | Supabase (PostgreSQL) |
| Build Tool | Vite |
| Mobile | Capacitor 8 + Android |
| CI/CD | GitHub Actions |
| Hosting | Vercel |

## قاعدة البيانات (Supabase)
- **Project ID**: osaalxaptfshgdlefilx
- **URL**: https://osaalxaptfshgdlefilx.supabase.co

### الجداول الرئيسية:
- `app_users` - بيانات المستخدمين
- `attendance_records` - سجلات الحضور
- `user_settings` - إعدادات المستخدمين
- `leave_requests` - طلبات الإجازة
- `official_holidays` - الإجازات الرسمية
- `salary_comparisons` - مقارنة الرواتب

## بناء وتشغيل المشروع

### التثبيت
```bash
npm install
```

### التشغيل في بيئة التطوير
```bash
npm run dev
```

### بناء للإنتاج
```bash
npm run build
```

### بناء APK للأندرويد
```bash
npm run cap:build
```

## إصدارات Android
| الملف | الإصدار | الحالة |
|-------|---------|--------|
| `AttendancePro-v6.3.0.apk` | v6.3.0 (Build 33) | ✅ متاح |

## تاريخ التغييرات (Changelog)

### v6.5.0 (الحالي)
- إصلاح AGP من 8.9.0 إلى 8.9.1 لدعم Android API 36
- تحديث compileSdkVersion إلى 36
- تحديث Gradle إلى 8.11.1
- تغيير Java إلى 21 لتوافق capacitor-android@8
- إصلاح user_settings (إضافة require_gps و check_time_cheating)
- إصلاح SalaryPage
- تعطيل SSO حماية Vercel
- إصلاح صفحة الإصدار في AboutPage

### v6.3.0
- أول بناء APK ناجح تلقائياً عبر GitHub Actions
- إضافة CI/CD pipeline كامل

## الحالة الراهنة
| المكوّن | الحالة |
|---------|--------|
| Vercel Web App | ✅ يعمل |
| APK Build (GitHub Actions) | ✅ يعمل |
| Supabase Database | ✅ متصل |
| Auth Edge Function | ✅ مثبّت |

## التكوين الحالي لـ Android Build
- **AGP**: 8.9.1
- **Gradle**: 8.11.1
- **Java**: 21
- **compileSdk**: 36 (Android 16)
- **targetSdk**: 36
- **minSdk**: 24 (Android 7.0)
- **Capacitor**: 8.3.0

---
آخر تحديث: 2026-04-14
