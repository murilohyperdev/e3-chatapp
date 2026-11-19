<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_sign_in_with_valid_credentials(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', 'jane@example.com')
            ->assertJsonMissingPath('data.password');

        $this->assertAuthenticatedAs($user);
    }

    public function test_wrong_password_is_rejected(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'nope'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertGuest();
    }

    public function test_unknown_email_gets_the_same_error_as_a_wrong_password(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $wrong = $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'nope']);
        $unknown = $this->postJson('/api/login', ['email' => 'ghost@example.com', 'password' => 'nope']);

        $unknown->assertUnprocessable();
        $this->assertSame($wrong->json('errors.email'), $unknown->json('errors.email'));
    }

    public function test_email_and_password_are_required(): void
    {
        $this->postJson('/api/login', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_sign_in_is_blocked_after_five_failed_attempts(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        foreach (range(1, 5) as $ignored) {
            $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'nope'])
                ->assertUnprocessable();
        }

        // Even the correct password is refused while throttled.
        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertGuest();
    }

    public function test_successful_sign_in_resets_the_failure_counter(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        foreach (range(1, 4) as $ignored) {
            $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'nope']);
        }
        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])->assertOk();

        $this->assertSame(0, RateLimiter::attempts('jane@example.com|127.0.0.1'));
    }
}
