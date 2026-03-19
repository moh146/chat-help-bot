const GITHUB_TOKENS = [
    "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", 
    "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", 
    "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"
];

let current_token_index = 0;
let chatHistory = [{ role: "system", content: "You are ZaxaR AI PRO." }];
let controller = null;
let preparedImageBase64 = null;

const md = window.markdownit({
  highlight: function (str, lang) {
    const language = lang || 'code';
    const highlighted = lang && hljs.getLanguage(lang) ? hljs.highlight(str, { language: lang }).value : md.utils.escapeHtml(str);
    return `<div class="code-container"><div class="code-header"><span>${language.toUpperCase()}</span><span style="cursor:pointer" onclick="copyCode(this)"><i class="far fa-copy"></i> COPY</span></div><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
  }
});

window.copyCode = function(btn) {
  const code = btn.closest('.code-container').querySelector('code').innerText;
  const el = document.createElement('textarea');
  el.value = code;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  const old = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i> DONE';
  setTimeout(() => { btn.innerHTML = old; }, 2000);
};

const entry = document.getElementById('entry');
const mainBtn = document.getElementById('mainBtn');
const chat = document.getElementById('chat');

async function sendMessage(retryModel = null) {
  if (controller && !retryModel) { controller.abort(); return; }
  const text = entry.value.trim();
  if (!text && !preparedImageBase64 && !retryModel) return;

  if (!retryModel) {
    let userDisplay = preparedImageBase64 ? `<img src="${preparedImageBase64}" style="max-width:200px; border-radius:10px; margin-bottom:10px;"/><br>` : '';
    userDisplay += md.render(text);
    appendBubble('user', userDisplay, true);

    let apiPayload = [];
    if (preparedImageBase64) apiPayload.push({ type: "image_url", image_url: { url: preparedImageBase64 } });
    apiPayload.push({ type: "text", text: text || "Analyze this image" });

    chatHistory.push({ role: "user", content: apiPayload });
    entry.value = ""; entry.style.height = "45px";
    if(preparedImageBase64) document.getElementById('removeImageBtn').click();
  }

  controller = new AbortController();
  mainBtn.innerHTML = '<i class="fas fa-stop"></i>';
  const aiBubble = appendBubble('ai', "");
  aiBubble.classList.add('typing');

  const selectedModel = retryModel || document.getElementById('modelSelect').value;

  try {
    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GITHUB_TOKENS[current_token_index]}` },
      body: JSON.stringify({ messages: chatHistory, model: selectedModel }),
      signal: controller.signal
    });

    if (res.status === 429 && current_token_index < GITHUB_TOKENS.length - 1) {
      current_token_index++;
      aiBubble.remove();
      return sendMessage(selectedModel);
    }

    const data = await res.json();
    const reply = data.choices[0].message.content;
    aiBubble.classList.remove('typing');
    aiBubble.innerHTML = md.render(reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (e) {
    if (e.name !== 'AbortError') { aiBubble.classList.remove('typing'); aiBubble.textContent = "Error."; }
  } finally {
    controller = null; mainBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    chat.scrollTop = chat.scrollHeight;
  }
}

entry.oninput = function() {
  this.style.height = '45px';
  this.style.height = this.scrollHeight + 'px';
  this.style.overflow = (this.scrollHeight > 200) ? 'auto' : 'hidden';
};

mainBtn.onclick = () => sendMessage();

document.getElementById('clearBtn').onclick = () => { 
    chat.innerHTML = ""; 
    chatHistory = [{ role: "system", content: "You are ZaxaR AI PRO." }]; 
};

function appendBubble(role, content, isRawHtml = false) {
  const div = document.createElement('div');
  div.className = `bubble ${role} markdown-body`;
  div.innerHTML = isRawHtml ? content : md.render(content);
  chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
  return div;
}

entry.onkeydown = (e) => {
    if(e.which == 13 && !e.shiftKey) { return true; } 
    else if (e.which == 13 && e.shiftKey) { e.preventDefault(); sendMessage(); }
};


const imageInput = document.getElementById('imageInput');
document.getElementById('uploadBtn').onclick = () => imageInput.click();

imageInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => { 
      preparedImageBase64 = ev.target.result; 
      const p = document.getElementById('imagePreviewContainer'); 
      p.style.backgroundImage = `url(${preparedImageBase64})`; 
      p.style.display = 'block'; 
  };
  reader.readAsDataURL(file);
};

document.getElementById('removeImageBtn').onclick = () => { 
    preparedImageBase64 = null; 
    imageInput.value = ""; 
    document.getElementById('imagePreviewContainer').style.display = 'none'; 
};
