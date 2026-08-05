'use strict';

const Store = {
  KEYS: {
    settings: 'aihub.settings',
    conversations: 'aihub.conversations',
    activeId: 'aihub.activeId',
  },

  defaultSettings() {
    return {
      providers: [],
      activeProviderId: null,
      proxyUrl: '',
    };
  },

  loadSettings() {
    try {
      const raw = localStorage.getItem(this.KEYS.settings);
      if (!raw) return this.defaultSettings();
      const data = JSON.parse(raw);
      return {
        providers: Array.isArray(data.providers) ? data.providers : [],
        activeProviderId: data.activeProviderId || null,
        proxyUrl: data.proxyUrl || '',
      };
    } catch (e) {
      console.warn('读取设置失败', e);
      return this.defaultSettings();
    }
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.settings, JSON.stringify(settings));
  },

  loadConversations() {
    try {
      const raw = localStorage.getItem(this.KEYS.conversations);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('读取对话记录失败', e);
      return [];
    }
  },

  saveConversations(conversations) {
    localStorage.setItem(this.KEYS.conversations, JSON.stringify(conversations));
  },

  getActiveId() {
    return localStorage.getItem(this.KEYS.activeId);
  },

  setActiveId(id) {
    if (id) localStorage.setItem(this.KEYS.activeId, id);
    else localStorage.removeItem(this.KEYS.activeId);
  },

  normalizeProxyUrl(url) {
    let s = (url || '').trim().replace(/\/+$/, '');
    if (!s) return '';
    if (!/\/api\/proxy$/i.test(s)) s += '/api/proxy';
    return s;
  },

  exportAll() {
    return {
      app: 'aihub-chat',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.loadSettings(),
      conversations: this.loadConversations(),
    };
  },

  importAll(data) {
    if (!data || !data.conversations) return false;
    if (Array.isArray(data.settings)) data.settings = this.defaultSettings();
    const settings = data.settings || this.defaultSettings();
    this.saveSettings(settings);
    this.saveConversations(data.conversations);
    this.setActiveId(null);
    return true;
  },
};
