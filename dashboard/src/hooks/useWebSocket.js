import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:3001`;

export function useWebSocket() {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [botState, setBotState] = useState({ status: 'idle', step: null });
  const [countdown, setCountdown] = useState(null);
  const [result, setResult] = useState(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setConnected(true);
        clearTimeout(reconnectTimer.current);
      };

      ws.current.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };

      ws.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleMessage(msg);
        } catch (_) {}
      };
    } catch (_) {
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }, []);

  function handleMessage(msg) {
    switch (msg.type) {
      case 'log':
        setLogs((prev) => [
          ...prev.slice(-499),
          { id: Date.now() + Math.random(), level: msg.level, text: msg.message, ts: msg.ts },
        ]);
        break;

      case 'status':
        setBotState((prev) => ({ ...prev, status: 'running', step: msg.step, message: msg.message }));
        setLogs((prev) => [
          ...prev.slice(-499),
          { id: Date.now() + Math.random(), level: 'STEP', text: msg.message, ts: new Date().toISOString() },
        ]);
        break;

      case 'countdown':
        setCountdown({ remaining: msg.remaining, saleTs: msg.saleTs });
        break;

      case 'queue_status':
        setBotState((prev) => ({
          ...prev,
          queuePosition: msg.position,
          queueEta: msg.eta,
          queueUpdated: msg.lastUpd,
        }));
        break;

      case 'bot_started':
        setBotState({ status: 'running', step: 'init' });
        setLogs([]);
        setResult(null);
        break;

      case 'bot_done':
        setBotState({ status: 'done', step: 'done' });
        setResult(msg.result);
        break;

      case 'bot_error':
        setBotState({ status: 'error', step: 'error', error: msg.message });
        break;

      case 'bot_stopped':
        setBotState({ status: 'idle', step: null });
        break;

      case 'complete':
        setResult(msg);
        break;

      default:
        break;
    }
  }

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const clearLogs = useCallback(() => setLogs([]), []);
  const clearResult = useCallback(() => setResult(null), []);

  return { connected, logs, botState, countdown, result, clearLogs, clearResult };
}
