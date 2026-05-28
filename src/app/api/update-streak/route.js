import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { updateStreak } from '@/lib/streak'

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const streak = await updateStreak(user.id)
    return NextResponse.json({ ok: true, streak })
  } catch (err) {
    console.error('update-streak error:', err)
    return NextResponse.json({ error: 'Failed to update streak' }, { status: 500 })
  }
}
