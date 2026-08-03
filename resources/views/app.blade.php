<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover">

        <!-- iOS Web App Capability & Styling -->
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="ShopTracker">
        
        <!-- App Icons & PWA Manifest -->
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">

        <title inertia>{{ config('app.name', 'ShopTracker') }}</title>


        <!-- Scripts -->
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-white text-black dark:bg-black dark:text-white overscroll-none">
        @inertia
    </body>
</html>
