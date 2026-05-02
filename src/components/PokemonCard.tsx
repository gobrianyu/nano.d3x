import React, { useState } from "react";
import { PokemonDetail, PokemonForm, PokemonIndexItem } from "../types";
import { BASE_DATA_URL, BASE_IMAGE_URL } from "../constants";
import { motion } from "motion/react";
import { ImageOff } from "lucide-react";
import { useImage } from "../lib/useImage";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import { cachedFetch } from "../lib/cacheService";

interface PokemonCardProps {
  pokemon: PokemonIndexItem;
  targetFormIndex?: number;
  shinyMode: boolean;
  isGmaxMode?: boolean;
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
  isGmaxMode, 
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
      className={`group relative aspect-[5/3] w-full flex items-center p-4 bg-transparent transition-all ring-2 cursor-pointer overflow-hidden z-10 ${isSelected ? (isGmaxMode ? 'ring-gmax' : 'ring-ink') : 'ring-transparent'} ${isGmaxMode ? 'hover:ring-gmax gmax-border-pulse' : 'hover:ring-ink'}`}
    >
      {/* Name - Background subtle text */}
      <div className={`absolute left-4 bottom-3 micro-label transition-all pointer-events-none z-10 ${isGmaxMode ? '!text-gmax/40 group-hover:text-gmax opacity-100 font-bold' : 'opacity-40 group-hover:opacity-100'}`}>
        {displayTitle}
      </div>

      {/* Dex ID - Top Right */}
      <div className={`absolute top-3 right-4 micro-label transition-all origin-right z-10 ${isGmaxMode ? '!text-gmax/40 group-hover:text-gmax opacity-100 group-hover:scale-110 font-bold' : 'text-ink opacity-40 group-hover:opacity-100 group-hover:scale-110'}`}>
        {String(pokemon.id).padStart(4, "0")}
      </div>
      
      {/* Image - Left Centered */}
      <div className="h-full aspect-square flex items-center justify-center relative z-10">
        {/* GMAX Gradient Background centered on image */}
        {isGmaxMode && (
          <div className="absolute inset-[-100%] gmax-gradient pointer-events-none z-[-1]" />
        )}
        {!imageError ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border border-ink/10 border-t-ink rounded-full animate-spin" />
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
          <div className="flex flex-col items-center justify-center opacity-40 group-hover:opacity-80 transition-opacity">
            <span className="font-display text-sm font-black italic break-words text-center px-2">{pokemonName}</span>
            <span className="text-[7px] micro-label tracking-tighter mt-1 opacity-40">Archive Incomplete</span>
          </div>
        )}
      </div>

      {/* Hover Background - Subtle highlight */}
      <div className="absolute inset-0 bg-ink/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.button>
  );
}
