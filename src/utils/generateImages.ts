import { GoogleGenAI } from "@google/genai";

export async function generateRoleImages() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const roles = [
    { id: "Merlin", prompt: "Merlin the wise old wizard with a long white beard and a glowing blue orb, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "Assassin", prompt: "A deadly medieval assassin in dark leather armor, face partially hidden by a hood, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "Percival", prompt: "Percival the noble knight with a determined look, wearing shining armor, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "Morgana", prompt: "Morgana the evil sorceress, beautiful but sinister, wearing dark elegant robes, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "Mordred", prompt: "Mordred the traitorous knight, dark armor, menacing expression, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "Oberon", prompt: "Oberon the mysterious outcast, wild appearance, cloaked, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "Loyal Servant", prompt: "A loyal knight of Arthur, wearing a standard helmet and armor, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "Minion", prompt: "A sinister minion of Mordred, dark rugged armor, classic board game character portrait, realistic oil painting style, Arthurian legend, medieval fantasy, dramatic lighting" },
    { id: "CardBack", prompt: "A magical medieval crest featuring a glowing holy grail and Arthurian symbols, symmetrical card back design, classic board game style, realistic oil painting style, dark magical background" }
  ];

  const results: Record<string, string> = {};
  
  for (const role of roles) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: role.prompt,
        config: {
          imageConfig: {
            aspectRatio: "3:4"
          }
        }
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          results[role.id] = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    } catch (e) {
      console.error(`Failed to generate ${role.id}:`, e);
    }
  }
  return results;
}
