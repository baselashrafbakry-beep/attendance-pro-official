# 🚀 دليل النشر الكامل — AST v6.0
## الموقع يشتغل 24/7 + APK مربوط بنفس الرابط

---

## الخطة الإجمالية

```
GitHub (كود) → Netlify (موقع 24/7) ← APK (يفتح نفس الموقع)
                     ↕
               Supabase (قاعدة بيانات)
```

---

## الخطوة 1: رفع الكود على GitHub

### أول مرة:
```bash
git init
git add .
git commit -m "AST v6.0 - Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance-tracker.git
git push -u origin main
```

### بعد كل تعديل:
```bash
git add .
git commit -m "Update: وصف التعديل"
git push
```

---

## الخطوة 2: نشر على Netlify (مجاني - 24/7)

### أسرع طريقة — عبر الموقع:
1. روح [netlify.com](https://netlify.com) وسجّل بحساب GitHub
2. اضغط **"Add new site"** → **"Import an existing project"**
3. اختر **GitHub** → اختر الـ repo بتاعك
4. الإعدادات التلقائية:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. **Environment variables** → أضف:
   ```
   VITE_SUPABASE_URL = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbG...
   ```
6. اضغط **"Deploy site"** ✓

### بعد النشر هتاخد رابط زي:
```
https://magical-name-123456.netlify.app
```

### تخصيص الرابط (اختياري):
- في Netlify → **Domain settings** → **Options** → **Edit site name**
- تقدر تحوله لـ `attendance-tracker.netlify.app`

---

## الخطوة 3: ربط APK بالموقع المباشر

### افتح `capacitor.config.ts` وعدّل:

```typescript
const config: CapacitorConfig = {
  appId: 'com.salarytracker.app',
  appName: 'متتبع الراتب',
  webDir: 'dist',

  // ← أضف هذا السطر برابط Netlify بتاعك
  server: {
    url: 'https://YOUR-APP.netlify.app',
    cleartext: false,
  },

  // ... باقي الإعدادات
};
```

### لماذا هذا مهم؟
- ✅ APK بيفتح الموقع الحقيقي مباشرة (مش نسخة محلية قديمة)
- ✅ أي تحديث تعمله على GitHub ينعكس فوراً على APK
- ✅ البيانات متزامنة بين الموقع والتطبيق (عبر Supabase)

### بناء APK بعد التعديل:
```bash
# 1. Build الويب
npm run build

# 2. نسخ إلى Android
npx cap sync android

# 3. فتح Android Studio
npx cap open android

# 4. في Android Studio: Build → Generate Signed Bundle/APK
```

---

## الخطوة 4: GitHub Actions (نشر تلقائي)

بعد ما تضيف الـ secrets في GitHub:

**GitHub → Repository → Settings → Secrets and variables → Actions:**

| Secret | القيمة |
|--------|--------|
| `NETLIFY_AUTH_TOKEN` | من Netlify → User Settings → Applications → Personal access tokens |
| `NETLIFY_SITE_ID` | من Netlify → Site settings → General → Site ID |
| `VITE_SUPABASE_URL` | رابط Supabase |
| `VITE_SUPABASE_ANON_KEY` | مفتاح Supabase |

بعدها **كل `git push` → Netlify يتحدث تلقائياً** ✓

---

## ملخص المنصات المجانية

| المنصة | الخدمة | الحد المجاني |
|--------|--------|--------------|
| **Netlify** | هوستنج الموقع | 100GB/شهر، builds غير محدودة |
| **Supabase** | قاعدة البيانات | 500MB، 50,000 row reads/day |
| **GitHub** | كود + CI/CD | مجاني للمشاريع العامة والخاصة |

---

## سيناريو الاستخدام الكامل

```
المدير يفتح الموقع على اللابتوب:
  https://your-app.netlify.app

الموظف يفتح التطبيق على موبايله:
  APK → يفتح https://your-app.netlify.app

كلاهما بياناتهم متزامنة في Supabase ✓
```

---

## استكشاف الأخطاء

**الموقع بيظهر صفحة بيضاء؟**
→ تأكد إن `base: './'` موجودة في `vite.config.ts`

**APK مش بيتحدث؟**
→ تأكد إنك فعّلت `server.url` في `capacitor.config.ts`

**Supabase مش شغال؟**
→ تأكد من الـ environment variables في Netlify
→ شغّل migration SQL في Supabase Dashboard
