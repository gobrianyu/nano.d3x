import { useState, useEffect } from "react";
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
            className="fixed left-4 md:left-8 top-1/2 -translate-y-1/2 p-4 text-paper dark:text-ink bg-ink/10 dark:bg-paper/10 hover:bg-ink/20 dark:hover:bg-paper/20 rounded-full transition-all z-50 hidden md:block"
          >
            <ChevronLeft size={32} strokeWidth={1.5} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 p-4 text-paper dark:text-ink bg-ink/10 dark:bg-paper/10 hover:bg-ink/20 dark:hover:bg-paper/20 rounded-full transition-all z-50 hidden md:block"
          >
            <ChevronRight size={32} strokeWidth={1.5} />
          </button>
        </>
      )}

      <motion.div 
        key={id}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -20, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={onDragEnd}
        className="bg-paper dark:bg-ink w-full max-w-7xl h-full md:h-[90vh] shadow-2xl overflow-hidden relative flex flex-col md:flex-row border border-line dark:border-line-dark z-10"
      >
        {/* Left Side: Large Exhibit Artwork */}
        <div 
          className="md:w-7/12 h-[50vh] md:h-full flex flex-col relative border-b md:border-b-0 md:border-r border-line dark:border-line-dark shiny-gradient overflow-hidden bg-white dark:bg-ink"
        >
          {/* Top Metadata Rail */}
          <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-10 pointer-events-none">
            <div className="flex flex-col gap-1">
              <span className="micro-label">Dex ID</span>
              <span className="font-display text-4xl font-black tracking-tighter">
                #{String(detail["dex number"]).padStart(4, "0")}
              </span>
            </div>
            {detail.gendered && (
              <div className="flex gap-4 pointer-events-auto">
                <button 
                  onClick={() => setGender("m")}
                  className={`micro-label transition-all flex items-center gap-2 ${gender === "m" ? "text-ink dark:text-paper" : "opacity-20"}`}
                >
                  <Mars size={12} /> Male
                </button>
                <button 
                  onClick={() => setGender("f")}
                  className={`micro-label transition-all flex items-center gap-2 ${gender === "f" ? "text-ink dark:text-paper" : "opacity-20"}`}
                >
                  <Venus size={12} /> Female
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center p-12 relative">
            {imgLoading && !imgError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 border border-ink/5 dark:border-paper/5 border-t-ink dark:border-t-paper rounded-full animate-spin" />
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
                  className={`max-w-full max-h-[85%] object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_60px_rgba(255,255,255,0.03)] transition-opacity duration-300 ${imgLoading ? "opacity-0" : "opacity-100"}`}
                />
              </AnimatePresence>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center opacity-20">
                <span className="font-display text-9xl font-black italic">?</span>
                <p className="micro-label tracking-[0.5em]">Archive Pending</p>
              </div>
            )}
          </div>

          {/* Bottom Art Credit */}
          <div className="absolute bottom-8 left-8 opacity-20">
            <p className="text-[9px] font-mono font-bold tracking-widest uppercase">Artist / nano.m0n</p>
          </div>

          {/* Form Selection List */}
          {allForms.length > 1 && (
            <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-6">
              {allForms.map((f, i) => (
                <button 
                  key={i}
                  onClick={() => handleFormSelect(i)}
                  className={`w-1 h-8 transition-all ${i === currentFormIndex ? "bg-ink dark:bg-paper scale-x-125" : "bg-line dark:border-line-dark"}`} 
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Scientific Data */}
        <div className="md:w-5/12 flex flex-col p-12 lg:p-16 overflow-y-auto custom-scrollbar relative">
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 micro-label px-3 py-1 hover:bg-ink dark:hover:bg-paper hover:text-paper dark:hover:text-ink transition-all border border-line dark:border-line-dark"
          >
            Close Archive
          </button>

          <header className="mb-20">
            <span className="micro-label mb-4 block">Classification</span>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <h2 className="text-6xl lg:text-7xl font-display font-black tracking-tighter text-ink dark:text-paper leading-none">
                  {form.name}
                </h2>
                {form["special form"] && (
                  <span className="micro-label opacity-40 mt-2">{form["special form"]}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {form.type.map((t) => (
                  <span 
                    key={t}
                    className="micro-label px-3 py-1 border border-line dark:border-line-dark"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-line dark:border-line-dark">
               <p className="font-display font-medium text-lg leading-snug">{form.category} Pokémon</p>
            </div>
          </header>

          <div className="space-y-16">
            <section className="grid grid-cols-2 gap-12 border-b border-line dark:border-line-dark pb-16">
              <div className="space-y-2">
                <span className="micro-label">Height</span>
                <p className="font-display font-bold text-3xl tracking-tight">{form.height / 100}<span className="text-sm ml-1 opacity-20">M</span></p>
              </div>
              <div className="space-y-2">
                <span className="micro-label">Weight</span>
                <p className="font-display font-bold text-3xl tracking-tight">{form.weight}<span className="text-sm ml-1 opacity-20">KG</span></p>
              </div>
            </section>

            <section className="space-y-8">
              <span className="micro-label">Base Stats</span>
              <div className="space-y-6">
                <StatBar label="HP" value={stats.hp} color="currentColor" />
                <StatBar label="ATK" value={stats.atk} color="currentColor" />
                <StatBar label="DEF" value={stats.def} color="currentColor" />
                <StatBar label="SP.ATK" value={stats["sp.atk"]} color="currentColor" />
                <StatBar label="SP.DEF" value={stats["sp.def"]} color="currentColor" />
                <StatBar label="SPEED" value={stats.speed} color="currentColor" />
              </div>
            </section>

            <section className="space-y-4 pt-12 border-t border-line dark:border-line-dark">
              <span className="micro-label">Field observations</span>
              <p className="text-sm font-medium leading-relaxed italic opacity-60">
                "{form.entry}"
              </p>
            </section>

            <section className="space-y-8 pt-12 border-t border-line dark:border-line-dark">
              <span className="micro-label">Evolution Line</span>
              <EvolutionChain 
                indexData={indexData} 
                shinyMode={shinyMode} 
                currentId={id + (currentFormIndex / 100)}
                onSelect={handleJumpToPokemon}
              />
            </section>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
