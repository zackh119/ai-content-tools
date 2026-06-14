const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DAILY_LIMIT = 30;

let selectedTitle = '';
let currentTopic = '';
let currentStyle = '';
let currentTone = '';
let currentLength = '';
let lastFullContent = '';

// --- Key management ---
function getKey() {
  let key = localStorage.getItem('ds_key');
  if (!key) {
    key = prompt('请输入你的 DeepSeek API Key（在 platform.deepseek.com 获取）：\n（本工具仅需 10 元额度，key 只保存在你浏览器本地）');
    if (key && key.trim()) { localStorage.setItem('ds_key', key.trim()); return key.trim(); }
    return null;
  }
  return key;
}
function clearKey() { localStorage.removeItem('ds_key'); location.reload(); }

// --- Usage ---
function getUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem('ds_usage');
  const data = raw ? JSON.parse(raw) : {};
  if (data.date !== today) { data.date = today; data.count = 0; }
  return data;
}
function getRemaining() { return DAILY_LIMIT - getUsage().count; }
function checkLimit() {
  if (getRemaining() <= 0) { showError('今日次数已用完（每日' + DAILY_LIMIT + '次），明天再来吧！'); return false; }
  return true;
}
function useOne() {
  const u = getUsage(); u.count++; localStorage.setItem('ds_usage', JSON.stringify(u));
  document.getElementById('remainCount').textContent = getRemaining();
}

// --- UI helpers ---
function $(id) { return document.getElementById(id); }
function show(id) { $(id).style.display = ''; }
function hide(id) { $(id).style.display = 'none'; }

function showError(msg) {
  $('errorMsg').textContent = msg;
  show('errorSection');
  hide('titleSection');
}
function hideError() { hide('errorSection'); }

function showToast(msg) {
  const t = document.querySelector('.toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2000);
}

function setBtnLoading(id, loading) {
  const btn = $(id);
  btn.disabled = loading;
  btn.querySelector('.btn-text').style.display = loading ? 'none' : '';
  btn.querySelector('.btn-loading').style.display = loading ? '' : 'none';
}

function getValues() {
  return {
    topic: $('topic').value.trim(),
    style: $('style').value,
    tone: $('tone').value,
    length: $('length').value
  };
}

// --- System prompts ---
const TITLE_PROMPT = `你是一位真实的小红书博主。请为主题生成5个爆款标题。

要求：
- 每个标题要抓人：用数字、悬念、强烈态度、反差感
- 符合小红书风格：口语化、有情绪、带emoji
- 5个标题要有不同的切入角度
- 不要用"值得注意的是"、"总而言之"、"不可否认"、"值得一提的是"
- 每个标题不超过30字

直接输出5个标题，每个一行，不要序号。`;

const FULL_PROMPT = `你是一位真实的小红书博主，有自己的性格和表达习惯。现在需要根据用户选定的标题和主题，写一篇完整的小红书笔记。

【语言风格】
- 像跟闺蜜聊天，口语化、自然
- 可以带点小情绪、小吐槽
- 用"我"来写，有自己的态度
- 用词：真的、绝了、谁懂啊、狠狠爱了、安利给所有人

【排版结构】
- 标题已由用户选定，直接使用
- 正文段落短！每段1-3行就换行
- 多用破折号——和省略号...制造节奏感
- emoji自然插入，在关键词上加就好

【禁用词】
"值得注意的是"、"不难发现"、"基于以上分析"、"总而言之"、"不可否认"、"值得一提的是"、"综上所述"、"除此之外"

【内容要求】
- 不要干巴巴列1234，用具体感受和细节
- 展示，不是说教（Show, don't tell）
- 允许主观偏见——你是个有态度的人
- 分享自己的使用/体验感受

【结尾】
- 不要总结！用互动结尾
- 问读者一个问题，引导评论区讨论

【格式】
先输出标题（直接使用选定标题），然后空一行，再写正文，最后换行加标签。`;

const REFINE_PROMPT = `你是一位真实的小红书博主。请根据用户的修改要求，对原文进行改写。

核心原则：
- 保持原文的核心信息和主题不变
- 只根据用户的修改要求调整
- 其他保持小红书风格：口语化、短段落、有情绪、有互动
- 不要用"值得注意的是"、"总而言之"、"不可否认"、"值得一提的是"
- 标题不变，只改写正文

先输出标题，空一行，再输出改写后的正文，最后加标签。`;

// --- API call ---
async function callDeepSeek(systemPrompt, userPrompt, maxTokens) {
  const key = getKey();
  if (!key) return null;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: maxTokens || 800
      })
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) { clearKey(); showError('API Key 无效，请重新输入。'); }
      else { showError('API 错误: ' + (data.error?.message || res.statusText)); }
      return null;
    }
    return data.choices?.[0]?.message?.content || '';
  } catch (err) {
    showError('网络错误，请检查网络连接后重试');
    return null;
  }
}

