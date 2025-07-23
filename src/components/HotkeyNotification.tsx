import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface HotkeyNotificationProps {
  show: boolean;
  message: string;
  type: "success" | "info" | "warning";
}

export function HotkeyNotification({ show, message, type }: HotkeyNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [show]);

  const getColors = () => {
    switch (type) {
      case "success":
        return "bg-green-900/90 border-green-500/50 text-green-200";
      case "warning":
        return "bg-yellow-900/90 border-yellow-500/50 text-yellow-200";
      default:
        return "bg-blue-900/90 border-blue-500/50 text-blue-200";
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`
            absolute top-2 left-1/2 transform -translate-x-1/2 z-50
            px-3 py-2 rounded-md border ${getColors()}
            text-xs font-medium text-center
            backdrop-blur-sm shadow-lg
          `}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}