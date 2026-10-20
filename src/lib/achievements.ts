/**
 * Achievements: earned from the user's real records — scans, plans,
 * check-ins, daily logs and their streak. Nothing here is decorative;
 * every badge maps to something they actually did.
 */

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  detail: string;
  earned: boolean;
}

export function computeAchievements(input: {
  scans: number;
  plans: number;
  checkins: number;
  loggedDays: number;
  streak: number;
  scoreClimbed: boolean;
}): Achievement[] {
  const { scans, plans, checkins, loggedDays, streak, scoreClimbed } = input;
  return [
    {
      id: "first-scan",
      icon: "◉",
      title: "Measured",
      detail: "First scan completed",
      earned: scans >= 1,
    },
    {
      id: "protocol-live",
      icon: "✦",
      title: "Protocol live",
      detail: "Personalised plan generated",
      earned: plans >= 1,
    },
    {
      id: "streak-3",
      icon: "🔥",
      title: "On fire",
      detail: "3-day streak",
      earned: streak >= 3,
    },
    {
      id: "streak-7",
      icon: "🔥",
      title: "Week of fire",
      detail: "7-day streak",
      earned: streak >= 7,
    },
    {
      id: "checkin-1",
      icon: "✓",
      title: "First check-in",
      detail: "The loop is running",
      earned: checkins >= 1,
    },
    {
      id: "checkin-4",
      icon: "◎",
      title: "Phase-2 ready",
      detail: "4 check-ins banked",
      earned: checkins >= 4,
    },
    {
      id: "logger-7",
      icon: "▦",
      title: "Tracker",
      detail: "7 days logged",
      earned: loggedDays >= 7,
    },
    {
      id: "climber",
      icon: "▲",
      title: "Climber",
      detail: "Score up vs your first scan",
      earned: scoreClimbed,
    },
  ];
}
