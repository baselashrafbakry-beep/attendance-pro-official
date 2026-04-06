# 🗄️ دليل إعداد Supabase — Attendance & Salary Tracker v6.0

## الخطوات (5 دقائق فقط)

### 1. أنشئ مشروع Supabase
1. اذهب إلى [supabase.com](https://supabase.com) وسجّل دخولك
2. أنشئ مشروعاً جديداً (اختر أقرب منطقة — مثلاً Frankfurt لمصر)
3. انتظر حتى يكتمل الإعداد (دقيقتان)

### 2. شغّل Migration SQL
1. من Dashboard → **SQL Editor**
2. افتح ملف `supabase/migrations/20260404_001_init.sql`
3. انسخ محتواه والصقه في SQL Editor
4. اضغط **Run** ✓

### 3. احصل على بيانات الاتصال
1. من Dashboard → **Settings** → **API**
2. انسخ:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon/public** key → مفتاح طويل يبدأ بـ `eyJ...`

### 4. أنشئ ملف .env
```bash
cp .env.example .env
```
ثم عدّل الملف:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. شغّل التطبيق
```bash
npm run dev
```

---

## ⚡ الوضع Hybrid (محلي + سحابي)
التطبيق مصمم ليعمل في **وضعين**:

| الوضع | الشرح |
|-------|-------|
| **Offline** | بدون .env — يعمل بـ localStorage فقط |
| **Online** | مع .env — يحفظ في Supabase + cache محلي |

عند الاتصال مجدداً بعد انقطاع، البيانات المحلية موجودة وتُزامَن تلقائياً.

---

## 🔐 الأمان (RLS)
- كل موظف يرى بياناته فقط
- المدير يرى جميع البيانات
- سياسات RLS مفعّلة على جميع الجداول

---

## 📊 هيكل قاعدة البيانات

| الجدول | الوصف |
|--------|-------|
| `app_users` | بيانات الموظفين |
| `user_settings` | إعدادات كل مستخدم |
| `attendance_records` | سجلات الحضور (unique: user_id + date) |
| `leave_requests` | طلبات الإجازة |
| `official_holidays` | الإجازات الرسمية |
| `salary_comparisons` | سجل استلام الرواتب |
