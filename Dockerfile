FROM nginx:alpine

# Copie le site dans le dossier servi par nginx
COPY index.html /usr/share/nginx/html/index.html

# Expose le port 80 (requis par Sliplane)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
