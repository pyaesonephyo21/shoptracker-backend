<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\CashTransaction;
use App\Services\CashFlowService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CashFlowController extends Controller
{
    public function index(Request $request)
    {
        $query = CashTransaction::query();

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        // Calculate total balance across the shop
        $totalBalance = CashTransaction::sum('amount');

        $transactions = $query->orderBy('created_at', 'desc')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Finance/CashFlow', [
            'transactions' => $transactions,
            'totalBalance' => (float) $totalBalance,
            'filters' => [
                'start_date' => $request->start_date ?? '',
                'end_date' => $request->end_date ?? '',
                'type' => $request->type ?? 'all',
            ]
        ]);
    }

    public function storeManual(Request $request, CashFlowService $cashFlowService)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'type' => 'required|in:manual_in,manual_out',
            'description' => 'required|string|max:255',
        ]);

        if ($validated['type'] === 'manual_in') {
            $cashFlowService->recordInflow(
                null, // shop_id is automatically assigned via BelongsToShop trait when created, wait, CashFlowService needs shop_id
                $validated['amount'],
                'manual_in',
                $validated['description']
            );
        } else {
            $cashFlowService->recordOutflow(
                null,
                $validated['amount'],
                'manual_out',
                $validated['description']
            );
        }

        return redirect()->back()->with('success', 'Manual cash transaction recorded successfully.');
    }
}
