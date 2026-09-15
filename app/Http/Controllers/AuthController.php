<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AuthController extends Controller
{
    public function showLogin()
    {
        // If already logged in, go to dashboard
        if (Auth::check()) {
            return redirect('/dashboard');
        }

        return Inertia::render('Auth/Login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (Auth::attempt($credentials)) {
            $request->session()->regenerate();

            return redirect()->intended('/dashboard');
        }

        return back()->withErrors([
            'email' => 'The provided credentials do not match our records.',
        ])->onlyInput('email');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }

    public function switchShop(Request $request)
    {
        $request->validate(['shop_id' => 'required|exists:shops,id']);

        /** @var User $user */
        $user = Auth::user();

        if ($user->hasRole('superadmin') || $user->shops()->where('shops.id', $request->shop_id)->exists()) {
            $user->shop_id = $request->shop_id;
            $user->save();
        }

        $previousPath = parse_url(url()->previous(), PHP_URL_PATH);

        // If the previous URL contains a numeric ID segment (e.g., /sales/28 or /inventory/products/123/edit),
        // it is a detail page specific to the old shop. Returning back will cause a 404.
        // Redirect to dashboard instead.
        if ($previousPath && preg_match('/\/(\d+)(\/|$)/', $previousPath)) {
            return redirect('/dashboard');
        }

        return back();
    }
}
