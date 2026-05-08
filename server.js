require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Config ───────────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const ADMIN_SECRET  = process.env.ADMIN_SECRET || 'changeme';

// ── State en mémoire ─────────────────────────────────────────────────────────
let jamLink = null; // lien Jam Spotify du moment

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getAccessToken() {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: REFRESH_TOKEN }),
    { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data.access_token;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Frontend
app.use(express.static(path.join(__dirname, 'public')));

// API : chanson en cours
app.get('/api/now-playing', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { data, status } = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (status === 204 || !data || !data.item) return res.json({ isPlaying: false });
    const track = data.item;
    res.json({
      isPlaying: data.is_playing,
      title:     track.name,
      artist:    track.artists.map(a => a.name).join(', '),
      album:     track.album.name,
      albumArt:  track.album.images[0]?.url,
      songUrl:   track.external_urls.spotify,
      progress:  data.progress_ms,
      duration:  track.duration_ms,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Spotify API error' });
  }
});

// API : lire le lien Jam (public)
app.get('/api/jam', (req, res) => {
  res.json({ jamLink });
});

// API : mettre à jour le lien Jam (protégé par ADMIN_SECRET)
app.post('/api/jam', (req, res) => {
  const { secret, link } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });
  jamLink = link || null;
  console.log(`🎵 Jam link mis à jour : ${jamLink}`);
  res.json({ ok: true, jamLink });
});

// Page admin simple pour setter le lien Jam
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Admin – Jam Link</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { min-height:100vh; background:#0a0a0a; display:flex; align-items:center; justify-content:center; font-family:'Segoe UI',sans-serif; }
    .card { background:rgba(255,255,255,0.05); border:1px solid rgba(29,185,84,0.3); border-radius:20px; padding:36px; width:90%; max-width:440px; }
    h2 { color:#1db954; margin-bottom:24px; font-size:1.2rem; }
    label { color:rgba(255,255,255,0.6); font-size:0.8rem; display:block; margin-bottom:6px; }
    input { width:100%; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:12px 14px; color:#fff; font-size:0.9rem; margin-bottom:16px; outline:none; }
    input:focus { border-color:#1db954; }
    button { width:100%; background:#1db954; color:#000; font-weight:700; border:none; border-radius:10px; padding:13px; font-size:0.95rem; cursor:pointer; transition:opacity .2s; }
    button:hover { opacity:0.85; }
    .msg { margin-top:14px; text-align:center; font-size:0.85rem; color:#1db954; min-height:20px; }
    .clear-btn { margin-top:10px; background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.5); }
  </style>
</head>
<body>
<div class="card">
  <h2>🎵 Gérer le lien Jam</h2>
  <label>Mot de passe admin</label>
  <input type="password" id="secret" placeholder="••••••••"/>
  <label>Lien Jam Spotify</label>
  <input type="url" id="link" placeholder="https://spotify.com/jam/..."/>
  <button onclick="setJam()">Mettre à jour</button>
  <button class="clear-btn" onclick="clearJam()">Supprimer le lien Jam</button>
  <div class="msg" id="msg"></div>
</div>
<script>
  async function setJam() {
    const secret = document.getElementById('secret').value;
    const link   = document.getElementById('link').value;
    const r = await fetch('/api/jam', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({secret, link}) });
    const d = await r.json();
    document.getElementById('msg').textContent = d.ok ? '✅ Lien mis à jour !' : '❌ ' + d.error;
  }
  async function clearJam() {
    const secret = document.getElementById('secret').value;
    const r = await fetch('/api/jam', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({secret, link: null}) });
    const d = await r.json();
    document.getElementById('msg').textContent = d.ok ? '✅ Lien supprimé' : '❌ ' + d.error;
  }
</script>
</body>
</html>`);
});

// ── OAuth ─────────────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  const scopes = 'user-read-currently-playing user-read-playback-state';
  const url = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI || 'http://localhost:3000/callback')}`;
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  try {
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.REDIRECT_URI || 'http://localhost:3000/callback' }),
      { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    res.send(`
      <h2>✅ Connexion réussie !</h2>
      <p>Copie ce <strong>refresh_token</strong> dans Sliplane :</p>
      <pre style="background:#111;color:#1db954;padding:16px;border-radius:8px;font-size:1rem;word-break:break-all">${data.refresh_token}</pre>
      <p><a href="/" style="color:#1db954">← Retour au site</a></p>
    `);
  } catch (err) {
    res.status(500).send('Erreur : ' + err.message);
  }
});

app.listen(PORT, () => console.log(`🎵 Serveur démarré sur http://localhost:${PORT}`));
