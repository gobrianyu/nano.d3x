import { Search, Moon, Sun, Sparkles, Filter, X } from "lucide-react";
import { REGIONS, TYPE_LIST } from "../constants";
import { PokemonType } from "../types";

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  selectedType: PokemonType | "All";
  setSelectedType: (type: PokemonType | "All") => void;
  shinyMode: boolean;
  setShinyMode: (val: boolean) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export default function FilterBar({
  searchQuery,
  setSearchQuery,
  selectedRegion,
  setSelectedRegion,
  selectedType,
  setSelectedType,
  shinyMode,
  setShinyMode,
  darkMode,
  setDarkMode,
}: FilterBarProps) {
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-dark/30 dark:text-warm-cream/30 group-focus-within:text-poke-red transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search by name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl py-3.5 pl-12 pr-4 font-display text-lg focus:outline-none focus:ring-2 focus:ring-poke-red/20 transition-all shadow-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-warm-dark/5 dark:hover:bg-warm-cream/5"
            >
              <X size={16} className="opacity-40" />
            </button>
          )}
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShinyMode(!shinyMode)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-display font-semibold transition-all ${
              shinyMode 
                ? "bg-shiny-accent text-white shadow-lg shadow-shiny-accent/30 scale-105" 
                : "bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 opacity-60 hover:opacity-100"
            }`}
          >
            <Sparkles size={18} className={shinyMode ? "animate-pulse" : ""} />
            <span>Shiny Mode</span>
          </button>
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-3.5 bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl transition-all hover:scale-110 active:scale-95 shadow-sm"
          >
            {darkMode ? <Sun size={22} className="text-amber-400" /> : <Moon size={22} className="text-slate-600" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/5 rounded-xl opacity-40">
          <Filter size={14} />
          <span className="text-[10px] font-mono uppercase tracking-widest">Filters</span>
        </div>

        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 px-4 py-2 rounded-xl font-display text-sm focus:outline-none focus:ring-2 focus:ring-poke-red/20"
        >
          <option value="All Regions">All Regions</option>
          {REGIONS.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as PokemonType | "All")}
          className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 px-4 py-2 rounded-xl font-display text-sm focus:outline-none focus:ring-2 focus:ring-poke-red/20"
        >
          <option value="All">All Types</option>
          {TYPE_LIST.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        
        {(selectedRegion !== "All Regions" || selectedType !== "All" || searchQuery) && (
          <button 
            onClick={() => {
              setSelectedRegion("All Regions");
              setSelectedType("All");
              setSearchQuery("");
            }}
            className="text-[10px] font-mono underline opacity-40 hover:opacity-100 transition-opacity uppercase tracking-tighter"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
