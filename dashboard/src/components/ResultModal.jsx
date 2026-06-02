import { CheckCircle2, Copy, X } from 'lucide-react';
import { useState } from 'react';

export default function ResultModal({ result, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!result?.vaNumber) return null;

  function copyVA() {
    navigator.clipboard.writeText(result.vaNumber.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 glass rounded-2xl p-8 max-w-md w-full text-center animate-slide-up"
        style={{ boxShadow: '0 0 60px oklch(65% 0.18 145 / 30%)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success icon */}
        <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto mb-4 glow-success">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Ticket Secured!</h2>
        <p className="text-sm text-muted mb-6">Complete payment before the deadline</p>

        {/* VA Number */}
        <div className="bg-surface border border-border rounded-xl p-4 mb-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Virtual Account Number</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-mono font-bold text-white tracking-widest">
              {result.vaNumber}
            </span>
            <button
              onClick={copyVA}
              className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              title="Copy VA number"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && <p className="text-xs text-success mt-1">Copied!</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="bg-surface border border-border rounded-lg p-3">
            <p className="text-xs text-muted mb-1">Total Payment</p>
            <p className="text-sm font-semibold text-white">{result.total || '—'}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3">
            <p className="text-xs text-muted mb-1">Payment Deadline</p>
            <p className="text-sm font-semibold text-warning">{result.deadline || '—'}</p>
          </div>
        </div>

        <p className="text-xs text-muted mt-4">
          Pay via Mandiri m-banking or ATM before the deadline expires.
        </p>
      </div>
    </div>
  );
}
