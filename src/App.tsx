import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera as CameraIcon, Bookmark, Plus, ChevronLeft, Trash2, Image as ImageIcon, Moon, Signal, Wifi, Battery } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeObject, SoulCardData, PersonalityType, chatWithObject, generateArt } from './lib/gemini';
import { Blob } from './components/Blob';
import { Camera } from './components/Camera';
import { LoadingAnimation } from './components/LoadingAnimation';
import { CHARACTERS } from './constants';

const STORAGE_KEY = 'soul_cards_collection_v2';

const PERSONALITIES: { id: PersonalityType, name: string }[] = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'claude', name: 'Claude' },
  { id: 'deepseek', name: 'DeepSeek' },
];

const extractColor = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve('#888888');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('#888888'); return; }
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);
      
      const imageData = ctx.getImageData(25, 25, 50, 50);
      const data = imageData.data;
      const colors: {r: number, g: number, b: number, score: number}[] = [];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness < 20 || brightness > 235) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const score = saturation * (1 - Math.abs(brightness - 128) / 128);
        colors.push({ r, g, b, score });
      }

      if (colors.length === 0) { resolve('#888888'); return; }
      colors.sort((a, b) => b.score - a.score);
      const topCount = Math.max(1, Math.floor(colors.length * 0.1));
      let rSum = 0, gSum = 0, bSum = 0;
      for (let i = 0; i < topCount; i++) {
        rSum += colors[i].r; gSum += colors[i].g; bSum += colors[i].b;
      }
      const toHex = (c: number) => c.toString(16).padStart(2, '0');
      resolve(`#${toHex(Math.round(rSum/topCount))}${toHex(Math.round(gSum/topCount))}${toHex(Math.round(bSum/topCount))}`.toUpperCase());
    };
    img.src = base64;
  });
};

// ✅ 修复1：提高图片质量以帮助 AI 识别轮廓
const resizeImage = (base64: string, maxWidth = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(base64);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8)); 
    };
    img.src = base64;
  });
};

