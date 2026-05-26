import { useState, useEffect, useMemo, useRef, TouchEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Venus, Mars, HelpCircle } from "lucide-react";
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
  solidBg?: boolean;
  onImageLoad?: (id: number, formIndex: number) => void;
  filteredList: GalleryItem[];
  isGimmickOnly?: boolean;
  viewMode?: string;
}

export default function PokemonModal({ initialId, initialFormIndex = 0, onClose, indexData, shinyMode, solidBg = false, onImageLoad, filteredList, isGimmickOnly = false, viewMode }: PokemonModalProps) {
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
  const [isPortrait, setIsPortrait] = useState(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return height > width || width < 800;
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [renderSig, setRenderSig] = useState(0);

  // Trigger content-recalculation after layout transition or window resizing finishes
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderSig(prev => prev + 1);
    }, 350);
    return () => clearTimeout(timer);
  }, [isPortrait, isExpanded, windowWidth]);

  const portraitScrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (portraitScrollRef.current) {
      portraitScrollRef.current.scrollTop = 0;
    }
    if (desktopScrollRef.current) {
      desktopScrollRef.current.scrollTop = 0;
    }
  }, [id, currentIndex]);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1280);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Force portrait on mobile widths OR if aspect ratio is vertical
      const portrait = height > width || width < 800;
      setIsPortrait(portrait);
      setWindowWidth(width);
      
      // Better threshold for side arrows:
      // Side arrows + margins need ~300px total (150px each side)
      // If modal box takes more than (width - 300), it overlaps or is too tight.
      const modalWidth = portrait ? 0 : Math.min((height - 180) * (5/3), width * 0.98, 1200);
      const needsPill = portrait || (modalWidth + 300 > width);
      setIsNarrow(needsPill);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: detail, isLoading: loading, error: fetchError } = useQuery<PokemonDetail>({
    queryKey: ["pokemonDetail", id ? Math.floor(id) : 0],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${id ? Math.floor(id) : 0}.json`),
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

  // Consolidate form construction
  const allForms = useMemo(() => {
    if (!detail) return [];
    return [
      ...(detail.forms || []), 
      ...(detail["gimmick forms"] || [])
    ].filter(f => f && typeof f === 'object');
  }, [detail]);

  const regularFormsCount = detail?.forms?.length || 0;
  
  const currentFormIndex = useMemo(() => {
    if (!detail || allForms.length === 0) return 0;
    const storedIdx = currentItem?.matchedFormIndex || 0;
    return (storedIdx < allForms.length) ? storedIdx : 0;
  }, [allForms, detail, currentItem]);

  const form = allForms[currentFormIndex];
  const isGimmick = currentFormIndex >= regularFormsCount;

  const isGigantamax = form?.gimmick === "gmax" || form?.gimmick === "emax";
  const isMega = form?.gimmick === "mega";

  const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
  const imageUrl = form ? `${BASE_IMAGE_URL}/${form[imageKey] || "unknown.png"}` : "";
  
  const { src: cachedImageUrl, loading: imgLoading, error: imgError } = useImage(
    imageUrl, 
    !!form, // Only enable if form is available
    () => onImageLoad && onImageLoad(id, currentFormIndex)
  );

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

  // Early returns for Loading / Error / Missing Data
  if (loading && !detail) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="fixed inset-0 bg-neutral-900/80 backdrop-blur-[4px] cursor-pointer" 
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative bg-paper dark:bg-ink w-full max-w-sm p-12 flex flex-col items-center gap-8 border shadow-2xl z-10 border-line dark:border-line-dark`}
        >
          <div className={`w-12 h-12 border-2 border-t-transparent rounded-full animate-spin ${isGigantamax ? 'border-gmax' : isMega ? 'border-mega' : 'border-ink dark:border-paper'}`} />
          <div className="text-center space-y-2">
            <p className={`micro-label font-black tracking-[0.2em]`}>Loading</p>
            <p className="text-[10px] opacity-40 uppercase tracking-widest">Fetching data...</p>
          </div>
          <button onClick={onClose} className="micro-label px-6 py-2 border border-line opacity-40 hover:opacity-100 transition-all">Cancel</button>
        </motion.div>
      </div>
    );
  }

  if (fetchError || (detail && (!detail["dex number"] || !allForms.length))) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="fixed inset-0 bg-neutral-900/80 backdrop-blur-[4px] cursor-pointer" 
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-paper dark:bg-ink w-full max-w-md p-12 flex flex-col items-center gap-8 text-center border border-line dark:border-line-dark shadow-2xl z-10"
        >
          <HelpCircle size={40} strokeWidth={1} className="opacity-20" />
          <div className="space-y-3">
            <h3 className="font-display text-2xl font-black italic">Entry Incomplete</h3>
            <p className="text-xs uppercase tracking-widest opacity-40 leading-relaxed px-4">
              Detailed records for this species could not be retrieved from the archive.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="micro-label px-8 py-3 border border-line hover:bg-ink dark:hover:bg-paper hover:text-paper dark:hover:text-ink transition-all"
          >
            Return to Grid
          </button>
        </motion.div>
      </div>
    );
  }

  // Ensure form exists before main render
  if (!form || !detail) return null;

  const stats = form["base stats"]?.[0] || { hp: 0, atk: 0, def: 0, "sp.atk": 0, "sp.def": 0, speed: 0 };
  const mainType = (form.type?.[0] || "Unknown") as PokemonType;
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

  // Gesture Touch handlers for swipe navigation on mobile devices
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Check if horizontal movement is dominant and meets a gesture threshold (e.g. 50px)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
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

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center modal-overlay overflow-hidden ${isPortrait && isExpanded ? "p-0" : "p-4 md:p-8"}`} onClick={onClose}>
      {/* Background Dimmer */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 bg-neutral-900/80 backdrop-blur-[4px] cursor-pointer" 
      />
 
      <div className={`relative flex flex-col justify-center items-center gap-4 w-full h-full pointer-events-none z-10 m-auto ${isPortrait && isExpanded ? "p-0 max-w-none max-h-none h-full m-0" : "max-h-screen"}`}>
          {isPortrait && !isExpanded && (
            <div className="w-[min(94vw,400px)] flex justify-start pl-1 -mb-2 shrink-0">
              <span className="font-display text-sm font-black tracking-tighter text-paper select-none">
                #{String(detail["dex number"]).padStart(4, "0")}
              </span>
            </div>
          )}
          <div 
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: "pan-y" }}
            className={`bg-paper shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden flex z-10 text-ink border pointer-events-auto transition-all duration-300 min-h-0 ${
              isGigantamax ? 'border-gmax gmax-border-pulse' : isMega ? 'border-mega' : 'border-line'
            } ${
              isPortrait 
                ? (isExpanded 
                    ? "fixed inset-0 w-full h-full max-h-screen m-0 border-0 rounded-none flex-col shadow-none" 
                    : "relative flex-col w-[min(94vw,400px)] h-auto rounded-none shrink-0") 
                : "relative flex-row aspect-[5/3] w-[min(98vw,calc((100vh-180px)*5/3),1200px)] rounded-none"
            }`}
          >
            {/* Global Floating Close Button */}
            {(!isPortrait || isExpanded) && (
              <div className="absolute top-6 right-6 z-50 pointer-events-none">
                <button 
                  onClick={onClose}
                  className={`pointer-events-auto cursor-pointer bg-paper border border-line px-3 py-1.5 micro-label transition-all shadow-sm hover:bg-ink hover:text-paper text-ink`}
                >
                  Close
                </button>
              </div>
            )}

            {/* Back Button for Portrait Expanded Mode */}
            {isPortrait && isExpanded && (
              <div className="absolute top-6 left-6 z-50 pointer-events-auto">
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="cursor-pointer bg-paper border border-line px-3 py-1.5 micro-label transition-all shadow-sm hover:bg-ink hover:text-paper text-ink"
                >
                  ← Card
                </button>
              </div>
            )}

            <div 
              ref={portraitScrollRef}
              className={`flex flex-1 ${
                isPortrait 
                  ? (isExpanded ? "flex-col overflow-y-auto custom-scrollbar" : "flex-col overflow-hidden") 
                  : "flex-row overflow-hidden"
              }`}
            >
              <div className={`flex flex-col flex-1 ${isPortrait ? "h-auto" : "flex-row overflow-hidden"}`}>
                {/* Scrollable Content Container (Portrait) */}
                {isPortrait ? (
                  !isExpanded ? (
                    <div className="flex flex-col w-full h-auto p-0 select-none shrink-0">
                      {/* Image Area */}
                      <div className={`relative w-full aspect-square flex items-center justify-center overflow-hidden shrink-0 transition-colors duration-200 ${
                        solidBg ? 'bg-[#fcfcf9] dark:bg-[#e2e2dc]' : (
                          isGigantamax ? 'bg-gmax-soft gmax-gradient' : 
                          isMega ? 'bg-mega-soft mega-gradient' : 
                          'shiny-gradient bg-white dark:bg-black/20'
                        )
                      }`}>
                        {/* Pokémon Name (Top Left inside Image area) */}
                        <div className="absolute top-4 left-4 right-24 flex flex-col gap-0.5 overflow-visible min-w-0 pointer-events-auto z-30">
                          <Textfit 
                            key={`name-p-non-${id}-${currentFormIndex}-${renderSig}`}
                            {...({
                              mode: "single",
                              max: 22, 
                              min: 14,
                              className: `font-display font-black tracking-tighter leading-tight ${isGigantamax ? 'bg-gradient-to-b from-white from-0% via-white via-35% via-[#d0006f] via-55% to-[#d0006f] to-100% bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(208,0,111,0.3)]' : (solidBg ? 'text-[#121212]' : 'text-ink')}`,
                              children: form.name
                            } as any)}
                          />
                        </div>

                        {/* Top Right Close Button & Gender Controls */}
                        <div className="absolute top-4 right-4 z-50 pointer-events-auto flex items-center gap-3">
                          {detail && detail.gendered && !isGimmick && (
                            <div className={`flex rounded-sm p-0.5 border gap-0.5 items-center select-none mr-1
                              ${solidBg 
                                ? 'bg-[#121212]/5 border-[#121212]/10' 
                                : 'bg-paper/40 dark:bg-[#121212]/30 backdrop-blur-sm border-line'
                              }`}
                            >
                              {(detail["male:female ratio"] !== 0) && (
                                <button 
                                  onClick={() => detail["male:female ratio"] !== 100 && setGender("m")} 
                                  className={`px-2 py-0.5 text-[9px] uppercase font-mono tracking-wider font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 rounded-sm
                                    ${gender === "m"
                                      ? (solidBg 
                                          ? 'bg-[#121212] !text-[#fcfcf9] shadow-xs' 
                                          : 'bg-ink !text-paper shadow-xs'
                                        )
                                      : (solidBg
                                          ? 'text-[#121212]/40 hover:text-[#121212] hover:bg-[#121212]/5'
                                          : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                                        )
                                    }`}
                                >
                                  <Mars size={11} className="shrink-0" />
                                  <span>M</span>
                                </button>
                              )}
                              {(detail["male:female ratio"] !== 100) && (
                                <button 
                                  onClick={() => detail["male:female ratio"] !== 0 && setGender("f")} 
                                  className={`px-2 py-0.5 text-[9px] uppercase font-mono tracking-wider font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 rounded-sm
                                    ${gender === "f"
                                      ? (solidBg 
                                          ? 'bg-[#121212] !text-[#fcfcf9] shadow-xs' 
                                          : 'bg-ink !text-paper shadow-xs'
                                        )
                                      : (solidBg
                                          ? 'text-[#121212]/40 hover:text-[#121212] hover:bg-[#121212]/5'
                                          : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                                        )
                                    }`}
                                >
                                  <Venus size={11} className="shrink-0" />
                                  <span>F</span>
                                </button>
                              )}
                            </div>
                          )}
                          <button 
                            onClick={onClose}
                            className="cursor-pointer bg-paper hover:bg-ink hover:text-paper text-[10px] font-mono font-black tracking-[0.15em] uppercase text-ink border border-line px-2.5 py-1.5 transition-all shadow-sm rounded-none"
                          >
                            Close
                          </button>
                        </div>

                        <div className="w-full h-full flex items-center justify-center pt-16 pb-12 px-6 relative">
                          {imgLoading && !imgError && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className={`w-8 h-8 border border-t-current rounded-full animate-spin ${isGigantamax ? 'text-gmax' : isMega ? 'text-mega' : (solidBg ? 'text-[#121212]' : 'text-ink')}`} />
                            </div>
                          )}
                          {!imgError && !imgLoading && cachedImageUrl ? (
                              <img
                                src={cachedImageUrl}
                                alt={form.name}
                                referrerPolicy="no-referrer"
                                className={`max-w-full max-h-full object-contain transition-opacity duration-300 opacity-100 p-2 ${
                                  isGigantamax ? 'drop-shadow-[0_12px_36px_rgba(208,0,111,0.3)]' : 
                                  isMega ? 'drop-shadow-[0_12px_36px_rgba(233,176,247,0.3)]' : 
                                  'drop-shadow-[0_12px_36px_rgba(0,0,0,0.06)]'
                                }`}
                              />
                          ) : !imgLoading && imgError ? (
                            <div className="flex flex-col items-center gap-2 text-center opacity-20">
                              <span className="font-display text-6xl font-black italic">?</span>
                              <p className="micro-label tracking-[0.3em] text-[9px]">No Asset</p>
                            </div>
                          ) : null}
                        </div>

                        {/* Special Form / Gimmick text at the bottom-center of the image square */}
                        <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center justify-center gap-1 pointer-events-none z-30">
                          {(form.gimmick === "gmax" || form.gimmick === "emax") && (
                            <span className="text-[9px] font-black tracking-[0.2em] uppercase leading-none text-gmax animate-pulse">
                              {form.gimmick === "emax" ? "ETERNAMAX" : "GIGANTAMAX"}
                            </span>
                          )}
                          {form["special form"] && (
                            <span className={`text-[9px] font-bold tracking-[0.2em] uppercase leading-none ${solidBg ? 'text-[#121212]/60' : 'text-ink opacity-60'}`}>
                              {form["special form"]}
                            </span>
                          )}
                        </div>

                        {/* Form Dots Selection Overlay */}
                        {allForms.length > 1 && !isGimmickOnly && (
                          <div className="absolute inset-y-0 right-3 flex items-center z-40 pointer-events-auto">
                            <div className="flex flex-col gap-1.5 items-end justify-center">
                              {allForms.map((f, i) => {
                                const isActive = i === currentFormIndex;
                                const fIsGmax = f?.gimmick === "gmax" || f?.gimmick === "emax";
                                return (
                                  <button 
                                    key={`form-p-dots-${i}`} 
                                    onClick={(e) => { e.stopPropagation(); handleFormSelect(i); }}
                                    className="group/dot flex items-center gap-1.5 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                                  >
                                    <span className="text-[8px] font-bold tracking-wider font-mono uppercase opacity-0 group-hover/dot:opacity-100 transition-opacity bg-ink text-paper px-1 rounded pointer-events-none">
                                      {f?.["special form"] || f?.name || "Form"}
                                    </span>
                                    <div 
                                      className={`transition-all rounded-full ${
                                        isActive 
                                          ? `${fIsGmax && viewMode === "gigantamax" ? "bg-gmax w-4" : "bg-ink w-4"} h-1.5` 
                                          : 'bg-ink/20 w-1.5 h-1.5 hover:bg-ink/40'
                                      }`} 
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* See More Details Button */}
                      <button
                        onClick={() => setIsExpanded(true)}
                        className={`w-full py-4.5 text-center micro-label tracking-[0.2em] font-black uppercase text-xs border-t rounded-none transition-all active:scale-[0.98] cursor-pointer shrink-0 ${
                          isGigantamax ? 'border-gmax text-gmax hover:bg-gmax hover:text-white' : 
                          isMega ? 'border-mega text-mega hover:bg-mega hover:text-white' : 
                          'border-line text-ink hover:bg-ink hover:text-paper bg-transparent'
                        }`}
                      >
                        See More Details
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col w-full h-auto">
                      {/* Header */}
                      <div className="px-8 py-6 space-y-1 shrink-0 mt-14">
                        <span className={`font-display text-xl font-black tracking-tighter mb-2 block ${isGigantamax ? 'text-gmax' : isMega ? 'text-mega' : ''}`}>
                          #{String(detail["dex number"]).padStart(4, "0")}
                        </span>
                        
                        <div className="flex items-baseline gap-2 overflow-visible min-w-0 w-full">
                          <Textfit 
                            key={`name-p-exp-${id}-${currentFormIndex}-${renderSig}`}
                            {...({
                              mode: "single",
                              max: 40, 
                              min: 16,
                              className: `font-display font-black tracking-tighter leading-[1.1] px-1 whitespace-nowrap w-full ${isGigantamax ? 'bg-gradient-to-b from-white from-0% via-white via-35% via-[#d0006f] via-55% to-[#d0006f] to-100% bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(208,0,111,0.3)]' : 'text-ink'}`,
                              children: form.name
                            } as any)}
                          />
                        </div>
                      </div>

                      {/* Image */}
                      <div className={`relative aspect-square flex flex-col items-center justify-center shrink-0 border-t border-b border-line transition-colors duration-200 ${
                        solidBg ? 'bg-[#fcfcf9] dark:bg-[#e2e2dc]' : (
                          isGigantamax ? 'bg-gmax-soft gmax-gradient' : 
                          isMega ? 'bg-mega-soft mega-gradient' : 
                          'shiny-gradient bg-white dark:bg-black/20'
                        )
                      }`}>
                        {detail && detail.gendered && !isGimmick && (
                          <div className={`absolute top-4 right-4 z-10 flex rounded-sm p-0.5 border gap-0.5 items-center select-none pointer-events-auto
                            ${solidBg 
                              ? 'bg-[#121212]/5 border-[#121212]/10' 
                              : 'bg-paper/40 dark:bg-[#121212]/30 backdrop-blur-sm border-line'
                            }`}
                          >
                             {(detail["male:female ratio"] !== 0) && (
                               <button 
                                 onClick={() => detail["male:female ratio"] !== 100 && setGender("m")} 
                                 className={`px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-mono tracking-wider font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 rounded-sm
                                   ${gender === "m"
                                     ? (solidBg 
                                         ? 'bg-[#121212] !text-[#fcfcf9] shadow-sm' 
                                         : 'bg-ink !text-paper shadow-sm'
                                       )
                                     : (solidBg
                                         ? 'text-[#121212]/40 hover:text-[#121212] hover:bg-[#121212]/5'
                                         : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                                       )
                                   }`}
                               >
                                 <Mars size={12} className="shrink-0" />
                                 <span>M</span>
                               </button>
                             )}
                             {(detail["male:female ratio"] !== 100) && (
                               <button 
                                 onClick={() => detail["male:female ratio"] !== 0 && setGender("f")} 
                                 className={`px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-mono tracking-wider font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 rounded-sm
                                   ${gender === "f"
                                     ? (solidBg 
                                         ? 'bg-[#121212] !text-[#fcfcf9] shadow-sm' 
                                         : 'bg-ink !text-paper shadow-sm'
                                       )
                                     : (solidBg
                                         ? 'text-[#121212]/40 hover:text-[#121212] hover:bg-[#121212]/5'
                                         : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                                       )
                                   }`}
                               >
                                 <Venus size={12} className="shrink-0" />
                                 <span>F</span>
                               </button>
                             )}
                          </div>
                        )}
                        <div className="w-full h-full flex items-center justify-center p-8 relative">
                          {imgLoading && !imgError && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className={`w-10 h-10 border border-t-current rounded-full animate-spin ${isGigantamax ? 'text-gmax' : isMega ? 'text-mega' : (solidBg ? 'text-[#121212]' : 'text-ink')}`} />
                            </div>
                          )}
                          {!imgError && !imgLoading && cachedImageUrl ? (
                              <img
                                src={cachedImageUrl}
                                alt={form.name}
                                referrerPolicy="no-referrer"
                                className={`max-w-full max-h-full object-contain transition-opacity duration-300 opacity-100 ${
                                  isGigantamax ? 'drop-shadow-[0_20px_60px_rgba(208,0,111,0.3)]' : 
                                  isMega ? 'drop-shadow-[0_20px_60px_rgba(233,176,247,0.3)]' : 
                                  'drop-shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_60px_rgba(255,255,255,0.03)]'
                                }`}
                              />
                          ) : !imgLoading && imgError ? (
                            <div className="flex flex-col items-center gap-4 text-center opacity-20">
                              <span className="font-display text-9xl font-black italic">?</span>
                              <p className="micro-label tracking-[0.5em]">No Asset</p>
                            </div>
                          ) : null}
                        </div>

                        {/* Special Form / Gimmick text at the bottom-center of the image square */}
                        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center gap-1 pointer-events-none z-30">
                          {(form.gimmick === "gmax" || form.gimmick === "emax") && (
                            <span className="text-[10px] font-black tracking-[0.2em] uppercase leading-none text-gmax animate-pulse">
                              {form.gimmick === "emax" ? "ETERNAMAX" : "GIGANTAMAX"}
                            </span>
                          )}
                          {form["special form"] && (
                            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase leading-none ${solidBg ? 'text-[#121212]/60' : 'text-ink opacity-60'}`}>
                              {form["special form"]}
                            </span>
                          )}
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
                                  const fIsGmax = f?.gimmick === "gmax" || f?.gimmick === "emax";
                                  return (
                                    <div key={`form-p-${i}`} className="relative flex items-center justify-end group/form cursor-pointer select-none" onMouseEnter={() => setHoveredFormIndex(i)} onClick={() => handleFormSelect(i)}>
                                      <AnimatePresence>
                                        {isHovered && (
                                          <motion.div initial={{ opacity: 0, x: 20, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }} className="absolute right-full mr-8 bg-ink text-paper px-3 py-2 whitespace-nowrap shadow-2xl z-50 pointer-events-none italic border border-paper/10 text-[10px] font-mono font-bold uppercase tracking-[0.2em]">{f?.["special form"] || f?.name || "???"}</motion.div>
                                        )}
                                      </AnimatePresence>
                                      <div className="w-12 h-5 flex items-center justify-end group-hover/selector:pr-1 transition-all">
                                        <motion.div animate={{ width: (isActive ? 40 : 10) * (isHovered ? 2.5 : 1), height: (isActive ? 4 : 3), opacity: isActive || isHovered ? 1 : 0.4 }} className={`rounded-full origin-right ${isActive || isHovered ? (fIsGmax && viewMode === "gigantamax" ? "bg-gmax shadow-[0_0_8px_rgba(208,0,111,0.5)]" : "bg-ink") : "bg-ink/30"}`} />
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
                          {form.type.map((t, idx) => (
                            <span key={`type-p-${t}-${idx}`} className={`flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-transparent micro-label border max-w-full border-line text-zinc-900 dark:text-zinc-100`}>
                              <img src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${t.toLowerCase()}-type-icon.png`} alt={t} className="w-3.5 h-3.5 object-contain shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                              <span className="truncate">{t}</span>
                            </span>
                          ))}
                        </div>
                        <section className="mb-12 space-y-4 min-w-0">
                          <p className={`font-display text-xl font-black uppercase tracking-[0.3em] leading-tight break-words tracking-tight text-ink`}>{form.category} Pokémon</p>
                          <div className="space-y-4">
                            <span className="micro-label opacity-30 block">D3x Entry</span>
                            <p className={`text-sm font-medium leading-relaxed italic border-l-[3px] pl-6 py-1 break-words border-line`}>"{form.entry}"</p>
                          </div>
                        </section>
                        <div className="space-y-12 min-w-0">
                          <section className={`grid grid-cols-2 gap-10 border-b pb-12 border-line`}>
                            <div className="space-y-2 min-w-0">
                              <span className="micro-label opacity-40">Height</span>
                              <p className={`font-display font-bold text-3xl tracking-tighter ${isGigantamax ? 'text-gmax' : ''}`}>{(form.height / 100).toFixed(1)}{(isGigantamax || isMega) && "+"}<span className="text-xs ml-1 opacity-40">M</span></p>
                            </div>
                            <div className="space-y-2 min-w-0">
                              <span className="micro-label opacity-40">Weight</span>
                              <p className={`font-display font-bold text-3xl tracking-tighter ${isGigantamax ? 'text-gmax' : ''}`}>{form.weight === -1 ? "???" : form.weight}{form.weight !== -1 && <span className="text-xs ml-1 opacity-40">KG</span>}</p>
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
                            <section className={`space-y-6 pt-12 border-t min-w-0 border-line`}>
                              <span className="micro-label opacity-40">Evolutionary Line</span>
                              <div className="w-full flex justify-center py-4">
                                <EvolutionChain indexData={indexData} shinyMode={shinyMode} currentId={Number(form.key) || detail["dex number"] + currentFormIndex / 100} onSelect={handleJumpToPokemon} />
                              </div>
                            </section>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    {/* Image Area - Desktop */}
                    <div className={`relative aspect-square h-full flex flex-col items-center justify-center shrink-0 border-r border-line transition-colors duration-200 ${
                      solidBg ? 'bg-[#fcfcf9] dark:bg-[#e2e2dc]' : (
                        isGigantamax ? 'bg-gmax-soft gmax-gradient' : 
                        isMega ? 'bg-mega-soft mega-gradient' : 
                        'shiny-gradient bg-white dark:bg-black/20'
                      )
                    }`}>
                      <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-10 pointer-events-none">
                        <div className="flex flex-col gap-1">
                          <span className={`micro-label ${solidBg ? '!text-[#121212]/50' : ''}`}>Dex ID</span>
                          <span className={`font-display text-4xl font-black tracking-tighter ${isGigantamax ? 'text-gmax' : isMega ? 'text-mega' : (solidBg ? 'text-[#121212]' : 'text-ink')}`}>#{String(detail["dex number"]).padStart(4, "0")}</span>
                        </div>
                      </div>
                      {detail.gendered && !isGimmick && (
                        <div className={`absolute top-8 right-8 z-10 flex rounded-sm p-0.5 border gap-0.5 items-center select-none pointer-events-auto
                          ${solidBg 
                            ? 'bg-[#121212]/5 border-[#121212]/10' 
                            : 'bg-paper/40 dark:bg-[#121212]/30 backdrop-blur-sm border-line'
                          }`}
                        >
                           {(detail["male:female ratio"] !== 0) && (
                             <button 
                               onClick={() => detail["male:female ratio"] !== 100 && setGender("m")} 
                               className={`px-2 py-0.5 text-xs uppercase font-mono tracking-wider font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 rounded-sm
                                 ${gender === "m"
                                   ? (solidBg 
                                       ? 'bg-[#121212] !text-[#fcfcf9] shadow-sm' 
                                       : 'bg-ink !text-paper shadow-sm'
                                     )
                                   : (solidBg
                                       ? 'text-[#121212]/40 hover:text-[#121212] hover:bg-[#121212]/5'
                                       : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                                     )
                                 }`}
                             >
                               <Mars size={12} className="shrink-0" />
                               <span>M</span>
                             </button>
                           )}
                           {(detail["male:female ratio"] !== 100) && (
                             <button 
                               onClick={() => detail["male:female ratio"] !== 0 && setGender("f")} 
                               className={`px-2 py-0.5 text-xs uppercase font-mono tracking-wider font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 rounded-sm
                                 ${gender === "f"
                                   ? (solidBg 
                                       ? 'bg-[#121212] !text-[#fcfcf9] shadow-sm' 
                                       : 'bg-ink !text-paper shadow-sm'
                                     )
                                   : (solidBg
                                       ? 'text-[#121212]/40 hover:text-[#121212] hover:bg-[#121212]/5'
                                       : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                                     )
                                 }`}
                             >
                               <Venus size={12} className="shrink-0" />
                               <span>F</span>
                             </button>
                           )}
                        </div>
                      )}
                      <div className="w-full h-full flex items-center justify-center p-8 relative">
                        {imgLoading && !imgError && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className={`w-10 h-10 border border-t-current rounded-full animate-spin ${isGigantamax ? 'text-gmax' : isMega ? 'text-mega' : (solidBg ? 'text-[#121212]' : 'text-ink')}`} />
                          </div>
                        )}
                        {!imgError && !imgLoading && cachedImageUrl ? (
                            <img src={cachedImageUrl} alt={form.name} referrerPolicy="no-referrer" className={`max-w-full max-h-full object-contain transition-opacity duration-300 opacity-100 ${
                              isGigantamax ? 'drop-shadow-[0_20px_60px_rgba(208,0,111,0.3)]' : 
                              isMega ? 'drop-shadow-[0_20px_60px_rgba(233,176,247,0.3)]' : 
                              'drop-shadow-[0_20px_60px_rgba(0,0,0,0.08)]'
                            }`} />
                        ) : !imgLoading && imgError ? (
                          <div className="flex flex-col items-center gap-4 text-center opacity-20">
                            <span className="font-display text-9xl font-black italic">?</span>
                            <p className="micro-label tracking-[0.5em]">No Asset</p>
                          </div>
                        ) : null}
                      </div>

                      {/* Special Form / Gimmick text at the bottom-center of the image square */}
                      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none z-30">
                        {(form.gimmick === "gmax" || form.gimmick === "emax") && (
                          <span className="text-xs font-black tracking-[0.2em] uppercase leading-none text-gmax animate-pulse">
                            {form.gimmick === "emax" ? "ETERNAMAX" : "GIGANTAMAX"}
                          </span>
                        )}
                        {form["special form"] && (
                          <span className={`text-xs font-bold tracking-[0.2em] uppercase leading-none ${solidBg ? 'text-[#121212]/60' : 'text-ink opacity-60'}`}>
                            {form["special form"]}
                          </span>
                        )}
                      </div>

                      {allForms.length > 1 && !isGimmickOnly && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-0 flex flex-col items-end z-40 group/selector pointer-events-none" onMouseLeave={() => setHoveredFormIndex(null)}>
                          <div className="flex flex-col gap-0.5 items-end max-h-[80vh] min-w-[500px] overflow-y-auto no-scrollbar py-20 pr-6 pl-[300px] scroll-smooth pointer-events-auto">
                            {allForms.map((f, i) => {
                              const fIsGmax = f?.gimmick === "gmax" || f?.gimmick === "emax";
                              return (
                                <div key={`form-d-${i}`} className="relative flex items-center justify-end group/form cursor-pointer select-none" onMouseEnter={() => setHoveredFormIndex(i)} onClick={() => handleFormSelect(i)}>
                                  <AnimatePresence>{hoveredFormIndex === i && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className={`absolute right-full mr-8 px-3 py-2 whitespace-nowrap shadow-2xl z-50 italic border text-[10px] font-mono font-bold uppercase tracking-[0.2em] bg-ink text-paper border-paper/10`}>{f?.["special form"] || f?.name || "???"}</motion.div>}</AnimatePresence>
                                  <div className="w-12 h-5 flex items-center justify-end transition-all">
                                    <motion.div animate={{ width: (i === currentFormIndex ? 40 : 10) * (hoveredFormIndex === i ? 2.5 : 1), height: (i === currentFormIndex ? 4 : 3), opacity: i === currentFormIndex || hoveredFormIndex === i ? 1 : 0.4 }} className={`rounded-full origin-right ${i === currentFormIndex || hoveredFormIndex === i ? (fIsGmax && viewMode === "gigantamax" ? "bg-gmax shadow-[0_0_8px_rgba(208,0,111,0.5)]" : "bg-ink") : "bg-ink/30"}`} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Details Panel - Desktop */}
                    <div 
                      ref={desktopScrollRef}
                      className="flex flex-col relative box-border md:w-5/12 px-8 py-12 lg:px-10 overflow-y-auto custom-scrollbar"
                    >
                      <header className="mb-12">
                        <div className="flex flex-col gap-1">
                          <Textfit 
                            key={`name-d-${id}-${currentFormIndex}-${renderSig}`}
                            {...({ 
                            mode: "single", 
                            max: 80, 
                            min: 20, 
                            className: `font-display font-black tracking-tighter leading-[1.1] px-1 whitespace-nowrap ${isGigantamax ? 'bg-gradient-to-b from-white to-[#d0006f] bg-clip-text text-transparent drop-shadow-[0_4px_8px_rgba(208,0,111,0.3)]' : 'text-ink'}`, 
                            children: form.name 
                          } as any)} />
                          <div className="flex flex-wrap gap-2 mt-3">
                             {form.type.map((t, idx) => (
                              <span key={`type-d-${t}-${idx}`} className={`flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 bg-transparent micro-label border border-line text-ink`}>
                                <img src={`${CLOUDFRONT_ASSETS_URL}/type-icons/${t.toLowerCase()}-type-icon.png`} alt={t} className="w-4 h-4 object-contain" />
                                <span>{t}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </header>
                      <section className="mb-12 space-y-4">
                        <p className={`font-display text-xl font-black uppercase tracking-[0.3em] leading-tight text-ink`}>{form.category} Pokémon</p>
                        <div className="space-y-4">
                          <span className="micro-label opacity-30 block">D3x Entry</span>
                          <p className={`text-sm font-medium leading-relaxed italic border-l-[3px] pl-6 py-1 border-line`}>"{form.entry}"</p>
                        </div>
                      </section>
                      <div className="space-y-12">
                        <section className={`grid grid-cols-2 gap-10 border-b pb-12 border-line`}>
                           <div className="space-y-2">
                            <span className="micro-label opacity-40">Height</span>
                            <p className={`font-display font-bold text-3xl tracking-tighter ${isGigantamax ? 'text-gmax' : ''}`}>{(form.height / 100).toFixed(1)}{(isGigantamax || isMega) && "+"}<span className="text-xs ml-1 opacity-40">M</span></p>
                          </div>
                          <div className="space-y-2">
                            <span className="micro-label opacity-40">Weight</span>
                            <p className={`font-display font-bold text-3xl tracking-tighter ${isGigantamax ? 'text-gmax' : ''}`}>{form.weight === -1 ? "???" : form.weight}{form.weight !== -1 && <span className="text-xs ml-1 opacity-40">KG</span>}</p>
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
                          <section className={`space-y-6 pt-12 border-t border-line`}>
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

        {/* Archive Navigation PILL */}
        {gallery.length > 1 && (
          <div className={`${
            isPortrait && isExpanded 
              ? "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex" 
              : "flex my-2"
          } items-center bg-paper/90 backdrop-blur-md border rounded-full shadow-xl pointer-events-auto overflow-hidden border-line`}>
            <button 
              disabled={currentIndex === 0}
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className={`flex items-center gap-3 px-8 py-3 micro-label transition-all active:scale-95 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${
                currentIndex === 0 
                  ? "opacity-10" 
                  : "text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              }`}
            >
              <ChevronLeft size={14} /> <span className="font-bold tracking-[0.2em] text-[10px]">PREV</span>
            </button>
            <div className={`w-px h-4 bg-line`} />
            <button 
              disabled={currentIndex === gallery.length - 1}
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className={`flex items-center gap-3 px-8 py-3 micro-label transition-all active:scale-95 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${
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
