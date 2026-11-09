<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSupplierRequest;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
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

    public function store(StoreSupplierRequest $request): RedirectResponse
    {
        Supplier::create($request->supplierData());

        return redirect()->back()->with('success', 'Supplier created successfully.');
    }

    public function update(StoreSupplierRequest $request, Supplier $supplier): RedirectResponse
    {
        $supplier->update($request->supplierData());

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
