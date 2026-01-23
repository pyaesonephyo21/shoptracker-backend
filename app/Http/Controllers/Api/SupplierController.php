<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Http\Requests\StoreSupplierRequest;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index()
    {
        // Return all suppliers for my shop
        return Supplier::all();
    }

    public function store(StoreSupplierRequest $request)
    {
        $supplier = Supplier::create($request->validated());
        return response()->json($supplier, 201);
    }

    public function show($id)
    {
        return Supplier::findOrFail($id);
    }

    public function update(StoreSupplierRequest $request, $id)
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->update($request->validated());
        return response()->json($supplier);
    }

    public function destroy($id)
    {
        $supplier = Supplier::findOrFail($id);

        // Optional: Check if we have orders with this supplier before deleting?
        // For now, the database 'onDelete set null' handles safety.
        $supplier->delete();

        return response()->noContent();
    }
}
