import { RouterProvider } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { router } from "@/router";

export default function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
