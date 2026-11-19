<?php

namespace App\Http\Controllers;

use App\Events\AlertChanged;
use App\Http\Resources\AlertResource;
use App\Models\Alert;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Start, end and read alerts. Who may do each is decided by the `can:` middleware
 * on the routes; the rules about state (one active alert, no double end) live here
 * and, for "one active alert", in the database as well.
 */
class AlertController extends Controller
{
    /**
     * The latest alert (active or ended) with every response, or `data: null`.
     * An ended alert is returned too, so a session that was offline when it ended
     * still learns about it.
     */
    public function current(): JsonResponse
    {
        $alert = Alert::query()->with(['starter', 'responses.user'])->latest('id')->first();

        return response()->json(['data' => $alert ? (new AlertResource($alert))->resolve() : null]);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            // A nested transaction becomes a savepoint, so the failed insert below
            // does not poison an outer transaction (it matters inside tests).
            $alert = DB::transaction(function () use ($request): Alert {
                $alert = new Alert;
                $alert->started_by = $request->user()->id;
                $alert->save();

                return $alert;
            });
        } catch (UniqueConstraintViolationException) {
            // The partial unique index refused a second active alert, even in a race.
            abort(409, 'An alert is already active.');
        }

        AlertChanged::announce($alert);

        return response()->json(['data' => (new AlertResource($alert->fresh()))->resolve()], 201);
    }

    public function end(Request $request, Alert $alert): JsonResponse
    {
        DB::transaction(function () use ($request, &$alert): void {
            // Lock the row: a response arriving at the same time waits here and then
            // sees the alert as ended, so nothing can be stored after the end.
            $alert = Alert::query()->lockForUpdate()->findOrFail($alert->id);

            abort_unless($alert->isActive(), 409, 'This alert has already ended.');

            $alert->ended_at = now();
            $alert->ended_by = $request->user()->id;
            $alert->revision++;
            $alert->save();
        });

        AlertChanged::announce($alert);

        return response()->json(['data' => (new AlertResource($alert->fresh()))->resolve()]);
    }
}
