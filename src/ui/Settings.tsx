import { Monitor, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import type { House, Settings, ThemeChoice } from '../game/storage';
import { fx } from './fx';
import { PRESS_SCALE, spring } from './motion';
import { Sheet } from './Sheet';

export const HOUSES: { id: House; name: string; colour: string }[] = [
  { id: 'dragon', name: 'Dragon', colour: 'violet' },
  { id: 'eagle', name: 'Eagle', colour: 'crimson' },
  { id: 'scorpion', name: 'Scorpion', colour: 'gold' },
  { id: 'boar', name: 'Boar', colour: 'forest' },
  { id: 'dolphin', name: 'Dolphin', colour: 'teal' },
];

const THEMES: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { id: 'auto', label: 'Auto', Icon: Monitor },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

export function HousePicker({ value, onChange }: { value: House; onChange: (h: House) => void }) {
  return (
    <div className="house-picker" role="radiogroup" aria-label="House">
      {HOUSES.map((h) => (
        <motion.button
          key={h.id}
          type="button"
          role="radio"
          aria-checked={value === h.id}
          className="house"
          data-swatch={h.id}
          onClick={() => {
            if (h.id !== value) fx('select');
            onChange(h.id);
          }}
          whileTap={{ scale: 0.9 }}
          transition={spring.bouncy}
        >
          <span className="house-swatch">
            {value === h.id && <motion.span layoutId="house-ring" className="house-ring" transition={spring.bouncy} />}
          </span>
          <span className="house-name">{h.name}</span>
        </motion.button>
      ))}
    </div>
  );
}

function ThemePicker({ value, onChange }: { value: ThemeChoice; onChange: (t: ThemeChoice) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Appearance">
      {THEMES.map(({ id, label, Icon }) => (
        <motion.button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => {
            if (id !== value) fx('select');
            onChange(id);
          }}
          whileTap={{ scale: PRESS_SCALE }}
          transition={spring.snappy}
        >
          {value === id && <motion.span layoutId="theme-pill" className="segmented-pill" transition={spring.snappy} />}
          <span className="segmented-label">
            <Icon size={15} aria-hidden />
            {label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}>
      <motion.span className="switch-knob" layout transition={spring.bouncy} />
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

export function SettingsSheet({ open, onClose, settings, onChange }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="settings">
        <div className="setting">
          <h3 className="setting-label">House</h3>
          <HousePicker value={settings.house} onChange={(house) => onChange({ house })} />
        </div>
        <div className="setting">
          <h3 className="setting-label">Appearance</h3>
          <ThemePicker value={settings.theme} onChange={(theme) => onChange({ theme })} />
        </div>
        <div className="setting setting-row">
          <h3 className="setting-label">Sound</h3>
          <Switch
            on={settings.sound}
            label="Sound"
            onChange={(sound) => {
              onChange({ sound });
              // Play the confirmation after enabling, so turning sound on is audible.
              if (sound) queueMicrotask(() => fx('select'));
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}
