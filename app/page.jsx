"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const TYPES = ["reader", "author", "editor", "proofreader", "translator", "illustrator", "publisher", "other"];
const CATEGORIES = ["Book", "Article", "Story", "Poem", "Service", "Repository", "Podcast", "Website", "Other"];
const NAV = [["home","Home","⌂"],["explore","Explore","⌕"],["services","Services","✳"],["profile","My profile","◎"],["reviews","Reviews","☆"],["settings","Settings","⚙"]];

export default function HomePage() {
  const [route, setRoute] = useState("home");
  const [navOpen, setNavOpen] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [works, setWorks] = useState([]);\n  const [allWorks, setAllWorks] = useState([]);
  const [publicProfile, setPublicProfile] = useState(null);
  const [publicWorks, setPublicWorks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewWork, setReviewWork] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewBody, setReviewBody] = useState("");
  const [type, setType] = useState("author");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Book");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async (user) => {
    if (!supabase || !user) return;
    const { data: p, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) { setStatus(error.message); return; }
    if (!p) { setStatus("Profile not found yet. If you just signed up, verify your email and sign in again."); return; }
    setProfile(p); setBio(p.bio || ""); setDisplayName(p.display_name || ""); setUsername(p.username || ""); setType(p.account_type || "author"); setServiceTitle(p.service_title || ""); setServiceDescription(p.service_description || ""); setServicePrice(p.service_price || "");
    const { data: w, error: we } = await supabase.from("works").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (we) setStatus(we.message);
    setWorks(w || []);
  }, []);

  const loadPublic = useCallback(async (name) => {
    if (!supabase || !name) return;
    const { data: p, error } = await supabase.from("profiles").select("*").eq("username", name.toLowerCase()).maybeSingle();
    if (error) { setStatus(error.message); return; }
    setPublicProfile(p || null);
    if (!p) { setPublicWorks([]); return; }
    const { data: w, error: we } = await supabase.from("works").select("*").eq("user_id", p.id).order("created_at", { ascending: false });
    if (we) setStatus(we.message);
    setPublicWorks(w || []);
  }, []);

  const loadReviews = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("reviews").select("id, rating, body, created_at, reviewer_id, work_id, works(title, user_id), profiles!reviews_reviewer_id_fkey(username, display_name)").order("created_at", { ascending: false }).limit(100);
    if (error) { setStatus(error.message); return; }
    setReviews(data || []);
  }, []);

  const navigate = useCallback((next, usernameArg = "") => {
    const u = new URL(window.location.href);
    u.search = "";
    if (usernameArg) { u.searchParams.set("u", usernameArg); next = "public"; }
    else if (next !== "home") u.searchParams.set("page", next);
    window.history.pushState({}, "", u);
    setRoute(next); setStatus("");
    if (next === "public" && usernameArg) loadPublic(usernameArg);
    if (next === "reviews") loadReviews();
    if (next === "explore" || next === "services") loadProfiles();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [loadPublic, loadReviews]);

  async function loadProfiles() {
    if (!supabase) return;
    const { data, error } = await supabase.from("profiles").select("id, username, display_name, bio, account_type, service_title, service_description, service_price").order("display_name").limit(200);
    if (error) setStatus(error.message);
    setProfiles(data || []);
  }

  useEffect(() => {
    const sync = () => {
      const q = new URLSearchParams(window.location.search);
      const u = q.get("u");
      const p = q.get("page") || (u ? "public" : "home");
      setRoute(u ? "public" : p);
      if (u) loadPublic(u);
    };
    sync(); window.addEventListener("popstate", sync);
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session?.user) loadDashboard(data.session.user); });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { setSession(s); if (s?.user) loadDashboard(s.user); else { setProfile(null); setWorks([]); } });
      return () => { window.removeEventListener("popstate", sync); sub.subscription.unsubscribe(); };
    }
    return () => window.removeEventListener("popstate", sync);
  }, [loadDashboard, loadPublic]);

  async function handleAuth(e) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setStatus("");
    try {
      if (route === "signup") {
        const clean = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(clean)) throw new Error("Username must be 3–24 characters: lowercase letters, numbers, underscores.");
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: "https://authorbio.github.io/official/?page=signin", data: { username: clean, display_name: displayName.trim(), account_type: type } } });
        if (error) throw error;
        setStatus("Account created. Check your email to verify your address, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setStatus("Signed in."); navigate("profile");
      }
    } catch (e2) { setStatus(e2.message || "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function saveProfile(e) {
    e.preventDefault(); if (!supabase || !session?.user) return;
    setBusy(true); setStatus("");
    const { error } = await supabase.from("profiles").update({ bio, display_name: displayName.trim(), account_type: type, service_title: serviceTitle.trim(), service_description: serviceDescription.trim(), service_price: servicePrice.trim() }).eq("id", session.user.id);
    setBusy(false); setStatus(error ? error.message : "Profile and service details saved.");
    if (!error) loadDashboard(session.user);
  }

  async function addWork(e) {
    e.preventDefault(); if (!supabase || !session?.user) return;
    setBusy(true); const { data, error } = await supabase.from("works").insert({ user_id: session.user.id, title: title.trim(), description: description.trim(), url: url.trim(), category }).select().single(); setBusy(false);
    if (error) { setStatus(error.message); return; }
    setWorks((old) => [data, ...old]); setTitle(""); setDescription(""); setUrl(""); setStatus("Item added to your page.");
  }

  async function deleteWork(id) {
    const { error } = await supabase.from("works").delete().eq("id", id);
    if (error) { setStatus(error.message); return; }
    setWorks((old) => old.filter((w) => w.id !== id)); setStatus("Item removed.");
  }

  async function submitReview(e) {
    e.preventDefault(); if (!supabase || !session?.user) { setStatus("Sign in as a reader to leave a review."); return; }
    const { error } = await supabase.from("reviews").insert({ reviewer_id: session.user.id, work_id: reviewWork, rating: Number(reviewRating), body: reviewBody.trim() });
    if (error) { setStatus(error.message); return; }
    setReviewBody(""); setStatus("Review published."); loadReviews();
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setProfile(null); setWorks([]); setStatus("Signed out."); navigate("home");
  }

  function copyProfile() {
    const link = new URL("?u=" + encodeURIComponent(profile?.username || username), window.location.origin + window.location.pathname).toString();
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => setStatus("Public profile link copied.")).catch(() => setStatus(link));
    else setStatus(link);
  }

  const filtered = profiles.filter((p) => [p.display_name, p.username, p.bio, p.account_type, p.service_title].some((x) => (x || "").toLowerCase().includes(search.toLowerCase())));
  const authorWorks = [...works, ...publicWorks];
  const titleFor = (p) => p.service_title || ({reader:"Reader",author:"Author",editor:"Editor",proofreader:"Proofreader",translator:"Translator",illustrator:"Illustrator",publisher:"Publisher",other:"Creative professional"}[p.account_type] || "Creator");

  function workRows(items, canDelete = false) {
    return <div className="public-works">{items.length ? items.map((w) => <div className="public-work" key={w.id}><span className="work-icon">↗</span><span className="work-copy"><strong>{w.title}</strong>{w.description ? <small>{w.description}</small> : null}<small>{w.category} · <a href={w.url} target="_blank" rel="noreferrer">Open link ↗</a></small></span>{canDelete ? <button className="remove-work" onClick={() => deleteWork(w.id)} aria-label={"Remove " + w.title}>×</button> : null}</div>) : <p className="muted">Nothing published here yet.</p>}</div>;
  }

  return <main className="site-shell authorbio-shell">
    <header className="topbar app-topbar"><a className="brand" href="?page=home" onClick={(e) => { e.preventDefault(); navigate("home"); }}><span className="brand-mark">A</span><span>AuthorBIO<span className="brand-dot">.</span></span></a><button className="nav-toggle" onClick={() => setNavOpen((v) => !v)} aria-expanded={navOpen} aria-label={navOpen ? "Collapse navigation" : "Expand navigation"}><span></span><span></span><span></span><small>{navOpen ? "Collapse" : "Menu"}</small></button></header>
    <div className={"app-layout " + (!navOpen ? "app-layout-collapsed" : "")}>
      <aside className={"sidebar " + (!navOpen ? "sidebar-collapsed" : "")}><div className="sidebar-label">{navOpen ? "YOUR CREATIVE SPACE" : "AB"}</div>
        {NAV.map(([key,label,icon]) => <button key={key} className={"side-link " + (route === key ? "side-link-active" : "")} title={label} onClick={() => navigate(key)}><span className="side-icon">{icon}</span>{navOpen ? <span>{label}</span> : null}</button>)}
        <div className="sidebar-divider"/>
        {session ? <button className="side-link" onClick={signOut} title="Sign out"><span className="side-icon">⇥</span>{navOpen ? <span>Sign out</span> : null}</button> : <><button className="side-link" onClick={() => navigate("signin")} title="Sign in"><span className="side-icon">→</span>{navOpen ? <span>Sign in</span> : null}</button><button className="sidebar-signup" onClick={() => navigate("signup")}>{navOpen ? "Create account ↗" : "+"}</button></>}
        {navOpen ? <div className="sidebar-bottom"><span className="sidebar-orb">✳</span><p>Your work deserves<br/>a place of its own.</p><small>AUTHORBIO · 2026</small></div> : null}
      </aside>
      <section className="app-content">
        {!isSupabaseConfigured ? <div className="setup-notice"><strong>Backend setup needed</strong><p>Set the GitHub Actions variables <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then run the updated <code>supabase/schema.sql</code> in Supabase SQL Editor.</p></div> : null}

        {route === "home" ? <div className="page-view home-view"><div className="hero hero-app"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> A HOME FOR READERS &amp; CREATORS</div><h1>Your next<br/>chapter starts <em>here.</em></h1><p className="hero-description">Discover writers, find books and creative services, share thoughtful reviews, and build a page for the work you put into the world.</p><button className="primary-cta" onClick={() => navigate(session ? "profile" : "signup")}>{session ? "Manage your page" : "Join AuthorBIO"} <span>↗</span></button><div className="hero-proof"><span className="proof-dots"><i/><i/><i/></span><span>For readers, authors, editors &amp; creative professionals.</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="mock-profile"><div className="mock-top"><span>AUTHORBIO / COMMUNITY</span><span>✳</span></div><div className="mock-avatar">A</div><p className="mock-handle">@yournextchapter</p><h2>Stories find readers.</h2><p className="mock-bio">Books, reviews, editing services, and the people behind the words.</p><div className="mock-divider"/><div className="mock-link"><span className="mini-icon">▤</span><span><b>Discover new voices</b><small>Explore author pages</small></span><span className="arrow">↗</span></div><div className="mock-link"><span className="mini-icon">☆</span><span><b>Honest reader reviews</b><small>Thoughtful feedback</small></span><span className="arrow">↗</span></div><div className="mock-link"><span className="mini-icon">✎</span><span><b>Find creative services</b><small>Editors and more</small></span><span className="arrow">↗</span></div><div className="mock-bottom"><span>AUTHORBIO</span><span>WORDS CONNECT US.</span></div></div></div></div><div className="home-bottom"><div><span className="panel-kicker">START EXPLORING</span><h2>Find your next favourite<br/><em>voice, book, or collaborator.</em></h2></div><div className="home-actions"><button className="secondary-cta" onClick={() => navigate("explore")}>Explore people ↗</button><button className="secondary-cta" onClick={() => navigate("services")}>Browse services ↗</button></div></div></div> : null}

        {route === "signup" || route === "signin" ? <div className="page-view auth-page"><div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> YOUR NEXT CHAPTER</div><h1>{route === "signup" ? <>Create your<br/><em>AuthorBIO page.</em></> : <>Welcome<br/><em>back.</em></>}</h1><p>{route === "signup" ? "Join as a reader, author, editor, or another kind of creative professional." : "Sign in to manage your profile, services, work, and reviews."}</p></div><div className="workspace-panel auth-panel">{!isSupabaseConfigured ? <div className="empty-state"><h3>Backend setup needed.</h3><p>Connect Supabase to activate account features.</p></div> : <><div className="auth-tabs"><button className={route === "signin" ? "active" : ""} onClick={() => navigate("signin")}>Sign in</button><button className={route === "signup" ? "active" : ""} onClick={() => navigate("signup")}>Create account</button></div><form onSubmit={handleAuth} className="form-stack">{route === "signup" ? <><label>Account type<select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option value={t} key={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}</select></label><label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Name readers will see" required maxLength={80}/></label><label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+"/><small className="field-help">3–24 letters, numbers, or underscores.</small></label></> : null}<label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={route === "signup" ? "new-password" : "current-password"} minLength={8} required/></label><button className="primary-cta full-width" disabled={busy}>{busy ? "One moment…" : route === "signup" ? "Create account" : "Sign in"} <span>↗</span></button></form><p className="auth-footnote">Keep your creative world connected, on your terms.</p></>}</div></div> : null}

        {route === "explore" || route === "services" ? <div className="page-view"><div className="page-heading wide-heading"><div className="eyebrow"><span className="eyebrow-line"/> {route === "services" ? "CREATIVE SERVICES" : "THE COMMUNITY"}</div><h1>{route === "services" ? <>Find your<br/><em>creative partner.</em></> : <>Meet the people<br/><em>behind the words.</em></>}</h1><p>{route === "services" ? "Discover editors, proofreaders, translators, illustrators, publishers, and other creative professionals." : "Search profiles by name, username, bio, role, or service."}</p></div><div className="explore-tools"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people, roles, services…"/><span>{filtered.length} profiles</span></div><div className="author-grid">{filtered.filter((p) => route !== "services" || (p.service_title || p.service_description || ["editor","proofreader","translator","illustrator","publisher","other"].includes(p.account_type))).map((p) => <article className="author-tile" key={p.id}><div className="author-avatar">{p.display_name?.charAt(0)?.toUpperCase() || "A"}</div><span className="handle">@{p.username} · {(p.account_type || "creator").toUpperCase()}</span><h3>{p.display_name}</h3><p>{p.bio || "A creative profile on AuthorBIO."}</p>{p.service_title ? <><h4>{p.service_title}</h4><p>{p.service_description}</p>{p.service_price ? <p className="service-price">{p.service_price}</p> : null}</> : null}<button className="secondary-cta" onClick={() => navigate("public", p.username)}>View profile ↗</button></article>)}{!filtered.length ? <div className="empty-state"><h3>No profiles found.</h3><p>Try a different search, or create a profile.</p><button className="primary-cta" onClick={() => navigate("signup")}>Join AuthorBIO ↗</button></div> : null}</div></div> : null}

        {route === "profile" ? <div className="page-view"><div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> YOUR PUBLIC SPACE</div><h1>Your work.<br/><em>Your identity.</em></h1><p>Build a useful profile for readers, collaborators, and potential clients.</p></div>{!session ? <div className="workspace-panel signed-out-panel"><h3>Your profile starts with you.</h3><p>Sign in or create an account to edit your bio, add work, and list services.</p><button className="primary-cta" onClick={() => navigate("signin")}>Sign in ↗</button><button className="secondary-cta" onClick={() => navigate("signup")}>Create account</button></div> : <><div className="profile-editor-grid"><div className="workspace-panel"><div className="panel-heading"><div><span className="panel-kicker">PROFILE DETAILS</span><h3>Tell your story.</h3></div></div><form onSubmit={saveProfile} className="form-stack"><label>Account type<select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option value={t} key={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}</select></label><label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80}/></label><label>Username<input value={username} readOnly/><small className="field-help">Your public handle is part of your profile link.</small></label><label>Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Your background, interests, books, or the work you do…" maxLength={1000} rows={5}/></label><div className="panel-rule"/><span className="panel-kicker">SERVICES (OPTIONAL)</span><label>Service headline<input value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="e.g. Developmental editing"/></label><label>Service details<textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="What do you offer? Who is it for?" maxLength={1000} rows={3}/></label><label>Pricing or rates<input value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="e.g. From ₹500 / 1,000 words, or Contact me"/></label><button className="primary-cta full-width" disabled={busy}>{busy ? "Saving…" : "Save profile"} <span>↗</span></button></form><button className="secondary-cta copy-link" onClick={copyProfile}>Copy public profile link ↗</button></div><div className="workspace-panel collection-panel"><div className="panel-heading"><div><span className="panel-kicker">PORTFOLIO</span><h3>Share your work.</h3></div></div><form onSubmit={addWork} className="form-stack"><label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title of your book, article, or project" required maxLength={120}/></label><label>Link URL<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required/></label><label>Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Give readers some context" maxLength={500}/></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label><button className="primary-cta full-width" disabled={busy}>{busy ? "Adding…" : "Publish to profile"} <span>＋</span></button></form><div className="saved-works"><div className="works-heading"><span>YOUR PUBLISHED WORK</span><span>{String(works.length).padStart(2,"0")}</span></div>{workRows(works,true)}</div><button className="secondary-cta" onClick={copyProfile}>View/share public profile ↗</button></div></div></>}</div> : null}

        {route === "public" ? <div className="page-view public-page"><div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> PUBLIC PROFILE</div><p>Meet a member of the AuthorBIO community.</p></div>{publicProfile ? <article className="profile-card"><div className="avatar">{publicProfile.display_name?.charAt(0)?.toUpperCase() || "A"}</div><p className="handle">@{publicProfile.username} · {(publicProfile.account_type || "creator").toUpperCase()}</p><h1>{publicProfile.display_name}</h1><p className="public-bio">{publicProfile.bio || "This creator is still writing their story."}</p>{publicProfile.service_title ? <section className="public-service"><span className="panel-kicker">SERVICES</span><h3>{publicProfile.service_title}</h3><p>{publicProfile.service_description}</p><strong>{publicProfile.service_price}</strong><p className="field-help">Use the public profile to learn about this provider; contact details should be shared directly by the profile owner.</p></section> : null}<div className="works-heading"><span>PORTFOLIO</span><span>{String(publicWorks.length).padStart(2,"0")}</span></div>{workRows(publicWorks)}<p className="profile-footer">AUTHORBIO · WORDS CONNECT US.</p></article> : <div className="loading-card">Loading profile… <button className="secondary-cta" onClick={() => navigate("explore")}>Explore people ↗</button></div>}</div> : null}

        {route === "reviews" ? <div className="page-view"><div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> READER VOICES</div><h1>Thoughtful words<br/><em>about the work.</em></h1><p>Readers can leave a star rating and written feedback on a work item. Reviews should be honest, specific, and respectful.</p></div>{session ? <div className="workspace-panel review-compose"><h3>Write a review</h3><form className="form-stack" onSubmit={submitReview}><label>Work<select value={reviewWork} onChange={(e) => setReviewWork(e.target.value)} required><option value="">Choose a published item</option>{profiles.length ? null : null}{allWorks.filter((w) => w.user_id !== session.user.id).map((w) => <option value={w.id} key={w.id}>{w.title}</option>)}</select><small className="field-help">Choose a work published by another member. You can review each work once.</small></label><label>Rating<select value={reviewRating} onChange={(e) => setReviewRating(e.target.value)}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} / 5 stars</option>)}</select></label><label>Your review<textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} required minLength={8} maxLength={2000} rows={4} placeholder="What worked for you? Be specific and constructive."/></label><button className="primary-cta" disabled={busy}>Publish review ↗</button></form></div> : <div className="notice-row">Sign in to write a review. <button className="secondary-cta" onClick={() => navigate("signin")}>Sign in ↗</button></div>}<div className="review-list">{reviews.map((r) => <article className="review-card" key={r.id}><div className="review-stars">{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</div><h3>{r.works?.title || "A published work"}</h3><p>{r.body}</p><small>{r.profiles?.display_name || r.profiles?.username || "AuthorBIO member"} · {new Date(r.created_at).toLocaleDateString()}</small></article>)}{!reviews.length ? <p className="muted">No reviews yet. Be the first to share thoughtful feedback.</p> : null}</div></div> : null}

        {route === "settings" ? <div className="page-view"><div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> ACCOUNT PREFERENCES</div><h1>Your account,<br/><em>your choices.</em></h1><p>Review your account and manage sign-in safely.</p></div><div className="settings-list"><section className="setting-row"><div><span className="panel-kicker">ACCOUNT</span><h3>{session ? "Signed in" : "Browsing as a guest"}</h3><p>{session?.user?.email || "Sign in to manage your profile."}</p></div>{session ? <button className="secondary-cta" onClick={signOut}>Sign out</button> : <button className="primary-cta" onClick={() => navigate("signin")}>Sign in ↗</button>}</section><section className="setting-row"><div><span className="panel-kicker">PROFILE</span><h3>{profile?.username ? "Your public page" : "Build your public page"}</h3><p>{profile?.username ? "Share your username-based link with readers and collaborators." : "Create a profile to share your work or services."}</p></div><button className="secondary-cta" onClick={() => navigate(profile ? "profile" : "signup")}>{profile ? "Edit profile ↗" : "Get started ↗"}</button></section><section className="setting-row"><div><span className="panel-kicker">PRIVACY</span><h3>Public profile, private credentials.</h3><p>Your profile and published work are public. Never share your password or private account details.</p></div><span className="setting-status">SUPABASE AUTH</span></section><section className="setting-row"><div><span className="panel-kicker">COMMUNITY</span><h3>Respectful reviews help everyone.</h3><p>Review work, not people. Avoid spam, harassment, personal information, and undisclosed conflicts of interest.</p></div><button className="secondary-cta" onClick={() => navigate("reviews")}>Read reviews ↗</button></section></div></div> : null}
        {status ? <div className="status-message global-status" role="status">{status}</div> : null}
        <footer className="app-footer"><span>AUTHORBIO · YOUR CREATIVE WORLD, CONNECTED.</span><span>© 2026</span></footer>
      </section>
    </div>
  </main>;
}
