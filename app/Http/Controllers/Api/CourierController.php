<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Courier;
use Illuminate\Http\Request;

class CourierController extends Controller
{
    public function index()
    {
        return Courier::all();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'contact_info' => 'nullable|string',
            'default_service_fee' => 'nullable|numeric|min:0',
        ]);

        // Auto-link shop
        $data['shop_id'] = auth()->user()->shop_id;

        return Courier::create($data);
    }
}
