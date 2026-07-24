<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentMethodController extends Controller
{
    public function index(Request $request)
    {
        $methods = $request->user()->shop->paymentMethods()->orderBy('id')->get();
        return Inertia::render('Management/PaymentMethods', [
            'paymentMethods' => $methods
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50',
            'is_active' => 'boolean',
        ]);

        $request->user()->shop->paymentMethods()->create($validated);

        return back()->with('success', 'Payment method added successfully.');
    }

    public function update(Request $request, PaymentMethod $paymentMethod)
    {
        if ($paymentMethod->shop_id !== $request->user()->shop_id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50',
            'is_active' => 'boolean',
        ]);

        $paymentMethod->update($validated);

        return back()->with('success', 'Payment method updated successfully.');
    }

    public function destroy(Request $request, PaymentMethod $paymentMethod)
    {
        if ($paymentMethod->shop_id !== $request->user()->shop_id) {
            abort(403);
        }

        $paymentMethod->delete();

        return back()->with('success', 'Payment method deleted successfully.');
    }
}
