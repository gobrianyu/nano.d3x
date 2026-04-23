import { motion } from "motion/react";

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  color: string;
}

export default function StatBar({ label, value, max = 255, color }: StatBarProps) {
  const percentage = (value / max) * 100;

  return (
    <div className="flex items-center gap-4 group">
      <span className="text-[10px] font-bold text-slate-500 w-14 uppercase tracking-tighter">{label}</span>
      <div className="h-2 flex-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ backgroundColor: color }}
          className="h-full rounded-full shadow-sm"
        />
      </div>
      <span className="text-[10px] font-bold w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}
