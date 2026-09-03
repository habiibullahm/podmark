import { HashRouter, Route, Routes } from "react-router-dom";
import { PlayerProvider } from "./context/PlayerContext";
import { Sidebar } from "./components/Sidebar";
import { BottomTabBar } from "./components/BottomTabBar";
import { CompactAudioPlayer } from "./components/CompactAudioPlayer";
import { FullScreenPlayerModal } from "./components/FullScreenPlayerModal";
import { Dashboard } from "./screens/Dashboard";
import { Library } from "./screens/Library";
import { EpisodeDetail } from "./screens/EpisodeDetail";
import { Stub } from "./screens/Stub";

function App() {
  return (
    <PlayerProvider>
      <HashRouter>
        <div className="min-h-screen bg-bg-primary md:pl-60">
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
        <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-[430px] md:left-60 md:mx-0 md:max-w-none">
          <CompactAudioPlayer />
          <BottomTabBar />
        </div>
        <FullScreenPlayerModal />
      </HashRouter>
    </PlayerProvider>
  );
}

export default App;
