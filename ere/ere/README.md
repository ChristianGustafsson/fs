# GBFoods Nordics — Holographic Strategy Journey (LIVE)

This repository packages your **23-slide holographic deck** and upgrades it into an **interactive, cinematic experience** you can deploy on **Netlify**:

- **Cinematic background video** with a holographic blend layer
- **Live KPI HUD** (animated numbers synced to the journey years)
- **Live Presenter Avatar** (canvas) with **lipsync** (best when AI TTS is enabled)
- **Strategy Q&A chatbot** that answers using the deck content

## 1) Local run (static)

Just open `index.html` directly in a browser.

## 2) Deploy on Netlify (recommended)

1. Create a new GitHub repo (example name: `gbfoods-holo-live`).
2. Push this folder contents to the repo.
3. In Netlify: **Add new site → Import an existing project → GitHub**.
4. Build settings:
   - **Build command:** *(empty)*
   - **Publish directory:** `.`

### Environment variables (to enable avatar lipsync + chatbot)

Set these in Netlify (Site settings → Environment variables):

- `OPENAI_API_KEY` (required for Chat + AI TTS)
- `OPENAI_MODEL` *(optional)* defaults to `gpt-4o-mini`
- `OPENAI_TTS_MODEL` *(optional)* defaults to `gpt-4o-mini-tts`

After setting the variables, redeploy.

## Controls

- **← / →**: Previous / Next slide
- **P**: Presenter notes panel
- **R**: Restart
- **Space**: Pause/Resume deck narration

Extra LIVE toggles:
- **LIVE: ON/OFF** (L)
- **AVATAR: ON/OFF** (V)
- **CHAT: ON/OFF** (C)
- **VOICE MODE:** `BROWSER` or `AI (Netlify)`

## Replace assets

- Presenter avatar image: `assets/avatar/avatar.png`
  - Add a face photo (1024x1024+) and it will be used automatically.

- Background video: `assets/video/scene_the_vigil.mp4`
  - Replace with your own cinematic loop (keep the filename or update the `<source>` in `index.html`).

## Notes

- The chatbot uses the deck content extracted into `data/deck_facts.json` and retrieves the most relevant slides for each question.
- For the most convincing **lipsync**, use **VOICE MODE: AI (Netlify)** (requires `OPENAI_API_KEY`).
