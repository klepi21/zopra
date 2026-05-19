import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { supabase } from '../db/supabase';
import logger from '../utils/logger';

const router = Router();

export async function handleClerkWebhook(req: Request, res: Response) {
  const payload = JSON.stringify(req.body);
  const headers = req.headers;

  const svixId = headers['svix-id'] as string;
  const svixTimestamp = headers['svix-timestamp'] as string;
  const svixSignature = headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: 'Missing Svix headers' });
  }

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('CLERK_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  try {
    const wh = new Webhook(webhookSecret);
    const evt: any = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });

    const { id: clerkId, username, image_url, email_addresses } = evt.data;
    const eventType = evt.type;

    logger.info(`Received Clerk webhook event: ${eventType} for user ${clerkId}`);

    if (eventType === 'user.created') {
      // If username is not provided, generate a default one
      const finalUsername = username || 
        (email_addresses && email_addresses[0] ? email_addresses[0].email_address.split('@')[0] : `player_${clerkId.slice(-6)}`);
      
      const { error } = await supabase
        .from('users')
        .insert({
          clerk_id: clerkId,
          username: finalUsername,
          avatar_url: image_url || null,
        });

      if (error) {
        logger.error(`Error inserting user ${clerkId} from webhook:`, error);
        return res.status(500).json({ error: 'Error syncing user' });
      }
    } else if (eventType === 'user.updated') {
      const updateData: any = {};
      if (username) updateData.username = username;
      if (image_url) updateData.avatar_url = image_url;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('clerk_id', clerkId);

        if (error) {
          logger.error(`Error updating user ${clerkId} from webhook:`, error);
          return res.status(500).json({ error: 'Error syncing user update' });
        }
      }
    } else if (eventType === 'user.deleted') {
      // Soft delete by clearing username or delete record depending on policy
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('clerk_id', clerkId);

      if (error) {
        logger.error(`Error deleting user ${clerkId} from webhook:`, error);
        return res.status(500).json({ error: 'Error syncing user deletion' });
      }
    }

    res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error('Webhook verification or processing failed:', err);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
}

router.post('/clerk', handleClerkWebhook);

export default router;
