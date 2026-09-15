<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;
use App\Models\User;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create Roles if they don't exist
        $roles = ['superadmin', 'admin', 'user'];
        foreach ($roles as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        // 2. Assign superadmin role to existing superadmins based on the legacy 'role' column
        $superAdmins = User::where('role', 'superadmin')->get();
        foreach ($superAdmins as $admin) {
            $admin->assignRole('superadmin');
        }

        // Also, assign 'admin' role to legacy 'owner' or 'admin'
        $admins = User::whereIn('role', ['admin', 'owner'])->get();
        foreach ($admins as $admin) {
            $admin->assignRole('admin');
        }
    }

    public function down(): void
    {
        // We typically don't revert data migrations unless strictly necessary.
    }
};
