import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'cyan' | 'purple' | 'green' | 'orange' | 'pink' | 'blue';

export interface SettingsProfile {
  id: string;
  name: string;
  theme: ThemeMode;
  accentColor: AccentColor;
  fontSize: 'small' | 'medium' | 'large';
  createdAt: Date;
}

interface SettingsState {
  // Appearance
  theme: ThemeMode;
  accentColor: AccentColor;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
  
  // AI Settings
  temperature: number;
  maxTokens: number;
  topP: number;
  
  // Smart Router
  smartRouter: boolean;
  routingRules: {
    id: string;
    condition: string;
    provider: string;
    enabled: boolean;
  }[];
  
  // Profiles
  profiles: SettingsProfile[];
  
  // Actions
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  setTopP: (topP: number) => void;
  setSmartRouter: (enabled: boolean) => void;
  addProfile: (profile: Omit<SettingsProfile, 'id' | 'createdAt'>) => string;
  deleteProfile: (id: string) => void;
  applyProfile: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      accentColor: 'cyan',
      fontSize: 'medium',
      highContrast: false,
      reducedMotion: false,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      smartRouter: false,
      routingRules: [
        { id: '1', condition: 'code', provider: 'local-ollama', enabled: true },
        { id: '2', condition: 'long context', provider: 'cloud-gemini', enabled: true },
      ],
      profiles: [],

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.remove('dark', 'light');
        if (theme === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.add(isDark ? 'dark' : 'light');
        } else {
          document.documentElement.classList.add(theme);
        }
      },

      setAccentColor: (accentColor) => {
        set({ accentColor });
        document.documentElement.setAttribute('data-accent', accentColor);
      },

      setFontSize: (fontSize) => {
        set({ fontSize });
        const sizes = { small: '14px', medium: '16px', large: '18px' };
        document.documentElement.style.fontSize = sizes[fontSize];
      },

      setHighContrast: (highContrast) => {
        set({ highContrast });
        document.documentElement.classList.toggle('high-contrast', highContrast);
      },

      setReducedMotion: (reducedMotion) => {
        set({ reducedMotion });
        document.documentElement.classList.toggle('reduced-motion', reducedMotion);
      },

      setTemperature: (temperature) => set({ temperature }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      setTopP: (topP) => set({ topP }),
      setSmartRouter: (smartRouter) => set({ smartRouter }),

      addProfile: (profile) => {
        const id = crypto.randomUUID();
        set((state) => ({
          profiles: [...state.profiles, { ...profile, id, createdAt: new Date() }],
        }));
        return id;
      },

      deleteProfile: (id) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
        })),

      applyProfile: (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (profile) {
          get().setTheme(profile.theme);
          get().setAccentColor(profile.accentColor);
          get().setFontSize(profile.fontSize);
        }
      },
    }),
    {
      name: 'ai-command-settings',
    }
  )
);
