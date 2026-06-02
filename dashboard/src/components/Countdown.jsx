import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function Countdown({ countdown }) {
  const [remaining, setRemaining] = useState(countdown?.remaining ?? 0);

  useEffect(() => {
    setRemaining(countdown?.remaining ?? 0);
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown?.saleTs]);

  const displayMs = countdown?.saleTs ? countdown.saleTs - Date.now() : remaining;
  const isUrgent = displayMs < 30000;

  return (
    <div className={`card ${isUrgent ? 'border-warning/40' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className={`w-4 h-4 ${isUrgent ? 'text-warning' : 'text-accent'}`} />
        <h2 className="text-sm font-semibold text-white">Time Until Sale</h2>
      </div>
      <div
        className={`text-3xl font-mono font-bold text-center py-2 ${
          isUrgent ? 'text-warning' : 'text-accent'
        }`}
        style={{ letterSpacing: '0.1em' }}
      >
        {formatDuration(Math.max(0, displayMs))}
      </div>
      {countdown?.saleTs && (
        <p className="text-xs text-muted text-center mt-1 font-mono">
          {new Date(countdown.saleTs).toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}{' '}
          WIB
        </p>
      )}
    </div>
  );
}
