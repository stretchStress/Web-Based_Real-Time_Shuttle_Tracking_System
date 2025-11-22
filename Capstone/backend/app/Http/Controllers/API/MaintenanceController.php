<?php

namespace App\Http\Controllers\API;

use App\Models\Maintenance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Controller;

class MaintenanceController extends Controller
{
    public function index()
    {
        $maintenances = Maintenance::with('shuttle:id,plate')
            ->orderByDesc('start_date')
            ->orderByDesc('date')
            ->get();
        
        // Add full URL for report_file
        $maintenances->transform(function ($maintenance) {
            if ($maintenance->report_file) {
                $maintenance->report_file_url = Storage::disk('public')->url($maintenance->report_file);
            }
            return $maintenance;
        });
        
        return response()->json($maintenances);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'shuttle_id' => 'required|exists:shuttles,id',
            'technician' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'date' => 'nullable|date',
            'description' => 'required|string',
            'status' => 'required|in:Under Maintenance,Done Repairing',
            'report_file' => 'nullable|file',
        ]);

        if (!isset($validated['date'])) {
            $validated['date'] = $validated['start_date'];
        }

        if (($validated['status'] ?? null) === 'Done Repairing' && empty($validated['end_date'])) {
            $validated['end_date'] = now()->toDateString();
        }

        if (($validated['status'] ?? null) === 'Under Maintenance') {
            $validated['end_date'] = null;
        }

        if ($request->hasFile('report_file')) {
            $validated['report_file'] = $request->file('report_file')->store('maintenance_reports', 'public');
        }

        $maintenance = Maintenance::create($validated);
        
        // Add full URL for report_file
        if ($maintenance->report_file) {
            $maintenance->report_file_url = Storage::disk('public')->url($maintenance->report_file);
        }
        
        return response()->json($maintenance, 201);
    }

    public function show($id)
    {
        $maintenance = Maintenance::with('shuttle')->findOrFail($id);
        
        // Add full URL for report_file
        if ($maintenance->report_file) {
            $maintenance->report_file_url = Storage::disk('public')->url($maintenance->report_file);
        }
        
        return response()->json($maintenance);
    }

    public function update(Request $request, $id)
    {
        $maintenance = Maintenance::findOrFail($id);

        $validated = $request->validate([
            'shuttle_id' => 'sometimes|exists:shuttles,id',
            'technician' => 'sometimes|string',
            'start_date' => 'sometimes|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'date' => 'sometimes|date',
            'description' => 'sometimes|string',
            'status' => 'sometimes|in:Under Maintenance,Done Repairing',
            'report_file' => 'nullable|file',
        ]);

        if (array_key_exists('start_date', $validated) && !array_key_exists('date', $validated)) {
            $validated['date'] = $validated['start_date'];
        }

        $changingStatus = array_key_exists('status', $validated);

        if ($changingStatus && $validated['status'] === 'Done Repairing' && !array_key_exists('end_date', $validated)) {
            $validated['end_date'] = now()->toDateString();
        }

        if ($changingStatus && $validated['status'] === 'Under Maintenance') {
            $validated['end_date'] = null;
        }

        if ($request->hasFile('report_file')) {
            if ($maintenance->report_file && Storage::disk('public')->exists($maintenance->report_file)) {
                Storage::disk('public')->delete($maintenance->report_file);
            }
            $validated['report_file'] = $request->file('report_file')->store('maintenance_reports', 'public');
        }

        $maintenance->update($validated);
        
        // Add full URL for report_file
        if ($maintenance->report_file) {
            $maintenance->report_file_url = Storage::disk('public')->url($maintenance->report_file);
        }
        
        return response()->json($maintenance);
    }

    public function destroy($id)
    {
        $maintenance = Maintenance::findOrFail($id);

        if ($maintenance->report_file && Storage::disk('public')->exists($maintenance->report_file)) {
            Storage::disk('public')->delete($maintenance->report_file);
        }

        $maintenance->delete();
        return response()->json(['message' => 'Maintenance record deleted successfully']);
    }

    public function backup($id)
    {
        $maintenance = Maintenance::findOrFail($id);
        $backupData = json_encode($maintenance->toArray(), JSON_PRETTY_PRINT);
        $filename = 'backup/maintenance_' . $maintenance->id . '.json';

        Storage::disk('public')->put($filename, $backupData);
        return response()->json(['message' => 'Maintenance record backed up successfully', 'file' => $filename]);
    }
}
