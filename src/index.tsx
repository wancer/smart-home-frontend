'use client';

import "./App.scss";

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

import HttpApi from "./api/http.ts";
import { themeManager } from './ThemeManager.ts'
import { AuthorizedUserApp } from "./App.tsx"

const localStorageField = "jwt";

themeManager.init();

export function LoginPage() {
  const jwt = localStorage.getItem(localStorageField);
  const [isLoggedIn, setLoggedIn] = useState<boolean>(jwt !== null);
  const [api] = useState<HttpApi>(new HttpApi(jwt || ""));

  if (isLoggedIn) {
    return <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <AuthorizedUserApp api={api}></AuthorizedUserApp>
      </GoogleOAuthProvider>
  }

  return <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <div id="login-center"> 
      <GoogleLogin 
        onSuccess={credentialResponse => {
          api.login(credentialResponse)
            .then(
              apiResponse => {
                localStorage.setItem(localStorageField, apiResponse.token)
                api.token = apiResponse.token;
                setLoggedIn(true)
              }
            )
            .catch(err => console.error(err))
          ;
        }}
        onError={() => {
          console.log('Login Failed');
        }}
      />
    </div>

  </GoogleOAuthProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginPage />
  </StrictMode>,
)
