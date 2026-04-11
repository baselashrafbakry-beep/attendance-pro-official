import { Shield, Info, Download, Smartphone } from 'lucide-react';
import { APP_NAME, APP_VERSION, APK_DOWNLOAD_URL, DEVELOPER_NAME, DEVELOPER_PHONE } from '../constants';
import { toast } from 'sonner';

function handleApkDownload() {
  // فتح صفحة التحميل في تبويب جديد
  window.open(APK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
  toast.info('جارٍ فتح صفحة التحميل…', { duration: 3000 });
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Info size={20} className="text-primary" />
          </div>
          <h1 className="text-lg font-black text-foreground">عن التطبيق</h1>
        </div>
      </div>

      <div className="px-4 py-8 flex flex-col items-center gap-6">
        <div className="w-24 h-24 bg-primary/10 border-2 border-primary/20 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/10">
          <Shield size={44} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">{APP_NAME}</h2>
          <p className="text-sm text-primary font-bold mt-1">{APP_VERSION}</p>
          <p className="text-xs text-muted-foreground mt-2">نظام متكامل لإدارة الحضور والرواتب</p>
        </div>

        {/* Android Download Button */}
        <div className="w-full space-y-2">
          <button
            onClick={handleApkDownload}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20 transition-all"
          >
            <Download size={20} />
            تحميل تطبيق الأندرويد (APK)
          </button>
          <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-4 py-2.5">
            <Smartphone size={14} className="text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              سيتم فتح صفحة التحميل — اختر ملف APK من أحدث إصدار
            </p>
          </div>
        </div>

        <div className="w-full space-y-3">
          {[
            { icon: '✅', title: 'تتبع الحضور اليومي', desc: 'تسجيل الدخول والخروج مع حساب التأخير والأوفرتايم تلقائياً' },
            { icon: '💰', title: 'حساب الراتب الدقيق', desc: 'حساب الراتب الصافي مع جميع الخصومات والمكافآت' },
            { icon: '📋', title: 'إدارة الإجازات', desc: 'طلب الإجازات وتتبع الرصيد المتبقي' },
            { icon: '👔', title: 'لوحة تحكم المدير', desc: 'متابعة جميع الموظفين وإدارة الرواتب' },
            { icon: '☁️', title: 'مزامنة السحابة', desc: 'حفظ البيانات على Supabase مع نسخ احتياطي محلي' },
            { icon: '📄', title: 'تصدير التقارير', desc: 'تصدير كشوف الرواتب بصيغة PDF وExcel' },
          ].map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="text-sm font-black text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full bg-primary/5 border border-primary/10 rounded-2xl p-6 mt-4 flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield size={24} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1 font-bold">تطوير وبرمجة</p>
            <p className="text-lg font-black text-foreground">{DEVELOPER_NAME}</p>
            <a className="text-sm font-bold text-primary mt-1 inline-block" dir="ltr" href={`tel:${DEVELOPER_PHONE}`}>
              {DEVELOPER_PHONE}
            </a>
          </div>
        </div>


      </div>
    </div>
  );
}
