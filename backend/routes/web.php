<?php

use Illuminate\Support\Facades\Route;

// Laravel is a pure JSON API here; the UI lives in the separate React app.
Route::get('/', fn () => response()->json(['name' => config('app.name'), 'api' => url('/api')]));
