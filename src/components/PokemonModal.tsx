import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Weight, Ruler, Info, Venus, Mars, HelpCircle } from "lucide-react";
import { PokemonDetail, PokemonForm, PokemonIndexItem, PokemonType } from "../types";
import { BASE_DATA_URL, BASE_IMAGE_URL, TYPE_COLORS } from "../constants";
import StatBar from "./StatBar";
import EvolutionChain from "./EvolutionChain";
import { useQuery } from "@tanstack/react-query";
import { cachedFetch } from "../lib/cacheService";
import { useImage } from "../lib/useImage";

interface GalleryItem {
  id: number;
  matchedFormIndex: number;
}

interface PokemonModalProps {
  initialId: number;
  initialFormIndex?: number;
  onClose: () => void;
  indexData: PokemonIndexItem[];
  shinyMode: boolean;
  filteredList: GalleryItem[];
}

export default function PokemonModal({ initialId, initialFormIndex = 0, onClose, indexData, shinyMode, filteredList }: PokemonModalProps) {
  // Gallery state: initialized from the filtered grid, but can grow with evolution jumps
  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    // Ensure the initial item is in the gallery if somehow it wasn't (should be, but defensive)
    if (!filteredList.some(item => item.id === initialId)) {
      const newItem = { id: initialId, matchedFormIndex: initialFormIndex };
      return [...filteredList, newItem].sort((a, b) => a.id - b.id);
    }
    return [...filteredList];
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = filteredList.findIndex(item => item.id === initialId);
    return idx !== -1 ? idx : 0;
  });

  const currentItem = gallery[currentIndex];
  const id = currentItem?.id;
  const currentFormIndex = currentItem?.matchedFormIndex ?? 0;

  const [gender, setGender] = useState<"m" | "f">("m");
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: detail, isLoading: loading, error: fetchError } = useQuery<PokemonDetail>({
    queryKey: ["pokemonDetail", id],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${id}.json`),
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!id,
  });

  const allForms = [...(detail?.forms || []), ...(detail?.["gimmick forms"] || [])];
  const form = allForms[currentFormIndex];

  const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
  const imageUrl = form ? `${BASE_IMAGE_URL}/${form[imageKey] || "unknown.png"}` : "";
  
  const { src: cachedImageUrl, loading: imgLoading, error: imgError } = useImage(imageUrl);

  const stats = form?.["base stats"]?.[0] || { hp: 0, atk: 0, def: 0, "sp.atk": 0, "sp.def": 0, speed: 0 };
  const mainType = (form?.type?.[0] || "Unknown") as PokemonType;
  const accentColor = TYPE_COLORS[mainType] || "#888";

  // Navigation logic
  const handleNext = () => setCurrentIndex(prev => (prev + 1) % gallery.length);
  const handlePrev = () => setCurrentIndex(prev => (prev - 1 + gallery.length) % gallery.length);

  const handleFormSelect = (idx: number) => {
    setGallery(prev => prev.map((item, i) => i === currentIndex ? { ...item, matchedFormIndex: idx } : item));
  };

  const handleJumpToPokemon = (targetId: number) => {
    const dexId = Math.floor(targetId);
    const formIndex = Math.round((targetId % 1) * 100);

    const existingIdx = gallery.findIndex(item => item.id === dexId);
    if (existingIdx !== -1) {
      setGallery(prev => prev.map((item, i) => i === existingIdx ? { ...item, matchedFormIndex: formIndex } : item));
      setCurrentIndex(existingIdx);
    } else {
      // Insert and sort
      const newItem = { id: dexId, matchedFormIndex: formIndex };
      const newGallery = [...gallery, newItem].sort((a, b) => a.id - b.id);
      setGallery(newGallery);
      setCurrentIndex(newGallery.findIndex(item => item.id === dexId));
    }
  };

  // Drag constraints and handlers for swipe
  const dragThreshold = 50;
  const onDragEnd = (event: any, info: any) => {
    if (info.offset.x < -dragThreshold) {
      handleNext();
    } else if (info.offset.x > dragThreshold) {
      handlePrev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gallery.length, currentIndex]);

  if (!detail && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-paper dark:bg-ink w-full max-w-lg p-12 flex flex-col items-center gap-6 border border-line dark:border-line-dark shadow-2xl"
        >
          <div className="w-10 h-10 border-2 border-ink dark:border-paper border-t-transparent rounded-full animate-spin" />
          <p className="micro-label opacity-40">Syncing with Archive...</p>
        </motion.div>
      </div>
    );
  }

  if (fetchError || !detail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
        <div 
          onClick={(e) => e.stopPropagation()}
          className="bg-paper dark:bg-ink w-full max-w-lg p-12 flex flex-col items-center gap-8 text-center border border-line dark:border-line-dark shadow-2xl"
        >
          <HelpCircle size={40} strokeWidth={1} className="opacity-20" />
          <div className="space-y-3">
            <h3 className="font-display text-2xl font-black italic">Archive Incomplete</h3>
            <p className="text-xs uppercase tracking-widest opacity-40 leading-relaxed px-4">
              Detailed records for this specimen are still being curated by the artist.
            </p>
            {fetchError && <p className="text-[10px] font-mono opacity-20 mt-4 break-all">{(fetchError as Error).message}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="micro-label px-8 py-3 border border-line dark:border-line-dark hover:bg-ink dark:hover:bg-paper hover:text-paper dark:hover:text-ink transition-all"
          >
            Return to Grid
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 modal-overlay" onClick={onClose}>
      {/* Background Dimmer */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-[2px]" 
      />

      {/* Gallery Navigation - Buttons in Margins */}
      {gallery.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="fixed left-4 md:left-8 top-1/2 -translate-y-1/2 p-4 text-paper bg-white/10 hover:bg-white/20 rounded-full transition-all z-50 hidden md:block"
          >
            <ChevronLeft size={32} strokeWidth={1.5} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 p-4 text-paper bg-white/10 hover:bg-white/20 rounded-full transition-all z-50 hidden md:block"
          >
            <ChevronRight size={32} strokeWidth={1.5} />
          </button>
        </>
      )}

      <motion.div 
        key={id}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        drag={isPortrait ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={onDragEnd}
        className={`bg-paper w-full max-w-7xl shadow-2xl overflow-hidden relative flex z-10 text-ink border border-line ${
          isPortrait 
            ? "flex-col aspect-[1/2] max-h-[95vh]" 
            : "md:flex-row aspect-[5/3] max-h-[90vh]"
        }`}
      >
        {/* Global Floating Close Button */}
        <div className="absolute top-6 right-6 z-50 pointer-events-none">
          <button 
            onClick={onClose}
            className="pointer-events-auto bg-paper border border-line px-3 py-1.5 micro-label hover:bg-ink hover:text-paper transition-all shadow-sm"
          >
            Close
          </button>
        </div>

        {/* Inner Scrollable Container for Portrait / Structural Wrapper for Landscape */}
        <div className={`flex flex-1 ${isPortrait ? "flex-col overflow-y-auto custom-scrollbar" : "flex-row overflow-hidden"}`}>
          {/* Classification Info - Above Image in Mobile */}
          {isPortrait && (
            <div className="px-8 pt-6 pb-6 space-y-3">
               <div className="flex items-center gap-3">
                <span className="micro-label opacity-40">Dex ID</span>
                <span className="font-display text-xl font-black tracking-tighter">
                  #{String(detail["dex number"]).padStart(4, "0")}
                </span>
              </div>
              <div className="flex items-baseline gap-2 overflow-visible">
                 <h2 className="font-display font-black tracking-tighter leading-[1.1] text-4xl pb-1 whitespace-nowrap">
                  {form.name}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.type.map((t) => (
                  <span key={t} className="micro-label px-3 py-1 border border-line">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Image Area - Square Focused */}
          <div 
            className={`relative aspect-square flex flex-col items-center justify-center shiny-gradient overflow-hidden bg-white dark:bg-black/20 shrink-0 border-line ${
              isPortrait ? "w-full border-t border-b" : "h-full border-r"
            }`}
          >
          {/* Metadata Rail (Desktop) */}
          {!isPortrait && (
            <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-10 pointer-events-none">
              <div className="flex flex-col gap-1">
                <span className="micro-label">Dex ID</span>
                <span className="font-display text-4xl font-black tracking-tighter">
                  #{String(detail["dex number"]).padStart(4, "0")}
                </span>
              </div>
            </div>
          )}

          {/* Gender Toggles */}
          {detail.gendered && (
             <div className="absolute top-8 right-8 z-10 flex gap-4 pointer-events-auto">
               <button 
                onClick={() => setGender("m")}
                className={`micro-label transition-all flex items-center gap-2 ${gender === "m" ? "text-ink" : "opacity-20"}`}
              >
                <Mars size={12} /> M
              </button>
              <button 
                onClick={() => setGender("f")}
                className={`micro-label transition-all flex items-center gap-2 ${gender === "f" ? "text-ink" : "opacity-20"}`}
              >
                <Venus size={12} /> F
              </button>
            </div>
          )}

          <div className="w-full h-full flex items-center justify-center p-8 relative">
            {imgLoading && !imgError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 border border-ink/5 border-t-ink rounded-full animate-spin" />
              </div>
            )}
            
            {!imgError ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={`${currentFormIndex}-${gender}-${shinyMode}`}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: imgLoading ? 0 : 1 }}
                  exit={{ scale: 1.05, opacity: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  src={cachedImageUrl || ""}
                  alt={form.name}
                  referrerPolicy="no-referrer"
                  className={`max-w-full max-h-full object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_60px_rgba(255,255,255,0.03)] transition-opacity duration-300 ${imgLoading ? "opacity-0" : "opacity-100"}`}
                />
              </AnimatePresence>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center opacity-20">
                <span className="font-display text-9xl font-black italic">?</span>
                <p className="micro-label tracking-[0.5em]">No Asset</p>
              </div>
            )}
          </div>

          <div className="absolute bottom-4 left-4 opacity-20">
            <p className="text-[9px] font-mono font-bold tracking-widest uppercase italic">Artist / nano.m0n</p>
          </div>

          {allForms.length > 1 && (
            <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-4">
              {allForms.map((f, i) => (
                <button 
                  key={i}
                  onClick={() => handleFormSelect(i)}
                  className={`w-0.5 h-6 transition-all ${i === currentFormIndex ? "bg-ink h-10" : "bg-line hover:bg-ink/20"}`} 
                />
              ))}
            </div>
          )}
        </div>

        <div className={`flex flex-col custom-scrollbar relative ${isPortrait ? "w-full p-8" : "md:w-5/12 p-12 lg:p-14 overflow-y-auto"}`}>
          {!isPortrait && (
            <header className="mb-8">
              <span className="micro-label mb-2 block opacity-40">Classification</span>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col overflow-visible max-w-[90%]">
                  <h2 className="font-display font-black tracking-tighter leading-[1] text-5xl lg:text-6xl pb-2 whitespace-nowrap">
                    {form.name}
                  </h2>
                  {form["special form"] && (
                    <span className="micro-label opacity-40 mt-1 italic">Variant: {form["special form"]}</span>
                  )}
                </div>
                <div className="flex wrap gap-2">
                  {form.type.map((t) => (
                    <span key={t} className="micro-label px-3 py-1 border border-line">{t}</span>
                  ))}
                </div>
              </div>
            </header>
          )}

          <section className="mb-8 space-y-2">
            <p className="micro-label font-bold text-ink uppercase tracking-[0.2em]">{form.category} Pokémon</p>
            <span className="micro-label opacity-40 block">Observation Entry</span>
            <p className="text-sm font-medium leading-relaxed italic border-l-2 border-line pl-4">
              "{form.entry}"
            </p>
          </section>

          <div className="space-y-12">
            <section className="grid grid-cols-2 gap-8 border-b border-line pb-8">
              <div className="space-y-1">
                <span className="micro-label opacity-40">Height</span>
                <p className="font-display font-bold text-2xl tracking-tighter">{form.height / 100}<span className="text-xs ml-1 opacity-40">M</span></p>
              </div>
              <div className="space-y-1">
                <span className="micro-label opacity-40">Weight</span>
                <p className="font-display font-bold text-2xl tracking-tighter">{form.weight}<span className="text-xs ml-1 opacity-40">KG</span></p>
              </div>
            </section>

            <section className="space-y-4">
              <span className="micro-label opacity-40">Base Stats</span>
              <div className="space-y-3">
                <StatBar label="HP" value={stats.hp} color="currentColor" />
                <StatBar label="ATK" value={stats.atk} color="currentColor" />
                <StatBar label="DEF" value={stats.def} color="currentColor" />
                <StatBar label="SP.ATK" value={stats["sp.atk"]} color="currentColor" />
                <StatBar label="SP.DEF" value={stats["sp.def"]} color="currentColor" />
                <StatBar label="SPEED" value={stats.speed} color="currentColor" />
              </div>
            </section>

            <section className="space-y-4 pt-8 border-t border-line overflow-hidden">
              <span className="micro-label opacity-40">Evolutionary Sequence</span>
              <div className="flex justify-center w-full">
                <EvolutionChain 
                  indexData={indexData} 
                  shinyMode={shinyMode} 
                  currentId={id + (currentFormIndex / 100)}
                  onSelect={handleJumpToPokemon}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </motion.div>
    </div>
  );
}
