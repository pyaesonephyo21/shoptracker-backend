<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ExpenseExport;
use App\Services\CashFlowService;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = Expense::query();

        if ($request->filled('start_date')) {
            $query->whereDate('incurred_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('incurred_at', '<=', $request->end_date);
        }

        $expenses = $query->orderBy('incurred_at', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate(15)->withQueryString();

        return Inertia::render('Management/Expenses', [
            'expenses' => $expenses,
            'filters' => [
                'start_date' => $request->start_date ?? '',
                'end_date' => $request->end_date ?? '',
            ]
        ]);
    }

    public function export(Request $request)
    {
        $query = Expense::query();

        if ($request->filled('start_date')) {
            $query->whereDate('incurred_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('incurred_at', '<=', $request->end_date);
        }

        $query->orderBy('incurred_at', 'desc')
            ->orderBy('created_at', 'desc');

        $date = now()->format('Y_m_d');

        return Excel::download(new ExpenseExport($query), "expenses_{$date}.xlsx");
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'incurred_at' => 'required|date',
            'category' => 'nullable|string|max:255',
            'note' => 'nullable|string',
        ]);



        $expense = Expense::create($validated);

        app(CashFlowService::class)->recordOutflow(
            $expense->shop_id,
            $expense->amount,
            'expense',
            $expense->title,
            Expense::class,
            $expense->id
        );

        return redirect()->back()->with('success', 'Expense recorded successfully.');
    }

    public function update(Request $request, Expense $expense)
    {

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'incurred_at' => 'required|date',
            'category' => 'nullable|string|max:255',
            'note' => 'nullable|string',
        ]);

        $expense->update($validated);

        app(CashFlowService::class)->updateTransaction(
            Expense::class,
            $expense->id,
            $expense->amount,
            $expense->title
        );

        return redirect()->back()->with('success', 'Expense updated successfully.');
    }

    public function destroy(Expense $expense)
    {
        app(CashFlowService::class)->deleteTransaction(Expense::class, $expense->id);

        $expense->delete();

        return redirect()->back()->with('success', 'Expense deleted successfully.');
    }
}
