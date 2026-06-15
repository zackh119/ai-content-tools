const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DAILY_LIMIT = 30;

let selectedTitle = '', lastFullContent = '', lastBody = '', lastTags = '', currentPlatform = 'xiaohongshu';

// ====== Platform definitions ======
const P = {
  xiaohongshu: {
    label: '小红书', placeholder: '推荐5款适合学生党的平价护肤品',
    styles: ['种草推荐','干货分享','情感故事','教程攻略','生活记录','避坑指南'],
    tones: ['亲切自然','专业权威','幽默风趣','温暖治愈','犀利直白'],
    lengths: [['短篇~300字','S'],['中篇~600字','M'],['长篇~1000字','L']],
    features: [['🔥','种草推荐','好物分享、测评推荐'],['📚','干货分享','知识科普、经验总结'],['💕','情感故事','心情记录、生活感悟'],['🎯','教程攻略','Step-by-step 指南'],['☀️','生活记录','日常分享'],['⚠️','避坑指南','踩坑经历、防坑建议']],
    quickRefines: ['多发点emoji，更活泼','缩短一半，更精炼','换个吸引人的角度','语气再口语化一点'],
    titlePrompt: '你是一位真实的小红书博主。请为主题生成5个爆款标题。要求：每个标题要抓人，用数字、悬念、强烈态度、反差感；符合小红书风格，口语化、带emoji；5个标题要有不同切入角度。直接输出5行，每行一个标题，不要序号。',
    fullPrompt: '你是一位真实的小红书博主。根据选定的标题和主题写一篇完整笔记。语言：像跟闺蜜聊天，口语化、带情绪，用"我"来写。排版：段落短（1-3行一段），多用破折号和省略号，emoji自然插入。禁用词："值得注意的是"、"不难发现"、"基于以上分析"、"总而言之"、"不可否认"、"值得一提的是"、"综上所述"。内容：不要干巴巴列1234，用具体感受和细节。结尾：不要总结，用互动结尾。格式：先输出标题（直接使用选定标题），空一行，正文，最后换行加标签。',
    tokenMap: { S: 400, M: 800, L: 1200 }
  },
  douyin: {
    label: '抖音', placeholder: '5个让你工作效率翻倍的隐藏技巧',
    styles: ['好物测评','知识科普','情感共鸣','生活Vlog','教程教学','热点评论'],
    tones: ['亲切自然','幽默风趣','温暖治愈','犀利直白','热血励志'],
    lengths: [['15秒快稿','XS'],['30秒标准','S'],['60秒完整','M'],['90秒深度','L']],
    features: [['🛒','好物测评','产品开箱、使用体验'],['🧠','知识科普','冷知识、原理讲解'],['💞','情感共鸣','故事分享、情绪价值'],['🎬','生活Vlog','日常记录、旅行分享'],['📖','教程教学','技巧教学、步骤演示'],['🔥','热点评论','时事点评、观点输出']],
    quickRefines: ['开头再爆一点','缩短到15秒版本','加更多画面描述','换个话题角度切入'],
    titlePrompt: '你是一位抖音短视频创作者。请为主题生成5个引人注目的视频标题/话题。要求：标题在3秒内抓住注意力，用数字、悬念、反差、争议手法；口语化。直接输出5行，每行一个标题。',
    fullPrompt: '你是一位抖音短视频创作者。根据选定的标题和主题写一份完整的短视频脚本。\n\n格式：\n【开场】画面：场景描述 口播：配音文案 字幕：屏幕文字\n【主体】画面：口播：字幕：\n（分2-3段）\n【结尾】画面：口播：字幕：\n\n要求：开头3秒要有钩子；口语化，节奏紧凑。\n\n格式：先输出标题行，空一行，再写完整脚本。',
    tokenMap: { XS: 300, S: 500, M: 800, L: 1200 }
  },
  gongzhonghao: {
    label: '公众号', placeholder: '2025年最值得关注的AI趋势',
    styles: ['行业分析','干货教程','情感故事','时事评论','产品评测','人物访谈'],
    tones: ['专业权威','亲切自然','深度理性','温暖治愈','犀利观点'],
    lengths: [['短篇~800字','S'],['中篇~1500字','M'],['长篇~2500字','L']],
    features: [['📊','行业分析','趋势解读、数据洞察'],['📖','干货教程','知识教学、实操指南'],['💞','情感故事','真实故事、情感共鸣'],['📰','时事评论','热点分析、观点输出'],['🔬','产品评测','深度测评、对比分析'],['👤','人物访谈','人物故事、经验分享']],
    quickRefines: ['加更多数据和案例','语气更通俗易懂','缩短到800字以内','开头更有吸引力'],
    titlePrompt: '你是一位资深公众号作者。请为主题生成5个吸引点击的文章标题。要求：标题有信息量和吸引力，可用数字、问句、悬念；符合公众号读者阅读习惯。直接输出5行，每行一个标题。',
    fullPrompt: '你是一位资深公众号作者。根据选定的标题和主题写一篇完整的公众号文章。\n\n格式：开头有导语；正文用小标题分段（用【】标记）；每段不要太长；可引用数据案例；结尾引导互动。\n\n语言：根据所选语气调整；专业但不晦涩。\n\n格式：先输出标题行，空一行，再写正文。',
    tokenMap: { S: 1200, M: 2000, L: 3500 }
  }
};

