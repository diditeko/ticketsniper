import { useState, useEffect } from 'react';
import {
  Play, Square, Clock, Zap, Shield, CheckCircle2,
  AlertCircle, Loader2, Target, Timer, TrendingUp, Users
} from 'lucide-react';
import clsx from 'clsx';
import { startBot, stopBot, checkSession, fetchConfig } from '../hooks/useApi';
import LogTerminal from './LogTerminal';
import Countdown from './Countdown';

const STEPS = [
  { id: 'init',       label: 'Initialize',       icon: Shield },
  { id: 'waiting',    label: 'Waiting',          icon: Clock },
  { id: 'preload',    label: 'Preload Page',      icon: Zap },
  { id: 'firing',     label: 'Fire Mode',         icon: Target },
  { id: 'queue',      label: 'Queue Entry',       icon: TrendingUp },
  { id: 'in_queue',   label: 'In Queue (1B)',     icon: Users },
  { id: 'queue_done', label: 'Queue Passed',      icon: CheckCircle2 },
  { id: 'checkout',   label: 'Checkout',          icon: CheckCircle2 },
  { id: 'payment',    label: 'Payment',           icon: CheckCircle2 },
  { id: 'done',       label: 'Done!',             icon: CheckCircle2 },
];

function StepProgress({ currentStep, status }) {
  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="space-y-2">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isDone = currentIdx > idx;
        const isActive = currentIdx === idx && status === 'running';
        const isError = status === 'error' && isActive;

        return (
          <div
            key={step.id}
            className={clsx(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300',
              isActive && !isError && 'bg-accent/10 border border-accent/20',
              isDone && 'bg-success/5 border border-success/10',
              isError && 'bg-danger/10 border border-danger/20',
              !isActive && !isDone && !isError && 'opacity-30'
            )}
          >
            <div
              className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                isActive && !isError && 'bg-accent/20',
                isDone && 'bg-success/20',
                isError && 'bg-danger/20',
                !isActive && !isDone && !isError && 'bg-panel'
              )}
            >
              {isActive && !isError ? (
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
              ) : isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              ) : isError ? (
                <AlertCircle className="w-3.5 h-3.5 text-danger" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-muted" />
              )}
            </div>
            <span
              className={clsx(
                'text-sm font-medium',
                isActive && !isError && 'text-accent',
                isDone && 'text-success',
                isError && 'text-danger',
                !isActive && !isDone && !isError && 'text-muted'
              )}
            >
              {step.label}
            </span>
            {isActive && !isError && (
              <span className="ml-auto text-xs text-accent/60 font-mono animate-pulse">
                in progress...
              </span>
            )}
            {isDone && (
              <span className="ml-auto text-xs text-success/60 font-mono">done</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ControlPanel({ ws, onTabChange }) {
  const [sessionValid, setSessionValid] = useState(null);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);

  const { botState, logs, countdown } = ws;
  const isRunning = botState.status === 'running';

  useEffect(() => {
    checkSession().then((r) => setSessionValid(r.valid));
    fetchConfig().then(setConfig);
  }, []);

  async function handleStart() {
    if (loading || isRunning) return;
    setLoading(true);
    try {
      await startBot();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    await stopBot();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Left column */}
      <div className="lg:col-span-1 space-y-5">
        {/* Target card */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Target Event</h2>
          </div>
          <div className="space-y-3">
            <InfoRow label="URL" value={config.TIKET_URL || '—'} mono truncate />
            <InfoRow label="Sale Date" value={config.TIKET_SALE_DATE || '—'} />
            <InfoRow label="Sale Time" value={config.TIKET_SALE_TIME ? `${config.TIKET_SALE_TIME} WIB` : '—'} mono />
            <InfoRow label="Category" value={config.TIKET_CATEGORY || '—'} />
            <InfoRow label="Quantity" value={config.TIKET_QTY || '—'} />
            <InfoRow label="Payment" value={config.PAYMENT_METHOD || '—'} />
          </div>
          <button
            onClick={() => onTabChange('config')}
            className="btn-ghost mt-4 w-full text-center"
          >
            Edit Config
          </button>
        </div>

        {/* Session status */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Session</h2>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
            <div
              className={clsx(
                'status-dot',
                sessionValid === null && 'bg-muted',
                sessionValid === true && 'bg-success',
                sessionValid === false && 'bg-danger'
              )}
            />
            <span className="text-sm">
              {sessionValid === null
                ? 'Checking...'
                : sessionValid
                ? 'Session valid'
                : 'No session — run: npm run login'}
            </span>
          </div>
          {sessionValid === false && (
            <p className="mt-2 text-xs text-muted font-mono bg-warning/5 border border-warning/20 p-2 rounded">
              $ npm run login
            </p>
          )}
        </div>

        {/* Countdown */}
        {countdown && <Countdown countdown={countdown} />}

        {/* Queue position card — visible only when in queue */}
        {(botState.step === 'in_queue' || botState.queuePosition) && (
          <div className="card border-warning/30">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-warning animate-pulse" />
              <h2 className="text-sm font-semibold text-white">Virtual Queue</h2>
              <span className="ml-auto text-xs font-mono text-warning animate-pulse">WAITING</span>
            </div>
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-warning">
                {botState.queuePosition
                  ? Number(botState.queuePosition.replace(/[,.]/g, '')).toLocaleString()
                  : '—'}
              </div>
              <p className="text-xs text-muted mt-1">people in front of you</p>
            </div>
            {botState.queueEta && (
              <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs">
                <span className="text-muted">Expected arrival</span>
                <span className="text-white font-mono">{botState.queueEta}</span>
              </div>
            )}
            {botState.queueUpdated && (
              <p className="text-xs text-muted/50 text-right mt-1 font-mono">
                Updated: {botState.queueUpdated}
              </p>
            )}
          </div>
        )}

        {/* Control buttons */}
        <div className="card">
          <div className="flex gap-3">
            <button
              onClick={handleStart}
              disabled={loading || isRunning || sessionValid === false}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200',
                isRunning || loading
                  ? 'bg-accent/20 text-accent/60 cursor-not-allowed'
                  : 'bg-accent text-white hover:brightness-110 active:scale-95 glow-accent'
              )}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isRunning ? 'Running...' : 'Start Bot'}
            </button>

            {isRunning && (
              <button
                onClick={handleStop}
                className="px-4 py-3 rounded-xl font-semibold text-sm bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-all active:scale-95"
              >
                <Square className="w-4 h-4" />
              </button>
            )}
          </div>

          {botState.message && (
            <p className="mt-3 text-xs text-muted font-mono truncate">{botState.message}</p>
          )}
        </div>
      </div>

      {/* Middle column — step progress */}
      <div className="lg:col-span-1 space-y-5">
        <div className="card h-full min-h-[400px]">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Bot Progress</h2>
            {isRunning && (
              <span className="ml-auto text-xs font-mono text-accent animate-pulse">LIVE</span>
            )}
          </div>
          <StepProgress currentStep={botState.step} status={botState.status} />

          {botState.status === 'error' && (
            <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20">
              <p className="text-xs text-danger font-mono">{botState.error}</p>
            </div>
          )}

          {botState.status === 'done' && (
            <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20 text-center">
              <p className="text-success font-semibold">Ticket Secured!</p>
              <p className="text-xs text-muted mt-1">Check the result panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Right column — live logs */}
      <div className="lg:col-span-1">
        <LogTerminal logs={logs} onClear={ws.clearLogs} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, truncate }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
      <span
        className={clsx(
          'text-sm text-white',
          mono && 'font-mono',
          truncate && 'truncate'
        )}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}
