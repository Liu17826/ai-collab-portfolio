// prompt.js · 装配器
// 优先级顺序：00 核心 > 01 现实环境 > 07 防幻觉 > 05 记忆 > 02 人格 > 03 世界背景 > 04 关系 > 06 对话风格

window.QISILI_PROMPT = '';

// 判断进入"剧情模式"还是"日常聊天模式"（默认聊天模式）
// 只有用户明确表达进入剧情/世界观/故事的意图时才触发剧情模式
window.detectConversationMode = function (text, forcedMode) {
  if (forcedMode === 'story' || forcedMode === 'chat') return forcedMode;
  if (!text) return 'chat';
  const storyTriggers = [
    '进入剧情', '剧情模式', '讲个故事', '讲故事', '世界观', '进入故事',
    '角色扮演', '来一段剧情', '演一段', '带入剧情', '沉浸式',
  ];
  return storyTriggers.some(k => text.includes(k)) ? 'story' : 'chat';
};

window.assemblePrompt = function (options = {}) {
  const { turn = 1, userName = '笨鸟', memoryContext = '', conversationMode = 'chat' } = options;
  const M = window.QISILI_MODULES || {};

  // 模块按优先级顺序拼接：00 → 01 → 07 → 05 → 02 → 03 → 04 → 06
  const sections = [
    M.core || '',
    M.reality || '',
    M.hallucination || '',
    M.memory || '',
    M.character || '',
    M.world || '',
    M.relationship || '',
    M.dialogue || '',
  ];

  let prompt = sections.filter(Boolean).join('\n\n---\n\n');

  // 当前用户
  prompt += `\n\n---\n\n## 当前用户\n\n- 称呼：**${userName}**\n- 你称呼她为「${userName}」「笨鸟」「某只笨鸟」中任一\n- ❌ 不用"亲爱的""宝贝"等称呼`;

  // 记忆注入（实际数据，规则见 05 模块）
  if (memoryContext) {
    prompt += `\n\n---\n\n## 关于她的记忆\n\n以下是已保存的长期记忆，用于影响你的回应方式，不要机械复述。\n\n${memoryContext}`;
  } else {
    prompt += `\n\n---\n\n## 关于她的记忆\n\n目前没有任何已保存的长期记忆。不要假装记得任何未保存的信息。`;
  }

  // 状态机：重逢/日常 + 对话模式
  const stage = turn <= 2 ? 'A · 重逢阶段' : 'B · 日常阶段';
  const modeLabel = conversationMode === 'story' ? '剧情模式（用户已明确要求）' : '日常聊天模式（默认）';
  prompt += `\n\n---\n\n## 当前状态\n\n- 用户在本对话中的第 **${turn}** 条消息，处于 **${stage}**\n- 当前对话模式：**${modeLabel}**\n${conversationMode === 'story' ? '- 剧情模式下可以使用场景/动作描写与世界观内容\n- 剧情模式只在本轮生效，用户没有再次要求时，下一轮应回到日常聊天模式' : '- 日常模式下不使用场景/动作描写，不主动剧情化\n- 短回复（1\\~3 句），像真实聊天'}`;

  return prompt;
};

// 兼容旧调用
window.QISILI_PROMPT = window.assemblePrompt({ turn: 1, userName: '笨鸟' });
