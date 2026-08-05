'use strict';

(() => {
  const $ = (sel) => document.querySelector(sel);

  const els = {
    convList: $('#conversation-list'),
    btnNewChat: $('#btn-new-chat'),
    btnSettings: $('#btn-settings'),
    btnExport: $('#btn-export'),
    btnImport: $('#btn-import'),
    importFile: $('#import-file'),
    chatTitle: $('#chat-title'),
    providerSelect: $('#provider-select'),
    modelSelect: $('#model-select'),
    messageList: $('#message-list'),
    messageInput: $('#message-input'),
    btnSend: $('#btn-send'),
    btnStop: $('#btn-stop'),
    btnClearChat: $('#btn-clear-chat'),
    composerStatus: $('#composer-status'),
    btnPrompts: $('#btn-prompts'),
    promptPopover: $('#prompt-popover'),
    promptNewText: $('#prompt-new-text'),
    btnPromptSave: $('#btn-prompt-save'),
    promptList: $('#prompt-list'),
    modal: $('#settings-modal'),
    btnCloseSettings: $('#btn-close-settings'),
    providerList: $('#provider-list'),
    btnAddProvider: $('#btn-add-provider'),
    btnDeleteProvider: $('#btn-delete-provider'),
    providerForm: $('#provider-form'),
    formTitle: $('#provider-form-title'),
    pName: $('#p-name'),
    pType: $('#p-type'),
    pBaseUrl: $('#p-base-url'),
    pApiKey: $('#p-api-key'),
    pModels: $('#p-models'),
    proxyUrl: $('#proxy-url'),
    toast: $('#toast'),
  };

  const state = {
    settings: Store.loadSettings(),
    conversations: Store.loadConversations(),
    activeId: Store.getActiveId(),
    activeModel: '',
    editingProviderId: null,
    abortController: null,
    streaming: false,
    prompts: Store.loadPrompts(),
  };

  const STREAM_TIMEOUT_MS = 90000;

  // ---------- utils ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function showToast(msg, isError = false, ms = 2500) {
    els.toast.textContent = msg;
    els.toast.classList.toggle('error', isError);
    els.toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.add('hidden'), ms);
  }

  function getActiveProvider() {
    return state.settings.providers.find((p) => p.id === state.settings.activeProviderId) || null;
  }

  function getConversation() {
    return state.conversations.find((c) => c.id === state.activeId) || null;
  }

  function persist() {
    Store.saveConversations(state.conversations);
  }

  function setStatus(text) {
    els.composerStatus.textContent = text || '';
  }

  // ---------- rendering ----------
  function renderConversationList() {
    els.convList.innerHTML = '';
    if (!state.conversations.length) {
      const div = document.createElement('div');
      div.className = 'empty-state';
      div.innerHTML = '<p>暂无对话，点击"新建对话"开始</p>';
      div.style.padding = '24px 8px';
      els.convList.appendChild(div);
      return;
    }
    state.conversations.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'conversation-item' + (c.id === state.activeId ? ' active' : '');
      item.dataset.id = c.id;

      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = c.title || '未命名对话';

      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.title = '删除对话';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('确定删除该对话？此操作不可恢复。')) removeConversation(c.id);
      });

      item.appendChild(title);
      item.appendChild(del);
      item.addEventListener('click', () => selectConversation(c.id));
      els.convList.appendChild(item);
    });
  }

  function renderProviderSelects() {
    const providers = state.settings.providers;
    els.providerSelect.innerHTML = '';
    if (!providers.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '未配置厂商';
      els.providerSelect.appendChild(opt);
      els.providerSelect.disabled = true;
    } else {
      providers.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        els.providerSelect.appendChild(opt);
      });
      const active = getActiveProvider();
      els.providerSelect.value = active ? active.id : providers[0].id;
      if (!active && state.settings.activeProviderId !== providers[0].id) {
        state.settings.activeProviderId = providers[0].id;
        Store.saveSettings(state.settings);
      }
      els.providerSelect.disabled = false;
    }
    renderModelSelect();
  }

  function renderModelSelect() {
    const provider = getActiveProvider();
    els.modelSelect.innerHTML = '';
    if (!provider) {
      els.modelSelect.disabled = true;
      return;
    }
    const models = (provider.models || '').split(',').map((m) => m.trim()).filter(Boolean);
    if (!models.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '请在设置中配置模型';
      els.modelSelect.appendChild(opt);
      els.modelSelect.disabled = true;
      return;
    }
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      els.modelSelect.appendChild(opt);
    });
    if (!models.includes(state.activeModel)) {
      state.activeModel = models[0];
    }
    els.modelSelect.value = state.activeModel;
    els.modelSelect.disabled = false;
  }

  function renderMessageList() {
    const conv = getConversation();
    els.messageList.innerHTML = '';
    if (!conv || !conv.messages.length) {
      const div = document.createElement('div');
      div.className = 'empty-state';
      div.innerHTML = '<div class="icon">💬</div><p>选择左侧对话，或在下方输入消息开始聊天。</p>';
      els.messageList.appendChild(div);
      return;
    }
    conv.messages.forEach((m) => appendMessageNode(m, false));
    els.messageList.scrollTop = els.messageList.scrollHeight;
  }

  function appendMessageNode(msg, isStreaming) {
    const wrap = document.createElement('div');
    wrap.className = 'message ' + (msg.role === 'user' ? 'user' : msg.role === 'error' ? 'error' : 'ai');
    wrap.dataset.mid = msg.id;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = msg.role === 'user' ? '我' : 'AI';

    const col = document.createElement('div');
    col.style.cssText = 'min-width:0;';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = new Date(msg.ts).toLocaleString();
    col.appendChild(meta);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (isStreaming) {
      bubble.textContent = '正在生成…';
      bubble.classList.add('stream-placeholder');
    } else {
      bubble.textContent = msg.content || ' ';
    }
    col.appendChild(bubble);
    wrap.appendChild(col);

    if (msg.role === 'user') {
      wrap.prepend(avatar);
    } else {
      wrap.insertBefore(avatar, col);
    }

    els.messageList.appendChild(wrap);
    let cursor = null;
    if (isStreaming) {
      cursor = document.createElement('span');
      cursor.className = 'cursor';
      bubble.appendChild(cursor);
    }
    els.messageList.scrollTop = els.messageList.scrollHeight;
    return { bubble, cursor };
  }

  function syncHeader() {
    const conv = getConversation();
    els.chatTitle.value = conv ? conv.title : '';
    els.chatTitle.disabled = !conv;
    els.btnSend.disabled = !conv || state.streaming;
    els.btnClearChat.disabled = !conv || state.streaming;
    renderProviderSelects();
  }

  // ---------- conversations ----------
  function createConversation() {
    const conv = {
      id: uid(),
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    state.conversations.unshift(conv);
    state.activeId = conv.id;
    Store.setActiveId(conv.id);
    persist();
    renderConversationList();
    renderMessageList();
    syncHeader();
    els.messageInput.focus();
  }

  function selectConversation(id) {
    state.activeId = id;
    Store.setActiveId(id);
    renderConversationList();
    renderMessageList();
    syncHeader();
  }

  function removeConversation(id) {
    const idx = state.conversations.findIndex((c) => c.id === id);
    if (idx >= 0) state.conversations.splice(idx, 1);
    if (state.activeId === id) {
      state.activeId = state.conversations[0] ? state.conversations[0].id : null;
      Store.setActiveId(state.activeId);
    }
    persist();
    renderConversationList();
    renderMessageList();
    syncHeader();
  }

  function updateTitleFromFirstMessage(conv) {
    const first = conv.messages.find((m) => m.role === 'user');
    if (first && conv.title === '新对话') {
      const text = first.content.replace(/\s+/g, ' ').trim();
      conv.title = text.length > 20 ? text.slice(0, 20) + '…' : text;
      persist();
      renderConversationList();
    }
  }

  // ---------- send / stream ----------
  function appendMessage(conv, role, content, ts) {
    const msg = { id: uid(), role, content, ts };
    conv.messages.push(msg);
    conv.updatedAt = Date.now();
    persist();
    return msg;
  }

  function updateMessageContent(conv, msg, content) {
    msg.content = content;
    msg.ts = msg.ts || Date.now();
    conv.updatedAt = Date.now();
    persist();
  }

  async function sendMessage() {
    const text = els.messageInput.value.trim();
    if (!text) return;
    if (state.streaming) {
      showToast('正在生成中，请稍候或点击"停止"');
      return;
    }
    const conv = getConversation();
    const provider = getActiveProvider();
    if (!provider) {
      showToast('请先在设置中添加并启用厂商', true);
      openSettings();
      return;
    }
    if (!state.activeModel) {
      showToast('当前厂商未配置模型', true);
      openSettings();
      return;
    }

    appendMessage(conv, 'user', text);
    updateTitleFromFirstMessage(conv);
    renderMessageList();
    els.messageInput.value = '';
    autosizeInput();

    const history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
    const aiMsg = appendMessage(conv, 'assistant', '');
    const node = appendMessageNode(aiMsg, true);

    state.abortController = new AbortController();
    state.streaming = true;
    els.btnSend.disabled = true;
    els.btnStop.hidden = false;
    els.btnStop.disabled = false;
    setStatus(`正在使用 ${provider.name} / ${state.activeModel} 生成…`);

    let acc = '';
    try {
      const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);
      const signal = AbortSignal.any([state.abortController.signal, timeoutSignal]);
      await Api.send(provider, state.activeModel, history, {
        signal,
        onDelta: (delta) => {
          acc += delta;
          if (node.cursor) node.cursor.remove();
          node.bubble.textContent = acc;
          els.messageList.scrollTop = els.messageList.scrollHeight;
          updateMessageContent(conv, aiMsg, acc);
        },
      });
      if (node.cursor) node.cursor.remove();
      if (!acc) aiMsg.content = '(空回复)';
      updateMessageContent(conv, aiMsg, aiMsg.content);
      setStatus('');
    } catch (err) {
      if (node.cursor) node.cursor.remove();
      if (err.name === 'TimeoutError') {
        aiMsg.content = acc || '(请求超时)';
        updateMessageContent(conv, aiMsg, aiMsg.content);
        appendMessage(conv, 'error', `请求超时：${STREAM_TIMEOUT_MS / 1000} 秒内无响应`);
      } else if (err.name === 'AbortError') {
        aiMsg.content = acc || '(已停止)';
        updateMessageContent(conv, aiMsg, aiMsg.content);
        setStatus('已停止生成');
      } else {
        aiMsg.content = acc || '';
        updateMessageContent(conv, aiMsg, aiMsg.content);
        appendMessage(conv, 'error', `请求失败：${err.message}`);
      }
      setStatus('');
    } finally {
      state.streaming = false;
      state.abortController = null;
      els.btnStop.hidden = true;
      els.btnSend.disabled = false;
      els.btnClearChat.disabled = false;
      renderMessageList();
    }
  }

  function stopStream() {
    if (state.abortController) state.abortController.abort();
  }

  function autosizeInput() {
    els.messageInput.style.height = 'auto';
    els.messageInput.style.height = Math.min(els.messageInput.scrollHeight, 160) + 'px';
  }

  // ---------- prompts ----------
  function persistPrompts() {
    Store.savePrompts(state.prompts);
  }

  function renderPrompts() {
    els.promptList.innerHTML = '';
    if (!state.prompts.length) {
      const div = document.createElement('div');
      div.className = 'prompt-empty';
      div.textContent = '还没有预设提示词，在上方输入后保存';
      els.promptList.appendChild(div);
      return;
    }
    state.prompts.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'prompt-item';
      li.title = p.content;

      const span = document.createElement('span');
      span.className = 'prompt-name';
      span.textContent = p.name || p.content;

      const del = document.createElement('button');
      del.className = 'prompt-del';
      del.textContent = '×';
      del.title = '删除';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePrompt(p.id);
      });

      li.appendChild(span);
      li.appendChild(del);
      li.addEventListener('click', () => usePrompt(p.content));
      els.promptList.appendChild(li);
    });
  }

  function togglePrompts() {
    const hidden = els.promptPopover.classList.contains('hidden');
    renderPrompts();
    els.promptPopover.classList.toggle('hidden', !hidden);
    if (!hidden && !els.promptNewText.value.trim()) els.promptNewText.focus();
  }

  function addPrompt() {
    const text = els.promptNewText.value.trim();
    if (!text) return;
    const name = text.split('\n')[0].slice(0, 30);
    state.prompts.push({ id: uid(), name, content: text });
    persistPrompts();
    els.promptNewText.value = '';
    renderPrompts();
    els.promptNewText.focus();
    showToast('已保存提示词');
  }

  function deletePrompt(id) {
    state.prompts = state.prompts.filter((p) => p.id !== id);
    persistPrompts();
    renderPrompts();
  }

  function usePrompt(content) {
    els.messageInput.value = content;
    autosizeInput();
    els.messageInput.focus();
    els.messageInput.setSelectionRange(content.length, content.length);
    closePrompts();
  }

  function closePrompts() {
    els.promptPopover.classList.add('hidden');
  }

  // ---------- settings ----------
  function renderProviderList() {
    els.providerList.innerHTML = '';
    state.settings.providers.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'provider-item' + (p.id === state.editingProviderId ? ' active' : '');
      li.dataset.id = p.id;
      li.innerHTML = `<div class="p-name">${escapeHtml(p.name)}</div>
        <div class="p-sub">${p.type} · ${p.models || '未配置模型'}</div>`;
      li.addEventListener('click', () => editProvider(p.id));
      els.providerList.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function openSettings() {
    state.editingProviderId = null;
    els.modal.classList.remove('hidden');
    els.proxyUrl.value = Store.normalizeProxyUrl(state.settings.proxyUrl || '');
    renderProviderList();
    els.providerForm.reset();
    els.formTitle.textContent = '厂商配置';
    els.btnDeleteProvider.hidden = true;
    resetFormToNew();
  }

  function closeSettings() {
    els.modal.classList.add('hidden');
    renderProviderSelects();
  }

  function resetFormToNew() {
    els.pName.value = '';
    els.pType.value = 'openai';
    els.pBaseUrl.value = '';
    els.pApiKey.value = '';
    els.pModels.value = '';
  }

  function editProvider(id) {
    const p = state.settings.providers.find((x) => x.id === id);
    if (!p) return;
    state.editingProviderId = id;
    els.formTitle.textContent = `厂商配置：${p.name}`;
    els.btnDeleteProvider.hidden = false;
    els.pName.value = p.name;
    els.pType.value = p.type;
    els.pBaseUrl.value = p.baseUrl || '';
    els.pApiKey.value = p.apiKey || '';
    els.pModels.value = (p.models || '').split(',').join(', ');
    renderProviderList();
  }

  function saveProviderFromForm() {
    const name = els.pName.value.trim();
    if (!name) {
      showToast('请填写厂商名称', true);
      return;
    }
    const data = {
      name,
      type: els.pType.value,
      baseUrl: els.pBaseUrl.value.trim(),
      apiKey: els.pApiKey.value.trim(),
      models: els.pModels.value.split(/[,，]/).map((m) => m.trim()).filter(Boolean).join(','),
    };
    if (!data.apiKey) {
      showToast('请填写 API Key', true);
      return;
    }
    if (state.editingProviderId) {
      const idx = state.settings.providers.findIndex((p) => p.id === state.editingProviderId);
      if (idx >= 0) state.settings.providers[idx] = { ...state.settings.providers[idx], ...data };
    } else {
      const p = { id: uid(), ...data };
      state.settings.providers.push(p);
      if (!state.settings.activeProviderId) state.settings.activeProviderId = p.id;
      state.editingProviderId = p.id;
      els.formTitle.textContent = `厂商配置：${p.name}`;
      els.btnDeleteProvider.hidden = false;
    }
    Store.saveSettings(state.settings);
    showToast('已保存');
    renderProviderList();
    renderProviderSelects();
  }

  function deleteProvider(id) {
    if (!confirm('确定删除该厂商配置？')) return;
    const idx = state.settings.providers.findIndex((p) => p.id === id);
    if (idx < 0) return;
    state.settings.providers.splice(idx, 1);
    if (state.settings.activeProviderId === id) {
      state.settings.activeProviderId = state.settings.providers[0] ? state.settings.providers[0].id : null;
    }
    Store.saveSettings(state.settings);
    showToast('已删除');
    state.editingProviderId = null;
    els.formTitle.textContent = '厂商配置';
    els.btnDeleteProvider.hidden = true;
    resetFormToNew();
    renderProviderList();
    renderProviderSelects();
  }

  // ---------- export / import ----------
  function exportData() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    a.download = `aihub-chat-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 100);
    showToast('已导出聊天记录');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Store.importAll(data)) throw new Error('文件格式不正确');
        state.settings = Store.loadSettings();
        state.conversations = Store.loadConversations();
        state.activeId = null;
        state.editingProviderId = null;
        renderConversationList();
        renderMessageList();
        syncHeader();
        renderProviderList();
        renderProviderSelects();
        showToast('导入成功');
      } catch (e) {
        showToast('导入失败：' + e.message, true);
      }
    };
    reader.onerror = () => showToast('读取文件失败', true);
    reader.readAsText(file);
  }

  // ---------- events ----------
  els.btnNewChat.addEventListener('click', () => {
    if (state.streaming) stopStream();
    createConversation();
  });

  els.chatTitle.addEventListener('change', () => {
    const conv = getConversation();
    if (conv) {
      conv.title = els.chatTitle.value.trim() || '未命名对话';
      persist();
      renderConversationList();
    }
  });

  els.providerSelect.addEventListener('change', () => {
    state.settings.activeProviderId = els.providerSelect.value;
    Store.saveSettings(state.settings);
    renderModelSelect();
  });

  els.modelSelect.addEventListener('change', () => {
    state.activeModel = els.modelSelect.value;
  });

  els.btnSend.addEventListener('click', sendMessage);
  els.btnStop.addEventListener('click', stopStream);

  els.btnClearChat.addEventListener('click', () => {
    const conv = getConversation();
    if (!conv) return;
    if (confirm('确定清空当前对话记录？')) {
      conv.messages = [];
      conv.updatedAt = Date.now();
      persist();
      renderMessageList();
    }
  });

  els.btnPrompts.addEventListener('click', togglePrompts);
  els.btnPromptSave.addEventListener('click', addPrompt);
  els.promptNewText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPrompt();
    }
  });
  document.addEventListener('click', (e) => {
    if (!els.promptPopover.classList.contains('hidden') &&
        !els.promptPopover.contains(e.target) &&
        e.target !== els.btnPrompts) {
      closePrompts();
    }
  });

  els.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  els.messageInput.addEventListener('input', autosizeInput);

  els.btnSettings.addEventListener('click', openSettings);
  els.btnCloseSettings.addEventListener('click', closeSettings);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeSettings();
  });

  els.proxyUrl.addEventListener('change', () => {
    state.settings.proxyUrl = Store.normalizeProxyUrl(els.proxyUrl.value);
    els.proxyUrl.value = state.settings.proxyUrl;
    Store.saveSettings(state.settings);
    showToast('代理地址已保存');
  });

  els.btnAddProvider.addEventListener('click', () => {
    state.editingProviderId = null;
    els.formTitle.textContent = '厂商配置';
    els.btnDeleteProvider.hidden = true;
    resetFormToNew();
    renderProviderList();
    els.pName.focus();
  });

  els.providerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveProviderFromForm();
  });

  els.btnDeleteProvider.addEventListener('click', () => {
    if (state.editingProviderId) deleteProvider(state.editingProviderId);
  });

  els.btnExport.addEventListener('click', exportData);

  els.btnImport.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', () => {
    if (els.importFile.files[0]) importData(els.importFile.files[0]);
    els.importFile.value = '';
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      createConversation();
    }
  });

  // ---------- init ----------
  function init() {
    if (!state.conversations.length) {
      createConversation();
    } else {
      if (!state.conversations.some((c) => c.id === state.activeId)) {
        state.activeId = state.conversations[0].id;
      }
      Store.setActiveId(state.activeId);
      renderConversationList();
      renderMessageList();
      syncHeader();
    }
  }

  init();
})();
