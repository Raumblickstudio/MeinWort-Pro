import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface HotkeyFeedbackProps {
  hotkey: string;
  show: boolean;
  isRecording: boolean;
  onComplete?: () => void;
}

export function HotkeyFeedback({ hotkey, show, isRecording }: HotkeyFeedbackProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
          transition={{ 
            duration: 0.4, 
            ease: "backOut",
            scale: { type: "spring", stiffness: 400, damping: 15 }
          }}
          className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          {/* Pulsing Background */}
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.6, 0.8, 0.6] 
            }}
            transition={{ 
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={`absolute inset-0 rounded-lg ${
              isRecording 
                ? "bg-red-500/30" 
                : "bg-green-500/20"
            }`}
          />
          
          {/* Hotkey Display */}
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotateZ: isRecording ? [0, 5, -5, 0] : 0
            }}
            transition={{ 
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={`px-6 py-3 rounded-xl shadow-2xl border-2 text-white font-bold ${
              isRecording 
                ? "bg-gradient-to-br from-red-500 to-red-700 border-red-300/50" 
                : "bg-gradient-to-br from-green-500 to-green-700 border-green-300/50"
            }`}
          >
            <div className="text-center">
              <div className="text-2xl">{hotkey}</div>
              <div className="text-xs opacity-90 mt-1 flex items-center justify-center space-x-1">
                <span className={`w-2 h-2 rounded-full ${
                  isRecording ? "bg-red-300" : "bg-green-300"
                }`} />
                <span>{isRecording ? "AUFNAHME LÄUFT" : "BEREIT ZU STARTEN"}</span>
              </div>
            </div>
          </motion.div>
          
          {/* Particle Effects */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                opacity: 1, 
                scale: 0,
                x: 0, 
                y: 0 
              }}
              animate={{ 
                opacity: [1, 0],
                scale: [0, 1.5],
                x: Math.cos((i * 45) * Math.PI / 180) * 60,
                y: Math.sin((i * 45) * Math.PI / 180) * 60,
              }}
              transition={{ 
                duration: 1,
                delay: 0.2,
                ease: "easeOut"
              }}
              className="absolute w-2 h-2 bg-yellow-400 rounded-full"
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}