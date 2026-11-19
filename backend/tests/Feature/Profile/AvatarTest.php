<?php

namespace Tests\Feature\Profile;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AvatarTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    public function test_user_can_upload_a_profile_picture(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post("/api/users/{$user->id}/avatar", [
            'avatar' => UploadedFile::fake()->image('me.jpg', 300, 300),
        ], ['Accept' => 'application/json'])->assertOk();

        $path = $user->fresh()->avatar_path;
        $this->assertNotNull($path);
        Storage::disk('public')->assertExists($path);
        $this->assertStringStartsWith('/storage/avatars/', $response->json('data.avatar_url'));
    }

    public function test_uploading_a_new_picture_deletes_the_old_file(): void
    {
        $user = User::factory()->create();
        $headers = ['Accept' => 'application/json'];

        $this->actingAs($user)->post("/api/users/{$user->id}/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 200, 200)], $headers)->assertOk();
        $first = $user->fresh()->avatar_path;

        $this->actingAs($user)->post("/api/users/{$user->id}/avatar", ['avatar' => UploadedFile::fake()->image('b.png', 200, 200)], $headers)->assertOk();
        $second = $user->fresh()->avatar_path;

        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);
    }

    public function test_user_can_remove_their_picture(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post("/api/users/{$user->id}/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 200, 200)], ['Accept' => 'application/json']);
        $path = $user->fresh()->avatar_path;

        $this->actingAs($user)->deleteJson("/api/users/{$user->id}/avatar")
            ->assertOk()
            ->assertJsonPath('data.avatar_url', null);

        Storage::disk('public')->assertMissing($path);
        $this->assertNull($user->fresh()->avatar_path);
    }

    public function test_removing_a_picture_when_there_is_none_is_harmless(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->deleteJson("/api/users/{$user->id}/avatar")->assertOk();
    }

    /**
     * @return array<string, array{0: UploadedFile|null}>
     */
    public static function invalidUploads(): array
    {
        return [
            'not an image' => [fn () => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')],
            'text renamed to jpg' => [fn () => UploadedFile::fake()->createWithContent('fake.jpg', 'just text')],
            'gif is not allowed' => [fn () => UploadedFile::fake()->image('a.gif', 200, 200)],
            'svg is not allowed' => [fn () => UploadedFile::fake()->create('a.svg', 10, 'image/svg+xml')],
            'too large' => [fn () => UploadedFile::fake()->image('big.jpg', 200, 200)->size(2049)],
            'too small' => [fn () => UploadedFile::fake()->image('tiny.png', 32, 32)],
            'too many pixels' => [fn () => UploadedFile::fake()->image('huge.png', 4097, 100)],
        ];
    }

    /**
     * @dataProvider invalidUploads
     */
    #[DataProvider('invalidUploads')]
    public function test_invalid_uploads_are_rejected_and_the_current_picture_kept(\Closure $makeFile): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post("/api/users/{$user->id}/avatar", ['avatar' => UploadedFile::fake()->image('ok.png', 200, 200)], ['Accept' => 'application/json'])->assertOk();
        $current = $user->fresh()->avatar_path;

        $this->actingAs($user)->post("/api/users/{$user->id}/avatar", ['avatar' => $makeFile()], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('avatar');

        $this->assertSame($current, $user->fresh()->avatar_path);
        Storage::disk('public')->assertExists($current);
    }

    public function test_missing_file_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson("/api/users/{$user->id}/avatar", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('avatar');
    }

    public function test_user_cannot_change_or_remove_another_users_picture(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $other->forceFill(['avatar_path' => 'avatars/theirs.png'])->save();
        Storage::disk('public')->put('avatars/theirs.png', 'x');

        $this->actingAs($user)->post("/api/users/{$other->id}/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 200, 200)], ['Accept' => 'application/json'])
            ->assertForbidden();
        $this->actingAs($user)->deleteJson("/api/users/{$other->id}/avatar")->assertForbidden();

        $this->assertSame('avatars/theirs.png', $other->fresh()->avatar_path);
        Storage::disk('public')->assertExists('avatars/theirs.png');
    }

    public function test_administrator_cannot_change_another_users_picture(): void
    {
        $admin = User::factory()->administrator()->create();
        $other = User::factory()->create();

        $this->actingAs($admin)->post("/api/users/{$other->id}/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 200, 200)], ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_visitor_gets_401(): void
    {
        $user = User::factory()->create();

        $this->postJson("/api/users/{$user->id}/avatar", [])->assertUnauthorized();
        $this->deleteJson("/api/users/{$user->id}/avatar")->assertUnauthorized();
    }
}
