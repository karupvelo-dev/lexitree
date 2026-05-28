import { supabase } from '@/lib/supabase'

export async function POST(request) {
  const { display_name, score, total, level, concept_name, results, streak } = await request.json()

  const { data, error } = await supabase
    .from('grammar_shares')
    .insert({ display_name, score, total, level, concept_name, results, streak })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
