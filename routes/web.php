<?php

use App\Http\Controllers\AiAddressParserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CourierSettlementController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Finance\CashFlowController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\Management\CategoryController;
use App\Http\Controllers\Management\CourierController;
use App\Http\Controllers\Management\ExpenseController;
use App\Http\Controllers\Management\NoteController;
use App\Http\Controllers\Management\PaymentMethodController;
use App\Http\Controllers\Management\ShopController;
use App\Http\Controllers\Management\StorefrontSettingsController;
use App\Http\Controllers\Management\SupplierController;
use App\Http\Controllers\Management\UserController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\SalesOrderController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\StorefrontController;
use App\Models\Shop;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;

/*
|--------------------------------------------------------------------------
| Public Storefront Routes
|--------------------------------------------------------------------------
*/
// Root URL redirection
Route::get('/', function () {
    if (Auth::check()) {
        return redirect()->route('dashboard');
    }
    $shop = Shop::first();
    if ($shop && $shop->slug) {
        return redirect()->route('storefront.home', ['shop' => $shop->slug]);
    }
    return redirect('/login');
});

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
Route::post('/switch-shop', [AuthController::class, 'switchShop'])->name('switch-shop');

/*
|--------------------------------------------------------------------------
| Authenticated Application Routes
|--------------------------------------------------------------------------
*/
Route::middleware('auth')->group(function () {
    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Inventory & Products
    Route::get('/inventory', [InventoryController::class, 'index'])->name('inventory.index');
    Route::get('/inventory/adjustments', [StockAdjustmentController::class, 'index'])->name('inventory.adjustments.index');
    Route::get('/inventory/create', [InventoryController::class, 'create'])->name('inventory.create');
    Route::post('/inventory', [InventoryController::class, 'store'])->name('inventory.store');

    // Purchase Orders (Specific static routes defined before {id} parameter wildcard)
    Route::get('/inventory/purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders.index');
    Route::get('/inventory/purchase-orders/export', [PurchaseOrderController::class, 'export'])->name('purchase-orders.export');
    Route::get('/inventory/purchase-orders/create', [PurchaseOrderController::class, 'create'])->name('purchase-orders.create');
    Route::post('/inventory/purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
    Route::get('/inventory/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->name('purchase-orders.show');
    Route::get('/inventory/purchase-orders/{purchaseOrder}/edit', [PurchaseOrderController::class, 'edit'])->name('purchase-orders.edit');
    Route::put('/inventory/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->name('purchase-orders.update');
    Route::post('/inventory/purchase-orders/{purchaseOrder}/arrive', [PurchaseOrderController::class, 'markAsArrived'])->name('purchase-orders.arrive');
    Route::post('/inventory/purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->name('purchase-orders.cancel');

    // Product & Variant Details
    Route::put('/inventory/variants/{variant}/retail-price', [InventoryController::class, 'updateRetailPrice'])->name('variants.update-price');
    Route::post('/inventory/variants/{variant}/restore', [InventoryController::class, 'restoreVariant'])->name('variants.restore');
    Route::get('/inventory/{product}/adjust', [StockAdjustmentController::class, 'create'])->name('inventory.adjust.create');
    Route::post('/inventory/{product}/adjust', [StockAdjustmentController::class, 'store'])->name('inventory.adjust.store');
    Route::get('/inventory/{product}', [InventoryController::class, 'show'])->name('inventory.show');
    Route::get('/inventory/{product}/edit', [InventoryController::class, 'edit'])->name('inventory.edit');
    Route::put('/inventory/{product}', [InventoryController::class, 'update'])->name('inventory.update');
    Route::post('/inventory/{product}/toggle-active', [InventoryController::class, 'toggleActive'])->name('inventory.toggle-active');
    Route::delete('/inventory/{product}', [InventoryController::class, 'destroy'])->name('inventory.destroy');

    // Sales Orders & Courier Settlements
    Route::get('/sales/settlements', [CourierSettlementController::class, 'index'])->name('sales.settlements.index');
    Route::post('/sales/settlements', [CourierSettlementController::class, 'process'])->name('sales.settlements.process');
    Route::get('/sales', [SalesOrderController::class, 'index'])->name('sales.index');
    Route::get('/sales/export', [SalesOrderController::class, 'export'])->name('sales.export');
    Route::get('/sales/create', [SalesOrderController::class, 'create'])->name('sales.create');
    Route::post('/sales', [SalesOrderController::class, 'store'])->name('sales.store');
    Route::get('/sales/{salesOrder}', [SalesOrderController::class, 'show'])->name('sales.show');
    Route::get('/sales/{salesOrder}/edit', [SalesOrderController::class, 'edit'])->name('sales.edit');
    Route::put('/sales/{salesOrder}', [SalesOrderController::class, 'update'])->name('sales.update');
    Route::get('/sales/{salesOrder}/fulfill', [SalesOrderController::class, 'fulfillView'])->name('sales.fulfill.view');
    Route::post('/sales/{salesOrder}/fulfill', [SalesOrderController::class, 'fulfillStore'])->name('sales.fulfill.store');
    Route::post('/sales/{salesOrder}/deliver', [SalesOrderController::class, 'markDelivered'])->name('sales.deliver');
    Route::post('/sales/{salesOrder}/cancel', [SalesOrderController::class, 'cancel'])->name('sales.cancel');
    Route::post('/sales/{salesOrder}/settle', [SalesOrderController::class, 'settle'])->name('sales.settle');
    Route::post('/sales/{salesOrder}/refund', [SalesOrderController::class, 'issueRefund'])->name('sales.refund');
    Route::post('/sales/{salesOrder}/items/{itemId}/return', [SalesOrderController::class, 'returnItem'])->name('sales.items.return');

    // Management Resources
    Route::redirect('/management', '/management/notes');
    Route::prefix('management')->name('management.')->group(function () {
        Route::get('storefront', [StorefrontSettingsController::class, 'index'])->name('storefront.index');
        Route::post('storefront', [StorefrontSettingsController::class, 'update'])->name('storefront.update');
        Route::resource('shops', ShopController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::resource('users', UserController::class)->except(['show', 'create', 'edit']);
        Route::resource('suppliers', SupplierController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::resource('couriers', CourierController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::resource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::resource('payment-methods', PaymentMethodController::class)
            ->parameters(['payment-methods' => 'paymentMethod'])
            ->only(['index', 'store', 'update', 'destroy']);
        Route::get('expenses/export', [ExpenseController::class, 'export'])->name('expenses.export');
        Route::resource('expenses', ExpenseController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('notes/{note}/toggle-pin', [NoteController::class, 'togglePin'])->name('notes.toggle-pin');
        Route::resource('notes', NoteController::class)->only(['index', 'store', 'update', 'destroy']);
    });

    // Finance & Cash Flow
    Route::get('/finance/cash-flow', [CashFlowController::class, 'index'])->name('finance.cash-flow.index');
    Route::post('/finance/cash-flow/manual', [CashFlowController::class, 'storeManual'])->name('finance.cash-flow.manual');

    // AI Tools
    Route::post('/api/ai/parse-address', [AiAddressParserController::class, 'parse'])->name('api.ai.parse-address');
});

/*
|--------------------------------------------------------------------------
| Public Storefront Dynamic Routes (Must be at the end to prevent collisions)
|--------------------------------------------------------------------------
*/
Route::prefix('{shop:slug}')->name('storefront.')->group(function () {
    Route::get('/', [StorefrontController::class, 'index'])->name('home');
    Route::get('/products', [StorefrontController::class, 'products'])->name('products');
});
