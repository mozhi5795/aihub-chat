'use strict';

const Api = (() => {
  const DEFAULT_BASE = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
  };

  function providerName(p) {
    return p ? p.name : '未配置';
  }

  function baseUrl(p) {
    return (p.baseUrl && p.baseUrl.trim()) || DEFAULT_BASE[p.type] || DEFAULT_BASE.openai;
  }

  function buildMessages(history) {
    return history
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function send(provider, model, history, { onDelta, signal }) {
    const url = baseUrl(provider).replace(/\/+$/, '');
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };

    let body;
    let requestUrl;

    if (provider.type === 'anthropic') {
      headers['x-api-key'] = provider.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      requestUrl = `${url}/v1/messages`;
      const messages = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
      body = JSON.stringify({
        model,
        max_tokens: 4096,
        messages,
        stream: true,
      });
    } else if (provider.type === 'gemini') {
      const key = encodeURIComponent(provider.apiKey || '');
      const messages = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const system = history.find((m) => m.role === 'system');
      requestUrl = `${url}/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
      body = JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system.content }] } : undefined,
        contents: messages,
      });
    } else {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
      requestUrl = `${url}/chat/completions`;
      const messages = buildMessages(history);
      body = JSON.stringify({ model, messages, stream: true });
    }

    const resp = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    if (!resp.ok) {
      let detail = '';
      try {
        const text = await resp.text();
        detail = text.slice(0, 500);
      } catch (e) { /* ignore */ }
      const err = new Error(`HTTP ${resp.status}${detail ? `: ${detail}` : ''}`);
      err.status = resp.status;
      throw err;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          continue;
        }
        const delta = extractDelta(provider.type, parsed);
        if (delta && onDelta) onDelta(delta);
      }
    }
  }

  function extractDelta(type, parsed) {
    if (type === 'anthropic') {
      if (parsed.type === 'content_block_delta' && parsed.delta && typeof parsed.delta.text === 'string') {
        return parsed.delta.text;
      }
      return null;
    }
    if (type === 'gemini') {
      if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
        const parts = parsed.candidates[0].content.parts || [];
        return parts.map((p) => p.text || '').join('');
      }
      return null;
    }
    const choice = parsed.choices && parsed.choices[0];
    if (choice && choice.delta && typeof choice.delta.content === 'string') {
      return choice.delta.content;
    }
    if (choice && typeof choice.text === 'string') return choice.text;
    return null;
  }

  async function testConnection(provider) {
    const model = 'test-model';
    let url, headers, body;
    const base = baseUrl(provider).replace(/\/+$/, '');
    if (provider.type === 'anthropic') {
      url = `${base}/v1/messages`;
      headers = {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
    } else if (provider.type === 'gemini') {
      const key = encodeURIComponent(provider.apiKey || '');
      url = `${base}/models/${model}?key=${key}`;
      headers = {};
      body = null;
    } else {
      url = `${base}/models`;
      headers = { Authorization: `Bearer ${provider.apiKey}` };
      body = null;
    }
    const resp = await fetch(url, { method: body ? 'POST' : 'GET', headers, body });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return true;
  }

  return { send, testConnection, providerName, DEFAULT_BASE };
})();
