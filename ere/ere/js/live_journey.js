/*
  GBFoods Nordics — Holographic Strategy Journey (LIVE EXTENSIONS)
  Adds:
   - Cinematic background video layer
   - Live KPI HUD (animated numbers)
   - Live Presenter avatar (canvas) with lipsync
   - Strategy Q&A chatbot (Netlify Functions + OpenAI)

  Works as a progressive enhancement: the original deck remains unchanged.
*/

(() => {
  // ---------------------------
  // DOM
  // ---------------------------
  const videoHud = document.getElementById('video-hud');
  const bgVideo = document.getElementById('bg-video');

  const kpiSales = document.getElementById('kpi-sales');
  const kpiSalesSub = document.getElementById('kpi-sales-sub');
  const kpiEbit = document.getElementById('kpi-ebit');
  const kpiEbitSub = document.getElementById('kpi-ebit-sub');
  const kpiGm = document.getElementById('kpi-gm');
  const kpiGmSub = document.getElementById('kpi-gm-sub');
  const kpiOsa = document.getElementById('kpi-osa');
  const kpiOsaSub = document.getElementById('kpi-osa-sub');

  const tickerText = document.getElementById('ticker-text');

  const btnLive = document.getElementById('btn-live');
  const btnAvatar = document.getElementById('btn-avatar');
  const btnChat = document.getElementById('btn-chat');
  const btnVoiceMode = document.getElementById('btn-voice-mode');

  const avatarDock = document.getElementById('avatar-dock');
  const avatarCanvas = document.getElementById('avatar-canvas');

  // Optional: use your own avatar image if present at assets/avatar/avatar.png
  const avatarImg = new Image();
  let avatarImgReady = false;
  avatarImg.onload = () => { avatarImgReady = true; };
  avatarImg.onerror = () => { avatarImgReady = false; };
  avatarImg.src = 'assets/avatar/avatar.png';

  const avatarStatus = document.getElementById('avatar-status');
  const btnAvatarSay = document.getElementById('btn-avatar-say');
  const btnAvatarStop = document.getElementById('btn-avatar-stop');

  const chatDock = document.getElementById('chat-dock');
  const chatStatus = document.getElementById('chat-status');
  const chatLog = document.getElementById('chat-log');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const btnChatClear = document.getElementById('btn-chat-clear');

  // If the base HTML changes and elements are missing, fail silently.
  if (!videoHud || !bgVideo || !btnLive || !avatarDock || !chatDock) return;

  // ---------------------------
  // State
  // ---------------------------
  let liveOn = true;
  let avatarOn = true;
  let chatOn = false;

  // Voice modes:
  //  - 'browser': SpeechSynthesis with pseudo-lipsync
  //  - 'ai': OpenAI TTS via Netlify function + analyser lipsync
  let voiceMode = 'browser';

  // Current year follows slide keys where relevant.
  let journeyYear = 2025;

  // KPI timeline (defaults match the deck baseline / targets)
  const kpiTimeline = {
    salesMEUR: { 2025: 63.1, 2026: 71, 2027: 81, 2028: 91, 2029: 100 },
    ebitRange: {
      2025: '16.0% (2025 base)',
      2026: '16–18%',
      2027: '18–20%',
      2028: '19–21%',
      2029: '20–22%'
    },
    gmPct: { 2025: 41.3, 2026: 41.3, 2027: 41.3, 2028: 41.3, 2029: 41.3 },
    gmGate: 'Hard gate: 39.5%'
  };

  const slideYearMap = {
    baseline_2025: 2025,
    year_2026: 2026,
    year_2027: 2027,
    year_2028: 2028,
    year_2029: 2029
  };

  // Live pulse simulation
  let pulse = {
    osa: 90,
    dist: 84,
    promo: 7.2,
    rgm: 1.6
  };
  let pulseTimer = null;

  // ---------------------------
  // Helpers
  // ---------------------------
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function fmtMEUR(x) {
    const v = Math.round(x * 10) / 10;
    return `${v.toFixed(v % 1 ? 1 : 0)}M€`;
  }

  function animateNumber(el, from, to, formatter, ms = 850) {
    if (!el) return;
    const start = performance.now();
    const f = Number(from);
    const t = Number(to);
    const step = (now) => {
      const p = clamp((now - start) / ms, 0, 1);
      // smoothstep
      const s = p * p * (3 - 2 * p);
      const v = f + (t - f) * s;
      el.textContent = formatter(v);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setVisible(el, on, hiddenClass = 'hidden') {
    if (!el) return;
    if (on) el.classList.remove(hiddenClass);
    else el.classList.add(hiddenClass);
  }

  function setDockHidden(el, on) {
    // chat dock uses dock-hidden (display:none)
    if (!el) return;
    if (on) el.classList.remove('dock-hidden');
    else el.classList.add('dock-hidden');
  }

  function pushChat(role, text) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg';
    const r = document.createElement('div');
    r.className = 'chat-role';
    r.textContent = role;
    const b = document.createElement('div');
    b.className = 'chat-bubble';
    b.textContent = text;
    wrap.appendChild(r);
    wrap.appendChild(b);
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // ---------------------------
  // KPI HUD
  // ---------------------------
  function updateKpisForYear(year) {
    const prevYear = journeyYear;
    journeyYear = year;

    const sFrom = kpiTimeline.salesMEUR[prevYear] ?? kpiTimeline.salesMEUR[2025];
    const sTo = kpiTimeline.salesMEUR[year] ?? kpiTimeline.salesMEUR[2025];

    if (liveOn) {
      animateNumber(kpiSales, sFrom, sTo, fmtMEUR, 900);
    } else {
      kpiSales.textContent = fmtMEUR(sTo);
    }

    kpiSalesSub.textContent = `${year} track • baseline 2025: ${fmtMEUR(kpiTimeline.salesMEUR[2025])}`;

    kpiEbit.textContent = kpiTimeline.ebitRange[year] || kpiTimeline.ebitRange[2025];
    kpiEbitSub.textContent = `EBIT ambition by year`;

    const gm = kpiTimeline.gmPct[year] ?? kpiTimeline.gmPct[2025];
    kpiGm.textContent = `${gm.toFixed(1)}%`;
    kpiGmSub.textContent = kpiTimeline.gmGate;
  }

  function startPulse() {
    if (pulseTimer) return;
    pulseTimer = setInterval(() => {
      pulse.osa = clamp(pulse.osa + (Math.random() - 0.45) * 1.2, 86, 96);
      pulse.dist = clamp(pulse.dist + (Math.random() - 0.5) * 1.4, 78, 92);
      pulse.promo = clamp(pulse.promo + (Math.random() - 0.5) * 0.35, 5.5, 9.5);
      pulse.rgm = clamp(pulse.rgm + (Math.random() - 0.5) * 0.22, 0.2, 3.5);

      if (kpiOsa) kpiOsa.textContent = `OSA ${Math.round(pulse.osa)}%`;
      if (kpiOsaSub) kpiOsaSub.textContent = `Dist ${Math.round(pulse.dist)}% • Promo ${pulse.promo.toFixed(1)}% • RGM +${pulse.rgm.toFixed(1)}pp`;

      if (tickerText) {
        const messages = [
          `WEEKLY PULSE • OSA ${Math.round(pulse.osa)}% • Dist ${Math.round(pulse.dist)}% • Promo ${pulse.promo.toFixed(1)}% • RGM +${pulse.rgm.toFixed(1)}pp`,
          `MISSION UPDATE • Field Force hybrid rollout: priority stores + digital execution`,
          `MISSION UPDATE • NPD: Health & Premium pipeline in-flight • clear kill-gates`,
          `MISSION UPDATE • Foodservice focus: higher probability segments only`,
          `MISSION UPDATE • 90% channel coverage model: strongest distributor fit`,
          `MISSION UPDATE • Portfolio simplification: fewer SKUs, faster rotation`,
        ];
        tickerText.textContent = messages[Math.floor(Math.random() * messages.length)];
      }
    }, 2200);
  }

  function stopPulse() {
    if (!pulseTimer) return;
    clearInterval(pulseTimer);
    pulseTimer = null;
  }

  // ---------------------------
  // Avatar (canvas) + lipsync
  // ---------------------------
  const ctx = avatarCanvas.getContext('2d');
  let mouth = 0; // 0..1
  let blink = 0;
  let talking = false;

  // Audio playback + analyser for AI TTS mode
  let audioEl = null;
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;
  let rafAudio = null;

  function ensureAudioGraph() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }

  function stopAvatarAudio() {
    talking = false;
    mouth = 0;
    if (audioEl) {
      try { audioEl.pause(); } catch (_) {}
      audioEl = null;
    }
    if (rafAudio) {
      cancelAnimationFrame(rafAudio);
      rafAudio = null;
    }
  }

  function startAnalyserLoop() {
    if (!analyser || !dataArray) return;
    const loop = () => {
      analyser.getByteTimeDomainData(dataArray);
      // Compute RMS
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      mouth = clamp(rms * 6.5, 0, 1);
      rafAudio = requestAnimationFrame(loop);
    };
    rafAudio = requestAnimationFrame(loop);
  }

  function drawAvatar() {
    const w = avatarCanvas.width;
    const h = avatarCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Holo background
    const g = ctx.createRadialGradient(w * 0.35, h * 0.25, 10, w * 0.35, h * 0.25, Math.max(w, h));
    g.addColorStop(0, 'rgba(0,240,255,0.18)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);

    // Head
    const cx = w * 0.5;
    const cy = h * 0.48;
    const r = Math.min(w, h) * 0.32;

    // Glow halo
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,240,255,0.08)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();

    // Optional: draw user avatar image inside the head (auto-detect assets/avatar/avatar.png)
    if (avatarImgReady) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.985, 0, Math.PI * 2);
      ctx.clip();

      // Cover-fit into the circular mask
      const iw = avatarImg.naturalWidth || 1024;
      const ih = avatarImg.naturalHeight || 1024;
      const box = r * 2;
      const scale = Math.max(box / iw, box / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = cx - dw / 2;
      const dy = cy - dh / 2;

      ctx.globalAlpha = 0.95;
      ctx.drawImage(avatarImg, dx, dy, dw, dh);

      // Holo tint + scan shimmer
      ctx.globalAlpha = 0.18;
      const tint = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      tint.addColorStop(0, 'rgba(0,240,255,0.55)');
      tint.addColorStop(1, 'rgba(255,0,255,0.20)');
      ctx.fillStyle = tint;
      ctx.fillRect(cx - r, cy - r, box, box);

      ctx.restore();
    }

    // Holo outline
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Eyes
    const eyeY = cy - r * 0.15;
    const eyeX = r * 0.35;
    const eyeW = r * 0.18;
    const eyeH = r * 0.10;

    // Blink animation
    if (Math.random() < 0.01) blink = 1;
    blink *= 0.86;
    const blinkH = eyeH * (1 - clamp(blink, 0, 1));

    function eye(x) {
      ctx.beginPath();
      ctx.roundRect(x - eyeW, eyeY - blinkH, eyeW * 2, Math.max(2, blinkH * 2), 10);
      ctx.fillStyle = 'rgba(224,244,255,0.85)';
      ctx.fill();
      // pupil
      ctx.beginPath();
      ctx.arc(x, eyeY, eyeW * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,240,255,0.85)';
      ctx.fill();
    }

    eye(cx - eyeX);
    eye(cx + eyeX);

    // Mouth
    const mouthY = cy + r * 0.25;
    const mouthW = r * 0.55;
    const mouthH = r * 0.10 + mouth * r * 0.22;

    ctx.beginPath();
    ctx.roundRect(cx - mouthW * 0.5, mouthY - mouthH * 0.5, mouthW, mouthH, 18);
    ctx.fillStyle = 'rgba(0,240,255,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Subtitle
    ctx.font = `${Math.round(r * 0.16)}px Orbitron, sans-serif`;
    ctx.fillStyle = 'rgba(224,244,255,0.70)';
    ctx.textAlign = 'center';
    ctx.fillText('CHRISTIAN // LIVE PRESENTER', cx, h - 26);

    requestAnimationFrame(drawAvatar);
  }

  // Polyfill: roundRect for older browsers
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      const radius = Array.isArray(r) ? r : [r, r, r, r];
      this.beginPath();
      this.moveTo(x + radius[0], y);
      this.lineTo(x + w - radius[1], y);
      this.quadraticCurveTo(x + w, y, x + w, y + radius[1]);
      this.lineTo(x + w, y + h - radius[2]);
      this.quadraticCurveTo(x + w, y + h, x + w - radius[2], y + h);
      this.lineTo(x + radius[3], y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - radius[3]);
      this.lineTo(x, y + radius[0]);
      this.quadraticCurveTo(x, y, x + radius[0], y);
      this.closePath();
      return this;
    };
  }

  // Browser TTS pseudo-lipsync: open mouth on word boundaries.
  function browserSpeak(text) {
    if (!('speechSynthesis' in window)) {
      avatarStatus.textContent = 'SpeechSynthesis unavailable';
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    u.onstart = () => {
      talking = true;
      avatarStatus.textContent = 'Speaking (browser)…';
    };
    u.onboundary = () => {
      // quick open/close
      mouth = 1;
      setTimeout(() => { mouth = 0.25; }, 60);
      setTimeout(() => { mouth = 0; }, 130);
    };
    u.onend = () => {
      talking = false;
      mouth = 0;
      avatarStatus.textContent = 'Ready • Holo-voice';
    };
    u.onerror = () => {
      talking = false;
      mouth = 0;
      avatarStatus.textContent = 'Voice error (browser)';
    };

    // Prefer English GB/US.
    const synth = window.speechSynthesis;
    const voices = synth.getVoices?.() || [];
    const preferred = voices.find(v => /en-GB/i.test(v.lang)) || voices.find(v => /en-US/i.test(v.lang)) || voices[0];
    if (preferred) u.voice = preferred;
    synth.speak(u);
  }

  async function aiSpeak(text) {
    stopAvatarAudio();
    ensureAudioGraph();

    avatarStatus.textContent = 'Synthesizing voice (AI)…';
    talking = true;

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        // recommend: marin/cedar for best quality
        voice: 'marin',
        format: 'wav',
        instructions: 'Warm, confident Nordic business presenter. Clear articulation. Subtle enthusiasm. No dramatic acting.'
      })
    });

    if (!res.ok) {
      talking = false;
      avatarStatus.textContent = `AI voice offline (${res.status}). Set OPENAI_API_KEY on Netlify.`;
      return;
    }

    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    audioEl = new Audio(url);
    audioEl.crossOrigin = 'anonymous';

    // Connect analyser
    const srcNode = audioCtx.createMediaElementSource(audioEl);
    srcNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    audioEl.onended = () => {
      talking = false;
      mouth = 0;
      avatarStatus.textContent = 'Ready • Holo-voice';
      try { URL.revokeObjectURL(url); } catch (_) {}
      stopAvatarAudio();
    };

    await audioCtx.resume();
    await audioEl.play();
    avatarStatus.textContent = 'Speaking (AI)…';
    startAnalyserLoop();
  }

  async function avatarSpeak(text) {
    if (!text || !text.trim()) return;
    try {
      if (voiceMode === 'ai') await aiSpeak(text);
      else browserSpeak(text);
    } catch (e) {
      avatarStatus.textContent = 'Voice error';
      talking = false;
      mouth = 0;
    }
  }

  // ---------------------------
  // Chatbot
  // ---------------------------
  async function askChatbot(question) {
    const slide = (typeof slides !== 'undefined' && typeof currentSlide !== 'undefined') ? slides[currentSlide] : null;

    const payload = {
      question,
      context: {
        slide_key: slide?.key || null,
        slide_name: slide?.name || null,
        year: journeyYear,
        // Include the current slide narration + a compact text snippet as “local context”
        slide_script: slide?.script || '',
        slide_hint: (slide?.html || '').slice(0, 2000)
      }
    };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Chat API ${res.status}: ${t}`);
    }

    const data = await res.json();
    return data.answer || 'No answer';
  }

  // ---------------------------
  // Hook into the deck
  // ---------------------------
  function onSlideChanged(slide) {
    const mapped = slideYearMap[slide.key];
    if (mapped) updateKpisForYear(mapped);

    // Cinematic video behavior: gently seek/advance on year slides.
    if (mapped && bgVideo && bgVideo.readyState >= 2) {
      // Spread key moments across the clip length.
      const dur = bgVideo.duration || 1;
      const pct = (mapped - 2025) / 4; // 0..1
      bgVideo.currentTime = dur * clamp(0.05 + 0.90 * pct, 0, 0.95);
    }
  }

  // Wrap playSlide (progressive enhancement)
  if (typeof playSlide === 'function') {
    const _playSlide = playSlide;
    // eslint-disable-next-line no-global-assign
    playSlide = function(index) {
      _playSlide(index);
      try {
        const slide = slides[currentSlide];
        onSlideChanged(slide);
      } catch (_) {}
    };
  }

  // ---------------------------
  // Controls
  // ---------------------------
  function applyToggles() {
    btnLive.textContent = `LIVE: ${liveOn ? 'ON' : 'OFF'}`;
    btnAvatar.textContent = `AVATAR: ${avatarOn ? 'ON' : 'OFF'}`;
    btnChat.textContent = `CHAT: ${chatOn ? 'ON' : 'OFF'}`;
    btnVoiceMode.textContent = `VOICE MODE: ${voiceMode.toUpperCase()}`;

    setVisible(videoHud, liveOn);
    setVisible(avatarDock, avatarOn);
    setDockHidden(chatDock, chatOn);

    if (liveOn) startPulse();
    else stopPulse();
  }

  btnLive.addEventListener('click', () => {
    liveOn = !liveOn;
    applyToggles();
  });

  btnAvatar.addEventListener('click', () => {
    avatarOn = !avatarOn;
    if (!avatarOn) stopAvatarAudio();
    applyToggles();
  });

  btnChat.addEventListener('click', () => {
    chatOn = !chatOn;
    applyToggles();
  });

  btnVoiceMode.addEventListener('click', () => {
    // cycle
    voiceMode = voiceMode === 'browser' ? 'ai' : 'browser';
    stopAvatarAudio();
    applyToggles();

    if (voiceMode === 'ai') {
      avatarStatus.textContent = 'AI voice ready (requires OPENAI_API_KEY on Netlify)';
    } else {
      avatarStatus.textContent = 'Ready • Holo-voice';
    }
  });

  btnAvatarSay.addEventListener('click', () => {
    try {
      const slide = slides[currentSlide];
      const text = slide?.script || slide?.name || 'Strategy journey.';
      avatarSpeak(text);
    } catch (_) {
      avatarSpeak('Strategy journey.');
    }
  });

  btnAvatarStop.addEventListener('click', () => {
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    stopAvatarAudio();
    avatarStatus.textContent = 'Stopped';
    setTimeout(() => { avatarStatus.textContent = 'Ready • Holo-voice'; }, 500);
  });

  btnChatClear.addEventListener('click', () => {
    chatLog.innerHTML = '';
    pushChat('system', 'Cleared. Ask me about any slide, number, gate, or execution plan.');
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = (chatInput.value || '').trim();
    if (!q) return;

    pushChat('you', q);
    chatInput.value = '';

    chatStatus.textContent = 'Thinking…';
    try {
      const a = await askChatbot(q);
      pushChat('assistant', a);
      chatStatus.textContent = 'Online';

      // Optional: have the avatar speak answers when visible
      if (avatarOn && voiceMode !== 'off') {
        avatarSpeak(a);
      }
    } catch (err) {
      pushChat('assistant', 'Chat is offline. On Netlify: set OPENAI_API_KEY (and optionally OPENAI_MODEL).');
      chatStatus.textContent = 'Offline';
    }
  });

  // Keyboard shortcuts (non-invasive)
  window.addEventListener('keydown', (e) => {
    if (e.key?.toLowerCase() === 'l') {
      liveOn = !liveOn;
      applyToggles();
    }
    if (e.key?.toLowerCase() === 'c') {
      chatOn = !chatOn;
      applyToggles();
    }
    if (e.key?.toLowerCase() === 'v') {
      avatarOn = !avatarOn;
      applyToggles();
    }
  });

  // ---------------------------
  // Boot
  // ---------------------------
  // Try autoplay (some browsers block unmuted autoplay; we keep it muted)
  bgVideo.muted = true;
  bgVideo.play().catch(() => {});

  // Initial KPI state
  updateKpisForYear(2025);

  // Prime UI
  applyToggles();

  // Start avatar render loop
  requestAnimationFrame(drawAvatar);

  // UX: show a welcome message in chat
  pushChat('system', 'Ask anything about the journey. Examples: “What are the hard gates?”, “How do we reach 100M€?”, “What changes in field force?”');
})();
