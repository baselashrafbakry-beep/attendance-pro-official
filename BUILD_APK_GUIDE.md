# 📱 دليل بناء APK — خطوة بخطوة

## بيانات Keystore (احتفظ بها في مكان آمن)
```
Keystore File:  android/app/release.keystore
Key Alias:      salary_tracker_key
Store Password: SalaryTracker@2026
Key Password:   SalaryTracker@2026
```

---

## الطريقة 1: Android Studio (الأسهل)

### الخطوات:
1. افتح **Android Studio**
2. **File → Open** → اختار مجلد `android/`
3. انتظر حتى ينتهي **Gradle Sync** (علامة ✅)
4. من القائمة: **Build → Generate Signed Bundle / APK**
5. اختار **APK** → Next
6. بيانات Keystore:
   - **Keystore path**: `android/app/release.keystore`
   - **Store password**: `SalaryTracker@2026`
   - **Key alias**: `salary_tracker_key`
   - **Key password**: `SalaryTracker@2026`
7. اختار **release** → **Finish**
8. الملف في: `android/app/release/app-release.apk`

---

## الطريقة 2: Command Line (بدون Android Studio)

```bash
cd android
./gradlew assembleRelease
```

الملف في: `android/app/build/outputs/apk/release/app-release.apk`

---

## ⚠️ تحذير "الملف قد يكون ضاراً"

هذا التحذير يظهر لأي APK يُثبَّت من خارج Google Play.
**الحل الدائم: رفع APK على Google Play**

### للاستخدام الداخلي (بدون Play):
المستخدم يضغط **"فتح الملف"** بثقة — الملف موقّع بشهادة رسمية ✓

### لإزالة التحذير نهائياً:
رفع على [Google Play Console](https://play.google.com/console) — رسوم التسجيل $25 مرة واحدة.

---

## ملاحظة Gradle Warning (flatDir)

```
Using flatDir should be avoided...
```
تم إصلاح هذا التحذير في هذه النسخة ✓
