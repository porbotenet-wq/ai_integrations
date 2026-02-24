import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AuthScreen = () => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Неверный email или пароль"
        : error.message);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!displayName.trim()) {
      toast.error("Укажите имя");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Проверьте почту для подтверждения регистрации");
      setMode("login");
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") handleLogin();
    else handleRegister();
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Введите email");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Ссылка для сброса пароля отправлена на почту");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8 animate-fade-in">
      {/* Логотип */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
          <span className="text-primary font-bold text-lg">S</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">SMR</h1>
        <p className="text-[12px] text-[hsl(var(--t2))] mt-1">
          Система управления строительными объектами
        </p>
      </div>

      {/* Переключатель вход/регистрация */}
      <div className="w-full max-w-md mb-6">
        <div className="grid grid-cols-2 gap-1 bg-[hsl(var(--bg1))] border border-border rounded-lg p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2 text-[12px] font-semibold rounded-md transition-all duration-150 ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-[hsl(var(--t2))] hover:text-[hsl(var(--t1))]"
              }`}
            >
              {m === "login" ? "Вход" : "Регистрация"}
            </button>
          ))}
        </div>
      </div>

      {/* Форма */}
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        {mode === "register" && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--t3))] mb-1.5 block">
              Имя
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Иван Петров"
              className="w-full bg-[hsl(var(--bg1))] border border-border rounded-lg px-3.5 py-3
                         text-[13px] text-foreground outline-none transition-all
                         focus:border-primary/40 focus:ring-2 focus:ring-primary/10
                         placeholder:text-[hsl(var(--t3))]"
            />
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--t3))] mb-1.5 block">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@company.ru"
            className="w-full bg-[hsl(var(--bg1))] border border-border rounded-lg px-3.5 py-3
                       text-[13px] text-foreground outline-none transition-all
                       focus:border-primary/40 focus:ring-2 focus:ring-primary/10
                       placeholder:text-[hsl(var(--t3))]"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--t3))] mb-1.5 block">
            Пароль
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-[hsl(var(--bg1))] border border-border rounded-lg px-3.5 py-3
                       text-[13px] text-foreground outline-none transition-all
                       focus:border-primary/40 focus:ring-2 focus:ring-primary/10
                       placeholder:text-[hsl(var(--t3))]"
          />
        </div>

        {mode === "login" && (
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[11px] text-primary hover:underline"
            >
              Забыли пароль?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm tracking-wide transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading
            ? "Загрузка..."
            : mode === "login"
            ? "Войти в систему →"
            : "Зарегистрироваться →"}
        </button>
      </form>

      <Link
        to="/privacy"
        className="text-[10px] text-[hsl(var(--t3))] hover:text-primary transition-colors mt-6 underline underline-offset-2"
      >
        Политика конфиденциальности
      </Link>
    </div>
  );
};

export default AuthScreen;
