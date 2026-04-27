import React, { useEffect, useState } from "react";
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

  const allForms = [...(detail?.forms || []), ...(detail?.["gimmick forms"] || [])];
  const form = allForms[formIndex];
  const pokemonName = form?.name || "???";

  const gender = "m";
  const imageKey = `image asset ${gender}${shinyMode ? " shiny" : ""}` as keyof PokemonForm;
  const imageUrl = form ? `${BASE_IMAGE_URL}/${form[imageKey] || "unknown.png"}` : "";
  
  const { src: cachedImageUrl, loading: imgLoading, error: imgError } = useImage(imageUrl, !!form);

  return (
    <div className="flex flex-col items-center gap-2 group/node">
      <button
        onClick={() => onSelect(id)}
        className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-none flex items-center justify-center border transition-all shrink-0 p-1.5 ${
          isCurrent 
            ? "bg-paper border-ink scale-110 z-10" 
            : "bg-ink/[0.02] border-line hover:bg-ink/[0.05]"
        }`}
      >
        <div className="absolute top-0.5 left-0.5 text-[5px] font-mono opacity-60 font-bold tracking-tighter bg-paper text-ink px-0.5 border border-line">
          #{String(dexId).padStart(4, "0")}
        </div>
        
        {imgError ? (
          <span className="text-xl font-display font-black opacity-10">?</span>
        ) : (
          <img
            src={cachedImageUrl || null}
            alt={pokemonName}
            referrerPolicy="no-referrer"
            className={`w-10 h-10 sm:w-12 sm:h-12 object-contain transition-all duration-300 ${imgLoading || isLoading ? "opacity-0" : "opacity-100 group-hover/node:scale-110"}`}
          />
        )}
      </button>
      <span className="text-[7px] micro-label group-hover/node:text-ink transition-all text-center max-w-[60px] flex flex-col items-center">
        <span className="break-words line-clamp-1">{pokemonName}</span>
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
          const fIdx = Math.round((fullId % 1) * 100);
          const detail: PokemonDetail = await queryClient.ensureQueryData({
            queryKey: ["pokemonDetail", dId],
            queryFn: () => cachedFetch(`${BASE_DATA_URL}/pokemon/${dId}.json`),
          });
          const allForms = [...(detail?.forms || []), ...(detail?.["gimmick forms"] || [])];
          return { detail, form: allForms[fIdx] || allForms[0], fIdx };
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
      <div className="flex items-center gap-4">
        <EvolutionNode 
          id={node.id} 
          shinyMode={shinyMode} 
          onSelect={onSelect} 
          isCurrent={node.id === currentId} 
        />
        
        {node.next.length > 0 && (
          <div className="flex items-center gap-2">
            <ChevronRight size={14} className="opacity-10 shrink-0" />
            <div className="flex flex-col gap-6">
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
