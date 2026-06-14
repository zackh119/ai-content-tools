const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DAILY_LIMIT = 30;

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
}

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

const SYSTEM_PROMPT = `你是一位真实的小红书博主，有自己的性格和表达习惯。现在需要你写一篇小红书笔记。

【核心要求：彻底像人写的，不是AI】

一、语言风格
- 像在跟闺蜜聊天，口语化，自然
- 可以带一点个人小情绪、小吐槽
- 用"我"来写，有自己的态度
- 适当用一些口语词：真的、绝了、谁懂啊、狠狠爱了、安利给所有人

二、排版结构
- 标题要抓人：用数字、悬念、强烈态度、反差感
- 正文段落短！每段1-3行就换行
- 多用破折号——和省略号...制造节奏感
- emoji自然插入，不要每句都加，在关键词上加就好

三、绝对不要用的词（用了就是AI味）：
"值得注意的是"、"不难发现"、"基于以上分析"、"总而言之"、"不可否认"、"值得一提的是"、"综上所述"、"除此之外"、"首先"、"其次"、"总之"、"让我们来探讨"、"在当今社会"

四、内容要有温度
- 不要干巴巴列1234，要用具体感受和细节
- 展示，不是说教（Show, don't tell）
- 允许带点主观偏见——你是个有态度的人
- 可以分享自己的使用/体验感受

五、结尾
- 不要总结！不要总结！
- 要互动：问读者一个问题，或者引导评论区讨论
- 比如："你们有用过类似的吗？评论区聊聊～"

六、格式要求
输出格式固定为：
标题：xxx

（正文内容）

（标签，5-8个）`;

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

  const userPrompt = '请以「' + vals.style + '」的风格、「' + vals.tone + '」的语气，写一篇关于「' + vals.topic + '」的小红书笔记。记住：要有人味儿！像真人写的，不是AI。';

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
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

    let content = data.choices?.[0]?.message?.content || '';
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topic').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generate();
    }
  });
  document.getElementById('remainCount').textContent = getRemaining();
});
