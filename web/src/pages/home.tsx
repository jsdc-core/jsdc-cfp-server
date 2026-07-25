import { FileText, Users, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  { title: "表單", value: "—", icon: FileText, hint: "尚未串接 API" },
  { title: "成員", value: "—", icon: Users, hint: "尚未串接 API" },
  { title: "角色 / 權限", value: "—", icon: ShieldCheck, hint: "尚未串接 API" },
];

export default function HomePage() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <CardDescription>{stat.hint}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
