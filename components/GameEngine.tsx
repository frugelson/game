

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GameState, Player, Car, NPC, Vector2, LogMessage, Mission, Projectile, Loot, Weapon, Entity,
  PestenState, Card, Suit, Rank, Building, ShopItem
} from '../types';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, 
  PLAYER_SIZE, CAR_WIDTH, CAR_HEIGHT, COLORS, ROBERT_QUOTES, WEAPONS,
  FUN_LOOT_NAMES, BEER_MENU, INTERIOR_FURNITURE, MENU_BACKGROUND_IMAGE,
  DEALER_ITEMS, CAR_SHOP_ITEMS, HOUSE_COLORS, ROOF_COLORS
} from '../constants';
import { generateRobertDialogue, generateMission } from '../services/geminiService';

// --- Helper Math Functions ---
const getDistance = (e1: {x: number, y: number}, e2: {x: number, y: number}) => {
  return Math.sqrt(Math.pow(e2.x - e1.x, 2) + Math.pow(e2.y - e1.y, 2));
};

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const isColliding = (r1: {x: number, y: number, width: number, height: number}, r2: {x: number, y: number, width: number, height: number}) => {
  return (
    r1.x - r1.width/2 < r2.x + r2.width/2 &&
    r1.x + r1.width/2 > r2.x - r2.width/2 &&
    r1.y - r1.height/2 < r2.y + r2.height/2 &&
    r1.y + r1.height/2 > r2.y - r2.height/2
  );
};

const rectIntersect = (
    r1: {x: number, y: number, w: number, h: number}, 
    r2: {x: number, y: number, w: number, h: number}
) => {
    return (
        r1.x < r2.x + r2.w &&
        r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h &&
        r1.y + r1.h > r2.y
    );
};

// --- Card Game Helpers ---
const createDeck = (): Card[] => {
  const suits: Suit[] = ['♥', '♦', '♣', '♠'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];
  suits.forEach(s => ranks.forEach((r, i) => deck.push({ suit: s, rank: r, value: i })));
  return deck.sort(() => Math.random() - 0.5);
};

