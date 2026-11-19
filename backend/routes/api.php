<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
| Every route here is served under the /api prefix (see bootstrap/app.php).
*/

// Lightweight probe used by the frontend skeleton to confirm the whole
// chain works: browser -> Vite proxy -> Laravel -> PostgreSQL.
Route::get('/health', function () {
    DB::connection()->getPdo(); // throws if the database is unreachable

    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'database' => DB::connection()->getDriverName(),
        'time' => now()->toIso8601String(),
    ]);
});
