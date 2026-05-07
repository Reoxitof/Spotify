# Spotify Music Site

Site statique avec ma playlist Spotify, déployable sur Sliplane.

## Déploiement sur Sliplane

1. Push ce dossier sur un repo GitHub
2. Sur [sliplane.io](https://sliplane.io), crée un nouveau service
3. Connecte ton repo GitHub
4. Sliplane détecte le `Dockerfile` automatiquement
5. Deploy → ton site est en ligne

## Local

```bash
docker build -t spotify-site .
docker run -p 8080:80 spotify-site
# Ouvre http://localhost:8080
```
