<?php

namespace Tests\Feature\Chat;

use App\Events\NewMessage;
use App\Models\Message;
use App\Models\User;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class BroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_posting_broadcasts_on_the_private_chat_channel(): void
    {
        Event::fake([NewMessage::class]);
        $user = User::factory()->create(['name' => 'Jane']);

        $this->actingAs($user)->postJson('/api/messages', ['body' => 'Hello'])->assertCreated();

        Event::assertDispatched(NewMessage::class, function (NewMessage $event): bool {
            $channels = $event->broadcastOn();

            return $channels[0] instanceof PrivateChannel
                && $channels[0]->name === 'private-chat'
                && $event->broadcastAs() === 'message.created'
                && $event->broadcastWith()['body'] === 'Hello'
                && $event->broadcastWith()['user']['name'] === 'Jane';
        });
    }

    public function test_the_payload_matches_the_http_response(): void
    {
        Event::fake([NewMessage::class]);
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/messages', ['body' => 'Same shape'])->assertCreated();

        Event::assertDispatched(NewMessage::class, fn (NewMessage $event) => $event->broadcastWith() === $response->json('data'));
    }

    public function test_nothing_is_broadcast_when_the_post_fails(): void
    {
        Event::fake([NewMessage::class]);
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', ['body' => ''])->assertUnprocessable();

        Event::assertNotDispatched(NewMessage::class);
    }

    public function test_nothing_is_broadcast_for_a_visitor(): void
    {
        Event::fake([NewMessage::class]);

        $this->postJson('/api/messages', ['body' => 'anon'])->assertUnauthorized();

        Event::assertNotDispatched(NewMessage::class);
    }

    public function test_the_message_is_kept_and_the_post_succeeds_when_the_broadcaster_is_down(): void
    {
        Broadcast::extend('broken', fn () => new class extends Broadcaster
        {
            public function auth($request): mixed
            {
                return null;
            }

            public function validAuthenticationResponse($request, $result): mixed
            {
                return null;
            }

            public function broadcast(array $channels, $event, array $payload = []): void
            {
                throw new \RuntimeException('Reverb is down');
            }
        });
        config(['broadcasting.default' => 'broken', 'broadcasting.connections.broken' => ['driver' => 'broken']]);
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', ['body' => 'Still saved'])->assertCreated();

        $this->assertDatabaseHas('messages', ['body' => 'Still saved']);
    }

    public function test_signed_in_user_may_join_the_chat_channel(): void
    {
        $this->useRealReverbSigning();

        $this->actingAs(User::factory()->create())
            ->postJson('/api/broadcasting/auth', ['channel_name' => 'private-chat', 'socket_id' => '1234.5678'])
            ->assertOk()
            ->assertJsonStructure(['auth']);
    }

    public function test_visitor_cannot_join_the_chat_channel(): void
    {
        $this->useRealReverbSigning();

        $this->postJson('/api/broadcasting/auth', ['channel_name' => 'private-chat', 'socket_id' => '1234.5678'])
            ->assertUnauthorized();
    }

    public function test_other_private_channels_are_refused(): void
    {
        $this->useRealReverbSigning();

        $this->actingAs(User::factory()->create())
            ->postJson('/api/broadcasting/auth', ['channel_name' => 'private-secret-room', 'socket_id' => '1234.5678'])
            ->assertForbidden();
    }

    public function test_message_model_keeps_the_sender_out_of_mass_assignment(): void
    {
        $message = new Message;
        $message->fill(['body' => 'x', 'user_id' => 99]);

        $this->assertSame('x', $message->body);
        $this->assertNull($message->user_id);
    }

    private function useRealReverbSigning(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test-app',
            'broadcasting.connections.reverb.options.host' => 'localhost',
        ]);
        // Channel callbacks live on the broadcaster instance, so register them on the new one.
        Broadcast::purge('reverb');
        require base_path('routes/channels.php');
    }
}
