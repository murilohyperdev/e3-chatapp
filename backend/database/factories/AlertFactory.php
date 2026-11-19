<?php

namespace Database\Factories;

use App\Models\Alert;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Alert>
 */
class AlertFactory extends Factory
{
    /**
     * An active alert started by an administrator. Mass assignment is closed on
     * the model, so the factory writes the columns directly.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'started_by' => User::factory()->administrator(),
            'ended_at' => null,
            'ended_by' => null,
            'revision' => 1,
        ];
    }

    public function ended(): static
    {
        return $this->state(fn () => [
            'ended_at' => now(),
            'ended_by' => User::factory()->administrator(),
        ]);
    }
}
