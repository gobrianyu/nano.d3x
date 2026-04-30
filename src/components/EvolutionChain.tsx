import React, { useEffect, useState, useMemo } from "react";
import { PokemonDetail, PokemonIndexItem, PokemonForm } from "../types";
import { BASE_DATA_URL, BASE_IMAGE_URL } from "../constants";
import { ChevronRight, ImageOff, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cachedFetch } from "../lib/cacheService";
import { useImage } from "../lib/useImage";

interface ChainNode {
  id: number;
  next: ChainNode[];
}

interface EvolutionNodeProps {
  id: number;
  shinyMode: boolean;
  onSelect: (id: number) => void;
  isCurrent: boolean;
}

function EvolutionNode({ id, shinyMode, onSelect, isCurrent }: EvolutionNodeProps) {
  const dexId = Math.floor(id);
  const formIndex = Math.round((id % 1) * 100);

  const { data: detail, isLoading } = useQuery<PokemonDetail>({
    queryKey: ["pokemonDetail", dexId],
    queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${dexId}.json`),
    staleTime: Infinity,
  });

  const allForms = useMemo(() => {
    if (!detail) return [];
    return [
      ...(detail.forms || []), 
      ...(detail["gimmick forms"] || [])
    ].filter(f => f && typeof f === 'object');
  }, [detail]);

  const form = useMemo(() => {
    if (allForms.length === 0) return null;
    const index = allForms.findIndex(f => {
      const formId = detail?.index === undefined ? detail?.["dex number"] : detail?.index;
      const key = f?.key || formId;
      return Math.abs(Number(key) - id) < 0.0001;
    });
    return index !== -1 ? allForms[index] : allForms[0];
  }, [allForms, id, detail]);

  const pokemonName = form?.name || "???";

  const gender = "m";
  const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
  const imageUrl = form ? `${BASE_IMAGE_URL}/${form[imageKey] || "unknown.png"}` : "";
  
  const { src: cachedImageUrl, loading: imgLoading, error: imgError } = useImage(imageUrl, !!form);

  return (
    <div className="flex flex-col items-center gap-1.5 group/node">
      <button
        onClick={() => onSelect(id)}
        className={`relative w-14 h-14 sm:w-20 sm:h-20 rounded-none flex items-center justify-center border transition-all shrink-0 p-1.5 ${
          isCurrent 
            ? "bg-paper border-ink scale-110 z-10" 
            : "bg-ink/[0.02] border-line hover:bg-ink/[0.05]"
        }`}
      >
        <div className="absolute top-1 left-1 text-[6px] sm:text-[7px] font-mono opacity-60 font-bold tracking-tighter bg-paper text-ink px-1 border border-line">
          #{String(dexId).padStart(4, "0")}
        </div>
        
        {imgError ? (
          <span className="text-xl font-display font-black opacity-10">?</span>
        ) : (
          <img
            src={cachedImageUrl || null}
            alt={pokemonName}
            referrerPolicy="no-referrer"
            className={`w-11 h-11 sm:w-16 sm:h-16 object-contain transition-all duration-300 ${imgLoading || isLoading ? "opacity-0" : "opacity-100 group-hover/node:scale-110"}`}
          />
        )}
      </button>
      <span className="text-[8px] sm:text-[9px] micro-label group-hover/node:text-ink transition-all text-center max-w-[70px] sm:max-w-[80px] flex flex-col items-center leading-tight">
        <span className="break-words line-clamp-2">{pokemonName}</span>
        {form?.["special form"] && (
          <span className="opacity-50 text-[7px] truncate font-normal">({form["special form"]})</span>
        )}
      </span>
    </div>
  );
}

interface EvolutionChainProps {
  indexData: PokemonIndexItem[];
  shinyMode: boolean;
  onSelect: (id: number) => void;
  currentId: number;
}

export default function EvolutionChain({ shinyMode, onSelect, currentId }: EvolutionChainProps) {
  const [tree, setTree] = useState<ChainNode | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    async function buildTree() {
      setIsSyncing(true);
      try {
        // Helper to get form by decimal ID
        async function getFormFromId(fullId: number) {
          const dId = Math.floor(fullId);
          const detail: PokemonDetail = await queryClient.ensureQueryData({
            queryKey: ["pokemonDetail", dId],
            queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${dId}.json`),
          });
          const allForms = [
            ...(detail?.forms || []), 
            ...(detail?.["gimmick forms"] || [])
          ].filter(f => f && typeof f === 'object');
          
          const index = allForms.findIndex(f => {
            const formId = detail.index === undefined ? detail["dex number"] : detail.index;
            const key = f?.key || formId;
            return Math.abs(Number(key) - fullId) < 0.0001;
          });
          
          const targetIndex = index !== -1 ? index : 0;
          return { detail, form: allForms[targetIndex], fIdx: targetIndex };
        }

        // 1. Find the root of the chain starting from currentId
        let cursorId = currentId;
        let rootLookup = await getFormFromId(cursorId);
        let currentForm = rootLookup.form;

        // Loop until no prev evolution
        while (currentForm?.evolution?.[0]?.prev !== null) {
          cursorId = currentForm.evolution[0].prev as number;
          const res = await getFormFromId(cursorId);
          currentForm = res.form;
          if (!currentForm) break; // Safety break
        }

        // 2. Build tree from root using decimal IDs
        async function fetchNode(id: number): Promise<ChainNode> {
          const { form } = await getFormFromId(id);
          const nextEvos = form?.evolution?.[0]?.next || [];
          const nextNodes = await Promise.all(nextEvos.map(n => fetchNode(n.key)));

          return { id, next: nextNodes };
        }

        const rootNode = await fetchNode(cursorId);
        if (active) {
          setTree(rootNode);
          setIsSyncing(false);
        }
      } catch (err) {
        console.error("Tree building failed", err);
        if (active) setIsSyncing(false);
      }
    }

    buildTree();
    return () => { active = false; };
  }, [currentId, queryClient]);

  if (isSyncing) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin opacity-20" size={16} />
      </div>
    );
  }

  if (!tree) return null;

  // Recursive render for the tree
  const renderBranch = (node: ChainNode) => {
    return (
      <div className="flex items-start gap-3">
        <EvolutionNode 
          id={node.id} 
          shinyMode={shinyMode} 
          onSelect={onSelect} 
          isCurrent={node.id === currentId} 
        />
        
        {node.next.length > 0 && (
          <div className="flex items-start gap-1">
            {/* Arrow - Centered on image size (h-14 on mobile, h-20 on sm) */}
            <div className="h-14 sm:h-20 flex items-center">
              <ChevronRight size={16} className="opacity-20 shrink-0" />
            </div>
            
            <div className="flex flex-col gap-8">
              {node.next.map((child) => (
                <div key={child.id}>
                  {renderBranch(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-2 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-center w-full px-2">
        {renderBranch(tree)}
      </div>
    </div>
  );
}
