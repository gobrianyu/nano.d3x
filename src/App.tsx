/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PokemonDetail, PokemonForm, PokemonIndexItem, PokemonType } from "./types";
import { BASE_DATA_URL, BASE_IMAGE_URL, REGIONS, TYPE_LIST, CLOUDFRONT_ASSETS_URL, MEGA_POKEMON_IDS, GIGANTAMAX_POKEMON_IDS } from "./constants";
import PokemonCard from "./components/PokemonCard";
import PokemonModal from "./components/PokemonModal";
import FilterDropdown from "./components/FilterDropdown";
import LoadingScreen from "./components/LoadingScreen";
import { motion, AnimatePresence } from "motion/react";
import { Instagram, Search, HelpCircle, X, Sun, Moon, ArrowUp, Filter, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cachedFetch, imageCacheManager } from "./lib/cacheService";

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
  const [lastDetailFetchTime, setLastDetailFetchTime] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<number, Set<number>>>({});
  const [loadingCursor, setLoadingCursor] = useState(0);

  const trackImageLoad = useCallback((id: number, formIndex: number) => {
    setLoadedImages(prev => {
      const existing = prev[id] || new Set();
      if (existing.has(formIndex)) return prev;
      const next = new Set(existing);
      next.add(formIndex);
      return {
        ...prev,
        [id]: next
      };
    });
  }, []);

  const proceedToNext = useCallback(() => {
    setLoadingCursor(prev => prev + 1);
  }, []);
  const [showHeaderSticky, setShowHeaderSticky] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"national" | "mega" | "gigantamax">("national");
  const [showGmaxTransition, setShowGmaxTransition] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const stickySearchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: indexData = [], isLoading: loading } = useQuery<PokemonIndexItem[]>({
    queryKey: ["pokemonIndex"],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/index.json`),
    staleTime: Infinity,
  });

  const idToIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    indexData.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [indexData]);

  // Sequential background loading logic with batching
  useEffect(() => {
    const BATCH_SIZE = 100;
    
    if (indexData.length > 0 && loadingCursor < indexData.length) {
      const remaining = indexData.length - loadingCursor;
      const currentBatchSize = Math.min(BATCH_SIZE, remaining);
      const batch = indexData.slice(loadingCursor, loadingCursor + currentBatchSize);
      
      const loadBatch = async () => {
        await Promise.all(batch.map(async (p) => {
          try {
            // 1. Fetch detail JSON
            const detail = await queryClient.fetchQuery({
              queryKey: ["pokemonDetail", p.id],
              queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${p.id}.json`),
              staleTime: Infinity
            });

            // Update UI state for counts
            setLastDetailFetchTime(Date.now());

            // 2. Fetch all forms' images
            const forms = detail.forms || [];
            const gimmicks = detail["gimmick forms"] || [];
            const allForms = [...forms, ...gimmicks];

            // Load images within a species sequentially to avoid burst
            for (let fIdx = 0; fIdx < allForms.length; fIdx++) {
              const form = allForms[fIdx];
              const gender = "m";
              const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
              const fallbackImage = shinyMode ? p.thumbnail_shiny : p.thumbnail;
              const targetImageUrl = form ? `${BASE_IMAGE_URL}/${form[imageKey] || "unknown.png"}` : `${BASE_IMAGE_URL}/${fallbackImage}`;
              
              try {
                await imageCacheManager.load(targetImageUrl);
                trackImageLoad(p.id, fIdx);
              } catch (err) {
                // Skip failed
              }
            }
          } catch (err) {
            console.error(`Failed to load details for ${p.id}`);
          }
        }));

        // Advance cursor by batch size
        setLoadingCursor(prev => prev + currentBatchSize);
      };

      loadBatch();
    }
  }, [indexData, loadingCursor, queryClient, shinyMode, trackImageLoad]);

  useEffect(() => {
    localStorage.setItem("shinyMode", JSON.stringify(shinyMode));
  }, [shinyMode]);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, [darkMode]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setShowHeaderSticky(scrollPos > 500);
      setShowBackToTop(scrollPos > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

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
    setViewMode("national");
  };

  const filterSectionRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!activeFilter) return;

      // Check if target is inside any filter-related container
      const isInsideStatic = filterSectionRef.current?.contains(target);
      const isInsideSticky = stickyHeaderRef.current?.contains(target);

      if (!isInsideStatic && !isInsideSticky) {
        setActiveFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeFilter]);

  // Advanced filtering using cached detail data where available
  const filteredIndex = useMemo(() => {
    if (viewMode === "mega" || viewMode === "gigantamax") {
      const gimmickItems: any[] = [];
      const targetIds = viewMode === "mega" ? MEGA_POKEMON_IDS : GIGANTAMAX_POKEMON_IDS;

      targetIds.forEach(id => {
        const p = indexData.find(item => item.id === id);
        if (!p) return;

        const detail = queryClient.getQueryData<PokemonDetail>(["pokemonDetail", id]);
        if (!detail || !detail["gimmick forms"]) return;

        const forms = detail.forms || [];
        const gimmickForms = detail["gimmick forms"] || [];
        
        gimmickForms.forEach((gf, gIndex) => {
          const specialForm = gf["special form"] || "";
          const isGigantamaxOrEternamax = specialForm.startsWith("Gigantamax") || specialForm.startsWith("Eternamax");
          
          if (viewMode === "mega" && isGigantamaxOrEternamax) return;
          if (viewMode === "gigantamax" && !isGigantamaxOrEternamax) return;
          
          // Basic search filter
          const matchesSearch = gf.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              gf["special form"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              id.toString().includes(searchQuery);
          
          if (!matchesSearch) return;

          // Type filter
          const matchesType = selectedType === "All" || gf.type.includes(selectedType);
          if (!matchesType) return;

          gimmickItems.push({
            ...p,
            matchedFormIndex: forms.length + gIndex,
            visible: true,
            regionName: REGIONS.find(r => p.id >= r.startId && p.id <= r.endId)?.name || "Unknown"
          });
        });
      });
      return gimmickItems;
    }

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
        const allForms = [
          ...(detail.forms || []), 
          ...(detail["gimmick forms"] || [])
        ].filter(f => f && typeof f === 'object');
        
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
  }, [indexData, searchQuery, selectedRegion, selectedType, queryClient, lastDetailFetchTime, viewMode]);

  // Group by regions for section headers (only when not searching/filtering by type/region)
  const sections = useMemo(() => {
    const isFiltering = searchQuery !== "" || selectedType !== "All" || selectedRegion !== "All" || viewMode !== "national";
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

  const targetTotal = useMemo(() => {
    if (viewMode === "gigantamax") return GIGANTAMAX_POKEMON_IDS.length;
    if (viewMode === "mega") return MEGA_POKEMON_IDS.length;
    return indexData.length; 
  }, [viewMode, indexData.length]);

  const totalFormsCount = useMemo(() => {
    if (viewMode === "gigantamax") return GIGANTAMAX_POKEMON_IDS.length;
    
    if (viewMode === "national") {
      let count = 0;
      indexData.forEach(p => {
        const detail = queryClient.getQueryData<PokemonDetail>(["pokemonDetail", p.id]);
        if (detail) {
          const formsCount = (detail.forms || []).length;
          const gimmicksCount = (detail["gimmick forms"] || []).length;
          count += formsCount + gimmicksCount;
        } else {
          count += 1;
        }
      });
      return count;
    }
    
    // For Mega mode
    const targetIds = MEGA_POKEMON_IDS;
    let count = 0;
    targetIds.forEach(id => {
      const detail = queryClient.getQueryData<PokemonDetail>(["pokemonDetail", id]);
      if (detail && detail["gimmick forms"]) {
        const matches = detail["gimmick forms"].filter(gf => gf["special form"]?.startsWith("Mega"));
        count += Math.max(1, matches.length); 
      } else {
        count += 1;
      }
    });
    return count;
  }, [viewMode, indexData, queryClient, lastDetailFetchTime]);

  const registeredCount = useMemo(() => {
    if (viewMode === "national") {
      // Species registered = number of grids we successfully display artwork for (index 0)
      let count = 0;
      indexData.forEach(p => {
        if (loadedImages[p.id]?.has(0)) count++;
      });
      return count;
    }
    const targetSet = new Set(viewMode === "mega" ? MEGA_POKEMON_IDS : GIGANTAMAX_POKEMON_IDS);
    return indexData.filter(p => targetSet.has(p.id) && (loadedImages[p.id]?.size || 0) > 0).length;
  }, [indexData, viewMode, loadedImages]);

  const totalFormsRegistered = useMemo(() => {
    // Numerator for forms: total number of successful form loads across all species
    let count = 0;
    
    if (viewMode === "national") {
      Object.values(loadedImages).forEach((formSet: Set<number>) => {
        count += formSet.size;
      });
      return count;
    }

    // For Mega/Gmax, we filter the loaded images based on whether they are the correct gimmick form
    const targetIds = viewMode === "mega" ? MEGA_POKEMON_IDS : GIGANTAMAX_POKEMON_IDS;
    targetIds.forEach(id => {
      const formSet = loadedImages[id];
      if (!formSet) return;

      const detail = queryClient.getQueryData<PokemonDetail>(["pokemonDetail", id]);
      if (!detail) return;

      const formsCount = (detail.forms || []).length;
      const gimmickForms = detail["gimmick forms"] || [];

      formSet.forEach(formIndex => {
        // Only count if it's a gimmick form at the expected index
        if (formIndex >= formsCount) {
          const gimmickIndex = formIndex - formsCount;
          const gf = gimmickForms[gimmickIndex];
          if (gf) {
            const specialForm = gf["special form"] || "";
            if (viewMode === "mega" && specialForm.startsWith("Mega")) {
              count++;
            } else if (viewMode === "gigantamax" && (specialForm.startsWith("Gigantamax") || specialForm.startsWith("Eternamax"))) {
              count++;
            }
          }
        }
      });
    });

    return count;
  }, [loadedImages, viewMode, queryClient, lastDetailFetchTime]);

  const handleLoadingComplete = useCallback(() => {
    setIsAppLoaded(true);
  }, []);

  useEffect(() => {
    if (viewMode === "gigantamax" && isAppLoaded) {
      setShowGmaxTransition(true);
      const timer = setTimeout(() => setShowGmaxTransition(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [viewMode, isAppLoaded]);

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen flex flex-col ${viewMode === "gigantamax" ? "selection:bg-gmax/20" : "selection:bg-ink/10"} bg-paper transition-colors`}>
      <AnimatePresence>
        {!isAppLoaded && (
          <LoadingScreen onComplete={handleLoadingComplete} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGmaxTransition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ 
              y: "100%",
              transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } 
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/40 backdrop-blur-xl pointer-events-none overflow-hidden"
          >
            {/* Energy Shutters - Visual reveal panels */}
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: "0%" }}
              exit={{ height: "100%" }}
              transition={{ duration: 0.5, ease: "circIn" }}
              className="absolute top-0 left-0 w-full bg-gmax z-[120]"
            />

            {/* Background Glitch Straps */}
            <div className="absolute inset-0 overflow-hidden opacity-5">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ 
                    duration: 0.5, 
                    delay: Math.random() * 2, 
                    repeat: Infinity,
                    repeatDelay: Math.random() * 5
                  }}
                  className="h-px bg-gmax w-full mb-8"
                />
              ))}
            </div>

            <div className="relative flex flex-col items-center">
              {/* Swirling Energy Clouds */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 0, rotate: 0 }}
                  animate={{ 
                    scale: [0, 2, 5], 
                    opacity: [0, 0.2, 0],
                    rotate: i * 120 + 1080 
                  }}
                  transition={{ 
                    duration: 1.5, 
                    ease: "circOut",
                    times: [0, 0.4, 1]
                  }}
                  className="absolute w-64 h-64 rounded-full border-[20px] border-gmax/40"
                  style={{ filter: 'blur(20px)' }}
                />
              ))}

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0, y: 100 }}
                transition={{ duration: 0.4, ease: "backOut" }}
                className="flex flex-col items-center gap-8"
              >
                <div className="flex flex-col items-center">
                   <motion.div 
                    animate={{ 
                      opacity: [1, 0.5, 1, 0.8, 1],
                      scaleX: [1, 1.05, 1, 0.95, 1]
                    }}
                    transition={{ duration: 0.2, repeat: 5 }}
                    className="text-6xl md:text-8xl font-display font-black tracking-[-0.05em] uppercase text-gmax"
                  >
                    Gigantamax
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-4 py-2 px-6 bg-gmax text-paper skew-x-[-12deg]"
                  >
                    <span className="micro-label text-paper tracking-[0.6em] font-black italic">Limit Break Detected</span>
                  </motion.div>
                </div>

                <div className="flex gap-4">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ 
                        height: [4, 16, 4],
                        opacity: [0.3, 1, 0.3]
                      }}
                      transition={{ duration: 0.4, delay: i * 0.05, repeat: Infinity }}
                      className="w-1 bg-gmax"
                    />
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Scanning Line */}
            <motion.div 
              initial={{ top: "-10%" }}
              animate={{ top: "110%" }}
              exit={{ top: "110%", opacity: 0 }}
              transition={{ duration: 1.5, ease: "linear" }}
              className="absolute left-0 w-full h-[2px] bg-gmax/50 shadow-[0_0_15px_#d0006f] z-[110]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`flex flex-col p-8 md:p-16 lg:p-24 pb-48 md:pb-64 text-ink transition-opacity duration-1000 ${isAppLoaded ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
        {/* Header - Reorganized Editorial Style */}
      <header className="relative mb-32">
        <div className="relative">
          {/* Banner Image - Constrained to top section */}
          <div className="absolute inset-0 -mx-8 md:-mx-16 lg:-mx-24 -mt-10 md:-mt-20 lg:-mt-24 pointer-events-none overflow-hidden opacity-60 z-0">
            <div 
              className="w-full h-full"
              style={{ 
                backgroundImage: 'url(https://d1nt34i9nvab8r.cloudfront.net/banner.png)', 
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }} 
            />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-12 pb-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-7xl md:text-9xl font-display font-black tracking-[-0.05em] leading-[0.8] text-ink drop-shadow-sm dark:drop-shadow-[0_2px_20px_rgba(255,255,255,0.15)]">
                  nano.d3x
                </h1>
                <div className="flex flex-col gap-1">
                  <p className="text-sm md:text-base font-medium tracking-wider opacity-60 ml-1">
                    A Pokédex by <a href="https://www.instagram.com/nano.m0n" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors underline underline-offset-2 decoration-line">@nano.m0n</a>
                  </p>
                  <p className="text-[10px] font-mono tracking-widest opacity-30 ml-1 uppercase">Artist Portfolio // Vol. 02</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-6">
              {/* Analytics / Counters */}
              <div className="flex gap-12">
                {viewMode === 'national' && (
                  <div className="flex flex-col gap-1">
                    <span className="micro-label opacity-40">SPECIES REGISTERED</span>
                    <span className={`text-2xl font-display font-black tracking-tight`}>{registeredCount}<span className="text-sm opacity-20 ml-1">/ {targetTotal}</span></span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="micro-label opacity-40">FORMS REGISTERED</span>
                  <span className={`text-2xl font-display font-black tracking-tight ${viewMode === 'gigantamax' ? 'text-gmax gmax-pulse' : ''}`}>{totalFormsRegistered}<span className="text-sm opacity-20 ml-1">/ {totalFormsCount}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

            <div className="flex flex-wrap items-center gap-x-12 gap-y-8 pt-8 border-t border-line">
            <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
              {/* Core View Modes */}
              <div className="flex items-center gap-6">
                <div className={`flex items-center gap-4 bg-ink/5 p-1 rounded-full border transition-all ${viewMode === 'gigantamax' ? 'border-gmax/30 shadow-[0_0_15px_rgba(208,0,111,0.1)]' : 'border-line'}`}>
                  <button 
                    onClick={() => setShinyMode(false)}
                    className={`px-4 py-1.5 cursor-pointer rounded-full micro-label transition-all ${!shinyMode ? (viewMode === 'gigantamax' ? "bg-gmax !text-white shadow-sm font-bold" : "bg-paper text-ink shadow-sm") : (viewMode === 'gigantamax' ? "text-gmax/60 hover:text-gmax" : "opacity-40 hover:opacity-100")}`}
                  >
                    Classic
                  </button>
                  <button 
                    onClick={() => setShinyMode(true)}
                    className={`px-4 py-1.5 cursor-pointer rounded-full micro-label transition-all ${shinyMode ? (viewMode === 'gigantamax' ? "bg-gmax !text-white shadow-sm font-bold" : "bg-paper text-ink shadow-sm") : (viewMode === 'gigantamax' ? "text-gmax/60 hover:text-gmax" : "opacity-40 hover:opacity-100")}`}
                  >
                    Shiny
                  </button>
                </div>
              </div>

              {/* Form Expansion Placeholders */}
              <div className="flex items-center gap-8">
                <div className={`h-4 w-px transition-colors ${viewMode === 'gigantamax' ? 'bg-gmax/30' : 'bg-line'}`} />
                <button 
                  onClick={() => setViewMode("national")}
                  className={`micro-label flex items-center gap-2 transition-all ${viewMode === "national" ? "text-ink font-bold" : (viewMode === 'gigantamax' ? "opacity-40 hover:opacity-100 hover:text-gmax" : "opacity-40 hover:opacity-100")}`}
                >
                  <span>NATIONAL</span>
                </button>
                <button 
                  onClick={() => {
                    setViewMode("mega");
                    setSelectedRegion("All");
                  }}
                  className={`micro-label flex items-center gap-2 transition-all ${viewMode === "mega" ? "text-ink font-bold" : (viewMode === 'gigantamax' ? "opacity-40 hover:opacity-100 hover:text-gmax" : "opacity-40 hover:opacity-100")}`}
                >
                  <span>MEGA EVOLUTIONS</span>
                </button>
                <button 
                  onClick={() => {
                    setViewMode("gigantamax");
                    setSelectedRegion("All");
                  }}
                  className={`micro-label flex items-center gap-2 transition-all ${viewMode === "gigantamax" ? "!text-gmax font-bold scale-105" : "opacity-40 hover:opacity-100"}`}
                >
                  <span>GIGANTAMAX</span>
                </button>
              </div>
            </div>

            {/* Global Theme Toggle */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`flex cursor-pointer items-center gap-3 micro-label transition-all group ${viewMode === 'gigantamax' ? 'text-gmax opacity-100' : 'opacity-40 hover:opacity-100'}`}
            >
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${viewMode === 'gigantamax' ? 'border-gmax/30 text-gmax shadow-[0_0_15px_rgba(208,0,111,0.1)] group-hover:border-gmax' : 'border-line group-hover:border-ink'}`}>
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              </div>
            </button>
          </div>
      </header>

      {/* Navigation & Search - Minimal Rail */}
      <div className="flex flex-col gap-16" ref={filterSectionRef}>
        <div className="flex flex-col gap-0 border-b border-line">
          <div className="flex flex-col lg:flex-row gap-12 items-start lg:items-end justify-between pb-4">
            <div className="flex flex-col md:flex-row gap-12 flex-1 w-full items-center md:items-center justify-between">
              <div className="relative group w-full max-w-md">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-ink/30 group-focus-within:text-ink transition-colors" size={16} />
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

              <div className="flex flex-wrap items-center gap-x-12 gap-y-6 w-full md:w-auto">
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

                {(selectedRegion !== "All" || selectedType !== "All") && (
                  <button 
                    onClick={() => {
                      handleResetFilters();
                      setActiveFilter(null);
                    }}
                    className="micro-label text-ink hover:text-ink/60 transition-all border-b border-line hover:border-ink pb-1"
                  >
                    Reset All
                  </button>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {(activeFilter === "region" || activeFilter === "type") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden no-scrollbar"
              >
                <div className="pb-16 pt-8 border-t border-line">
                  <div className="flex justify-between items-center mb-12">
                    <h2 className="micro-label font-black tracking-[0.2em] opacity-40">SELECT {activeFilter?.toUpperCase()}</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {(activeFilter === "region" ? ["All", ...REGIONS.map(r => r.name)] : ["All", ...TYPE_LIST]).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          if (activeFilter === "region") setSelectedRegion(option);
                          else setSelectedType(option as PokemonType | "All");
                          setActiveFilter(null);
                        }}
                        className={`text-left text-[10px] font-bold uppercase tracking-widest py-3 px-4 border transition-all flex items-center justify-between group/opt ${
                          (activeFilter === "region" ? selectedRegion : selectedType) === option 
                            ? "bg-ink/5 border-ink text-ink" 
                            : "text-ink/60 border-line hover:border-ink hover:text-ink"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {activeFilter === "type" && option !== "All" && (
                            <img 
                              src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${option.toLowerCase()}-type-icon.png`} 
                              alt={option}
                              className={`w-4 h-4 object-contain transition-all ${selectedType === option ? "saturate-100 opacity-100" : "saturate-[0.8] opacity-40 group-hover/opt:saturate-100 group-hover/opt:opacity-100"}`}
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          )}
                          <span>{option}</span>
                        </div>
                        <div className={`w-1 h-1 rounded-full transition-all ${(activeFilter === "region" ? selectedRegion : selectedType) === option ? "bg-ink scale-125" : "bg-transparent group-hover/opt:bg-ink/30"}`} />
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
                <div className={`sticky ${showHeaderSticky ? "top-16" : "top-0"} z-20 backdrop-blur-md border-b border-line py-4 px-6 flex justify-between items-center h-14 transition-all duration-300 ${viewMode === "gigantamax" ? "border-gmax/30" : ""}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-1 h-3 ${viewMode === "gigantamax" ? "bg-gmax gmax-pulse" : "bg-ink"}`} />
                    <span className={`micro-label font-black tracking-[0.4em] text-[10px] ${viewMode === "gigantamax" ? "text-gmax" : "text-ink"}`}>{section.name.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className={`micro-label font-bold whitespace-nowrap opacity-40 ${viewMode === 'gigantamax' ? 'text-ink' : ''}`}>
                      <span className={viewMode === 'gigantamax' ? 'text-gmax gmax-pulse opacity-100' : ''}>{section.registeredCount}</span> / {section.count} <span className="hidden sm:inline">ENTRIES</span>
                    </span>
                    <div className="w-24 h-[1px] bg-line relative hidden sm:block">
                      <div 
                        className={`absolute left-0 top-0 h-full transition-all duration-1000 ${viewMode === "gigantamax" ? "bg-gmax gmax-glow" : "bg-ink"}`} 
                        style={{ width: `${(section.registeredCount / section.count) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-px">
                  {section.pokemon.map((pokemon) => (
                  <div key={`${pokemon.id}-${pokemon.matchedFormIndex}`} className="museum-cell">
                    <PokemonCard
                      pokemon={pokemon}
                      targetFormIndex={pokemon.matchedFormIndex}
                      shinyMode={shinyMode}
                      isGmaxMode={viewMode === 'gigantamax'}
                      isSelected={selectedPokemonId === pokemon.id}
                      onImageLoad={trackImageLoad}
                      isAllowedToLoad={(idToIndexMap.get(pokemon.id) ?? 9999) <= loadingCursor}
                      onClick={() => {
                        setSelectedPokemonId(pokemon.id);
                        setSelectedFormIndex(pokemon.matchedFormIndex || 0);
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
              <div key={`${pokemon.id}-${pokemon.matchedFormIndex}`} className="museum-cell">
                <PokemonCard
                  pokemon={pokemon}
                  targetFormIndex={pokemon.matchedFormIndex}
                  shinyMode={shinyMode}
                  isGmaxMode={viewMode === 'gigantamax'}
                  isSelected={selectedPokemonId === pokemon.id}
                  onImageLoad={trackImageLoad}
                  isAllowedToLoad={(idToIndexMap.get(pokemon.id) ?? 9999) <= loadingCursor}
                  onClick={() => {
                    setSelectedPokemonId(pokemon.id);
                    setSelectedFormIndex(pokemon.matchedFormIndex || 0);
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
            <p className="text-ink/40 text-xs uppercase tracking-[0.4em] font-medium">No records found</p>
          </div>
        )}
      </div>

      {/* Footer - Minimalist Fine Print */}
      <footer className="mt-60 border-t border-line dark:border-line-dark pt-16 flex flex-col md:flex-row justify-between items-start gap-12 opacity-30 hover:opacity-100 transition-opacity duration-700">
        <div className="space-y-6 max-w-md">
          <h3 className="micro-label text-ink dark:text-paper">Poké.d3x / By @nano.m0n</h3>
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
        {showHeaderSticky && (
          <motion.div
            ref={stickyHeaderRef}
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 w-full z-50 bg-paper/80 backdrop-blur-xl border-b border-line px-4 md:px-8 h-16 flex items-center justify-between gap-4 md:gap-8 shadow-lg"
          >
            {/* Title - Compact */}
            <div className="flex-shrink-0">
              <h2 className="text-xl font-display font-black tracking-tighter text-ink cursor-pointer" onClick={scrollToTop}>
                nano.d3x
              </h2>
            </div>

            {/* Search - Filling Space */}
            <div className="flex-1 max-w-2xl flex items-center gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30 group-focus-within:text-ink transition-colors" size={14} />
                <input
                  ref={stickySearchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-ink/5 dark:bg-paper/5 border border-line focus:border-ink pl-10 pr-10 py-2 focus:outline-none text-[13px] placeholder:opacity-30 text-ink transition-all"
                />
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-ink/10 rounded-full transition-colors"
                    >
                      <X size={12} className="text-ink/40" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Combined Filters Icon Button - Integrated with Search Bar visually */}
              <div className="relative">
                <button
                  onClick={() => setActiveFilter(activeFilter === "combined-sticky" ? null : "combined-sticky")}
                  className={`p-2 transition-all ${activeFilter === "combined-sticky" ? "text-ink scale-110" : "text-ink/40 hover:text-ink hover:scale-110"}`}
                  title="Filters"
                >
                  <Filter size={14} />
                </button>

                <AnimatePresence>
                  {activeFilter === "combined-sticky" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="fixed top-16 left-0 w-full bg-paper border-b border-line shadow-2xl p-8 z-50 overflow-y-auto h-[calc(100dvh-4rem)] md:h-auto md:max-h-[70vh] no-scrollbar flex justify-center"
                    >
                      <div className="w-full max-w-4xl space-y-12 pb-24">
                        <div className="flex justify-between items-center border-b border-line pb-4">
                          <h2 className="micro-label font-black tracking-[0.2em] opacity-40">FILTERS</h2>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetFilters();
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-colors py-2 px-4"
                          >
                            Clear All
                          </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-16">
                          {/* Regions Section */}
                          <div className="space-y-6">
                            <h3 className="micro-label opacity-40">BY REGION</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {["All", ...REGIONS.map(r => r.name)].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setSelectedRegion(option);
                                    setActiveFilter(null);
                                  }}
                                  className={`text-left text-[10px] font-bold uppercase tracking-widest py-2 px-3 border transition-all ${
                                    selectedRegion === option 
                                      ? "bg-ink/5 border-ink text-ink" 
                                      : "text-ink/60 border-line hover:border-ink hover:text-ink"
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Types Section */}
                          <div className="space-y-6">
                            <h3 className="micro-label opacity-40">BY TYPE</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {["All", ...TYPE_LIST].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setSelectedType(option as PokemonType | "All");
                                    setActiveFilter(null);
                                  }}
                                  className={`flex items-center gap-3 text-left text-[10px] font-bold uppercase tracking-widest py-2 px-3 border transition-all ${
                                    selectedType === option 
                                      ? "bg-ink/5 border-ink text-ink" 
                                      : "text-ink/60 border-line hover:border-ink hover:text-ink"
                                  }`}
                                >
                                  {option !== "All" && (
                                    <img 
                                      src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${option.toLowerCase()}-type-icon.png`} 
                                      alt={option}
                                      className={`w-4 h-4 object-contain transition-all ${selectedType === option ? "saturate-100 opacity-100" : "saturate-[0.8] opacity-40"}`}
                                      onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                  )}
                                  <span>{option}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Actions & Modes */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`w-10 h-10 rounded-full border transition-all flex items-center justify-center ${viewMode === 'gigantamax' ? 'border-gmax/30 text-gmax shadow-[0_0_15px_rgba(208,0,111,0.1)] hover:border-gmax' : 'border-line hover:border-ink text-ink'}`}
                title={darkMode ? "Light Mode" : "Dark Mode"}
              >
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBackToTop && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-8 sm:bottom-12 right-6 sm:right-12 z-50 flex items-center gap-4"
          >
            {/* Unified Control Widget - Editorial Dock Style */}
            <div className={`p-1.5 rounded-2xl sm:rounded-full border shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 transition-all ${viewMode === "gigantamax" ? "bg-paper/80 border-gmax/40 shadow-[0_0_20px_rgba(208,0,111,0.15)]" : "bg-paper/40 dark:bg-ink/40 border-line"}`}>
              {/* Mode Switcher */}
              <div className="flex items-center gap-0.5 bg-ink/5 rounded-full p-0.5">
                <button 
                  onClick={() => setViewMode("national")}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-full micro-label transition-all ${viewMode === "national" ? "bg-paper text-ink shadow-sm font-bold" : "opacity-40 hover:opacity-100"}`}
                >
                  Dex
                </button>
                <button 
                  onClick={() => { setViewMode("mega"); setSelectedRegion("All"); }}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-full micro-label transition-all ${viewMode === "mega" ? (viewMode === 'gigantamax' ? "text-gmax hover:text-gmax" : "bg-paper text-ink shadow-sm font-bold") : "opacity-40 hover:opacity-100"}`}
                >
                  Mega
                </button>
                <button 
                  onClick={() => { setViewMode("gigantamax"); setSelectedRegion("All"); }}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-full micro-label transition-all ${viewMode === "gigantamax" ? "bg-gmax !text-white shadow-sm font-black scale-105" : "opacity-40 hover:text-gmax hover:opacity-100"}`}
                >
                  Gmax
                </button>
              </div>

              <div className="hidden sm:block w-[1px] h-4 bg-line mx-1" />
              <div className="block sm:hidden h-[1px] w-full bg-line px-4" />

              {/* Shiny Toggle */}
              <div className="flex items-center gap-0.5 bg-ink/5 rounded-full p-0.5">
                <button 
                  onClick={() => setShinyMode(false)}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-full micro-label transition-all ${!shinyMode ? (viewMode === 'gigantamax' ? "bg-gmax !text-white shadow-sm font-bold" : "bg-paper text-ink shadow-sm font-bold") : (viewMode === "gigantamax" ? "text-gmax/60 hover:text-gmax" : "opacity-40 hover:opacity-100")}`}
                >
                  Classic
                </button>
                <button 
                  onClick={() => setShinyMode(true)}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-full micro-label transition-all ${shinyMode ? (viewMode === 'gigantamax' ? "bg-gmax !text-white shadow-sm font-bold" : "bg-paper text-ink shadow-sm font-bold") : (viewMode === "gigantamax" ? "text-gmax/60 hover:text-gmax" : "opacity-40 hover:opacity-100")}`}
                >
                  Shiny
                </button>
              </div>
            </div>

            {/* To-Top Toggle */}
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={scrollToTop}
              className="w-12 h-12 shrink-0 bg-ink text-paper rounded-full shadow-2xl flex items-center justify-center border border-paper/10 hover:scale-110 active:scale-95 transition-all self-end sm:self-center"
              title="Back to top"
            >
              <ArrowUp size={20} strokeWidth={3} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPokemonId && (
          <PokemonModal
            initialId={selectedPokemonId}
            initialFormIndex={selectedFormIndex}
            onClose={() => {
              setSelectedPokemonId(null);
              setSelectedFormIndex(0);
            }}
            indexData={indexData}
            shinyMode={shinyMode}
            onImageLoad={trackImageLoad}
            filteredList={filteredIndex.map(p => ({ id: p.id, matchedFormIndex: p.matchedFormIndex || 0 }))}
            isGimmickOnly={viewMode !== "national"}
          />
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}
