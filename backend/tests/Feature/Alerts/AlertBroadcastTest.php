<?php

namespace Tests\Feature\Alerts;

use App\Events\AlertChanged;
use App\Models\Alert;
use App\Models\User;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class AlertBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_starting_broadcasts_the_snapshot_on_the_private_alerts_channel(): void
    {
        Event::fake([AlertChanged::class]);
        $admin = User::factory()->administrator()->create();

        $response = $this->actingAs($admin)->postJson('/api/alerts')->assertCreated();

        Event::assertDispatched(AlertChanged::class, function (AlertChanged $event) use ($response): bool {
            $channel = $event->broadcastOn()[0];

            return $channel instanceof PrivateChannel
                && $channel->name === 'private-alerts'
                && $event->broadcastAs() === 'alert.changed'
                && $event->broadcastWith() === $response->json('data');
        });
    }

    public function test_a_pick_broadcasts_the_new_snapshot_with_the_name_in_the_square(): void
    {
        Event::fake([AlertChanged::class]);
        $alert = Alert::factory()->create();
        $user = User::factory()->create(['name' => 'Jane']);

        $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'c'])->assertCreated();

        Event::assertDispatched(AlertChanged::class, function (AlertChanged $event): bool {
            $payload = $event->broadcastWith();

            return $payload['revision'] === 2
                && $payload['responses'][0]['user']['name'] === 'Jane'
                && $payload['responses'][0]['square'] === 'c';
        });
    }

    public function test_ending_broadcasts_the_ended_snapshot(): void
    {
        Event::fake([AlertChanged::class]);
        $alert = Alert::factory()->create();

        $this->actingAs(User::factory()->administrator()->create())->postJson("/api/alerts/{$alert->id}/end")->assertOk();

        Event::assertDispatched(AlertChanged::class, fn (AlertChanged $event) => $event->broadcastWith()['status'] === 'ended');
    }

    public function test_nothing_is_broadcast_for_rejected_requests(): void
    {
        Event::fake([AlertChanged::class]);
        $user = User::factory()->create();
        $admin = User::factory()->administrator()->create();
        $active = Alert::factory()->create();
        $ended = Alert::factory()->ended()->create();

        $this->actingAs($user)->postJson('/api/alerts')->assertForbidden();                                         // no ability
        $this->actingAs($admin)->postJson('/api/alerts')->assertConflict();                                         // already active
        $this->actingAs($user)->postJson("/api/alerts/{$active->id}/responses", ['square' => 'x'])->assertUnprocessable();
        $this->actingAs($user)->postJson("/api/alerts/{$ended->id}/responses", ['square' => 'a'])->assertConflict();
        $this->actingAs($user)->postJson("/api/alerts/{$active->id}/end")->assertForbidden();
        $this->actingAs($admin)->postJson("/api/alerts/{$ended->id}/end")->assertConflict();

        Event::assertNotDispatched(AlertChanged::class);
    }

    public function test_the_change_is_kept_and_the_request_succeeds_when_the_broadcaster_is_down(): void
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

        $this->actingAs(User::factory()->administrator()->create())->postJson('/api/alerts')->assertCreated();

        $this->assertDatabaseCount('alerts', 1);
    }

    public function test_permitted_user_may_join_the_alerts_channel(): void
    {
        $this->useRealReverbSigning();

        $this->actingAs(User::factory()->create())
            ->postJson('/api/broadcasting/auth', ['channel_name' => 'private-alerts', 'socket_id' => '1234.5678'])
            ->assertOk()
            ->assertJsonStructure(['auth']);
    }

    public function test_a_user_lacking_view_locations_or_receive_alerts_is_refused(): void
    {
        $this->useRealReverbSigning();
        Gate::define('view-locations', fn () => false);

        $this->actingAs(User::factory()->create())
            ->postJson('/api/broadcasting/auth', ['channel_name' => 'private-alerts', 'socket_id' => '1234.5678'])
            ->assertForbidden();
    }

    public function test_visitor_cannot_join_the_alerts_channel(): void
    {
        $this->useRealReverbSigning();

        $this->postJson('/api/broadcasting/auth', ['channel_name' => 'private-alerts', 'socket_id' => '1234.5678'])
            ->assertUnauthorized();
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
        Broadcast::purge('reverb');
        require base_path('routes/channels.php');
    }
}
