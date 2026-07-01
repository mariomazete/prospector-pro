import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Prospector AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/crm" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (s && (e === "SIGNED_IN" || e === "INITIAL_SESSION")) navigate({ to: "/crm" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn.call(supabase.auth, {
        email,
        password,
        options: mode === "signup" ? { emailRedirectTo: window.location.origin } : undefined,
      } as never);
      if (error) toast.error(error.message);
      else if (mode === "signup") toast.success("Check your email to confirm.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(res.error.message);
    setLoading(false);
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <Link to="/" className="mb-6 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-blue-700">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">PROSPECTOR AI</span>
        </Link>

        <h1 className="text-xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {mode === "signin" ? "Sign in to access your CRM." : "Start tracking your leads."}
        </p>

        <Button onClick={handleGoogle} disabled={loading} variant="outline" className="mt-5 w-full rounded-lg">
          Continue with Google
        </Button>

        <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-lg bg-primary hover:bg-primary/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}