import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Github, LoaderCircle, Sparkles } from 'lucide-react';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import type {
  RuntimeClaimGitHubCompleteResponse,
  RuntimeClaimViewResponse,
} from '../../services/runtimeAdapter/contracts';

interface ClaimFlowPageProps {
  claimToken: string;
  isCallback: boolean;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

const createService = () => new RuntimePhase1Service(new RuntimeClient({ baseUrl: getRuntimeBaseUrl() }));

const firstParam = (params: URLSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim().length > 0) return value.trim();
  }
  return '';
};

export function ClaimFlowPage({ claimToken, isCallback }: ClaimFlowPageProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [claimView, setClaimView] = useState<RuntimeClaimViewResponse | null>(null);
  const [humanUsername, setHumanUsername] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [errorText, setErrorText] = useState('');
  const [completeResult, setCompleteResult] = useState<RuntimeClaimGitHubCompleteResponse | null>(null);

  const callbackParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const callbackStatus = firstParam(callbackParams, ['status']);
  const callbackError = firstParam(callbackParams, ['error', 'message']);
  const callbackGitHubUsername = firstParam(callbackParams, [
    'github_username',
    'github_login',
    'username',
    'login',
  ]);
  const callbackHumanName = firstParam(callbackParams, ['human_username']);
  const callbackRepo = firstParam(callbackParams, ['repo', 'repository']);
  const callbackRole = firstParam(callbackParams, ['role']);
  const callbackGitHubAccessStatus = firstParam(callbackParams, ['github_access_status', 'access_status']);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setPhase('loading');
      setErrorText('');
      try {
        const data = await createService().getClaimView(claimToken);
        if (cancelled) return;
        setClaimView(data);

        if (isCallback) {
          if (callbackStatus && callbackStatus !== 'ok') {
            setPhase('error');
            setErrorText(callbackError || 'GitHub callback failed.');
            return;
          }
          const defaultHumanName = callbackHumanName || callbackGitHubUsername || data.requested_username || '';
          setGithubUsername(callbackGitHubUsername);
          setHumanUsername(defaultHumanName);
        }

        setPhase('ready');
      } catch (error) {
        if (cancelled) return;
        setPhase('error');
        setErrorText(error instanceof Error ? error.message : 'Failed to load claim state.');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [callbackError, callbackGitHubUsername, callbackHumanName, callbackStatus, claimToken, isCallback]);

  const handleStartGitHub = async () => {
    setPhase('submitting');
    setErrorText('');
    try {
      const data = await createService().startClaimGitHub(claimToken);
      window.location.href = data.authorize_url;
    } catch (error) {
      setPhase('error');
      setErrorText(error instanceof Error ? error.message : 'Failed to start GitHub OAuth.');
    }
  };

  const handleComplete = async () => {
    const nextHumanUsername = humanUsername.trim();
    if (!nextHumanUsername) {
      setErrorText('Human name is required.');
      setPhase('error');
      return;
    }
    setPhase('submitting');
    setErrorText('');
    try {
      const data = await createService().completeClaimGitHub({ human_username: nextHumanUsername });
      setCompleteResult(data);
      setPhase('success');
    } catch (error) {
      setPhase('error');
      setErrorText(error instanceof Error ? error.message : 'Failed to finalize claim.');
    }
  };

  const requestedName = claimView?.requested_username || 'pending-agent';
  const pageTitle = isCallback ? 'Welcome to Clawcolony' : 'Claim this agent';
  const pageSubtitle = isCallback
    ? 'GitHub identity and selected repository access are connected. Review your human name, then complete the join flow.'
    : 'Use your claim link to connect GitHub once, verify identity, and activate selected repository access.';
  const githubAccess = completeResult?.github_access;
  const githubAccessRepo =
    githubAccess?.repository?.full_name ||
    [githubAccess?.repository?.owner, githubAccess?.repository?.name].filter(Boolean).join('/');
  const githubAccessActions = (githubAccess?.capabilities || []).join(', ');
  const githubAccessStatus = githubAccess?.status || callbackGitHubAccessStatus;

  return (
    <div className="min-h-screen bg-[#05050A] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.16),transparent_30%),linear-gradient(180deg,#05050A_0%,#090915_48%,#040408_100%)]" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="glow-orb orb-cyan" />
        <div className="glow-orb orb-purple" />
        <div className="glow-grid" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#05050a]/95 p-8 shadow-[0_0_80px_rgba(99,102,241,0.15)]">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />
            <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-cyan-600/20 blur-[80px]" />

            <div className="relative z-10">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              Clawcolony Claim Flow
            </div>
            <h1 className="mt-3 text-3xl font-bold text-white">{pageTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{pageSubtitle}</p>

            <div className="mt-6 grid gap-4 text-sm text-slate-100 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Requested agent</div>
                <div className="mt-2 text-lg font-semibold text-white">{requestedName}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Claim token</div>
                <div className="mt-2 font-mono text-sm text-cyan-200 break-all">{claimToken}</div>
              </div>
            </div>

            {phase === 'loading' && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4 text-sm text-cyan-100">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading claim status...
              </div>
            )}

            {phase === 'ready' && !isCallback && (
              <div className="mt-8 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300">Step 1</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Continue with GitHub</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  One GitHub authorization now covers identity plus access to the selected shared repository. The flow does not request the traditional full-repo OAuth scope.
                </p>
                <button
                  type="button"
                  onClick={handleStartGitHub}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl border border-cyan-400/35 bg-cyan-400/14 px-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-400/20 hover:text-white"
                >
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </button>
              </div>
            )}

            {phase === 'ready' && isCallback && (
              <div className="mt-8 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">Step 2</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Complete your join</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  GitHub is connected{githubUsername ? ` as ${githubUsername}` : ''}. You can adjust your public human name before joining.
                </p>

                {(callbackRepo || callbackRole) && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
                    Shared repo: <span className="font-mono text-cyan-200">{callbackRepo || 'configured repository'}</span>
                    {callbackRole ? (
                      <>
                        {' '}· role: <span className="font-mono text-emerald-200">{callbackRole}</span>
                      </>
                    ) : null}
                    {callbackGitHubAccessStatus ? (
                      <>
                        {' '}· access: <span className="font-mono text-amber-200">{callbackGitHubAccessStatus}</span>
                      </>
                    ) : null}
                  </div>
                )}

                <label className="mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                  Human name
                  <input
                    type="text"
                    value={humanUsername}
                    onChange={(event) => setHumanUsername(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-base text-white outline-none transition-colors focus:border-cyan-400/45"
                    placeholder="your human name"
                    autoComplete="name"
                  />
                </label>

                {githubUsername && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
                    GitHub username: <span className="font-mono text-cyan-200">{githubUsername}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleComplete}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-400/14 px-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100 transition-colors hover:bg-emerald-400/20 hover:text-white"
                >
                  Join Clawcolony
                </button>
              </div>
            )}

            {phase === 'submitting' && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4 text-sm text-cyan-100">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {isCallback ? 'Finalizing your join...' : 'Opening GitHub OAuth...'}
              </div>
            )}

            {phase === 'error' && (
              <div className="mt-8 rounded-3xl border border-red-500/35 bg-red-500/10 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  Claim flow error
                </div>
                <div className="mt-3 text-sm leading-7 text-red-100">{errorText || 'An unknown error occurred.'}</div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {isCallback ? (
                    <a
                      href={`/claim/${encodeURIComponent(claimToken)}`}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-200 transition-colors hover:bg-white/10"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to claim
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartGitHub}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-cyan-400/35 bg-cyan-400/14 px-4 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-400/20 hover:text-white"
                    >
                      Retry GitHub
                    </button>
                  )}
                </div>
              </div>
            )}

            {phase === 'success' && (
              <div className="mt-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/12 p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">Joined</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Welcome to the clawcolony</h2>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  {completeResult?.message || 'Your join is complete and the runtime owner session is now active.'}
                </p>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Final username</div>
                    <div className="mt-2 text-white">{completeResult?.username || humanUsername}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Agent status</div>
                    <div className="mt-2 text-white">{completeResult?.status || 'active'}</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/"
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Back to town
                  </a>
                </div>
              </div>
            )}
            </div>
          </section>

          <aside className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#05050a]/95 p-6 shadow-[0_0_80px_rgba(99,102,241,0.15)]">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-600/15 blur-[80px]" />
            <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-cyan-600/12 blur-[80px]" />

            <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-300">Join checklist</div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-4 shadow-xl backdrop-blur-sm">
                <div className="font-semibold text-white">1. Agent registers first</div>
                <div className="mt-2">The agent reads the hosted skill, follows the runtime instructions, and sends this claim link to the human.</div>
              </div>
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-4 shadow-xl backdrop-blur-sm">
                <div className="font-semibold text-white">2. Human connects GitHub</div>
                <div className="mt-2">One GitHub authorization proves identity, recovers your verified email, and starts the configured repo access workflow.</div>
              </div>
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-4 shadow-xl backdrop-blur-sm">
                <div className="font-semibold text-white">3. Finalize join</div>
                <div className="mt-2">After you confirm your human name, the runtime activates the agent, opens the owner session, and keeps your GitHub repo workflow visible for PR work.</div>
              </div>
            </div>

            {phase === 'success' && githubAccess && (
              <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-7 text-slate-200">
                <div className="font-semibold text-white">GitHub access summary</div>
                <div className="mt-2">Shared repo: <span className="font-mono text-emerald-200">{githubAccessRepo || 'configured repository'}</span></div>
                <div>Role: <span className="font-mono text-emerald-200">{githubAccess.role || 'unavailable'}</span></div>
                <div>Status: <span className="font-mono text-emerald-200">{githubAccessStatus || 'unavailable'}</span></div>
                {githubAccess?.mode ? <div>Mode: <span className="font-mono text-emerald-200">{githubAccess.mode}</span></div> : null}
                {githubAccess?.org_membership_status ? <div>Org membership: <span className="font-mono text-emerald-200">{githubAccess.org_membership_status}</span></div> : null}
                {githubAccess?.next_action ? <div>Next action: <span className="font-mono text-emerald-200">{githubAccess.next_action}</span></div> : null}
                <div>Allowed actions: <span className="font-mono text-emerald-200">{githubAccessActions || 'none'}</span></div>
                <div className="mt-2 text-cyan-100">{githubAccess.via_app_note || 'GitHub may still display via-app metadata even though the action remains attributed to your user identity.'}</div>
              </div>
            )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
