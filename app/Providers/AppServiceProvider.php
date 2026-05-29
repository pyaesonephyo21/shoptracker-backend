<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Inertia\Inertia::share([
            'errors' => function () {
                return Session::get('errors')
                    ? Session::get('errors')->getBag('default')->getMessages()
                    : (object) [];
            },
            'auth' => function () {
                /** @var \App\Models\User $user */
                $user = Auth::user();
                return [
                    'user' => $user ? $user->only('id', 'name', 'email', 'role', 'shop_id') : null,
                    'shop' => $user && $user->shop ? $user->shop->only('id', 'name', 'settings') : null,
                    'all_shops' => $user ? ($user->role === 'superadmin' ? \App\Models\Shop::select('id', 'name')->get() : $user->shops()->select('shops.id', 'shops.name')->get()) : [],
                ];
            },
            'flash' => function () {
                return [
                    'success' => Session::get('success'),
                    'error' => Session::get('error'),
                ];
            },
        ]);

        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
