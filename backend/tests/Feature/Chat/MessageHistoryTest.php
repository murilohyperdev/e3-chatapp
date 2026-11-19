<?php

namespace Tests\Feature\Chat;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_empty_room_returns_an_empty_list(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/messages')
            ->assertOk()
            ->assertExactJson(['data' => [], 'meta' => ['has_more' => false]]);
    }

    public function test_messages_come_back_in_chronological_order_with_their_sender(): void
    {
        $ana = User::factory()->create(['name' => 'Ana']);
        $bob = User::factory()->create(['name' => 'Bob']);
        Message::factory()->for($ana)->create(['body' => 'first']);
        Message::factory()->for($bob)->create(['body' => 'second']);

        $this->actingAs($ana)->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.0.body', 'first')
            ->assertJsonPath('data.0.user.name', 'Ana')
            ->assertJsonPath('data.1.body', 'second')
            ->assertJsonPath('data.1.user.name', 'Bob')
            ->assertJsonPath('meta.has_more', false);
    }

    public function test_only_the_latest_fifty_are_returned_and_older_ones_are_flagged(): void
    {
        $user = User::factory()->create();
        Message::factory()->for($user)->count(55)->create();

        $response = $this->actingAs($user)->getJson('/api/messages')->assertOk();

        $ids = array_column($response->json('data'), 'id');
        $this->assertCount(50, $ids);
        $this->assertTrue($response->json('meta.has_more'));
        $this->assertSame($ids, collect($ids)->sort()->values()->all(), 'oldest first inside the page');
        $this->assertSame(Message::max('id'), end($ids), 'the page ends at the newest message');
    }

    public function test_before_returns_the_previous_page_only(): void
    {
        $user = User::factory()->create();
        Message::factory()->for($user)->count(55)->create();
        $firstOfLatest = $this->actingAs($user)->getJson('/api/messages')->json('data.0.id');

        $older = $this->actingAs($user)->getJson("/api/messages?before={$firstOfLatest}")->assertOk();

        $this->assertCount(5, $older->json('data'));
        $this->assertFalse($older->json('meta.has_more'));
        foreach ($older->json('data') as $message) {
            $this->assertLessThan($firstOfLatest, $message['id']);
        }
    }

    public function test_invalid_before_is_rejected(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/messages?before=abc')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('before');
    }

    public function test_sender_exposes_no_private_data(): void
    {
        $user = User::factory()->create(['phone' => '+55 11 91234-5678', 'address' => 'Secret St 1']);
        Message::factory()->for($user)->create();

        $response = $this->actingAs($user)->getJson('/api/messages')->assertOk();

        $this->assertEqualsCanonicalizing(['id', 'name', 'avatar_url'], array_keys($response->json('data.0.user')));
        $this->assertStringNotContainsString($user->email, $response->getContent());
        $this->assertStringNotContainsString('Secret St', $response->getContent());
    }

    public function test_history_does_not_run_a_query_per_message(): void
    {
        $user = User::factory()->create();
        Message::factory()->count(20)->create();

        \DB::enableQueryLog();
        $this->actingAs($user)->getJson('/api/messages')->assertOk();

        // session/auth lookups aside, messages + users must be two queries, not 21.
        $this->assertLessThanOrEqual(4, count(\DB::getQueryLog()));
    }

    public function test_visitor_gets_401(): void
    {
        $this->getJson('/api/messages')->assertUnauthorized();
    }
}