// ====== Init platform ======
function initPlatform(platform) {
  currentPlatform = platform;
  const cfg = P[platform];
  document.getElementById('topic').placeholder = cfg.placeholder;
  document.getElementById('toolDesc').textContent = '输入主题 → 挑选' + cfg.label + '标题 → 一键生成全文';

  const sSel = document.getElementById('styleSelect');
  sSel.innerHTML = cfg.styles.map(s => '<option value="' + s + '">' + s + '</option>').join('');

  const tSel = document.getElementById('toneSelect');
  tSel.innerHTML = cfg.tones.map(s => '<option value="' + s + '">' + s + '</option>').join('');

  const lSel = document.getElementById('lengthSelect');
  lSel.innerHTML = cfg.lengths.map(([label, val]) => '<option value="' + val + '">' + label + '</option>').join('');

  document.getElementById('quickRefines').innerHTML = cfg.quickRefines.map(s =>
    '<button class="btn btn-tag" onclick="quickRefine(\'' + s + '\')">' + s + '</button>'
  ).join('');

  document.getElementById('featuresTitle').textContent = cfg.label + '支持的内容类型';
  document.getElementById('featuresGrid').innerHTML = cfg.features.map(([icon, name, desc]) =>
    '<div class="feature-item"><div class="feature-icon">' + icon + '</div><div class="feature-text">' + name + '<br><small>' + desc + '</small></div></div>'
  ).join('');

  selectedTitle = ''; lastFullContent = ''; lastBody = ''; lastTags = '';
  document.getElementById('titleSection').style.display = 'none';
  document.getElementById('outputSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'none';
}

// ====== Key mgmt ======
function getKey() {
  let key = localStorage.getItem('ds_key');
  if (!key) {
    key = prompt('请输入你的 DeepSeek API Key（在 platform.deepseek.com 获取）');
    if (key && key.trim()) { localStorage.setItem('ds_key', key.trim()); return key.trim(); }
    return null;
  }
  return key;
}
function clearKey() { localStorage.removeItem('ds_key'); location.reload(); }

// ====== Usage ======
function getUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem('ds_usage');
  const data = raw ? JSON.parse(raw) : {};
  if (data.date !== today) { data.date = today; data.count = 0; }
  return data;
}
function getRemaining() { return DAILY_LIMIT - getUsage().count; }
function checkLimit() {
  if (getRemaining() <= 0) { showError('今日次数已用完，明天再来吧！'); return false; }
  return true;
}
function useOne() {
  const u = getUsage(); u.count++; localStorage.setItem('ds_usage', JSON.stringify(u));
  document.getElementById('remainCount').textContent = getRemaining();
}

// ====== UI ======
function $(id) { return document.getElementById(id); }
function showError(msg) { $('errorMsg').textContent = msg; $('errorSection').style.display = ''; $('titleSection').style.display = 'none'; }
function hideError() { $('errorSection').style.display = 'none'; }
function showToast(msg) { const t = document.querySelector('.toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2000); }
function setLoading(id, v) { const b = $(id); b.disabled = v; b.querySelector('.btn-text').style.display = v ? 'none' : ''; b.querySelector('.btn-loading').style.display = v ? '' : 'none'; }

function getValues() {
  return { topic: $('topic').value.trim(), style: $('styleSelect').value, tone: $('toneSelect').value, length: $('lengthSelect').value };
}

// ====== API ======
async function callAPI(systemP, userP, maxTok) {
  const key = getKey();
  if (!key) return null;
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: systemP }, { role: 'user', content: userP }], temperature: 0.9, max_tokens: maxTok || 800 })
    });
    const d = await r.json();
    if (!r.ok) { if (r.status === 401) clearKey(); showError('API 错误: ' + (d.error?.message || r.statusText)); return null; }
    return d.choices?.[0]?.message?.content || '';
  } catch(e) { showError('网络错误，请检查连接'); return null; }
}

// ====== Step 1: Titles ======
async function generateTitles() {
  const vals = getValues();
  if (!vals.topic) { showError('请输入主题'); $('topic').focus(); return; }
  if (!checkLimit()) return;
  hideError(); $('outputSection').style.display = 'none'; setLoading('genTitleBtn', true);
  const result = await callAPI(P[currentPlatform].titlePrompt, '请为主题「' + vals.topic + '」生成5个标题。风格：' + vals.style + '，语气：' + vals.tone, 500);
  setLoading('genTitleBtn', false);
  if (!result) return;
  useOne();
  const titles = result.split('\n').filter(t => t.trim() && !t.match(/^\d+[\.、]/)).slice(0, 5);
  if (titles.length === 0) { showError('生成标题失败，请重试'); return; }
  selectedTitle = '';
  $('titleList').innerHTML = titles.map((t, i) =>
    '<button class="title-chip" data-idx="' + i + '" onclick="pickTitle(this)">' + escHtml(t.trim()) + '</button>'
  ).join('');
  $('titleError').style.display = 'none';
  $('genPostBtn').disabled = true;
  $('titleSection').style.display = '';
  window.scrollTo({ top: $('titleSection').offsetTop - 80, behavior: 'smooth' });
}

