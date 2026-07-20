import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from '../config'

let supabase = null

function getClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  }
  return supabase
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email, password) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured')

  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured')

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Send phone OTP (one-time password)
 */
export async function sendPhoneOTP(phone) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured')

  const normalized = normalizePhone(phone)

  const { data, error } = await client.auth.signInWithOtp({
    phone: normalized,
    channel: 'sms',
  })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Verify phone OTP code
 */
export async function verifyPhoneOTP(phone, code) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured')

  const normalized = normalizePhone(phone)

  const { data, error } = await client.auth.verifyOtp({
    phone: normalized,
    token: code,
    type: 'sms',
  })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Verify email with code
 */
export async function verifyEmailOTP(email, code) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured')

  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code,
    type: 'email',
  })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Password reset
 */
export async function resetPassword(email) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured')

  const { error } = await client.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/auth?reset=1` }
  )

  if (error) throw new Error(error.message)
}

/**
 * Update password with token
 */
export async function updatePassword(password) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured')

  const { error } = await client.auth.updateUser({ password })
  if (error) throw new Error(error.message)
}

/**
 * Get current session
 */
export async function getSession() {
  const client = getClient()
  if (!client) return null

  const { data: { session }, error } = await client.auth.getSession()
  return session
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  if (digits.length >= 10) return `+${digits}`
  return raw
}

export default {
  signUpWithEmail,
  signInWithEmail,
  sendPhoneOTP,
  verifyPhoneOTP,
  verifyEmailOTP,
  resetPassword,
  updatePassword,
  getSession,
}
