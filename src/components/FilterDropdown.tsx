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
  standalone
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
        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-clay transition-colors text-ink h-10"
      >
        <span className="opacity-40">{label}:</span>
        <span className="min-w-[4rem] text-left">{value}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {!standalone && (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full right-0 mt-8 w-[80vw] max-w-4xl z-50 pointer-events-none"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-12 gap-y-6 pointer-events-auto justify-items-start border-t border-line pt-12 mt-4">
                {options.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      onChange(option);
                      setActiveFilter(null);
                    }}
                    className={`text-left text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-3 py-1 group/opt ${
                      value === option ? "text-ink opacity-100" : "text-clay opacity-30 hover:opacity-100"
                    }`}
                  >
                    <div className={`w-1 h-1 rounded-full transition-all ${value === option ? "bg-ink scale-125" : "bg-transparent group-hover/opt:bg-clay scale-75"}`} />
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
