<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\User;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Management\SupplierController;
use App\Http\Controllers\Management\CourierController;
use App\Http\Controllers\Management\CategoryController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\SalesOrderController;

// Auth Routes
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
Route::post('/switch-shop', [AuthController::class, 'switchShop']);

// Protected Routes
Route::middleware('auth')->group(function () {
    Route::get('/', [DashboardController::class, 'index']);

    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/create', [InventoryController::class, 'create']);
    Route::post('/inventory', [InventoryController::class, 'store']);

    // Purchase Orders MUST be before {id} to prevent interception
    Route::get('/inventory/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::post('/inventory/purchase-orders', [PurchaseOrderController::class, 'store']);
    Route::get('/inventory/purchase-orders/create', [PurchaseOrderController::class, 'create']);
    Route::get('/inventory/purchase-orders/{id}', [PurchaseOrderController::class, 'show']);
    Route::get('/inventory/purchase-orders/{id}/edit', [PurchaseOrderController::class, 'edit']);
    Route::put('/inventory/purchase-orders/{id}', [PurchaseOrderController::class, 'update']);
    Route::post('/inventory/purchase-orders/{id}/arrive', [PurchaseOrderController::class, 'markAsArrived']);
    Route::post('/inventory/purchase-orders/{id}/cancel', [PurchaseOrderController::class, 'cancel']);
    Route::get('/inventory/{id}/adjust', [StockAdjustmentController::class, 'create']);
    Route::post('/inventory/{id}/adjust', [StockAdjustmentController::class, 'store']);
    Route::get('/inventory/{id}', [InventoryController::class, 'show']);
    Route::get('/inventory/{id}/edit', [InventoryController::class, 'edit']);
    Route::put('/inventory/{id}', [InventoryController::class, 'update']);
    Route::delete('/inventory/{id}', [InventoryController::class, 'destroy']);

    Route::get('/sales', [SalesOrderController::class, 'index']);
    Route::post('/sales', [SalesOrderController::class, 'store']);
    Route::get('/sales/create', [SalesOrderController::class, 'create']);
    Route::get('/sales/{id}', [SalesOrderController::class, 'show']);
    Route::get('/sales/{id}/edit', [SalesOrderController::class, 'edit']);
    Route::put('/sales/{id}', [SalesOrderController::class, 'update']);
    Route::get('/sales/{id}/fulfill', [SalesOrderController::class, 'fulfillView']);
    Route::post('/sales/{id}/fulfill', [SalesOrderController::class, 'fulfillStore']);
    Route::post('/sales/{id}/deliver', [SalesOrderController::class, 'markDelivered']);
    Route::post('/sales/{id}/cancel', [SalesOrderController::class, 'cancel']);
    Route::post('/sales/{id}/settle', [SalesOrderController::class, 'settle']);
    Route::post('/sales/{id}/items/{itemId}/return', [SalesOrderController::class, 'returnItem']);

    Route::redirect('/management', '/management/suppliers');
    Route::get('/management/suppliers', [SupplierController::class, 'index']);
    Route::post('/management/suppliers', [SupplierController::class, 'store']);
    Route::put('/management/suppliers/{id}', [SupplierController::class, 'update']);
    Route::delete('/management/suppliers/{id}', [SupplierController::class, 'destroy']);
    
    Route::get('/management/couriers', [CourierController::class, 'index']);
    Route::post('/management/couriers', [CourierController::class, 'store']);
    Route::put('/management/couriers/{id}', [CourierController::class, 'update']);
    Route::delete('/management/couriers/{id}', [CourierController::class, 'destroy']);
    
    Route::get('/management/categories', [CategoryController::class, 'index']);
    Route::post('/management/categories', [CategoryController::class, 'store']);
    Route::put('/management/categories/{id}', [CategoryController::class, 'update']);
    Route::delete('/management/categories/{id}', [CategoryController::class, 'destroy']);
});
