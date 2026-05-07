require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Config ──────────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Échange le refresh_token contre un access_token frais
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

// Sert le frontend
app.use(express.static(path.join(__dirname, 'public')));

// API : chanson en cours
app.get('/api/now-playing', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { data, status } = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );

    if (status === 204 || !data || !data.item) {
      return res.json({ isPlaying: false });
    }

    const track = data.item;
    res.json({
      isPlaying:    data.is_playing,
      title:        track.name,
      artist:       track.artists.map(a => a.name).join(', '),
      album:        track.album.name,
      albumArt:     track.album.images[0]?.url,
      songUrl:      track.external_urls.spotify,
      progress:     data.progress_ms,
      duration:     track.duration_ms,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Spotify API error' });
  }
});

// ── OAuth flow (pour obtenir le refresh_token une seule fois) ─────────────────

// Étape 1 : redirige vers Spotify
app.get('/login', (req, res) => {
  const scopes = 'user-read-currently-playing user-read-playback-state';
  const url = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI || 'http://localhost:3000/callback')}`;
  res.redirect(url);
});

// Étape 2 : Spotify renvoie ici avec un code
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  try {
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI || 'http://localhost:3000/callback',
      }),
      { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    // Affiche le refresh_token à copier dans .env
    res.send(`
      <h2>✅ Connexion réussie !</h2>
      <p>Copie ce <strong>refresh_token</strong> dans ton fichier <code>.env</code> :</p>
      <pre style="background:#111;color:#1db954;padding:16px;border-radius:8px;font-size:1.1rem">${data.refresh_token}</pre>
      <p>Puis redémarre le serveur et va sur <a href="/">/</a></p>
    `);
  } catch (err) {
    res.status(500).send('Erreur lors de l\'échange du token : ' + err.message);
  }
});

app.listen(PORT, () => console.log(`🎵 Serveur démarré sur http://localhost:${PORT}`));
