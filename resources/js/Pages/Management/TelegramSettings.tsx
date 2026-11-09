import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ManagementHeader from '@/components/ManagementHeader';
import { Bot, Copy, Check, Eye, EyeOff, Send, Radio, AlertCircle } from 'lucide-react';

interface Props {
    settings: {
        telegram_bot_token: string;
        telegram_chat_id: string;
        telegram_webhook_secret: string;
        webhook_url: string;
    };
}

export default function TelegramSettings({ settings }: Props) {
    const [showToken, setShowToken] = useState(false);
    const [copied, setCopied] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [testing, setTesting] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        telegram_bot_token: settings.telegram_bot_token || '',
        telegram_chat_id: settings.telegram_chat_id || '',
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        put('/management/telegram', {
            preserveScroll: true,
        });
    };

    const handleCopyWebhook = () => {
        if (!settings.webhook_url) return;
        navigator.clipboard.writeText(settings.webhook_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRegisterWebhook = () => {
        setRegistering(true);
        router.post('/management/telegram/register-webhook', {}, {
            preserveScroll: true,
            onFinish: () => setRegistering(false),
        });
    };

    const handleTestConnection = () => {
        setTesting(true);
        router.post('/management/telegram/test-connection', {}, {
            preserveScroll: true,
            onFinish: () => setTesting(false),
        });
    };

    return (
        <AppLayout title="Telegram Bot Settings">
            <Head title="Telegram Bot Settings" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-16">
                <ManagementHeader />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="md:col-span-2 flex flex-col gap-6">
                        <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col gap-5">
                            <div>
                                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-indigo-500" /> Telegram Bot Configuration
                                </h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    Connect your shop's private Telegram bot to automatically create orders from screenshots.
                                </p>
                            </div>

                            {/* Bot Token */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="telegram_bot_token">Telegram Bot Token</Label>
                                <div className="relative">
                                    <Input
                                        id="telegram_bot_token"
                                        type={showToken ? 'text' : 'password'}
                                        placeholder="123456789:ABCdefGHIjklMNOpqrst..."
                                        value={data.telegram_bot_token}
                                        onChange={e => setData('telegram_bot_token', e.target.value)}
                                        className="pr-10 font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(!showToken)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                    >
                                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {errors.telegram_bot_token && (
                                    <span className="text-red-500 text-xs">{errors.telegram_bot_token}</span>
                                )}
                                <span className="text-[11px] text-zinc-400">
                                    Create a bot with <strong>@BotFather</strong> on Telegram and paste the HTTP API token here.
                                </span>
                            </div>

                            {/* Chat ID */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="telegram_chat_id">Telegram Chat / Channel ID</Label>
                                <Input
                                    id="telegram_chat_id"
                                    placeholder="-1001234567890"
                                    value={data.telegram_chat_id}
                                    onChange={e => setData('telegram_chat_id', e.target.value)}
                                    className="font-mono text-sm"
                                />
                                {errors.telegram_chat_id && (
                                    <span className="text-red-500 text-xs">{errors.telegram_chat_id}</span>
                                )}
                                <span className="text-[11px] text-zinc-400">
                                    The ID of the group or channel where your team drops order screenshots.
                                </span>
                            </div>

                            {/* Webhook URL (Read-Only) */}
                            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <Label htmlFor="webhook_url">Unique Shop Webhook URL</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="webhook_url"
                                        readOnly
                                        value={settings.webhook_url}
                                        className="bg-zinc-50 dark:bg-zinc-800 font-mono text-xs select-all text-zinc-600 dark:text-zinc-300"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={handleCopyWebhook}
                                        className="shrink-0"
                                        title="Copy URL"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <span className="text-[11px] text-zinc-400">
                                    Protected with a unique secret token. Only messages matching your shop's Chat ID are accepted.
                                </span>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <Button type="submit" disabled={processing}>
                                    Save Settings
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Quick Actions & Help Card */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
                            <h3 className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                                Actions
                            </h3>

                            <div className="flex flex-col gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start text-xs font-semibold gap-2"
                                    onClick={handleTestConnection}
                                    disabled={testing || !data.telegram_bot_token}
                                >
                                    <Radio className="w-4 h-4 text-indigo-500" />
                                    {testing ? 'Testing...' : 'Test Bot Connection'}
                                </Button>

                                <Button
                                    type="button"
                                    variant="default"
                                    className="w-full justify-start text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={handleRegisterWebhook}
                                    disabled={registering || !data.telegram_bot_token}
                                >
                                    <Send className="w-4 h-4" />
                                    {registering ? 'Registering...' : 'Register Webhook with Telegram'}
                                </Button>
                            </div>

                            <p className="text-[11px] text-zinc-400">
                                Once saved, click <strong>Register Webhook</strong> so Telegram automatically starts routing your channel's photos to ShopTracker.
                            </p>
                        </div>

                        {/* Setup Instructions */}
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 text-amber-500" /> Setup Tips
                            </h4>
                            <ol className="list-decimal pl-4 flex flex-col gap-2 text-[11px] leading-relaxed">
                                <li>
                                    Message <strong>@BotFather</strong> on Telegram and send <code>/newbot</code>.
                                </li>
                                <li>
                                    Send <code>/setprivacy</code> to @BotFather $\rightarrow$ select your bot $\rightarrow$ <strong>Disable</strong>.
                                </li>
                                <li>
                                    Add your bot as an <strong>Administrator</strong> in your order group or channel.
                                </li>
                                <li>
                                    To find your Group/Channel Chat ID, forward any message from the group to <strong>@userinfobot</strong> on Telegram.
                                </li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

