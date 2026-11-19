<?php

namespace App\Events;

use App\Http\Resources\AlertResource;
use App\Models\Alert;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Sent whenever an alert starts, receives a response or ends. It always carries
 * the full alert snapshot, never a delta, so receiving it twice, late or out of
 * order is harmless (the client keeps the highest revision).
 */
class AlertChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Alert $alert) {}

    /**
     * Pushes the new state to everyone. The change is already saved, so a broadcaster
     * outage is only logged: it must never turn a stored change into a failed request.
     */
    public static function announce(Alert $alert): void
    {
        try {
            broadcast(new self($alert->fresh()));
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('alerts')];
    }

    public function broadcastAs(): string
    {
        return 'alert.changed';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return (new AlertResource($this->alert))->resolve();
    }
}
