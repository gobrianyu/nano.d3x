import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const targetCount = 1025;

  useEffect(() => {
    const duration = 3000; // 3 seconds total
    const startTime = Date.now();
    let frameId: number;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Easing function for smoother feel (easeOutExpo-ish)
      const ease = 1 - Math.pow(1 - t, 3);
      
      const current = Math.floor(ease * targetCount);
      setProgress(current);

      if (t < 1) {
        frameId = requestAnimationFrame(updateProgress);
      } else {
        setTimeout(onComplete, 500);
      }
    };

    frameId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(frameId);
  }, [onComplete]);

  const percentage = (progress / targetCount) * 100;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-paper text-ink p-8"
    >
      <div className="w-full max-w-sm space-y-12">
        <div className="space-y-4 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl font-display font-black tracking-tighter"
          >
            nano.d3x
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="micro-label tracking-[0.3em] uppercase"
          >
            Initializing Protocol // Vol. 02
          </motion.p>
        </div>

        <div className="space-y-6">
          <div className="relative h-[2px] w-full bg-ink/5 overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-ink"
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          <div className="flex justify-between items-end font-mono">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] opacity-30 uppercase tracking-widest">Status</span>
              <span className="text-[11px] font-bold uppercase tracking-wider animate-pulse">
                {progress === targetCount ? "System Ready" : "Collecting Data..."}
              </span>
            </div>
            <div className="text-right flex flex-col gap-1">
              <span className="text-[10px] opacity-30 uppercase tracking-widest">Registration</span>
              <span className="text-2xl font-display font-black tracking-tighter">
                {progress.toLocaleString()}<span className="text-xs opacity-20 ml-1">/ {targetCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

    </motion.div>
  );
}
