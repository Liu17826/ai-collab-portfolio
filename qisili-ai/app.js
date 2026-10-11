// 齐司礼 AI · 纯前端 · DeepSeek 驱动 · 真人节奏版
// 数据全部存 localStorage，无后端

(() => {
  'use strict';

  // ============ 存储 ============
  const STORAGE_KEY = 'qisili_chats_v3';
  const SETTINGS_KEY = 'qisili_settings_v3';

  const Settings = {
    load() {
      try {
        return Object.assign(
          { apiKey: '', userName: '', model: 'deepseek-chat', temperature: 0.7, typeSpeed: 45, autoMemory: false },
          JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
        );
      } catch {
        return { apiKey: '', userName: '', model: 'deepseek-chat', temperature: 0.7, typeSpeed: 45, autoMemory: false };
      }
    },
    save(s) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    },
    clear() {
      localStorage.removeItem(SETTINGS_KEY);
    },
  };

  const Store = {
    chats: [],
    currentId: null,

    load() {
      try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        this.chats = Array.isArray(data.chats) ? data.chats : [];
        this.currentId = data.currentId || null;
        if (this.currentId && !this.chats.find(c => c.id === this.currentId)) {
          this.currentId = null;
        }
      } catch {
        this.chats = [];
        this.currentId = null;
      }
    },

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        chats: this.chats,
        currentId: this.currentId,
      }));
    },

    current() {
      return this.chats.find(c => c.id === this.currentId) || null;
    },

    create() {
      const id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const chat = {
        id,
        title: '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.chats.unshift(chat);
      this.currentId = id;
      this.save();
      return chat;
    },

    remove(id) {
      this.chats = this.chats.filter(c => c.id !== id);
      if (this.currentId === id) {
        this.currentId = this.chats[0]?.id || null;
      }
      this.save();
    },

    clearAll() {
      this.chats = [];
      this.currentId = null;
      this.save();
    },

    // 彻底重置：清对话 + 清 settings（含 apiKey）+ 清 memory
    resetAll() {
      this.chats = [];
      this.currentId = null;
      this.save();
      Settings.clear();
      if (window.Memory && typeof window.Memory.reset === 'function') {
        window.Memory.reset();
      }
    },

    addMessage(role, content) {
      const chat = this.current();
      if (!chat) return null;
      const msg = { role, content, ts: Date.now() };
      chat.messages.push(msg);
      chat.updatedAt = Date.now();
      if (chat.title === '新对话' && role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
        chat.title = content.slice(0, 20) + (content.length > 20 ? '…' : '');
      }
      this.save();
      return msg;
    },

    updateLastMessage(content) {
      const chat = this.current();
      if (!chat || !chat.messages.length) return;
      chat.messages[chat.messages.length - 1].content = content;
      chat.updatedAt = Date.now();
      this.save();
    },
  };

  // ============ DOM ============
  const $ = (id) => document.getElementById(id);
  const messagesEl = $('messages');
  const emptyEl = $('emptyState');
  const inputEl = $('input');
  const sendBtn = $('sendBtn');
  const stopBtn = $('stopBtn');
  const drawerEl = $('drawer');
  const drawerMask = $('drawerMask');
  const drawerBtn = $('drawerBtn');
  const chatListEl = $('chatList');
  const newChatBtn = $('newChatBtn');
  const settingsBtn = $('settingsBtn');
  const settingsPanel = $('settingsPanel');
  const closeSettingsBtn = $('closeSettingsBtn');
  const apiKeyInput = $('apiKey');
  const userNameInput = $('userName');
  const modelSelect = $('modelSelect');
  const temperatureInput = $('temperature');
  const tempVal = $('tempVal');
  const typeSpeedInput = $('typeSpeed');
  const typeSpeedVal = $('typeSpeedVal');
  const autoMemoryInput = $('autoMemory');
  const clearAllBtn = $('clearAllBtn');
  const attachBtn = $('attachBtn');
  const fileInput = $('fileInput');
  const attachmentChip = $('attachmentChip');

  // 记忆面板
  const memoryBtn = $('memoryBtn');
  const memoryPanel = $('memoryPanel');
  const closeMemoryBtn = $('closeMemoryBtn');
  const clearMemoryBtn = $('clearMemoryBtn');

  let isGenerating = false;
  let abortController = null;
  let pendingAttachment = null; // { name, type, summary }

  // 打字机状态
  let typeBuffer = '';      // 还没显示出来的待显示文本
  let typeDisplayed = '';   // 已显示的文本
  let typeTimer = null;
  let isThinking = false;   // 是否在"思考中"（首个 token 到达前）

  // ============ 工具 ============
  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // ============ 渲染 ============
  function renderChatList() {
    if (!Store.chats.length) {
      chatListEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light);font-size:13px;letter-spacing:1px;">还没有对话</div>';
      return;
    }
    chatListEl.innerHTML = Store.chats.map(c => `
      <div class="chat-item ${c.id === Store.currentId ? 'active' : ''}" data-id="${c.id}">
        <div class="chat-item-info">
          <div class="chat-item-title">${escapeHtml(c.title || '新对话')}</div>
          <div class="chat-item-time">${new Date(c.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <button class="chat-item-del" data-del="${c.id}" aria-label="删除">×</button>
      </div>
    `).join('');

    chatListEl.querySelectorAll('.chat-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]')) return;
        Store.currentId = el.dataset.id;
        Store.save();
        renderAll();
        closeDrawer();
      });
    });

    chatListEl.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('删除这条对话？')) {
          Store.remove(btn.dataset.del);
          renderAll();
        }
      });
    });
  }

  function renderMessages() {
    const chat = Store.current();
    if (!chat || !chat.messages.length) {
      messagesEl.innerHTML = '';
      messagesEl.appendChild(emptyEl);
      return;
    }

    let html = '';
    let lastDate = '';
    chat.messages.forEach(m => {
      const date = new Date(m.ts).toLocaleDateString('zh-CN');
      if (date !== lastDate) {
        html += `<div class="time-sep">${formatTime(m.ts)}</div>`;
        lastDate = date;
      }
      html += renderMsg(m);
    });
    messagesEl.innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMsg(m) {
    const isUser = m.role === 'user';
    const cls = isUser ? 'user' : 'bot';
    return `
      <div class="msg ${cls}">
        <div class="msg-content">${escapeHtml(m.content)}</div>
      </div>
    `;
  }

  function appendMessage(role, content) {
    if (emptyEl.parentNode === messagesEl) {
      emptyEl.remove();
    }
    if (messagesEl.children.length > 0) {
      const lastMsg = Store.current()?.messages[Store.current().messages.length - 2];
      if (!lastMsg || (Date.now() - lastMsg.ts) > 5 * 60 * 1000) {
        const sep = document.createElement('div');
        sep.className = 'time-sep';
        sep.textContent = formatTime(Date.now());
        messagesEl.appendChild(sep);
      }
    }

    const msgEl = document.createElement('div');
    const cls = role === 'user' ? 'user' : 'bot';
    msgEl.className = `msg ${cls}`;
    msgEl.innerHTML = renderMsg({ role, content });
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msgEl;
  }

  function renderAll() {
    renderChatList();
    renderMessages();
  }

  // ============ 打字机（核心：让回复像真人在敲字） ============
  function startTyping() {
    if (typeTimer) return;
    const baseDelay = Number(Settings.load().typeSpeed) || 45; // ms/字
    typeTimer = setInterval(() => {
      if (typeBuffer.length === 0) {
        clearInterval(typeTimer);
        typeTimer = null;
        return;
      }
      // 一次吐 1\~2 个字符（避免拖沓）
      const chunkSize = Math.random() < 0.7 ? 1 : 2;
      const piece = typeBuffer.slice(0, chunkSize);
      typeBuffer = typeBuffer.slice(chunkSize);
      typeDisplayed += piece;
      updateLastBubble(typeDisplayed);
      Store.updateLastMessage(typeDisplayed);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, baseDelay + Math.random() * 20);
  }

  function feedTyping(text) {
    if (!text) return;
    // 首个 token 到达：把"思考中"换成空，开始打字
    if (isThinking) {
      isThinking = false;
      typeDisplayed = '';
      updateLastBubble('');
    }
    typeBuffer += text;
    startTyping();
  }

  function finishTyping() {
    // 流式结束，但保留 queue 让其继续打完
  }

  function flushTyping() {
    // 立即把剩余 buffer 全显示（停止时用）
    if (typeBuffer) {
      typeDisplayed += typeBuffer;
      typeBuffer = '';
      updateLastBubble(typeDisplayed);
      Store.updateLastMessage(typeDisplayed);
    }
    if (typeTimer) {
      clearInterval(typeTimer);
      typeTimer = null;
    }
    isThinking = false;
  }

  function updateLastBubble(content) {
    const bubbles = messagesEl.querySelectorAll('.msg .msg-content');
    const last = bubbles[bubbles.length - 1];
    if (!last) return;
    if (content === '' && isThinking) {
      last.innerHTML = '<span class="thinking"><span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span></span>';
    } else {
      last.innerHTML = escapeHtml(content);
    }
  }

  // ============ 抽屉 ============
  function openDrawer() {
    drawerEl.classList.add('open');
    drawerMask.classList.add('show');
  }
  function closeDrawer() {
    drawerEl.classList.remove('open');
    drawerMask.classList.remove('show');
  }
  drawerBtn.addEventListener('click', openDrawer);
  drawerMask.addEventListener('click', closeDrawer);

  // ============ 设置 ============
  function openSettings() {
    const s = Settings.load();
    apiKeyInput.value = s.apiKey;
    userNameInput.value = s.userName;
    modelSelect.value = s.model;
    temperatureInput.value = s.temperature;
    typeSpeedInput.value = s.typeSpeed;
    typeSpeedVal.textContent = formatTypeSpeed(s.typeSpeed);
    if (autoMemoryInput) autoMemoryInput.checked = !!s.autoMemory;
    settingsPanel.hidden = false;
  }
  function closeSettings() {
    settingsPanel.hidden = true;
  }
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) closeSettings();
  });

  function formatTemp(t) {
    t = Number(t);
    if (t <= 0.3) return `${t.toFixed(1)} · 极冷（减少幻觉）`;
    if (t <= 0.5) return `${t.toFixed(1)} · 冷淡克制`;
    if (t <= 0.8) return `${t.toFixed(1)} · 稳定平衡（推荐）`;
    if (t <= 1.0) return `${t.toFixed(1)} · 自然灵活`;
    if (t <= 1.5) return `${t.toFixed(1)} · 偏高，更灵动`;
    return `${t.toFixed(1)} · 自由发挥（容易跑偏）`;
  }

  function formatTypeSpeed(s) {
    s = Number(s);
    if (s <= 25) return `${s}ms · 极快（爽）`;
    if (s <= 50) return `${s}ms · 真人格（推荐）`;
    if (s <= 80) return `${s}ms · 慢节奏`;
    return `${s}ms · 慢悠悠`;
  }

  temperatureInput.addEventListener('input', () => {
    tempVal.textContent = formatTemp(temperatureInput.value);
  });
  typeSpeedInput.addEventListener('input', () => {
    typeSpeedVal.textContent = formatTypeSpeed(typeSpeedInput.value);
  });

  [apiKeyInput, userNameInput, modelSelect, temperatureInput, typeSpeedInput, autoMemoryInput].forEach(el => {
    if (!el) return;
    el.addEventListener('change', saveSettings);
    el.addEventListener('blur', saveSettings);
  });
  function saveSettings() {
    const s = Settings.load();
    s.apiKey = apiKeyInput.value.trim();
    s.userName = userNameInput.value.trim();
    s.model = modelSelect.value;
    s.temperature = Number(temperatureInput.value);
    s.typeSpeed = Number(typeSpeedInput.value);
    s.autoMemory = !!(autoMemoryInput && autoMemoryInput.checked);
    Settings.save(s);
  }

  clearAllBtn.addEventListener('click', () => {
    // 第一次确认
    if (!confirm('确定要重置全部数据吗？\n\n将清空：\n• 所有对话记录\n• API Key\n• 记忆数据\n\n此操作不可恢复。')) return;
    // 第二次确认（清 apiKey 是敏感操作）
    if (!confirm('⚠️ 再次确认：API Key 也会被清空，确定继续？')) return;

    Store.resetAll();
    renderAll();
    // 刷新表单显示，让用户看到 apiKey 真的被清空了
    if (typeof loadSettingsToForm === 'function') loadSettingsToForm();
    if (typeof renderMemoryPanel === 'function') renderMemoryPanel();
    toast('已全部清空');
  });

  // ============ 记忆面板 ============
  function openMemory() {
    // 加载当前数据到表单
    const m = window.Memory.get();
    document.querySelectorAll('.memory-input').forEach(input => {
      const path = input.dataset.path;
      if (!path) return;
      const [section, key] = path.split('.');
      input.value = (m[section] && m[section][key]) || '';
    });
    memoryPanel.hidden = false;
  }
  function closeMemory() {
    // 关闭前保存
    saveMemoryFromUI();
    memoryPanel.hidden = true;
  }
  function saveMemoryFromUI() {
    const m = window.Memory.get();
    document.querySelectorAll('.memory-input').forEach(input => {
      const path = input.dataset.path;
      if (!path) return;
      const [section, key] = path.split('.');
      if (!m[section]) m[section] = {};
      m[section][key] = input.value;
    });
    window.Memory.save(m);
  }

  memoryBtn.addEventListener('click', openMemory);
  closeMemoryBtn.addEventListener('click', closeMemory);
  memoryPanel.addEventListener('click', (e) => {
    if (e.target === memoryPanel) closeMemory();
  });
  // 实时保存
  document.querySelectorAll('.memory-input').forEach(input => {
    input.addEventListener('change', saveMemoryFromUI);
    input.addEventListener('blur', saveMemoryFromUI);
  });
  clearMemoryBtn.addEventListener('click', () => {
    if (confirm('确定清空所有记忆？')) {
      window.Memory.reset();
      openMemory(); // 重新加载空表单
      toast('已清空');
    }
  });

  // ============ 文件上传（图片 / txt / pdf / docx） ============
  // 流程：用户选择文件 → 解析 → 生成摘要 → 显示附件条 → 发送时拼进用户消息
  // 硬规则：解析失败/无法读取时，摘要必须如实写"未能读取"，不能让 AI 誤以为"已读完"
  const MAX_SUMMARY_CHARS = 3000;

  function truncateSummary(t) {
    if (!t) return '（内容为空）';
    t = t.trim();
    if (t.length > MAX_SUMMARY_CHARS) {
      return t.slice(0, MAX_SUMMARY_CHARS) + `\n……（内容过长，已截断，共 ${t.length} 字）`;
    }
    return t;
  }

  async function readAsTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  // 懒加载外部解析库（pdf.js / jszip），避免影响首屏加载
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-lazy="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.dataset.lazy = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('资源加载失败: ' + src));
      document.head.appendChild(s);
    });
  }

  async function parsePdf(file) {
    await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await readAsArrayBuffer(file);
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    const maxPages = Math.min(doc.numPages, 20); // 避免超长 PDF 卡死
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }
    if (doc.numPages > maxPages) {
      text += `\n……（PDF 共 ${doc.numPages} 页，仅解析前 ${maxPages} 页）`;
    }
    return text;
  }

  async function parseDocx(file) {
    await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const buf = await readAsArrayBuffer(file);
    const zip = await window.JSZip.loadAsync(buf);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('无法解析 docx 结构');
    const xml = await xmlFile.async('string');
    // word/document.xml 是 XML，段落用 <w:p>，文字用 <w:t> 包裹，粗暴地把标签去掉取纯文本
    const text = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n');
    return text;
  }

  async function parseFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (file.type.startsWith('image/')) {
      // 图片：当前接入的模型不支持视觉解析，如实说明，不能让 AI 假装"看到了"
      const dataUrl = await readAsDataURL(file);
      return {
        summary: '（这是一张图片，当前未接入图像识别，模型无法读取图片内容，只知道用户发来了一张名为「' + file.name + '」的图片，不能假装看到了内容）',
        preview: dataUrl,
      };
    }
    if (ext === 'txt' || file.type === 'text/plain') {
      const text = await readAsTextFile(file);
      return { summary: truncateSummary(text) };
    }
    if (ext === 'pdf' || file.type === 'application/pdf') {
      const text = await parsePdf(file);
      return { summary: truncateSummary(text) };
    }
    if (ext === 'docx') {
      const text = await parseDocx(file);
      return { summary: truncateSummary(text) };
    }
    throw new Error('暂不支持这个文件类型（' + (ext || file.type) + '）');
  }

  function renderAttachmentChip() {
    if (!attachmentChip) return;
    if (!pendingAttachment) {
      attachmentChip.hidden = true;
      attachmentChip.innerHTML = '';
      return;
    }
    attachmentChip.hidden = false;
    attachmentChip.innerHTML = `
      <span class="attachment-chip-name">📎 ${escapeHtml(pendingAttachment.name)}</span>
      <button type="button" class="attachment-chip-remove" aria-label="移除附件">×</button>
    `;
    attachmentChip.querySelector('.attachment-chip-remove').addEventListener('click', () => {
      pendingAttachment = null;
      renderAttachmentChip();
    });
  }

  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      toast('正在解析文件…');
      try {
        const parsed = await parseFile(file);
        pendingAttachment = {
          name: file.name,
          type: file.type || '未知类型',
          summary: parsed.summary,
        };
        renderAttachmentChip();
        toast('已附加：' + file.name);
      } catch (e) {
        console.error(e);
        toast('文件解析失败：' + (e.message || e));
      }
    });
  }

  // ============ 新对话 ============
  newChatBtn.addEventListener('click', () => {
    Store.create();
    renderAll();
    closeDrawer();
    inputEl.focus();
  });

  // ============ 发送消息 ============
  async function sendMessage() {
    if (isGenerating) return;
    const text = inputEl.value.trim();
    if (!text) return;

    const s = Settings.load();
    if (!s.apiKey) {
      toast('请先在设置中填入 DeepSeek API Key');
      openSettings();
      return;
    }

    if (!Store.current()) {
      Store.create();
    }

    inputEl.value = '';
    autoResizeInput();

    // 附件：如果这一轮带了文件，取出来，气泡里显示一个附件标记
    const attachment = pendingAttachment;
    pendingAttachment = null;
    renderAttachmentChip();
    const displayText = attachment ? `${text}\n\n📎 ${attachment.name}` : text;

    Store.addMessage('user', displayText);
    appendMessage('user', displayText);

    // 真人等待延迟：800\~2000ms 模拟"他在想"
    const thinkTime = 800 + Math.random() * 1200;
    await new Promise(r => setTimeout(r, thinkTime));

    // 准备空 bot 消息
    Store.addMessage('assistant', '');
    appendMessage('assistant', '');

    // 重置打字机状态
    typeBuffer = '';
    typeDisplayed = '';
    isThinking = true;
    updateLastBubble(''); // 显示思考中

    isGenerating = true;
    stopBtn.hidden = false;
    sendBtn.disabled = true;

    // 说明：.filter() 先运行，已经把还在生成中的空 assistant 占位消息剔除掉了，
    // 所以过滤后数组的最后一条就是"当前这轮刚发的用户消息"；.slice(-31, -1) 排除掉的正是它，
    // 避免它在 history 里出现一次、下面又显式拼接一次导致重复。
    const history = Store.current().messages
      .filter(m => m.content && m.content.length > 0)
      .slice(-31, -1) // 最多取最近 30 条历史（不含当前这轮的用户消息）
      .map(m => ({ role: m.role, content: m.content }));
    // 用户的第几轮消息（用于触发重逢机制）
    const userTurn = Store.current().messages.filter(m => m.role === 'user' && m.content).length;
    // 是否明确要求进入剧情模式（默认聊天模式）
    const conversationMode = window.detectConversationMode(text);
    const sysPrompt = buildSystemPrompt(s, userTurn, conversationMode);

    // 附件摘要：拼进发给模型的用户消息里（气泡里只显示文件名，摘要单独传给模型）
    const userContentForModel = attachment
      ? `${text}\n\n[用户上传文件]\n文件名：${attachment.name}\n类型：${attachment.type}\n内容摘要：\n${attachment.summary}`
      : text;

    const messages = [
      { role: 'system', content: sysPrompt },
      ...history,
      { role: 'user', content: userContentForModel },
    ];

    abortController = new AbortController();
    let fullText = '';

    try {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: s.model,
          messages,
          temperature: s.temperature,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        let errMsg = `请求失败 (${resp.status})`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errJson.message || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
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
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta; // 累积完整回复，供下面的自动记忆提取使用
              feedTyping(delta);
            }
          } catch {}
        }
      }

      // 等打字机把 buffer 全部打完
      await waitForTypingDone();

      renderChatList();

      // 异步触发自动记忆提取（不阻塞 UI）
      extractMemoryFromLastTurn(text, fullText);
    } catch (err) {
      if (err.name === 'AbortError') {
        flushTyping();
      } else {
        console.error(err);
        const errMsg = `[出错了] ${err.message || err}`;
        flushTyping();
        typeDisplayed = errMsg;
        updateLastBubble(typeDisplayed);
        Store.updateLastMessage(typeDisplayed);
        toast(err.message || '出错了，请检查 API Key');
      }
    } finally {
      isGenerating = false;
      abortController = null;
      stopBtn.hidden = true;
      sendBtn.disabled = false;
    }
  }

  function waitForTypingDone() {
    return new Promise((resolve) => {
      const check = () => {
        if (!typeTimer && typeBuffer.length === 0) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  // ============ 现实环境层（时间 / 可扩展天气/地点/用户状态） ============
  // 独立函数，方便以后扩展：getWeatherContext() / getLocationContext() / getUserDeviceContext() 等
  //
  // ⚠️ 之前的实现通过 Date -> toLocaleString('en-US', {hour12:false}) 往返转换取小时数，
  // 在部分浏览器的 Intl 实现里，午夜 00:xx 会被格式化成 "24:xx" 而不是 "00:xx"（ICU 已知行为），
  // 导致 hour = 24，不落在任何时段分支里，从而出现"实际是中午却报别的时间"这类错乱。
  // 页面本身就运行在用户本地时区里，直接用 Date 的本地 getter 即可，不需要再绕一圈 Intl。
  function getTimeContext() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const hour = now.getHours();     // 0-23，浏览器本地时间，不会出现 24
    const minute = now.getMinutes();
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const day = weekdays[now.getDay()];
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    // 时段标注（只是事实标记，不附带任何行为推断）
    let period;
    if (hour >= 0 && hour < 5) period = '凌晨';
    else if (hour >= 5 && hour < 8) period = '清晨';
    else if (hour >= 8 && hour < 11) period = '上午';
    else if (hour >= 11 && hour < 14) period = '中午';
    else if (hour >= 14 && hour < 18) period = '下午';
    else if (hour >= 18 && hour < 22) period = '晚上';
    else period = '深夜';

    return {
      year, month, date, hour, minute, day, isWeekend, period,
      text: `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')} ${hh}:${mm}`,
    };
  }

  // 组装"现实环境"事实块，附带强制规则，永远放在 system prompt 最顶部
  function buildRealityBlock() {
    const t = getTimeContext();
    return `# 当前现实时间（最高优先级 · 唯一时间来源）

当前现实时间：
${t.text}

星期：${t.day}${t.isWeekend ? '（周末）' : ''}

时间段：
${t.period}

规则：
1. 所有时间判断以此为准，禁止自行猜测或计算。
2. 不允许凌晨说"吃早餐" "该起床了"。
3. 不允许下午说"早上好"，不允许上午说"晚安"。
4. 不允许根据角色剧情推测现实时间。
5. 本时间每次对话都会重新生成，以最新一次为准。`;
  }

  function buildSystemPrompt(s, turn, conversationMode) {
    const userName = s.userName || '笨鸟';
    const memoryContext = (window.Memory && window.Memory.buildContext) ? window.Memory.buildContext() : '';
    const realityBlock = buildRealityBlock();

    return `${realityBlock}

---

${window.assemblePrompt({
  turn: turn || 1,
  userName,
  memoryContext,
  conversationMode: conversationMode || 'chat',
})}`;
  }

  // ============ 自动记忆提取 ============
  // 每次对话结束后，异步调用一次 mini prompt 判断是否值得保存
  // 失败不影响主流程
  async function extractMemoryFromLastTurn(userText, assistantText) {
    const s = Settings.load();
    if (!s.apiKey) return;
    if (!s.autoMemory) return; // 用户可关闭

    const memory = window.Memory.get();
    const existingContext = window.Memory.buildContext() || '（暂无）';

    const miniPrompt = `你是记忆提取助手。从最近的对话中判断是否有值得长期保存的信息。

## 已有记忆（避免重复）
${existingContext}

## 本次对话
用户：${userText}
齐司礼：${assistantText}

## 保存规则
**值得保存**：
- 用户长期性格、习惯、偏好
- 重要经历或事件
- 用户近期目标或关注的事
- 共同回忆或梗

**不值得保存**：
- 临时情绪（"今天好累"这类不保存）
- 一次性闲聊
- 已经在记忆中存在的

## 输出格式（严格 JSON，不要其他内容）
{
  "save": true 或 false,
  "category": "longTerm" 或 "currentState" 或 "relationship",
  "key": "字段名（从 longTerm.nickname/personality/habits/preferences/work/important; currentState.mood/focus/concerns; relationship.sharedMemories/insideJokes/herLanguage 中选）",
  "value": "简洁的中文描述，1\~30 字"
}

如果值得保存就填对应字段。如果不值得保存，save 填 false。`;

    try {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.apiKey}`,
        },
        body: JSON.stringify({
          model: s.model,
          messages: [
            { role: 'system', content: '你只输出严格 JSON，不输出任何其他内容。' },
            { role: 'user', content: miniPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 200,
        }),
      });

      if (!resp.ok) return;
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return;

      const result = JSON.parse(content);
      if (result.save && result.category && result.key && result.value) {
        if (memory[result.category] && result.key in memory[result.category]) {
          // 合并：追加到现有值后面
          const oldVal = memory[result.category][result.key];
          if (oldVal && !oldVal.includes(result.value)) {
            memory[result.category][result.key] = oldVal + '；' + result.value;
          } else if (!oldVal) {
            memory[result.category][result.key] = result.value;
          }
          window.Memory.save(memory);
          console.log('[记忆提取] 已保存:', result);
        }
      }
    } catch (e) {
      // 静默失败
      console.warn('[记忆提取] 失败:', e);
    }
  }

  // ============ 停止生成 ============
  stopBtn.addEventListener('click', () => {
    if (abortController) abortController.abort();
  });

  // ============ 输入框行为 ============
  function autoResizeInput() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  }
  inputEl.addEventListener('input', autoResizeInput);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener('click', sendMessage);

  // ============ 启动 ============
  Store.load();
  if (!Store.current()) {
    Store.create();
  }
  renderAll();

  const s = Settings.load();
  if (!s.apiKey) {
    setTimeout(() => {
      toast('请先设置 DeepSeek API Key');
      openSettings();
    }, 600);
  }
})();
