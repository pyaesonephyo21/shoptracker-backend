<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function __construct()
    {
        // Enforce superadmin access for user management
        // In a real scenario, you might allow 'admin' to create 'user' inside their shop
        // But for this phase, we lock it to superadmin.
        // Wait, let's just do a manual check or let Spatie middleware handle it if configured.
    }

    public function index(Request $request)
    {
        $this->authorizeSuperAdmin($request->user());

        $users = User::with('shops', 'roles')->latest()->get();

        return Inertia::render('Management/Users', [
            'users' => $users,
            'shops' => Shop::select('id', 'name')->get(),
            'roles' => Role::where('name', '!=', 'superadmin')->select('id', 'name')->get(),
        ]);
    }



    public function store(Request $request)
    {
        $this->authorizeSuperAdmin($request->user());

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|string|exists:roles,name',
            'shop_ids' => 'required|array',
            'shop_ids.*' => 'exists:shops,id',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'shop_id' => $validated['shop_ids'][0] ?? null,
        ]);

        $user->assignRole($validated['role']);
        $user->shops()->attach($validated['shop_ids']);

        return back()->with('success', 'User created successfully.');
    }



    public function update(Request $request, User $user)
    {
        $this->authorizeSuperAdmin($request->user());

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'required|string|exists:roles,name',
            'shop_ids' => 'required|array',
            'shop_ids.*' => 'exists:shops,id',
        ]);

        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'shop_id' => $validated['shop_ids'][0] ?? null,
        ];

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        $user->syncRoles([$validated['role']]);
        $user->shops()->sync($validated['shop_ids']);

        return back()->with('success', 'User updated successfully.');
    }

    public function destroy(Request $request, User $user)
    {
        $this->authorizeSuperAdmin($request->user());

        if ($user->id === $request->user()->id) {
            return back()->with('error', 'You cannot delete yourself.');
        }

        $user->delete();

        return back()->with('success', 'User deleted successfully.');
    }

    private function authorizeSuperAdmin($user)
    {
        if (!$user || !$user->hasRole('superadmin')) {
            abort(403, 'Unauthorized. Super Admin access required.');
        }
    }
}
