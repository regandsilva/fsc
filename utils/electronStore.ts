// Helper for accessing Electron store from renderer process
// Falls back to localStorage if not in Electron environment

export const isElectron = () => {
  return typeof window !== 'undefined' && window.electron?.isElectron;
};

export const electronStore = {
  async getSettings() {
    if (isElectron()) {
      return await window.electron.getSettings();
    } else {
      // Fallback to localStorage for web version
      const settings = localStorage.getItem('fsc-settings');
      return settings ? JSON.parse(settings) : null;
    }
  },

  async saveSettings(settings: any) {
    if (isElectron()) {
      return await window.electron.saveSettings(settings);
    } else {
      localStorage.setItem('fsc-settings', JSON.stringify(settings));
      return { success: true };
    }
  },

  async getSetting(key: string) {
    if (isElectron()) {
      return await window.electron.getSetting(key);
    } else {
      const settings = localStorage.getItem('fsc-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return parsed[key];
      }
      return null;
    }
  },

  async setSetting(key: string, value: any) {
    if (isElectron()) {
      return await window.electron.setSetting(key, value);
    } else {
      const settings = localStorage.getItem('fsc-settings');
      const parsed = settings ? JSON.parse(settings) : {};
      parsed[key] = value;
      localStorage.setItem('fsc-settings', JSON.stringify(parsed));
      return { success: true };
    }
  },

  async clearSettings() {
    if (isElectron()) {
      return await window.electron.clearSettings();
    } else {
      localStorage.removeItem('fsc-settings');
      return { success: true };
    }
  },
};
