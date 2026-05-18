import React from 'react';

interface BlobProps {
  baseShape?: "glass" | "mug" | "bottle" | "plant" | "book" | "phone" | "fruit" | "bowl" | "circle" | "rect" | "shirt" | "shoe" | "blob";
  features?: string[];
  rotation?: number;
  svgPath?: string;
  outlinePoints?: { x: number; y: number }[];
  color: string;
  mood?: string;
  eyePos?: { x: number; y: number };
  eyeCenter?: { x: number; y: number };
  mouthCenter?: { x: number; y: number };
  isLoading?: boolean;
  className?: string;
  size?: string;
  generatedImage?: string | null;
}

// Convert outline points to a smooth SVG path using Catmull-Rom interpolation
const pointsToPath = (pts: { x: number; y: number }[]): string => {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = (p1.x + (p2.x - p0.x) / 5).toFixed(1);
    const cp1y = (p1.y + (p2.y - p0.y) / 5).toFixed(1);
    const cp2x = (p2.x - (p3.x - p1.x) / 5).toFixed(1);
    const cp2y = (p2.y - (p3.y - p1.y) / 5).toFixed(1);
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d + " Z";
};

export const Blob: React.FC<BlobProps> = ({
  baseShape = "blob",
  features = [],
  rotation = 0,
  svgPath = "",
  outlinePoints,
  color,
  mood = "calm",
  eyePos = { x: 0, y: 0 },
  eyeCenter = { x: 50, y: 45 },
  mouthCenter = { x: 50, y: 72 },
  isLoading,
  className = "",
  size = "w-64 h-64 sm:w-72 sm:h-72",
  generatedImage,
}) => {
  // If we have a generated image, show it with SVG eyes overlay
  if (generatedImage) {
    return (
      <div className={`relative w-full aspect-square overflow-hidden rounded-2xl drop-shadow-xl transition-all duration-700 ${isLoading ? 'blob-wobble' : ''} ${className}`}>
        <img src={generatedImage} className="w-full h-full object-cover" alt="" />
        <svg
          viewBox="-10 -10 120 120"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <g transform={`translate(${eyeCenter.x}, ${eyeCenter.y})`}>
            <circle cx="-10" cy="0" r="9" fill="#f5f0e4" />
            <circle cx="10" cy="0" r="9" fill="#f5f0e4" />
            <g transform={`translate(${eyePos.x * 5}, ${eyePos.y * 5})`}>
              <circle cx="-10" cy="0" r="4" fill="black" className={isLoading ? 'eye-spin' : ''} />
              <circle cx="10" cy="0" r="4" fill="black" className={isLoading ? 'eye-spin' : ''} />
            </g>
          </g>
          <g transform={`translate(${mouthCenter.x}, ${mouthCenter.y})`}>
            <path d="M-4,1 Q0,4 4,1" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    );
  }
  const getBaseD = () => {
    switch (baseShape) {
      // 无把手玻璃杯（水杯、威士忌杯、无柄酒杯）
      case "glass":
        return "M16,10 Q14,8 50,8 Q86,8 84,10 V73 Q82,92 50,92 Q18,92 16,73 Z";
      // 有把手马克杯
      case "mug":
        return "M22,15 H78 V70 Q75,88 50,88 Q25,88 22,70 V15 Z";
      // 有瓶颈的瓶子
      case "bottle":
        return "M38,5 H62 V20 Q76,26 76,54 V82 Q76,92 50,92 Q24,92 24,82 V54 Q24,26 38,20 Z";
      // 盆栽植物
      case "plant":
        return "M35,92 H65 V72 Q78,64 80,44 Q80,22 50,28 Q20,22 20,44 Q22,64 35,72 Z";
      // 书 / 笔记本
      case "book":
        return "M22,10 H78 Q84,10 84,16 V88 Q84,92 78,92 H22 Q16,92 16,88 V16 Q16,10 22,10 Z";
      // 手机 / 平板
      case "phone":
        return "M33,5 Q27,5 27,13 V87 Q27,95 33,95 H67 Q73,95 73,87 V13 Q73,5 67,5 Z";
      // 水果（苹果、橙子等圆形）
      case "fruit":
        return "M50,18 Q74,14 80,38 Q86,64 66,80 Q50,88 34,80 Q14,64 20,38 Q26,14 50,18 Z";
      // 碗 / 浅口容器
      case "bowl":
        return "M10,42 Q10,22 50,20 Q90,22 90,42 Q90,78 50,84 Q10,78 10,42 Z";
      // 圆形 / 球形
      case "circle":
        return "M50,12 Q88,12 88,50 Q88,88 50,88 Q12,88 12,50 Q12,12 50,12";
      // 方形 / 盒子
      case "rect":
        return "M15,18 H85 Q88,18 88,22 V78 Q88,82 85,82 H15 Q12,82 12,78 V22 Q12,18 15,18 Z";
      // 手提包 / 背包（包体+两个提手）
      case "bag":
        return "M25,40 Q25,20 33,20 Q41,20 41,40 H59 Q59,20 67,20 Q75,20 75,40 H80 Q87,40 87,47 V82 Q87,90 80,90 H20 Q13,90 13,82 V47 Q13,40 20,40 Z";
      // T恤 / 上衣 / 衬衫
      case "shirt":
        return "M8,10 H35 Q38,4 50,4 Q62,4 65,10 H92 V32 H65 V90 H35 V32 H8 Z";
      // 鞋子 / 拖鞋（侧视图）
      case "shoe":
        return "M8,50 Q8,28 28,22 H72 Q90,22 90,42 Q90,58 82,64 Q65,75 50,75 Q28,75 14,68 Q5,62 8,50 Z";
      // 不规则形状：优先用坐标点插值，其次 svgPath，最后默认
      case "blob":
      default:
        if (outlinePoints && outlinePoints.length >= 3) return pointsToPath(outlinePoints);
        return svgPath || "M50,15 Q85,15 90,50 Q85,85 50,85 Q15,85 10,50 Q15,15 50,15 Z";
    }
  };

  const baseD = getBaseD();

  return (
    <div className={`relative ${size} flex items-center justify-center transition-transform duration-500 ${isLoading ? 'blob-wobble' : ''} ${className}`}>
      <svg viewBox="-10 -10 120 120" className="w-full h-full drop-shadow-xl overflow-visible">
        <defs>
          <filter id="roughPaper">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" />
          </filter>
          <linearGradient id={`shapeGlow-${color}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="50%" stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="black" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <g transform={`rotate(${rotation}, 50, 50)`}>
          {/* Main Body with rough hand-drawn outline and shadow */}
          <path
            d={baseD}
            fill={color}
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="0.5"
            filter="url(#roughPaper)"
            className="transition-all duration-700 ease-in-out drop-shadow-md"
          />

          {/* Features */}
          {features.map((feature, i) => {
            if (feature.toLowerCase().includes('handle')) {
              return (
                <path
                  key={i}
                  d="M75,35 Q95,35 95,50 Q95,65 75,65"
                  fill="none"
                  stroke={color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  filter="url(#roughPaper)"
                />
              );
            }
            if (feature.toLowerCase().includes('lid') || feature.toLowerCase().includes('cap')) {
              return (
                <path
                  key={i}
                  d="M40,15 Q50,5 60,15"
                  fill="none"
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#roughPaper)"
                />
              );
            }
            if (feature.toLowerCase().includes('leaf')) {
              return (
                <g key={i} filter="url(#roughPaper)">
                  <path d="M80,40 Q95,30 85,20 Q70,30 80,40" fill={color} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                  <path d="M20,40 Q5,30 15,20 Q30,30 20,40" fill={color} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                </g>
              );
            }
            if (feature.toLowerCase().includes('spine')) {
              return (
                <path
                  key={i}
                  d="M32,15 V90"
                  fill="none"
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth="1"
                  filter="url(#roughPaper)"
                />
              );
            }
            if (feature.toLowerCase().includes('steam')) {
              return (
                <g key={i} className="animate-pulse">
                  <path d="M40,5 Q45,-5 40,-15" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M50,5 Q55,-5 50,-15" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M60,5 Q65,-5 60,-15" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" strokeLinecap="round" />
                </g>
              );
            }
            if (feature.toLowerCase().includes('screen')) {
              return (
                <rect key={i} x="33" y="20" width="34" height="52" rx="2"
                  fill="rgba(0,0,0,0.08)" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"
                  filter="url(#roughPaper)" />
              );
            }
            if (feature.toLowerCase().includes('zipper')) {
              return (
                <path key={i} d="M28,44 H72" fill="none" stroke="rgba(0,0,0,0.25)"
                  strokeWidth="2" strokeLinecap="round" strokeDasharray="4,3"
                  filter="url(#roughPaper)" />
              );
            }
            if (feature.toLowerCase().includes('strap')) {
              return (
                <path key={i} d="M35,40 Q50,28 65,40" fill="none" stroke="rgba(0,0,0,0.2)"
                  strokeWidth="4" strokeLinecap="round" filter="url(#roughPaper)" />
              );
            }
            if (feature.toLowerCase().includes('sole')) {
              return (
                <path key={i} d="M10,67 Q50,78 90,67 L90,73 Q50,84 10,73 Z"
                  fill="rgba(0,0,0,0.15)" filter="url(#roughPaper)" />
              );
            }
            if (feature.toLowerCase().includes('collar') || feature.toLowerCase().includes('neckline')) {
              return (
                <path key={i} d="M38,8 Q50,20 62,8" fill="none" stroke="rgba(0,0,0,0.15)"
                  strokeWidth="2" strokeLinecap="round" filter="url(#roughPaper)" />
              );
            }
            if (feature.toLowerCase().includes('page') || feature.toLowerCase().includes('lines')) {
              return (
                <g key={i} filter="url(#roughPaper)">
                  <line x1="28" y1="38" x2="72" y2="38" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
                  <line x1="28" y1="50" x2="72" y2="50" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
                  <line x1="28" y1="62" x2="72" y2="62" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
                </g>
              );
            }
            if (feature.toLowerCase().includes('straw')) {
              return (
                <path key={i} d="M60,10 L56,-14" fill="none" stroke={color}
                  strokeWidth="5" strokeLinecap="round" filter="url(#roughPaper)" />
              );
            }
            if (feature.toLowerCase().includes('stem') || feature.toLowerCase().includes('stalk')) {
              return (
                <path key={i} d="M50,28 Q54,18 58,10" fill="none" stroke="rgba(0,0,0,0.2)"
                  strokeWidth="3" strokeLinecap="round" filter="url(#roughPaper)" />
              );
            }
            return null;
          })}

          {/* Inner gradient overlay for 3D depth */}
          <path
            d={baseD}
            fill={`url(#shapeGlow-${color})`}
            stroke="none"
            className="pointer-events-none"
          />

          {/* Subtle inner glow/shadow to separate from background if colors are same */}
          <path
            d={baseD}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeOpacity="0.2"
            filter="url(#roughPaper)"
            className="pointer-events-none"
          />
        </g>

        {/* Eyes Group - Large touching eyeballs with pupils */}
        <g transform={`translate(${eyeCenter.x}, ${eyeCenter.y})`}>
          {/* Eyeballs - Large white circles touching in the middle */}
          <circle cx="-13" cy="0" r="14" fill="#f5f0e4" />
          <circle cx="13" cy="0" r="14" fill="#f5f0e4" />

          {/* Pupils Group - Moves within the eyeballs */}
          <g transform={`translate(${eyePos.x * 7}, ${eyePos.y * 7})`}>
            <circle cx="-13" cy="0" r="6" fill="black" className={isLoading ? 'eye-spin' : ''} />
            <circle cx="13" cy="0" r="6" fill="black" className={isLoading ? 'eye-spin' : ''} />
          </g>
        </g>

        {/* Mouth Group - Smaller simple smile */}
        <g transform={`translate(${mouthCenter.x}, ${mouthCenter.y})`}>
          <path
            d="M-5,1 Q0,5 5,1"
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </g>
      </svg>
    </div>
  );
};
