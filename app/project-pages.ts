import { Activity, CalendarDays, ChartNoAxesGantt, ChartPie, ClipboardList, LayoutDashboard, LifeBuoy, Users, Workflow } from "lucide-react";

export const PROJECT_PAGES = [
  { id: "today", label: "Daily Delivery", icon: LayoutDashboard },
  { id: "board", label: "Workboard", icon: ClipboardList },
  { id: "gantt", label: "Gantt timeline", icon: ChartNoAxesGantt },
  { id: "calendar", label: "Day-by-day map", icon: CalendarDays },
  { id: "roles", label: "Team & ownership", icon: Users },
  { id: "scorecard", label: "Targets & results", icon: ChartPie },
  { id: "promises", label: "Proposal to delivery", icon: Workflow },
  { id: "recovery", label: "Recovery desk", icon: LifeBuoy },
  { id: "history", label: "Activity log", icon: Activity },
] as const;

export type ProjectPage = typeof PROJECT_PAGES[number]["id"];

export function isProjectPage(value: string | undefined): value is ProjectPage {
  return PROJECT_PAGES.some((page) => page.id === value);
}
