/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { PokemonDetail, PokemonIndexItem, PokemonType } from "./types";
import { BASE_DATA_URL, REGIONS, TYPE_LIST } from "./constants";
import PokemonCard from "./components/PokemonCard";
import PokemonModal from "./components/PokemonModal";
import { motion, AnimatePresence } from "motion/react";
import { Instagram, Search, HelpCircle, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cachedFetch } from "./lib/cacheService";

export default function App() {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
  const [selectedFormIndex, setSelectedFormIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const [selectedType, setSelectedType] = useState<PokemonType | "All">("All");
  const [shinyMode, setShinyMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
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
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.blur();
  };

  // Advanced filtering using cached detail data where available
  const filteredIndex = useMemo(() => {
    return indexData.map((p) => {
      // Name search from thumbnail fallback
      const fallbackName = p.thumbnail.split("-")[1]?.split(".")[0]?.toLowerCase() || "";
      
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
        p.id.toString().includes(searchQuery);
      
      const region = REGIONS.find(r => p.id >= r.startId && p.id <= r.endId);
      const matchesRegion = selectedRegion === "All Regions" || region?.name === selectedRegion;

      const visible = matchesSearch && matchesRegion && matchesType;

      return {
        ...p,
        matchedFormIndex,
        visible
      };
    }).filter(p => p.visible);
  }, [indexData, searchQuery, selectedRegion, selectedType, queryClient]);

  const totalCompleted = indexData.length;
  const targetTotal = 1025;

  return (
    <div className="min-h-screen flex flex-col p-8 md:p-16 lg:p-24 selection:bg-rose-100">
      {/* Header - Editorial Style */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-32">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h1 className="text-7xl md:text-9xl font-display font-black tracking-[-0.05em] leading-[0.8] text-ink dark:text-paper">
              Poké.d3x
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-6 micro-label">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink dark:bg-paper" />
              nano.d3m portfolio
            </span>
            <span className="opacity-20">/</span>
            <span>Archive 001</span>
            <span className="opacity-20">/</span>
            <span className="text-ink dark:text-paper">{indexData.length} Pieces Recorded</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <button 
            onClick={() => setShinyMode(!shinyMode)}
            className={`px-8 py-2.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-[0.2em] ${shinyMode ? "bg-ink dark:bg-paper text-paper dark:text-ink border-ink dark:border-paper" : "border-line dark:border-line-dark hover:border-ink dark:hover:border-paper"}`}
          >
            Shiny Edition
          </button>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="px-8 py-2.5 rounded-full border border-line dark:border-line-dark hover:border-ink dark:hover:border-paper transition-all text-[10px] font-bold uppercase tracking-[0.2em]"
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* Navigation & Search - Minimal Rail */}
      <div className="flex flex-col gap-16">
        <div className="flex flex-col md:flex-row gap-12 items-end justify-between border-b border-line dark:border-line-dark pb-12">
          <div className="flex flex-col md:flex-row gap-12 flex-1 w-full">
            <div className="relative group flex-1">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-clay group-focus-within:text-ink dark:group-focus-within:text-paper transition-colors" size={16} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none pl-6 pr-8 py-1 focus:outline-none text-sm placeholder:opacity-30"
              />
              <AnimatePresence>
                {searchQuery && (
                  <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={handleClearSearch}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-ink/5 dark:hover:bg-paper/5 rounded-full transition-colors"
                  >
                    <X size={14} className="opacity-40 hover:opacity-100 transition-opacity" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-clay transition-colors"
            >
              <option value="All Regions">All Regions</option>
              {REGIONS.map((r) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as PokemonType | "All")}
              className="bg-transparent text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-clay transition-colors"
            >
              <option value="All">All Types</option>
              {TYPE_LIST.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* The Exhibition Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-px museum-grid">
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
