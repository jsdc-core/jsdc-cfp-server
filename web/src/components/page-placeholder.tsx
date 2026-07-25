import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PagePlaceholderProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

/** Generic placeholder shown while a feature module is not yet implemented. */
export function PagePlaceholder({
  title,
  description,
  children,
}: PagePlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {children ?? "此頁面尚未實作，先放置佔位內容。"}
      </CardContent>
    </Card>
  );
}
