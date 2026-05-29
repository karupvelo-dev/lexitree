'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { scoreToLevel } from '@/lib/level'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = still loading, null = no session

  // Fetch profile and sync level to localStorage.
  // Returns true if a profile with a valid score was found, false otherwise.
  async function syncProfileToStorage(u) {
    if (!u) return false
    try {
      const { data: profile } = await supabaseBrowser
        .from('profiles')
        .select('level_score')
        .eq('id', u.id)
        .single()

      if (profile?.level_score) {
        const level = scoreToLevel(profile.level_score)
        localStorage.setItem('lagram_level', level)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // Create profile from localStorage level when user signs in without an existing profile.
  // This handles the case where a guest completes assessment then signs in.
  async function createProfileFromStorage(u) {
    const level = localStorage.getItem('lagram_level')
    if (!level) return
    try {
      const { levelToScore } = await import('@/lib/level')
      await supabaseBrowser.from('profiles').upsert({
        id: u.id,
        email: u.email,
        level_score: levelToScore(level),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    } catch (err) {
      console.error('Failed to create profile from storage:', err)
    }
  }

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) syncProfileToStorage(session.user)
    })

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN' && session?.user) {
        syncProfileToStorage(session.user).then(synced => {
          if (!synced) createProfileFromStorage(session.user)
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function signInWithGoogle() {
    return supabaseBrowser.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  function signOut() {
    localStorage.removeItem('lagram_level')
    localStorage.removeItem('lagram_concept')
    localStorage.removeItem('lagram_session_date')
    localStorage.removeItem('lagram_session_concept')
    return supabaseBrowser.auth.signOut()
  }

  return { user, signInWithGoogle, signOut }
}
