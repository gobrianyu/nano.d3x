export interface PokemonIndexItem {
  id: number;
  thumbnail: string;
  thumbnail_shiny: string;
}

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  "sp.atk": number;
  "sp.def": number;
  speed: number;
}

export interface Evolution {
  next: {
    key: number;
    level?: number;
    item?: string[];
  }[];
  prev: number | null;
}

export interface PokemonForm {
  key: number | string;
  name: string;
  type: string[];
  category: string;
  region: string;
  "special form": string | null;
  valid: boolean;
  evolution: Evolution[];
  "base stats": BaseStats[];
  height: number;
  weight: number;
  entry: string;
  "image asset m": string;
  "image asset f": string;
  "image asset m shiny": string;
  "image asset f shiny": string;
}

export interface PokemonDetail {
  "dex number": number;
  forms: PokemonForm[];
  "gimmick forms": PokemonForm[];
  "experience group": string;
  "base experience yield": number;
  gendered: boolean;
  "male:female ratio": number;
}

export type PokemonType = 
  | "Normal" | "Fire" | "Water" | "Grass" | "Electric" | "Ice" 
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug" 
  | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy" | "Stellar" | "Unknown";

export interface RegionInfo {
  name: string;
  count: number;
  startId: number;
  endId: number;
}
