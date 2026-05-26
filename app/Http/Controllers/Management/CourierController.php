<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Courier;

class CourierController extends Controller
{
    public function index()
    {
        $couriers = Courier::latest()->get();
        return Inertia::render('Management/Couriers', [
            'couriers' => $couriers
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'default_fee' => 'required|numeric|min:0',
        ]);

        // Map fields
        $validated['contact_info'] = $validated['contact'] ?? null;
        $validated['default_service_fee'] = $validated['default_fee'];
        unset($validated['contact'], $validated['default_fee']);

        Courier::create($validated);

        return redirect()->back()->with('success', 'Courier created successfully.');
    }
}
