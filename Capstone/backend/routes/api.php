<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\ShuttleController;
use App\Http\Controllers\API\ShuttleLocationController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\AdminUserController;
use App\Http\Controllers\API\RouteController;
use App\Http\Controllers\API\ScheduleController;
use App\Http\Controllers\API\DriverController;
use App\Http\Controllers\API\ReportController;
use App\Http\Controllers\API\MaintenanceController;
use App\Http\Controllers\API\CompanyController;

// Report Routes (Place these BEFORE other routes to avoid conflicts)
Route::get('/reports/linked', [ReportController::class, 'linkedReports']);
Route::post('/reports/generate', [ReportController::class, 'generateReport']);
// Preflight support for CORS (some environments require explicit OPTIONS route)
Route::options('/reports/generate', function () {
    return response()->noContent()->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->header('Access-Control-Max-Age', '86400');
});

// Client schedules endpoint for pickup page (authenticated, read-only, Active only)
// Returns only schedules assigned to the authenticated client (see ScheduleController@indexPublic)
Route::middleware('auth:sanctum')->get('/client/schedules', [ScheduleController::class, 'indexPublic']);

// Verify participation endpoint (supports optional authentication)
Route::post('/schedules/{id}/verify-participation', [ScheduleController::class, 'verifyParticipation']);

// Authentication Routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
});

// Admin Protected Routes
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    // User Management
    Route::get('/users/{type}', [AdminUserController::class, 'index']);
    Route::post('/users/{type}', [AdminUserController::class, 'store']);
    Route::put('/users/{type}/{id}', [AdminUserController::class, 'update']);
    Route::delete('/users/{type}/{id}', [AdminUserController::class, 'destroy']);
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::get('/reports/maintenance-stats', [ReportController::class, 'getMaintenanceStats']);
});

// Driver Protected Routes
Route::middleware(['auth:sanctum', 'role:driver'])->group(function () {
    Route::get('/driver/schedules', [DriverController::class, 'mySchedules']);
    Route::post('/driver/report', [DriverController::class, 'sendReport']);
});

// Route Management
Route::prefix('routes')->group(function () {
    Route::get('/', [RouteController::class, 'index']);
    Route::post('/', [RouteController::class, 'store']);
    Route::put('/{id}', [RouteController::class, 'update']);
    Route::delete('/{id}', [RouteController::class, 'destroy']);
});

// Schedule Management
Route::middleware(['auth:sanctum'])->prefix('schedules')->group(function () {
    Route::get('/', [ScheduleController::class, 'index']);
    Route::get('/{id}', [ScheduleController::class, 'show']);
    Route::post('/', [ScheduleController::class, 'store']);
    Route::put('/{id}', [ScheduleController::class, 'update']);
    Route::delete('/{id}', [ScheduleController::class, 'destroy']);
    Route::post('/{id}/duty', [ScheduleController::class, 'markDuty']);
    Route::get('/driver/{id}', [ScheduleController::class, 'driverSchedules']);
    Route::get('/driver/{id}/today', [ScheduleController::class, 'todaySchedules']);
    Route::post('/resolve', [ScheduleController::class, 'resolve']);
    Route::post('/{id}/assign-clients', [ScheduleController::class, 'assignClients']);
    Route::delete('/{scheduleId}/remove-client/{clientId}', [ScheduleController::class, 'removeClient']);
});

// Shuttle Management
Route::prefix('shuttles')->group(function () {
    Route::get('/', [ShuttleController::class, 'index']);
    Route::post('/', [ShuttleController::class, 'store']);   
    Route::put('/{id}', [ShuttleController::class, 'update']);
    Route::delete('/{id}', [ShuttleController::class, 'destroy']); 
    Route::get('/active', [ShuttleController::class, 'active']); 
    Route::get('{id}/location', [ShuttleController::class, 'updateLocationGet']);
    Route::get('{id}/location/update', [ShuttleController::class, 'updateLocationFromGps']);
    Route::get('{id}/schedule', [ShuttleController::class, 'getActiveSchedule']);
});

// Maintenance Management
Route::prefix('maintenance')->group(function () {
    Route::get('/', [MaintenanceController::class, 'index']); 
    Route::post('/', [MaintenanceController::class, 'store']);
    Route::get('/{id}', [MaintenanceController::class, 'show']);
    Route::put('/{id}', [MaintenanceController::class, 'update']);
    Route::delete('/{id}', [MaintenanceController::class, 'destroy']);
    Route::post('/{id}/backup', [MaintenanceController::class, 'backup']); 
});

// Report Management Routes
Route::prefix('reports')->group(function () {
    // Basic CRUD
    Route::get('/', [ReportController::class, 'index']);
    Route::post('/', [ReportController::class, 'store']);
    Route::get('/{id}', [ReportController::class, 'show']);
    Route::put('/{id}', [ReportController::class, 'update']);
    Route::delete('/{id}', [ReportController::class, 'destroy']);
    
    // Analytics & Insights
    Route::get('/analytics/data', [ReportController::class, 'analytics']);
    Route::get('/analytics/yearly-trends', [ReportController::class, 'yearlyTrends']);
    
    // Report Generation & Export
    Route::post('/feedback', [ReportController::class, 'storeFeedback']);
    Route::post('/trips', [ReportController::class, 'storeTripUsage']);
    Route::get('/export/csv', [ReportController::class, 'exportCSV']);
    
    // Filter Options
    Route::get('/filters/drivers', [ReportController::class, 'getDrivers']);
    Route::get('/filters/shuttles', [ReportController::class, 'getShuttles']);
});

Route::prefix('companies')->group(function () {
    Route::get('/', [CompanyController::class, 'index']);
    Route::post('/', [CompanyController::class, 'store']);
    Route::get('/{id}', [CompanyController::class, 'show']);
    Route::put('/{id}', [CompanyController::class, 'update']);
    Route::delete('/{id}', [CompanyController::class, 'destroy']);
    Route::post('/{id}/restore', [CompanyController::class, 'restore']);
    Route::post('/{id}/renew', [CompanyController::class, 'renew']);
});

// Company Users - Filter users by company
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/companies/{company}/users', [AdminUserController::class, 'indexByCompany']);
    Route::post('/companies/{company}/users/{type}', [AdminUserController::class, 'storeByCompany']);
});