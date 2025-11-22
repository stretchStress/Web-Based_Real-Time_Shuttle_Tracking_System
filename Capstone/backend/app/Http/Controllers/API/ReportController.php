<?php

namespace App\Http\Controllers\API;

use App\Models\Maintenance;
use App\Models\Report;
use App\Models\Shuttle;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Http\Controllers\Controller;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class ReportController extends Controller
{
    /**
     * Display a listing of reports with optional filters
     */
    public function index(Request $request)
    {
        try {
            $query = Report::with(['driver.user', 'shuttle', 'route']);

            // Filters
            if ($request->filled('type') && $request->type !== 'All') {
                $query->where('title', $request->type);
            }

            if ($request->filled('start_date')) {
                $query->whereDate('date', '>=', $request->start_date);
            }

            if ($request->filled('end_date')) {
                $query->whereDate('date', '<=', $request->end_date);
            }

            // Search filter
            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('description', 'LIKE', "%{$search}%")
                      ->orWhere('title', 'LIKE', "%{$search}%");
                });
            }

            $query->orderBy('date', 'desc');

            $reports = $query->paginate($request->get('per_page', 15));

            return response()->json([
                'success' => true,
                'data' => $reports
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch reports',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Fetch all reports with related driver, shuttle, and route data
     */
    public function linkedReports()
    {
        try {
            $reports = Report::with(['driver.user', 'shuttle', 'route'])
                ->orderBy('date', 'desc')
                ->get();

            $reports->transform(function ($report) {
                if (!empty($report->reported_at)) {
                    $report->reported_at_formatted = Carbon::parse($report->reported_at)->format('Y-m-d H:i:s');
                }
                return $report;
            });

            return response()->json([
                'success' => true,
                'data' => $reports
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch linked reports',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate maintenance report PDF
     */
    private function generateMaintenanceReportPdf(Request $request, int $maxRows)
    {
        try {
            $monthInput = $request->input('month');
            $yearInput = $request->input('year');
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');

            $query = Maintenance::with(['shuttle']);

            // Filter by start_date when date range is provided
            if (!empty($startDate)) {
                $query->whereDate('start_date', '>=', $startDate);
            }

            if (!empty($endDate)) {
                $query->whereDate('start_date', '<=', $endDate);
            }

            if (empty($startDate) && empty($endDate)) {
                if (!empty($yearInput) && $yearInput !== 'All') {
                    $query->whereYear('start_date', (int) $yearInput);
                }

                if (!empty($monthInput) && $monthInput !== 'All') {
                    if (is_numeric($monthInput)) {
                        $monthNumber = (int) $monthInput;
                    } else {
                        try {
                            $monthNumber = Carbon::parse('1 ' . $monthInput . ' 2000')->month;
                        } catch (\Exception $e) {
                            $monthNumber = null;
                        }
                    }

                    if ($monthNumber && $monthNumber >= 1 && $monthNumber <= 12) {
                        $query->whereMonth('start_date', $monthNumber);
                    }
                }
            }

            $maintenances = $query->orderByDesc('start_date')->limit($maxRows)->get();

            $totals = [
                'total' => $maintenances->count(),
                'under_maintenance' => $maintenances->where('status', 'Under Maintenance')->count(),
                'done_repairing' => $maintenances->where('status', 'Done Repairing')->count(),
            ];

            $topShuttle = $maintenances->groupBy('shuttle_id')
                ->map(function ($group) {
                    $shuttle = $group->first()->shuttle;
                    return [
                        'model' => $shuttle ? ($shuttle->model ?? 'Unknown') : 'Unknown',
                        'plate' => $shuttle ? ($shuttle->plate ?? 'N/A') : 'N/A',
                        'under' => $group->where('status', 'Under Maintenance')->count(),
                        'total' => $group->count(),
                    ];
                })
                ->filter(function ($item) {
                    return $item['total'] > 0;
                })
                ->sort(function ($a, $b) {
                    if ($a['under'] === $b['under']) {
                        return $b['total'] <=> $a['total'];
                    }
                    return $b['under'] <=> $a['under'];
                })
                ->first();

            $title = 'Maintenance Report';
            $generatedOn = now()->format('F d, Y');
            $rows = '';

            foreach ($maintenances as $maintenance) {
                $shuttle = $maintenance->shuttle;
                $shuttleLabel = 'Unknown';
                if ($shuttle) {
                    $model = $shuttle->model ?? 'Unknown';
                    $plate = $shuttle->plate ?? '';
                    $shuttleLabel = trim($model . ($plate ? ' (' . $plate . ')' : ''));
                    if ($shuttleLabel === '') {
                        $shuttleLabel = 'Unknown';
                    }
                }
                $start = $maintenance->start_date ? Carbon::parse($maintenance->start_date)->format('M d, Y') : '—';
                $end = $maintenance->end_date
                    ? Carbon::parse($maintenance->end_date)->format('M d, Y')
                    : ($maintenance->status === 'Done Repairing' ? '—' : 'In Progress');
                $status = $maintenance->status ?? 'N/A';
                $technician = $maintenance->technician ?? 'N/A';
                $description = trim($maintenance->description ?? '');
                $descriptionHtml = $description !== ''
                    ? nl2br(e($description))
                    : '—';

                $rows .= '<tr>'
                    . '<td>' . e($shuttleLabel) . '</td>'
                    . '<td>' . e($technician) . '</td>'
                    . '<td>' . e($start) . '</td>'
                    . '<td>' . e($end) . '</td>'
                    . '<td class="description-cell">' . $descriptionHtml . '</td>'
                    . '<td>' . e($status) . '</td>'
                    . '</tr>';
            }

            if ($rows === '') {
                $rows = '<tr><td colspan="6" style="text-align:center;">No maintenance records found for the selected filters.</td></tr>';
            }

            $html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
                . '<style>'
                . 'body{font-family:DejaVu Sans, Arial, sans-serif;color:#222;margin:24px;}'
                . 'h1{color:#EA7822;font-size:28px;margin:0;text-align:center;}'
                . '.meta{color:#666;text-align:center;margin:6px 0;}'
                . '.summary{background:#f5f7fb;border-radius:10px;padding:14px 18px;margin:18px 0;border:1px solid rgba(234,120,34,0.15);} '
                . '.summary h2{margin:0 0 8px 0;font-size:18px;color:#EA7822;}'
                . '.summary p{margin:4px 0;font-size:12px;color:#4b566c;}'
                . 'table{width:100%;border-collapse:collapse;margin-top:12px;}'
                . 'thead th{background:#EA7822;color:#fff;padding:9px;font-weight:600;text-align:left;font-size:12px;}'
                . 'tbody td{border-bottom:1px solid #eee;padding:9px;font-size:12px;vertical-align:top;}'
                . '.description-cell{width:32%;}'
                . 'tbody tr:nth-child(even){background:#fafafa;}'
                . '</style>'
                . '</head><body>'
                . '<h1>' . e($title) . '</h1>'
                . '<p class="meta">Generated on ' . e($generatedOn) . '</p>'
                . (!empty($yearInput) && $yearInput !== 'All' ? '<p class="meta">Year Filter: ' . e($yearInput) . '</p>' : '')
                . (!empty($monthInput) && $monthInput !== 'All' ? '<p class="meta">Month Filter: ' . e($monthInput) . '</p>' : '')
                . ($startDate ? '<p class="meta">Start Date: ' . e(Carbon::parse($startDate)->format('F d, Y')) . '</p>' : '')
                . ($endDate ? '<p class="meta">End Date: ' . e(Carbon::parse($endDate)->format('F d, Y')) . '</p>' : '')
                . '<div class="summary">'
                . '<h2>Maintenance Summary</h2>'
                . '<p>Total Maintenance Records: ' . e($totals['total']) . '</p>'
                . '<p>Currently Under Maintenance: ' . e($totals['under_maintenance']) . '</p>'
                . '<p>Completed Repairs: ' . e($totals['done_repairing']) . '</p>'
                . ($topShuttle
                    ? '<p>Most Under Maintenance: ' . e($topShuttle['model']) . ' (' . e($topShuttle['plate'])
                        . ') — ' . e($topShuttle['under']) . ' ongoing / ' . e($topShuttle['total']) . ' total records</p>'
                    : '')
                . '</div>'
                . '<table>'
                . '<thead>'
                . '<tr>'
                . '<th>Shuttle</th>'
                . '<th>Technician</th>'
                . '<th>Start Date</th>'
                . '<th>End Date</th>'
                . '<th>Description</th>'
                . '<th>Status</th>'
                . '</tr>'
                . '</thead>'
                . '<tbody>' . $rows . '</tbody>'
                . '</table>'
                . '</body></html>';

            $pdf = Pdf::loadHTML($html);
            $pdf->setPaper('a4', 'portrait');

            $filenameParts = ['Maintenance_Report'];
            if (!empty($yearInput) && $yearInput !== 'All') {
                $filenameParts[] = $yearInput;
            }
            if (!empty($monthInput) && $monthInput !== 'All') {
                $filenameParts[] = is_numeric($monthInput) ? $monthInput : str_replace(' ', '_', $monthInput);
            }
            $filenameParts[] = now()->format('Y-m-d');

            $response = $pdf->download(implode('_', $filenameParts) . '.pdf');
            $response->headers->set('Access-Control-Allow-Origin', '*');
            $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');

            return $response;
        } catch (\Exception $e) {
            \Log::error('Maintenance PDF generation error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error generating maintenance report: ' . $e->getMessage(),
            ], 500)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Access-Control-Expose-Headers', 'Content-Type');
        }
    }

    /**
 * Generate PDF report based on type
 */
public function generateReport(Request $request)
{
    try {
        $request->validate([
            'report_type' => 'required|string',
            'month' => 'nullable|string',
            'year' => 'nullable|integer',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'driver_id' => 'nullable|exists:drivers,id',
            'max_rows' => 'nullable|integer'
        ]);

        $requestedType = $request->input('report_type');
        $reportType = $requestedType === 'Maintenance Report' ? 'Maintenance' : $requestedType;
        $monthInput = $request->input('month');
        $yearInput = $request->input('year');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $driverId = $request->input('driver_id');

        $maxRows = (int) ($request->get('max_rows', 500));
        if ($maxRows <= 0 || $maxRows > 2000) {
            $maxRows = 500;
        }

        if ($reportType === 'Maintenance') {
            return $this->generateMaintenanceReportPdf($request, $maxRows);
        }

        // Fetch reports based on type - MAKE SURE ROUTE IS INCLUDED
        $query = Report::with(['driver.user', 'shuttle', 'route']);

        if ($reportType !== 'All') {
            $query->where('title', $reportType);
        }

        // Driver filter
        if (!empty($driverId)) {
            $query->where('driver_id', (int) $driverId);
        }

        // Date range filter (takes precedence over month/year)
        if (!empty($startDate)) {
            $query->whereDate('date', '>=', $startDate);
        }
        if (!empty($endDate)) {
            $query->whereDate('date', '<=', $endDate);
        }

        // Month/Year filters (only if date range not provided)
        if (empty($startDate) && empty($endDate)) {
            if (!empty($yearInput) && $yearInput !== 'All') {
                $query->whereYear('date', (int) $yearInput);
            }
            if (!empty($monthInput) && $monthInput !== 'All') {
                if (is_numeric($monthInput)) {
                    $monthNumber = (int) $monthInput;
                } else {
                    try {
                        $monthNumber = \Carbon\Carbon::parse('1 ' . $monthInput . ' 2000')->month;
                    } catch (\Exception $e) {
                        $monthNumber = null;
                    }
                }
                if ($monthNumber && $monthNumber >= 1 && $monthNumber <= 12) {
                    $query->whereMonth('date', $monthNumber);
                }
            }
        }

        $reports = $query->orderBy('date', 'desc')->limit($maxRows)->get();

        // Calculate statistics
        $statistics = $this->calculateStatistics($reports, $reportType);

        // Build HTML for the PDF
        if ($reportType !== 'Incident Report' && view()->exists('reports.pdf-template')) {
            $html = view('reports.pdf-template', [
                'reportType' => $reportType,
                'reports' => $reports,
                'statistics' => $statistics,
                'generatedDate' => now()->format('F d, Y')
            ])->render();
        } else {
            // Simple inline HTML
            $title = e($reportType . ' Report');
            $dateGenerated = e(now()->format('F d, Y'));

            if ($reportType === 'Incident Report') {
                // Build incident-only rows
                $rows = '';
                foreach ($reports as $r) {
                    $driverName = $r->driver ? ($r->driver->first_name . ' ' . $r->driver->last_name) : 'N/A';
                    $shuttleModel = $r->shuttle->model ?? 'N/A';
                    
                    // FIXED: Use $r->route instead of $r->shuttle->route
                    $routeName = $r->route ? $r->route->name : ($r->route_id ? "Route ID: {$r->route_id}" : 'N/A');
                    
                    $companyName = $r->company_name ?? ($r->route ? $r->route->company : 'N/A');
                    $date = optional($r->reported_at) 
                        ? \Carbon\Carbon::parse($r->reported_at)->format('M d, Y') 
                        : (optional($r->date) ? \Carbon\Carbon::parse($r->date)->format('M d, Y') : 'N/A');
                    $time = optional($r->reported_at) 
                        ? \Carbon\Carbon::parse($r->reported_at)->format('h:i A') 
                        : 'N/A';
                    $desc = e($r->description ?? '');

                    $rows .= '<tr>'
                        . '<td>' . e($date) . '</td>'
                        . '<td>' . e($time) . '</td>'
                        . '<td>' . e($companyName) . '</td>'
                        . '<td>' . e($driverName) . '</td>'
                        . '<td>' . e($shuttleModel) . '</td>'
                        . '<td>' . e($routeName) . '</td>'
                        . '<td>' . $desc . '</td>'
                        . '</tr>';
                }

                $totalRecords = count($reports);
                $totalText = '<p class="meta">Total Records: ' . e($totalRecords) . '</p>';

                $html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
                  . '<style>
                    body{font-family:DejaVu Sans, Arial, sans-serif;color:#222;margin:24px}
                    h1{color:#EA7822;font-size:28px;margin:0 0 4px 0;text-align:center}
                    .meta{color:#666;text-align:center;margin:2px 0}
                    .divider{height:4px;background:#EA7822;margin:16px 0}
                    .card{background:#f6f7f8;border-radius:6px;padding:14px;margin:10px 0}
                    .section-title{color:#EA7822;font-size:18px;margin:18px 0 8px 0}
                    table{width:100%;border-collapse:collapse;margin-top:10px}
                    thead th{background:#EA7822;color:#fff;text-align:left;padding:8px;font-weight:600}
                    tbody td{border-bottom:1px solid #eee;padding:8px;font-size:12px}
                    tbody tr:nth-child(even){background:#fafafa}
                  </style>'
                  . '</head><body>'
                  . '<h1>' . $title . '</h1>'
                  . '<p class="meta">Generated on ' . $dateGenerated . '</p>'
                  . $totalText
                  . '<div class="divider"></div>'
                  . '<div class="card"><div class="section-title">Incident Report Summary</div>'
                  . '<div>Total Incidents: ' . e($statistics['incident_reports']['total_incidents'] ?? $totalRecords) . '</div>'
                  . '</div>'
                  . '<div class="section-title">Incident Details</div>'
                  . '<table><thead><tr>'
                  . '<th>Date</th><th>Time</th><th>Company</th><th>Driver</th><th>Shuttle</th><th>Route</th><th>Description</th>'
                  . '</tr></thead><tbody>' . $rows . '</tbody></table>'
                  . '</body></html>';
            } else {
                // Generic fallback for the other report types
                $rows = '';
                foreach ($reports as $r) {
                    $driverName = $r->driver ? ($r->driver->first_name . ' ' . $r->driver->last_name) : 'N/A';
                    $shuttleModel = $r->shuttle->model ?? 'N/A';
                    
                    // FIXED: Use $r->route instead of $r->shuttle->route
                    $routeName = $r->route ? $r->route->name : ($r->route_id ? "Route ID: {$r->route_id}" : 'N/A');
                    
                    $date = optional($r->date) ? \Carbon\Carbon::parse($r->date)->format('Y-m-d') : '';
                    $rating = $r->title === 'Driver Performance' ? (string)($r->rating ?? '') : '';
                    $trips = $r->title === 'Shuttle Usage' ? (string)($r->trips ?? '') : '';
                    $desc = e($r->description ?? '');

                    $rows .= '<tr>'
                        . '<td>' . e($r->title ?? '') . '</td>'
                        . '<td>' . e($driverName) . '</td>'
                        . '<td>' . e($shuttleModel) . '</td>'
                        . '<td>' . e($routeName) . '</td>'
                        . '<td>' . e($date) . '</td>'
                        . '<td>' . e($rating) . '</td>'
                        . '<td>' . e($trips) . '</td>'
                        . '<td>' . $desc . '</td>'
                        . '</tr>';
                }

                // Minimal stats
                $statsHtml = '';
                if (isset($statistics['driver_performance'])) {
                    $s = $statistics['driver_performance'];
                    $statsHtml .= '<h3>Driver Performance Summary</h3>'
                        . '<p>Overall Avg Rating: ' . e($s['overall_avg_rating']) . '</p>'
                        . '<p>Total Feedbacks: ' . e($s['total_feedbacks']) . '</p>';
                }
                if (isset($statistics['shuttle_usage'])) {
                    $s = $statistics['shuttle_usage'];
                    $statsHtml .= '<h3>Shuttle Usage Summary</h3>'
                        . '<p>Total Trips: ' . e($s['total_trips']) . '</p>'
                        . '<p>Total Shuttles: ' . e($s['total_shuttles']) . '</p>'
                        . '<p>Avg Trips per Shuttle: ' . e($s['avg_trips_per_shuttle']) . '</p>';
                }

                $html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
                    . '<style>body{font-family:DejaVu Sans, Arial, sans-serif;}h1,h2,h3{color:#333}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #999;padding:6px;font-size:12px}th{background:#f2f2f2;text-align:left}</style>'
                    . '</head><body>'
                    . '<h1>' . $title . '</h1>'
                    . '<p>Generated on: ' . $dateGenerated . '</p>'
                    . (!empty($yearInput) && $yearInput !== 'All' ? '<p>Year: ' . e($yearInput) . '</p>' : '')
                    . (!empty($monthInput) && $monthInput !== 'All' ? '<p>Month: ' . e($monthInput) . '</p>' : '')
                    . $statsHtml
                    . '<h3>Records</h3>'
                    . '<table><thead><tr>'
                    . '<th>Report Type</th><th>Driver</th><th>Shuttle</th><th>Route</th><th>Date</th><th>Rating</th><th>Trips</th><th>Description</th>'
                    . '</tr></thead><tbody>' . $rows . '</tbody></table>'
                    . '</body></html>';
            }
        }

        // Generate PDF
        $pdf = Pdf::loadHTML($html);
        $pdf->setPaper('a4', 'portrait');

        $filenameParts = [str_replace(' ', '_', $reportType) . '_Report'];
        if (!empty($yearInput) && $yearInput !== 'All') { $filenameParts[] = $yearInput; }
        if (!empty($monthInput) && $monthInput !== 'All') { $filenameParts[] = is_numeric($monthInput) ? $monthInput : str_replace(' ', '_', $monthInput); }
        $filenameParts[] = now()->format('Y-m-d');
        $filename = implode('_', $filenameParts) . '.pdf';

        $response = $pdf->download($filename);
        // Ensure CORS works for binary response and expose filename header
        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition');
        return $response;

    } catch (\Exception $e) {
        \Log::error('PDF Generation Error: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Error generating report: ' . $e->getMessage()
        ], 500)
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Expose-Headers', 'Content-Type');
    }
}
    /**
     * Calculate statistics for the report
     */
    private function calculateStatistics($reports, $reportType)
    {
        $statistics = [];

        if ($reportType === 'Driver Performance' || $reportType === 'All') {
            $performanceReports = $reports->where('title', 'Driver Performance');
            
            // Average rating
            $avgRating = $performanceReports->avg('rating') ?? 0;
            
            // Group by driver and calculate average rating per driver
            $driverStats = $performanceReports->groupBy('driver_id')->map(function ($group) {
                $driver = $group->first()->driver;
                return [
                    'name' => $driver ? "{$driver->first_name} {$driver->last_name}" : 'Unknown',
                    'avg_rating' => round($group->avg('rating'), 1),
                    'feedback_count' => $group->count()
                ];
            })->sortByDesc('avg_rating')->values();

            $statistics['driver_performance'] = [
                'overall_avg_rating' => round($avgRating, 1),
                'total_feedbacks' => $performanceReports->count(),
                'top_drivers' => $driverStats->take(5),
                'drivers_above_4' => $driverStats->where('avg_rating', '>=', 4)->count()
            ];
        }

        if ($reportType === 'Shuttle Usage' || $reportType === 'All') {
            $usageReports = $reports->where('title', 'Shuttle Usage');
            
            // Total trips
            $totalTrips = $usageReports->sum('trips');
            
            // Group by shuttle
            $shuttleStats = $usageReports->groupBy('shuttle_id')->map(function ($group) {
                $shuttle = $group->first()->shuttle;
                return [
                    'model' => $shuttle->model ?? 'Unknown',
                    'total_trips' => $group->sum('trips'),
                    'avg_trips_per_month' => round($group->avg('trips'), 1)
                ];
            })->sortByDesc('total_trips')->values();

            $statistics['shuttle_usage'] = [
                'total_trips' => $totalTrips,
                'total_shuttles' => $shuttleStats->count(),
                'avg_trips_per_shuttle' => $shuttleStats->count() > 0 ? round($totalTrips / $shuttleStats->count(), 1) : 0,
                'top_shuttles' => $shuttleStats->take(5),
                'most_used' => $shuttleStats->first()
            ];
        }

        if ($reportType === 'Incident Report' || $reportType === 'All') {
            $incidentReports = $reports->where('title', 'Incident Report');
            
            // Group by driver
            $driverIncidents = $incidentReports->groupBy('driver_id')->map(function ($group) {
                $driver = $group->first()->driver;
                return [
                    'name' => $driver ? "{$driver->first_name} {$driver->last_name}" : 'Unknown',
                    'incident_count' => $group->count()
                ];
            })->sortByDesc('incident_count')->values();

            $statistics['incident_reports'] = [
                'total_incidents' => $incidentReports->count(),
                'top_drivers_with_incidents' => $driverIncidents->take(5)
            ];
        }

        return $statistics;
    }

    /**
     * Resolve the most appropriate current schedule for a shuttle on a given date.
     * Mirrors the prioritisation used in ShuttleController but kept local here.
     */
    protected function getCurrentScheduleForShuttleId(int $shuttleId, string $date)
    {
        $today = Carbon::parse($date)->toDateString();

        $baseQuery = Schedule::with(['driver'])
            ->where('shuttle_id', $shuttleId)
            ->where('status', 'Active')
            ->whereDate('date', $today);

        // Prefer an on-duty schedule (timed in, not yet timed out)
        $onDuty = (clone $baseQuery)
            ->whereNotNull('time_in')
            ->whereNull('time_out')
            ->orderBy('time_in', 'desc')
            ->first();

        if ($onDuty) {
            return $onDuty;
        }

        // Fallback: the closest active schedule for today
        return $baseQuery->orderBy('time')->first();
    }

    /**
     * Store a newly created report
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'type' => 'required|string|max:255',
            'source' => 'required|string|max:255',
            'description' => 'required|string',
            'date' => 'required|date',
            'reported_at' => 'nullable|date',
            'driver_id' => 'required|exists:drivers,id',
            'shuttle_id' => 'required|exists:shuttles,id',
            'route_id' => 'sometimes|nullable|exists:routes,id',
            'rating' => 'sometimes|nullable|numeric|min:0|max:5',
            'trips' => 'sometimes|nullable|integer|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Auto-fill route_id and plate_number from shuttle if missing
            $payload = $request->all();
            $shuttle = null;
            if (!empty($payload['shuttle_id'])) {
                $shuttle = \App\Models\Shuttle::withTrashed()->find($payload['shuttle_id']);
            }
            if (empty($payload['route_id']) && $shuttle) {
                $payload['route_id'] = $shuttle->route_id;
            }
            if (empty($payload['plate_number']) && $shuttle) {
                $payload['plate_number'] = $shuttle->plate;
            }

            // If after autofill route_id is still empty, return 422 instead of 500
            if (empty($payload['route_id'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unable to determine route for this incident. Ensure the shuttle has a route or select a schedule with a route.',
                    'errors' => ['route_id' => ['Route is required']]
                ], 422);
            }

            // Guard against missing optional columns in older schemas
            if (!\Schema::hasColumn('reports', 'plate_number')) {
                unset($payload['plate_number']);
            }

            // Whitelist payload to avoid stray fields and cast types
            $cleanPayload = [
                'title' => (string) ($payload['title'] ?? ''),
                'type' => (string) ($payload['type'] ?? ''),
                'source' => (string) ($payload['source'] ?? ''),
                'description' => (string) ($payload['description'] ?? ''),
                'date' => (string) ($payload['date'] ?? now()->toDateString()),
                'reported_at' => isset($payload['reported_at']) ? (string) $payload['reported_at'] : null,
                'driver_id' => (int) $payload['driver_id'],
                'shuttle_id' => (int) $payload['shuttle_id'],
                'route_id' => (int) $payload['route_id'],
            ];
            if (isset($payload['plate_number'])) {
                $cleanPayload['plate_number'] = (string) $payload['plate_number'];
            }

            $report = Report::create($cleanPayload);

            return response()->json([
                'success' => true,
                'message' => 'Report created successfully',
                'data' => $report->load(['driver.user', 'route'])
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Report create error', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to create report',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Record or increment a shuttle usage trip.
     * This is called automatically from the tracking map when a shuttle
     * reaches its disembark point.
     */
    public function storeTripUsage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'shuttle_id' => 'required|exists:shuttles,id',
            'route_id'   => 'nullable|exists:routes,id',
            'driver_id'  => 'nullable|exists:drivers,id',
            'date'       => 'required|date',
            'late_pickup_label' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $date = Carbon::parse($request->input('date'))->toDateString();
            $shuttleId = (int) $request->input('shuttle_id');
            $routeId = $request->filled('route_id') ? (int) $request->input('route_id') : null;
            $driverId = $request->filled('driver_id') ? (int) $request->input('driver_id') : null;
            $latePickupLabel = $request->filled('late_pickup_label')
                ? (string) $request->input('late_pickup_label')
                : null;

            $baseDescription = 'Automatically recorded shuttle trip via tracking.';
            $description = $latePickupLabel
                ? 'Late @ ' . $latePickupLabel . ' - ' . $baseDescription
                : $baseDescription;

            // If driver_id was not provided by the client, attempt to resolve it
            // from the shuttle's active schedule for the given date.
            if (!$driverId) {
                $schedule = $this->getCurrentScheduleForShuttleId($shuttleId, $date);
                if ($schedule && $schedule->driver_id) {
                    $driverId = (int) $schedule->driver_id;
                }
            }

            // If driver_id is still missing, skip creating the report to avoid
            // integrity violations, and return a validation-style response.
            if (!$driverId) {
                \Log::warning('Skipping trip usage report because driver_id could not be resolved', [
                    'shuttle_id' => $shuttleId,
                    'route_id'   => $routeId,
                    'date'       => $date,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'No active driver found for this shuttle; shuttle usage not recorded.',
                ], 422);
            }

            // Either increment an existing Shuttle Usage report for this shuttle/date,
            // or create a new one starting with trips = 1.
            $reportQuery = Report::where('title', 'Shuttle Usage')
                ->whereDate('date', $date)
                ->where('shuttle_id', $shuttleId);

            if ($routeId) {
                $reportQuery->where('route_id', $routeId);
            }

            $report = $reportQuery->first();

            if (!$report) {
                $report = Report::create([
                    'title'        => 'Shuttle Usage',
                    'type'         => 'Usage',
                    'source'       => 'System',
                    'description'  => $description,
                    'date'         => $date,
                    'reported_at'  => now(),
                    'driver_id'    => $driverId,
                    'shuttle_id'   => $shuttleId,
                    'route_id'     => $routeId,
                    'trips'        => 1,
                ]);
            } else {
                $report->trips = (int) ($report->trips ?? 0) + 1;
                if ($driverId && !$report->driver_id) {
                    $report->driver_id = $driverId;
                }
                if ($routeId && !$report->route_id) {
                    $report->route_id = $routeId;
                }
                if ($latePickupLabel && stripos((string) $report->description, 'Late @') === false) {
                    $report->description = $description;
                }
                $report->save();
            }

            return response()->json([
                'success' => true,
                'message' => 'Shuttle trip usage recorded successfully',
                'data'    => $report->load(['driver.user', 'shuttle', 'route']),
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Trip usage report error', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to record shuttle trip usage',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified report
     */
    public function show($id)
    {
        try {
            $report = Report::with(['driver.user', 'shuttle.route'])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $report
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Report not found',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Update the specified report
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'type' => 'sometimes|string|max:255',
            'source' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'date' => 'sometimes|date',
            'driver_id' => 'nullable|exists:drivers,id',
            'shuttle_id' => 'nullable|exists:shuttles,id',
            'route_id' => 'nullable|exists:routes,id',
            'rating' => 'nullable|numeric|min:0|max:5',
            'trips' => 'nullable|integer|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $report = Report::findOrFail($id);
            $report->update($request->all());

            return response()->json([
                'success' => true,
                'message' => 'Report updated successfully',
                'data' => $report->load(['driver.user', 'route'])
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update report',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified report (soft delete)
     */
    public function destroy($id)
    {
        try {
            $report = Report::findOrFail($id);
            $report->delete();

            return response()->json([
                'success' => true,
                'message' => 'Report deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete report',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function storeFeedback(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'driver_id'  => 'required|exists:drivers,id',
            'shuttle_id' => 'required|exists:shuttles,id',
            'route_id'   => 'nullable|exists:routes,id',
            'rating'     => 'nullable|numeric|min:0|max:5',
            'description'=> 'nullable|string|max:2000',
            'source'     => 'nullable|string|max:255',
            'passenger_name' => 'required|string|max:255',
            'company_name' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $payload = $validator->validated();

            // Verify that the feedback corresponds to an actual active schedule for today
            if (!empty($payload['shuttle_id']) && !empty($payload['driver_id'])) {
                $validSchedule = \App\Models\Schedule::where('shuttle_id', $payload['shuttle_id'])
                    ->where('driver_id', $payload['driver_id'])
                    ->whereDate('date', now()->toDateString())
                    ->where('status', 'Active')
                    ->first();

                if (!$validSchedule) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid feedback. You can only rate drivers of active rides you were part of.',
                    ], 403);
                }

                // Optionally: attach route_id from schedule for safety
                $payload['route_id'] = $validSchedule->route_id;
            }

            if (empty($payload['route_id'])) {
                $routeId = \App\Models\Shuttle::where('id', $payload['shuttle_id'])->value('route_id');
                $payload['route_id'] = $routeId;
            }

            // Check if feedback already exists for this route/driver/shuttle/passenger combination
            $existingFeedback = Report::where('route_id', $payload['route_id'])
                ->where('driver_id', $payload['driver_id'])
                ->where('shuttle_id', $payload['shuttle_id'])
                ->where('passenger_name', $payload['passenger_name'])
                ->where('type', 'Feedback')
                ->first();

            if ($existingFeedback) {
                return response()->json([
                    'success' => false,
                    'message' => 'You have already submitted feedback for this route.',
                    'errors' => ['feedback' => ['Duplicate feedback submission']]
                ], 409);
            }

            $reportedAt = now();

            // Get company name from route if not provided
            $companyName = $payload['company_name'] ?? null;
            if (empty($companyName) && !empty($payload['route_id'])) {
                $route = \App\Models\Route::find($payload['route_id']);
                $companyName = $route ? $route->company : null;
            }

            // Create a standardized feedback report entry
            $report = Report::create([
                'title'       => 'Driver Performance',                 // or 'Feedback'
                'type'        => 'Feedback',
                'source'      => $payload['source'] ?? 'Passenger',
                'passenger_name' => $payload['passenger_name'],
                'company_name' => $companyName,
                'description' => $payload['description'] ?? null,
                'date'        => $reportedAt->toDateString(),
                'reported_at' => $reportedAt,
                'status'      => 'Pending',
                'rating'      => isset($payload['rating']) ? (float)$payload['rating'] : null,
                'driver_id'   => (int)$payload['driver_id'],
                'shuttle_id'  => (int)$payload['shuttle_id'],
                'route_id'    => isset($payload['route_id']) ? (int)$payload['route_id'] : null,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Feedback submitted',
                'data' => $report->load(['driver.user', 'shuttle', 'route'])
            ], 201);
        } catch (\Exception $e) {
            \Log::error('storeFeedback error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit feedback',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get maintenance statistics
     */
    public function getMaintenanceStats()
    {
        try {
            $maintenances = \App\Models\Maintenance::with('shuttle')->get();
            
            // Group by shuttle
            $shuttleMaintenance = $maintenances->groupBy('shuttle_id')->map(function ($group) {
                $shuttle = $group->first()->shuttle;
                return [
                    'shuttle_id' => $shuttle->id ?? null,
                    'shuttle_model' => $shuttle->model ?? 'Unknown',
                    'shuttle_plate' => $shuttle->plate ?? 'Unknown',
                    'maintenance_count' => $group->count(),
                    'under_maintenance' => $group->where('status', 'Under Maintenance')->count(),
                    'done_repairing' => $group->where('status', 'Done Repairing')->count(),
                ];
            })->sortByDesc('maintenance_count')->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_maintenances' => $maintenances->count(),
                    'under_maintenance' => $maintenances->where('status', 'Under Maintenance')->count(),
                    'done_repairing' => $maintenances->where('status', 'Done Repairing')->count(),
                    'shuttle_maintenance' => $shuttleMaintenance,
                    'most_maintained_shuttle' => $shuttleMaintenance->first(),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch maintenance statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}