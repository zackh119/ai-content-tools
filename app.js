const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DAILY_LIMIT = 30;

// --- Key management ---
function getKey() {
  let key = localStorage.getItem('ds_key');
  if (!key) {
    key = prompt('请输入你的 DeepSeek API Key（在 platform.deepseek.com 获取）：\n（本工具仅需 10 元额度，key 只保存在你浏览器本地）');
    if (key && key.trim()) {
      localStorage.setItem('ds_key', key.trim());
      return key.trim();
    }
    return null;
  }
  return key;
}

function clearKey() {
  localStorage.removeItem('ds_key');
  location.reload();
}

// --- Usage tracking ---
function getUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem('ds_usage');
  const data = raw ? JSON.parse(raw) : {};
  if (data.date !== today) { data.date = today; data.count = 0; }
  return data;
}

function getRemaining() { return DAILY_LIMIT - getUsage().count; }

function checkLimit() {
  const ok = getRemaining() > 0;
  if (!ok) showError('今日免费次数已用完（每日' + DAILY_LIMIT + '次），明天再来吧！如果觉得好用可以打赏支持～');
  return ok;
}

function incrementUsage() {
  const usage = getUsage();
  usage.count++;
  localStorage.setItem('ds_usage', JSON.stringify(usage));
  return usage.count;
}

// --- UI ---
function getValues() {
  return {
    topic: document.getElementById('topic').value.trim(),
    style: document.getElementById('style').value,
    tone: document.getElementById('tone').value,
    length: document.getElementById('length').value
  };
}

function setLoading(loading) {
  const btn = document.getElementById('generateBtn');
  btn.disabled = loading;
  document.querySelector('.btn-text').style.display = loading ? 'none' : '';
  document.querySelector('.btn-loading').style.display = loading ? '' : 'none';
}

function showError(msg) {
  document.getElementById('errorSection').style.display = '';
  document.getElementById('errorMsg').textContent = msg;
}

function hideError() {
  document.getElementById('errorSection').style.display = 'none';
}

function showOutput(data) {
  document.getElementById('outputSection').style.display = '';
  document.getElementById('outputTitle').textContent = data.title || '';
  document.getElementById('outputBody').textContent = data.content || data.raw || '';
  document.getElementById('remainCount').textContent = getRemaining();
}

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), 2000);
}

// --- Generate ---
async function generate() {
  const key = getKey();
  if (!key) {
    showError('需要 DeepSeek API Key 才能使用。请稍后重试。');
    return;
  }

  const vals = getValues();
  if (!vals.topic) {
    showError('请输入写作主题');
    document.getElementById('topic').focus();
    return;
  }
  if (!checkLimit()) return;

  hideError();
  setLoading(true);

  const lengthMap = { short: 300, medium: 600, long: 1000 };
  const maxTokens = lengthMap[vals.length] || 600;

  const systemPrompt = '你是一个专业的小红书文案写手，擅长写爆款笔记。\n\n'
    + '生成内容必须符合小红书风格：\n'
    + '1. 标题要吸睛：用数字、问句、感叹号、悬念\n'
    + '2. 正文有情绪：用 emoji、短句、口语化表达\n'
    + '3. 段落短小：每段不超过 3 行，留白多\n'
    + '4. 有互动引导：结尾引导点赞/收藏/关注/评论\n'
    + '5. 最后加 5-8 个话题标签\n\n'
    + '请严格按以下格式输出：\n\n'
    + '标题：<生成的标题>\n\n<正文内容>\n\n<标签>';

  const userPrompt = '请以「' + vals.style + '」的风格、「' + vals.tone + '」的语气，写一篇关于「' + vals.topic + '」的小红书笔记。';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: maxTokens
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        clearKey();
        showError('API Key 无效，请重新输入。注意不要有多余空格。');
      } else {
        showError('API 返回错误: ' + (data.error?.message || res.statusText));
      }
      return;
    }

    const content = data.choices?.[0]?.message?.content || '';
    let title = '';
    let body = content;
    const titleMatch = content.match(/(?:^|\n)标题[：:]\s*(.+?)(?:\n|$)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      body = content.replace(titleMatch[0], '').trim();
    }

    incrementUsage();
    showOutput({ title, content: body, raw: content });

    const el = document.getElementById('outputSection');
    window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
  } catch (err) {
    showError('网络错误，请检查网络连接后重试');
  } finally {
    setLoading(false);
  }
}

// --- Clipboard ---
function copyContent() {
  const title = document.getElementById('outputTitle').textContent;
  const body = document.getElementById('outputBody').textContent;
  const text = (title ? title + '\n\n' : '') + body;
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('已复制到剪贴板'); }
  catch (e) { showToast('复制失败，请手动复制'); }
  document.body.removeChild(ta);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topic').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generate();
    }
  });
  document.getElementById('remainCount').textContent = getRemaining();
});
