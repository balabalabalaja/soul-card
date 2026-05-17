export interface SoulCardData {
  base_shape: "glass" | "mug" | "bottle" | "plant" | "book" | "phone" | "fruit" | "bowl" | "circle" | "rect" | "bag" | "shirt" | "shoe" | "blob";
  outline_points?: { x: number; y: number }[];
  features: string[];
  rotation: number;
  svg_path: string;
  eye_center: { x: number; y: number };
  mouth_center: { x: number; y: number };
  bg_color: string;
  hex_display: string;
  color_name: string;
  object_name_zh: string;
  mood: "happy" | "tired" | "grumpy" | "surprised" | "calm" | "excited";
  whispers: string[];
  hook?: string;
  chat_topics?: string[];
  generated_image?: string | null;
}

export type PersonalityType = 'chatgpt' | 'gemini' | 'claude' | 'deepseek';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

export async function analyzeObject(
  base64Image: string,
  personality: PersonalityType = 'chatgpt'
): Promise<SoulCardData> {
  const res = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, personality }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend error ${res.status}`);
  }
  return res.json();
}

export async function generateArt(objectNameZh: string, bgColor: string, image: string, baseShape?: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/generate-art`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object_name_zh: objectNameZh, bg_color: bgColor, image, base_shape: baseShape }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend error ${res.status}`);
  }
  const data = await res.json();
  // Return full data URI so Blob can use it directly
  return `data:${data.mimeType};base64,${data.image}`;
}

export async function chatWithObject(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  card: SoulCardData,
  personality: PersonalityType = 'chatgpt'
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, card, personality }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend error ${res.status}`);
  }
  const data = await res.json();
  return data.response;
}
