const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
let API_KEY = '';
let controller;

const markdown = window.markdownit();

document.addEventListener('DOMContentLoaded', () => {
  const loginKeyBtn = document.getElementById('loginKeyBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const keyInput = document.getElementById('keyInput');
  const keyModal = document.getElementById('keyModal');
  const keyError = document.getElementById('keyError');
  const sendBtn = document.getElementById('send');
  const stopBtn = document.getElementById('stop');

  loginKeyBtn.addEventListener('click', validateAndSave);
  registerBtn.addEventListener('click', () => {
    window.open('https://discord.gg/Soon', '_blank');
  });
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('apiKey');
    API_KEY = '';
    sendBtn.disabled = true;
    logoutBtn.style.display = 'none';
    keyModal.style.display = 'flex';
  });

  keyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') e.preventDefault();
  });

  function validateAndSave() {
    const key = keyInput.value.trim();
    if (!key) {
      keyError.textContent = 'Key cannot be empty.';
      keyError.style.display = 'block';
      return;
    }

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '' },
          { role: 'user', content: '' }
        ],
        stream: false
      })
    }).then(res => {
      if (res.status === 401) {
        keyError.textContent = 'Invalid Key. Please try again.';
        keyError.style.display = 'block';
      } else {
        localStorage.setItem('apiKey', key);
        API_KEY = key;
        keyModal.style.display = 'none';
        sendBtn.disabled = false;
        logoutBtn.style.display = 'block';
      }
    }).catch(() => {
      keyError.textContent = 'Network error. Check your connection.';
      keyError.style.display = 'block';
    });
  }

  const storedKey = localStorage.getItem('apiKey');
  if (storedKey) {
    keyInput.value = storedKey;
    validateAndSave();
  }
});

const chat = document.getElementById('chat');
const entry = document.getElementById('entry');
const sendBtn = document.getElementById('send');
const stopBtn = document.getElementById('stop');
const modelSelect = document.getElementById('model');

entry.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

sendBtn.addEventListener('click', () => sendMessage());

function appendBubble(type, text) {
  const div = document.createElement('div');
  div.className = `bubble ${type}`;
  if (text.includes('*') || text.includes('#')) return;

  const formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');

  div.innerHTML = formattedText;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const text = entry.value.trim();
  if (!text) return;

  appendBubble('user', text);
  entry.value = '';
  sendBtn.disabled = true;
  stopBtn.disabled = false;
  controller = new AbortController();

  const payload = {
    model: modelSelect.value,
    stream: true,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: text }
    ]
  };

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    appendBubble('ai', '');
    let aiNode = chat.lastElementChild;
    let done = false;

    while (!done) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (let line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          done = true;
          break;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices[0].delta.content || '';
          aiNode.innerHTML += delta;
          chat.scrollTop = chat.scrollHeight;
        } catch {}
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }

  sendBtn.disabled = false;
  stopBtn.disabled = true;
}
