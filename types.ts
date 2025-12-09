

export enum GameState {
  MENU,
  PLAYING,
  MISSION_COMPLETE,
  WASTED
}

export interface Vector2 {
  x: number;
  y: number;
}

export type WeaponType = 'fists' | 'bottle' | 'pistol' | 'ak47';

export interface Weapon {
  type: WeaponType;
  name: string;
  damage: number;
  range: number; // distance for melee, travel distance for projectiles
  cooldown: number; // ms
  isRanged: boolean;
  ammo: number; // -1 for infinite
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  rotation: number;
  speed: number;
  damage: number;
  ownerId: string; // 'player' or npc id
  distanceTraveled: number;
  maxDistance: number;
}

export interface Loot {
  id: string;
  x: number;
  y: number;
  type: 'weapon' | 'health' | 'money' | 'misc';
  name: string; // Display name
  value: string | number; // weapon type string or amount of health/money
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in radians
  color: string;
  type: 'player' | 'npc' | 'car' | 'building' | 'item' | 'dealer' | 'door';
}

export interface Car extends Entity {
  type: 'car';
  speed: number;
  maxSpeed: number;
  brand: string;
  isHybrid: boolean;
  driverId: string | null; // null if empty
}

export interface NPC extends Entity {
  type: 'npc';
  name: string;
  dialogue: string | null;
  target: Vector2 | null;
  state: 'wandering' | 'fleeing' | 'talking' | 'fighting' | 'dead' | 'sitting' | 'barman' | 'dealer';
  health: number;
  weapon: Weapon;
  aggroTargetId: string | null;
}

export interface Player extends Entity {
  type: 'player';
  speed: number;
  inCarId: string | null; // ID of the car the player is driving
  health: number;
  maxHealth: number;
  drunkLevel: number; // 0 to 100
  cash: number;
  inventory: (Weapon | null)[];
  activeSlot: number;
  lastAttackTime: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  objective: string;
  type: 'kill' | 'delivery' | 'misc';
  targetId?: string; // ID of NPC to kill or location
  reward: number;
  completed: boolean;
}

export interface LogMessage {
  id: string;
  text: string;
  timestamp: number;
  color: string;
}

// Card Game Types
export type Suit = '♥' | '♦' | '♣' | '♠';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // For sorting/logic
}

export interface PestenState {
  active: boolean;
  playerHand: Card[];
  npcHand: Card[];
  discardPile: Card[];
  deck: Card[];
  turn: 'player' | 'npc';
  message: string;
}

export interface Building {
  id: string;
  x: number; // Top-left
  y: number; // Top-left
  width: number;
  height: number;
  type: 'building' | 'house' | 'cafe' | 'brewery' | 'car_dealer';
  doorOffset: Vector2; // Relative to x,y
  color: string;
  roofColor: string;
  label?: string;
  lot?: { x: number, y: number, width: number, height: number }; // Rectangular lot
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'weapon' | 'ammo' | 'heal' | 'car';
  value: any; // Weapon object or ammo amount or car brand
}