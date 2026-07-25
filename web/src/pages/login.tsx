import { useState, type FormEvent, type SVGProps } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// lucide-react no longer ships the GitHub brand icon; inline the mark instead.
function Github(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.75.81 1.2 1.84 1.2 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, setToken } from "@/lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kicks off the backend GitHub OAuth flow (arctic). The callback sets the
  // httpOnly access_token cookie and redirects back to CLIENT_URL.
  function loginWithGithub() {
    window.location.assign(`${API_BASE}/auth/github`);
  }

  // Dev-only shortcut: POST /auth/dev-login (non-production on the backend).
  async function handleDevLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<{ access_token: string }>(
        "/auth/dev-login",
        { email },
      );
      const token = response.data.access_token;
      if (token) {
        setToken(token);
      }
      navigate(redirectTo, { replace: true });
    } catch {
      setError("dev-login 失敗，請確認後端已啟動且非 production 模式。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">登入 Form Platform</CardTitle>
          <CardDescription>使用 GitHub 帳號登入以繼續</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button variant="outline" onClick={loginWithGithub}>
            <Github />
            使用 GitHub 登入
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">或 (開發用)</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleDevLogin} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="dev@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button type="submit" disabled={loading}>
              {loading ? "登入中…" : "dev-login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
