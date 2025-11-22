<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Route;
use Illuminate\Http\Request;

class RouteController extends Controller
{
    public function index()
    {
        return Route::all();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'company_id' => 'required|exists:companies,id',
            'company' => 'nullable|string|max:255',
            'name' => 'required|string|max:255',
            'direction' => 'required|in:Incoming,Outgoing',
            'embarked' => 'required|string|max:255',
            'pickup_points' => 'array',
            'pickup_times' => 'array|nullable',
            'disembarked' => 'required|string|max:255',
            'status' => 'required|in:Active,Inactive',

            'embarked_lat' => 'nullable|numeric',
            'embarked_lng' => 'nullable|numeric',
            'disembarked_lat' => 'nullable|numeric',
            'disembarked_lng' => 'nullable|numeric',
            'pickup_coords' => 'array|nullable',
        ]);

        return Route::create($validated);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'company_id' => 'required|exists:companies,id',
            'company' => 'nullable|string|max:255',
            'name' => 'required|string|max:255',
            'direction' => 'required|in:Incoming,Outgoing',
            'embarked' => 'required|string|max:255',
            'pickup_points' => 'array',
            'pickup_times' => 'array|nullable',
            'disembarked' => 'required|string|max:255',
            'status' => 'required|in:Active,Inactive',

            'embarked_lat' => 'nullable|numeric',
            'embarked_lng' => 'nullable|numeric',
            'disembarked_lat' => 'nullable|numeric',
            'disembarked_lng' => 'nullable|numeric',
            'pickup_coords' => 'array|nullable',
        ]);

        $route = Route::findOrFail($id);

        $route->company_id = $validated['company_id'];
        $route->company = $validated['company'];
        $route->name = $validated['name'];
        $route->direction = $validated['direction'];
        $route->embarked = $validated['embarked'];
        $route->pickup_points = $validated['pickup_points'] ?? [];
        $route->pickup_times = $validated['pickup_times'] ?? [];
        $route->disembarked = $validated['disembarked'];
        $route->status = $validated['status'];

        // Update coordinates if provided
        if (isset($validated['embarked_lat']) && isset($validated['embarked_lng'])) {
            $route->embarked_lat = $validated['embarked_lat'];
            $route->embarked_lng = $validated['embarked_lng'];
        }
        if (isset($validated['disembarked_lat']) && isset($validated['disembarked_lng'])) {
            $route->disembarked_lat = $validated['disembarked_lat'];
            $route->disembarked_lng = $validated['disembarked_lng'];
        }
        if (isset($validated['pickup_coords'])) {
            $route->pickup_coords = $validated['pickup_coords'];
        }

        $route->save();

        return response()->json([
            'message' => 'Route updated successfully',
            'saved'   => $route,
        ]);
    }

    public function destroy($id)
    {
        $route = Route::findOrFail($id);
        $route->delete();

        return response()->json(['message' => 'Route deleted successfully']);
    }

}
