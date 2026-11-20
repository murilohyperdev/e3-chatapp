<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_one_administrator_and_one_regular_user(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(UserRole::Administrator, User::where('email', 'admin@example.com')->firstOrFail()->role);
        $this->assertSame(UserRole::User, User::where('email', 'user@example.com')->firstOrFail()->role);
        $this->assertGreaterThanOrEqual(2, User::count());
    }

    public function test_running_it_twice_does_not_duplicate_accounts(): void
    {
        $this->seed(DatabaseSeeder::class);
        $count = User::count();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame($count, User::count());
    }

    public function test_it_restores_the_demo_role_and_password_of_an_existing_account(): void
    {
        User::factory()->create(['email' => 'admin@example.com', 'password' => 'something-else']);

        $this->seed(DatabaseSeeder::class);

        $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'password'])->assertOk();
        $this->assertSame(UserRole::Administrator, User::where('email', 'admin@example.com')->firstOrFail()->role);
    }

    #[DataProvider('demoAccounts')]
    public function test_demo_accounts_can_sign_in_with_the_documented_password(string $email): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->postJson('/api/login', ['email' => $email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.email', $email);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function demoAccounts(): array
    {
        return ['administrator' => ['admin@example.com'], 'regular user' => ['user@example.com']];
    }
}
