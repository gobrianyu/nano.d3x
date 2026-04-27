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
  onClick: () => void;
  key?: React.Key;
}

export default function PokemonCard({ pokemon, targetFormIndex = 0, shinyMode, onClick }: PokemonCardProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "200px",
  });

  // Fetch details only when in view or when needed for display
  const { data: detail } = useQuery<PokemonDetail>({
    queryKey: ["pokemonDetail", pokemon.id],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${pokemon.id}.json`),
    enabled: inView,
    staleTime: Infinity,
  });

  const allForms = detail ? [...(detail.forms || []), ...(detail["gimmick forms"] || [])] : [];
  const targetForm = allForms[targetFormIndex] || allForms[0];

  const pokemonName = targetForm?.name || "???";
  const specialForm = targetForm?.["special form"];
  const displayTitle = specialForm ? `${pokemonName} (${specialForm})` : pokemonName;

  const gender = "m"; // Default to male for grid
  const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
  
  const fallbackImage = shinyMode ? pokemon.thumbnail_shiny : pokemon.thumbnail;
  const targetImageUrl = targetForm ? `${BASE_IMAGE_URL}/${targetForm[imageKey] || "unknown.png"}` : `${BASE_IMAGE_URL}/${fallbackImage}`;
  
  const { src: cachedImageUrl, error: imageError, loading } = useImage(targetImageUrl, inView);

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      className="group relative aspect-[5/3] w-full flex items-center p-4 bg-transparent transition-all ring-2 ring-transparent hover:ring-ink cursor-pointer overflow-hidden z-10"
    >
      {/* Name - Background subtle text */}
      <div className="absolute left-4 bottom-4 micro-label opacity-5 group-hover:opacity-20 transition-all pointer-events-none">
        {displayTitle}
      </div>

      {/* Dex ID - Top Right */}
      <div className="absolute top-3 right-4 micro-label opacity-40 group-hover:opacity-100 group-hover:scale-110 text-ink transition-all origin-right">
        {String(pokemon.id).padStart(4, "0")}
      </div>
      
      {/* Image - Left Centered */}
      <div className="h-full aspect-square flex items-center justify-center relative z-0">
        {!imageError ? (
          <>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border border-ink/10 border-t-ink rounded-full animate-spin" />
              </div>
            )}
            <img
              src={cachedImageUrl || ""}
              alt={pokemonName}
              referrerPolicy="no-referrer"
              className={`h-[100%] w-[100%] object-contain transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-40 group-hover:opacity-80 transition-opacity">
            <span className="font-display text-sm font-black italic break-words text-center px-2">{pokemonName}</span>
            {specialForm && <span className="text-[8px] micro-label opacity-60">{specialForm}</span>}
            <span className="text-[7px] micro-label tracking-tighter mt-1 opacity-40">Archive Incomplete</span>
          </div>
        )}
      </div>

      {/* Hover Background - Subtle highlight */}
      <div className="absolute inset-0 bg-ink/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.button>
  );
}
