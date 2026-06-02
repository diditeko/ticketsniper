import { useState } from 'react';
import { Crosshair, Settings, User, Terminal, LayoutDashboard } from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import ControlPanel from './components/ControlPanel';
import ConfigPanel from './components/ConfigPanel';
import ProfilePanel from './components/ProfilePanel';
import LogTerminal from './components/LogTerminal';
import StatusBar from './components/StatusBar';
import ResultModal from './components/ResultModal';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'config',    label: 'Config',    icon: Settings },
  { id: 'profile',   label: 'Profile',   icon: User },
  { id: 'logs',      label: 'Logs',      icon: Terminal },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const ws = useWebSocket();

  return (
    <div className="min-h-screen bg-surface grid-bg flex flex-col">
      {/* Ambient top glow */}
      <div
        className="fixed top-0 left-0 right-0 h-px z-50"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(65% 0.22 265), transparent)' }}
      />

      {/* Header */}
      <header className="glass border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-accent" />
            </div>
            <div>
              <span className="font-semibold text-white tracking-tight">TicketSniper</span>
              <span className="ml-2 text-xs text-muted font-mono">v1.0</span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeTab === id
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-muted hover:text-white hover:bg-panel'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          <StatusBar connected={ws.connected} botState={ws.botState} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {activeTab === 'dashboard' && (
          <ControlPanel ws={ws} onTabChange={setActiveTab} />
        )}
        {activeTab === 'config' && <ConfigPanel />}
        {activeTab === 'profile' && <ProfilePanel />}
        {activeTab === 'logs' && <LogTerminal logs={ws.logs} onClear={ws.clearLogs} fullscreen />}
      </main>

      {/* Result modal */}
      {ws.result && <ResultModal result={ws.result} onClose={ws.clearResult} />}
    </div>
  );
}
