import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useApp } from './hooks/useApp';
import { isSupabaseConfigured } from './lib/supabase/client';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAttendancePage from './pages/AdminAttendancePage';
import AdminSalaryPage from './pages/AdminSalaryPage';
import AdminLeaveRequestsPage from './pages/AdminLeaveRequestsPage';
import { SettingsPage, AboutPage } from './pages/SharedModules';
import { AttendancePage, HistoryPage, SalaryPage, BulkPage } from './pages/EmployeeModules';
import LeaveRequestsPage from './pages/LeaveRequestsPage';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import { RefreshCw, CloudOff } from 'lucide-react';

const Guard = ({ children, role }: { children: React.ReactNode; role?: 'admin' | 'employee' }) => {
  const { user, isInitialized } = useApp();
  if (!isInitialized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl shadow-primary/20" />
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">جاري التحميل...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function SyncStatusBar() {
  const { isSyncing, syncError, syncFromCloud } = useApp();
  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-warning/15 border-b border-warning/30 px-4 py-1.5 flex items-center justify-center gap-2">
        <CloudOff size={12} className="text-warning shrink-0" />
        <p className="text-[10px] font-black text-warning">وضع offline — البيانات محلية فقط</p>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-info/15 border-b border-info/30 px-4 py-1.5 flex items-center justify-center gap-2">
        <RefreshCw size={12} className="text-info animate-spin shrink-0" />
        <p className="text-[10px] font-black text-info">جاري المزامنة...</p>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive/15 border-b border-destructive/30 px-4 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CloudOff size={12} className="text-destructive shrink-0" />
          <p className="text-[10px] font-black text-destructive truncate">{syncError}</p>
        </div>
        <button onClick={syncFromCloud} className="text-[10px] font-black text-destructive underline shrink-0">إعادة</button>
      </div>
    );
  }

  return null;
}

export default function App() {
  const { initialize } = useApp();
  useEffect(() => { initialize(); }, [initialize]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-sans rtl" dir="rtl">
        <SyncStatusBar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Guard><HomeRouter /></Guard>} />
          
          {/* Employee Routes */}
          <Route path="/attendance" element={<Guard role="employee"><AttendancePage /></Guard>} />
          <Route path="/history" element={<Guard role="employee"><HistoryPage /></Guard>} />
          <Route path="/salary" element={<Guard role="employee"><SalaryPage /></Guard>} />
          <Route path="/bulk" element={<Guard role="employee"><BulkPage /></Guard>} />
          <Route path="/leaves" element={<Guard role="employee"><LeaveRequestsPage /></Guard>} />
          
          {/* Admin Routes */}
          <Route path="/admin/users" element={<Guard role="admin"><AdminUsersPage /></Guard>} />
          <Route path="/admin/attendance" element={<Guard role="admin"><AdminAttendancePage /></Guard>} />
          <Route path="/admin/salary" element={<Guard role="admin"><AdminSalaryPage /></Guard>} />
          <Route path="/admin/leaves" element={<Guard role="admin"><AdminLeaveRequestsPage /></Guard>} />
          
          {/* Shared Routes */}
          <Route path="/settings" element={<Guard><SettingsPage /></Guard>} />
          <Route path="/about" element={<Guard><AboutPage /></Guard>} />
          <Route path="/change-password" element={<Guard><SettingsPage /></Guard>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NavWrapper />
        <Toaster 
          position="top-center" 
          richColors 
          closeButton 
          duration={3500}
          toastOptions={{
            style: { fontFamily: 'IBM Plex Sans Arabic, sans-serif' }
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

function HomeRouter() {
  const { user } = useApp();
  return user?.role === 'admin' ? <AdminDashboard /> : <Dashboard />;
}

function NavWrapper() {
  const { user } = useApp();
  return user ? <BottomNav /> : null;
}
