'use client';

import "./App.scss";

import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse, googleLogout, useGoogleOneTapLogin } from '@react-oauth/google';
import { useTranslation } from "react-i18next";
import { Alert } from "react-bootstrap";

import HttpApi, { HttpError } from "./api/http.ts";
import { authSession, EndReason } from "./api/auth.ts";
import { themeManager } from './ThemeManager.ts'
import "./i18n/index.ts";
import { AuthorizedUserApp } from "./App.tsx"

themeManager.init();

const api = new HttpApi();

function useAuthToken(): [string | null, EndReason | null] {
  const [state, setState] = useState(() => [authSession.getToken(), authSession.getEndReason()] as const);
  useEffect(() => authSession.subscribe((token, reason) => setState([token, reason])), []);
  return [state[0], state[1]];
}

function loginErrorKey(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.status === 403) return 'auth.notAllowed';
    if (e.status === 401) return 'auth.rejected';
  }
  return 'auth.loginFailed';
}

function LoginScreen({ endReason }: { endReason: EndReason | null }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCredential = (credentialResponse: CredentialResponse) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    api.login(credentialResponse)
      .then(res => authSession.start(res.token))
      .catch(e => {
        // Final answer from the backend: show it, never retry automatically.
        console.error(e instanceof HttpError ? `Login failed: ${e.status}` : (e as Error).message);
        // Stop One Tap from silently re-picking the same (e.g. not-allowed) account.
        googleLogout();
        setError(t(loginErrorKey(e), { status: e instanceof HttpError ? e.status : '' }));
        setBusy(false);
      });
  };

  // Silent re-login: with auto_select, One Tap signs a returning user in without a click.
  // Off after an explicit logout or a failed attempt, so it can't loop.
  useGoogleOneTapLogin({
    onSuccess: onCredential,
    onError: () => {},
    auto_select: true,
    disabled: busy || error !== null || endReason === 'logout',
  });

  return (
    <div id="login-center">
      <div className="d-flex flex-column align-items-center gap-3">
        {endReason === 'expired' && !error && <Alert variant="info" className="mb-0">{t('auth.sessionExpired')}</Alert>}
        {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
        <GoogleLogin
          onSuccess={onCredential}
          onError={() => setError(t('auth.googleFailed'))}
        />
      </div>
    </div>
  );
}

export function LoginPage() {
  const [token, endReason] = useAuthToken();

  // The URL is left untouched while signed out, so after re-login the router
  // remounts on the same route the user was on.
  return <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    {token !== null
      ? <AuthorizedUserApp api={api} />
      : <LoginScreen endReason={endReason} />}
  </GoogleOAuthProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginPage />
  </StrictMode>,
)
