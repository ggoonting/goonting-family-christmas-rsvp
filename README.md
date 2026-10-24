# Goonting Family Christmas RSVP

A warm, mobile-friendly RSVP page for the Goonting family Christmas potluck. Built as a lightweight static site for Vercel and a Supabase Edge Function with a Postgres household model.

## Design choices

- **Fraunces** for expressive holiday headlines and **DM Sans** for clear interface text. Both are free Google Fonts with open licenses; the stylesheet loads them from Google Fonts.
- Evergreen, cranberry, parchment and candlelight gold palette, with an original inline illustration and small holly details.
- A household is the invitation unit. Each household has a primary invitee, optional spouse/partner, children and infants. Each person has an independent `pending`, `yes` or `no` RSVP, so households can submit partial responses.
- A household potluck note is optional free text, up to 500 characters.

## Deploy

1. Create a Supabase project in the Singapore region. Run `supabase/schema.sql` in its SQL editor.
2. Deploy the Edge Function: `supabase functions deploy rsvp`.
3. Set the function secret `SUPABASE_SERVICE_ROLE_KEY` to the project service role key. Supabase provides `SUPABASE_URL` in the function runtime. Never place the service role key in frontend files.
4. Add household rows and member rows in Supabase. For each household, create a random invite code (at least 8 characters), store only its lowercase SHA-256 hex digest in `invite_code_hash`, and share the original code privately with that household. A household code can also be placed in an invitation URL as `?invite=CODE`.
5. Set the project's URL and anon key in `config.js` (`supabaseUrl` and `supabaseAnonKey`). The anon key is safe for the client because table access is denied by RLS; all public operations go through the Edge Function.
6. Import this folder as a project in Vercel. It is a static site; no Node build step is required. Use Singapore as the Vercel function region if you later add Vercel Functions. The Supabase project and its Edge Function should also be in Singapore for low latency.

## Household model

`households` stores the household display name, hashed invite code and optional potluck note. `household_members` stores one primary invitee and any spouse, children or infants. Infant details (for example, high-chair or feeding notes) are optional and only allowed for infant records. Keep infant details minimal and only collect what the host needs.

The Edge Function accepts `lookup` and `save` actions. It hashes invite codes before lookup, validates that submitted member IDs belong to that household, and never exposes the service role key. Configure a stricter `Access-Control-Allow-Origin` value before production if you want requests limited to a known domain.

## RSVP setup status

The page is ready for configuration, but no guest list, venue, party time, or Supabase project credentials were provided. The page intentionally says time and place are to follow. Until `config.js`, Supabase schema, function and household rows are configured, the RSVP form displays a friendly setup message.
