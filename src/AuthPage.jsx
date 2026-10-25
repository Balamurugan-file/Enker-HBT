import React,{useState} from 'react';
import {Eye,EyeOff,Sparkles,ArrowRight,LoaderCircle} from 'lucide-react';
import {loginAccount,registerAccount} from './lib/api';

export default function AuthPage(){
  const [mode,setMode]=useState('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  async function handleSubmit(e){
    e.preventDefault();setError('');
    if(mode==='signup'&&password!==confirmPassword){setError('Passwords do not match.');return;}
    if(password.length<8){setError('Password must contain at least 8 characters.');return;}
    setLoading(true);
    try{
      if(mode==='signup') await registerAccount({name,email,password});
      else await loginAccount({email,password});
    }catch(err){setError(err.message||'Something went wrong.');}
    finally{setLoading(false);}
  }
  function switchMode(){setMode(mode==='login'?'signup':'login');setError('');setPassword('');setConfirmPassword('');}
  const input='mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50';
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="w-full max-w-5xl min-h-[570px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl grid md:grid-cols-2">
      <section className="hidden md:flex flex-col justify-between bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-10 text-white">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"><Sparkles size={25}/></div><div><h1 className="text-xl font-extrabold">Habit Tracker</h1><p className="text-xs text-emerald-100">Small Habits, Big Changes</p></div></div>
        <div><p className="mb-4 text-sm font-semibold text-emerald-100">YOUR JOURNEY STARTS HERE</p><h2 className="max-w-sm text-4xl font-extrabold leading-tight">Build better habits. Become your best self.</h2><p className="mt-5 max-w-sm text-sm leading-7 text-emerald-50">Track your progress, celebrate small wins, and build consistency one day at a time.</p><div className="mt-8 flex gap-2">{[1,2,3,4,5,6,7].map(n=><span key={n} className={`h-2 w-8 rounded-full ${n<6?'bg-white':'bg-white/25'}`}/>)}</div><p className="mt-3 text-xs text-emerald-100">Every small step counts.</p></div>
        <p className="text-xs text-emerald-100">Habit Tracker · 2026 Edition</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-sm">
        <div className="mb-8 md:hidden"><div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-emerald-600 text-white"><Sparkles size={24}/></div><h1 className="text-2xl font-extrabold text-slate-900">Habit Tracker</h1><p className="mt-1 text-sm text-slate-500">Small Habits, Big Changes</p></div>
        <p className="text-sm font-semibold text-emerald-700">{mode==='login'?'WELCOME BACK':'START YOUR JOURNEY'}</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{mode==='login'?'Sign in':'Create account'}</h2><p className="mt-2 text-sm text-slate-500">{mode==='login'?'Sign in to continue tracking your habits.':'Create an account to save your personal progress.'}</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {mode==='signup'&&<label className="block text-sm font-semibold text-slate-700">Full name<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" className={input}/></label>}
          <label className="block text-sm font-semibold text-slate-700">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className={input}/></label>
          <label className="block text-sm font-semibold text-slate-700">Password<div className="relative mt-2"><input required minLength={8} type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" className={`${input} mt-0 pr-11`}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          {mode==='signup'&&<label className="block text-sm font-semibold text-slate-700">Confirm password<input required type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className={input}/></label>}
          {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <button disabled={loading} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">{loading?<LoaderCircle size={18} className="animate-spin"/>:<>{mode==='login'?'Sign in':'Create account'}<ArrowRight size={17}/></>}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">{mode==='login'?"Don't have an account?":'Already have an account?'} <button type="button" onClick={switchMode} className="font-bold text-emerald-700">{mode==='login'?'Sign up':'Sign in'}</button></p>
        <p className="mt-7 text-center text-xs leading-5 text-slate-400">Your habit data is associated with your account.</p>
      </div></section>
    </div>
  </main>;
}