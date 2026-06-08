import {
  Bell,
  Heart,
  Award,
  Swords,
  Megaphone,
  Trophy,
  AlertTriangle,
  ThumbsUp,
  Users,
  UserPlus,
  Gamepad2,
  MessageSquare,
  AtSign,
  CheckCircle2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NotificationStyle = {
  /** Lucide icon shown in-app */
  icon: LucideIcon;
  /** Tailwind text color (for icon, in-app) */
  textClass: string;
  /** Tailwind background tint for the icon bubble (in-app) */
  bgClass: string;
  /** Tailwind border accent (in-app card) */
  borderClass: string;
  /** Tailwind gradient header (in-app card hero band) */
  gradientClass: string;
  /** Hex color used by Android FCM `notification.color` and as web push accent */
  accentHex: string;
  /** Short human label */
  label: string;
  /** Lightweight emoji used in the push title (so OS push has a visual cue) */
  emoji: string;
};

const fallback: NotificationStyle = {
  icon: Bell,
  textClass: "text-muted-foreground",
  bgClass: "bg-muted/40",
  borderClass: "border-border",
  gradientClass: "from-muted/40 to-transparent",
  accentHex: "#888888",
  label: "Notifica",
  emoji: "🔔",
};

export const NOTIFICATION_STYLES: Record<string, NotificationStyle> = {
  badge_earned: {
    icon: Award,
    textClass: "text-yellow-400",
    bgClass: "bg-yellow-500/15",
    borderClass: "border-yellow-500/30",
    gradientClass: "from-yellow-500/25 via-amber-500/10 to-transparent",
    accentHex: "#eab308",
    label: "Badge",
    emoji: "🏅",
  },
  achievement_earned: {
    icon: Sparkles,
    textClass: "text-amber-400",
    bgClass: "bg-amber-500/15",
    borderClass: "border-amber-500/30",
    gradientClass: "from-amber-500/25 via-yellow-500/10 to-transparent",
    accentHex: "#f59e0b",
    label: "Achievement",
    emoji: "✨",
  },
  club_tournament: {
    icon: Swords,
    textClass: "text-primary",
    bgClass: "bg-primary/15",
    borderClass: "border-primary/30",
    gradientClass: "from-primary/25 via-primary/10 to-transparent",
    accentHex: "#dc2626",
    label: "Torneo",
    emoji: "⚔️",
  },
  match_ready: {
    icon: Gamepad2,
    textClass: "text-red-400",
    bgClass: "bg-red-500/15",
    borderClass: "border-red-500/30",
    gradientClass: "from-red-500/25 via-orange-500/10 to-transparent",
    accentHex: "#ef4444",
    label: "Match pronto",
    emoji: "🎮",
  },
  staff_announcement: {
    icon: Megaphone,
    textClass: "text-blue-400",
    bgClass: "bg-blue-500/15",
    borderClass: "border-blue-500/30",
    gradientClass: "from-blue-500/25 via-cyan-500/10 to-transparent",
    accentHex: "#3b82f6",
    label: "Staff",
    emoji: "📢",
  },
  announcement: {
    icon: Megaphone,
    textClass: "text-blue-400",
    bgClass: "bg-blue-500/15",
    borderClass: "border-blue-500/30",
    gradientClass: "from-blue-500/25 via-cyan-500/10 to-transparent",
    accentHex: "#3b82f6",
    label: "Annuncio",
    emoji: "📣",
  },
  ranking_record: {
    icon: Trophy,
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-500/15",
    borderClass: "border-emerald-500/30",
    gradientClass: "from-emerald-500/25 via-green-500/10 to-transparent",
    accentHex: "#10b981",
    label: "Ranking",
    emoji: "🏆",
  },
  market_like: {
    icon: Heart,
    textClass: "text-pink-400",
    bgClass: "bg-pink-500/15",
    borderClass: "border-pink-500/30",
    gradientClass: "from-pink-500/25 via-rose-500/10 to-transparent",
    accentHex: "#ec4899",
    label: "Market",
    emoji: "💗",
  },
  deck_like: {
    icon: ThumbsUp,
    textClass: "text-violet-400",
    bgClass: "bg-violet-500/15",
    borderClass: "border-violet-500/30",
    gradientClass: "from-violet-500/25 via-purple-500/10 to-transparent",
    accentHex: "#8b5cf6",
    label: "Deck",
    emoji: "👍",
  },
  club_invite: {
    icon: UserPlus,
    textClass: "text-cyan-400",
    bgClass: "bg-cyan-500/15",
    borderClass: "border-cyan-500/30",
    gradientClass: "from-cyan-500/25 via-sky-500/10 to-transparent",
    accentHex: "#06b6d4",
    label: "Invito club",
    emoji: "🤝",
  },
  club_approved: {
    icon: CheckCircle2,
    textClass: "text-green-400",
    bgClass: "bg-green-500/15",
    borderClass: "border-green-500/30",
    gradientClass: "from-green-500/25 via-emerald-500/10 to-transparent",
    accentHex: "#22c55e",
    label: "Club approvato",
    emoji: "✅",
  },
  parent_request: {
    icon: Users,
    textClass: "text-indigo-400",
    bgClass: "bg-indigo-500/15",
    borderClass: "border-indigo-500/30",
    gradientClass: "from-indigo-500/25 via-blue-500/10 to-transparent",
    accentHex: "#6366f1",
    label: "Genitore",
    emoji: "👨‍👦",
  },
  forum_reply: {
    icon: MessageSquare,
    textClass: "text-teal-400",
    bgClass: "bg-teal-500/15",
    borderClass: "border-teal-500/30",
    gradientClass: "from-teal-500/25 via-cyan-500/10 to-transparent",
    accentHex: "#14b8a6",
    label: "Forum",
    emoji: "💬",
  },
  mention: {
    icon: AtSign,
    textClass: "text-fuchsia-400",
    bgClass: "bg-fuchsia-500/15",
    borderClass: "border-fuchsia-500/30",
    gradientClass: "from-fuchsia-500/25 via-pink-500/10 to-transparent",
    accentHex: "#d946ef",
    label: "Menzione",
    emoji: "@",
  },
  report: {
    icon: AlertTriangle,
    textClass: "text-orange-500",
    bgClass: "bg-orange-500/15",
    borderClass: "border-orange-500/30",
    gradientClass: "from-orange-500/25 via-red-500/10 to-transparent",
    accentHex: "#f97316",
    label: "Segnalazione",
    emoji: "⚠️",
  },
};

export const getNotificationStyle = (type: string): NotificationStyle =>
  NOTIFICATION_STYLES[type] ?? fallback;
