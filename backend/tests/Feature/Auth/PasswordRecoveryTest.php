<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_link_is_sent_to_a_registered_email(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'jane@example.com'])
            ->assertOk()
            ->assertJsonStructure(['message']);

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_reset_link_points_to_the_frontend_page(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'jane@example.com']);

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;

            return str_starts_with($url, config('app.frontend_url').'/reset-password?token=')
                && str_contains($url, 'email=jane%40example.com');
        });
    }

    public function test_unknown_email_gets_the_same_answer_and_no_email(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'jane@example.com']);

        $known = $this->postJson('/api/forgot-password', ['email' => 'jane@example.com']);
        $unknown = $this->postJson('/api/forgot-password', ['email' => 'ghost@example.com']);

        $unknown->assertOk();
        $this->assertSame($known->json('message'), $unknown->json('message'));
        Notification::assertSentTimes(ResetPassword::class, 1);
    }

    public function test_invalid_email_format_is_rejected(): void
    {
        $this->postJson('/api/forgot-password', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_repeated_requests_are_throttled(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'jane@example.com'])->assertOk();
        $this->postJson('/api/forgot-password', ['email' => 'jane@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        Notification::assertSentTimes(ResetPassword::class, 1);
    }

    public function test_password_can_be_reset_with_a_valid_token(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'brand-new-pass',
            'password_confirmation' => 'brand-new-pass',
        ])->assertOk();

        $this->assertTrue(Hash::check('brand-new-pass', $user->fresh()->password));
        $this->assertFalse(Hash::check('password', $user->fresh()->password));
        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'brand-new-pass'])->assertOk();
    }

    public function test_token_cannot_be_used_twice(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $token = Password::createToken($user);
        $payload = [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'brand-new-pass',
            'password_confirmation' => 'brand-new-pass',
        ];

        $this->postJson('/api/reset-password', $payload)->assertOk();
        $this->postJson('/api/reset-password', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_invalid_token_is_rejected_and_password_is_unchanged(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/reset-password', [
            'token' => 'wrong-token',
            'email' => 'jane@example.com',
            'password' => 'brand-new-pass',
            'password_confirmation' => 'brand-new-pass',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $token = Password::createToken($user);

        $this->travel(config('auth.passwords.users.expire') + 1)->minutes();

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'brand-new-pass',
            'password_confirmation' => 'brand-new-pass',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_weak_or_unconfirmed_passwords_are_rejected(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token, 'email' => 'jane@example.com',
            'password' => 'short', 'password_confirmation' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->postJson('/api/reset-password', [
            'token' => $token, 'email' => 'jane@example.com',
            'password' => 'long-enough-pass', 'password_confirmation' => 'different-pass',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }
}
