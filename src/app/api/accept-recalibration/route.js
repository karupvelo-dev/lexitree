import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { levelToScore } from '@/lib/level'

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { suggestedLevel } = await request.json()
    const newScore = levelToScore(suggestedLevel)

    await supabase
      .from('profiles')
      .update({
        level_score: newScore,
        recalibration_dismissed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('accept-recalibration error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
