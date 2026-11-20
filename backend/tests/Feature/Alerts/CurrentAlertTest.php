<?php

namespace Tests\Feature\Alerts;

use App\Models\Alert;
use App\Models\AlertResponse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class CurrentAlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_null_when_no_alert_was_ever_started(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/alerts/current')
            ->assertOk()
            ->assertExactJson(['data' => null]);
    }

    public function test_returns_the_active_alert_with_its_responses(): void
    {
        $alert = Alert::factory()->create();
        $jane = User::factory()->create(['name' => 'Jane']);
        AlertResponse::factory()->create(['alert_id' => $alert->id, 'user_id' => $jane->id, 'square' => 'c']);

        $this->actingAs(User::factory()->create())->getJson('/api/alerts/current')
            ->assertOk()
            ->assertJsonPath('data.id', $alert->id)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.responses.0.user.name', 'Jane')
            ->assertJsonPath('data.responses.0.square', 'c');
    }

    public function test_an_alert_that_ended_while_the_session_was_offline_is_still_reported(): void
    {
        Alert::factory()->ended()->create();

        $this->actingAs(User::factory()->create())->getJson('/api/alerts/current')
            ->assertOk()
            ->assertJsonPath('data.status', 'ended')
            ->assertJsonPath('data.ended_at', fn ($value) => $value !== null);
    }

    public function test_returns_the_latest_alert_and_not_the_responses_of_older_ones(): void
    {
        $old = Alert::factory()->ended()->create();
        AlertResponse::factory()->create(['alert_id' => $old->id, 'square' => 'a']);
        $new = Alert::factory()->create();

        $this->actingAs(User::factory()->create())->getJson('/api/alerts/current')
            ->assertJsonPath('data.id', $new->id)
            ->assertJsonPath('data.responses', []);
    }

    public function test_does_not_leak_private_user_fields(): void
    {
        $alert = Alert::factory()->create();
        AlertResponse::factory()->create(['alert_id' => $alert->id]);

        $body = $this->actingAs(User::factory()->create())->getJson('/api/alerts/current')->getContent();

        $this->assertStringNotContainsString('@', $body);
        $this->assertStringNotContainsString('password', $body);
    }

    public function test_visitor_gets_401(): void
    {
        $this->getJson('/api/alerts/current')->assertUnauthorized();
    }

    public function test_a_user_without_the_receive_alerts_ability_is_refused(): void
    {
        Gate::define('receive-alerts', fn () => false);

        $this->actingAs(User::factory()->create())->getJson('/api/alerts/current')->assertForbidden();
    }

    public function test_a_user_without_the_view_locations_ability_is_refused(): void
    {
        Alert::factory()->create();
        Gate::define('view-locations', fn () => false);

        $this->actingAs(User::factory()->create())->getJson('/api/alerts/current')->assertForbidden();
    }
}
