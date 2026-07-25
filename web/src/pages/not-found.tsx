import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <p className="text-muted-foreground">找不到這個頁面。</p>
      <Button asChild>
        <Link to="/">回首頁</Link>
      </Button>
    </div>
  );
}
