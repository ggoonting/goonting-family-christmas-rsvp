import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const validKinds = new Set(['primary', 'spouse', 'child', 'infant']);
const validRsvps = new Set(['pending', 'yes', 'no']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'RSVP service is not configured.' }, 503);

  try {
    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
    if (code.length < 4 || code.length > 80) return json({ error: 'Please enter a valid household invite code.' }, 400);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const codeHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: household, error: householdError } = await db.from('households')
      .select('id, name, meal_note').eq('invite_code_hash', codeHash).maybeSingle();
    if (householdError) throw householdError;
    if (!household) return json({ error: 'We couldn’t find that invite code. Please check it and try again.' }, 404);

    if (body.action === 'lookup') {
      const { data: members, error } = await db.from('household_members')
        .select('id, name, kind, infant_details, rsvp, sort_order')
        .eq('household_id', household.id).order('sort_order');
      if (error) throw error;
      return json({ name: household.name, meal_note: household.meal_note, members: members ?? [] });
    }

    if (body.action === 'save') {
      if (!Array.isArray(body.members) || body.members.length > 30) return json({ error: 'Please check your household responses.' }, 400);
      const { data: existing, error: memberError } = await db.from('household_members')
        .select('id').eq('household_id', household.id);
      if (memberError) throw memberError;
      const allowedIds = new Set((existing ?? []).map((member) => member.id));
      for (const member of body.members) {
        if (!member || !allowedIds.has(member.id) || !validRsvps.has(member.rsvp)) {
          return json({ error: 'One or more household responses were invalid. Please refresh and try again.' }, 400);
        }
      }
      const note = typeof body.meal_note === 'string' ? body.meal_note.trim() : '';
      if (note.length > 500) return json({ error: 'The dish note must be 500 characters or fewer.' }, 400);
      for (const member of body.members) {
        const { error } = await db.from('household_members').update({ rsvp: member.rsvp })
          .eq('id', member.id).eq('household_id', household.id);
        if (error) throw error;
      }
      const { error } = await db.from('households').update({ meal_note: note }).eq('id', household.id);
      if (error) throw error;
      return json({ message: 'Your RSVP is saved. We can’t wait to celebrate with you!' });
    }
    return json({ error: 'Unknown RSVP action.' }, 400);
  } catch (error) {
    console.error('RSVP request failed:', error);
    return json({ error: 'We couldn’t save that just now. Please try again in a moment.' }, 500);
  }
});
