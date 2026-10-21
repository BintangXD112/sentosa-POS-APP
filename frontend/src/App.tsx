import { useState, useEffect } from 'react';
import { Store, RefreshCw } from 'lucide-react';
import { useAuthStore, isTokenExpired } from './store/authStore';
import { apiRequest } from './api/client';
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
  const {
    token,
    user,
    isVerifyingSession,
    updateUser,
    updateLastActive,
    logout,
    setIsVerifyingSession,
  } = useAuthStore();

  const [authPage, setAuthPage] = useState<AuthPage>('login');
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [page] = useState(getInitialPage);

  // Close mobile sidebar when tab changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTab]);

  // --- 1. Verify saved session on startup / browser open (Auto-Login verification) ---
  useEffect(() => {
    const verifySavedSession = async () => {
      const currentToken = useAuthStore.getState().token;
      if (!currentToken) {
        setIsVerifyingSession(false);
        return;
      }

      // Check client-side token expiration first
      if (isTokenExpired(currentToken)) {
        logout('Sesi login Anda telah berakhir. Silakan masuk kembali.');
        setIsVerifyingSession(false);
        return;
      }

      try {
        const res = await apiRequest<{ user: any }>('/auth/me');
        if (res && res.user) {
          updateUser(res.user);
          updateLastActive();
        }
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403) {
          logout('Sesi Anda telah berakhir atau akun dinonaktifkan. Silakan login kembali.');
        } else {
          // Network issue or backend cold start: keep cached authenticated state
          console.warn('Gagal memverifikasi sesi dengan server, menggunakan cache lokal:', err);
        }
      } finally {
        setIsVerifyingSession(false);
      }
    };

    verifySavedSession();
  }, [setIsVerifyingSession, updateUser, updateLastActive, logout]);

  // --- 2. Inactivity tracking & periodic token expiration watcher ---
  useEffect(() => {
    if (!token) return;

    let lastThrottle = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottle > 15000) {
        // throttle updates to storage every 15s
        lastThrottle = now;
        updateLastActive();
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    // Check expiration and inactivity every 30 seconds
    const interval = setInterval(() => {
      const state = useAuthStore.getState();
      if (!state.token) return;

      // Check if JWT token has expired
      if (isTokenExpired(state.token)) {
        logout('Sesi login Anda telah berakhir demi keamanan. Silakan login kembali.');
        return;
      }

      // 12-hour inactivity auto-logout protection
      const MAX_INACTIVITY_MS = 12 * 60 * 60 * 1000;
      if (state.lastActiveAt && Date.now() - state.lastActiveAt > MAX_INACTIVITY_MS) {
        logout('Sesi Anda telah kedaluwarsa karena tidak ada aktivitas selama 12 jam.');
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      clearInterval(interval);
    };
  }, [token, logout, updateLastActive]);

  // --- Standalone reset password page ---
  if (page === 'reset-password') {
    return <ResetPasswordView />;
  }

  // --- Verifying session splash (shown smoothly when opening browser) ---
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-60 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/25 animate-pulse">
              <Store className="w-8 h-8 text-slate-950" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border border-emerald-500/30 animate-ping pointer-events-none opacity-40" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight mb-1.5">Sentosa POS</h1>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Memulihkan sesi kasir...</span>
          </div>
        </div>
      </div>
    );
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
