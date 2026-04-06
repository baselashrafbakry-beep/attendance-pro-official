import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { Clock, BarChart2, Calendar, FileText, Settings, Users, LayoutDashboard, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';

const employeeNav = [
  { to: '/', icon: LayoutDashboard, label: 'الرئيسية', exact: true },
  { to: '/attendance', icon: Clock, label: 'الحضور' },
  { to: '/salary', icon: DollarSign, label: 'الراتب' },
  { to: '/history', icon: Calendar, label: 'السجل' },
  { to: '/leaves', icon: FileText, label: 'الإجازات' },
];

const adminNav = [
  { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم', exact: true },
  { to: '/admin/users', icon: Users, label: 'الموظفون' },
  { to: '/admin/attendance', icon: Clock, label: 'الحضور' },
  { to: '/admin/salary', icon: BarChart2, label: 'الرواتب' },
  { to: '/admin/leaves', icon: FileText, label: 'الإجازات' },
];

export default function BottomNav() {
  const { user } = useApp();
  const location = useLocation();
  const navItems = user?.role === 'admin' ? adminNav : employeeNav;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom shadow-2xl">
      <div className="flex items-center justify-around px-2 py-1 max-w-lg mx-auto">
        {navItems.map(item => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to) && item.to !== '/';
          const isReallyActive = item.to === '/'
            ? location.pathname === '/'
            : isActive;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-0 flex-1',
                isReallyActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-xl transition-all',
                isReallyActive ? 'bg-primary/10' : ''
              )}>
                <item.icon
                  size={20}
                  className={cn(
                    'transition-all',
                    isReallyActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'
                  )}
                />
              </div>
              <span className={cn(
                'text-[9px] font-bold truncate w-full text-center',
                isReallyActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
        <NavLink
          to="/settings"
          className={cn(
            'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-0 flex-1',
            location.pathname === '/settings' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn('p-1.5 rounded-xl transition-all', location.pathname === '/settings' ? 'bg-primary/10' : '')}>
            <Settings size={20} className={cn('transition-all', location.pathname === '/settings' ? 'stroke-[2.5px]' : 'stroke-[1.5px]')} />
          </div>
          <span className={cn('text-[9px] font-bold truncate w-full text-center', location.pathname === '/settings' ? 'text-primary' : 'text-muted-foreground')}>
            الإعدادات
          </span>
        </NavLink>
      </div>
    </nav>
  );
}
