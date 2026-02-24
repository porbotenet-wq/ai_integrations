import { useEffect } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes';
import { BottomNav } from './BottomNav';
import { useAppStore } from '@/shared/hooks/useAppStore';
import { useProfile } from '@/shared/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TelegramInit />
        <AuthGate>
          <div className="min-h-screen bg-tg-bg">
            <AppRoutes />
            <BottomNav />
          </div>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/** Initialize Telegram WebApp settings */
function TelegramInit() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    // Expand to full screen
    tg.expand();
    tg.enableClosingConfirmation();

    // Set header color
    tg.setHeaderColor('#000000');
    tg.setBackgroundColor('#000000');

    // Handle back button
    tg.BackButton.onClick(() => {
      if (location.pathname !== '/') {
        navigate(-1);
      }
    });
  }, []);

  // Show/hide back button based on route
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    if (location.pathname === '/') {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
    }
  }, [location.pathname]);

  return null;
}

/** Load user profile on mount, show loader until ready */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading, error } = useProfile();
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    if (profile) {
      setUser(profile);
    }
  }, [profile, setUser]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg">
        <div className="w-10 h-10 border-2 border-tg-button border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-tg-hint mt-4">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg px-8 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-bold text-tg-text">Доступ ограничен</h2>
        <p className="text-sm text-tg-hint mt-2">
          Откройте приложение через Telegram-бота ГПР.
          Авторизация происходит автоматически.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
