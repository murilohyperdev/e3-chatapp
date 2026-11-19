<?php

namespace Tests\Feature\Chat;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PostMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_in_user_can_post_a_message(): void
    {
        $user = User::factory()->create(['name' => 'Jane']);

        $this->actingAs($user)->postJson('/api/messages', ['body' => 'Hello room'])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Hello room')
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.name', 'Jane')
            ->assertJsonStructure(['data' => ['id', 'body', 'created_at', 'user' => ['id', 'name', 'avatar_url']]]);

        $this->assertDatabaseHas('messages', ['user_id' => $user->id, 'body' => 'Hello room']);
    }

    public function test_administrator_can_post_too(): void
    {
        $admin = User::factory()->administrator()->create();

        $this->actingAs($admin)->postJson('/api/messages', ['body' => 'Hi'])->assertCreated();
    }

    public function test_body_is_trimmed(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', ['body' => "  padded text \n"])
            ->assertCreated()
            ->assertJsonPath('data.body', 'padded text');
    }

    public function test_a_message_of_exactly_the_maximum_length_is_accepted(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', ['body' => str_repeat('a', 2000)])->assertCreated();
    }

    public function test_message_over_the_limit_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', ['body' => str_repeat('a', 2001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');

        $this->assertDatabaseCount('messages', 0);
    }

    #[DataProvider('invalidBodies')]
    public function test_empty_blank_or_malformed_body_is_rejected(array $payload): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');

        $this->assertDatabaseCount('messages', 0);
    }

    /**
     * @return array<string, array<int, array<string, mixed>>>
     */
    public static function invalidBodies(): array
    {
        return [
            'missing' => [[]],
            'empty' => [['body' => '']],
            'only spaces' => [['body' => '    ']],
            'array' => [['body' => ['x']]],
        ];
    }

    public function test_sender_cannot_be_forged(): void
    {
        $user = User::factory()->create();
        $victim = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', ['body' => 'Hi', 'user_id' => $victim->id])
            ->assertCreated()
            ->assertJsonPath('data.user.id', $user->id);

        $this->assertSame($user->id, Message::first()->user_id);
    }

    public function test_user_without_the_send_ability_gets_403(): void
    {
        Gate::define('send-messages', fn (): bool => false);
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/messages', ['body' => 'Hi'])->assertForbidden();

        $this->assertDatabaseCount('messages', 0);
    }

    public function test_visitor_gets_401(): void
    {
        $this->postJson('/api/messages', ['body' => 'Hi'])->assertUnauthorized();

        $this->assertDatabaseCount('messages', 0);
    }
}
