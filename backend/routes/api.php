<?php

use App\Http\Controllers\AlertController;
use App\Http\Controllers\AlertResponseController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\DirectoryController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ProfileController;
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

    Route::get('/users', [DirectoryController::class, 'index']);
    Route::patch('/users/{user}', [ProfileController::class, 'update']);
    Route::post('/users/{user}/avatar', [ProfileController::class, 'uploadAvatar']);
    Route::delete('/users/{user}/avatar', [ProfileController::class, 'deleteAvatar']);

    // The shared chat room: everyone signed in reads, only `send-messages` writes.
    Route::get('/messages', [MessageController::class, 'index']);
    Route::post('/messages', [MessageController::class, 'store'])
        ->middleware(['can:send-messages', 'throttle:30,1']);

    // Alerts. Each route names the ability it needs, so a direct request from someone
    // without it is refused with 403 before any controller code runs.
    Route::get('/alerts/current', [AlertController::class, 'current'])
        ->middleware(['can:receive-alerts', 'can:view-locations']);
    Route::post('/alerts', [AlertController::class, 'store'])->middleware('can:start-alerts');
    Route::post('/alerts/{alert}/end', [AlertController::class, 'end'])->middleware('can:end-alerts');
    Route::post('/alerts/{alert}/responses', [AlertResponseController::class, 'store'])
        ->middleware('can:submit-locations');
});
