<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Demo data (local development only). Idempotent: running it twice does not
     * duplicate accounts. Every demo account uses the password "password".
     */
    public function run(): void
    {
        $this->account('admin@example.com', 'Ada Admin', UserRole::Administrator);
        $this->account('user@example.com', 'Demo User', UserRole::User);

        // A few more people so the directory (profiles feature) has something to show.
        foreach ([
            'grace@example.com' => 'Grace Hopper',
            'linus@example.com' => 'Linus Torvalds',
            'margaret@example.com' => 'Margaret Hamilton',
        ] as $email => $name) {
            $this->account($email, $name, UserRole::User);
        }
    }

    private function account(string $email, string $name, UserRole $role): void
    {
        $user = User::firstOrNew(['email' => $email]);

        // forceFill: `role` is intentionally not mass assignable.
        $user->forceFill([
            'name' => $name,
            'password' => 'password',
            'role' => $role,
            'email_verified_at' => now(),
        ])->save();
    }
}
