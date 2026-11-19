<?php

namespace App\Http\Resources;

use App\Models\Alert;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The whole state of one alert. The same snapshot is used by every HTTP response
 * and by the broadcast event, so a client has one shape to parse and can simply
 * replace what it shows. People appear with the same safe fields as the chat.
 *
 * @mixin Alert
 */
class AlertResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->loadMissing(['starter', 'responses.user']);

        return [
            'id' => $this->id,
            'status' => $this->isActive() ? 'active' : 'ended',
            'revision' => $this->revision,
            'started_at' => $this->created_at->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'started_by' => $this->starter ? ['id' => $this->starter->id, 'name' => $this->starter->name] : null,
            'responses' => $this->responses
                ->sortBy('id')
                ->values()
                ->map(fn ($response) => [
                    'user' => [
                        'id' => $response->user->id,
                        'name' => $response->user->name,
                        'avatar_url' => $response->user->avatarUrl(),
                    ],
                    'square' => $response->square->value,
                ])
                ->all(),
        ];
    }
}
