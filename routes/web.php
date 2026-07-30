<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\User;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Management\SupplierController;
use App\Http\Controllers\Management\CourierController;
use App\Http\Controllers\Management\CategoryController;
use App\Http\Controllers\Management\ExpenseController;
use App\Http\Controllers\Management\PaymentMethodController;
use App\Http\Controllers\Finance\CashFlowController;
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
    Route::get('/inventory/adjustments', [StockAdjustmentController::class, 'index']);
    Route::get('/inventory/create', [InventoryController::class, 'create']);
    Route::post('/inventory', [InventoryController::class, 'store']);

    // Purchase Orders MUST be before {id} to prevent interception
    Route::get('/inventory/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::get('/inventory/purchase-orders/export', [PurchaseOrderController::class, 'export']);
    Route::post('/inventory/purchase-orders', [PurchaseOrderController::class, 'store']);
    Route::get('/inventory/purchase-orders/create', [PurchaseOrderController::class, 'create']);
    Route::get('/inventory/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show']);
    Route::get('/inventory/purchase-orders/{purchaseOrder}/edit', [PurchaseOrderController::class, 'edit']);
    Route::put('/inventory/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update']);
    Route::post('/inventory/purchase-orders/{purchaseOrder}/arrive', [PurchaseOrderController::class, 'markAsArrived']);
    Route::post('/inventory/purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel']);
    Route::put('/inventory/variants/{variant}/retail-price', [InventoryController::class, 'updateRetailPrice']);
    Route::get('/inventory/{product}/adjust', [StockAdjustmentController::class, 'create']);
    Route::post('/inventory/{product}/adjust', [StockAdjustmentController::class, 'store']);
    Route::get('/inventory/{product}', [InventoryController::class, 'show']);
    Route::get('/inventory/{product}/edit', [InventoryController::class, 'edit']);
    Route::put('/inventory/{product}', [InventoryController::class, 'update']);
    Route::post('/inventory/{product}/toggle-active', [InventoryController::class, 'toggleActive']);
    Route::post('/inventory/variants/{variant}/restore', [InventoryController::class, 'restoreVariant']);
    Route::delete('/inventory/{product}', [InventoryController::class, 'destroy']);

    Route::get('/sales/settlements', [App\Http\Controllers\CourierSettlementController::class, 'index']);
    Route::post('/sales/settlements', [App\Http\Controllers\CourierSettlementController::class, 'process']);
    Route::get('/sales', [SalesOrderController::class, 'index']);
    Route::get('/sales/export', [SalesOrderController::class, 'export']);
    Route::post('/sales', [SalesOrderController::class, 'store']);
    Route::get('/sales/create', [SalesOrderController::class, 'create']);
    Route::get('/sales/{salesOrder}', [SalesOrderController::class, 'show']);
    Route::get('/sales/{salesOrder}/edit', [SalesOrderController::class, 'edit']);
    Route::put('/sales/{salesOrder}', [SalesOrderController::class, 'update']);
    Route::get('/sales/{salesOrder}/fulfill', [SalesOrderController::class, 'fulfillView']);
    Route::post('/sales/{salesOrder}/fulfill', [SalesOrderController::class, 'fulfillStore']);
    Route::post('/sales/{salesOrder}/deliver', [SalesOrderController::class, 'markDelivered']);
    Route::post('/sales/{salesOrder}/cancel', [SalesOrderController::class, 'cancel']);
    Route::post('/sales/{salesOrder}/settle', [SalesOrderController::class, 'settle']);
    Route::post('/sales/{salesOrder}/refund', [SalesOrderController::class, 'issueRefund']);
    Route::post('/sales/{salesOrder}/items/{itemId}/return', [SalesOrderController::class, 'returnItem']);

    Route::redirect('/management', '/management/suppliers');
    Route::get('/management/suppliers', [SupplierController::class, 'index']);
    Route::post('/management/suppliers', [SupplierController::class, 'store']);
    Route::put('/management/suppliers/{supplier}', [SupplierController::class, 'update']);
    Route::delete('/management/suppliers/{supplier}', [SupplierController::class, 'destroy']);
    
    Route::get('/management/couriers', [CourierController::class, 'index']);
    Route::post('/management/couriers', [CourierController::class, 'store']);
    Route::put('/management/couriers/{courier}', [CourierController::class, 'update']);
    Route::delete('/management/couriers/{courier}', [CourierController::class, 'destroy']);
    
    Route::get('/management/categories', [CategoryController::class, 'index']);
    Route::post('/management/categories', [CategoryController::class, 'store']);
    Route::put('/management/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/management/categories/{category}', [CategoryController::class, 'destroy']);
    
    Route::get('/management/payment-methods', [PaymentMethodController::class, 'index']);
    Route::post('/management/payment-methods', [PaymentMethodController::class, 'store']);
    Route::put('/management/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update']);
    Route::delete('/management/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy']);
    
    Route::get('/management/expenses', [ExpenseController::class, 'index']);
    Route::get('/management/expenses/export', [ExpenseController::class, 'export']);
    Route::post('/management/expenses', [ExpenseController::class, 'store']);
    Route::put('/management/expenses/{expense}', [ExpenseController::class, 'update']);
    Route::delete('/management/expenses/{expense}', [ExpenseController::class, 'destroy']);
    
    // Finance
    Route::get('/finance/cash-flow', [CashFlowController::class, 'index']);
    Route::post('/finance/cash-flow/manual', [CashFlowController::class, 'storeManual']);
});
