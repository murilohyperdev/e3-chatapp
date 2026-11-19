<?php

namespace App\Events;

use App\Http\Resources\MessageResource;
use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Tells every open browser that a message was posted. It is sent right away
 * (ShouldBroadcastNow) instead of through the queue, so no worker process is needed.
 */
class NewMessage implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('chat')];
    }

    public function broadcastAs(): string
    {
        return 'message.created';
    }

    /**
     * Same JSON as the HTTP responses (without the `data` wrapper).
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return (new MessageResource($this->message->loadMissing('user')))->resolve();
    }
}
