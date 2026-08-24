<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SupplierController extends Controller
{
    public function index()
    {
        $suppliers = Supplier::latest()->paginate(15)->withQueryString();

        return Inertia::render('Management/Suppliers', [
            'suppliers' => $suppliers,
            'showForeignOptions' => true, // Or derive from shop settings later
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

    public function update(Request $request, Supplier $supplier)
    {

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:local,foreign',
            'currency' => 'required|string',
            'contact' => 'nullable|string|max:255',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'type' => $validated['type'],
            'currency' => $validated['currency'],
            'contact_info' => $validated['contact'] ?? null,
        ];

        $supplier->update($updateData);

        return redirect()->back()->with('success', 'Supplier updated successfully.');
    }

    public function destroy(Supplier $supplier)
    {

        if (PurchaseOrder::where('supplier_id', $supplier->id)->exists()) {
            return redirect()->back()->withErrors(['error' => 'Cannot delete this supplier because it is linked to existing purchase orders.']);
        }

        $supplier->delete();

        return redirect()->back()->with('success', 'Supplier deleted successfully.');
    }
}
