/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { PokemonDetail, PokemonIndexItem, PokemonType } from "./types";
import { BASE_DATA_URL, REGIONS, TYPE_LIST, CLOUDFRONT_ASSETS_URL } from "./constants";
import PokemonCard from "./components/PokemonCard";
import PokemonModal from "./components/PokemonModal";
import FilterDropdown from "./components/FilterDropdown";
import { motion, AnimatePresence } from "motion/react";
import { Instagram, Search, HelpCircle, X, Sun, Moon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cachedFetch } from "./lib/cacheService";

export default function App() {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
  const [selectedFormIndex, setSelectedFormIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [selectedType, setSelectedType] = useState<PokemonType | "All">("All");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [shinyMode, setShinyMode] = useState(() => {
    const saved = localStorage.getItem("shinyMode");
    return saved ? JSON.parse(saved) : false;
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: indexData = [], isLoading: loading } = useQuery<PokemonIndexItem[]>({
    queryKey: ["pokemonIndex"],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/index.json`),
    staleTime: Infinity,
  });

  // Background pre-fetching to populate details for advanced filtering
  useEffect(() => {
    if (indexData.length > 0) {
      const prefetch = async () => {
        // Fetch in smaller chunks to avoid overwhelming the network
        const chunkSize = 20;
        for (let i = 0; i < indexData.length; i += chunkSize) {
          const chunk = indexData.slice(i, i + chunkSize);
          await Promise.all(chunk.map(p => 
            queryClient.prefetchQuery({
              queryKey: ["pokemonDetail", p.id],
              queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${p.id}.json`),
              staleTime: Infinity
            })
          ));
          // Small delay between chunks
          await new Promise(r => setTimeout(r, 100));
        }
      };
      prefetch();
    }
  }, [indexData, queryClient]);

  useEffect(() => {
    localStorage.setItem("shinyMode", JSON.stringify(shinyMode));
  }, [shinyMode]);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    if (selectedPokemonId !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPokemonId]);

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.blur();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedRegion("All");
    setSelectedType("All");
    setActiveFilter(null);
  };

  const filterSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeFilter && filterSectionRef.current && !filterSectionRef.current.contains(event.target as Node)) {
        setActiveFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeFilter]);

  // Advanced filtering using cached detail data where available
  const filteredIndex = useMemo(() => {
    return indexData.map((p) => {
      // Name search from thumbnail fallback
      const fallbackName = p.thumbnail.split("-").length > 1 
        ? p.thumbnail.split("-")[1]?.split(".")[0]?.toLowerCase() 
        : p.thumbnail.split(".")[0]?.toLowerCase() || "";
      
      // Get cached detail for refined search and type filtering
      const detail = queryClient.getQueryData<PokemonDetail>(["pokemonDetail", p.id]);
      
      let matchedFormIndex = 0;
      let matchesType = selectedType === "All";
      let officialName = fallbackName;

      if (detail) {
        const allForms = [...detail.forms, ...detail["gimmick forms"]];
        
        // Find the first form matching the type
        if (selectedType !== "All") {
          const firstMatchingIndex = allForms.findIndex(f => f.type.some(t => t === selectedType));
          if (firstMatchingIndex !== -1) {
            matchedFormIndex = firstMatchingIndex;
            matchesType = true;
          }
        }

        officialName = allForms[matchedFormIndex]?.name.toLowerCase() || fallbackName;
      }

      const matchesSearch = 
        officialName.includes(searchQuery.toLowerCase()) || 
        p.id.toString().includes(searchQuery) ||
        fallbackName.includes(searchQuery.toLowerCase());
      
      const regionInfo = REGIONS.find(r => p.id >= r.startId && p.id <= r.endId);
      const matchesRegion = selectedRegion === "All" || regionInfo?.name === selectedRegion;

      const visible = matchesSearch && matchesRegion && matchesType;

      return {
        ...p,
        matchedFormIndex,
        visible,
        regionName: regionInfo?.name || "Unknown"
      };
    }).filter(p => p.visible);
  }, [indexData, searchQuery, selectedRegion, selectedType, queryClient]);

  // Group by regions for section headers (only when not searching/filtering by type/region)
  const sections = useMemo(() => {
    const isFiltering = searchQuery !== "" || selectedType !== "All" || selectedRegion !== "All";
    if (isFiltering) return null;

    return REGIONS.map(region => {
      const pokemon = filteredIndex.filter(p => p.id >= region.startId && p.id <= region.endId);
      if (pokemon.length === 0) return null;
      
      return {
        ...region,
        registeredCount: pokemon.length,
        pokemon
      };
    }).filter((s): s is NonNullable<typeof s> => s !== null);
  }, [filteredIndex, searchQuery, selectedType]);

  const totalCompleted = indexData.length;
  const targetTotal = 1025;

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen flex flex-col p-8 md:p-16 lg:p-24 selection:bg-rose-100 text-ink bg-paper transition-colors`}>
      {/* Header - Editorial Style */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-32">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl md:text-9xl font-display font-black tracking-[-0.05em] leading-[0.8] text-ink drop-shadow-sm dark:drop-shadow-[0_2px_20px_rgba(255,255,255,0.15)]">
              nano.d3x
            </h1>
            <p className="text-sm md:text-base font-medium tracking-wider opacity-60 ml-1">
              A Pokédex by <a href="https://www.instagram.com/nano.m0n" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "2px"}}>@nano.m0n</a>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 pl-1 micro-label">
            <span>Art Portfolio 002</span>
            <span className="opacity-20">/</span>
            <span className="text-ink">{indexData.length} Registered</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-10 items-center">
          {/* Shiny/Classic Toggle */}
          <div className="flex items-center gap-8 px-1">
            <button 
              onClick={() => setShinyMode(false)}
              className={`micro-label transition-all pb-1 border-b-2 ${!shinyMode ? "text-ink border-ink opacity-100" : "opacity-30 border-transparent hover:opacity-100"}`}
            >
              Classic
            </button>
            <button 
              onClick={() => setShinyMode(true)}
              className={`micro-label transition-all pb-1 border-b-2 ${shinyMode ? "text-ink border-ink opacity-100" : "opacity-30 border-transparent hover:opacity-100"}`}
            >
              Shiny
            </button>
          </div>

          {/* Theme Toggle */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="w-12 h-12 rounded-full border border-line hover:border-ink transition-all flex items-center justify-center text-ink group"
          >
            {darkMode ? (
              <Sun size={18} className="group-hover:rotate-45 transition-transform" />
            ) : (
              <Moon size={18} className="group-hover:-rotate-12 transition-transform" />
            )}
          </button>
        </div>
      </header>

      {/* Navigation & Search - Minimal Rail */}
      <div className="flex flex-col gap-16" ref={filterSectionRef}>
        <div className="flex flex-col gap-0 border-b border-line">
          <div className="flex flex-col lg:flex-row gap-12 items-end justify-between pb-12">
            <div className="flex flex-col md:flex-row gap-12 flex-1 w-full items-end">
              <div className="relative group w-full max-w-md">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-clay group-focus-within:text-ink transition-colors" size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search ID or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none pl-6 pr-8 py-1 focus:outline-none text-sm placeholder:opacity-30 text-ink"
                />
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={handleClearSearch}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-ink/5 rounded-full transition-colors"
                    >
                      <X size={14} className="opacity-40 hover:opacity-100 transition-opacity text-ink" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-12">
                <FilterDropdown
                  label="Region"
                  value={selectedRegion}
                  options={["All", ...REGIONS.map(r => r.name)]}
                  onChange={setSelectedRegion}
                  activeFilter={activeFilter}
                  setActiveFilter={setActiveFilter}
                  filterId="region"
                  standalone={true}
                />

                <FilterDropdown
                  label="Type"
                  value={selectedType}
                  options={["All", ...TYPE_LIST]}
                  onChange={(val) => setSelectedType(val as PokemonType | "All")}
                  activeFilter={activeFilter}
                  setActiveFilter={setActiveFilter}
                  filterId="type"
                  standalone={true}
                  renderOption={(option) => (
                    <div className="flex items-center gap-2">
                      {option !== "All" && (
                        <img 
                          src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${option.toLowerCase()}-type-icon.png`} 
                          alt={option}
                          className="w-4 h-4 object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <span>{option}</span>
                    </div>
                  )}
                />

                {(selectedRegion !== "All" || selectedType !== "All" || searchQuery !== "") && (
                  <button 
                    onClick={handleResetFilters}
                    className="micro-label text-ink hover:text-clay transition-colors flex items-center gap-2 h-10 border-l border-line pl-12 ml-4"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {activeFilter && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden no-scrollbar"
              >
                <div className="pb-16 pt-8 border-t border-line">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-12 gap-y-6">
                    {(activeFilter === "region" ? ["All", ...REGIONS.map(r => r.name)] : ["All", ...TYPE_LIST]).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          if (activeFilter === "region") setSelectedRegion(option);
                          else setSelectedType(option as PokemonType | "All");
                          setActiveFilter(null);
                        }}
                        className={`text-left text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-3 py-1 group/opt ${
                          (activeFilter === "region" ? selectedRegion : selectedType) === option ? "text-ink opacity-100" : "text-clay opacity-30 hover:opacity-100"
                        }`}
                      >
                        <div className={`w-1 h-1 rounded-full transition-all ${((activeFilter === "region" ? selectedRegion : selectedType) === option) ? "bg-ink scale-125" : "bg-transparent group-hover/opt:bg-clay scale-75"}`} />
                        <div className="flex items-center gap-2">
                          {activeFilter === "type" && option !== "All" && (
                            <img 
                              src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${option.toLowerCase()}-type-icon.png`} 
                              alt={option}
                              className="w-4 h-4 object-contain"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          )}
                          <span>{option}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The Exhibition Grid */}
        <div className="flex flex-col museum-grid">
          {sections ? (
            sections.map((section) => (
              <div key={section.name} className="relative">
                <div className="sticky top-0 z-30 backdrop-blur-md border-b border-line py-4 px-6 flex justify-between items-center h-14">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-3 bg-ink" />
                    <span className="micro-label font-black tracking-[0.4em] text-ink text-[10px]">{section.name.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="micro-label opacity-40 font-bold whitespace-nowrap">
                      {section.registeredCount} / {section.count} <span className="hidden sm:inline">ENTRIES</span>
                    </span>
                    <div className="w-24 h-[1px] bg-line relative hidden sm:block">
                      <div 
                        className="absolute left-0 top-0 h-full bg-ink transition-all duration-1000" 
                        style={{ width: `${(section.registeredCount / section.count) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-px">
                  {section.pokemon.map((pokemon) => (
                    <div key={pokemon.id} className="museum-cell">
                      <PokemonCard
                        pokemon={pokemon}
                        targetFormIndex={pokemon.matchedFormIndex}
                        shinyMode={shinyMode}
                        onClick={() => {
                          setSelectedPokemonId(pokemon.id);
                          setSelectedFormIndex(pokemon.matchedFormIndex);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-px">
              {filteredIndex.map((pokemon) => (
                <div key={pokemon.id} className="museum-cell">
                  <PokemonCard
                    pokemon={pokemon}
                    targetFormIndex={pokemon.matchedFormIndex}
                    shinyMode={shinyMode}
                    onClick={() => {
                      setSelectedPokemonId(pokemon.id);
                      setSelectedFormIndex(pokemon.matchedFormIndex);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {filteredIndex.length === 0 && !loading && (
          <div className="py-60 flex flex-col items-center justify-center text-center space-y-6">
            <HelpCircle size={40} strokeWidth={1} className="opacity-20" />
            <p className="text-clay text-xs uppercase tracking-[0.4em] font-medium">Record not found in current archive</p>
          </div>
        )}
      </div>

      {/* Footer - Minimalist Fine Print */}
      <footer className="mt-60 border-t border-line dark:border-line-dark pt-16 flex flex-col md:flex-row justify-between items-start gap-12 opacity-30 hover:opacity-100 transition-opacity duration-700">
        <div className="space-y-6 max-w-md">
          <h3 className="micro-label text-ink dark:text-paper">Poké.d3x / Project Identity</h3>
          <p className="text-[11px] leading-relaxed font-medium">
            A curated visual archive presenting reimagined creatures in an editorial context. 
            All original illustrations are part of the nano.m0n collection. 
            Pokémon is a trademark of Nintendo, Creatures Inc., and GAME FREAK.
          </p>
        </div>
        <div className="flex flex-col gap-4 items-end">
          <div className="flex gap-12">
            <a href="https://instagram.com/nano.m0n" target="_blank" rel="noreferrer" className="micro-label hover:text-ink dark:hover:text-paper transition-colors">Connect / IG</a>
          </div>
          <span className="text-[10px] font-mono opacity-20">EST. 2026 // VERSION 2.0</span>
        </div>
      </footer>

      <AnimatePresence>
        {selectedPokemonId && (
          <PokemonModal
            initialId={selectedPokemonId}
            initialFormIndex={selectedFormIndex}
            onClose={() => setSelectedPokemonId(null)}
            indexData={indexData}
            shinyMode={shinyMode}
            filteredList={filteredIndex.map(p => ({ id: p.id, matchedFormIndex: p.matchedFormIndex }))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
