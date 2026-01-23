<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CourierController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\SalesOrderController;
use App\Http\Controllers\Api\InventoryLogController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\StockAdjustmentController;

// Public Routes (No Token Needed)
Route::post('/login', [AuthController::class, 'login']);

// Protected Routes (Token Required)
// This 'auth:sanctum' middleware checks the token automatically
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::apiResource('products', ProductController::class);

    // Standard CRUD
    Route::apiResource('purchase-orders', PurchaseOrderController::class);

    // Custom Action: "Click to Arrive"
    Route::post('/purchase-orders/{id}/arrive', [PurchaseOrderController::class, 'markArrived']);

    Route::get('/inventory-logs', [InventoryLogController::class, 'index']);

    Route::apiResource('sales-orders', SalesOrderController::class);
    Route::post('/sales-orders/{id}/fulfill', [SalesOrderController::class, 'fulfill']);
    Route::post('/sales-orders/{id}/add-item', [SalesOrderController::class, 'addItem']);
    Route::delete('/sales-orders/{id}/return-item', [SalesOrderController::class, 'returnItem']);

    // Payment / Cancel
    Route::post('/sales-orders/{id}/settle', [SalesOrderController::class, 'settle']);
    Route::post('/sales-orders/{id}/cancel', [SalesOrderController::class, 'cancel']);

    Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::apiResource('suppliers', SupplierController::class);

    Route::apiResource('categories', CategoryController::class);

    Route::apiResource('couriers', CourierController::class);
});
