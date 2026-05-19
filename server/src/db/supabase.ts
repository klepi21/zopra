import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import logger from '../utils/logger';

// Polyfill global WebSocket for Node environments
(global as any).WebSocket = WebSocket;

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.warn('Supabase URL or Service Role Key missing from environment variables');
}

export const supabase = createClient(
  supabaseUrl || 'https://mock.supabase.co',
  supabaseServiceKey || 'mock-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);
