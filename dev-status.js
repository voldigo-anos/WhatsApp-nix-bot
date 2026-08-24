// Serveur de statut minimal : le projet est un bot WhatsApp (Node), pas une app web.
// Il sert uniquement à garder l'aperçu Lovable en bonne santé.
const http = require("http");

const PORT = process.env.PORT || 8080;

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NixBot — Bot WhatsApp</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e6e6e6;
 font-family:ui-sans-serif,system-ui,sans-serif}
 .card{text-align:center;padding:2rem}
 h1{font-size:1.6rem;margin:0 0 .5rem} .l{color:#3ddc97;letter-spacing:.2em}
 p{color:#9aa0a6;max-width:38ch;line-height:1.6}
</style></head><body><div class="card">
<h1>🤖 NixBot</h1><div class="l">━━━━━━━━━</div>
<p>Bot WhatsApp (Baileys). Démarrage&nbsp;: <code>npm start</code>.
Les commandes sont dans <code>scripts/cmds/</code>.</p>
</div></body></html>`;

http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page);
}).listen(PORT, () => console.log(`[dev-status] http://localhost:${PORT}`));
