"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const CATEGORIES = ["Book", "Article", "Story", "Repository", "Podcast", "General"];

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [works, setWorks] = useState([]);
  const [mode, setMode] = useState("signin");
  const [publicUsername, setPublicUsername] = useState("");
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [publicProfile, setPublicProfile] = useState(null);
  const [publicWorks, setPublicWorks] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Book");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async (user) => {
    if (!supabase || !user) return;
    const { data: p, error: profileError } = await supabase
      .from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profileError) {
      setStatus(profileError.message);
      return;
    }
    if (p) {
      setProfile(p);
      setBio(p.bio || "");
      setDisplayName(p.display_name || "");
      setUsername(p.username || "");
    } else {
      setStatus("Your profile is not ready yet. If you just registered, verify your email and sign in again.");
      return;
    }
    const { data: w, error: worksError } = await supabase
      .from("works").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (worksError) setStatus(worksError.message);
    setWorks(w || []);
  }, []);

  const loadPublicProfile = useCallback(async (name) => {
    if (!supabase || !name) return;
    setStatus("");
    const clean = name.trim().toLowerCase();
    const { data: p, error } = await supabase.from("profiles")
      .select("id, username, display_name, bio, avatar_url")
      .eq("username", clean).maybeSingle();
    if (error) {
      setStatus(error.message);
      return;
    }
    if (!p) {
      setPublicProfile(null);
      setPublicWorks([]);
      setStatus("We couldn't find that author profile.");
      return;
    }
    const { data: w, error: workError } = await supabase.from("works")
      .select("id, title, description, url, category, created_at")
      .eq("user_id", p.id).order("created_at", { ascending: false });
    if (workError) setStatus(workError.message);
    setPublicProfile(p);
    setPublicWorks(w || []);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedUser = params.get("u");
    if (requestedUser) {
      setIsPublicMode(true);
      setPublicUsername(requestedUser);
      loadPublicProfile(requestedUser);
    }
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user && !requestedUser) loadDashboard(data.session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user && !requestedUser) loadDashboard(nextSession.user);
      if (!nextSession) {
        setProfile(null);
        setWorks([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadDashboard, loadPublicProfile]);

  async function handleAuth(event) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setStatus("");
    try {
      if (mode === "signup") {
        const cleanUsername = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
          setStatus("Username must be 3–24 characters using lowercase letters, numbers, or underscores.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: "https://authorbio.github.io/official/",
            data: { username: cleanUsername, display_name: displayName.trim() }
          }
        });
        if (error) throw error;
        setStatus("Account request created. Check your email to verify your address, then sign in. Your profile is created by the database trigger.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setStatus("Signed in.");
      }
    } catch (error) {
      setStatus(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    setBusy(true);
    setStatus("");
    const { error } = await supabase.from("profiles")
      .update({ bio, display_name: displayName.trim() })
      .eq("id", session.user.id);
    setBusy(false);
    setStatus(error ? error.message : "Profile saved.");
    if (!error) await loadDashboard(session.user);
  }

  async function addWork(event) {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    setBusy(true);
    setStatus("");
    const { data, error } = await supabase.from("works").insert({
      user_id: session.user.id,
      title: title.trim(),
      description: description.trim(),
      url: url.trim(),
      category
    }).select().single();
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setWorks((current) => [data, ...current]);
    setTitle("");
    setDescription("");
    setUrl("");
    setStatus("Work added to your portfolio.");
  }

  async function deleteWork(id) {
    if (!supabase) return;
    const { error } = await supabase.from("works").delete().eq("id", id);
    if (error) {
      setStatus(error.message);
      return;
    }
    setWorks((current) => current.filter((work) => work.id !== id));
    setStatus("Work removed.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setWorks([]);
    setStatus("Signed out.");
  }

  function openProfile(name = profile?.username) {
    if (!name) return;
    const target = new URL(window.location.href);
    target.searchParams.set("u", name);
    window.location.href = target.toString();
  }

  function goHome() {
    const target = new URL(window.location.href);
    target.searchParams.delete("u");
    window.location.href = target.toString();
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); goHome(); }}>
          <span className="brand-mark">i</span><span>inkfold<span className="brand-dot">.</span></span>
        </a>
        <nav className="top-actions">
          {isPublicMode ? <button className="text-button" onClick={goHome}>Home</button> : null}
          {session && !isPublicMode ? <button className="text-button" onClick={signOut}>Sign out</button> : null}
          <a className="nav-cta" href="#workspace">{session && !isPublicMode ? "Your workspace" : "Get started"} <span>↗</span></a>
        </nav>
      </header>

      {!isSupabaseConfigured && (
        <section className="setup-notice">
          <strong>One setup step left</strong>
          <p>Add your Supabase project URL and publishable/anon key as GitHub Actions repository variables named <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then configure the database using <code>supabase/schema.sql</code>.</p>
        </section>
      )}

      {isPublicMode ? (
        <section className="public-layout">
          <div className="eyebrow"><span className="eyebrow-line" /> THE AUTHOR PAGE</div>
          {publicProfile ? (
            <article className="profile-card">
              <div className="avatar">{publicProfile.display_name?.charAt(0)?.toUpperCase() || "A"}</div>
              <p className="handle">@{publicProfile.username}</p>
              <h1>{publicProfile.display_name}</h1>
              {publicProfile.bio ? <p className="public-bio">{publicProfile.bio}</p> : <p className="muted">A story is still being written.</p>}
              <div className="works-heading"><span>SELECTED WORKS</span><span>{String(publicWorks.length).padStart(2, "0")}</span></div>
              <div className="public-works">
                {publicWorks.length ? publicWorks.map((work) => (
                  <a className="public-work" href={work.url} target="_blank" rel="noreferrer" key={work.id}>
                    <span className="work-icon">↗</span>
                    <span className="work-copy"><strong>{work.title}</strong>{work.description ? <small>{work.description}</small> : null}</span>
                    <span className="category-pill">{work.category}</span>
                  </a>
                )) : <p className="muted">No published links yet.</p>}
              </div>
              <p className="profile-footer">MADE WITH <strong>INKFOLD</strong></p>
            </article>
          ) : <div className="loading-card"><div className="loader" />{status || "Finding this author…"}</div>}
          <button className="back-link" onClick={goHome}>← Discover InkFold</button>
        </section>
      ) : (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR WORK, IN ONE PLACE</div>
              <h1>Every story<br />deserves a <em>home.</em></h1>
              <p className="hero-description">A quiet corner of the internet for everything you create. Your books, your words, your world — beautifully gathered in one link.</p>
              <a className="primary-cta" href="#workspace">Make your page <span>↗</span></a>
              <div className="hero-proof"><span className="proof-dots"><i /><i /><i /></span><span>For writers, makers &amp; curious minds.</span></div>
            </div>
            <div className="hero-art" aria-label="Illustration of an author profile card">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="floating-note note-top"><span>✳</span> A place for your words</div>
              <div className="mock-profile">
                <div className="mock-top"><span>INKFOLD / 001</span><span>✳</span></div>
                <div className="mock-avatar">S</div>
                <p className="mock-handle">@silaswrites</p>
                <h2>Silas Thorne</h2>
                <p className="mock-bio">Writer of quiet storms, forgotten places, and the people who find their way home.</p>
                <div className="mock-divider" />
                <div className="mock-link"><span className="mini-icon">▤</span><span><b>The Hollow Crown</b><small>Novel · 2025</small></span><span className="arrow">↗</span></div>
                <div className="mock-link"><span className="mini-icon">✎</span><span><b>Notes from Elsewhere</b><small>Essays &amp; fragments</small></span><span className="arrow">↗</span></div>
                <div className="mock-link"><span className="mini-icon">♫</span><span><b>After the Last Page</b><small>Podcast · Episode 08</small></span><span className="arrow">↗</span></div>
                <div className="mock-bottom"><span>INKFOLD</span><span>YOUR WORLD, LINKED.</span></div>
              </div>
              <div className="floating-note note-bottom"><span>↗</span> One link. All your work.</div>
            </div>
            <div className="hero-index">01 <span /> 03</div>
          </section>

          <section className="manifesto">
            <div className="manifesto-label">THE IDEA, SIMPLY</div>
            <p>Less time managing links.<br /><span>More time making something</span> <em>meaningful.</em></p>
            <div className="manifesto-side">A DIGITAL HOME FOR YOUR CREATIVE LIFE — NO NOISE, JUST YOU.</div>
          </section>

          <section className="features">
            <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> MADE FOR YOUR WORK</div><h2>Small page.<br /><em>Big picture.</em></h2></div><p>Everything people need to find you, and nothing they don’t.</p></div>
            <div className="feature-grid">
              <article><span className="feature-number">01 / PROFILE</span><div className="feature-symbol">◎</div><h3>Your name, your voice.</h3><p>A considered bio and a personal URL that feels like you, not another social feed.</p></article>
              <article><span className="feature-number">02 / PORTFOLIO</span><div className="feature-symbol">↗</div><h3>Everything you make.</h3><p>Books, articles, podcasts, projects — a tidy home for the work you want to share.</p></article>
              <article><span className="feature-number">03 / OWNERSHIP</span><div className="feature-symbol">✳</div><h3>Made to stay yours.</h3><p>Manage your links and bio in one simple workspace, whenever inspiration strikes.</p></article>
            </div>
          </section>

          <section className="workspace" id="workspace">
            <div className="workspace-intro"><div className="eyebrow"><span className="eyebrow-line" /> YOUR CORNER OF THE INTERNET</div><h2>{session ? "Welcome back." : "Start with a name."}<br /><em>Make it yours.</em></h2><p>{session ? "Your words, your links, your little patch of the internet." : "Create your account to build a home for everything you create."}</p></div>
            <div className="workspace-panel">
              {!isSupabaseConfigured ? <div className="empty-state"><div className="empty-symbol">✳</div><h3>Almost ready.</h3><p>Connect Supabase and deploy again to activate sign-up, sign-in, and profile management.</p><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="primary-cta">Open Supabase ↗</a></div> :
                session ? (
                  <div className="dashboard">
                    <div className="panel-heading"><div><span className="panel-kicker">YOUR WORKSPACE</span><h3>Shape your page.</h3></div><span className="status-dot">● LIVE EDITOR</span></div>
                    <form onSubmit={saveProfile} className="form-stack">
                      <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80} /></label>
                      <label>Username <span className="field-note">your public address</span><input value={username} readOnly /><small className="field-help">Your profile link uses this username.</small></label>
                      <label>Your bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A few words about what you write, make, or believe…" maxLength={500} rows={4} /></label>
                      <button className="primary-cta full-width" disabled={busy}>{busy ? "Saving…" : "Save profile"} <span>↗</span></button>
                      {profile?.username ? <button type="button" className="secondary-cta" onClick={() => openProfile(profile.username)}>View public page ↗</button> : null}
                    </form>
                    <div className="panel-rule" />
                    <div className="panel-heading"><div><span className="panel-kicker">YOUR COLLECTION</span><h3>Add a piece of work.</h3></div></div>
                    <form onSubmit={addWork} className="form-stack">
                      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The title of your work" required maxLength={120} /></label>
                      <label>Link URL<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required /></label>
                      <label>Short description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional context for your readers" maxLength={240} /></label>
                      <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
                      <button className="primary-cta full-width" disabled={busy}>{busy ? "Adding…" : "Add to collection"} <span>＋</span></button>
                    </form>
                    <div className="saved-works">
                      <div className="works-heading"><span>PUBLISHED LINKS</span><span>{String(works.length).padStart(2, "0")}</span></div>
                      {works.length ? works.map((work) => <div className="saved-work" key={work.id}><div><strong>{work.title}</strong><small>{work.category} · <a href={work.url} target="_blank" rel="noreferrer">Open link ↗</a></small></div><button aria-label={"Delete " + work.title} onClick={() => deleteWork(work.id)}>×</button></div>) : <p className="muted">Your collection is waiting for its first link.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="auth-box">
                    <div className="auth-tabs"><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setStatus(""); }}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setStatus(""); }}>Create account</button></div>
                    <form onSubmit={handleAuth} className="form-stack">
                      {mode === "signup" ? <>
                        <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How readers know you" required maxLength={80} /></label>
                        <label>Choose a username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" /><small className="field-help">3–24 letters, numbers, or underscores.</small></label>
                      </> : null}
                      <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
                      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required /></label>
                      <button className="primary-cta full-width" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create your page" : "Welcome back"} <span>↗</span></button>
                    </form>
                    <p className="auth-footnote">By continuing, you’re making room for your work to be found.</p>
                  </div>
                )
              }
              {status ? <div className="status-message" role="status">{status}</div> : null}
            </div>
          </section>
          <footer className="footer"><a className="brand" href="#"><span className="brand-mark">i</span><span>inkfold<span className="brand-dot">.</span></span></a><span>FOR THE THINGS YOU PUT INTO THE WORLD.</span><span>© 2026 INKFOLD</span></footer>
        </>
      )}
    </main>
  );
}
