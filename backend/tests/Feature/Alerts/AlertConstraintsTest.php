<?php

namespace Tests\Feature\Alerts;

use App\Models\Alert;
use App\Models\AlertResponse;
use App\Models\User;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * These tests talk to the database directly, skipping controllers and validation,
 * to prove the rules hold even if some code path forgets to check them.
 */
class AlertConstraintsTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_database_refuses_a_second_active_alert(): void
    {
        Alert::factory()->create();

        $this->expectException(UniqueConstraintViolationException::class);

        DB::transaction(fn () => DB::table('alerts')->insert(['created_at' => now(), 'updated_at' => now()]));
    }

    public function test_the_database_allows_many_ended_alerts_next_to_one_active(): void
    {
        Alert::factory()->ended()->count(3)->create();
        Alert::factory()->create();

        $this->assertDatabaseCount('alerts', 4);
    }

    public function test_the_database_refuses_a_second_response_from_the_same_user(): void
    {
        $alert = Alert::factory()->create();
        $user = User::factory()->create();
        AlertResponse::factory()->create(['alert_id' => $alert->id, 'user_id' => $user->id, 'square' => 'a']);

        $this->expectException(UniqueConstraintViolationException::class);

        DB::transaction(fn () => DB::table('alert_responses')->insert([
            'alert_id' => $alert->id, 'user_id' => $user->id, 'square' => 'b', 'created_at' => now(), 'updated_at' => now(),
        ]));
    }

    public function test_the_database_refuses_a_square_outside_a_to_d(): void
    {
        $alert = Alert::factory()->create();
        $user = User::factory()->create();

        $this->expectException(QueryException::class);

        DB::transaction(fn () => DB::table('alert_responses')->insert([
            'alert_id' => $alert->id, 'user_id' => $user->id, 'square' => 'z', 'created_at' => now(), 'updated_at' => now(),
        ]));
    }

    public function test_deleting_an_alert_removes_its_responses_but_deleting_the_admin_keeps_the_alert(): void
    {
        $admin = User::factory()->administrator()->create();
        $alert = Alert::factory()->create(['started_by' => $admin->id]);
        AlertResponse::factory()->create(['alert_id' => $alert->id]);

        $admin->delete();
        $this->assertNull($alert->fresh()->started_by);

        $alert->delete();
        $this->assertDatabaseCount('alert_responses', 0);
    }

    public function test_alert_and_response_models_do_not_allow_forging_through_mass_assignment(): void
    {
        // An alert has nothing mass assignable: Laravel refuses outright.
        try {
            (new Alert)->fill(['started_by' => 9, 'ended_at' => now(), 'revision' => 50]);
            $this->fail('Alert accepted mass assignment.');
        } catch (MassAssignmentException) {
            $this->addToAssertionCount(1);
        }

        $response = new AlertResponse;
        $response->fill(['square' => 'a', 'user_id' => 9, 'alert_id' => 9]);
        $this->assertNull($response->user_id);
        $this->assertNull($response->alert_id);
    }
}
