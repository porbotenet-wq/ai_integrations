import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Пароль успешно изменён");
      navigate("/");
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Недействительная ссылка для сброса пароля</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-bold mb-6">Новый пароль</h1>
      <form onSubmit={handleReset} className="w-full max-w-md space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Новый пароль"
          className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground text-sm outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm"
        >
          {loading ? "Сохранение..." : "Сохранить пароль"}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
