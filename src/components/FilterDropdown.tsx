import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface FilterDropdownProps<T> {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
  renderOption?: (option: T) => ReactNode;
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  filterId: string;
  standalone?: boolean;
  compact?: boolean;
  isGmaxMode?: boolean;
}

export default function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  renderOption,
  activeFilter,
  setActiveFilter,
  filterId,
  standalone,
  compact,
  isGmaxMode
}: FilterDropdownProps<T>) {
  const isOpen = activeFilter === filterId;
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (standalone) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (activeFilter === filterId && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeFilter, filterId, setActiveFilter, standalone]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setActiveFilter(isOpen ? null : filterId)}
        className={`flex items-center gap-2 font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-ink/60 transition-colors text-ink ${compact ? "text-[10px] h-8" : "text-xs h-10 underline underline-offset-4 decoration-line hover:decoration-ink"}`}
      >
        <span className="opacity-40">{label}:</span>
        <span className={`${compact ? "min-w-[3rem]" : "min-w-[4rem]"} text-left`}>{value}</span>
        <ChevronDown size={compact ? 12 : 14} className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {!standalone && (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`absolute top-full z-[60] pointer-events-none ${compact ? "mt-2 right-1/2 translate-x-1/2" : "mt-8 right-0"}`}
            >
              <div className={`bg-paper border border-line shadow-2xl p-6 pointer-events-auto flex flex-col gap-1 min-w-[200px] ${compact ? "max-h-[300px] overflow-y-auto no-scrollbar" : ""}`}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-line">
                  <span className="micro-label opacity-40">SELECT {label.toUpperCase()}</span>
                </div>
                {options.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      onChange(option);
                      setActiveFilter(null);
                    }}
                    className={`text-left text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-3 py-2 px-2 hover:bg-ink/5 group/opt border ${
                      value === option ? "text-ink bg-ink/5 border-ink" : "text-ink/30 border-transparent hover:opacity-100"
                    }`}
                  >
                    <div className={`w-1 h-1 rounded-full transition-all ${value === option ? "bg-ink scale-125" : "bg-transparent group-hover/opt:bg-ink/30 scale-75"}`} />
                    {renderOption ? renderOption(option) : option}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
