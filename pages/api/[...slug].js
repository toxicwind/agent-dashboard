export default async function handler(req, res) {
  const { slug } = req.query;
  const path = slug.join('/');
  // Map friendly names to actual ports (same as your Caddy reverse proxy)
  const portMap = {
    'openfang': 14720, 'armaraos': 14721, 'ferroclaw': 14726,
    'telethon': 14424, 'n8n': 14755, 'flowise': 14756,
    'openwebui': 14757, 'vllm': 8000
  };
  const agent = slug[0];
  const port = portMap[agent];
  if (!port) return res.status(404).json({ error: 'Agent not found' });
  try {
    const backendUrl = `http://localhost:${port}/${slug.slice(1).join('/')}`;
    const response = await fetch(backendUrl);
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(502).json({ error: 'Agent unreachable' });
  }
}
