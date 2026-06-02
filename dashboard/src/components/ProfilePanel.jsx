import { useState, useEffect } from 'react';
import { Save, User, Users, CreditCard, Plus, Trash2 } from 'lucide-react';
import { fetchProfile, saveProfile } from '../hooks/useApi';

const TITLES = ['Tuan', 'Nyonya', 'Nona'];
const PAYMENT_METHODS = ['mandiri_va', 'bca_va', 'bni_va', 'bri_va', 'gopay', 'ovo', 'cc'];

const DEFAULT_VISITOR = {
  same_as_pemesan: true,
  title: 'Tuan',
  nama: '',
  phone: '',
  email: '',
  ktp: '',
};

const DEFAULT_PROFILE = {
  pemesan: { title: 'Tuan', nama: '', phone: '', email: '', negara: 'Indonesia' },
  pengunjung: [{ ...DEFAULT_VISITOR }],
  payment: { method: 'mandiri_va' },
};

// Handle old single-object format, corrupted numeric-key format, and new array format
function normalizeVisitors(raw) {
  if (!raw) return [{ ...DEFAULT_VISITOR }];
  if (Array.isArray(raw)) return raw.length > 0 ? raw : [{ ...DEFAULT_VISITOR }];

  // Corrupted: { "0": {...}, "1": {...}, same_as_pemesan: true }
  const numericKeys = Object.keys(raw).filter((k) => !isNaN(Number(k)));
  if (numericKeys.length > 0) {
    return numericKeys
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k]);
  }

  // Old single-object format: { same_as_pemesan, title, nama, ... }
  return [raw];
}

function VisitorCard({ visitor, index, total, onUpdate, onRemove }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/30 rounded px-1.5 py-0.5 font-mono">
            #{index + 1}
          </span>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Pengunjung {index + 1}
          </h3>
          {visitor.sama_as_pemesan && (
            <span className="text-xs text-muted italic">(copied from pemesan)</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Same as pemesan toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted">Same as pemesan</span>
            <div
              onClick={() => onUpdate('same_as_pemesan', !visitor.same_as_pemesan)}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${
                visitor.same_as_pemesan ? 'bg-accent' : 'bg-border'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  visitor.same_as_pemesan ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </label>

          {/* Remove button — only show when more than 1 visitor */}
          {total > 1 && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Remove visitor"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!visitor.same_as_pemesan && (
        <>
          <div>
            <label className="label">Title</label>
            <div className="flex gap-2">
              {TITLES.map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdate('title', t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    visitor.title === t
                      ? 'bg-accent/15 text-accent border-accent/40'
                      : 'bg-surface text-muted border-border hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input
                className="input-field"
                value={visitor.nama || ''}
                onChange={(e) => onUpdate('nama', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input-field"
                value={visitor.phone || ''}
                onChange={(e) => onUpdate('phone', e.target.value)}
                placeholder="081234567890"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input-field"
                value={visitor.email || ''}
                onChange={(e) => onUpdate('email', e.target.value)}
                placeholder="email@gmail.com"
                type="email"
              />
            </div>
            <div>
              <label className="label">KTP / NIK (16 digits)</label>
              <input
                className="input-field font-mono"
                value={visitor.ktp || ''}
                onChange={(e) => onUpdate('ktp', e.target.value)}
                placeholder="3271234567890001"
                maxLength={16}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProfilePanel() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [original, setOriginal] = useState(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchProfile().then((p) => {
      if (p && Object.keys(p).length > 0) {
        const normalized = { ...p, pengunjung: normalizeVisitors(p.pengunjung) };
        setProfile(normalized);
        setOriginal(normalized);
      }
    });
  }, []);

  function updatePemesan(key, value) {
    setProfile((prev) => ({ ...prev, pemesan: { ...prev.pemesan, [key]: value } }));
    setSaved(false);
  }

  function updateVisitor(idx, key, value) {
    setProfile((prev) => {
      const visitors = [...prev.pengunjung];
      visitors[idx] = { ...visitors[idx], [key]: value };
      return { ...prev, pengunjung: visitors };
    });
    setSaved(false);
  }

  function addVisitor() {
    setProfile((prev) => ({
      ...prev,
      pengunjung: [...prev.pengunjung, { ...DEFAULT_VISITOR, same_as_pemesan: false }],
    }));
    setSaved(false);
  }

  function removeVisitor(idx) {
    setProfile((prev) => ({
      ...prev,
      pengunjung: prev.pengunjung.filter((_, i) => i !== idx),
    }));
    setSaved(false);
  }

  async function handleSave() {
    await saveProfile(profile);
    setOriginal(JSON.parse(JSON.stringify(profile)));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const isDirty = JSON.stringify(profile) !== JSON.stringify(original);
  const p = profile.pemesan || {};
  const visitors = profile.pengunjung || [];
  const pay = profile.payment || {};

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-semibold text-white">Profile Data</h1>
        <span className="ml-auto text-xs text-muted font-mono">Saved to profile.json</span>
      </div>

      {/* Order contact (pemesan) */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted" />
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Order Contact (Pemesan)</h3>
        </div>

        <div>
          <label className="label">Title</label>
          <div className="flex gap-2">
            {TITLES.map((t) => (
              <button
                key={t}
                onClick={() => updatePemesan('title', t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  p.title === t
                    ? 'bg-accent/15 text-accent border-accent/40'
                    : 'bg-surface text-muted border-border hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <input
              className="input-field"
              value={p.nama || ''}
              onChange={(e) => updatePemesan('nama', e.target.value)}
              placeholder="Andi Saputra"
            />
          </div>
          <div>
            <label className="label">Phone (e.g. 081234567890)</label>
            <input
              className="input-field"
              value={p.phone || ''}
              onChange={(e) => updatePemesan('phone', e.target.value)}
              placeholder="081234567890"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input-field"
              value={p.email || ''}
              onChange={(e) => updatePemesan('email', e.target.value)}
              placeholder="andi@gmail.com"
              type="email"
            />
          </div>
          <div>
            <label className="label">Country</label>
            <input
              className="input-field"
              value={p.negara || ''}
              onChange={(e) => updatePemesan('negara', e.target.value)}
              placeholder="Indonesia"
            />
          </div>
        </div>
      </div>

      {/* Visitor sections — dynamic array */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted" />
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Visitor Details (Pengunjung)
            </h3>
            <span className="text-xs font-mono bg-accent/10 text-accent border border-accent/30 rounded px-1.5 py-0.5">
              {visitors.length}
            </span>
          </div>
          <button
            onClick={addVisitor}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Visitor
          </button>
        </div>

        <p className="text-xs text-muted">
          Add one visitor per ticket. Match the count with <strong className="text-white">Quantity</strong> in Config.
        </p>

        {visitors.map((v, idx) => (
          <VisitorCard
            key={idx}
            visitor={v}
            index={idx}
            total={visitors.length}
            onUpdate={(key, value) => updateVisitor(idx, key, value)}
            onRemove={() => removeVisitor(idx)}
          />
        ))}
      </div>

      {/* Payment method */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted" />
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Payment Method</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              onClick={() =>
                setProfile((prev) => ({ ...prev, payment: { ...prev.payment, method: m } }))
              }
              className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all ${
                pay.method === m
                  ? 'bg-accent/15 text-accent border-accent/40'
                  : 'bg-surface text-muted border-border hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`btn-primary flex items-center gap-2 ${saved ? 'bg-success' : ''}`}
        >
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
