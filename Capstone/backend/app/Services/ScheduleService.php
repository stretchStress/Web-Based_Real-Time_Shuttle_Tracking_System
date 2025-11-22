<?php

namespace App\Services;

use App\Models\Schedule;
use Carbon\Carbon;

class ScheduleService
{
    /**
     * Check if there's a scheduling conflict
     */
    public function hasConflict($driverId, $shuttleId, $date, $time, $excludeId = null)
    {
        $scheduleTime = Carbon::parse("$date $time");
        $startWindow = $scheduleTime->copy()->subMinutes(30);
        $endWindow = $scheduleTime->copy()->addMinutes(30);

        $query = Schedule::where('date', $date)
            ->where(function($q) use ($time, $startWindow, $endWindow) {
                $q->whereBetween('time', [
                    $startWindow->format('H:i'),
                    $endWindow->format('H:i')
                ]);
            })
            ->where(function($q) use ($driverId, $shuttleId) {
                $q->where('driver_id', $driverId)
                  ->orWhere('shuttle_id', $shuttleId);
            });

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    /**
     * Get conflict details for error messages
     */
    public function getConflictDetails($driverId, $shuttleId, $date, $time, $excludeId = null)
    {
        $scheduleTime = Carbon::parse("$date $time");
        $startWindow = $scheduleTime->copy()->subMinutes(30);
        $endWindow = $scheduleTime->copy()->addMinutes(30);

        $conflicts = [];

        // Check driver conflicts
        $driverConflict = Schedule::where('driver_id', $driverId)
            ->where('date', $date)
            ->whereBetween('time', [
                $startWindow->format('H:i'),
                $endWindow->format('H:i')
            ])
            ->when($excludeId, function($q) use ($excludeId) {
                $q->where('id', '!=', $excludeId);
            })
            ->first();

        if ($driverConflict) {
            $conflicts[] = [
                'type' => 'driver',
                'time' => $driverConflict->time,
                'schedule' => $driverConflict
            ];
        }

        // Check shuttle conflicts
        $shuttleConflict = Schedule::where('shuttle_id', $shuttleId)
            ->where('date', $date)
            ->whereBetween('time', [
                $startWindow->format('H:i'),
                $endWindow->format('H:i')
            ])
            ->when($excludeId, function($q) use ($excludeId) {
                $q->where('id', '!=', $excludeId);
            })
            ->first();

        if ($shuttleConflict) {
            $conflicts[] = [
                'type' => 'shuttle',
                'time' => $shuttleConflict->time,
                'schedule' => $shuttleConflict
            ];
        }

        return $conflicts;
    }

    /**
     * Resolve conflict with suggestions using greedy algorithm
     */
    public function resolveConflictSuggestion($driverId, $shuttleId, $date, $time, $excludeId = null)
    {
        if (!$this->hasConflict($driverId, $shuttleId, $date, $time, $excludeId)) {
            return [
                'success' => false,
                'message' => 'No conflict detected',
                'suggestions' => []
            ];
        }

        $suggestions = [];

        // Suggestion 1: Alternative shuttles
        $availableShuttles = \App\Models\Shuttle::whereNotIn('id', function($query) use ($date, $time, $excludeId) {
            $scheduleTime = Carbon::parse("$date $time");
            $startWindow = $scheduleTime->copy()->subMinutes(30);
            $endWindow = $scheduleTime->copy()->addMinutes(30);

            $query->select('shuttle_id')
                ->from('schedules')
                ->where('date', $date)
                ->whereBetween('time', [
                    $startWindow->format('H:i'),
                    $endWindow->format('H:i')
                ])
                ->when($excludeId, function($q) use ($excludeId) {
                    $q->where('id', '!=', $excludeId);
                });
        })->get();

        foreach ($availableShuttles as $shuttle) {
            $suggestions[] = [
                'type' => 'shuttle_alternative',
                'message' => "Use shuttle {$shuttle->model} ({$shuttle->plate}) instead",
                'shuttle' => $shuttle
            ];
        }

        // Suggestion 2: Alternative drivers
        $availableDrivers = \App\Models\Driver::whereNotIn('id', function($query) use ($date, $time, $excludeId) {
            $scheduleTime = Carbon::parse("$date $time");
            $startWindow = $scheduleTime->copy()->subMinutes(30);
            $endWindow = $scheduleTime->copy()->addMinutes(30);

            $query->select('driver_id')
                ->from('schedules')
                ->where('date', $date)
                ->whereBetween('time', [
                    $startWindow->format('H:i'),
                    $endWindow->format('H:i')
                ])
                ->when($excludeId, function($q) use ($excludeId) {
                    $q->where('id', '!=', $excludeId);
                });
        })->with('user')->get();

        foreach ($availableDrivers as $driver) {
            $driverName = $driver->user ? "{$driver->user->first_name} {$driver->user->last_name}" : "Driver #{$driver->id}";
            $suggestions[] = [
                'type' => 'driver_alternative',
                'message' => "Assign {$driverName} instead",
                'driver' => $driver
            ];
        }

        // Suggestion 3: Alternative times (±1 hour)
        $alternativeTimes = [
            Carbon::parse("$date $time")->subHour()->format('H:i'),
            Carbon::parse("$date $time")->addHour()->format('H:i'),
        ];

        foreach ($alternativeTimes as $altTime) {
            if (!$this->hasConflict($driverId, $shuttleId, $date, $altTime, $excludeId)) {
                $suggestions[] = [
                    'type' => 'time_alternative',
                    'message' => "Schedule at {$altTime} instead",
                    'time' => $altTime
                ];
            }
        }

        return [
            'success' => true,
            'message' => 'Conflict detected, suggestions available',
            'suggestions' => $suggestions
        ];
    }
}