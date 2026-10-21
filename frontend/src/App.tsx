import { useState, useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { Sidebar, MobileTopBar } from './components/Sidebar';
import { LoginView } from './views/LoginView';
import { ForgotPasswordView } from './views/ForgotPasswordView';
import { ResetPasswordView } from './views/ResetPasswordView';
import { PosView } from './views/PosView';
import { InventoryView } from './views/InventoryView';
import { SalesHistoryView } from './views/SalesHistoryView';
import { ReportsView } from './views/ReportsView';
import { SuppliersView } from './views/SuppliersView';
import { SettingsView } from './views/SettingsView';
import { AuditLogsView } from './views/AuditLogsView';

type AuthPage = 'login' | 'forgot-password';

function getInitialPage(): 'reset-password' | 'app' {
  return window.location.pathname === '/reset-password' ? 'reset-password' : 'app';
}

export function App() {
  const { token, user } = useAuthStore();
  const [authPage, setAuthPage] = useState<AuthPage>('login');
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [page] = useState(getInitialPage);

  // Close mobile sidebar when tab changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTab]);

  // --- Reset password standalone page ---
  if (page === 'reset-password') {
    return <ResetPasswordView />;
  }

  // --- Not authenticated ---
  if (!token || !user) {
    if (authPage === 'forgot-password') {
      return <ForgotPasswordView onBack={() => setAuthPage('login')} />;
    }
    return <LoginView onForgotPassword={() => setAuthPage('forgot-password')} />;
  }

  // --- Authenticated App Shell ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </div>

      {/* Mobile Sidebar Overlay with transition */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex animate-in fade-in duration-200"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div
            className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                setActiveTab(tab);
                setMobileSidebarOpen(false);
              }}
              collapsed={false}
              setCollapsed={() => {}}
              onCloseMobile={() => setMobileSidebarOpen(false)}
              isMobile
            />
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <MobileTopBar
        onMenuClick={() => setMobileSidebarOpen(true)}
        activeTab={activeTab}
      />

      {/* Main content area */}
      <main
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'}
          pt-14 lg:pt-0
          min-h-screen
        `}
      >
        {activeTab === 'pos' && <PosView />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'suppliers' && <SuppliersView />}
        {activeTab === 'sales' && <SalesHistoryView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'audit-logs' && <AuditLogsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default App;
