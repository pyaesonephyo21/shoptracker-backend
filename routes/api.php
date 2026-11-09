<?php

use App\Http\Controllers\TelegramWebhookController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::post('/telegram/webhook/{secretToken}', [TelegramWebhookController::class, 'handle'])->name('telegram.webhook');
