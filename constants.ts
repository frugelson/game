

import { Weapon, ShopItem } from "./types";

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const WORLD_WIDTH = 6000;
export const WORLD_HEIGHT = 6000;

export const PLAYER_SIZE = 24;
export const CAR_WIDTH = 40;
export const CAR_HEIGHT = 70;

export const MENU_BACKGROUND_IMAGE = "https://i.ytimg.com/vi/z1ejYibtcdQ/hqdefault.jpg?sqp=-oaymwEmCOADEOgC8quKqQMa8AEB-AH-BIAC4AOKAgwIABABGGUgSShRMA8=&rs=AOn4CLDr-vARPI79GNWsOfERwr-MpeHUeg";

export const ROBERT_QUOTES = [
  "Alle dagen...",
  "Godverdomme, waar is mijn Mondeo?",
  "Eentje voor de sfeer.",
  "Dat is toch niet normaal?",
  "Ik ben te oud voor deze onzin.",
  "Mijn rug doet zeer.",
  "Hybride rijden, goed voor het milieu en de portemonnee."
];

export const FUN_LOOT_NAMES = [
  "Smerig Boekje", "Gouden Tand", "Pakje Sigaretten", "Oude Nokia", 
  "Half Broodje", "Lotto Lot (Niet winnend)", "Trouwring", "Kunstgebit"
];

export const BEER_MENU = [
  { name: "Pilske (Maes)", price: 2.5, heal: 10 },
  { name: "Duvel", price: 4.5, heal: 20 },
  { name: "Karmeliet", price: 5.0, heal: 25 },
  { name: "Cara Pils (Warm)", price: 0.5, heal: 5 }
];

export const COLORS = {
  robert: '#eab308', // Yellow-ish
  robertHat: '#374151', // Flat cap gray
  npc: '#9ca3af',
  road: '#334155',
  grass: '#365314', // Dark green
  buildingBase: '#78350f', // Brown brick
  water: '#1e3a8a',
  hudBg: 'rgba(0, 0, 0, 0.7)',
  blood: '#dc2626',
  dealer: '#000000',
  loot: '#fbbf24',
  floor: '#a0522d', // Wood
  mat: '#15803d', // Green mat
  fence: '#525252'
};

export const WEAPONS: Record<string, Weapon> = {
  FISTS: {
    type: 'fists',
    name: 'Vuisten',
    damage: 10,
    range: 40,
    cooldown: 500,
    isRanged: false,
    ammo: -1
  },
  BOTTLE: {
    type: 'bottle',
    name: 'Gebroken Fles',
    damage: 25,
    range: 50,
    cooldown: 400,
    isRanged: false,
    ammo: -1
  },
  PISTOL: {
    type: 'pistol',
    name: 'Pistool',
    damage: 15,
    range: 600,
    cooldown: 600,
    isRanged: true,
    ammo: 12
  },
  AK47: {
    type: 'ak47',
    name: 'AK-47',
    damage: 20,
    range: 800,
    cooldown: 150, // Fast fire
    isRanged: true,
    ammo: 30
  }
};

export const DEALER_ITEMS: ShopItem[] = [
  { id: 'pistol', name: 'Pistool', price: 150, type: 'weapon', value: WEAPONS.PISTOL },
  { id: 'ak47', name: 'AK-47', price: 600, type: 'weapon', value: WEAPONS.AK47 },
  { id: 'ammo', name: 'Munitie (30x)', price: 50, type: 'ammo', value: 30 },
  { id: 'kebab', name: 'Kebab (Heal)', price: 20, type: 'heal', value: 50 }
];

export const CAR_SHOP_ITEMS: ShopItem[] = [
  { id: 'canta', name: 'Canta LX', price: 450, type: 'car', value: { brand: 'Canta LX', color: '#dc2626', isHybrid: false } },
  { id: 'audi', name: 'Snelle Audi', price: 1200, type: 'car', value: { brand: 'Audi RS6', color: '#ef4444', isHybrid: false } },
  { id: 'volvo', name: 'Oude Volvo', price: 200, type: 'car', value: { brand: 'Volvo 240', color: '#7f1d1d', isHybrid: false } },
  { id: 'tank', name: 'Pantserwagen', price: 5000, type: 'car', value: { brand: 'Pantserwagen', color: '#3f6212', isHybrid: false } }
];

export const HOUSE_COLORS = ['#78350f', '#5d4037', '#8d6e63', '#a1887f', '#4e342e'];
// Darker, more realistic roof colors
export const ROOF_COLORS = ['#3f3f46', '#27272a', '#431407', '#292524', '#374151'];

export const INTERIOR_FURNITURE = [
  { x: 100, y: 100, width: 60, height: 60, color: '#5d4037' }, 
  { x: 300, y: 100, width: 60, height: 60, color: '#5d4037' },
  { x: 100, y: 300, width: 60, height: 60, color: '#5d4037' },
  { x: 300, y: 300, width: 60, height: 60, color: '#5d4037' },
];