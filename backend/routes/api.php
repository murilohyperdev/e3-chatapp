<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
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

// Public: sign in and password recovery.
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [PasswordResetController::class, 'forgot']);
Route::post('/reset-password', [PasswordResetController::class, 'reset']);

// Everything below requires a signed-in user (session cookie via Sanctum).
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'me']);
});
