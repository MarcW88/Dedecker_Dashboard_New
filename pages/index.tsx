import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'dedecker2026') {
      sessionStorage.setItem('auth', '1');
      router.push('/dashboard');
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <>
      <Head>
        <title>DeDecker — Semantic Analysis</title>
      </Head>
      <div className="min-h-screen bg-dedecker-light flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-10 w-full max-w-sm">
          <img src="/dedecker-logo.png" alt="DeDecker" className="h-12 mb-6" />
          <h1 className="text-xl font-semibold text-dedecker-dark mb-1">Semantic Analysis</h1>
          <p className="text-sm text-stone-500 mb-6">Dashboard — April 2026</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              className="w-full border border-stone-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-taupe"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm">Incorrect password</p>}
            <button
              type="submit"
              className="w-full bg-taupe-dark text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-taupe transition-colors"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
