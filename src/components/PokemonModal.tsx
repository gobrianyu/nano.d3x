import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Weight, Ruler, Info, Venus, Mars, HelpCircle } from "lucide-react";
import { PokemonDetail, PokemonForm, PokemonIndexItem, PokemonType } from "../types";
import { BASE_DATA_URL, BASE_IMAGE_URL, TYPE_COLORS, CLOUDFRONT_ASSETS_URL } from "../constants";
import StatBar from "./StatBar";
import EvolutionChain from "./EvolutionChain";
import { useQuery } from "@tanstack/react-query";
import { cachedFetch } from "../lib/cacheService";
import { useImage } from "../lib/useImage";
import { Textfit } from "@dalee9000/react19-ts-textfit";

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
  isGimmickOnly?: boolean;
}

export default function PokemonModal({ initialId, initialFormIndex = 0, onClose, indexData, shinyMode, filteredList, isGimmickOnly = false }: PokemonModalProps) {
  // Gallery state: initialized from the filtered grid, but can grow with evolution jumps
  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    // Ensure the initial item is in the gallery
    if (!filteredList.some(item => item.id === initialId && item.matchedFormIndex === initialFormIndex)) {
      const newItem = { id: initialId, matchedFormIndex: initialFormIndex };
      return [...filteredList, newItem].sort((a, b) => a.id - b.id);
    }
    return [...filteredList];
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = filteredList.findIndex(item => item.id === initialId && item.matchedFormIndex === initialFormIndex);
    return idx !== -1 ? idx : 0;
  });

  const currentItem = gallery[currentIndex] || gallery[0];
  const id = currentItem?.id;

  const [gender, setGender] = useState<"m" | "f">("m");
  const [hoveredFormIndex, setHoveredFormIndex] = useState<number | null>(null);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1280);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Force portrait on mobile widths OR if aspect ratio is vertical
      const portrait = height > width || width < 800;
      setIsPortrait(portrait);
      
      // Better threshold for side arrows:
      // Side arrows + margins need ~300px total (150px each side)
      // If modal box takes more than (width - 300), it overlaps or is too tight.
      const modalWidth = portrait ? 0 : Math.min((height - 180) * (5/3), width * 0.98, 1200);
      const needsPill = portrait || (modalWidth + 300 > width);
      setIsNarrow(needsPill);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: detail, isLoading: loading, error: fetchError } = useQuery<PokemonDetail>({
    queryKey: ["pokemonDetail", Math.floor(id)],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${Math.floor(id)}.json`),
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!id,
  });

  useEffect(() => {
    if (detail) {
      const ratio = detail["male:female ratio"];
      if (ratio === 100) setGender("m");
      else if (ratio === 0) setGender("f");
    }
  }, [detail]);

  // Consolidate form construction to one place
  const allForms = useMemo(() => {
    if (!detail) return [];
    return [
      ...(detail.forms || []), 
      ...(detail["gimmick forms"] || [])
    ].filter(f => f && typeof f === 'object');
  }, [detail]);

  const regularFormsCount = detail?.forms?.length || 0;
  
  // Derive currentFormIndex directly from gallery's stored index
  const currentFormIndex = useMemo(() => {
    if (!detail || allForms.length === 0) return 0;
    
    const storedIdx = currentItem?.matchedFormIndex || 0;
    if (storedIdx < allForms.length) return storedIdx;
    
    return 0;
  }, [allForms, detail, currentItem]);

  const form = allForms[currentFormIndex];
  const isGimmick = currentFormIndex >= regularFormsCount;

  // Final validation before rendering
  const isValidData = !!(detail && detail["dex number"] && form && form.name);

  if (!loading && detail && !isValidData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
        <div className="bg-paper dark:bg-ink w-full max-w-lg p-12 flex flex-col items-center gap-8 text-center border border-line dark:border-line-dark shadow-2xl pointer-events-auto">
          <HelpCircle size={40} strokeWidth={1} className="opacity-20" />
          <div className="space-y-2">
            <p className="micro-label opacity-40">Entry Corrupted or Incomplete</p>
            <p className="text-xs opacity-60">The species data for #{id} could not be fully reconstructed.</p>
          </div>
          <button onClick={onClose} className="micro-label px-8 py-3 border border-line cursor-pointer hover:bg-ink hover:text-paper transition-colors">Close</button>
        </div>
      </div>
    );
  }

  if (!isValidData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
        <div className="bg-paper dark:bg-ink w-full max-w-sm p-12 flex flex-col items-center gap-6 border border-line dark:border-line-dark shadow-2xl">
          <div className="w-10 h-10 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
          <p className="micro-label opacity-40">Decrypting Files...</p>
        </div>
      </div>
    );
  }

  const isGigantamax = form?.["special form"]?.startsWith("Gigantamax");

  const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
  const imageUrl = form ? `${BASE_IMAGE_URL}/${form[imageKey] || "unknown.png"}` : "";
  
  const { src: cachedImageUrl, loading: imgLoading, error: imgError } = useImage(imageUrl);

  const stats = form?.["base stats"]?.[0] || { hp: 0, atk: 0, def: 0, "sp.atk": 0, "sp.def": 0, speed: 0 };
  const mainType = (form?.type?.[0] || "Unknown") as PokemonType;
  const accentColor = TYPE_COLORS[mainType] || "#888";

  // Navigation logic
  const handleNext = () => {
    if (currentIndex < gallery.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Drag constraints and handlers for swipe
  const dragThreshold = 50;
  const onDragEnd = (_event: any, info: any) => {
    const swipe = info.offset.x;
    const velocity = info.velocity.x;

    if (swipe < -dragThreshold || velocity < -500) {
      handleNext();
    } else if (swipe > dragThreshold || velocity > 500) {
      handlePrev();
    }
  };

  const handleFormSelect = (idx: number) => {
    const newForm = allForms[idx];
    if (!newForm || !detail) return;
    
    const baseId = detail.index === undefined ? detail["dex number"] : detail.index;
    const newId = Number(newForm.key || baseId);
    
    setGallery(prev => prev.map((item, i) => i === currentIndex ? { ...item, id: newId, matchedFormIndex: idx } : item));
  };

  const handleJumpToPokemon = (targetId: number) => {
    const dexId = Math.floor(targetId);
    const formIndex = Math.round((targetId % 1) * 100);

    const existingIdx = gallery.findIndex(item => Math.floor(item.id) === dexId);
    if (existingIdx !== -1) {
      setGallery(prev => prev.map((item, i) => i === existingIdx ? { ...item, id: targetId, matchedFormIndex: formIndex } : item));
      setCurrentIndex(existingIdx);
    } else {
      // Insert and sort
      const newItem = { id: targetId, matchedFormIndex: formIndex };
      const newGallery = [...gallery, newItem].sort((a, b) => a.id - b.id);
      setGallery(newGallery);
      const newIdx = newGallery.findIndex(item => item.id === targetId);
      if (newIdx !== -1) setCurrentIndex(newIdx);
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
              Detailed records for this Pokémon are still being curated by the artist.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay overflow-hidden p-4 md:p-8" onClick={onClose}>
      {/* Background Dimmer */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 bg-neutral-900/80 backdrop-blur-[4px] cursor-pointer" 
      />
 
      <div className="relative flex flex-col justify-center items-center gap-4 w-full h-full max-h-screen pointer-events-none z-10 m-auto">
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ touchAction: "pan-y" }}
            className={`bg-paper shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden relative flex z-10 text-ink border border-line pointer-events-auto transition-all duration-300 min-h-0 ${
              isPortrait 
                ? "flex-col w-[min(94vw,500px)] flex-1" 
                : "flex-row aspect-[5/3] w-[min(98vw,calc((100vh-180px)*5/3),1200px)]"
            }`}
          >
            {/* Global Floating Close Button */}
            <div className="absolute top-6 right-6 z-50 pointer-events-none">
              <button 
                onClick={onClose}
                className="pointer-events-auto cursor-pointer bg-paper border border-line px-3 py-1.5 micro-label hover:bg-ink hover:text-paper transition-all shadow-sm"
              >
                Close
              </button>
            </div>
            <div className={`flex flex-1 ${isPortrait ? "flex-col overflow-y-auto custom-scrollbar" : "flex-row overflow-hidden"}`}>
              <div className={`flex flex-col flex-1 ${isPortrait ? "h-auto" : "flex-row overflow-hidden"}`}>
                {/* Scrollable Content Container (Portrait) */}
                {isPortrait ? (
                  <div className="flex flex-col w-full h-auto">
                    {/* Header */}
                    <div className="px-8 py-6 space-y-4 shrink-0">
                      <span className="font-display text-xl font-black tracking-tighter">
                        #{String(detail["dex number"]).padStart(4, "0")}
                      </span>
                      <div className="flex items-baseline gap-2 overflow-visible min-w-0 w-full">
                        <Textfit 
                          {...({
                            mode: "single",
                            max: 40, 
                            min: 16,
                            className: "font-display font-black tracking-tighter leading-[0.9] pb-1 whitespace-nowrap w-full",
                            children: form.name
                          } as any)}
                        />
                      </div>
                      {form["special form"] && (
                        <div className="flex items-center gap-3 pt-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-ink/20" />
                          <span className="text-[11px] font-bold tracking-[0.2em] opacity-80 uppercase leading-none">{form["special form"]}</span>
                        </div>
                      )}
                    </div>

                    {/* Image */}
                    <div className="relative aspect-square flex flex-col items-center justify-center shiny-gradient bg-white dark:bg-black/20 shrink-0 border-t border-b border-line">
                      <div className="w-full h-full flex items-center justify-center p-8 relative">
                        {imgLoading && !imgError && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 border border-ink/5 border-t-ink rounded-full animate-spin" />
                          </div>
                        )}
                        {!imgError && !imgLoading && cachedImageUrl ? (
                            <img
                              src={cachedImageUrl}
                              alt={form.name}
                              referrerPolicy="no-referrer"
                              className="max-w-full max-h-full object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_60px_rgba(255,255,255,0.03)] transition-opacity duration-300 opacity-100"
                            />
                        ) : !imgLoading && imgError ? (
                          <div className="flex flex-col items-center gap-4 text-center opacity-20">
                            <span className="font-display text-9xl font-black italic">?</span>
                            <p className="micro-label tracking-[0.5em]">No Asset</p>
                          </div>
                        ) : null}
                      </div>
                      {allForms.length > 1 && !isGimmickOnly && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 right-0 flex flex-col items-end z-40 group/selector pointer-events-none"
                            onMouseLeave={() => setHoveredFormIndex(null)}
                          >
                             <div className="flex flex-col gap-0.5 items-end max-h-[300px] min-w-[500px] overflow-y-auto no-scrollbar py-20 pr-6 pl-[300px] scroll-smooth pointer-events-auto">
                              {allForms.map((f, i) => {
                                const isHovered = hoveredFormIndex === i;
                                const isActive = i === currentFormIndex;
                                return (
                                  <div key={i} className="relative flex items-center justify-end group/form cursor-pointer select-none" onMouseEnter={() => setHoveredFormIndex(i)} onClick={() => handleFormSelect(i)}>
                                    <AnimatePresence>
                                      {isHovered && (
                                        <motion.div initial={{ opacity: 0, x: 20, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }} className="absolute right-full mr-8 bg-ink text-paper px-3 py-2 whitespace-nowrap shadow-2xl z-50 pointer-events-none italic border border-paper/10 text-[10px] font-mono font-bold uppercase tracking-[0.2em]">{f?.["special form"] || f?.name || "???"}</motion.div>
                                      )}
                                    </AnimatePresence>
                                    <div className="w-12 h-5 flex items-center justify-end group-hover/selector:pr-1 transition-all">
                                      <motion.div animate={{ width: (isActive ? 40 : 10) * (isHovered ? 2.5 : 1), height: (isActive ? 4 : 3), opacity: isActive || isHovered ? 1 : 0.4 }} className={`rounded-full origin-right ${isActive || isHovered ? "bg-ink" : "bg-ink/30"}`} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Details Panel (Portrait) */}
                    <div className="w-full px-6 py-8 pb-24 shrink-0 flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-8 min-w-0">
                        {form.type.map((t) => (
                          <span key={t} className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-transparent micro-label border border-line max-w-full text-zinc-900 dark:text-zinc-100">
                            <img src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${t.toLowerCase()}-type-icon.png`} alt={t} className="w-3.5 h-3.5 object-contain shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                            <span className="truncate">{t}</span>
                          </span>
                        ))}
                      </div>
                      <section className="mb-12 space-y-4 min-w-0">
                        <p className="font-display text-xl font-black text-ink uppercase tracking-[0.3em] leading-none break-words tracking-tight">{form.category} Pokémon</p>
                        <div className="space-y-4">
                          <span className="micro-label opacity-30 block">D3x Entry</span>
                          <p className="text-sm font-medium leading-relaxed italic border-l-[3px] border-line pl-6 py-1 break-words">"{form.entry}"</p>
                        </div>
                      </section>
                      <div className="space-y-12 min-w-0">
                        <section className="grid grid-cols-2 gap-10 border-b border-line pb-12">
                          <div className="space-y-2 min-w-0">
                            <span className="micro-label opacity-40">Height</span>
                            <p className="font-display font-bold text-3xl tracking-tighter">{(form.height / 100).toFixed(1)}{isGigantamax && "+"}<span className="text-xs ml-1 opacity-40">M</span></p>
                          </div>
                          <div className="space-y-2 min-w-0">
                            <span className="micro-label opacity-40">Weight</span>
                            <p className="font-display font-bold text-3xl tracking-tighter">{form.weight === -1 ? "???" : form.weight}{form.weight !== -1 && <span className="text-xs ml-1 opacity-40">KG</span>}</p>
                          </div>
                        </section>
                        <section className="space-y-6 min-w-0">
                          <span className="micro-label opacity-40">Base Stats</span>
                          <div className="space-y-3">
                            <StatBar label="HP" value={stats.hp} />
                            <StatBar label="ATK" value={stats.atk} />
                            <StatBar label="DEF" value={stats.def} />
                            <StatBar label="SP.ATK" value={stats["sp.atk"]} />
                            <StatBar label="SP.DEF" value={stats["sp.def"]} />
                            <StatBar label="SPEED" value={stats.speed} />
                          </div>
                        </section>
                        {!isGimmick && !isGimmickOnly && (
                          <section className="space-y-6 pt-12 border-t border-line min-w-0">
                            <span className="micro-label opacity-40">Evolutionary Line</span>
                            <div className="w-full flex justify-center py-4">
                              <EvolutionChain indexData={indexData} shinyMode={shinyMode} currentId={Number(form.key) || detail["dex number"] + currentFormIndex / 100} onSelect={handleJumpToPokemon} />
                            </div>
                          </section>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Image Area - Desktop */}
                    <div className="relative aspect-square h-full flex flex-col items-center justify-center shiny-gradient bg-white dark:bg-black/20 shrink-0 border-r border-line">
                      <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-10 pointer-events-none">
                        <div className="flex flex-col gap-1">
                          <span className="micro-label">Dex ID</span>
                          <span className="font-display text-4xl font-black tracking-tighter">#{String(detail["dex number"]).padStart(4, "0")}</span>
                        </div>
                      </div>
                      {detail.gendered && !isGimmick && (
                        <div className="absolute top-8 right-8 z-10 flex gap-4 pointer-events-auto">
                           {(detail["male:female ratio"] !== 0) && (
                             <button onClick={() => detail["male:female ratio"] !== 100 && setGender("m")} className={`micro-label transition-all flex items-center gap-2 ${gender === "m" ? "text-ink" : "opacity-20"}`}>
                               <Mars size={12} /> M
                             </button>
                           )}
                           {(detail["male:female ratio"] !== 100) && (
                             <button onClick={() => detail["male:female ratio"] !== 0 && setGender("f")} className={`micro-label transition-all flex items-center gap-2 ${gender === "f" ? "text-ink" : "opacity-20"}`}>
                               <Venus size={12} /> F
                             </button>
                           )}
                        </div>
                      )}
                      <div className="w-full h-full flex items-center justify-center p-8 relative">
                        {imgLoading && !imgError && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 border border-ink/5 border-t-ink rounded-full animate-spin" />
                          </div>
                        )}
                        {!imgError && !imgLoading && cachedImageUrl ? (
                            <img src={cachedImageUrl} alt={form.name} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-opacity duration-300 opacity-100" />
                        ) : !imgLoading && imgError ? (
                          <div className="flex flex-col items-center gap-4 text-center opacity-20">
                            <span className="font-display text-9xl font-black italic">?</span>
                            <p className="micro-label tracking-[0.5em]">No Asset</p>
                          </div>
                        ) : null}
                      </div>
                      {allForms.length > 1 && !isGimmickOnly && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-0 flex flex-col items-end z-40 group/selector pointer-events-none" onMouseLeave={() => setHoveredFormIndex(null)}>
                          <div className="flex flex-col gap-0.5 items-end max-h-[80vh] min-w-[500px] overflow-y-auto no-scrollbar py-20 pr-6 pl-[300px] scroll-smooth pointer-events-auto">
                            {allForms.map((f, i) => (
                              <div key={i} className="relative flex items-center justify-end group/form cursor-pointer select-none" onMouseEnter={() => setHoveredFormIndex(i)} onClick={() => handleFormSelect(i)}>
                                <AnimatePresence>{hoveredFormIndex === i && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="absolute right-full mr-8 bg-ink text-paper px-3 py-2 whitespace-nowrap shadow-2xl z-50 italic border border-paper/10 text-[10px] font-mono font-bold uppercase tracking-[0.2em]">{f?.["special form"] || f?.name || "???"}</motion.div>}</AnimatePresence>
                                <div className="w-12 h-5 flex items-center justify-end transition-all">
                                  <motion.div animate={{ width: (i === currentFormIndex ? 40 : 10) * (hoveredFormIndex === i ? 2.5 : 1), height: (i === currentFormIndex ? 4 : 3), opacity: i === currentFormIndex || hoveredFormIndex === i ? 1 : 0.4 }} className={`rounded-full origin-right ${i === currentFormIndex || hoveredFormIndex === i ? "bg-ink" : "bg-ink/30"}`} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Details Panel - Desktop */}
                    <div className="flex flex-col relative box-border md:w-5/12 px-8 py-12 lg:px-10 overflow-y-auto custom-scrollbar">
                      <header className="mb-12">
                        <div className="flex flex-col gap-4">
                          <Textfit {...({ mode: "single", max: 80, min: 20, className: "font-display font-black tracking-tighter leading-[0.85] pb-4 whitespace-nowrap", children: form.name } as any)} />
                          {form["special form"] && (
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-2 h-2 rounded-full bg-ink/10" />
                              <span className="text-xs font-bold tracking-[0.2em] opacity-90 uppercase leading-none">{form["special form"]}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                             {form.type.map((t) => (
                              <span key={t} className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 bg-transparent micro-label border border-line">
                                <img src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${t.toLowerCase()}-type-icon.png`} alt={t} className="w-4 h-4 object-contain" />
                                <span>{t}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </header>
                      <section className="mb-12 space-y-4">
                        <p className="font-display text-xl font-black text-ink uppercase tracking-[0.3em] leading-none">{form.category} Pokémon</p>
                        <div className="space-y-4">
                          <span className="micro-label opacity-30 block">D3x Entry</span>
                          <p className="text-sm font-medium leading-relaxed italic border-l-[3px] border-line pl-6 py-1">"{form.entry}"</p>
                        </div>
                      </section>
                      <div className="space-y-12">
                        <section className="grid grid-cols-2 gap-10 border-b border-line pb-12">
                           <div className="space-y-2">
                            <span className="micro-label opacity-40">Height</span>
                            <p className="font-display font-bold text-3xl tracking-tighter">{(form.height / 100).toFixed(1)}{isGigantamax && "+"}<span className="text-xs ml-1 opacity-40">M</span></p>
                          </div>
                          <div className="space-y-2">
                            <span className="micro-label opacity-40">Weight</span>
                            <p className="font-display font-bold text-3xl tracking-tighter">{form.weight === -1 ? "???" : form.weight}{form.weight !== -1 && <span className="text-xs ml-1 opacity-40">KG</span>}</p>
                          </div>
                        </section>
                        <section className="space-y-6">
                          <span className="micro-label opacity-40">Base Stats</span>
                          <div className="space-y-3">
                            <StatBar label="HP" value={stats.hp} />
                            <StatBar label="ATK" value={stats.atk} />
                            <StatBar label="DEF" value={stats.def} />
                            <StatBar label="SP.ATK" value={stats["sp.atk"]} />
                            <StatBar label="SP.DEF" value={stats["sp.def"]} />
                            <StatBar label="SPEED" value={stats.speed} />
                          </div>
                        </section>
                        {!isGimmick && !isGimmickOnly && (
                          <section className="space-y-6 pt-12 border-t border-line">
                            <span className="micro-label opacity-40">Evolutionary Line</span>
                            <div className="w-full flex justify-center py-4">
                              <EvolutionChain indexData={indexData} shinyMode={shinyMode} currentId={Number(form.key) || detail["dex number"] + currentFormIndex / 100} onSelect={handleJumpToPokemon} />
                            </div>
                          </section>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
        </div>

        {/* Archive Navigation PILL - Positioned below the box */}
        {gallery.length > 1 && (
          <div className="flex items-center bg-paper/90 backdrop-blur-md border border-line rounded-full shadow-xl pointer-events-auto my-2 overflow-hidden">
            <button 
              disabled={currentIndex === 0}
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className={`flex items-center gap-3 px-8 py-3 micro-label transition-all active:scale-95 ${
                currentIndex === 0 
                  ? "opacity-10" 
                  : "text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              }`}
            >
              <ChevronLeft size={14} /> <span className="font-bold tracking-[0.2em] text-[10px]">PREV</span>
            </button>
            <div className="w-px h-4 bg-line" />
            <button 
              disabled={currentIndex === gallery.length - 1}
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className={`flex items-center gap-3 px-8 py-3 micro-label transition-all active:scale-95 ${
                currentIndex === gallery.length - 1 
                  ? "opacity-10" 
                  : "text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              }`}
            >
              <span className="font-bold tracking-[0.2em] text-[10px]">NEXT</span> <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