// --- Step 1: Generate titles ---
async function generateTitles() {
  const vals = getValues();
  if (!vals.topic) { showError('请输入写作主题'); $('topic').focus(); return; }
  if (!checkLimit()) return;

  currentTopic = vals.topic; currentStyle = vals.style; currentTone = vals.tone; currentLength = vals.length;

  hideError();
  hide('outputSection');
  hide('titleSection');
  setBtnLoading('genTitleBtn', true);

  const userPrompt = '请为主题「' + vals.topic + '」生成5个爆款标题。风格：' + vals.style + '，语气：' + vals.tone + '。';

  const result = await callDeepSeek(TITLE_PROMPT, userPrompt, 500);
  setBtnLoading('genTitleBtn', false);

  if (!result) return;

  useOne();
  const titles = result.split('\n').filter(t => t.trim() && !t.match(/^\d+[\.、]/)).slice(0, 5);
  if (titles.length === 0) { showError('生成标题失败，请重试'); return; }

  selectedTitle = '';
  const list = $('titleList');
  list.innerHTML = titles.map((t, i) =>
    '<button class="title-chip" data-idx="' + i + '" onclick="pickTitle(this)">' + escapeHtml(t.trim()) + '</button>'
  ).join('');
  hide('titleError');
  $('genPostBtn').disabled = true;
  show('titleSection');
  window.scrollTo({ top: $('titleSection').offsetTop - 80, behavior: 'smooth' });
}

function pickTitle(el) {
  document.querySelectorAll('.title-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedTitle = el.textContent.trim();
  $('genPostBtn').disabled = false;
}

function escapeHtml(t) { return t.replace(/</g,'<').replace(/>/g,'>'); }

// --- Step 2: Generate full post ---
async function generatePost() {
  if (!selectedTitle) { showError('请先选择一个标题'); return; }
  if (!checkLimit()) return;

  hideError();
  setBtnLoading('genPostBtn', true);

  const userPrompt = '标题：' + selectedTitle + '\n主题：' + currentTopic + '\n风格：' + currentStyle + '\n语气：' + currentTone + '\n请写一篇' + currentLength + '篇幅的小红书笔记。';

  const lengthMap = { short: 600, medium: 1000, long: 1500 };
  const result = await callDeepSeek(FULL_PROMPT, userPrompt, lengthMap[currentLength] || 1000);
  setBtnLoading('genPostBtn', false);

  if (!result) return;

  useOne();
  displayResult(selectedTitle, result);
}

// --- Refinement ---
async function refine() {
  const instruction = $('refineInput').value.trim();
  if (!instruction) { showToast('请输入修改要求'); return; }
  await doRefine(instruction);
}

async function quickRefine(instruction) {
  $('refineInput').value = instruction;
  await doRefine(instruction);
}

async function doRefine(instruction) {
  if (!lastFullContent) return;
  if (!checkLimit()) return;

  const userPrompt = '原文：\n' + lastFullContent + '\n\n修改要求：' + instruction;
  const result = await callDeepSeek(REFINE_PROMPT, userPrompt, 1000);
  if (!result) return;

  useOne();
  displayResult(selectedTitle, result);
  showToast('已按你的要求重新生成');
}

// --- Display ---
function displayResult(title, raw) {
  let titleText = title || '';
  let body = raw;

  // Try to extract title from output
  const tm = raw.match(/(?:^|\n)标题[：:]\s*(.+?)(?:\n|$)/);
  if (tm) { titleText = tm[1].trim(); body = raw.replace(tm[0], '').trim(); }

  selectedTitle = titleText;
  lastFullContent = titleText + '\n\n' + body;

  $('outputTitle').textContent = titleText;
  $('outputBody').textContent = body;

  hide('titleSection');
  show('outputSection');
  $('refineInput').value = '';
  window.scrollTo({ top: $('outputSection').offsetTop - 80, behavior: 'smooth' });
}

// --- Actions ---
function copyContent() {
  const text = lastFullContent;
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板'))
      .catch(() => fallbackCopy(text));
  } else { fallbackCopy(text); }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('已复制到剪贴板'); }
  catch (e) { showToast('复制失败，请手动复制'); }
  document.body.removeChild(ta);
}

function resetAll() {
  selectedTitle = ''; lastFullContent = '';
  hide('outputSection'); hide('titleSection'); hideError();
  $('topic').focus();
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  $('topic').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateTitles(); }
  });
  $('refineInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); refine(); }
  });
  $('remainCount').textContent = getRemaining();
});
