import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type, score, total, level, words, vocab_score, vocab_score_delta, display_name } = await request.json()

    const { data, error } = await supabase
      .from('shared_results')
      .insert({
        type,
        user_id: user.id,
        display_name: display_name ?? null,
        score,
        total,
        level,
        words,
        vocab_score: vocab_score ?? null,
        vocab_score_delta: vocab_score_delta ?? null,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('create-share error:', err)
    return NextResponse.json({ error: 'Failed to create share' }, { status: 500 })
  }
}
