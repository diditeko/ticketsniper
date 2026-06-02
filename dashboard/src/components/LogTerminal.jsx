import { useEffect, useRef } from 'react';
import { Terminal, Trash2, Download } from 'lucide-react';
import clsx from 'clsx';

const LEVEL_COLORS = {
  INFO:    'text-cyan-400',
  SUCCESS: 'text-green-400',
  WARN:    'text-yellow-400',
  ERROR:   'text-red-400',
  FIRE:    'text-purple-400',
  STEP:    'text-blue-400',
};

const LEVEL_BADGES = {
  INFO:    'bg-cyan-400/10 text-cyan-400',
  SUCCESS: 'bg-green-400/10 text-green-400',
  WARN:    'bg-yellow-400/10 text-yellow-400',
  ERROR:   'bg-red-400/10 text-red-400',
  FIRE:    'bg-purple-400/10 text-purple-400',
  STEP:    'bg-blue-400/10 text-blue-400',
};

function downloadLogs(logs) {
  const text = logs.map((l) => `[${l.ts}] [${l.level}] ${l.text}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticketsniper_${Date.now()}.log`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LogTerminal({ logs, onClear, fullscreen }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className={clsx('card flex flex-col', fullscreen ? 'min-h-[calc(100vh-160px)]' : 'h-[420px]')}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Terminal className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-white">Live Logs</h2>
        <span className="ml-auto text-xs font-mono text-muted">{logs.length} lines</span>
        <div className="flex gap-1">
          <button
            onClick={() => downloadLogs(logs)}
            className="p-1.5 rounded text-muted hover:text-white hover:bg-panel transition-colors"
            title="Download logs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClear}
            className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal body */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-black/40 border border-border/50 p-3 font-mono text-xs space-y-0.5">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted/50">
            <span>Waiting for bot activity...</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2 items-start leading-5 hover:bg-white/3 rounded px-1 group">
              <span className="text-muted/50 flex-shrink-0 select-none">
                {log.ts?.slice(11, 23) || ''}
              </span>
              <span
                className={clsx(
                  'px-1 rounded text-[10px] font-semibold flex-shrink-0 uppercase',
                  LEVEL_BADGES[log.level] || LEVEL_BADGES.INFO
                )}
              >
                {log.level?.slice(0, 4) || 'INFO'}
              </span>
              <span className={clsx('flex-1 break-all', LEVEL_COLORS[log.level] || 'text-gray-300')}>
                {log.text}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
