import { createWebhookServer } from './adapters/webhook-server.js';

const PORT = Number(process.env.PORT) || 3000;
const server = createWebhookServer();

server.listen(PORT, () => {
  console.log(`pr-review-agent listening on http://localhost:${PORT}`);
});
