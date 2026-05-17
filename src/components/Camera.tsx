import React, { useRef, useEffect, useState } from 'react';
import { X, Camera as CameraIcon, RefreshCw } from 'lucide-react';

interface CameraProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export const Camera: React.FC<CameraProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions.");
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        onCapture(base64);
      }
    }
  };

  return (
    <div className="absolute inset-0 bg-black z-[300] flex flex-col">
      <div className="flex justify-between p-6 z-10">
        <button 
          onPointerDown={(e) => {
            e.preventDefault();
            onClose();
          }} 
          className="text-white p-2 bg-white/10 rounded-full"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-white text-center p-8">
            <p className="mb-4">{error}</p>
            <button onClick={startCamera} className="bg-white text-black px-6 py-2 rounded-full font-syne font-bold">
              Retry
            </button>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="p-12 pb-20 flex justify-center items-center gap-8 bg-black">
        <button 
          onPointerDown={(e) => {
            e.preventDefault();
            capture();
          }}
          className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-8 border-gray-600 active:scale-90 active:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
        >
          <div className="w-16 h-16 rounded-full border-2 border-black" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
