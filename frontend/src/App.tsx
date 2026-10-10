import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { PlayerProvider } from "./context/PlayerContext";
import { startDailyReminderWatcher } from "./lib/dailyReminder";
import { applyTheme } from "./lib/applyTheme";
import { useThemeStore } from "./store/useThemeStore";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./screens/Dashboard";
import { Discover } from "./screens/Discover";
import { Library } from "./screens/Library";
import { EpisodeDetail } from "./screens/EpisodeDetail";
import { Insights } from "./screens/Insights";
import { Profile } from "./screens/Profile";
import { NotFound } from "./screens/NotFound";

function App() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    startDailyReminderWatcher();
  }, []);

  return (
    <PlayerProvider>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/library" element={<Library />} />
            <Route path="/episode/:id" element={<EpisodeDetail />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </PlayerProvider>
  );
}

export default App;
