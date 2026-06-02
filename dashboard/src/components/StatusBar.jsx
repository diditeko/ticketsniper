import { Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';

const STATUS_CONFIG = {
  idle:    { color: 'bg-muted',    label: 'Idle',     pulse: false },
  running: { color: 'bg-accent',   label: 'Running',  pulse: true  },
  done:    { color: 'bg-success',  label: 'Done',     pulse: false },
  error:   { color: 'bg-danger',   label: 'Error',    pulse: false },
};

export default function StatusBar({ connected, botState }) {
  const cfg = STATUS_CONFIG[botState.status] || STATUS_CONFIG.idle;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div
          className={clsx(
            'status-dot',
            cfg.color,
            cfg.pulse && 'animate-pulse'
          )}
          style={cfg.pulse ? { boxShadow: '0 0 8px currentColor' } : {}}
        />
        <span className="text-xs text-muted font-mono hidden sm:inline">{cfg.label}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {connected ? (
          <Wifi className="w-3.5 h-3.5 text-success" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-danger" />
        )}
        <span className={clsx('text-xs font-mono', connected ? 'text-success' : 'text-danger')}>
          {connected ? 'Connected' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
