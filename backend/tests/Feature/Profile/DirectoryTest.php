<?php

namespace Tests\Feature\Profile;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DirectoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_directory_lists_users_ordered_by_name(): void
    {
        $viewer = User::factory()->create(['name' => 'Mia']);
        User::factory()->create(['name' => 'Zed']);
        User::factory()->administrator()->create(['name' => 'Abe']);

        $this->actingAs($viewer)->getJson('/api/users')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Abe')
            ->assertJsonPath('data.0.role', 'administrator')
            ->assertJsonPath('data.1.name', 'Mia')
            ->assertJsonPath('data.2.name', 'Zed')
            ->assertJsonPath('data.2.role', 'user');
    }

    public function test_directory_is_paginated(): void
    {
        User::factory()->count(15)->create();
        $viewer = User::factory()->create();

        $first = $this->actingAs($viewer)->getJson('/api/users')->assertOk();
        $this->assertCount(12, $first->json('data'));
        $this->assertSame(16, $first->json('meta.total'));

        $second = $this->actingAs($viewer)->getJson('/api/users?page=2')->assertOk();
        $this->assertCount(4, $second->json('data'));
        $this->assertEmpty(array_intersect(
            array_column($first->json('data'), 'id'),
            array_column($second->json('data'), 'id'),
        ));
    }

    public function test_entries_expose_only_public_fields(): void
    {
        $viewer = User::factory()->create();
        $other = User::factory()->create();
        $other->update(['phone' => '123456789', 'address' => 'Secret street']);

        $response = $this->actingAs($viewer)->getJson('/api/users')->assertOk();

        foreach ($response->json('data') as $entry) {
            $this->assertEqualsCanonicalizing(['id', 'name', 'avatar_url', 'role'], array_keys($entry));
        }
        $this->assertStringNotContainsString('Secret street', $response->getContent());
        $this->assertStringNotContainsString($other->email, $response->getContent());
    }

    public function test_visitor_gets_401(): void
    {
        $this->getJson('/api/users')->assertUnauthorized();
    }

    public function test_entry_includes_the_picture_url_when_set(): void
    {
        $viewer = User::factory()->create(['name' => 'Aaa']);
        $viewer->forceFill(['avatar_path' => 'avatars/me.png'])->save();

        $this->actingAs($viewer)->getJson('/api/users')
            ->assertJsonPath('data.0.avatar_url', '/storage/avatars/me.png');
    }
}