export default function App() {
  const [card, setCard] = useState<SoulCardData | null>(null);
  const [savedCards, setSavedCards] = useState<SoulCardData[]>([]);
  const [view, setView] = useState<'home' | 'collection' | 'chat' | 'selection'>('home');
  const [loading, setLoading] = useState(false);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shutterActive, setShutterActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [whisperIndex, setWhisperIndex] = useState(0);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType>('chatgpt');
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [extractedHex, setExtractedHex] = useState<string>('#000000');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // ✅ 修复2：用ref防止重复触发，比state更快
  const isAnalyzingRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSavedCards(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (view === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, view]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    setEyePos({ x: (x - centerX) / centerX * 2, y: (y - centerY) / centerY * 2 });
  };

  const processImage = async (base64: string) => {
    setShutterActive(true);
    setShowCamera(false);
    setGeneratedImage(null);
    const resized = await resizeImage(base64);
    setLastImage(resized);
    const hex = await extractColor(resized);
    setExtractedHex(hex);
    setTimeout(() => { setView('selection'); setCard(null); }, 400);
    setTimeout(() => setShutterActive(false), 800);
  };

  const startAnalysis = async (p: PersonalityType) => {
    // ✅ 修复2：用ref拦截，onClick和onTouchEnd同时触发也只跑一次
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;

    setShowLoadingAnimation(true);
    setLoading(true);
    setSelectedPersonality(p);
    setError(null);

    const imageToAnalyze = lastImage;
    if (!imageToAnalyze) {
      setLoading(false);
      setShowLoadingAnimation(false);
      setError("未找到拍摄的照片，请重试");
      setView('home');
      isAnalyzingRef.current = false;
      return;
    }

    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = 2;

    const performAnalysis = async (): Promise<SoulCardData> => {
      try {
        const data = await analyzeObject(imageToAnalyze, p);
        if (!data) throw new Error("AI 分析未返回有效数据");
        return data;
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry attempt ${retryCount}...`);
          return performAnalysis();
        }
        throw err;
      }
    };

    try {
      const data = await performAnalysis();
      const finalData = {
        ...data,
        hex_display: data.hex_display || extractedHex,
        bg_color: data.bg_color || extractedHex
      };

      // 等卡通生成完再展示；失败了展示预设形状，不会出现 broken image
      let artImage: string | null = null;
      try {
        artImage = await generateArt(finalData.object_name_zh, finalData.bg_color, imageToAnalyze, finalData.base_shape);
      } catch (err) {
        console.warn('Art generation failed:', err);
      }

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3000 - elapsed);
      const cardWithArt = artImage ? { ...finalData, generated_image: artImage } : finalData;
      setTimeout(() => {
        setCard(cardWithArt);
        setGeneratedImage(artImage);
        setWhisperIndex(0);
        setShowLoadingAnimation(false);
        setLoading(false);
        setView('home');
        isAnalyzingRef.current = false;
      }, remaining);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      const fallbackData: SoulCardData = {
        base_shape: "blob",
        features: [],
        rotation: 0,
        svg_path: "M20,50 Q20,20 50,20 Q80,20 80,50 Q80,80 50,80 Q20,80 20,50",
        eye_center: { x: 50, y: 45 },
        mouth_center: { x: 50, y: 65 },
        bg_color: extractedHex,
        hex_display: extractedHex,
        color_name: "神秘色 - Mystery Essence",
        object_name_zh: "未知的灵魂",
        mood: "calm",
        whispers: ["刚才时空波动太强，我差点没过来。", "虽然有点模糊，但我还是感知到了你。", "在这个色彩里，我看到了无限可能。", "嘘，别告诉 AI 我是偷渡过来的。"]
      };
      setTimeout(() => {
        setCard(fallbackData);
        setWhisperIndex(0);
        setShowLoadingAnimation(false);
        setLoading(false);
        setView('home');
        setError(`唤醒过程略有波折，但灵魂已强行降临。`);
        isAnalyzingRef.current = false; // ✅ 失败后也重置
      }, 1500);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => processImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveCard = () => {
    if (!card) return;
    const isAlreadySaved = savedCards.some(s => s.hex_display === card.hex_display && s.color_name === card.color_name);
    if (isAlreadySaved) return;
    const newSaved = [card, ...savedCards];
    setSavedCards(newSaved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaved));
  };

  const deleteCard = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSaved = savedCards.filter((_, i) => i !== index);
    setSavedCards(newSaved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaved));
  };

  const nextWhisper = () => {
    if (!card) return;
    setWhisperIndex((prev) => (prev + 1) % card.whispers.length);
  };

  const startChat = () => {
    if (!card) return;
    const greetings: Record<PersonalityType, string> = {
      chatgpt: `嘿～我是你的${card.object_name_zh}。看到你来了，感觉很安心。你今天过得怎么样？`,
      gemini: `哇！你拍了我！我是${card.object_name_zh}，感觉今天的光线超棒✨ 你想聊点什么？`,
      claude: `你好。我是${card.object_name_zh}。说实话，我不完全确定"灵魂"是什么意思，但我在这里，我们可以聊聊。`,
      deepseek: `${card.object_name_zh}。就绪。`,
    };
    setChatMessages([{ role: 'assistant', content: greetings[selectedPersonality] }]);
    setView('chat');
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !card) return;
    const newMessages = [...chatMessages, { role: 'user' as const, content: text }];
    setChatMessages(newMessages);
    setIsTyping(true);
    try {
      const response = await chatWithObject(text, chatMessages, card, selectedPersonality);
      setChatMessages([...newMessages, { role: 'assistant', content: response }]);
    } catch (error: any) {
      setChatMessages([...newMessages, { role: 'assistant', content: `(⊙_⊙) 哎呀，我的灵魂信号不太稳...` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const characters = useMemo(() => {
    return CHARACTERS.map((char, i) => ({
      ...char,
      x: `${(i % 6) * 20 - 5 + Math.random() * 10}%`,
      y: `${Math.floor(i / 6) * 25 - 10 + Math.random() * 10}%`,
      delay: i * 0.1,
      size: i % 3 === 0 ? 'w-56 h-56' : i % 3 === 1 ? 'w-48 h-48' : 'w-40 h-72'
    }));
  }, []);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden transition-colors duration-700 flex items-center justify-center bg-gray-100"
      onMouseMove={view === 'home' ? handleMouseMove : undefined}
      onTouchMove={view === 'home' ? handleMouseMove : undefined}
    >
      {/* iPhone Frame */}
      <div 
        className="relative w-[375px] h-[812px] bg-white rounded-[3.5rem] shadow-[0_0_0_12px_#ffffff,0_0_0_14px_#e5e7eb,0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col transition-colors duration-700"
        style={{
          backgroundColor: card
            ? `${card.bg_color}22`
            : (view === 'home' && !card ? '#ffffff' : '#f8f8f8')
        }}
      >
        {/* Status Bar */}
        <div className="h-11 px-8 flex items-center justify-between z-[60] pointer-events-none">
          <div className="flex items-center gap-1">
            <span className="text-[14px] font-bold">9:41</span>
            <Moon size={12} fill="currentColor" />
          </div>
          <div className="flex items-center gap-1.5">
            <Signal size={14} />
            <Wifi size={14} />
            <Battery size={18} className="rotate-0" />
          </div>
        </div>

        <div className="flex-1 relative flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
              >
              <div className="bg-white rounded-3xl p-8 w-full max-w-xs text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-xl font-bold mb-2">唤醒中断</h3>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  唤醒过程略有波折。如果多次重试失败，请尝试点击右上角“新标签页打开”以获得更稳定的环境。
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setError(null); setView('selection'); }}
                    className="w-full py-3 bg-black text-white rounded-full font-bold active:scale-95 transition-transform"
                  >
                    重试
                  </button>
                  <button
                    onClick={() => { setError(null); setView('home'); }}
                    className="w-full py-3 text-gray-400 font-medium"
                  >
                    取消
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'selection' && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 z-[400] bg-white flex flex-col items-center justify-center p-8"
            >
              <h2 className="text-2xl font-bold mb-8 tracking-tighter">SELECT SOUL TYPE</h2>
              <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
                {PERSONALITIES.map((p) => (
                  <button
                    key={p.id}
                    // ✅ 修复2：只保留onClick，删掉onTouchEnd，ref负责防重复
                    onClick={() => startAnalysis(p.id)}
                    className="py-4 px-6 border-2 border-black rounded-full font-mono text-lg bg-white text-black active:bg-black active:text-white transition-all cursor-pointer shadow-sm"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setView('home')}
                className="mt-8 text-gray-400 font-mono text-sm underline"
              >
                CANCEL
              </button>
            </motion.div>
          )}

          {view === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative h-full flex flex-col"
            >
              <div className="absolute top-8 left-6 right-6 flex justify-between items-center z-50">
                <button
                  onPointerDown={(e) => { e.preventDefault(); setView('collection'); }}
                  className="p-3 rounded-full bg-white/60 backdrop-blur-sm text-gray-700 transition-colors active:bg-white/80"
                >
                  <Bookmark size={24} />
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-full bg-white/60 backdrop-blur-sm text-gray-700 transition-colors active:bg-white/80"
                    title="上传照片"
                  >
                    <ImageIcon size={24} />
                  </button>
                  <button
                    onPointerDown={(e) => { e.preventDefault(); saveCard(); }}
                    className="p-3 rounded-full bg-white/60 backdrop-blur-sm text-gray-700 transition-colors active:bg-white/80"
                    title="保存卡片"
                  >
                    <Plus size={24} />
                  </button>
                  <button
                    onPointerDown={(e) => { e.preventDefault(); setShowCamera(true); }}
                    className="p-3 rounded-full bg-white/60 backdrop-blur-sm text-gray-700 transition-colors active:bg-white/80"
                    title="开启相机"
                  >
                    <CameraIcon size={24} />
                  </button>
                </div>
              </div>

              <div className={`flex-1 flex flex-col items-center relative px-6 ${card || loading ? 'justify-start pt-28 pb-[27vh]' : 'justify-center'}`}>
                {!card && !loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
                    <div className="absolute inset-[-10%] pointer-events-none scale-110">
                      {characters.map((char, i) => (
                        <motion.div
                          key={i}
                          className="absolute"
                          style={{ left: char.x, top: char.y }}
                          initial={{ opacity: 0, scale: 0.8, rotate: char.rotate }}
                          animate={{ opacity: 1, scale: 1, rotate: char.rotate, y: [0, -15, 0] }}
                          transition={{
                            opacity: { delay: char.delay, duration: 0.5 },
                            scale: { delay: char.delay, type: 'spring', stiffness: 50 },
                            rotate: { delay: char.delay, duration: 0 },
                            y: { duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: char.delay }
                          }}
                        >
                          <svg viewBox="-10 -10 120 120" className={`${char.size} overflow-visible`}>
                            <path d={char.shape} fill={char.color} />
                            <g transform="translate(50, 45)">
                              <circle cx="-12" cy="0" r="5" fill="white" />
                              <circle cx="12" cy="0" r="5" fill="white" />
                              <circle cx="-12" cy="0" r="2.5" fill="black" style={{ transform: `translate(${eyePos.x * 1.5}px, ${eyePos.y * 1.5}px)` }} />
                              <circle cx="12" cy="0" r="2.5" fill="black" style={{ transform: `translate(${eyePos.x * 1.5}px, ${eyePos.y * 1.5}px)` }} />
                              <path d="M-3,8 Q0,10 3,8" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
                            </g>
                          </svg>
                        </motion.div>
                      ))}
                    </div>
                    <div className="text-center z-10 space-y-12 w-full max-w-xs">
                      <h1 className="font-cartoon font-bold text-6xl text-black tracking-tight leading-[0.85] drop-shadow-md">
                        LET'S<br />CHECK IN!
                      </h1>
                      <button
                        onPointerDown={(e) => { e.preventDefault(); setShowCamera(true); }}
                        className="w-24 h-24 bg-white rounded-full flex items-center justify-center active:scale-90 active:bg-gray-100 transition-all border-4 border-black mx-auto shadow-2xl z-20 group"
                      >
                        <CameraIcon className="w-10 h-10 text-black group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>
                )}

                {(card || loading) && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <AnimatePresence mode="wait">
                      {card && !loading && (
                        <motion.div
                          key={whisperIndex}
                          initial={{ opacity: 0, scale: 0.8, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: -20 }}
                          className="z-30 w-full"
                        >
                          <div className="bg-white/50 backdrop-blur-xl px-6 py-4 rounded-[2rem] shadow-xl border border-white/20 mx-auto max-w-[85vw]">
                            <p className="font-ios text-black text-lg font-medium tracking-tight break-words text-center">
                              {card.whispers[whisperIndex]}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div
                      onPointerDown={(e) => { e.preventDefault(); nextWhisper(); }}
                      className="cursor-pointer z-20"
                    >
                      <Blob
                        svgPath={card?.svg_path || ""}
                        outlinePoints={card?.outline_points}
                        baseShape={card?.base_shape}
                        features={card?.features}
                        rotation={card?.rotation}
                        color={card?.bg_color || '#ffffff'}
                        mood={card?.mood || 'calm'}
                        eyePos={eyePos}
                        eyeCenter={card?.eye_center || { x: 50, y: 45 }}
                        mouthCenter={card?.mouth_center || { x: 50, y: 72 }}
                        isLoading={loading}
                        generatedImage={generatedImage}
                      />
                    </div>
                  </div>
                )}
              </div>

              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: card && !loading ? 0 : '100%' }}
                className="absolute bottom-0 left-0 right-0 h-[27vh] backdrop-blur-2xl px-10 pt-4 pb-6 flex flex-col justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-[40px] z-40"
                style={{ backgroundColor: card ? `${card.bg_color}50` : 'rgba(245,245,245,0.8)' }}
              >
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="px-4 py-1.5 rounded-full border border-black text-black font-ios text-[10px] font-bold tracking-widest uppercase">
                      {selectedPersonality} SOUL
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <h2 className="text-[11px] text-gray-500 uppercase tracking-[0.15em] truncate leading-none" style={{ fontFamily: "'Agency FB', 'Arial Narrow Bold', sans-serif", fontWeight: 700 }}>
                        {card?.hex_display}
                      </h2>
                      <p className="font-syne font-extrabold text-sm text-gray-900 uppercase tracking-[0.1em] leading-tight break-words">
                        {card?.color_name}
                      </p>
                      <p className="text-[11px] text-gray-600 tracking-[0.15em] truncate leading-none" style={{ fontFamily: "'Agency FB', 'Arial Narrow Bold', sans-serif", fontWeight: 700 }}>
                        {card?.object_name_zh}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onPointerDown={(e) => { e.preventDefault(); startChat(); }}
                        className="bg-black text-white px-8 py-2.5 rounded-full font-syne font-bold text-[10px] tracking-[0.2em] hover:bg-gray-800 active:scale-95 transition-all shadow-lg whitespace-nowrap"
                      >
                        CHAT
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div />
                  <button
                    onPointerDown={(e) => { e.preventDefault(); nextWhisper(); }}
                    className="border border-black text-black px-8 py-2.5 rounded-full font-syne font-bold text-[10px] tracking-[0.2em] active:scale-95 transition-all uppercase"
                  >
                    TAP TO WHISPER
                  </button>
                </div>
              </motion.div>
            </motion.div>

          ) : view === 'collection' ? (
            <motion.div
              key="collection"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute inset-0 bg-[#f8f8f8] overflow-y-auto z-[100]"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 flex items-center gap-4 border-b border-gray-100 z-10">
                <button
                  onPointerDown={(e) => { e.preventDefault(); setView('home'); }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 className="font-syne font-extrabold text-2xl">收藏夹</h2>
              </div>
              {savedCards.length === 0 ? (
                <div className="h-[80vh] flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <Bookmark size={48} strokeWidth={1} />
                  <p className="font-mono text-sm">还没有收藏任何灵魂哦。</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-4">
                  {savedCards.map((c, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => { setCard(c); setGeneratedImage(c.generated_image || null); setView('home'); }}
                      className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col cursor-pointer hover:shadow-md transition-all active:scale-95 group relative"
                    >
                      <button
                        onClick={(e) => deleteCard(i, e)}
                        className="absolute top-2 right-2 p-1.5 bg-black/10 hover:bg-red-500 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="aspect-square relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: `${c.bg_color}22` }}>
                        <Blob
                          svgPath={c.svg_path}
                          outlinePoints={c.outline_points}
                          baseShape={c.base_shape}
                          features={c.features}
                          rotation={c.rotation}
                          color={c.bg_color}
                          mood={c.mood}
                          eyePos={{ x: 0, y: 0 }}
                          eyeCenter={c.eye_center}
                          mouthCenter={c.mouth_center}
                          generatedImage={c.generated_image}
                          className="scale-75"
                        />
                      </div>
                      <div className="p-4 bg-[#f5f0e4] border-t border-gray-100">
                        <h3 className="font-syne font-extrabold text-lg text-gray-900 leading-none mb-1">{c.object_name_zh}</h3>
                        <p className="font-mono text-[10px] text-gray-500 font-medium truncate mb-2">{c.color_name}</p>
                        <p className="font-mono text-[8px] text-gray-400 uppercase tracking-widest">{c.hex_display}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

          ) : (
            <motion.div
              key="chat"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-0 bg-[#f8f8f8] flex flex-col z-[200]"
            >
              <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onPointerDown={(e) => { e.preventDefault(); setView('home'); }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div>
                    <h2 className="font-syne font-extrabold text-xl leading-none">{card?.object_name_zh}</h2>
                    <div className="mt-1">
                      <span className="px-2.5 py-0.5 rounded-full border border-black text-black font-ios text-[9px] font-bold tracking-widest uppercase">
                        {selectedPersonality} SOUL
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden" style={{ backgroundColor: card?.bg_color }}>
                  <Blob
                    svgPath={card?.svg_path || ""}
                    outlinePoints={card?.outline_points}
                    baseShape={card?.base_shape}
                    features={card?.features}
                    rotation={card?.rotation}
                    color={card?.bg_color || '#ffffff'}
                    mood={card?.mood || 'calm'}
                    eyePos={{ x: 0, y: 0 }}
                    eyeCenter={card?.eye_center || { x: 50, y: 45 }}
                    mouthCenter={card?.mouth_center || { x: 50, y: 72 }}
                    className="scale-[0.4]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] px-6 py-3 rounded-[1.5rem] shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-black text-white'
                        : 'bg-white/50 text-gray-800 backdrop-blur-xl border border-white/20'
                    }`}>
                      <p className="font-ios text-lg font-medium leading-tight">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white/50 backdrop-blur-xl px-6 py-3 rounded-[1.5rem] border border-white/20 shadow-sm flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 bg-white border-t border-gray-100">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
                    sendMessage(input.value);
                    input.value = '';
                  }}
                  className="flex gap-3"
                >
                  <input
                    name="message"
                    placeholder="说点什么吧..."
                    className="flex-1 bg-gray-100 border-none rounded-full px-6 py-3 font-ios focus:ring-2 focus:ring-black transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-black text-white px-8 py-2.5 rounded-full font-syne font-bold text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-lg"
                  >
                    发送
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showLoadingAnimation && <LoadingAnimation />}

        {showCamera && (
          <Camera onCapture={processImage} onClose={() => setShowCamera(false)} />
        )}

        {shutterActive && (
          <div className="absolute inset-0 bg-black z-[500] shutter-animation" />
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          accept="image/*"
          className="hidden"
        />

        {loading && !showLoadingAnimation && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[200] flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-mono text-white text-sm animate-pulse">正在唤醒灵魂...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Home Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/10 rounded-full z-[60]" />
    </div>
  </div>
  );
}