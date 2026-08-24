<?php

namespace App\Http\Controllers;

use App\Services\DashboardMetricsService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request, DashboardMetricsService $metricsService)
    {
        $startDate = $request->input('start_date')
            ? Carbon::parse($request->input('start_date'))->startOfDay()
            : Carbon::now()->startOfMonth();

        $endDate = $request->input('end_date')
            ? Carbon::parse($request->input('end_date'))->endOfDay()
            : Carbon::now()->endOfDay();

        $statusFilter = $request->input('revenue_status', 'completed');

        // Fetch metrics from the dedicated service
        $data = $metricsService->getMetrics($startDate, $endDate, $statusFilter);

        return Inertia::render('Dashboard', [
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'revenue_status' => $statusFilter,
            ],
            'metrics' => $data['metrics'],
            'alerts' => $data['alerts'],
            'cashFlow' => $data['cashFlow'],
        ]);
    }
}
