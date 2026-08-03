<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class NoteController extends Controller
{
    public function index(Request $request)
    {
        $query = Note::with('user:id,name');

        if ($request->filled('type') && in_array($request->type, ['customer', 'general'])) {
            $query->where('type', $request->type);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('customer_name', 'like', "%{$search}%")
                  ->orWhere('customer_phone', 'like', "%{$search}%")
                  ->orWhere('content', 'like', "%{$search}%");
            });
        }

        $notes = $query->orderBy('is_pinned', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Management/Notes', [
            'notes' => $notes,
            'filters' => [
                'type' => $request->type ?? 'all',
                'search' => $request->search ?? '',
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|in:customer,general',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'content' => 'nullable|string',
            'is_pinned' => 'nullable|boolean',
        ]);

        $validated['user_id'] = Auth::id();
        $validated['is_pinned'] = $request->boolean('is_pinned');

        Note::create($validated);

        return back()->with('success', 'Note created successfully.');
    }

    public function update(Request $request, Note $note)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|in:customer,general',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'content' => 'nullable|string',
            'is_pinned' => 'nullable|boolean',
        ]);

        $validated['is_pinned'] = $request->boolean('is_pinned');

        $note->update($validated);

        return back()->with('success', 'Note updated successfully.');
    }

    public function togglePin(Note $note)
    {
        $note->update([
            'is_pinned' => !$note->is_pinned,
        ]);

        return back();
    }

    public function destroy(Note $note)
    {
        $note->delete();

        return back()->with('success', 'Note removed successfully.');
    }
}
