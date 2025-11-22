<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $reportType }} Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #EA7822;
        }
        .header h1 {
            color: #EA7822;
            margin: 0;
            font-size: 24px;
        }
        .header p {
            margin: 5px 0;
            color: #666;
        }
        .statistics {
            background-color: #f9f9f9;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
        }
        .statistics h2 {
            color: #EA7822;
            font-size: 18px;
            margin-top: 0;
        }
        .stat-item {
            margin: 10px 0;
        }
        .stat-label {
            font-weight: bold;
            color: #555;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background-color: #EA7822;
            color: white;
            padding: 10px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #999;
        }
        .top-performers {
            margin: 20px 0;
        }
        .top-performers h3 {
            color: #EA7822;
            font-size: 16px;
        }
        .performer-item {
            padding: 8px;
            margin: 5px 0;
            background-color: #f9f9f9;
            border-left: 3px solid #4CAF50;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ $reportType }} Report</h1>
        <p>Generated on {{ $generatedDate }}</p>
        <p>Total Records: {{ $reports->count() }}</p>
    </div>

    @if($reportType === 'Driver Performance' || $reportType === 'All')
        @if(isset($statistics['driver_performance']))
        <div class="statistics">
            <h2>📊 Driver Performance Statistics</h2>
            <div class="stat-item">
                <span class="stat-label">Overall Average Rating:</span> 
                {{ $statistics['driver_performance']['overall_avg_rating'] }}/5 
                ({{ ($statistics['driver_performance']['overall_avg_rating'] * 20) }}%)
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Feedback Count:</span> 
                {{ $statistics['driver_performance']['total_feedbacks'] }}
            </div>
            <div class="stat-item">
                <span class="stat-label">Drivers with 4+ Rating:</span> 
                {{ $statistics['driver_performance']['drivers_above_4'] }}
            </div>
        </div>

        @if($statistics['driver_performance']['top_drivers']->count() > 0)
        <div class="top-performers">
            <h3>🌟 Top 5 Performing Drivers</h3>
            @foreach($statistics['driver_performance']['top_drivers'] as $index => $driver)
            <div class="performer-item">
                <strong>{{ $index + 1 }}. {{ $driver['name'] }}</strong> - 
                Rating: {{ $driver['avg_rating'] }}/5 
                ({{ $driver['feedback_count'] }} feedbacks)
            </div>
            @endforeach
        </div>
        @endif

        <h2 style="color: #EA7822; margin-top: 30px;">Driver Performance Details</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Passenger Name</th>
                    <th>Company</th>
                    <th>Driver</th>
                    <th>Shuttle</th>
                    <th>Rating</th>
                    <th>Feedback</th>
                </tr>
            </thead>
            <tbody>
                @foreach($reports->where('title', 'Driver Performance') as $report)
                <tr>
                    <td>{{ \Carbon\Carbon::parse($report->date)->format('M d, Y') }}</td>
                    <td>{{ $report->reported_at ? \Carbon\Carbon::parse($report->reported_at)->format('h:i A') : 'N/A' }}</td>
                    <td>{{ $report->passenger_name ?? 'N/A' }}</td>
                    <td>{{ $report->company_name ?? (optional($report->route)->company ?? 'N/A') }}</td>
                    <td>{{ $report->driver ? $report->driver->first_name . ' ' . $report->driver->last_name : 'N/A' }}</td>
                    <td>{{ $report->shuttle->model ?? 'N/A' }}</td>
                    <td>⭐ {{ $report->rating }}/5</td>
                    <td>{{ Str::limit($report->description, 50) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif
    @endif

    @if($reportType === 'Shuttle Usage' || $reportType === 'All')
        @if(isset($statistics['shuttle_usage']))
        <div class="statistics" style="margin-top: 30px;">
            <h2>🚐 Shuttle Usage Statistics</h2>
            <div class="stat-item">
                <span class="stat-label">Total Trips:</span> 
                {{ number_format($statistics['shuttle_usage']['total_trips']) }}
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Shuttles:</span> 
                {{ $statistics['shuttle_usage']['total_shuttles'] }}
            </div>
            <div class="stat-item">
                <span class="stat-label">Average Trips per Shuttle:</span> 
                {{ $statistics['shuttle_usage']['avg_trips_per_shuttle'] }}
            </div>
            @if($statistics['shuttle_usage']['most_used'])
            <div class="stat-item">
                <span class="stat-label">Most Used Shuttle:</span> 
                {{ $statistics['shuttle_usage']['most_used']['model'] }} 
                ({{ number_format($statistics['shuttle_usage']['most_used']['total_trips']) }} trips)
            </div>
            @endif
        </div>

        @if($statistics['shuttle_usage']['top_shuttles']->count() > 0)
        <div class="top-performers">
            <h3>🏆 Top 5 Most Used Shuttles</h3>
            @foreach($statistics['shuttle_usage']['top_shuttles'] as $index => $shuttle)
            <div class="performer-item">
                <strong>{{ $index + 1 }}. {{ $shuttle['model'] }}</strong> - 
                {{ number_format($shuttle['total_trips']) }} trips 
                (Avg: {{ $shuttle['avg_trips_per_month'] }} per month)
            </div>
            @endforeach
        </div>
        @endif

        <h2 style="color: #EA7822; margin-top: 30px;">Shuttle Usage Details</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Shuttle Model</th>
                    <th>Route</th>
                    <th>Driver</th>
                    <th>Trips</th>
                </tr>
            </thead>
            <tbody>
                @foreach($reports->where('title', 'Shuttle Usage') as $report)
                <tr>
                    <td>{{ \Carbon\Carbon::parse($report->date)->format('M Y') }}</td>
                    <td>{{ $report->shuttle->model ?? 'N/A' }}</td>
                    <td>{{ $report->shuttle->route->name ?? 'N/A' }}</td>
                    <td>{{ $report->driver ? $report->driver->first_name . ' ' . $report->driver->last_name : 'N/A' }}</td>
                    <td>{{ number_format($report->trips) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif
    @endif

    <div class="footer">
        <p>This report was automatically generated by the Shuttle Management System</p>
        <p>© {{ date('Y') }} - All rights reserved</p>
    </div>
</body>
</html>