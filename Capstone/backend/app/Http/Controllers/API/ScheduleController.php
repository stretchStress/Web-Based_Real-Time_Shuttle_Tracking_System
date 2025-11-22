<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\Request;
use App\Services\ScheduleService;
use Carbon\Carbon;

class ScheduleController extends Controller
{
    protected $scheduleService;

    public function __construct(ScheduleService $scheduleService)
    {
        $this->scheduleService = $scheduleService;
    }

    public function index()
    {
        return Schedule::with(['driver.user', 'route', 'shuttle'])->get();
    }

    public function show($id)
    {
        $schedule = Schedule::with(['driver.user', 'route', 'shuttle', 'clients.user', 'clients.company'])->findOrFail($id);
        return response()->json($schedule);
    }

    // Public, read-only list of active schedules for client pickup page
    // Only shows schedules assigned to the authenticated client and not older than 30 days
    public function indexPublic(Request $request)
    {
        // Try to get authenticated user (will be null if not authenticated)
        $user = auth('sanctum')->user();
        
        // Get the client record if user is authenticated as a client
        $client = null;
        if ($user && $user->role === 'client') {
            $client = \App\Models\Client::where('user_id', $user->id)->first();
        }
        
        $query = Schedule::with(['driver.user', 'route', 'shuttle', 'clients'])
            ->where('status', 'Active')
            ->where('date', '>=', now()->subDays(30)->toDateString())
            ->orderBy('date', 'asc')
            ->orderBy('time', 'asc');
        
        // If client is authenticated, only show schedules assigned to them
        if ($client) {
            $query->whereHas('clients', function($q) use ($client) {
                $q->where('clients.id', $client->id);
            });
        }
        
        return $query->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'driver_id' => 'required|exists:drivers,id',
            'route_id'  => 'required|exists:routes,id',
            'shuttle_id'=> 'required|exists:shuttles,id',
            'date'      => 'required|date',
            'day'       => 'required|string',
            'time'      => 'required|string',
            'status'    => 'required|in:Active,Inactive',
        ]);

        // ✅ Conflict check with correct parameters
        if ($this->scheduleService->hasConflict(
            $validated['driver_id'],
            $validated['shuttle_id'],
            $validated['date'],
            $validated['time']
        )) {
            // Get conflict details for better error message
            $conflicts = $this->scheduleService->getConflictDetails(
                $validated['driver_id'],
                $validated['shuttle_id'],
                $validated['date'],
                $validated['time']
            );

            $conflictMessages = [];
            foreach ($conflicts as $conflict) {
                if ($conflict['type'] === 'driver') {
                    $conflictMessages[] = "Driver is already scheduled at {$conflict['time']}";
                } else {
                    $conflictMessages[] = "Shuttle is already assigned at {$conflict['time']}";
                }
            }

            return response()->json([
                'message' => 'Schedule conflict detected',
                'errors' => $conflictMessages
            ], 422);
        }

        $schedule = Schedule::create($validated);
        return response()->json($schedule->load(['driver.user','route','shuttle']), 201);
    }

    public function update(Request $request, $id)
    {
        $schedule = Schedule::findOrFail($id);

        $validated = $request->validate([
            'driver_id' => 'required|exists:drivers,id',
            'route_id'  => 'required|exists:routes,id',
            'shuttle_id' => 'required|exists:shuttles,id',
            'date'      => 'required|date',
            'day'       => 'required|string',
            'time'      => 'required|string',
            'status'    => 'required|in:Active,Inactive',
            'time_in'   => 'nullable|datetime',
            'time_out'  => 'nullable|datetime',
        ]);

        // ✅ Conflict check with exclude parameter
        if ($this->scheduleService->hasConflict(
            $validated['driver_id'],
            $validated['shuttle_id'],
            $validated['date'],
            $validated['time'],
            $schedule->id // Exclude current schedule
        )) {
            $conflicts = $this->scheduleService->getConflictDetails(
                $validated['driver_id'],
                $validated['shuttle_id'],
                $validated['date'],
                $validated['time'],
                $schedule->id
            );

            $conflictMessages = [];
            foreach ($conflicts as $conflict) {
                if ($conflict['type'] === 'driver') {
                    $conflictMessages[] = "Driver is already scheduled at {$conflict['time']}";
                } else {
                    $conflictMessages[] = "Shuttle is already assigned at {$conflict['time']}";
                }
            }

            return response()->json([
                'message' => 'Schedule conflict detected',
                'errors' => $conflictMessages
            ], 422);
        }

        $schedule->update($validated);
        return response()->json($schedule->load(['driver.user','route','shuttle']));
    }

    public function destroy($id)
    {
        $schedule = Schedule::findOrFail($id);
        $schedule->delete();

        return response()->json(['message' => 'Schedule deleted successfully']);
    }

    public function driverSchedules($driverId, Request $request)
    {
        $query = Schedule::with(['driver.user', 'route', 'shuttle'])
            ->where('driver_id', $driverId)
            ->where('status', 'Active');

        // Filter by date if provided
        if ($request->has('date')) {
            $query->where('date', $request->date);
        }

        return $query->get();
    }

    public function todaySchedules($driverId)
    {
        return Schedule::with(['driver.user', 'route', 'shuttle'])
            ->where('driver_id', $driverId)
            ->where('status', 'Active')
            ->where('date', now()->toDateString())
            ->get();
    }

    public function markDuty(Request $request, $id)
    {
        $schedule = Schedule::with('driver')->findOrFail($id);
        $action = $request->input('action');

        // Check if driver already has another active (timed-in, not timed-out) schedule today
        if ($action === 'on-duty') {
            $active = Schedule::where('driver_id', $schedule->driver_id)
                ->whereDate('date', now()->toDateString())
                ->whereNotNull('time_in')
                ->whereNull('time_out')
                ->where('id', '!=', $schedule->id)
                ->first();

            if ($active) {
                return response()->json([
                    'message' => 'Cannot time in another route. You already have an active route.',
                    'active_route' => $active->route ? $active->route->name : 'N/A'
                ], 400);
            }

            // Mark time in only if not already set
            if (!$schedule->time_in) {
                $schedule->time_in = Carbon::now();
            } else {
                return response()->json(['message' => 'Already timed in for this route.'], 400);
            }
        }

        // Time out logic (with warning protection)
        elseif ($action === 'off-duty') {
            if (!$schedule->time_in) {
                return response()->json(['message' => 'You cannot time out before timing in.'], 400);
            }
            if ($schedule->time_out) {
                return response()->json(['message' => 'Already timed out for this route.'], 400);
            }

            $schedule->time_out = Carbon::now();
        }

        else {
            return response()->json(['message' => 'Invalid action.'], 400);
        }

        $schedule->save();
        return response()->json($schedule->load(['driver.user', 'route', 'shuttle']));
    }
    // inside ScheduleController

    public function resolve(Request $request)
    {
        $validated = $request->validate([
            'driver_id' => 'nullable|exists:drivers,id',
            'shuttle_id' => 'nullable|exists:shuttles,id',
            'date' => 'required|date',
            'time' => 'required|string',
            'exclude_id' => 'nullable|integer'
        ]);

        $result = $this->scheduleService->resolveConflictSuggestion(
            $validated['driver_id'] ?? null,
            $validated['shuttle_id'] ?? null,
            $validated['date'],
            $validated['time'],
            $validated['exclude_id'] ?? null
        );

        return response()->json($result);
    }
    public function assignClients(Request $request, $id)
    {
        $schedule = Schedule::findOrFail($id);

        $validated = $request->validate([
            'client_ids' => 'required|array',
            'client_ids.*' => 'exists:clients,id',
            'mode' => 'nullable|in:attach,replace', // optional: attach or replace
        ]);

        if (($validated['mode'] ?? 'attach') === 'replace') {
            // Replace all existing clients
            $schedule->clients()->sync($validated['client_ids']);
        } else {
            // Add new clients without removing existing
            $schedule->clients()->syncWithoutDetaching($validated['client_ids']);
        }

        return response()->json([
            'message' => 'Clients successfully assigned to schedule',
            'schedule' => $schedule->load(['clients.user', 'driver.user', 'route', 'shuttle']),
        ]);
    }

    public function removeClient($scheduleId, $clientId)
    {
        $schedule = Schedule::findOrFail($scheduleId);
        $schedule->clients()->detach($clientId);

        return response()->json(['message' => 'Client removed from schedule']);
    }

    public function verifyParticipation(Request $request, $id)
    {
        $schedule = Schedule::with(['clients'])->findOrFail($id);
        
        // Try to get authenticated user
        $user = auth('sanctum')->user();
        
        // If user is authenticated as a client, verify they're assigned to this schedule
        if ($user && $user->role === 'client') {
            $client = \App\Models\Client::where('user_id', $user->id)->first();
            
            if (!$client) {
                return response()->json([
                    'allowed' => false,
                    'message' => 'Client profile not found.'
                ], 403);
            }
            
            // Check if client is assigned to this schedule
            $isAssigned = $schedule->clients()->where('clients.id', $client->id)->exists();
            
            if (!$isAssigned) {
                return response()->json([
                    'allowed' => false,
                    'message' => 'You are not assigned to this schedule.'
                ], 403);
            }
            
            return response()->json([
                'allowed' => true,
                'message' => 'Participation verified.'
            ]);
        }
        
        // For guest users or non-client users, allow access (backward compatibility)
        // You can change this to be more restrictive if needed
        return response()->json([
            'allowed' => true,
            'message' => 'Guest access allowed.'
        ]);
    }
}