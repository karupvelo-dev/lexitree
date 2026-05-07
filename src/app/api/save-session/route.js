import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sessionDelta, clampScore, checkPromotion } from '@/lib/level'
import { B1_ORDER } from '@/data/grammar-map'

const LEVEL_CONCEPTS = {
  B1: B1_ORDER,
}

const LEVEL_SEQUENCE = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { level, concept, concept_name, score, total } = await request.json()

    // 1. Save session
    const { error } = await supabase.from('sessions').insert({
      user_id: user.id,
      level,
      concept,
      concept_name,
      score,
      total,
    })
    if (error) throw error

    // 2. Update profile score + check promotion
    const promotion = await updateProfileScore(user.id, level, score, total)

    // 3. Check recalibration (runs after session is saved so current session is included)
    const recalibration = await checkRecalibration(user.id, level)

    return NextResponse.json({ ok: true, promotion, recalibration })
  } catch (error) {
    console.error('save-session error:', error)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}

async function checkRecalibration(userId, currentLevel) {
  try {
    // Need at least 5 completed sessions
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('score, total')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!recentSessions || recentSessions.length < 5) return null

    const totalCorrect = recentSessions.reduce((s, r) => s + r.score, 0)
    const totalQ = recentSessions.reduce((s, r) => s + r.total, 0)
    const rollingAccuracy = totalCorrect / totalQ

    // Check cooldown — suppress if fewer than 10 sessions since last dismissal
    const { data: profile } = await supabase
      .from('profiles')
      .select('recalibration_dismissed_at')
      .eq('id', userId)
      .single()

    if (profile?.recalibration_dismissed_at) {
      const { count } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('created_at', profile.recalibration_dismissed_at)

      if (count < 10) return null
    }

    const levelIndex = LEVEL_SEQUENCE.indexOf(currentLevel)

    if (rollingAccuracy < 0.40 && levelIndex > 0) {
      return { direction: 'down', suggestedLevel: LEVEL_SEQUENCE[levelIndex - 1], rollingAccuracy }
    }
    if (rollingAccuracy > 0.92 && levelIndex < LEVEL_SEQUENCE.length - 1) {
      return { direction: 'up', suggestedLevel: LEVEL_SEQUENCE[levelIndex + 1], rollingAccuracy }
    }

    return null
  } catch (err) {
    console.error('checkRecalibration error:', err)
    return null
  }
}

async function updateProfileScore(userId, level, sessionScore, sessionTotal) {
  try {
    // Fetch current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('level_score')
      .eq('id', userId)
      .single()

    if (!profile) return null  // No profile yet (guest who hasn't signed in)

    // Apply delta and clamp within TCF range
    const delta    = sessionDelta(sessionScore, sessionTotal)
    const newScore = clampScore(profile.level_score + delta)

    await supabase
      .from('profiles')
      .update({ level_score: newScore, updated_at: new Date().toISOString() })
      .eq('id', userId)

    // 3. Check promotion eligibility if this level has a full concept map
    const conceptsInLevel = LEVEL_CONCEPTS[level]
    if (!conceptsInLevel) return null

    const { data: sessionRows } = await supabase
      .from('sessions')
      .select('concept, score, total')
      .eq('user_id', userId)
      .eq('level', level)

    if (!sessionRows?.length) return null

    return checkPromotion(conceptsInLevel, sessionRows)
  } catch (err) {
    console.error('updateProfileScore error:', err)
    return null
  }
}
