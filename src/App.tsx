
import { useAppState } from "./hooks/useAppState";
import { useWindowConfig } from "./hooks/useWindowConfig";
import { useGlobalHotkeys } from "./hooks/useGlobalHotkeys";
import { OverlayWindow } from "./components/OverlayWindow";

function App() {
  const { state, toggleRecording, stopRecording, clearText, copyCurrentText } = useAppState();
  
  // Configure the window (AlwaysOnTop, etc.)
  useWindowConfig();

  // Setup global hotkeys (F9, Escape)
  useGlobalHotkeys({
    onToggleRecording: toggleRecording,
    onStopRecording: stopRecording,
    isRecording: state.isRecording,
    isTranscribing: state.isTranscribing,
  });

  return (
    <div className="w-full h-full relative">
      <OverlayWindow 
        state={state}
        onToggleRecording={toggleRecording}
        onClearText={clearText}
        onCopyText={copyCurrentText}
      />
    </div>
  );
}

export default App;