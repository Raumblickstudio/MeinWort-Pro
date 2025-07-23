import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReaderIcon, StopIcon, CopyIcon } from "@radix-ui/react-icons";
import { AppState } from "../types";
import { HotkeyNotification } from "./HotkeyNotification";

interface OverlayWindowProps {
  state: AppState;
  onToggleRecording: () => void;
  onClearText: () => void;
  onCopyText?: () => Promise<boolean>;
}

export function OverlayWindow({ state, onToggleRecording, onClearText, onCopyText }: OverlayWindowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [isCopying, setIsCopying] = useState(false);

  // Copy Handler
  const handleCopyText = async () => {
    if (!onCopyText || !state.lastTranscription || isCopying) return;
    
    setIsCopying(true);
    console.log("🔄 Copy-Button geklickt, Text:", state.lastTranscription.substring(0, 50) + "...");
    
    try {
      const success = await onCopyText();
      if (success) {
        console.log("✅ Copy-Button: Erfolgreich kopiert");
        setNotificationMessage("📋 Text in Zwischenablage kopiert!");
        setShowNotification(true);
      } else {
        console.error("❌ Copy-Button: Kopieren fehlgeschlagen");
        setNotificationMessage("❌ Kopieren fehlgeschlagen");
        setShowNotification(true);
      }
    } catch (error) {
      console.error("❌ Copy-Button error:", error);
      setNotificationMessage("❌ Kopieren fehlgeschlagen");
      setShowNotification(true);
    } finally {
      setIsCopying(false);
    }
  };

  // Show notification when recording state changes
  useEffect(() => {
    if (state.isRecording) {
      if (state.mode === 'text-processing') {
        setNotificationMessage("🔄 Text-Processing: Sprachbefehl aufnehmen...");
      } else {
        setNotificationMessage("🎤 Normal-Modus: Aufnahme gestartet!");
      }
      setShowNotification(true);
    } else if (state.isTranscribing) {
      if (state.mode === 'text-processing') {
        setNotificationMessage("🤖 Verarbeite Text mit AI...");
      } else {
        setNotificationMessage("🔄 Transkribiere Audio...");
      }
      setShowNotification(true);
    } else if (state.lastTranscription && !state.isTranscribing) {
      if (state.mode === 'text-processing') {
        setNotificationMessage("✅ Text verarbeitet und kopiert!");
      } else {
        setNotificationMessage("✅ Transkription abgeschlossen!");
      }
      setShowNotification(true);
    }
  }, [state.isRecording, state.lastTranscription, state.isTranscribing, state.mode]);

  // Style basierend auf Modus
  const getModeStyles = () => {
    if (state.mode === 'text-processing') {
      return {
        border: 'border-orange-500/70',
        background: 'bg-gradient-to-br from-gray-900/95 to-orange-900/20',
        glow: 'shadow-orange-500/20 shadow-lg'
      };
    }
    return {
      border: 'border-gray-700/50',
      background: 'bg-gray-900/95',
      glow: ''
    };
  };

  const modeStyles = getModeStyles();

  return (
    <motion.div
      className={`w-full h-full ${modeStyles.background} backdrop-blur-sm ${modeStyles.border} border rounded-lg overflow-hidden relative ${modeStyles.glow}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hotkey Notification */}
      <HotkeyNotification 
        show={showNotification} 
        message={notificationMessage}
        type={state.isRecording ? "info" : "success"}
      />
      {/* Header with Status */}
      <div className="px-3 py-2 bg-gray-800/80 border-b border-gray-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <motion.div
              className={`w-2 h-2 rounded-full ${
                state.isRecording 
                  ? "bg-red-500" 
                  : state.isTranscribing 
                  ? "bg-yellow-500" 
                  : "bg-green-500"
              }`}
              animate={state.isRecording ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: state.isRecording ? Infinity : 0, duration: 1 }}
            />
            <span className="text-sm text-gray-300 font-medium">
              {state.isRecording 
                ? (state.mode === 'text-processing' ? "🔄 Befehl aufnehmen..." : "🎤 Aufnahme läuft")
                : state.isTranscribing 
                ? (state.mode === 'text-processing' ? "🤖 AI verarbeitet..." : "⏳ Transkribiert...")
                : state.mode === 'text-processing' 
                ? `📄 Text erkannt (${state.clipboardText?.length || 0} Zeichen)`
                : "✨ Bereit (F9)"}
            </span>
          </div>
          
          <div className="text-xs text-gray-500">MeinWort</div>
        </div>
      </div>

      {/* Clipboard Text Preview (nur im Text-Processing Modus) */}
      <AnimatePresence>
        {state.mode === 'text-processing' && state.clipboardText && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 bg-orange-900/20 border-b border-orange-700/30"
          >
            <div className="text-sm text-orange-300 mb-2">📄 Erkannter Text:</div>
            <div className="text-sm text-gray-300 bg-gray-800/50 rounded p-3 max-h-20 overflow-y-auto">
              {state.clipboardText.length > 120 
                ? `${state.clipboardText.substring(0, 120)}...` 
                : state.clipboardText}
            </div>
            <div className="text-sm text-orange-400 mt-2">
              💬 Sagen Sie was Sie damit machen möchten (z.B. "fass zusammen")
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="p-3 flex-1 flex flex-col justify-center">
        {/* Recording Button */}
        <motion.button
          onClick={onToggleRecording}
          disabled={state.isTranscribing}
          className={`
            w-full py-3 px-4 rounded-md font-medium text-base transition-all duration-200
            flex items-center justify-center space-x-2
            ${state.isRecording 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
            }
          `}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {state.isRecording ? (
            <>
              <StopIcon className="w-4 h-4" />
              <span>Stopp (F9)</span>
            </>
          ) : (
            <>
              {state.mode === 'text-processing' ? (
                <>
                  <motion.div
                    className="w-4 h-4 text-orange-400"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    🔄
                  </motion.div>
                  <span>Befehl (F9)</span>
                </>
              ) : (
                <>
                  <ReaderIcon className="w-4 h-4" />
                  <span>Aufnahme (F9)</span>
                </>
              )}
            </>
          )}
        </motion.button>

        {/* Transcription Result */}
        <AnimatePresence>
          {state.lastTranscription && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="bg-gray-800/60 rounded-md p-3 border border-gray-700/30">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm text-gray-400">Transkript:</span>
                  <button
                    onClick={onClearText}
                    className="text-gray-500 hover:text-gray-300 text-xs"
                    title="Text löschen"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  readOnly
                  value={state.lastTranscription}
                  className="w-full text-sm text-gray-200 bg-transparent border-none outline-none resize-none leading-relaxed h-20 overflow-y-auto"
                  style={{ 
                    fontFamily: 'inherit',
                    userSelect: 'text',
                    WebkitUserSelect: 'text'
                  }}
                  onClick={(e) => {
                    // Text automatisch selektieren beim Klick
                    const target = e.target as HTMLTextAreaElement;
                    target.select();
                    console.log("📝 Text selektiert - bereit für Cmd+C/Strg+C");
                  }}
                  title="Klicken → Cmd+C/Strg+C zum Kopieren oder Copy-Button verwenden"
                />
                <div className="mt-2 flex justify-end">
                  <motion.button
                    onClick={handleCopyText}
                    disabled={isCopying || !state.lastTranscription}
                    className={`
                      text-sm flex items-center space-x-1 transition-all duration-200
                      ${isCopying 
                        ? "text-gray-500 cursor-not-allowed" 
                        : "text-blue-400 hover:text-blue-300"
                      }
                    `}
                    title={isCopying ? "Kopiere..." : "In Zwischenablage kopieren"}
                    whileHover={!isCopying ? { scale: 1.05 } : {}}
                    whileTap={!isCopying ? { scale: 0.95 } : {}}
                  >
                    <CopyIcon className="w-3 h-3" />
                    <span>{isCopying ? "Kopiere..." : "Kopieren"}</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        <AnimatePresence>
          {state.error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-2 bg-red-900/50 border border-red-700/50 rounded-md p-2"
            >
              <p className="text-xs text-red-300">{state.error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expand on Hover Info */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="px-3 py-1 bg-gray-800/90 border-t border-gray-700/30"
          >
            <p className="text-xs text-gray-400 text-center">
              {state.isRecording 
                ? "🔴 F9 oder ESC: Aufnahme stoppen" 
                : "🎯 F9: Aufnahme starten • ESC: Stopp"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}