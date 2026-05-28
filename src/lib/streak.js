import { supabase } from '@/lib/supabase'

export async function updateStreak(userId) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, last_session_date')
      .eq('id', userId)
      .single()

    if (!profile) return null

    const today     = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const last      = profile.last_session_date

    let current = profile.current_streak ?? 0

    if (last === today) {
      return { current, longest: profile.longest_streak ?? 0 }
    } else if (last === yesterday) {
      current = current + 1
    } else {
      current = 1
    }

    const longest = Math.max(current, profile.longest_streak ?? 0)

    await supabase
      .from('profiles')
      .update({ current_streak: current, longest_streak: longest, last_session_date: today, updated_at: new Date().toISOString() })
      .eq('id', userId)

    return { current, longest }
  } catch (err) {
    console.error('updateStreak error:', err)
    return null
  }
}
