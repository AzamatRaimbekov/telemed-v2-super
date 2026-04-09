import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { APIError } from "@/types/api";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Добро пожаловать!");
      navigate({ to: "/dashboard" });
    } catch (error) {
      if (error instanceof APIError) {
        toast.error(error.message);
      } else {
        toast.error("Ошибка подключения к серверу");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@clinic.kg" required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">Пароль</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors" />
      </div>
      <button type="submit" disabled={isLoading} className="w-full py-2.5 px-4 rounded-lg bg-secondary text-white font-medium hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {isLoading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
