<?php

namespace App\Providers;

use App\Models\Shop;
use App\Models\User;
use Google\Client;
use Google\Service\Drive;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use League\Flysystem\Filesystem;
use Masbug\Flysystem\GoogleDriveAdapter;

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
        Storage::extend('google', function ($app, $config) {
            $options = [];
            if (!empty($config['teamDriveId'] ?? null)) {
                $options['teamDriveId'] = $config['teamDriveId'];
            }
            if (!empty($config['sharedFolderId'] ?? null)) {
                $options['sharedFolderId'] = $config['sharedFolderId'];
            }

            $client = new Client();
            $client->setClientId($config['clientId']);
            $client->setClientSecret($config['clientSecret']);
            $client->refreshToken($config['refreshToken']);
            $service = new Drive($client);
            $adapter = new GoogleDriveAdapter($service, $config['folderId'] ?? '', $options);
            $driver = new Filesystem($adapter);

            return new FilesystemAdapter($driver, $adapter, $config);
        });
        Inertia::share([
            'errors' => function () {
                return Session::get('errors')
                    ? Session::get('errors')->getBag('default')->getMessages()
                    : (object) [];
            },
            'auth' => function () {
                /** @var User $user */
                $user = Auth::user();
                return [
                    'user' => $user ? $user->only('id', 'name', 'email', 'role', 'shop_id') : null,
                    'shop' => $user && $user->shop ? $user->shop->only('id', 'name', 'settings') : null,
                    'all_shops' => $user ? ($user->role === 'superadmin' ? Shop::select('id', 'name')->get() : $user->shops()->select('shops.id', 'shops.name')->get()) : [],
                    'payment_methods' => $user && $user->shop && Schema::hasTable('payment_methods') ? $user->shop->paymentMethods()->where('is_active', true)->select('id', 'name', 'code')->get() : [],
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
