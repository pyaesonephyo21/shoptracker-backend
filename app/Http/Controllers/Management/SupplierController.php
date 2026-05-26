<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Supplier;

class SupplierController extends Controller
{
    public function index()
    {
        $suppliers = Supplier::latest()->get();
        return Inertia::render('Management/Suppliers', [
            'suppliers' => $suppliers,
            'showForeignOptions' => true // Or derive from shop settings later
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:local,foreign',
            'currency' => 'required|string',
            'contact' => 'nullable|string|max:255',
        ]);

        // Map contact to contact_info as per DB schema
        $validated['contact_info'] = $validated['contact'];
        unset($validated['contact']);

        Supplier::create($validated);

        return redirect()->back()->with('success', 'Supplier created successfully.');
    }
}
