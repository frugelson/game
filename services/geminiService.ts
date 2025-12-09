import { GoogleGenAI } from "@google/genai";
import { Mission } from "../types";

const API_KEY = process.env.API_KEY || '';

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const generateRobertDialogue = async (context: string): Promise<string> => {
  if (!ai) return "Geen API key... (mompelt iets onverstaanbaars)";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Je bent Robert, een cynische, alcoholische man van middelbare leeftijd in een Vlaams dorp.
        Geef een korte reactie (max 1 zin) op de volgende situatie: "${context}".
        Gebruik Vlaamse straattaal of typische uitspraken zoals 'alle dagen'.
      `,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini error:", error);
    return "Godverdomme, ik ben de draad kwijt.";
  }
};

export const generateMission = async (): Promise<Mission> => {
  if (!ai) {
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Verzin een korte GTA-missie voor Robert (alcoholist). 
        Kies willekeurig uit:
        1. Een moordmissie ("kill"): Iemand moet dood omdat hij vervelend deed.
        2. Een levermissie ("delivery"): Breng bier of iets illegaals ergens heen.
        
        Geef antwoord in JSON: { "title": "...", "description": "...", "objective": "...", "type": "kill" of "delivery" }
      `,
      config: {
        responseMimeType: "application/json",
      }
    });

    const data = JSON.parse(response.text.trim());
    return {
      id: Math.random().toString(36).substr(2, 9),
      title: data.title,
      description: data.description,
      objective: data.objective,
      type: data.type === 'kill' || data.type === 'delivery' ? data.type : 'misc',
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