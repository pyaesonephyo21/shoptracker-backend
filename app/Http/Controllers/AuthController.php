<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AuthController extends Controller
{
    public function showLogin()
    {
        // If already logged in, go to dashboard
        if (Auth::check()) {
            return redirect('/');
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
            return redirect()->intended('/');
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
        
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        // Superadmin can switch to ANY shop. Others can only switch to authorized shops.
        if ($user->role === 'superadmin' || $user->shops()->where('shops.id', $request->shop_id)->exists()) {
            $user->shop_id = $request->shop_id;
            $user->save();
        }
        
        return back();
    }
}
