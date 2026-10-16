# AuthorBIO / InkFold

A minimalist author bio and portfolio launcher for writers and digital creators.

**Live site target:** https://authorbio.github.io/official/  
**Repository:** https://github.com/authorbio/official

## Stack

- Next.js 14 + React
- Static export for GitHub Pages
- Supabase Auth + PostgreSQL + Row Level Security
- GitHub Actions deployment

## How it works on GitHub Pages

GitHub Pages cannot run a Next.js server. This project uses Next.js static export and browser-side Supabase queries. Public profile URLs use a query parameter, for example:

`https://authorbio.github.io/official/?u=silas`

This allows any username to be looked up without generating a separate HTML file for every author.

## Setup

### 1. Create the Supabase database

1. Create a project at https://supabase.com/.
2. Open **SQL Editor**.
3. Run the complete script in `supabase/schema.sql`.
4. In **Authentication → Providers → Email**, enable Email and email confirmation.
5. In **Authentication → URL Configuration**, set the Site URL to `https://authorbio.github.io/official/` and add these redirect URLs:
   - `https://authorbio.github.io/official/`
   - `http://localhost:3000/`

The SQL creates public read policies, owner-only write policies, and a database trigger that creates a profile when a user signs up. The trigger is important because email confirmation can mean there is no signed-in browser session immediately after registration.

### 2. Add GitHub Actions variables

In the repository, open **Settings → Secrets and variables → Actions → Variables** and add:

- `NEXT_PUBLIC_SUPABASE_URL`: the Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the Supabase publishable key (or legacy anon key).

These are public browser-side values and will be included in the generated frontend. **Never use the Supabase service-role key here.** Database access must be protected by the included RLS policies.

### 3. Enable GitHub Pages

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions**.
3. Push to `main` or manually run the **Build and deploy AuthorBIO to GitHub Pages** workflow under the Actions tab.

The workflow builds the static site into `out/` and publishes it. If GitHub Pages is unavailable for this private repository under your current GitHub plan, change the repository visibility or use a hosting provider that supports private source repositories.

### 4. Run locally

Copy `.env.example` to `.env.local`, add your Supabase URL and anon/publishable key, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000/official/ because the project uses `/official` as its base path for GitHub Pages. For local development, the Next.js base path is still configured; use the root URL if your local setup redirects automatically.

## Features

- Email/password sign-up and sign-in
- Username-based public author profile
- Edit display name and bio
- Add portfolio links and categories
- Remove portfolio links
- Responsive editorial-style design
- Static GitHub Pages deployment workflow

## Notes

- Public profiles are viewed at `/?u=username` under the deployed `/official/` path.
- Profile usernames are immutable in this first version.
- Email confirmation and password recovery depend on the Supabase Auth configuration.
- No private service-role credentials belong in this repository.
