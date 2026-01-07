import { Router, Request, Response } from 'express';
import { InteractionEngine } from '../services/InteractionEngine';
import { validateChannelId } from '../utils/validation';

const router = Router();
const interactionEngine = new InteractionEngine();

// Enable live chat for a channel
router.post('/:channelId/chat/enable', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const chatConfig = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    await interactionEngine.enableLiveChat(channelId, chatConfig);
    return res.json({ message: 'Live chat enabled successfully' });
  } catch (error) {
    console.error('Error enabling live chat:', error);
    return res.status(500).json({ 
      error: 'Failed to enable live chat',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send chat message
router.post('/:channelId/chat/message', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { message, username, viewerId } = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    if (!message || !username || !viewerId) {
      return res.status(400).json({ error: 'Message, username, and viewerId are required' });
    }

    const chatMessage = await interactionEngine.sendChatMessage(
      channelId,
      { message, username },
      viewerId
    );

    return res.json(chatMessage);
  } catch (error) {
    console.error('Error sending chat message:', error);
    return res.status(500).json({ 
      error: 'Failed to send chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a poll
router.post('/:channelId/polls', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const pollRequest = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    if (!pollRequest.question || !pollRequest.options || !pollRequest.duration) {
      return res.status(400).json({ error: 'Question, options, and duration are required' });
    }

    const poll = await interactionEngine.createPoll(channelId, pollRequest);
    return res.json(poll);
  } catch (error) {
    console.error('Error creating poll:', error);
    return res.status(500).json({ 
      error: 'Failed to create poll',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Vote on a poll
router.post('/polls/:pollId/vote', async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const { viewerId, optionIndex } = req.body;

    if (!viewerId || optionIndex === undefined) {
      return res.status(400).json({ error: 'ViewerId and optionIndex are required' });
    }

    await interactionEngine.votePoll(pollId, viewerId, optionIndex);
    return res.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error voting on poll:', error);
    return res.status(500).json({ 
      error: 'Failed to vote on poll',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Vote on content
router.post('/:channelId/content/vote', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { viewerId, contentId, voteType } = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    if (!viewerId || !contentId || !voteType) {
      return res.status(400).json({ error: 'ViewerId, contentId, and voteType are required' });
    }

    await interactionEngine.voteContent(channelId, viewerId, { contentId, voteType });
    return res.json({ message: 'Content vote recorded successfully' });
  } catch (error) {
    console.error('Error voting on content:', error);
    return res.status(500).json({ 
      error: 'Failed to vote on content',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Integrate social media feed
router.post('/:channelId/social/integrate', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { platforms } = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    if (!platforms || !Array.isArray(platforms)) {
      return res.status(400).json({ error: 'Platforms array is required' });
    }

    await interactionEngine.integrateSocialFeed(channelId, platforms);
    return res.json({ message: 'Social feed integrated successfully' });
  } catch (error) {
    console.error('Error integrating social feed:', error);
    return res.status(500).json({ 
      error: 'Failed to integrate social feed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add social feed item
router.post('/:channelId/social/items', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const feedItem = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const item = await interactionEngine.addSocialFeedItem(channelId, feedItem);
    return res.json(item);
  } catch (error) {
    console.error('Error adding social feed item:', error);
    return res.status(500).json({ 
      error: 'Failed to add social feed item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trigger viewer effect
router.post('/:channelId/effects/trigger', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { viewerId, effectId } = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    if (!viewerId || !effectId) {
      return res.status(400).json({ error: 'ViewerId and effectId are required' });
    }

    await interactionEngine.triggerEffect(channelId, { viewerId, effectId });
    return res.json({ message: 'Effect triggered successfully' });
  } catch (error) {
    console.error('Error triggering effect:', error);
    return res.status(500).json({ 
      error: 'Failed to trigger effect',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get viewer points
router.get('/:channelId/viewers/:viewerId/points', async (req: Request, res: Response) => {
  try {
    const { channelId, viewerId } = req.params;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const points = await interactionEngine.getViewerPoints(channelId, viewerId);
    return res.json(points);
  } catch (error) {
    console.error('Error getting viewer points:', error);
    return res.status(500).json({ 
      error: 'Failed to get viewer points',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get interaction configuration
router.get('/:channelId/config', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const config = await interactionEngine.getInteractionConfig(channelId);
    return res.json(config);
  } catch (error) {
    console.error('Error getting interaction config:', error);
    return res.status(500).json({ 
      error: 'Failed to get interaction config',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update interaction configuration
router.put('/:channelId/config', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const updates = req.body;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const config = await interactionEngine.updateInteractionConfig(channelId, updates);
    return res.json(config);
  } catch (error) {
    console.error('Error updating interaction config:', error);
    return res.status(500).json({ 
      error: 'Failed to update interaction config',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get interaction metrics
router.get('/:channelId/metrics', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { startTime, endTime } = req.query;

    if (!validateChannelId(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;

    const metrics = await interactionEngine.getInteractionMetrics(channelId, start, end);
    return res.json(metrics);
  } catch (error) {
    console.error('Error getting interaction metrics:', error);
    return res.status(500).json({ 
      error: 'Failed to get interaction metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;