<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Shuttle;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use App\Models\Schedule;
use Carbon\Carbon;

class ShuttleController extends Controller
{
    /**
     * Resolve the most appropriate "current" schedule for a shuttle
     * based on today's date and the current time.
     *
     * Priority:
     * 1. A schedule for today where the driver has already timed in
     *    (time_in not null) and not yet timed out.
     * 2. Otherwise, among today's active schedules, the one whose
     *    scheduled time is closest to now.
     */
    protected function getCurrentScheduleForShuttle(Shuttle $shuttle)
    {
        $now = Carbon::now();
        $today = $now->toDateString();

        $baseQuery = Schedule::with(['driver.user', 'route'])
            ->where('shuttle_id', $shuttle->id)
            ->where('status', 'Active')
            ->whereDate('date', $today);

        // 1) Prefer an on-duty schedule (timed in, not yet timed out)
        $onDuty = (clone $baseQuery)
            ->whereNotNull('time_in')
            ->whereNull('time_out')
            ->orderBy('time_in', 'desc')
            ->first();

        if ($onDuty) {
            return $onDuty;
        }

        // 2) Fallback: pick today's active schedule based on time window
        $schedules = $baseQuery->orderBy('time')->get();
        if ($schedules->isEmpty()) {
            return null;
        }

        $pastOrCurrent = [];
        $future = [];

        foreach ($schedules as $schedule) {
            if (!$schedule->time) {
                continue;
            }

            $scheduleDate = $schedule->date instanceof Carbon
                ? $schedule->date->toDateString()
                : (string) $schedule->date;

            try {
                $scheduleDateTime = Carbon::parse($scheduleDate . ' ' . $schedule->time);
            } catch (\Exception $e) {
                continue;
            }

            if ($scheduleDateTime->lessThanOrEqualTo($now)) {
                $pastOrCurrent[] = ['model' => $schedule, 'dt' => $scheduleDateTime];
            } else {
                $future[] = ['model' => $schedule, 'dt' => $scheduleDateTime];
            }
        }

        if (!empty($pastOrCurrent)) {
            usort($pastOrCurrent, function ($a, $b) {
                return $a['dt'] <=> $b['dt'];
            });
            return $pastOrCurrent[count($pastOrCurrent) - 1]['model'];
        }

        if (!empty($future)) {
            usort($future, function ($a, $b) {
                return $a['dt'] <=> $b['dt'];
            });
            return $future[0]['model'];
        }

        return null;
    }

    public function index()
    {
        $shuttles = Shuttle::all();
        
        // Transform to include driver and route from current schedule
        return response()->json(
            $shuttles->map(function ($shuttle) {
                $currentSchedule = $this->getCurrentScheduleForShuttle($shuttle);
                
                return [
                    'id' => $shuttle->id,
                    'model' => $shuttle->model,
                    'capacity' => $shuttle->capacity,
                    'plate' => $shuttle->plate,
                    'status' => $shuttle->status,
                    'latitude' => $shuttle->latitude,
                    'longitude' => $shuttle->longitude,
                    'driver' => $currentSchedule?->driver,
                    'route' => $currentSchedule?->route,
                    'current_schedule' => $currentSchedule,
                ];
            })
        );
    }

    public function active()
    {
        return response()->json(
            Shuttle::where('status', 'Active')
                ->get(['id', 'model', 'plate', 'latitude', 'longitude'])
        );
    }

    public function updateLocationGet(Request $request, $id)
    {
        $apiKey = $request->query('apikey');
        $expectedKey = config('services.gps.key');

        if ($apiKey !== $expectedKey) {
            Log::warning("Unauthorized GPS data access attempt", [
                'id' => $id,
                'apikey' => $apiKey,
            ]);
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $shuttle = Shuttle::find($id);

        if (!$shuttle) {
            Log::error("Shuttle not found", ['id' => $id]);
            return response()->json(['message' => 'Shuttle not found'], 404);
        }

        if (!$shuttle->latitude || !$shuttle->longitude) {
            return response()->json(['message' => 'Missing coordinates in database'], 400);
        }

        return response()->json([
            'message' => 'Shuttle location fetched successfully',
            'shuttle' => [
                'id' => $shuttle->id,
                'model' => $shuttle->model,
                'plate' => $shuttle->plate,
                'latitude' => (float) $shuttle->latitude,
                'longitude' => (float) $shuttle->longitude,
                'status' => $shuttle->status,
            ]
        ]);
    }

    public function updateLocationFromGps(Request $request, $id)
    {
        $apiKey = $request->query('apikey');
        $expectedKey = config('services.gps.key');

        if ($apiKey !== $expectedKey) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $latitude = $request->query('latitude');
        $longitude = $request->query('longitude');

        if (!$latitude || !$longitude) {
            return response()->json(['message' => 'Missing coordinates'], 400);
        }

        $shuttle = Shuttle::find($id);
        if (!$shuttle) {
            return response()->json(['message' => 'Shuttle not found'], 404);
        }

        $shuttle->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
        ]);

        return response()->json([
            'message' => 'Shuttle location updated successfully (via GET)',
            'latitude' => $latitude,
            'longitude' => $longitude
        ]);
    }

    public function getActiveSchedule($id)
    {
        $shuttle = Shuttle::find($id);
        
        if (!$shuttle) {
            return response()->json(['message' => 'Shuttle not found'], 404);
        }

        // Get the most appropriate schedule for today based on current time
        $schedule = $this->getCurrentScheduleForShuttle($shuttle);

        if (!$schedule) {
            return response()->json([
                'message' => 'No active schedule found for today',
                'schedule' => null,
                'route' => null
            ]);
        }

        return response()->json([
            'message' => 'Active schedule retrieved successfully',
            'schedule' => $schedule,
            'route' => $schedule->route
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'model' => 'required|string',
            'capacity' => 'required|integer|min:1',
            'plate' => 'required|string|unique:shuttles,plate',
            'status' => 'required|in:Active,Maintenance,Inactive',
        ]);

        $shuttle = Shuttle::create($validated);

        $currentSchedule = $this->getCurrentScheduleForShuttle($shuttle);
        
        return response()->json([
            'id' => $shuttle->id,
            'model' => $shuttle->model,
            'capacity' => $shuttle->capacity,
            'plate' => $shuttle->plate,
            'status' => $shuttle->status,
            'latitude' => $shuttle->latitude,
            'longitude' => $shuttle->longitude,
            'driver' => $currentSchedule?->driver,
            'route' => $currentSchedule?->route,
            'current_schedule' => $currentSchedule,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $shuttle = Shuttle::findOrFail($id);

        $validated = $request->validate([
            'model' => 'required|string',
            'capacity' => 'required|integer|min:1',
            'plate' => 'required|string|unique:shuttles,plate,' . $id,
            'status' => 'required|in:Active,Maintenance,Inactive',
        ]);

        $shuttle->update($validated);

        $currentSchedule = $this->getCurrentScheduleForShuttle($shuttle);
        
        return response()->json([
            'id' => $shuttle->id,
            'model' => $shuttle->model,
            'capacity' => $shuttle->capacity,
            'plate' => $shuttle->plate,
            'status' => $shuttle->status,
            'latitude' => $shuttle->latitude,
            'longitude' => $shuttle->longitude,
            'driver' => $currentSchedule?->driver,
            'route' => $currentSchedule?->route,
            'current_schedule' => $currentSchedule,
        ]);
    }

    public function destroy($id)
    {
        $shuttle = Shuttle::findOrFail($id);
        $shuttle->delete();

        return response()->json(['message' => 'Shuttle deleted successfully']);
    }
}
