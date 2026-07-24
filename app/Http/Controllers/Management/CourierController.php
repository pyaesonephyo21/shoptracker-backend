<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Courier;
use App\Models\SalesOrder;

class CourierController extends Controller
{
    public function index()
    {
        $couriers = Courier::latest()->paginate(15)->withQueryString();
        return Inertia::render('Management/Couriers', [
            'couriers' => $couriers
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'default_fee' => 'nullable|numeric|min:0',
            'default_overcharge' => 'nullable|numeric|min:0',
        ]);

        // Map fields
        $validated['contact_info'] = $validated['contact'] ?? null;
        $validated['default_service_fee'] = $validated['default_fee'] ?? 0;
        $validated['default_overcharge'] = $validated['default_overcharge'] ?? 0;
        unset($validated['contact'], $validated['default_fee']);

        Courier::create($validated);

        return redirect()->back()->with('success', 'Courier created successfully.');
    }
    public function update(Request $request, Courier $courier)
    {

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'default_fee' => 'nullable|numeric|min:0',
            'default_overcharge' => 'nullable|numeric|min:0',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'contact_info' => $validated['contact'] ?? null,
            'default_service_fee' => $validated['default_fee'] ?? 0,
            'default_overcharge' => $validated['default_overcharge'] ?? 0,
        ];

        $courier->update($updateData);

        return redirect()->back()->with('success', 'Courier updated successfully.');
    }

    public function destroy(Courier $courier)
    {

        if (SalesOrder::where('courier_id', $courier->id)->exists()) {
            return redirect()->back()->withErrors(['error' => 'Cannot delete this courier because it is linked to existing sales orders.']);
        }

        $courier->delete();

        return redirect()->back()->with('success', 'Courier deleted successfully.');
    }
}
