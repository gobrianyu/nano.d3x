import { RegionInfo, PokemonType } from "./types";

export const BASE_DATA_URL = "/api/data";
export const BASE_IMAGE_URL = "/api/images";
export const CLOUDFRONT_ASSETS_URL = "https://d1nt34i9nvab8r.cloudfront.net";

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

export const MEGA_POKEMON_IDS = [
  3, 6, 9, 15, 18, 26, 36, 65, 71, 80, 94, 115, 121, 127, 130, 142, 149, 150, 154, 160, 181, 208, 212, 214, 227, 229, 248, 254, 257, 260, 282, 302, 303, 306, 308, 310, 319, 323, 334, 354, 358, 359, 362, 373, 376, 380, 381, 382, 383, 384, 398, 428, 445, 448, 460, 475, 478, 485, 491, 500, 530, 531, 545, 560, 604, 609, 623, 652, 655, 658, 668, 670, 678, 687, 689, 691, 701, 718, 719, 740, 768, 780, 801, 807, 870, 952, 970, 978, 998
];

export const GIGANTAMAX_POKEMON_IDS = [
  3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143, 569, 809, 812, 815, 818, 823, 826, 834, 839, 841, 842, 844, 849, 851, 858, 861, 869, 879, 884, 892, 890
];
