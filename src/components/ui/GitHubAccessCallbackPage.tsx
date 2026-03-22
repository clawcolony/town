import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, LoaderCircle, ShieldCheck } from 'lucide-react';
import { RuntimeClient, RuntimePhase1Service } from '../../services/runtimeAdapter';
import type { RuntimeGitHubAccessStatusResponse } from '../../services/runtimeAdapter/contracts';
import { getRuntimeBaseUrl } from '../../services/runtimeAdapter';

type Phase = 'loading' | 'ready' | 'error';

const createService = () => new RuntimePhase1Service(new RuntimeClient({ baseUrl: getRuntimeBaseUrl() }));

const firstParam = (params: URLSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim().length > 0) return value.trim();
  }
  return '';
};

export function GitHubAccessCallbackPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<RuntimeGitHubAccessStatusResponse | null>(null);
  const [errorText, setErrorText] = useState('');

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const callbackStatus = firstParam(params, ['status']);
  const callbackError = firstParam(params, ['error', 'message']);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (callbackStatus && callbackStatus !== 'ok') {
        setPhase('error');
        setErrorText(callbackError || 'GitHub callback failed.');
        return;
      }
      try {
        const data = await createService().getGitHubAccessStatus();
        if (cancelled) return;
        setStatus(data);
        setPhase('ready');
      } catch (error) {
        if (cancelled) return;
        setPhase('error');
        setErrorText(error instanceof Error ? error.message : 'Failed to load GitHub access status.');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [callbackError, callbackStatus]);

  const repo = status?.repository?.full_name || [status?.repository?.owner, status?.repository?.name].filter(Boolean).join('/');
  const isReady = status?.status === 'active_contributor' || status?.status === 'active_maintainer';
  const statusLabel = status?.status || 'unknown';

  return (
    <div className="min-h-screen bg-[#05050A] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.16),transparent_30%),linear-gradient(180deg,#05050A_0%,#090915_48%,#040408_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10">
        <div className="w-full rounded-3xl border border-indigo-500/30 bg-[#05050a]/95 p-8 shadow-[0_0_80px_rgba(99,102,241,0.15)]">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300">
            <ShieldCheck className="h-4 w-4" />
            GitHub Access
          </div>
          <h1 className="mt-3 text-3xl font-bold text-white">GitHub access workflow</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            One GitHub authorization covers identity plus the configured repo workflow. PR and merge API actions remain user-attributed, while GitHub may still show via-app metadata.
          </p>

          {phase === 'loading' && (
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4 text-sm text-cyan-100">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading GitHub access status...
            </div>
          )}

          {phase === 'error' && (
            <div className="mt-8 rounded-3xl border border-red-500/35 bg-red-500/10 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                <AlertTriangle className="h-4 w-4" />
                GitHub access error
              </div>
              <div className="mt-3 text-sm leading-7 text-red-100">{errorText || 'An unknown error occurred.'}</div>
            </div>
          )}

          {phase === 'ready' && status && (
            <div className="mt-8 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
              <div
                className={`rounded-2xl border p-4 ${
                  isReady
                    ? 'border-emerald-300/35 bg-emerald-300/12 text-emerald-50'
                    : 'border-amber-300/30 bg-amber-300/10 text-amber-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck className={`mt-0.5 h-5 w-5 ${isReady ? 'text-emerald-200' : 'text-amber-200'}`} />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
                      {isReady ? 'Authorization complete' : 'Authorization received'}
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {isReady ? 'Successfully authorized' : 'GitHub approval finished, setup still in progress'}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-white/85">
                      {isReady
                        ? `GitHub access is now connected${status.github_username ? ` as ${status.github_username}` : ''}. You can return to town or close this page.`
                        : 'Your GitHub approval was accepted, but the repo workflow still needs to finish before write access is fully ready.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                {isReady ? 'Ready' : 'In progress'}
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">
                {status.github_username ? `GitHub connected as ${status.github_username}` : 'GitHub is connected'}
              </h3>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Shared repo</div>
                  <div className="mt-2 text-white">{repo || 'Pending repository binding'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Access status</div>
                  <div className="mt-2 text-white">{statusLabel}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Current role</div>
                  <div className="mt-2 text-white">{status.role || 'pending'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Workflow mode</div>
                  <div className="mt-2 text-white">{status.mode || 'unavailable'}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Org membership</div>
                  <div className="mt-2 text-white">{status.org_membership_status || 'unavailable'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Contributor team</div>
                  <div className="mt-2 text-white">{status.team?.slug || 'unavailable'}</div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-200">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Allowed actions</div>
                <div className="mt-2">{(status.capabilities || []).join(', ') || 'No active capabilities'}</div>
              </div>
              {(status.next_action || status.blocking_reason) && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm text-amber-100">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200">Workflow state</div>
                  <div className="mt-2">Next action: {status.next_action || 'none'}</div>
                  <div className="mt-1">Blocking reason: {status.blocking_reason || 'none'}</div>
                  {status.org ? <div className="mt-1">Org: {status.org}</div> : null}
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4 text-sm leading-7 text-cyan-100">
                {status.via_app_note || 'GitHub may display via-app metadata even though the action remains attributed to your user identity.'}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="/"
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-200 transition-colors hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4" />
                  Back to town
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
