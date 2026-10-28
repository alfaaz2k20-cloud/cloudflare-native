import { Hono } from 'hono';
import { Env, Variables } from '../types';
import { askCuratorAi } from '../services/curator';
import { slidingWindowRateLimit } from '../middleware/rate_limit';

const curatorRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Rate limit: 20 queries per minute per IP for Curator AI
const curatorLimiter = slidingWindowRateLimit({
  windowSeconds: 60,
  maxRequests: 20,
  keyPrefix: 'curator_limit'
});

// POST /phantom/ask - Primary conversational endpoint for Curator AI
curatorRouter.post('/ask', curatorLimiter, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const question = (body.question || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) {
      return c.json({ answer: 'Please share your contemplation or inquiry.' });
    }

    const answer = await askCuratorAi(c.env, question, history);
    return c.json({ answer });
  } catch (err: any) {
    console.error('Curator AI request processing error:', err);
    return c.json({
      answer: 'The Curator is temporarily contemplating in quiet reflection. Please inquire again momentarily.'
    });
  }
});

export default curatorRouter;
