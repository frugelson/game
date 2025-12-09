import { Mission } from "../types";

// In Vite config, process.env.API_KEY is replaced by the actual key string during build
const API_KEY = process.env.API_KEY || '';

export const generateRobertDialogue = async (context: string): Promise<string> => {
  if (!API_KEY) return "Geen API key... (mompelt iets onverstaanbaars)";

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
              Je bent Robert, een cynische, alcoholische man van middelbare leeftijd in een Vlaams dorp.
              Geef een korte reactie (max 1 zin) op de volgende situatie: "${context}".
              Gebruik Vlaamse straattaal of typische uitspraken zoals 'alle dagen'.
            `
          }]
        }]
      })
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Mmm...";

  } catch (error) {
    console.error("Gemini error:", error);
    return "Godverdomme, ik ben de draad kwijt.";
  }
};

export const generateMission = async (): Promise<Mission> => {
  if (!API_KEY) {
    return {
      id: 'offline-1',
      title: 'De Afrekening',
      description: 'Iemand heeft je bier gestolen.',
      objective: 'Schakel de dief uit.',
      type: 'kill',
      reward: 50,
      completed: false
    };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
              Verzin een korte GTA-missie voor Robert (alcoholist). 
              Kies willekeurig uit:
              1. Een moordmissie ("kill"): Iemand moet dood omdat hij vervelend deed.
              2. Een levermissie ("delivery"): Breng bier of iets illegaals ergens heen.
              
              Geef antwoord in JSON: { "title": "...", "description": "...", "objective": "...", "type": "kill" of "delivery" }
            `
          }]
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const missionData = JSON.parse(text.trim());

    return {
      id: Math.random().toString(36).substr(2, 9),
      title: missionData.title || "Missie",
      description: missionData.description || "Doe iets.",
      objective: missionData.objective || "Klaar het klusje.",
      type: (missionData.type === 'kill' || missionData.type === 'delivery') ? missionData.type : 'misc',
      reward: Math.floor(Math.random() * 50) + 50,
      completed: false
    };

  } catch (error) {
    console.error("Gemini mission error:", error);
    return {
      id: 'fallback',
      title: 'Bierkoerier',
      description: 'De kroeg is bijna leeg.',
      objective: 'Breng een bak bier.',
      type: 'delivery',
      reward: 20,
      completed: false
    };
  }
};