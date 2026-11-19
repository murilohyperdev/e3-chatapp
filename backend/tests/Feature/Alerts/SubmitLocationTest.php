<?php

namespace Tests\Feature\Alerts;

use App\Models\Alert;
use App\Models\AlertResponse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class SubmitLocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_picks_a_square(): void
    {
        $alert = Alert::factory()->create();
        $user = User::factory()->create(['name' => 'Jane']);

        $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'b'])
            ->assertCreated()
            ->assertJsonPath('data.responses.0.user.name', 'Jane')
            ->assertJsonPath('data.responses.0.square', 'b')
            ->assertJsonPath('data.revision', 2);

        $this->assertDatabaseHas('alert_responses', ['alert_id' => $alert->id, 'user_id' => $user->id, 'square' => 'b']);
    }

    public function test_the_administrator_picks_like_everyone_else(): void
    {
        $alert = Alert::factory()->create();

        $this->actingAs(User::factory()->administrator()->create())
            ->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a'])
            ->assertCreated();
    }

    public function test_several_users_can_share_a_square(): void
    {
        $alert = Alert::factory()->create();

        foreach ([User::factory()->create(), User::factory()->create()] as $user) {
            $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'd'])->assertCreated();
        }

        $this->assertSame(2, AlertResponse::where('alert_id', $alert->id)->where('square', 'd')->count());
    }

    public function test_the_second_pick_is_refused_and_the_first_stays(): void
    {
        $alert = Alert::factory()->create();
        $user = User::factory()->create();
        $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a'])->assertCreated();

        $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'c'])->assertConflict();

        $this->assertDatabaseCount('alert_responses', 1);
        $this->assertDatabaseHas('alert_responses', ['user_id' => $user->id, 'square' => 'a']);
    }

    public function test_the_same_user_can_pick_again_in_a_new_alert(): void
    {
        $user = User::factory()->create();
        $old = Alert::factory()->ended()->create();
        AlertResponse::factory()->create(['alert_id' => $old->id, 'user_id' => $user->id, 'square' => 'a']);
        $new = Alert::factory()->create();

        $this->actingAs($user)->postJson("/api/alerts/{$new->id}/responses", ['square' => 'a'])->assertCreated();
    }

    public function test_an_invalid_or_missing_square_is_rejected(): void
    {
        $alert = Alert::factory()->create();
        $user = User::factory()->create();

        foreach ([[], ['square' => ''], ['square' => 'e'], ['square' => 'A'], ['square' => 1], ['square' => ['a']]] as $payload) {
            $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", $payload)
                ->assertUnprocessable()
                ->assertJsonValidationErrors('square');
        }

        $this->assertDatabaseCount('alert_responses', 0);
    }

    public function test_a_pick_for_an_ended_alert_is_rejected(): void
    {
        $alert = Alert::factory()->ended()->create();

        $this->actingAs(User::factory()->create())
            ->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a'])
            ->assertConflict();

        $this->assertDatabaseCount('alert_responses', 0);
    }

    public function test_a_pick_for_an_unknown_alert_is_404(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/alerts/999/responses', ['square' => 'a'])->assertNotFound();
    }

    public function test_the_person_cannot_be_forged_through_the_body(): void
    {
        $alert = Alert::factory()->create();
        $user = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a', 'user_id' => $other->id, 'alert_id' => 999])
            ->assertCreated();

        $this->assertDatabaseHas('alert_responses', ['alert_id' => $alert->id, 'user_id' => $user->id]);
        $this->assertDatabaseMissing('alert_responses', ['user_id' => $other->id]);
    }

    public function test_a_user_without_the_ability_is_refused_on_a_direct_request(): void
    {
        $alert = Alert::factory()->create();
        $user = User::factory()->create();
        // Take the ability away from the role map for this test only.
        Gate::define('submit-locations', fn () => false);

        $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a'])->assertForbidden();

        $this->assertDatabaseCount('alert_responses', 0);
    }

    public function test_visitor_gets_401(): void
    {
        $alert = Alert::factory()->create();

        $this->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a'])->assertUnauthorized();
    }
}
