<?php

namespace App\Http\Controllers;

use App\Events\AlertChanged;
use App\Http\Requests\StoreAlertResponseRequest;
use App\Http\Resources\AlertResource;
use App\Models\Alert;
use App\Models\AlertResponse;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AlertResponseController extends Controller
{
    /**
     * Stores the signed-in user's square for this alert. The first pick is final.
     */
    public function store(StoreAlertResponseRequest $request, Alert $alert): JsonResponse
    {
        try {
            DB::transaction(function () use ($request, &$alert): void {
                // Same lock as ending the alert: this pick is either committed before the
                // end, or it waits, sees the alert as ended and is rejected.
                $alert = Alert::query()->lockForUpdate()->findOrFail($alert->id);

                abort_unless($alert->isActive(), 409, 'This alert has ended: locations are closed.');

                $response = new AlertResponse($request->validated());
                $response->alert_id = $alert->id;
                $response->user_id = $request->user()->id;
                $response->save(); // UNIQUE(alert_id, user_id) is the final guard

                $alert->increment('revision');
            });
        } catch (UniqueConstraintViolationException) {
            abort(409, 'You have already picked a location for this alert.');
        }

        AlertChanged::announce($alert);

        return response()->json(['data' => (new AlertResource($alert->fresh()))->resolve()], 201);
    }
}
