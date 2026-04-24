import { RegionInfo, PokemonType } from "./types";

export const BASE_DATA_URL = "https://d1nt34i9nvab8r.cloudfront.net/data";
export const BASE_IMAGE_URL = "https://d1nt34i9nvab8r.cloudfront.net/images";

export const REGIONS: RegionInfo[] = [
  { name: "Kanto", count: 151, startId: 1, endId: 151 },
  { name: "Johto", count: 100, startId: 152, endId: 251 },
  { name: "Hoenn", count: 135, startId: 252, endId: 386 },
  { name: "Sinnoh", count: 107, startId: 387, endId: 493 },
  { name: "Unova", count: 156, startId: 494, endId: 649 },
  { name: "Kalos", count: 72, startId: 650, endId: 721 },
  { name: "Alola", count: 86, startId: 722, endId: 807 },
  { name: "Unknown", count: 2, startId: 808, endId: 809 },
  { name: "Galar", count: 89, startId: 810, endId: 898 },
  { name: "Hisui", count: 7, startId: 899, endId: 905 },
  { name: "Paldea", count: 120, startId: 906, endId: 1025 },
];

export const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "#A8A77A",
  Fire: "#EE8130",
  Water: "#6390F0",
  Electric: "#F7D02C",
  Grass: "#7AC74C",
  Ice: "#96D9D6",
  Fighting: "#C22E28",
  Poison: "#A33EA1",
  Ground: "#E2BF65",
  Flying: "#A98FF3",
  Psychic: "#F95587",
  Bug: "#A6B91A",
  Rock: "#B6A136",
  Ghost: "#735797",
  Dragon: "#6F35FC",
  Dark: "#705746",
  Steel: "#B7B7CE",
  Fairy: "#D685AD",
};

export const TYPE_LIST: PokemonType[] = Object.keys(TYPE_COLORS) as PokemonType[];
