import React, { useState } from "react";
import { PokemonDetail, PokemonForm, PokemonIndexItem } from "../types";
import { BASE_DATA_URL, BASE_IMAGE_URL } from "../constants";
import { motion } from "motion/react";
import { HelpCircle } from "lucide-react";
import { useImage } from "../lib/useImage";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import { cachedFetch } from "../lib/cacheService";

interface PokemonCardProps {
  pokemon: PokemonIndexItem;
  targetFormIndex?: number;
  shinyMode: boolean;
  solidBg?: boolean;
  darkMode?: boolean;
  isGmaxMode?: boolean;
  isMegaMode?: boolean;
  isSelected?: boolean;
  onImageLoad?: (id: number, formIndex: number) => void;
  isAllowedToLoad?: boolean;
  onLoadComplete?: () => void;
  onClick: () => void;
  key?: React.Key;
}

export default function PokemonCard({ 
  pokemon, 
  targetFormIndex = 0, 
  shinyMode, 
  solidBg = false,
  darkMode = false,
  isGmaxMode, 
  isMegaMode,
  isSelected, 
  onImageLoad,
  isAllowedToLoad = true,
  onLoadComplete,
  onClick 
}: PokemonCardProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "200px",
  });

  // Fetch details - only when allowed in sequence
  const { data: detail, isLoading: detailLoading } = useQuery<PokemonDetail>({
    queryKey: ["pokemonDetail", pokemon.id],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${pokemon.id}.json`),
    enabled: isAllowedToLoad,
    staleTime: Infinity,
  });

  const allForms = detail ? [
    ...(detail.forms || []), 
    ...(detail["gimmick forms"] || [])
  ].filter(f => f && typeof f === 'object') : [];
  const targetForm = allForms[targetFormIndex] || allForms[0];

  const pokemonName = targetForm?.name || "???";
  const specialForm = targetForm?.["special form"];
  const displayTitle = specialForm ? specialForm : pokemonName;

  const gender = "m"; // Default to male for grid
  const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
  
  const fallbackImage = shinyMode ? pokemon.thumbnail_shiny : pokemon.thumbnail;
  const targetImageUrl = targetForm ? `${BASE_IMAGE_URL}/${targetForm[imageKey] || "unknown.png"}` : `${BASE_IMAGE_URL}/${fallbackImage}`;
  
  // Sequential image load: start when allowed (and detail is ready)
  const { src: cachedImageUrl, error: imageError, loading: imageLoading } = useImage(
    targetImageUrl, 
    isAllowedToLoad && !!detail, 
    () => {
      if (onImageLoad) onImageLoad(pokemon.id, targetFormIndex);
      if (onLoadComplete) onLoadComplete();
    },
    () => {
      if (onLoadComplete) onLoadComplete();
    }
  );

  const isLoading = (isAllowedToLoad && (detailLoading || imageLoading)) || (!isAllowedToLoad && !cachedImageUrl && !imageError);

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      className={`group relative aspect-[5/3] w-full flex items-center p-0 bg-transparent transition-all ring-2 cursor-pointer overflow-hidden z-10 
        ${isSelected ? (isGmaxMode ? 'ring-gmax' : isMegaMode ? 'ring-mega' : 'ring-ink') : 'ring-transparent'} 
        ${isGmaxMode ? 'hover:ring-gmax gmax-border-pulse' : isMegaMode ? 'hover:ring-mega mega-border-pulse' : 'hover:ring-ink'}`}
    >
      {/* Image - Left Centered, stretching 1:1 to top, left, bottom edges */}
      <div className={`h-full aspect-square flex items-center justify-center relative z-10 shrink-0 transition-colors duration-200 ${
        solidBg ? "bg-[#fcfcf9] dark:bg-[#e2e2dc]" : ""
      }`}>
        {/* Theme Gradient Background centered on image */}
        {isGmaxMode && (
          <div className="opacity-50 absolute inset-[-30%] gmax-gradient pointer-events-none z-[-1]" />
        )}
        {isMegaMode && (
          <div className="opacity-50 absolute inset-[-30%] mega-gradient pointer-events-none z-[-1]" />
        )}
        {!imageError ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-3 h-3 sm:w-4 sm:h-4 border rounded-full animate-spin ${solidBg ? "border-[#121212]/15 border-t-[#121212]" : "border-ink/15 border-t-ink"}`} />
              </div>
            )}
            <img
              src={cachedImageUrl || null}
              alt={pokemonName}
              referrerPolicy="no-referrer"
              className={`h-[100%] w-[100%] object-contain transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
            />
          </>
        ) : (
          <div className={`flex flex-col items-center justify-center transition-all duration-200
            ${solidBg 
              ? "text-[#121212]/30 group-hover:text-[#121212]/70" 
              : "text-ink/40 group-hover:text-ink/80"}`}
          >
            <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" strokeWidth={1} />
            <span className="text-[5px] sm:text-[6px] md:text-[7px] tracking-tighter mt-0.5 sm:mt-1 font-mono uppercase tracking-[0.25em] font-bold leading-tight select-none">
              In-Progress
            </span>
          </div>
        )}
      </div>

      {/* Dex ID - Top Right */}
      <div className={`absolute top-2 sm:top-3 right-2 sm:right-3 micro-label transition-all origin-right z-10 
        ${isGmaxMode ? '!text-gmax/40 group-hover:!text-gmax opacity-100 font-bold' : 
          isMegaMode ? '!text-mega/40 group-hover:!text-mega opacity-100 font-bold' : 
          'text-ink opacity-40 group-hover:opacity-100'}
        text-[7.5px] sm:text-[9.5px]`}>
        #{String(pokemon.id).padStart(4, "0")}
      </div>

      {/* Name - Bottom Left (overlapping the bottom-left of the image section) */}
      <div className={`absolute left-2 sm:left-3 bottom-1.5 sm:bottom-2 micro-label transition-all pointer-events-none z-20 max-w-[55%] truncate
        ${isGmaxMode ? '!text-gmax/40 group-hover:!text-gmax group-hover:opacity-100 font-bold' : 
          isMegaMode ? '!text-mega/40 group-hover:!text-mega group-hover:opacity-100 font-bold' : 
          (solidBg && darkMode
            ? '!text-[#121212]/40 group-hover:!text-[#121212]' 
            : '!text-ink/40 group-hover:!text-ink'
          )} 
        text-[7.5px] sm:text-[9.5px]`}>
        {pokemonName}
      </div>

      {/* Hover Background - Subtle highlight */}
      <div className="absolute inset-0 bg-ink/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.button>
  );
}