function pickTitle(el) {
  document.querySelectorAll('.title-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedTitle = el.textContent.trim();
  $('genPostBtn').disabled = false;
}
function escHtml(t) { return t.replace(/</g,'<').replace(/>/g,'>'); }

// ====== Step 2: Full content ======
async function generatePost() {
  if (!selectedTitle) { showError('请先选择一个标题'); return; }
  if (!checkLimit()) return;
  setLoading('genPostBtn', true);
  const vals = getValues();
  const tm = P[currentPlatform].tokenMap;
  const maxTok = tm[vals.length] || 800;
  const prompt = '标题：' + selectedTitle + '\n主题：' + vals.topic + '\n风格：' + vals.style + '\n语气：' + vals.tone + '\n篇幅：' + vals.length;
  const result = await callAPI(P[currentPlatform].fullPrompt, prompt, maxTok);
  setLoading('genPostBtn', false);
  if (!result) return;
  useOne();
  displayResult(selectedTitle, result);
}

// ====== Parse tags from content ======
function parseTags(content) {
  const lines = content.split('\n');
  const tagLines = lines.filter(l => l.trim().startsWith('#'));
  const bodyLines = lines.filter(l => !l.trim().startsWith('#'));
  return {
    tags: tagLines.join(' ').trim(),
    body: bodyLines.join('\n').trim()
  };
}

// ====== Display ======
function displayResult(title, raw) {
  let t = title || '', body = raw;
  const m = raw.match(/(?:^|\n)标题[：:]\s*(.+?)(?:\n|$)/);
  if (m) { t = m[1].trim(); body = raw.replace(m[0], '').trim(); }
  
  const parsed = parseTags(body);
  selectedTitle = t; lastBody = parsed.body; lastTags = parsed.tags;
  lastFullContent = t + '\n\n' + parsed.body + '\n\n' + parsed.tags;
  
  $('outputTitle').textContent = t;
  $('outputBody').textContent = parsed.body;
  $('outputTags').textContent = parsed.tags || '(无标签)';
  
  $('titleSection').style.display = 'none'; $('outputSection').style.display = '';
  $('refineInput').value = '';
  
  // Update copy buttons
  $('copyTitleBtn').onclick = function() { copyToClipboard(t, '标题已复制'); };
  $('copyBodyBtn').onclick = function() { copyToClipboard(parsed.body, '正文已复制'); };
  $('copyTagsBtn').onclick = function() { copyToClipboard(parsed.tags, '标签已复制'); };
  $('copyAllBtn').onclick = function() { copyToClipboard(lastFullContent, '全部内容已复制'); };
  
  window.scrollTo({ top: $('outputSection').offsetTop - 80, behavior: 'smooth' });
}

// ====== Copy ======
function copyToClipboard(text, msg) {
  if (!text) { showToast('没有内容可复制'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast(msg))
      .catch(() => fallbackCopy(text, msg));
  } else { fallbackCopy(text, msg); }
}
function fallbackCopy(text, msg) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast(msg); }
  catch (e) { showToast('复制失败'); }
  document.body.removeChild(ta);
}

// ====== Refine ======
async function refine() {
  const inst = $('refineInput').value.trim();
  if (!inst) { showToast('请输入修改要求'); return; }
  await doRefine(inst);
}
async function quickRefine(inst) { $('refineInput').value = inst; await doRefine(inst); }

async function doRefine(inst) {
  if (!lastFullContent) return;
  if (!checkLimit()) return;
  const prompt = '原文：\n' + lastFullContent + '\n\n修改要求：' + inst + '\n\n请按要求改写，结构和标题不变。';
  const result = await callAPI(P[currentPlatform].fullPrompt, prompt, 1200);
  if (!result) return;
  useOne();
  displayResult(selectedTitle, result);
  showToast('已按你的要求重新生成');
}

function resetAll() {
  selectedTitle = ''; lastFullContent = ''; lastBody = ''; lastTags = '';
  $('outputSection').style.display = 'none'; $('titleSection').style.display = 'none'; hideError();
  $('topic').focus();
}

// ====== Events ======
document.addEventListener('DOMContentLoaded', () => {
  initPlatform('xiaohongshu');

  document.getElementById('platformTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.platform-tab');
    if (!tab) return;
    document.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    initPlatform(tab.dataset.platform);
  });

  $('genTitleBtn').onclick = generateTitles;
  $('regenerateTitlesBtn').onclick = generateTitles;
  $('genPostBtn').onclick = generatePost;
  $('resetBtn').onclick = resetAll;
  $('refineBtn').onclick = refine;

  $('topic').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateTitles(); } });
  $('refineInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); refine(); } });

  $('remainCount').textContent = getRemaining();
});
