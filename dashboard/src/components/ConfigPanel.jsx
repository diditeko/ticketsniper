import { useState, useEffect } from 'react';
import { Save, RotateCcw, Settings } from 'lucide-react';
import { fetchConfig, saveConfig } from '../hooks/useApi';

const FIELDS = [
  {
    section: 'Target Event',
    fields: [
      { key: 'TIKET_URL', label: 'Event URL', placeholder: 'https://www.tiket.com/konser/...', type: 'url' },
      { key: 'TIKET_SALE_DATE', label: 'Sale Date', placeholder: '2026-05-10', type: 'date' },
      { key: 'TIKET_SALE_TIME', label: 'Sale Time (WIB)', placeholder: '10:00:00', type: 'time' },
    ],
  },
  {
    section: 'Ticket Preferences',
    fields: [
      { key: 'TIKET_CATEGORY', label: 'Category', placeholder: 'CAT 1A' },
      { key: 'TIKET_CATEGORY_FALLBACK', label: 'Fallback Category', placeholder: 'CAT 2' },
      { key: 'TIKET_QTY', label: 'Quantity', placeholder: '2', type: 'number' },
    ],
  },
  {
    section: 'Timing',
    fields: [
      { key: 'PRELOAD_SECONDS', label: 'Preload Seconds', placeholder: '15', type: 'number', hint: 'Open page N seconds before sale' },
      { key: 'POLL_INTERVAL_MS', label: 'Poll Interval (ms)', placeholder: '50', type: 'number', hint: 'How often to check buy button' },
    ],
  },
  {
    section: 'Payment & Browser',
    fields: [
      {
        key: 'PAYMENT_METHOD',
        label: 'Payment Method',
        type: 'select',
        options: ['mandiri_va', 'bca_va', 'bni_va', 'bri_va', 'gopay', 'ovo', 'cc'],
      },
      {
        key: 'HEADLESS',
        label: 'Headless Mode',
        type: 'select',
        options: ['false', 'true'],
        hint: 'false = visible browser (recommended)',
      },
    ],
  },
];

export default function ConfigPanel() {
  const [config, setConfig] = useState({});
  const [original, setOriginal] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfig().then((cfg) => {
      setConfig(cfg);
      setOriginal(cfg);
    });
  }, []);

  function handleChange(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    await saveConfig(config);
    setOriginal(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    setConfig(original);
    setSaved(false);
  }

  const isDirty = JSON.stringify(config) !== JSON.stringify(original);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-semibold text-white">Configuration</h1>
        <span className="ml-auto text-xs text-muted font-mono">Saved to .env</span>
      </div>

      {FIELDS.map(({ section, fields }) => (
        <div key={section} className="card space-y-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">{section}</h3>
          {fields.map(({ key, label, placeholder, type, hint, options }) => (
            <div key={key}>
              <label className="label">{label}</label>
              {type === 'select' ? (
                <select
                  value={config[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="input-field"
                >
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={type || 'text'}
                  value={config[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="input-field"
                />
              )}
              {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
            </div>
          ))}
        </div>
      ))}

      <div className="flex gap-3 sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`btn-primary flex items-center gap-2 ${saved ? 'bg-success' : ''}`}
        >
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : 'Save Config'}
        </button>
        <button onClick={handleReset} disabled={!isDirty} className="btn-ghost flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>
    </div>
  );
}
