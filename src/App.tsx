import { HashRouter, Route, Routes } from "react-router-dom";
import { PlayerProvider } from "./context/PlayerContext";
import { useUIStore } from "./store/useUIStore";
import { SIDEBAR_PADDING_CLASS, SIDEBAR_LEFT_OFFSET_CLASS } from "./lib/sidebarLayout";
import { Sidebar } from "./components/Sidebar";
import { BottomTabBar } from "./components/BottomTabBar";
import { CompactAudioPlayer } from "./components/CompactAudioPlayer";
import { FullScreenPlayerModal } from "./components/FullScreenPlayerModal";
import { Dashboard } from "./screens/Dashboard";
import { Library } from "./screens/Library";
import { EpisodeDetail } from "./screens/EpisodeDetail";
import { Stub } from "./screens/Stub";

function App() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarOffset = collapsed ? SIDEBAR_PADDING_CLASS.collapsed : SIDEBAR_PADDING_CLASS.expanded;
  const fixedBarOffset = collapsed ? SIDEBAR_LEFT_OFFSET_CLASS.collapsed : SIDEBAR_LEFT_OFFSET_CLASS.expanded;

  return (
    <PlayerProvider>
      <HashRouter>
        <div
          className={`min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-bg-primary transition-[padding-left] duration-200 ${sidebarOffset}`}
        >
          <Sidebar />
          <div className="mx-auto max-w-[430px] md:max-w-3xl md:px-8 md:py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/episode/:id" element={<EpisodeDetail />} />
              <Route path="/insights" element={<Stub title="Insights" />} />
              <Route path="/profile" element={<Stub title="Profile" />} />
            </Routes>
          </div>
        </div>
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-[430px] transition-[left] duration-200 md:mx-0 md:max-w-none ${fixedBarOffset}`}
        >
          <CompactAudioPlayer />
          <BottomTabBar />
        </div>
        <FullScreenPlayerModal />
      </HashRouter>
    </PlayerProvider>
  );
}

export default App;
