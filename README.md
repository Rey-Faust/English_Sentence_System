# English Sentence System

Core 15 learning cards, question grammar, AI practice, training history and weakness analysis. Preserves the complete 3.2 learning content.

Frontend: GitHub Pages. Backend: Supabase Auth, RLS-protected training records and the `english-coach` Edge Function. DeepSeek keys exist only in server secrets. Browser users can study cards without signing in; cloud history and AI require an invited account.

## Development

`npm ci`, `npm test`, `npm run build`. Serve `dist` with any static web server.

## Supabase setup

1. Create the dedicated project, enable automatic RLS and disable automatic table exposure.
2. Apply `supabase/migrations/202609200001_training.sql`.
3. Configure Auth Site URL and allowed redirects for the actual GitHub Pages URL. Disable public signup and invite the owner.
4. Set server secrets `DEEPSEEK_API_KEY` and `COACH_OWNER_EMAIL`. Deploy `english-coach` with JWT verification enabled.
5. Put only the project URL and public anon key into `public/config.js`, then rebuild.

AI calls verify the user, enforce the configured owner email, and use an atomic daily quota of 100 requests. Requests contain the exercise topic, scenario and answer; the practice page explains this before submission. Do not submit confidential work information.

## Validation

Automated checks verify all 15 knowledge cards and required fields, script parsing, and safe rendering of AI feedback with quotes and HTML. Deployment acceptance additionally requires live sign-in, save/reload, unauthenticated rejection and an AI response. A successful build alone does not prove backend readiness.
