export const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mkepugvdlktfsossumox.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

// Mode: 'browse' or 'swipe' (can be overridden via VITE_DEFAULT_MODE)
export const DEFAULT_MODE = import.meta.env.VITE_DEFAULT_MODE || 'browse'

// The ONE loyalty/signup SMS number — every "text to join" link reads this.
// Override per-deploy with VITE_SMS_NUMBER; keywords stay per-surface.
export const SMS_NUMBER = import.meta.env.VITE_SMS_NUMBER || '+12513135464'