export const GameEngine: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // -- Game State Refs --
  const playerRef = useRef<Player>({
    id: 'robert',
    type: 'player',
    x: 0, 
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    rotation: 0,
    color: COLORS.robert,
    speed: 0,
    inCarId: null,
    health: 100,
    maxHealth: 100,
    drunkLevel: 10,
    cash: 0,
    inventory: [WEAPONS.FISTS, null, null],
    activeSlot: 0,
    lastAttackTime: 0
  });

  const buildingsRef = useRef<Building[]>([]);
  const carsRef = useRef<Car[]>([]);
  const npcsRef = useRef<NPC[]>([]);
  const lastEnteredBuildingId = useRef<string | null>(null);

  // Initialize World
  useEffect(() => {
    // 1. Generate City Grid
    const newBuildings: Building[] = [];
    
    // Grid settings
    const ROWS = 8;
    const COLS = 8;
    const BLOCK_W = 500;
    const BLOCK_H = 500;
    const ROAD_W = 140; // Wide roads
    const START_OFFSET = 300;

    const specialLocations: Record<string, {type: 'cafe' | 'car_dealer' | 'brewery', label: string, c: string, rc: string}> = {
        '1,1': { type: 'cafe', label: 'Stad Aalst', c: '#7f1d1d', rc: '#1a1a1a' },
        '4,1': { type: 'car_dealer', label: 'Auto Aalst', c: '#94a3b8', rc: '#cbd5e1' },
        '2,5': { type: 'brewery', label: 'Brouwerij', c: '#57534e', rc: '#292524' }
    };

    let cafeEntryPos = { x: 0, y: 0 };

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const blockX = START_OFFSET + c * (BLOCK_W + ROAD_W);
            const blockY = START_OFFSET + r * (BLOCK_H + ROAD_W);
            
            const key = `${r},${c}`;
            
            // Draw lot (the green area) logic
            // Default block lot
            const lotRect = { x: blockX, y: blockY, width: BLOCK_W, height: BLOCK_H };

            if (specialLocations[key]) {
                // SPECIAL BUILDING
                const spec = specialLocations[key];
                const w = spec.type === 'car_dealer' ? 400 : 300;
                const h = spec.type === 'car_dealer' ? 300 : 250;
                
                const bx = blockX + (BLOCK_W - w) / 2;
                const by = blockY + (BLOCK_H - h) / 2;
                
                const id = spec.type === 'cafe' ? 'cafe' : (spec.type === 'car_dealer' ? 'dealership' : 'brewery');
                const doorOff = { x: w/2, y: h };

                if (spec.type === 'cafe') {
                    cafeEntryPos = { x: bx + doorOff.x, y: by + doorOff.y + 60 };
                }

                newBuildings.push({
                    id: id, x: bx, y: by, width: w, height: h,
                    type: spec.type, doorOffset: doorOff,
                    color: spec.c, roofColor: spec.rc, label: spec.label,
                    lot: lotRect
                });

            } else {
                // RESIDENTIAL BLOCK
                // Subdivision logic: 50% chance for 1 big house, 25% for 2 houses, 25% for 4 houses
                const rand = Math.random();
                
                if (rand < 0.5) {
                    // One big house
                    const margin = 60;
                    const houseW = BLOCK_W - margin * 2;
                    const houseH = BLOCK_H - margin * 2;
                    const houseColor = HOUSE_COLORS[Math.floor(Math.random() * HOUSE_COLORS.length)];
                    const roofColor = ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)];
                    
                    newBuildings.push({
                        id: `house-${r}-${c}`, x: blockX + margin, y: blockY + margin,
                        width: houseW, height: houseH, type: 'house',
                        doorOffset: { x: houseW/2, y: houseH },
                        color: houseColor, roofColor: roofColor,
                        lot: lotRect
                    });
                } else if (rand < 0.75) {
                    // Two houses (Vertical split)
                    const splitW = BLOCK_W / 2;
                    const margin = 40;
                    for (let i = 0; i < 2; i++) {
                         const houseColor = HOUSE_COLORS[Math.floor(Math.random() * HOUSE_COLORS.length)];
                         const roofColor = ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)];
                         const subLot = { x: blockX + i*splitW, y: blockY, width: splitW, height: BLOCK_H };
                         const hw = splitW - margin*2;
                         const hh = BLOCK_H - margin*2;
                         newBuildings.push({
                            id: `house-${r}-${c}-${i}`, x: subLot.x + margin, y: subLot.y + margin,
                            width: hw, height: hh, type: 'house',
                            doorOffset: { x: hw/2, y: hh },
                            color: houseColor, roofColor: roofColor,
                            lot: subLot
                        });
                    }
                } else {
                    // Four small houses
                    const splitW = BLOCK_W / 2;
                    const splitH = BLOCK_H / 2;
                    const margin = 30;
                    for (let i = 0; i < 2; i++) {
                        for (let j = 0; j < 2; j++) {
                             const houseColor = HOUSE_COLORS[Math.floor(Math.random() * HOUSE_COLORS.length)];
                             const roofColor = ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)];
                             const subLot = { x: blockX + i*splitW, y: blockY + j*splitH, width: splitW, height: splitH };
                             const hw = splitW - margin*2;
                             const hh = splitH - margin*2;
                             newBuildings.push({
                                id: `house-${r}-${c}-${i}-${j}`, x: subLot.x + margin, y: subLot.y + margin,
                                width: hw, height: hh, type: 'house',
                                doorOffset: { x: hw/2, y: hh }, // Door facing down
                                color: houseColor, roofColor: roofColor,
                                lot: subLot
                            });
                        }
                    }
                }
            }
        }
    }

    buildingsRef.current = newBuildings;

    // Set Initial Player Pos
    if (cafeEntryPos.x !== 0) {
        playerRef.current.x = cafeEntryPos.x;
        playerRef.current.y = cafeEntryPos.y;
    } else {
        playerRef.current.x = 2950;
        playerRef.current.y = 3100;
    }

    // 2. Generate Cars
    const newCars: Car[] = [];
    const brands = [
        { name: "Canta LX", color: "#dc2626", hybrid: false },
        { name: "Oude Volvo", color: "#7f1d1d", hybrid: false },
        { name: "Bestelwagen", color: "#fef3c7", hybrid: false },
        { name: "Politie Corsa", color: "#2563eb", hybrid: false }
    ];

    let attempts = 0;
    // Spawn cars on the ROADS
    while (newCars.length < 30 && attempts < 500) {
        attempts++;
        const isHorizontal = Math.random() > 0.5;
        let cx, cy;
        
        if (isHorizontal) {
            // Pick a horizontal road row
            const r = Math.floor(Math.random() * (ROWS + 1));
            // y center of this road
            // Road 0 is before Block 0. Road 1 is after Block 0.
            // Start of block 0 Y = START_OFFSET
            // Center of Road 0 = START_OFFSET - ROAD_W/2
            // Center of Road 1 = START_OFFSET + BLOCK_H + ROAD_W/2
            const roadCenterY = START_OFFSET + r * (BLOCK_H + ROAD_W) - ROAD_W/2;
            cy = roadCenterY + (Math.random() - 0.5) * (ROAD_W - 50); // stay in lane
            cx = Math.random() * WORLD_WIDTH;
        } else {
             // Pick a vertical road col
             const c = Math.floor(Math.random() * (COLS + 1));
             const roadCenterX = START_OFFSET + c * (BLOCK_W + ROAD_W) - ROAD_W/2;
             cx = roadCenterX + (Math.random() - 0.5) * (ROAD_W - 50);
             cy = Math.random() * WORLD_HEIGHT;
        }

        if (cx > 0 && cx < WORLD_WIDTH && cy > 0 && cy < WORLD_HEIGHT) {
            const spec = brands[Math.floor(Math.random() * brands.length)];
            newCars.push({
                id: `car-${newCars.length}`, type: 'car',
                x: cx, y: cy, width: CAR_WIDTH, height: CAR_HEIGHT,
                rotation: isHorizontal ? (Math.random() > 0.5 ? 0 : Math.PI) : (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2),
                color: spec.color, speed: 0, maxSpeed: spec.hybrid ? 14 : 11,
                brand: spec.name, isHybrid: spec.hybrid, driverId: null
            });
        }
    }
    carsRef.current = newCars;

    // 3. Generate NPCs
    npcsRef.current = Array.from({ length: 80 }).map((_, i) => {
        let weapon = WEAPONS.FISTS;
        if (Math.random() < 0.5) {
             const r = Math.random();
             if (r < 0.2) weapon = WEAPONS.BOTTLE;
             else if (r < 0.6) weapon = WEAPONS.PISTOL;
             else weapon = WEAPONS.AK47;
        }

        return {
            id: `npc-${i}`, type: 'npc',
            x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT,
            width: PLAYER_SIZE, height: PLAYER_SIZE, rotation: Math.random() * Math.PI * 2,
            color: COLORS.npc, name: "Dorpeling", dialogue: null, target: null,
            state: 'wandering', health: 50, weapon: weapon,
            aggroTargetId: null
        };
    });

  }, []);

  // Log cleanup timer
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(prev => prev.filter(log => Date.now() - log.timestamp < 15000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cafe Interior NPCs
  const cafeNpcsRef = useRef<NPC[]>([
    {
      id: 'barman', type: 'npc', x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 - 100, 
      width: 24, height: 24, rotation: Math.PI/2, color: 'white', 
      name: "Barman", dialogue: null, target: null, state: 'barman', 
      health: 100, weapon: WEAPONS.FISTS, aggroTargetId: null
    },
    {
      id: 'cardplayer', type: 'npc', x: CANVAS_WIDTH/2 + 100, y: CANVAS_HEIGHT/2 + 50, 
      width: 24, height: 24, rotation: Math.PI, color: COLORS.npc, 
      name: "Kaartspeler", dialogue: null, target: null, state: 'sitting', 
      health: 50, weapon: WEAPONS.FISTS, aggroTargetId: null
    }
  ]);
  
  // Car Dealer Interior NPC
  const carDealerNpcRef = useRef<NPC[]>([
    {
        id: 'cardealer', type: 'npc', x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 - 50,
        width: 24, height: 24, rotation: Math.PI/2, color: '#000',
        name: "Verkoper", dialogue: "Goeie wagens hier.", target: null, state: 'dealer',
        health: 100, weapon: WEAPONS.PISTOL, aggroTargetId: null
    }
  ]);

  const dealerRef = useRef<Entity>({
    id: 'dealer', type: 'dealer',
    x: 400, y: 5500, // Fixed location far away
    width: 30, height: 30, rotation: 0, color: COLORS.dealer
  });

  const projectilesRef = useRef<Projectile[]>([]);
  const lootRef = useRef<Loot[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<{ x: number, y: number, down: boolean }>({ x: 0, y: 0, down: false });
  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
  const attackVisualsRef = useRef<{x: number, y: number, rotation: number, time: number}[]>([]);

  // -- React State for UI --
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [currentMission, setCurrentMission] = useState<Mission | null>(null);
  const [missionLoading, setMissionLoading] = useState<boolean>(false);
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<Loot | null>(null);
  const [activeWeapon, setActiveWeapon] = useState<Weapon>(WEAPONS.FISTS);
  
  // Interior & Minigames & Shops
  const [insideLocation, setInsideLocation] = useState<'cafe' | 'house' | 'car_dealer' | null>(null);
  const [activeShop, setActiveShop] = useState<'none' | 'weapon' | 'car' | 'bar'>('none');
  
  const [pestenState, setPestenState] = useState<PestenState>({
    active: false, playerHand: [], npcHand: [], discardPile: [], deck: [], turn: 'player', message: ''
  });

  // --- Logger ---
  const addLog = (text: string, color: string = 'white') => {
    const id = Date.now().toString() + Math.random();
    setLogs(prev => [...prev, { id, text, timestamp: Date.now(), color }].slice(-20)); // Keep max 20, timer cleans them
  };

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pestenState.active) return;
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === 'Shift') keysPressed.current['shift'] = true;

      if (e.key.toLowerCase() === 'e' && gameState === GameState.PLAYING && activeShop === 'none') handleInteraction();
      if (e.key.toLowerCase() === 'e' && activeShop !== 'none') setActiveShop('none'); // Close menu
      if (e.key.toLowerCase() === 'm' && gameState === GameState.PLAYING && !currentMission && !insideLocation) startMission();
      if (e.key.toLowerCase() === 't' && gameState === GameState.PLAYING) handleTalk();
      if (e.key === ' ' && gameState === GameState.WASTED) resetGame();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      if (e.key === 'Shift') keysPressed.current['shift'] = false;
    };
    
    const handleMouseDown = () => mouseRef.current.down = true;
    const handleMouseUp = () => mouseRef.current.down = false;
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    
    const handleWheel = (e: WheelEvent) => {
      if (gameState !== GameState.PLAYING || pestenState.active) return;
      const dir = Math.sign(e.deltaY);
      const player = playerRef.current;
      let nextSlot = player.activeSlot + dir;
      if (nextSlot > 2) nextSlot = 0;
      if (nextSlot < 0) nextSlot = 2;
      
      player.activeSlot = nextSlot;
      const w = player.inventory[nextSlot] || WEAPONS.FISTS;
      setActiveWeapon(w);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [gameState, currentMission, insideLocation, activeShop, pestenState.active]);

  const resetGame = () => {
    const cafe = buildingsRef.current.find(b => b.id === 'cafe');
    playerRef.current.health = 100;
    playerRef.current.x = cafe ? cafe.x + cafe.doorOffset.x : 2950;
    playerRef.current.y = cafe ? cafe.y + cafe.doorOffset.y + 60 : 3100;
    playerRef.current.inCarId = null;
    playerRef.current.inventory = [WEAPONS.FISTS, null, null];
    playerRef.current.activeSlot = 0;
    setActiveWeapon(WEAPONS.FISTS);
    lastEnteredBuildingId.current = null;
    
    npcsRef.current.forEach(npc => {
      npc.state = 'wandering';
      npc.aggroTargetId = null;
      npc.health = 50;
    });

    setInsideLocation(null);
    setActiveShop('none');
    setPestenState(prev => ({ ...prev, active: false }));
    setGameState(GameState.PLAYING);
    addLog("Opnieuw begonnen. Alle dagen...", "white");
  };

  // --- Logic ---
  const startMission = async () => {
    setMissionLoading(true);
    addLog("Robert zoekt werk...", "yellow");
    const mission = await generateMission();
    setCurrentMission(mission);
    setMissionLoading(false);
    addLog(`Missie: ${mission.title}`, "#fbbf24");
  };

  const spawnLoot = (x: number, y: number) => {
    const rand = Math.random();
    let type: Loot['type'] = 'money';
    let value: string | number = 10;
    let name = "Geld";

    if (rand > 0.8) {
      type = 'weapon';
      value = Math.random() > 0.5 ? 'pistol' : 'bottle';
      name = value === 'pistol' ? "Pistool" : "Fles";
    } else if (rand > 0.6) {
      type = 'misc';
      value = 15;
      name = FUN_LOOT_NAMES[Math.floor(Math.random() * FUN_LOOT_NAMES.length)];
    } else if (rand > 0.4) {
      type = 'health';
      value = 25;
      name = "Kebab";
    } else {
      value = Math.floor(Math.random() * 40) + 10;
      name = `€${value}`;
    }

    lootRef.current.push({
      id: Math.random().toString(),
      x, y, type, value, name
    });
  };

  const attack = (attacker: Player | NPC, isPlayer: boolean) => {
    const now = Date.now();
    const weapon = isPlayer ? (playerRef.current.inventory[playerRef.current.activeSlot] || WEAPONS.FISTS) : (attacker as NPC).weapon;
    
    if (isPlayer && now - playerRef.current.lastAttackTime < weapon.cooldown) return;
    if (isPlayer) playerRef.current.lastAttackTime = now;

    attackVisualsRef.current.push({
      x: attacker.x,
      y: attacker.y,
      rotation: attacker.rotation,
      time: 10
    });

    if (weapon.isRanged) {
      const isBullet = weapon.type === 'pistol' || weapon.type === 'ak47';
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: attacker.x + Math.cos(attacker.rotation) * 20,
        y: attacker.y + Math.sin(attacker.rotation) * 20,
        rotation: attacker.rotation + (Math.random() - 0.5) * 0.05,
        speed: isBullet ? 35 : 15,
        damage: weapon.damage,
        ownerId: attacker.id,
        distanceTraveled: 0,
        maxDistance: weapon.range
      });
      if (isPlayer && weapon.ammo > 0) {
        weapon.ammo--;
        if (weapon.ammo === 0) {
           addLog("Kogels op!", "red");
           const newWep = { ...WEAPONS.FISTS }; // revert to fists
           playerRef.current.inventory[playerRef.current.activeSlot] = null;
           setActiveWeapon(WEAPONS.FISTS);
        }
      }
    } else {
      const hitBox = {
         x: attacker.x + Math.cos(attacker.rotation) * 20,
         y: attacker.y + Math.sin(attacker.rotation) * 20,
         width: 30,
         height: 30
      };

      if (isPlayer) {
        const targetList = insideLocation === 'cafe' ? cafeNpcsRef.current : (insideLocation ? [] : npcsRef.current);
        targetList.forEach(npc => {
          if (npc.state !== 'dead' && isColliding(hitBox, npc)) {
            damageNPC(npc, weapon.damage);
          }
        });
      } else {
        if (isColliding(hitBox, playerRef.current)) {
           damagePlayer(weapon.damage);
        }
      }
    }
  };

  const damageNPC = (npc: NPC, amount: number) => {
    npc.health -= amount;
    if (npc.health > 0) {
      npc.state = 'fighting';
      npc.aggroTargetId = 'robert';
    }
    
    if (npc.health <= 0) {
      npc.state = 'dead';
      npc.color = '#500';
      spawnLoot(npc.x, npc.y);
      addLog(`${npc.name} is dood.`, "red");
      
      if (currentMission && currentMission.type === 'kill') {
        currentMission.completed = true;
        playerRef.current.cash += currentMission.reward;
        addLog(`Missie Voltooid! +€${currentMission.reward}`, "green");
        setTimeout(() => setCurrentMission(null), 3000);
      }
    }
  };

  const damagePlayer = (amount: number) => {
    playerRef.current.health -= amount;
    if (playerRef.current.health <= 0) {
      setGameState(GameState.WASTED);
      addLog("WASTED - Robert is er geweest.", "red");
    }
  };

  const handleTalk = async () => {
    if (playerRef.current.inCarId) return;
    const targetList = insideLocation === 'cafe' ? cafeNpcsRef.current : npcsRef.current;
    const npc = targetList.find(n => getDistance(playerRef.current, n) < 50 && n.state !== 'dead');
    if (npc) {
      const dialogue = await generateRobertDialogue("Robert valt een vreemde lastig.");
      addLog(`Robert: "${dialogue}"`, "#fbbf24");
    }
  };

  const startPesten = () => {
    const deck = createDeck();
    const pHand = [deck.pop()!, deck.pop()!, deck.pop()!];
    const nHand = [deck.pop()!, deck.pop()!, deck.pop()!];
    const top = deck.pop()!;
    setPestenState({
      active: true,
      playerHand: pHand,
      npcHand: nHand,
      discardPile: [top],
      deck: deck,
      turn: 'player',
      message: 'Jouw beurt!'
    });
    addLog("Pesten gestart. Leg een kaart!", "cyan");
  };

  const playCard = (cardIndex: number) => {
    if (pestenState.turn !== 'player') return;
    const card = pestenState.playerHand[cardIndex];
    const top = pestenState.discardPile[pestenState.discardPile.length - 1];
    if (card.suit === top.suit || card.rank === top.rank) {
      const newHand = [...pestenState.playerHand];
      newHand.splice(cardIndex, 1);
      setPestenState(prev => ({
        ...prev, playerHand: newHand, discardPile: [...prev.discardPile, card], turn: 'npc', message: 'NPC denkt na...'
      }));
      if (newHand.length === 0) {
        addLog("Je hebt gewonnen! +€20", "green");
        playerRef.current.cash += 20;
        setTimeout(() => setPestenState(prev => ({ ...prev, active: false })), 2000);
      } else {
        setTimeout(npcTurnPesten, 1000);
      }
    } else {
      addLog("Kan niet! Pak een kaart.", "red");
      drawCard('player');
    }
  };

  const drawCard = (who: 'player' | 'npc') => {
    setPestenState(prev => {
      if (prev.deck.length === 0) return { ...prev, message: "Stapel leeg! Gelijkspel.", active: false };
      const newDeck = [...prev.deck];
      const card = newDeck.pop()!;
      const nextTurn: 'player' | 'npc' = who === 'player' ? 'npc' : 'player';
      if (who === 'player') setTimeout(npcTurnPesten, 1000);
      return {
        ...prev, deck: newDeck, turn: nextTurn,
        playerHand: who === 'player' ? [...prev.playerHand, card] : prev.playerHand,
        npcHand: who === 'npc' ? [...prev.npcHand, card] : prev.npcHand,
        message: who === 'player' ? 'NPC aan zet' : 'Jouw beurt'
      };
    });
  };

  const npcTurnPesten = () => {
    setPestenState(prev => {
      if (!prev.active) return prev;
      const top = prev.discardPile[prev.discardPile.length - 1];
      const validIndex = prev.npcHand.findIndex(c => c.suit === top.suit || c.rank === top.rank);
      if (validIndex !== -1) {
        const card = prev.npcHand[validIndex];
        const newHand = [...prev.npcHand];
        newHand.splice(validIndex, 1);
        if (newHand.length === 0) {
           addLog("NPC wint. Godverdomme.", "red");
           setTimeout(() => setPestenState(p => ({ ...p, active: false })), 2000);
           return { ...prev, npcHand: newHand, discardPile: [...prev.discardPile, card], message: "NPC Wint!" };
        }
        return { ...prev, npcHand: newHand, discardPile: [...prev.discardPile, card], turn: 'player', message: `NPC speelt ${card.rank}${card.suit}` };
      } else {
        if (prev.deck.length === 0) return { ...prev, active: false };
        const newDeck = [...prev.deck];
        const drawn = newDeck.pop()!;
        return { ...prev, deck: newDeck, npcHand: [...prev.npcHand, drawn], turn: 'player', message: "NPC pakt kaart" };
      }
    });
  };

  const handleInteraction = () => {
    const player = playerRef.current;
    if (pestenState.active) return;

    // 1. Interior Logic
    if (insideLocation) {
      // Exit Trigger (Bottom center of canvas usually)
      if (player.y > CANVAS_HEIGHT - 60) {
        setInsideLocation(null);
        
        // Find the building we entered to spawn back correctly
        const lastId = lastEnteredBuildingId.current;
        const enteredBuilding = buildingsRef.current.find(b => b.id === lastId);
        
        if (enteredBuilding) {
            player.x = enteredBuilding.x + enteredBuilding.doorOffset.x;
            player.y = enteredBuilding.y + enteredBuilding.doorOffset.y + 50; // Buffer so we aren't in the wall
        } else if (insideLocation === 'cafe') {
             // Fallback if specific building not found (shouldn't happen with id tracking)
             const cafe = buildingsRef.current.find(b => b.type === 'cafe');
             if (cafe) { player.x = cafe.x + cafe.doorOffset.x; player.y = cafe.y + cafe.doorOffset.y + 50; }
        } else if (insideLocation === 'car_dealer') {
             const dealer = buildingsRef.current.find(b => b.type === 'car_dealer');
             if (dealer) { player.x = dealer.x + dealer.doorOffset.x; player.y = dealer.y + dealer.doorOffset.y + 50; }
        } else {
             player.x = WORLD_WIDTH/2; player.y = WORLD_HEIGHT/2; // Safe fallback
        }
        addLog("Naar buiten.", "white");
        return;
      }
      
      if (insideLocation === 'cafe') {
        if (getDistance(player, cafeNpcsRef.current[0]) < 60) { setActiveShop('bar'); return; }
        if (getDistance(player, cafeNpcsRef.current[1]) < 60) { startPesten(); return; }
      }
      if (insideLocation === 'car_dealer') {
        if (getDistance(player, carDealerNpcRef.current[0]) < 60) { setActiveShop('car'); return; }
      }
      return;
    }

    // 2. Enter Buildings (Check Distance to Door Triggers)
    for (const b of buildingsRef.current) {
        const doorX = b.x + b.doorOffset.x;
        const doorY = b.y + b.doorOffset.y;
        if (getDistance(player, {x: doorX, y: doorY}) < 40) {
            setInsideLocation(b.type === 'cafe' ? 'cafe' : (b.type === 'car_dealer' ? 'car_dealer' : 'house'));
            lastEnteredBuildingId.current = b.id; // Store ID
            player.x = CANVAS_WIDTH / 2;
            player.y = CANVAS_HEIGHT - 100;
            addLog(`${b.label || 'Gebouw'} binnengetrapt`, "orange");
            return;
        }
    }

    // 3. Dealer Interaction (Weapon Shop)
    if (getDistance(player, dealerRef.current) < 50) {
      setActiveShop('weapon');
      return;
    }

    // 4. Loot Pickup
    const lootIndex = lootRef.current.findIndex(l => getDistance(player, l) < 30);
    if (lootIndex !== -1) {
      const loot = lootRef.current[lootIndex];
      lootRef.current.splice(lootIndex, 1);

      if (loot.type === 'money') {
        player.cash += Number(loot.value);
        addLog(`+€${loot.value}`, "green");
      } else if (loot.type === 'health') {
        player.health = Math.min(100, player.health + Number(loot.value));
        addLog("Gezondheid hersteld.", "green");
      } else {
        // Add to inventory
        const freeSlot = player.inventory.findIndex(s => s === null);
        const replaceSlot = player.activeSlot;
        let newItem: Weapon | null = null;
        
        if (loot.type === 'weapon') {
             const val = loot.value as string;
             newItem = val === 'pistol' ? {...WEAPONS.PISTOL} : {...WEAPONS.BOTTLE};
        } else {
             // Misc item, treating as weapon for hotbar slot for now, or just 'misc'
             addLog(`${loot.name} verkocht voor €5`, "gray");
             player.cash += 5;
             return; 
        }

        if (newItem) {
            if (freeSlot !== -1) player.inventory[freeSlot] = newItem;
            else player.inventory[replaceSlot] = newItem;
            setActiveWeapon(player.inventory[player.activeSlot] || WEAPONS.FISTS);
            addLog(`${newItem.name} opgepakt!`, "cyan");
        }
      }
      return;
    }

    // 5. Car Entry/Exit
    if (player.inCarId) {
      const car = carsRef.current.find(c => c.id === player.inCarId);
      if (car) {
        car.driverId = null;
        player.inCarId = null;
        player.x = car.x + 40; player.y = car.y; player.speed = 0;
      }
    } else {
      const closestCar = carsRef.current.find(c => getDistance(player, c) < 60);
      if (closestCar) {
        closestCar.driverId = player.id;
        player.inCarId = closestCar.id;
        player.x = closestCar.x; player.y = closestCar.y; player.rotation = closestCar.rotation;
        addLog(`${closestCar.brand} gejat`, "#22c55e");
      }
    }
  };

  const buyItem = (item: ShopItem) => {
    const player = playerRef.current;
    if (player.cash >= item.price) {
        player.cash -= item.price;
        if (item.type === 'weapon') {
            const freeSlot = player.inventory.findIndex(s => s === null);
            const w = { ...item.value as Weapon };
            if (freeSlot !== -1) player.inventory[freeSlot] = w;
            else player.inventory[player.activeSlot] = w;
            setActiveWeapon(player.inventory[player.activeSlot] || WEAPONS.FISTS);
        } else if (item.type === 'ammo') {
            player.inventory.forEach(w => { if(w && w.isRanged) w.ammo += item.value; });
        } else if (item.type === 'heal') {
            player.health = Math.min(100, player.health + item.value);
        } else if (item.type === 'car') {
            const spec = item.value;
            // Spawn car near dealer
            carsRef.current.push({
                id: `car-bought-${Date.now()}`, type: 'car',
                x: 1000 + 250, y: 1400, width: CAR_WIDTH, height: CAR_HEIGHT,
                rotation: Math.PI/2, color: spec.color, speed: 0, maxSpeed: spec.isHybrid ? 14 : 12,
                brand: spec.brand, isHybrid: spec.isHybrid, driverId: null
            });
            addLog("Auto staat buiten klaar!", "green");
        }
        addLog(`${item.name} gekocht`, "green");
    } else {
        addLog("Te weinig geld!", "red");
    }
  };

  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    if (activeShop !== 'none' || pestenState.active) return;

    const player = playerRef.current;
    const cars = carsRef.current;
    const npcs = insideLocation ? (insideLocation === 'cafe' ? cafeNpcsRef.current : carDealerNpcRef.current) : npcsRef.current; 
    const buildings = buildingsRef.current;
    const keys = keysPressed.current;

    // -- Physics & Movement --
    if (player.inCarId) {
      const car = cars.find(c => c.id === player.inCarId);
      if (car) {
        if (keys['w'] || keys['arrowup']) car.speed += 0.2;
        if (keys['s'] || keys['arrowdown']) car.speed -= 0.2;
        car.speed *= 0.98;
        if (Math.abs(car.speed) > 0.1) {
          const dir = car.speed > 0 ? 1 : -1;
          const turn = 0.04;
          if (keys['a'] || keys['arrowleft']) car.rotation -= turn * dir;
          if (keys['d'] || keys['arrowright']) car.rotation += turn * dir;
        }

        const nextX = car.x + Math.cos(car.rotation) * car.speed;
        const nextY = car.y + Math.sin(car.rotation) * car.speed;

        // Collision Check
        let collided = false;
        // Map Bounds (Fences)
        if (nextX < 50 || nextX > WORLD_WIDTH - 50 || nextY < 50 || nextY > WORLD_HEIGHT - 50) collided = true;
        
        // Buildings
        if (!collided) {
            const carRect = { x: nextX - CAR_HEIGHT/2, y: nextY - CAR_WIDTH/2, w: CAR_HEIGHT, h: CAR_WIDTH }; 
            for (const b of buildings) {
                if (rectIntersect(carRect, {x: b.x, y: b.y, w: b.width, h: b.height})) {
                    collided = true; break;
                }
            }
        }

        // Other Cars
        if (!collided) {
            for (const other of cars) {
                if (other.id === car.id) continue;
                // Simple distance check for car-to-car collision
                if (getDistance({x: nextX, y: nextY}, other) < CAR_HEIGHT/1.5) {
                    collided = true; break;
                }
            }
        }

        if (collided) {
            car.speed = -car.speed * 0.5;
        } else {
            car.x = nextX;
            car.y = nextY;
        }
        player.x = car.x; player.y = car.y; player.rotation = car.rotation;
      }
    } else {
      // Walking
      let dx = 0; let dy = 0;
      const speed = keys['shift'] ? 7.0 : 3.5;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      if (dx !== 0 || dy !== 0) {
         const angle = Math.atan2(dy, dx);
         const nextX = player.x + Math.cos(angle) * speed;
         const nextY = player.y + Math.sin(angle) * speed;

         let canMove = true;
         if (insideLocation) {
             if (nextX < 20 || nextX > CANVAS_WIDTH - 20 || nextY < 20 || nextY > CANVAS_HEIGHT - 20) canMove = false;
         } else {
             if (nextX < 20 || nextX > WORLD_WIDTH - 20 || nextY < 20 || nextY > WORLD_HEIGHT - 20) canMove = false;
             // Solid Buildings
             for (const b of buildings) {
                 if (rectIntersect({x: nextX - 10, y: nextY - 10, w: 20, h: 20}, {x: b.x, y: b.y, w: b.width, h: b.height})) {
                     canMove = false; break;
                 }
             }
         }
         if (canMove) { player.x = nextX; player.y = nextY; }
      }
      
      const camX = insideLocation ? 0 : cameraRef.current.x - CANVAS_WIDTH / 2;
      const camY = insideLocation ? 0 : cameraRef.current.y - CANVAS_HEIGHT / 2;
      player.rotation = Math.atan2((mouseRef.current.y + camY) - player.y, (mouseRef.current.x + camX) - player.x);
      if (mouseRef.current.down) attack(player, true);
    }

    // -- Projectiles --
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
       const p = projectilesRef.current[i];
       
       // Sub-stepping for high speed collision
       const steps = 4;
       const stepSpeed = p.speed / steps;
       let hit = false;
       
       for (let s = 0; s < steps; s++) {
           p.x += Math.cos(p.rotation) * stepSpeed;
           p.y += Math.sin(p.rotation) * stepSpeed;
           p.distanceTraveled += stepSpeed;
           
           if (!insideLocation) {
                for (const b of buildings) {
                    if (rectIntersect({x: p.x, y: p.y, w: 5, h: 5}, {x: b.x, y: b.y, w: b.width, h: b.height})) { hit = true; break; }
                }
           }
           
           if (!hit) {
               if (p.ownerId === 'robert') {
                  npcs.forEach(npc => {
                     if (npc.state !== 'dead' && isColliding({x: p.x, y: p.y, width: 20, height: 20}, npc)) {
                        damageNPC(npc, p.damage);
                        hit = true;
                     }
                  });
               } else if (isColliding({x: p.x, y: p.y, width: 20, height: 20}, player)) {
                     damagePlayer(p.damage);
                     hit = true;
               }
           }
           
           if (hit) break;
       }

       if (hit || p.distanceTraveled > p.maxDistance) { projectilesRef.current.splice(i, 1); continue; }
    }

    // -- NPCs --
    npcs.forEach(npc => {
       if (npc.state === 'dead') return;
       
       // Fighting Logic
       if (npc.state === 'fighting' && !insideLocation) {
          const d = getDistance(npc, player);
          npc.rotation = Math.atan2(player.y - npc.y, player.x - npc.x);
          if (d > 150) {
              const nx = npc.x + Math.cos(npc.rotation) * 2;
              const ny = npc.y + Math.sin(npc.rotation) * 2;
              let col = false;
              buildings.forEach(b => {
                  if (rectIntersect({x: nx - 10, y: ny - 10, w: 20, h: 20}, {x: b.x, y: b.y, w: b.width, h: b.height})) col = true;
              });
              if (!col) { npc.x = nx; npc.y = ny; }
          }
          if (d < 300 && Math.random() < 0.02) attack(npc, false);
       } 
       // Wandering Logic (Restored)
       else if (npc.state === 'wandering' && !insideLocation) {
          // Occasionally change direction
          if (Math.random() < 0.01) npc.rotation = Math.random() * Math.PI * 2;
          
          const nx = npc.x + Math.cos(npc.rotation) * 0.5;
          const ny = npc.y + Math.sin(npc.rotation) * 0.5;
          
          let col = false;
          // Map bounds
          if (nx < 0 || nx > WORLD_WIDTH || ny < 0 || ny > WORLD_HEIGHT) {
              col = true;
              npc.rotation += Math.PI; // Turn around
          }
          // Buildings
          if (!col) {
              buildings.forEach(b => {
                 if (rectIntersect({x: nx - 10, y: ny - 10, w: 20, h: 20}, {x: b.x, y: b.y, w: b.width, h: b.height})) col = true;
              });
          }
          
          if (!col) {
              npc.x = nx; 
              npc.y = ny;
          } else {
              npc.rotation += Math.PI / 2; // Turn 90 degrees on collision
          }
       }
    });

    // -- Camera --
    if (!insideLocation) {
      cameraRef.current.x += (player.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (player.y - cameraRef.current.y) * 0.1;
    } else {
      cameraRef.current.x = CANVAS_WIDTH / 2;
      cameraRef.current.y = CANVAS_HEIGHT / 2;
    }

    attackVisualsRef.current.forEach(v => v.time--);
    attackVisualsRef.current = attackVisualsRef.current.filter(v => v.time > 0);

    // Prompt updates...
    let prompt = null;
    let preview = null;
    if (insideLocation) {
        if (player.y > CANVAS_HEIGHT - 60) prompt = "Druk 'E' om te vertrekken";
        else if (insideLocation === 'cafe' && getDistance(player, cafeNpcsRef.current[0]) < 60) prompt = "Druk 'E' voor Bier";
        else if (insideLocation === 'car_dealer' && getDistance(player, carDealerNpcRef.current[0]) < 60) prompt = "Druk 'E' voor Auto's";
    } else if (!player.inCarId) {
        // Doors
        const door = buildings.find(b => getDistance(player, {x: b.x + b.doorOffset.x, y: b.y + b.doorOffset.y}) < 40);
        const car = cars.find(c => getDistance(player, c) < 60);
        const deal = getDistance(player, dealerRef.current) < 50;
        const loot = lootRef.current.find(l => getDistance(player, l) < 40);

        if (door) prompt = `Druk 'E' voor ${door.label || 'Huis'}`;
        else if (car) prompt = `Druk 'E' voor ${car.brand}`;
        else if (deal) prompt = "Druk 'E' voor Wapen Dealer";
        else if (loot) { prompt = "Druk 'E' om te pakken"; preview = loot; }
    } else {
        prompt = "Druk 'E' om uit te stappen";
    }
    setInteractionPrompt(prompt);
    setPreviewItem(preview || null);

  }, [gameState, insideLocation, activeShop, pestenState.active]);

  // --- Rendering ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const camX = insideLocation ? 0 : cameraRef.current.x - CANVAS_WIDTH / 2;
    const camY = insideLocation ? 0 : cameraRef.current.y - CANVAS_HEIGHT / 2;

    ctx.save();
    ctx.translate(-camX, -camY);

    if (insideLocation) {
        ctx.fillStyle = COLORS.floor;
        // Fill a large enough area for interior to cover screens
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        if (insideLocation === 'cafe') {
             ctx.fillStyle = '#5c2c0c'; ctx.fillRect(CANVAS_WIDTH/2 - 200, CANVAS_HEIGHT/2 - 200, 400, 60);
             cafeNpcsRef.current.forEach(n => drawNPC(ctx, n));
        } else if (insideLocation === 'car_dealer') {
             ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // White tiles
             ctx.fillStyle = '#334155'; ctx.fillRect(CANVAS_WIDTH/2 - 100, CANVAS_HEIGHT/2 - 100, 200, 50); // Desk
             carDealerNpcRef.current.forEach(n => drawNPC(ctx, n));
        } else {
             INTERIOR_FURNITURE.forEach(f => {
                ctx.fillStyle = f.color; ctx.fillRect(f.x + CANVAS_WIDTH/2 - 250, f.y + CANVAS_HEIGHT/2 - 250, f.width, f.height);
             });
        }
        ctx.fillStyle = COLORS.mat; ctx.fillRect(CANVAS_WIDTH/2 - 40, CANVAS_HEIGHT - 30, 80, 30);
    } else {
        // Draw Asphalt Background
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(camX, camY, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillRect(camX - 100, camY - 100, CANVAS_WIDTH + 200, CANVAS_HEIGHT + 200);

        // Draw Road Markings (Grid Lines)
        const ROWS = 8;
        const COLS = 8;
        const BLOCK_W = 500;
        const BLOCK_H = 500;
        const ROAD_W = 140;
        const START_OFFSET = 300;
        
        ctx.strokeStyle = '#e2e8f0'; // Light gray road markings
        ctx.setLineDash([20, 30]);
        ctx.lineWidth = 4;

        // Vertical Roads (Between columns)
        for (let c = 0; c <= COLS; c++) {
            const centerX = START_OFFSET + c * (BLOCK_W + ROAD_W) - ROAD_W/2;
            if (c > 0) { // Skip left edge if desired, or draw all
                ctx.beginPath();
                ctx.moveTo(centerX, 0);
                ctx.lineTo(centerX, WORLD_HEIGHT);
                ctx.stroke();
            }
        }
        // Horizontal Roads (Between rows)
        for (let r = 0; r <= ROWS; r++) {
            const centerY = START_OFFSET + r * (BLOCK_H + ROAD_W) - ROAD_W/2;
            if (r > 0) {
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(WORLD_WIDTH, centerY);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]); // Reset

        // Draw Lots (Green Rects)
        buildingsRef.current.forEach(b => {
            if (b.lot) {
                ctx.fillStyle = COLORS.grass;
                ctx.fillRect(b.lot.x, b.lot.y, b.lot.width, b.lot.height);
            }
        });

        // Buildings
        buildingsRef.current.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.width, b.height);
            
            // Roof Rendering
            if (b.type === 'house') {
                const vertical = b.height > b.width;
                const TILE_SIZE = 12;
                
                if (vertical) {
                    const ridgeX = b.x + b.width / 2;
                    // Left Slope
                    ctx.fillStyle = b.roofColor;
                    for(let ry = b.y; ry < b.y + b.height; ry += TILE_SIZE) {
                        for(let rx = b.x; rx < ridgeX; rx += TILE_SIZE) {
                             ctx.fillRect(rx, ry, TILE_SIZE - 2, TILE_SIZE - 2);
                        }
                    }
                    // Right Slope (Darker)
                    ctx.fillStyle = 'rgba(0,0,0,0.2)'; 
                    ctx.fillRect(ridgeX, b.y, b.width/2, b.height); // Shade base
                    ctx.fillStyle = b.roofColor;
                    for(let ry = b.y; ry < b.y + b.height; ry += TILE_SIZE) {
                        for(let rx = ridgeX; rx < b.x + b.width; rx += TILE_SIZE) {
                             ctx.fillRect(rx, ry, TILE_SIZE - 2, TILE_SIZE - 2);
                             // Extra shading on tiles
                             ctx.fillStyle = 'rgba(0,0,0,0.2)';
                             ctx.fillRect(rx, ry, TILE_SIZE - 2, TILE_SIZE - 2);
                             ctx.fillStyle = b.roofColor;
                        }
                    }
                    // Ridge line
                    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath();
                    ctx.moveTo(ridgeX, b.y); ctx.lineTo(ridgeX, b.y + b.height); ctx.stroke();
                } else {
                    const ridgeY = b.y + b.height / 2;
                    // Top Slope
                    ctx.fillStyle = b.roofColor;
                    for(let ry = b.y; ry < ridgeY; ry += TILE_SIZE) {
                        for(let rx = b.x; rx < b.x + b.width; rx += TILE_SIZE) {
                             ctx.fillRect(rx, ry, TILE_SIZE - 2, TILE_SIZE - 2);
                        }
                    }
                    // Bottom Slope (Darker)
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(b.x, ridgeY, b.width, b.height/2);
                    ctx.fillStyle = b.roofColor;
                    for(let ry = ridgeY; ry < b.y + b.height; ry += TILE_SIZE) {
                        for(let rx = b.x; rx < b.x + b.width; rx += TILE_SIZE) {
                             ctx.fillRect(rx, ry, TILE_SIZE - 2, TILE_SIZE - 2);
                             ctx.fillStyle = 'rgba(0,0,0,0.2)';
                             ctx.fillRect(rx, ry, TILE_SIZE - 2, TILE_SIZE - 2);
                             ctx.fillStyle = b.roofColor;
                        }
                    }
                    // Ridge line
                    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath();
                    ctx.moveTo(b.x, ridgeY); ctx.lineTo(b.x + b.width, ridgeY); ctx.stroke();
                }
            } else {
                // Flat roof for specials
                ctx.fillStyle = b.roofColor;
                ctx.fillRect(b.x + 5, b.y + 5, b.width - 10, b.height - 10);
            }

            // Door Trigger Visual
            ctx.fillStyle = '#111';
            const dx = b.x + b.doorOffset.x - 15;
            const dy = b.y + b.doorOffset.y - 10;
            ctx.fillRect(dx, dy, 30, 10);
            ctx.fillStyle = COLORS.mat; 
            ctx.fillRect(dx, dy + 10, 30, 10);

            if (b.label) {
                ctx.fillStyle = 'white'; ctx.font = '20px VT323'; ctx.fillText(b.label, b.x + 10, b.y - 10);
            }
        });

        // Dealer
        ctx.fillStyle = '#333'; ctx.fillRect(dealerRef.current.x - 20, dealerRef.current.y - 20, 40, 40);
        ctx.fillStyle = COLORS.dealer; ctx.beginPath(); ctx.arc(dealerRef.current.x, dealerRef.current.y, 12, 0, Math.PI*2); ctx.fill();

        // Loot
        lootRef.current.forEach(l => {
            ctx.fillStyle = l.type === 'money' ? 'green' : 'gold';
            ctx.fillRect(l.x - 5, l.y - 5, 10, 10);
        });

        // Cars
        carsRef.current.forEach(car => {
            ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.rotation);
            ctx.fillStyle = car.color; ctx.fillRect(-car.height/2, -car.width/2, car.height, car.width);
            ctx.fillStyle = '#00000055'; ctx.fillRect(-car.height/4, -car.width/2 + 2, car.height/2, car.width - 4);
            ctx.restore();
        });

        // Broken Fences at World Edge
        ctx.fillStyle = COLORS.fence;
        for(let i=0; i<WORLD_HEIGHT; i+=50) {
            if(Math.random()>0.3) ctx.fillRect(0, i, 10, 40);
            if(Math.random()>0.3) ctx.fillRect(WORLD_WIDTH-10, i, 10, 40);
        }
        for(let i=0; i<WORLD_WIDTH; i+=50) {
            if(Math.random()>0.3) ctx.fillRect(i, 0, 40, 10);
            if(Math.random()>0.3) ctx.fillRect(i, WORLD_HEIGHT-10, 40, 10);
        }

        npcsRef.current.forEach(n => drawNPC(ctx, n));
    }

    projectilesRef.current.forEach(p => {
        // Draw Tracer
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const tailLength = Math.min(25, p.speed * 1.5);
        ctx.moveTo(p.x - Math.cos(p.rotation)*tailLength, p.y - Math.sin(p.rotation)*tailLength);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    });

    const player = playerRef.current;
    if (!player.inCarId) {
        ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.rotation);
        ctx.fillStyle = 'white'; ctx.fillRect(-12, -10, 24, 20);
        ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = COLORS.robertHat; ctx.beginPath(); ctx.ellipse(0, 2, 11, 8, 0, 0, Math.PI*2); ctx.fill();
        // Weapon
        const w = player.inventory[player.activeSlot];
        if (w) {
            ctx.fillStyle = 'black'; 
            if(w.type === 'ak47') ctx.fillRect(5, 0, 25, 6); 
            else if(w.type === 'pistol') ctx.fillRect(8, 2, 14, 4);
            else if(w.type === 'bottle') { ctx.fillStyle = 'green'; ctx.fillRect(8, 2, 10, 4); }
        }
        ctx.restore();
    }

    attackVisualsRef.current.forEach(v => {
        ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.rotation);
        ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(20, 0, 10 - v.time, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    });

    ctx.restore();
  }, [insideLocation]);

  const drawNPC = (ctx: CanvasRenderingContext2D, npc: NPC) => {
    ctx.save(); ctx.translate(npc.x, npc.y); ctx.rotate(npc.rotation);
    if (npc.state === 'dead') {
        ctx.fillStyle = '#500'; ctx.fillRect(-10, -5, 20, 10);
    } else {
        ctx.fillStyle = npc.color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        
        // Only draw weapon if fighting
        if (npc.state === 'fighting') {
             if (npc.weapon.type === 'fists') {
                 // Fists
                 ctx.fillStyle = '#dcb162';
                 ctx.beginPath(); ctx.arc(8, -5, 3, 0, Math.PI*2); ctx.fill();
                 ctx.beginPath(); ctx.arc(8, 5, 3, 0, Math.PI*2); ctx.fill();
             } else {
                 // Actual Weapon
                 ctx.fillStyle = 'black'; 
                 if (npc.weapon.type === 'bottle') ctx.fillStyle = 'green';
                 const len = npc.weapon.type === 'ak47' ? 25 : 12;
                 ctx.fillRect(5, 2, len, 4);
             }
        }
    }
    ctx.restore();
  };

  useEffect(() => {
    let id: number;
    const loop = () => { update(); draw(); id = requestAnimationFrame(loop); };
    if (gameState === GameState.PLAYING) loop();
    return () => cancelAnimationFrame(id);
  }, [gameState, update, draw]);

  // --- UI ---
  const renderShop = (title: string, items: ShopItem[]) => (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 border-2 border-gray-600 p-6 rounded w-96 text-white">
            <h2 className="text-3xl text-yellow-500 mb-4 font-bold border-b border-gray-600">{title}</h2>
            <div className="flex flex-col gap-2">
                {items.map(item => (
                    <button key={item.id} onClick={() => buyItem(item)} className="flex justify-between p-2 bg-gray-700 hover:bg-gray-600 rounded">
                        <span>{item.name}</span>
                        <span className="text-green-400">€{item.price}</span>
                    </button>
                ))}
            </div>
            <div className="mt-4 text-center text-xs text-gray-400">Druk 'E' om te sluiten</div>
        </div>
    </div>
  );

  return (
    <div className="relative w-full h-full bg-black font-[VT323] cursor-crosshair">
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block" />
      
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
           <img src={MENU_BACKGROUND_IMAGE} className="absolute inset-0 w-full h-full object-cover opacity-60" />
           <div className="relative z-10 text-center">
             <h1 className="text-8xl text-yellow-500 font-bold drop-shadow-lg">GRAND THEFT ROBERT</h1>
             <h2 className="text-4xl text-white">AALST EDITION V2</h2>
             <button onClick={() => setGameState(GameState.PLAYING)} className="mt-8 px-8 py-3 bg-yellow-600 text-black font-bold text-2xl border-4 border-black">START</button>
           </div>
        </div>
      )}

      {gameState === GameState.WASTED && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 z-50 animate-pulse text-white">
              <h1 className="text-9xl font-bold">WASTED</h1>
              <p>Druk SPATIE</p>
          </div>
      )}

      {gameState === GameState.PLAYING && (
        <>
            <div className="absolute top-4 left-4 max-w-sm pointer-events-none z-10">
                {currentMission && <div className="bg-black/80 border-l-4 border-yellow-500 p-2 text-white mb-2"><h3 className="font-bold text-yellow-500">{currentMission.title}</h3><p className="text-xs">{currentMission.objective}</p></div>}
                {interactionPrompt && <div className="bg-yellow-600 text-black px-2 py-1 font-bold rounded animate-bounce mb-2">{interactionPrompt}</div>}
                {previewItem && <div className="bg-blue-600 text-white px-2 py-1 text-xs rounded mb-2">{previewItem.name}</div>}
                <div className="flex flex-col gap-1">{logs.map(l => <div key={l.id} style={{color:l.color}} className="text-sm bg-black/50 px-1 rounded">{l.text}</div>)}</div>
            </div>

            <div className="absolute bottom-4 right-4 flex items-center gap-4 bg-black/60 p-2 rounded text-white z-10">
                <div className="text-2xl text-green-400 font-bold">€{playerRef.current.cash}</div>
                <div className="w-32 h-4 bg-gray-800 rounded relative overflow-hidden"><div className="absolute h-full bg-red-600" style={{width: `${playerRef.current.health}%`}}></div></div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {playerRef.current.inventory.map((item, i) => (
                    <div key={i} className={`w-14 h-14 border-2 bg-black/80 flex items-center justify-center ${playerRef.current.activeSlot===i?'border-yellow-500':'border-gray-600'}`}>
                        {item ? <div className="text-white text-xs text-center">{item.name}<br/>{item.ammo > -1 ? item.ammo : ''}</div> : <span className="text-gray-600">-</span>}
                    </div>
                ))}
            </div>

            {activeShop === 'weapon' && renderShop("Wapen Dealer", DEALER_ITEMS)}
            {activeShop === 'car' && renderShop("Auto Aalst", CAR_SHOP_ITEMS)}
            {activeShop === 'bar' && renderShop("Café Menu", BEER_MENU.map(b => ({id: b.name, name: b.name, price: b.price, type: 'heal', value: b.heal} as ShopItem)))}
            
            {pestenState.active && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 text-white">
                    <h2 className="text-4xl text-yellow-500">PESTEN</h2>
                    <p className="text-xl mb-8">{pestenState.message}</p>
                    <div className="flex gap-2 mb-8 opacity-50">{pestenState.npcHand.map((_, i) => <div key={i} className="w-16 h-24 bg-red-900 border rounded"></div>)}</div>
                    <div className="w-20 h-28 bg-white text-black flex items-center justify-center text-2xl font-bold mb-8 rounded">{pestenState.discardPile.length > 0 && `${pestenState.discardPile[pestenState.discardPile.length-1].rank} ${pestenState.discardPile[pestenState.discardPile.length-1].suit}`}</div>
                    <div className="flex gap-4">
                        {pestenState.playerHand.map((c, i) => (
                            <button key={i} onClick={() => playCard(i)} className="w-20 h-28 bg-white text-black font-bold rounded hover:-translate-y-2 transition-transform">{c.rank} {c.suit}</button>
                        ))}
                        <button onClick={() => drawCard('player')} className="w-20 h-28 bg-gray-700 border-2 border-dashed rounded">PAK</button>
                    </div>
                    <button onClick={() => setPestenState(p => ({...p, active: false}))} className="mt-8 text-gray-500">STOP</button>
                </div>
            )}
        </>
      )}
    </div>
  );
};