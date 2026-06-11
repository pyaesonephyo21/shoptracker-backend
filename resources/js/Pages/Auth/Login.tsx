import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        email: '',
        password: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-zinc-50 dark:bg-black p-6 font-sans">
            <Head title="Log in" />

            <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-3xl shadow-xl dark:shadow-2xl dark:shadow-white/5 border border-zinc-100 dark:border-zinc-800 p-8 sm:p-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center mb-6 shadow-md rotate-3 hover:rotate-0 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" /></svg>
                    </div>
                    <h1 className="text-3xl font-black text-center tracking-tight">ShopTracker</h1>
                    <p className="text-zinc-500 text-sm mt-2 font-medium">Welcome back. Log in to continue.</p>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            onChange={(e) => { setData('email', e.target.value); clearErrors('email'); }}
                            className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            placeholder="owner@shop.com"
                            autoComplete="username"
                            autoFocus
                        />
                        {errors.email && <span className="text-red-500 text-xs font-medium px-1">{errors.email}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            onChange={(e) => { setData('password', e.target.value); clearErrors('password'); }}
                            className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            autoComplete="current-password"
                        />
                        {errors.password && <span className="text-red-500 text-xs font-medium px-1">{errors.password}</span>}
                    </div>

                    <Button
                        type="submit"
                        disabled={processing}
                        className="w-full h-12 rounded-xl font-bold uppercase tracking-widest mt-2"
                    >
                        {processing ? 'Logging in...' : 'Log in'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
