import { motion } from "motion/react";

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export default function StatBar({ label, value, max = 255 }: StatBarProps) {
  const percentage = (value / max) * 100;

  // Generate a color from yellow-orange to green based on value
  // 0-60: Poor (Amber range)
  // 60-120: Good (Lime/Green range)
  // 120+: Elite (Bright Green range)
  const getStatColor = (val: number) => {
    if (val < 60) return "rgba(245, 158, 11, 0.5)";  // Amber
    if (val < 85) return "rgba(234, 179, 8, 0.5)";   // Yellow
    if (val < 110) return "rgba(163, 230, 53, 0.5)"; // Lime
    if (val < 140) return "rgba(34, 197, 94, 0.5)";  // Green
    return "rgba(20, 184, 166, 0.5)";                // Teal/Elite
  };

  const barColor = getStatColor(value);

  return (
    <div className="flex items-center gap-4 group">
      <span className="text-[10px] font-bold text-clay dark:text-paper/40 w-14 uppercase tracking-tighter opacity-60">{label}</span>
      <div className="h-1.5 flex-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, percentage)}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: barColor }}
          className="h-full rounded-full"
        />
      </div>
      <span className="text-[10px] font-bold w-8 text-right tabular-nums opacity-60">{value}</span>
    </div>
  );
}
