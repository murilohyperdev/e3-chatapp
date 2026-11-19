<?php

namespace App\Http\Controllers;

use App\Events\NewMessage;
use App\Http\Requests\StoreMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Throwable;

class MessageController extends Controller
{
    public const MAX_LENGTH = 2000;

    private const PER_PAGE = 50;

    /**
     * Newest page first, or the page just before `before` (a message id). Keyset
     * pagination: unlike page numbers it does not shift while new messages arrive.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $before = $request->validate(['before' => ['sometimes', 'integer', 'min:1']])['before'] ?? null;

        // One extra row tells us whether older messages exist.
        $rows = Message::query()
            ->with('user:id,name,avatar_path')
            ->when($before, fn ($query) => $query->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(self::PER_PAGE + 1)
            ->get();

        $hasMore = $rows->count() > self::PER_PAGE;

        // The client wants chronological order (oldest at the top).
        $page = $rows->take(self::PER_PAGE)->reverse()->values();

        return MessageResource::collection($page)->additional(['meta' => ['has_more' => $hasMore]]);
    }

    public function store(StoreMessageRequest $request): JsonResponse
    {
        // The sender comes from the session, never from the request body.
        $message = $request->user()->messages()->create($request->validated());
        $message->setRelation('user', $request->user());

        // toOthers(): the sender already has the message from this response.
        // A broadcaster outage must not lose a message that is already saved.
        try {
            broadcast(new NewMessage($message))->toOthers();
        } catch (Throwable $e) {
            report($e);
        }

        return (new MessageResource($message))->response()->setStatusCode(201);
    }
}
