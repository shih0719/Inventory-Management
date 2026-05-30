// src/components/LoginPage.tsx
import { useState, useEffect } from 'react';
import { login, getProvider } from '../api/auth';
import { ApiError } from '../api/client';
import type { User } from '../api/auth';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  lang: 'en' | 'zh' | 'ja';
}

const texts = {
  en: {
    title: 'Inventory Management',
    username: 'Username',
    password: 'Password',
    login: 'Login',
    loginError: 'Login failed',
    loginErrorDetail: 'Invalid username or password',
    loading: 'Logging in...',
    microsoftLogin: 'Sign in with Microsoft',
  },
  zh: {
    title: '庫存管理',
    username: '使用者名稱',
    password: '密碼',
    login: '登入',
    loginError: '登入失敗',
    loginErrorDetail: '使用者名稱或密碼不正確',
    loading: '登入中...',
    microsoftLogin: '使用 Microsoft 登入',
  },
  ja: {
    title: 'インベントリ管理',
    username: 'ユーザー名',
    password: 'パスワード',
    login: 'ログイン',
    loginError: 'ログイン失敗',
    loginErrorDetail: 'ユーザー名またはパスワードが正しくありません',
    loading: 'ログイン中...',
    microsoftLogin: 'Microsoft でサインイン',
  },
};

export function LoginPage({ onLoginSuccess, lang }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'local' | 'microsoft' | null>(null);

  const t = texts[lang];

  useEffect(() => {
    getProvider().then(setProvider).catch(() => setProvider('local'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login({ username, password });
      onLoginSuccess(user);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      setError(message || t.loginErrorDetail);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    window.location.href = '/api/auth/microsoft/redirect';
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="logo-large">S</div>
          <h1>{t.title}</h1>
        </div>

        {provider === 'local' && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">{t.username}</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="eric"
                required
                autoFocus
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">{t.password}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="password123"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" disabled={loading} className="btn-lg">
              {loading ? t.loading : t.login}
            </button>
          </form>
        )}

        {provider === 'microsoft' && (
          <div className="login-form">
            <button onClick={handleMicrosoftLogin} className="btn-lg btn-microsoft">
              {t.microsoftLogin}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .login-page {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--bg-0) 0%, var(--bg-1) 100%);
          position: fixed;
          top: 0;
          left: 0;
          overflow: hidden;
        }

        .login-container {
          width: 100%;
          max-width: 320px;
          padding: 0 16px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .logo-large {
          font-size: 36px;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 8px;
          display: inline-block;
          width: 48px;
          height: 48px;
          line-height: 48px;
          background: var(--bg-1);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .login-header h1 {
          font-size: 20px;
          font-weight: 600;
          color: var(--ink-0);
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 500;
          color: var(--ink-2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-group input {
          padding: 8px 10px;
          font-size: 13px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: white;
          color: var(--ink-0);
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
        }

        .form-group input:disabled {
          background: var(--bg-0);
          color: var(--ink-2);
          cursor: not-allowed;
        }

        .form-error {
          padding: 8px 12px;
          font-size: 13px;
          color: #d32f2f;
          background: #ffebee;
          border-radius: 4px;
          border-left: 3px solid #d32f2f;
        }

        .btn-guest {
          display: block;
          text-align: center;
          padding: 8px 12px;
          font-size: 13px;
          background: white;
          color: var(--accent);
          border: 1px solid var(--accent);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          text-decoration: none;
          margin-bottom: 12px;
        }

        .btn-guest:hover {
          background: var(--accent);
          color: white;
        }

        .login-form .btn-lg {
          padding: 8px 16px;
          font-size: 13px;
        }

        .btn-microsoft {
          background: #0078d4;
          color: white;
          border: none;
          width: 100%;
          cursor: pointer;
          border-radius: 4px;
          font-family: inherit;
          font-weight: 500;
        }

        .btn-microsoft:hover {
          background: #106ebe;
        }
      `}</style>
    </div>
  );
}
